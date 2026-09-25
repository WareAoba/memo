use super::{Result, database, identifier, invalid, schedules};
use crate::{errors::ApiError, local_user::current_user_id};
use serde_json::Value;
use sqlx::{Row, SqliteConnection, SqlitePool};

fn text(value: &Value) -> Result<&str> {
    let s = value.as_str().ok_or_else(invalid)?;
    if s.chars().count() > 5000 || s.contains('\0') {
        return Err(invalid());
    }
    Ok(s)
}

async fn unlocked(conn: &mut SqliteConnection, schedule: &str) -> Result<()> {
    let row = sqlx::query("SELECT status FROM schedules WHERE id=? AND user_id=?")
        .bind(schedule)
        .bind(current_user_id())
        .fetch_optional(conn)
        .await
        .map_err(database)?
        .ok_or(ApiError::ExecutionNotFound)?;
    if row.get::<String, _>("status") == "cancelled" {
        return Err(ApiError::ExecutionLocked);
    }
    Ok(())
}

async fn requirements_met(conn: &mut SqliteConnection, task: &str) -> Result<bool> {
    let rows = sqlx::query("SELECT definition,value_boolean,value_text,value_number FROM schedule_task_items WHERE schedule_task_id=?")
        .bind(task).fetch_all(conn).await.map_err(database)?;
    for row in rows {
        let definition: Value = serde_json::from_str(row.get("definition"))
            .map_err(|_| ApiError::DatabaseUnavailable)?;
        if definition["required"] != true {
            continue;
        }
        let satisfied = match definition["item_type"].as_str() {
            Some("checkbox") => row.get::<Option<bool>, _>("value_boolean") == Some(true),
            Some("text") => row
                .get::<Option<String>, _>("value_text")
                .is_some_and(|v| !v.trim().is_empty()),
            Some("number") => row
                .get::<Option<f64>, _>("value_number")
                .is_some_and(f64::is_finite),
            _ => return Err(ApiError::DatabaseUnavailable),
        };
        if !satisfied {
            return Ok(false);
        }
    }
    Ok(true)
}

async fn derived_status(conn: &mut SqliteConnection, schedule: &str) -> Result<&'static str> {
    let rows = sqlx::query("SELECT status,started_at FROM schedule_tasks WHERE schedule_id=?")
        .bind(schedule)
        .fetch_all(conn)
        .await
        .map_err(database)?;
    if !rows.is_empty()
        && rows
            .iter()
            .all(|r| matches!(r.get::<&str, _>("status"), "completed" | "skipped"))
    {
        Ok("completed")
    } else if rows.iter().any(|r| {
        r.get::<&str, _>("status") != "pending"
            || r.get::<Option<String>, _>("started_at").is_some()
    }) {
        Ok("in_progress")
    } else {
        Ok("planned")
    }
}

pub(super) async fn refresh_schedule(conn: &mut SqliteConnection, schedule: &str) -> Result<()> {
    let status = derived_status(conn, schedule).await?;
    sqlx::query("UPDATE schedules SET status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND user_id=?")
        .bind(status).bind(schedule).bind(current_user_id()).execute(conn).await.map_err(database)?;
    Ok(())
}

pub async fn task(pool: &SqlitePool, id: &str, value: Value) -> Result<Value> {
    let id = identifier(id)?;
    let fields = value.as_object().ok_or_else(invalid)?;
    if fields.is_empty()
        || fields
            .keys()
            .any(|k| k != "status" && k != "execution_notes" && k != "name" && k != "parameters")
    {
        return Err(invalid());
    }
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    let row = sqlx::query("SELECT * FROM schedule_tasks WHERE id=? AND user_id=?")
        .bind(&id)
        .bind(current_user_id())
        .fetch_optional(&mut *tx)
        .await
        .map_err(database)?
        .ok_or(ApiError::ExecutionNotFound)?;
    let schedule: String = row.get("schedule_id");
    unlocked(&mut tx, &schedule).await?;
    let old_status: &str = row.get("status");
    let status = match fields.get("status") {
        Some(v) => v.as_str().ok_or_else(invalid)?,
        None => old_status,
    };
    if !matches!(status, "pending" | "in_progress" | "completed" | "skipped") {
        return Err(invalid());
    }
    let notes = match fields.get("execution_notes") {
        Some(v) => text(v)?,
        None => row.get("execution_notes"),
    };
    let template = match fields.get("name") {
        Some(v) => text(v)?.trim(),
        None => row.get("name_template_snapshot"),
    };
    let mut parameters: std::collections::BTreeMap<String, String> =
        serde_json::from_str(row.get("parameter_values"))
            .map_err(|_| ApiError::DatabaseUnavailable)?;
    if fields.contains_key("name") {
        parameters.clear();
    }
    if let Some(v) = fields.get("parameters") {
        parameters = serde_json::from_value(v.clone()).map_err(|_| invalid())?;
    }
    let (name, parameters) = if fields.contains_key("name") || fields.contains_key("parameters") {
        super::task_parameters::resolve(template, &parameters)?
    } else {
        (row.get::<String, _>("name_snapshot"), parameters)
    };
    if name.is_empty() || name.chars().count() > 200 {
        return Err(invalid());
    }
    if fields.contains_key("status")
        && status == "completed"
        && !requirements_met(&mut tx, &id).await?
    {
        return Err(ApiError::RequirementsIncomplete);
    }
    if status != old_status
        || notes != row.get::<&str, _>("execution_notes")
        || name != row.get::<&str, _>("name_snapshot")
        || fields.contains_key("parameters")
        || fields.contains_key("name")
    {
        sqlx::query("UPDATE schedule_tasks SET status=?,execution_notes=?,name_snapshot=?,started_at=CASE WHEN ? IN ('in_progress','completed') THEN COALESCE(started_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ELSE started_at END,completed_at=CASE WHEN ?='completed' THEN COALESCE(completed_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ELSE NULL END,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?")
            .bind(status).bind(notes).bind(name).bind(status).bind(status).bind(&id).execute(&mut *tx).await.map_err(database)?;
        sqlx::query(
            "UPDATE schedule_tasks SET name_template_snapshot=?,parameter_values=? WHERE id=?",
        )
        .bind(template)
        .bind(serde_json::json!(parameters).to_string())
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(database)?;
        refresh_schedule(&mut tx, &schedule).await?;
    }
    let result = schedules::in_transaction(&mut tx, &schedule).await?;
    tx.commit().await.map_err(database)?;
    Ok(result)
}

