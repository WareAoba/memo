use super::{Result, database, identifier, invalid};
use crate::local_user::current_user_id;
use serde_json::{Value, json};
use sqlx::{SqliteConnection, SqlitePool};
use uuid::Uuid;

fn table(kind: &str) -> Result<&'static str> {
    match kind {
        "work" => Ok("entities"),
        "task" => Ok("task_presets"),
        _ => Err(invalid()),
    }
}
fn name(value: &str) -> Result<&str> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > 200 || value.contains('\0') {
        return Err(invalid());
    }
    Ok(value)
}

// Called only inside the schedule write transaction: cancelled/failed drafts create no presets.
pub(super) async fn resolve(
    conn: &mut SqliteConnection,
    kind: &str,
    value: &Value,
) -> Result<String> {
    if let Some(id) = value.as_str() {
        return identifier(id);
    }
    let obj = value.as_object().ok_or_else(invalid)?;
    if obj.len() != 1 {
        return Err(invalid());
    }
    let name = name(
        obj.get("name")
            .and_then(Value::as_str)
            .ok_or_else(invalid)?,
    )?;
    let table = table(kind)?;
    let existing: Option<String> = sqlx::query_scalar(&format!(
        "SELECT id FROM {table} WHERE user_id=? AND unmanaged=1 AND name=? COLLATE NOCASE"
    ))
    .bind(current_user_id())
    .bind(name)
    .fetch_optional(&mut *conn)
    .await
    .map_err(database)?;
    if let Some(id) = existing {
        return Ok(id);
    }
    let id = Uuid::new_v4().to_string();
    sqlx::query(&format!(
        "INSERT INTO {table}(id,user_id,name,unmanaged) VALUES(?,?,?,1)"
    ))
    .bind(&id)
    .bind(current_user_id())
    .bind(name)
    .execute(conn)
    .await
    .map_err(database)?;
    Ok(id)
}

pub(super) async fn matching(
    conn: &mut SqliteConnection,
    kind: &str,
    value: &str,
) -> Result<Option<String>> {
    let table = table(kind)?;
    sqlx::query_scalar(&format!(
        "SELECT id FROM {table} WHERE user_id=? AND unmanaged=1 AND name=? COLLATE NOCASE"
    ))
    .bind(current_user_id())
    .bind(value)
    .fetch_optional(conn)
    .await
    .map_err(database)
}

pub async fn suggestions(pool: &SqlitePool, kind: &str, q: &str) -> Result<Value> {
    let table = table(kind)?;
    if q.trim().is_empty() {
        return Ok(json!([]));
    }
    let q = name(q)?;
    let pattern = format!(
        "{}%",
        q.replace('!', "!!").replace('%', "!%").replace('_', "!_")
    );
    let rows: Vec<(String,String)> = sqlx::query_as(&format!("SELECT id,name FROM {table} WHERE user_id=? AND unmanaged=1 AND name LIKE ? ESCAPE '!' ORDER BY name COLLATE NOCASE,id LIMIT 10"))
        .bind(current_user_id()).bind(pattern).fetch_all(pool).await.map_err(database)?;
    Ok(json!(
        rows.into_iter()
            .map(|(id, name)| json!({"id":id,"name":name}))
            .collect::<Vec<_>>()
    ))
}

pub(super) async fn promote(
    conn: &mut SqliteConnection,
    kind: &str,
    id: &str,
    snapshot: &Value,
) -> Result<()> {
    let table = table(kind)?;
    sqlx::query(&format!(
        "UPDATE {table} SET unmanaged=0 WHERE id=? AND user_id=?"
    ))
    .bind(id)
    .bind(current_user_id())
    .execute(&mut *conn)
    .await
    .map_err(database)?;
    if kind == "work" {
        sqlx::query("UPDATE schedule_entity_snapshot SET definition=? WHERE schedule_id IN (SELECT id FROM schedules WHERE user_id=? AND entity_id=?)")
            .bind(snapshot.to_string()).bind(current_user_id()).bind(id).execute(&mut *conn).await.map_err(database)?;
        sqlx::query("UPDATE schedules SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id=? AND entity_id=?")
            .bind(current_user_id()).bind(id).execute(conn).await.map_err(database)?;
    } else {
        sqlx::query("UPDATE schedule_tasks SET default_notes_snapshot=?,source_task_preset_version=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id=? AND source_task_preset_id=?")
            .bind(snapshot["default_notes"].as_str()).bind(snapshot["version"].as_i64()).bind(current_user_id()).bind(id).execute(&mut *conn).await.map_err(database)?;
        // Unmanaged tasks have no preset items. Add definitions in bounded set-based writes;
        // task IDs, execution state, notes and attachments remain untouched.
        for item in snapshot["items"].as_array().ok_or_else(invalid)? {
            let completed = match item["item_type"].as_str() {
                Some("checkbox") => item["default_value"] == true,
                Some("text") => item["default_value"]
                    .as_str()
                    .is_some_and(|v| !v.trim().is_empty()),
                Some("number") => item["default_value"].as_f64().is_some(),
                _ => return Err(invalid()),
            };
            sqlx::query("INSERT INTO schedule_task_items(id,schedule_task_id,source_preset_item_id,position,definition,value_boolean,value_text,value_number,completed,completed_at) SELECT lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(6))),id,?,?,?,?,?,?,?,CASE WHEN ? THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE NULL END FROM schedule_tasks WHERE user_id=? AND source_task_preset_id=?")
                .bind(item["id"].as_str()).bind(item["position"].as_i64()).bind(item.to_string()).bind(item["default_value"].as_bool()).bind(item["default_value"].as_str()).bind(item["default_value"].as_f64()).bind(completed).bind(completed).bind(current_user_id()).bind(id).execute(&mut *conn).await.map_err(database)?;
        }
    }
    Ok(())
}