pub async fn item(pool: &SqlitePool, id: &str, value: Value) -> Result<Value> {
    let id = identifier(id)?;
    let fields = value.as_object().ok_or_else(invalid)?;
    if fields.len() != 1 {
        return Err(invalid());
    }
    let value = fields.get("value").ok_or_else(invalid)?;
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    let row = sqlx::query("SELECT i.*,t.schedule_id,t.status AS task_status FROM schedule_task_items i JOIN schedule_tasks t ON t.id=i.schedule_task_id WHERE i.id=? AND t.user_id=?")
        .bind(&id).bind(current_user_id()).fetch_optional(&mut *tx).await.map_err(database)?.ok_or(ApiError::ExecutionNotFound)?;
    let schedule: String = row.get("schedule_id");
    let task: String = row.get("schedule_task_id");
    unlocked(&mut tx, &schedule).await?;
    let definition: Value =
        serde_json::from_str(row.get("definition")).map_err(|_| ApiError::DatabaseUnavailable)?;
    let (mut boolean, mut string, mut number) = (None, None, None);
    let completed = if value.is_null() {
        false
    } else {
        match definition["item_type"].as_str() {
            Some("checkbox") => {
                boolean = Some(value.as_bool().ok_or_else(invalid)?);
                boolean == Some(true)
            }
            Some("text") => {
                string = Some(text(value)?);
                !string.unwrap_or_default().trim().is_empty()
            }
            Some("number") => {
                let n = value
                    .as_f64()
                    .filter(|n| n.is_finite())
                    .ok_or_else(invalid)?;
                number = Some(n);
                true
            }
            _ => return Err(ApiError::DatabaseUnavailable),
        }
    };
    if boolean != row.get::<Option<bool>, _>("value_boolean")
        || string != row.get::<Option<&str>, _>("value_text")
        || number != row.get::<Option<f64>, _>("value_number")
        || completed != row.get::<bool, _>("completed")
    {
        sqlx::query("UPDATE schedule_task_items SET value_boolean=?,value_text=?,value_number=?,completed=?,completed_at=CASE WHEN ? THEN COALESCE(completed_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ELSE NULL END,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?")
            .bind(boolean).bind(string).bind(number).bind(completed).bind(completed).bind(&id).execute(&mut *tx).await.map_err(database)?;
        let keep_complete = row.get::<&str, _>("task_status") == "completed"
            && requirements_met(&mut tx, &task).await?;
        sqlx::query("UPDATE schedule_tasks SET status=?,started_at=COALESCE(started_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),completed_at=CASE WHEN ? THEN completed_at ELSE NULL END,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?")
            .bind(if keep_complete { "completed" } else { "in_progress" }).bind(keep_complete).bind(&task).execute(&mut *tx).await.map_err(database)?;
        refresh_schedule(&mut tx, &schedule).await?;
    }
    let result = schedules::in_transaction(&mut tx, &schedule).await?;
    tx.commit().await.map_err(database)?;
    Ok(result)
}

pub async fn schedule_status(pool: &SqlitePool, id: &str, value: Value) -> Result<Value> {
    let id = identifier(id)?;
    let fields = value.as_object().ok_or_else(invalid)?;
    if fields.len() != 1 {
        return Err(invalid());
    }
    let requested = fields
        .get("status")
        .and_then(Value::as_str)
        .ok_or_else(invalid)?;
    if !matches!(
        requested,
        "planned" | "in_progress" | "completed" | "cancelled"
    ) {
        return Err(invalid());
    }
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    let row = sqlx::query("SELECT status FROM schedules WHERE id=? AND user_id=?")
        .bind(&id)
        .bind(current_user_id())
        .fetch_optional(&mut *tx)
        .await
        .map_err(database)?
        .ok_or(ApiError::ScheduleNotFound)?;
    if row.get::<&str, _>("status") == "cancelled" && !matches!(requested, "planned" | "cancelled")
    {
        return Err(ApiError::ExecutionLocked);
    }
    if requested == "completed" {
        let pending: i64 = sqlx::query_scalar("SELECT count(*) FROM schedule_tasks WHERE schedule_id=? AND status NOT IN ('completed','skipped')")
            .bind(&id).fetch_one(&mut *tx).await.map_err(database)?;
        if pending != 0 {
            return Err(ApiError::RequirementsIncomplete);
        }
    }
    let status = if requested == "planned" {
        derived_status(&mut tx, &id).await?
    } else {
        requested
    };
    if status != row.get::<&str, _>("status") {
        sqlx::query("UPDATE schedules SET status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?")
            .bind(status).bind(&id).execute(&mut *tx).await.map_err(database)?;
    }
    let result = schedules::in_transaction(&mut tx, &id).await?;
    tx.commit().await.map_err(database)?;
    Ok(result)
}

/// Validate the entire work before writing any task, then commit together.
pub async fn complete_schedule(pool: &SqlitePool, id: &str, value: Value) -> Result<Value> {
    let id = identifier(id)?;
    if value != serde_json::json!({}) {
        return Err(invalid());
    }
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    unlocked(&mut tx, &id).await?;
    let tasks: Vec<String> =
        sqlx::query_scalar("SELECT id FROM schedule_tasks WHERE schedule_id=? AND user_id=?")
            .bind(&id)
            .bind(current_user_id())
            .fetch_all(&mut *tx)
            .await
            .map_err(database)?;
    for task in &tasks {
        if !requirements_met(&mut tx, task).await? {
            return Err(ApiError::RequirementsIncomplete);
        }
    }
    sqlx::query("UPDATE schedule_tasks SET status='completed',started_at=COALESCE(started_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),completed_at=COALESCE(completed_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE schedule_id=? AND user_id=? AND status<>'completed'")
        .bind(&id).bind(current_user_id()).execute(&mut *tx).await.map_err(database)?;
    sqlx::query("UPDATE schedules SET status='completed',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND user_id=?")
        .bind(&id).bind(current_user_id()).execute(&mut *tx).await.map_err(database)?;
    let result = schedules::in_transaction(&mut tx, &id).await?;
    tx.commit().await.map_err(database)?;
    Ok(result)
}

pub async fn add_task(pool: &SqlitePool, id: &str, value: Value) -> Result<Value> {
    let id = identifier(id)?;
    let fields = value.as_object().ok_or_else(invalid)?;
    if fields.keys().any(|k| {
        !matches!(
            k.as_str(),
            "task_preset_id" | "parameters" | "execution_notes"
        )
    }) {
        return Err(invalid());
    }
    let source_value = fields.get("task_preset_id").ok_or_else(invalid)?;
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    let source = super::unmanaged_presets::resolve(&mut tx, "task", source_value).await?;
    unlocked(&mut tx, &id).await?;
    let position: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(position)+1,0) FROM schedule_tasks WHERE schedule_id=?",
    )
    .bind(&id)
    .fetch_one(&mut *tx)
    .await
    .map_err(database)?;
    if position >= 100 {
        return Err(invalid());
    }
    let mut customization = fields.clone();
    customization.remove("task_preset_id");
    let customization =
        serde_json::from_value(Value::Object(customization)).map_err(|_| invalid())?;
    schedules::append_preset(&mut tx, &id, &source, position, Some(&customization)).await?;
    refresh_schedule(&mut tx, &id).await?;
    let result = schedules::in_transaction(&mut tx, &id).await?;
    tx.commit().await.map_err(database)?;
    Ok(result)
}

/// Clear completion marks atomically while preserving all recorded inputs and notes.
pub async fn reopen_schedule(pool: &SqlitePool, id: &str, value: Value) -> Result<Value> {
    let id = identifier(id)?;
    if value != serde_json::json!({}) {
        return Err(invalid());
    }
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    unlocked(&mut tx, &id).await?;
    sqlx::query("UPDATE schedule_tasks SET status='pending',completed_at=NULL,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE schedule_id=? AND user_id=? AND status IN ('completed','skipped')")
        .bind(&id).bind(current_user_id()).execute(&mut *tx).await.map_err(database)?;
    refresh_schedule(&mut tx, &id).await?;
    let result = schedules::in_transaction(&mut tx, &id).await?;
    tx.commit().await.map_err(database)?;
    Ok(result)
}
