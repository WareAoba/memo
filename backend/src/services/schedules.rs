use super::{Result, database, identifier, invalid};
use crate::{errors::ApiError, local_user::current_user_id};
use chrono::{NaiveDateTime, TimeZone};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{FromRow, Row, SqliteConnection, SqlitePool};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Clone, Deserialize, Serialize, FromRow)]
#[serde(deny_unknown_fields)]
struct Fields {
    scheduled_date: String,
    #[serde(default)]
    end_date: String,
    start_time: String,
    end_time: String,
    time_zone: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    notes: String,
    #[serde(default = "default_color")]
    color: String,
    #[serde(default)]
    reminder_enabled: bool,
    #[serde(default = "default_reminder_value")]
    reminder_value: i64,
    #[serde(default = "default_reminder_unit")]
    reminder_unit: String,
}
fn default_reminder_value() -> i64 {
    15
}
fn default_color() -> String {
    "none".into()
}
fn default_reminder_unit() -> String {
    "minutes".into()
}
fn reminder_times(f: &Fields) -> Result<(Option<i64>, Option<i64>)> {
    let multiplier = match f.reminder_unit.as_str() {
        "minutes" => 60,
        "hours" => 3600,
        "days" => 86400,
        "weeks" => 604800,
        _ => return Err(invalid()),
    };
    let seconds = f
        .reminder_value
        .checked_mul(multiplier)
        .ok_or_else(invalid)?;
    if !(1..=365 * 86400).contains(&seconds) || f.reminder_value < 1 {
        return Err(invalid());
    }
    if !f.reminder_enabled {
        return Ok((None, None));
    }
    let zone = f
        .time_zone
        .parse::<chrono_tz::Tz>()
        .map_err(|_| invalid())?;
    let local = NaiveDateTime::parse_from_str(
        &format!("{} {}", f.scheduled_date, f.start_time),
        "%Y-%m-%d %H:%M",
    )
    .map_err(|_| invalid())?;
    let start = zone
        .from_local_datetime(&local)
        .earliest()
        .ok_or_else(invalid)?
        .timestamp();
    Ok((Some(start - seconds), Some(start)))
}
#[derive(Serialize, FromRow)]
struct Schedule {
    id: String,
    entity_id: Option<String>,
    #[serde(flatten)]
    #[sqlx(flatten)]
    fields: Fields,
    status: String,
    created_at: String,
    updated_at: String,
}
#[derive(Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct ListQuery {
    q: Option<String>,
    date: Option<String>,
    from: Option<String>,
    to: Option<String>,
    entity_id: Option<String>,
    limit: Option<i64>,
    include_details: bool,
    revision: Option<i64>,
    offset: i64,
}
fn date(s: &str) -> bool {
    let b = s.as_bytes();
    if b.len() != 10
        || b[4] != b'-'
        || b[7] != b'-'
        || !b
            .iter()
            .enumerate()
            .all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit())
    {
        return false;
    }
    let y: u32 = s[..4].parse().unwrap_or(0);
    let m: u32 = s[5..7].parse().unwrap_or(0);
    let d: u32 = s[8..].parse().unwrap_or(0);
    let days = match m {
        4 | 6 | 9 | 11 => 30,
        2 => {
            if y.is_multiple_of(400) || (y.is_multiple_of(4) && !y.is_multiple_of(100)) {
                29
            } else {
                28
            }
        }
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        _ => 0,
    };
    y > 0 && d > 0 && d <= days
}
fn time(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 5
        && b[2] == b':'
        && [b[0], b[1], b[3], b[4]].iter().all(u8::is_ascii_digit)
        && &s[..2] < "24"
        && &s[3..] < "60"
}
fn validate(f: &mut Fields) -> Result<()> {
    f.title = f.title.trim().to_owned();
    f.notes = f.notes.trim().to_owned();
    if !date(&f.scheduled_date)
        || !time(&f.start_time)
        || !time(&f.end_time)
        || !date(&f.end_date)
        || f.end_date < f.scheduled_date
        || (f.end_date == f.scheduled_date && f.start_time >= f.end_time)
        || f.time_zone.parse::<chrono_tz::Tz>().is_err()
        || f.title.chars().count() > 200
        || f.notes.chars().count() > 5000
        || f.title.contains('\0')
        || f.notes.contains('\0')
        || !matches!(
            f.color.as_str(),
            "none" | "red" | "orange" | "yellow" | "green" | "blue" | "indigo" | "violet"
        )
    {
        return Err(invalid());
    }
    Ok(())
}
async fn read(conn: &mut SqliteConnection, id: &str) -> Result<Schedule> {
    sqlx::query_as("SELECT * FROM schedules WHERE id=? AND user_id=?")
        .bind(id)
        .bind(current_user_id())
        .fetch_optional(conn)
        .await
        .map_err(database)?
        .ok_or(ApiError::ScheduleNotFound)
}
async fn detail(conn: &mut SqliteConnection, s: Schedule) -> Result<Value> {
    details(conn, vec![s])
        .await?
        .pop()
        .ok_or(ApiError::DatabaseUnavailable)
}

// Each page has at most 100 schedules. Bind schedule IDs rather than task IDs,
// so the number of parameters stays bounded even with 100 tasks per schedule.
async fn details(conn: &mut SqliteConnection, schedules: Vec<Schedule>) -> Result<Vec<Value>> {
    if schedules.is_empty() {
        return Ok(Vec::new());
    }
    let placeholders = vec!["?"; schedules.len()].join(",");
    let snapshot_sql = format!(
        "SELECT schedule_id,definition FROM schedule_entity_snapshot WHERE schedule_id IN ({placeholders})"
    );
    let mut query = sqlx::query(&snapshot_sql);
    for schedule in &schedules {
        query = query.bind(&schedule.id);
    }
    let mut snapshots = HashMap::<String, Value>::new();
    for row in query.fetch_all(&mut *conn).await.map_err(database)? {
        let definition = serde_json::from_str(row.get("definition"))
            .map_err(|_| ApiError::DatabaseUnavailable)?;
        snapshots.insert(row.get("schedule_id"), definition);
    }
    let item_sql = format!(
        "SELECT i.* FROM schedule_task_items i JOIN schedule_tasks t ON t.id=i.schedule_task_id WHERE t.user_id=? AND t.schedule_id IN ({placeholders}) ORDER BY i.schedule_task_id,i.position"
    );
    let mut query = sqlx::query(&item_sql).bind(current_user_id());
    for schedule in &schedules {
        query = query.bind(&schedule.id);
    }
    let mut items_by_task = HashMap::<String, Vec<Value>>::new();
    for i in query.fetch_all(&mut *conn).await.map_err(database)? {
        let definition: Value =
            serde_json::from_str(i.get("definition")).map_err(|_| ApiError::DatabaseUnavailable)?;
        items_by_task.entry(i.get("schedule_task_id")).or_default().push(json!({"id":i.get::<String,_>("id"),"source_preset_item_id":i.get::<String,_>("source_preset_item_id"),"position":i.get::<i64,_>("position"),"definition":definition,"value_boolean":i.get::<Option<bool>,_>("value_boolean"),"value_text":i.get::<Option<String>,_>("value_text"),"value_number":i.get::<Option<f64>,_>("value_number"),"completed":i.get::<bool,_>("completed")}));
    }
    let task_sql = format!(
        "SELECT * FROM schedule_tasks WHERE user_id=? AND schedule_id IN ({placeholders}) ORDER BY schedule_id,position"
    );
    let mut query = sqlx::query(&task_sql).bind(current_user_id());
    for schedule in &schedules {
        query = query.bind(&schedule.id);
    }
    let rows = query.fetch_all(&mut *conn).await.map_err(database)?;
    let mut tasks_by_schedule = HashMap::<String, Vec<Value>>::new();
    for r in rows {
        let id: String = r.get("id");
        let values = items_by_task.remove(&id).unwrap_or_default();
        tasks_by_schedule.entry(r.get("schedule_id")).or_default().push(json!({"id":id,"source_task_preset_id":r.get::<Option<String>,_>("source_task_preset_id"),"source_task_preset_version":r.get::<i64,_>("source_task_preset_version"),"name_snapshot":r.get::<String,_>("name_snapshot"),"name_template_snapshot":r.get::<String,_>("name_template_snapshot"),"parameter_values":serde_json::from_str::<Value>(r.get("parameter_values")).map_err(|_| ApiError::DatabaseUnavailable)?,"default_notes_snapshot":r.get::<String,_>("default_notes_snapshot"),"position":r.get::<i64,_>("position"),"status":r.get::<String,_>("status"),"execution_notes":r.get::<String,_>("execution_notes"),"items":values}));
    }
    schedules
        .into_iter()
        .map(|s| {
            let work = snapshots
                .remove(&s.id)
                .ok_or(ApiError::DatabaseUnavailable)?;
            let tasks = tasks_by_schedule.remove(&s.id).unwrap_or_default();
            let mut value = serde_json::to_value(s).map_err(|_| ApiError::DatabaseUnavailable)?;
            value["entity_snapshot"] = work;
            value["tasks"] = json!(tasks);
            Ok(value)
        })
        .collect()
}
pub async fn get(pool: &SqlitePool, id: &str) -> Result<Value> {
    let id = identifier(id)?;
    let mut tx = pool.begin().await.map_err(database)?;
    let s = read(&mut tx, &id).await?;
    let v = detail(&mut tx, s).await?;
    tx.commit().await.map_err(database)?;
    Ok(v)
}
pub(super) async fn in_transaction(conn: &mut SqliteConnection, id: &str) -> Result<Value> {
    let schedule = read(conn, id).await?;
    detail(conn, schedule).await
}
pub async fn create(pool: &SqlitePool, mut value: Value) -> Result<Value> {
    if value["end_time"] == "00:00" {
        return Err(invalid());
    }
    let obj = value.as_object_mut().ok_or_else(invalid)?;
    let work_input = match (obj.remove("entity_id"), obj.remove("entity_name")) {
        (Some(id), None) => id,
        (None, Some(name)) => json!({"name":name}),
        _ => return Err(invalid()),
    };
    let ids: Vec<Value> =
        serde_json::from_value(obj.remove("task_preset_ids").ok_or_else(invalid)?)
            .map_err(|_| invalid())?;
    let customizations: HashMap<String, super::task_parameters::Customization> =
        serde_json::from_value(
            obj.remove("task_customizations")
                .unwrap_or_else(|| json!({})),
        )
        .map_err(|_| invalid())?;
    if customizations.keys().any(|id| {
        !ids.iter().any(|v| {
            v.as_str() == Some(id.as_str())
                || v.get("name")
                    .and_then(Value::as_str)
                    .is_some_and(|n| format!("name:{n}") == *id)
        })
    }) {
        return Err(invalid());
    }
    if ids.len() > 100 {
        return Err(invalid());
    }
    let mut f: Fields = serde_json::from_value(value).map_err(|_| invalid())?;
    if f.end_date.is_empty() {
        f.end_date = f.scheduled_date.clone();
    }
    validate(&mut f)?;
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    let entity_id = super::unmanaged_presets::resolve(&mut tx, "work", &work_input).await?;
    let mut unique = std::collections::HashSet::new();
    let mut selected = vec![];
    for value in ids {
        let key = value
            .as_str()
            .map(str::to_owned)
            .unwrap_or_else(|| format!("name:{}", value["name"].as_str().unwrap_or_default()));
        let id = super::unmanaged_presets::resolve(&mut tx, "task", &value).await?;
        if unique.insert(id.clone()) {
            selected.push((id, key));
        }
    }
    let work = super::works::snapshot(&mut tx, &entity_id).await?;
    if work["archived"] == true {
        return Err(invalid());
    }
    if f.title.is_empty() {
        f.title = work["name"].as_str().unwrap_or_default().to_owned();
    }
    let id = Uuid::new_v4().to_string();
    let (reminder_at, reminder_start_at) = reminder_times(&f)?;
    sqlx::query("INSERT INTO schedules(id,user_id,entity_id,title,scheduled_date,end_date,start_time,end_time,time_zone,notes,color,reminder_enabled,reminder_value,reminder_unit,reminder_at,reminder_start_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(&id).bind(current_user_id()).bind(&entity_id).bind(&f.title).bind(&f.scheduled_date).bind(&f.end_date).bind(&f.start_time).bind(&f.end_time).bind(&f.time_zone).bind(&f.notes).bind(&f.color).bind(f.reminder_enabled).bind(f.reminder_value).bind(&f.reminder_unit).bind(reminder_at).bind(reminder_start_at).execute(&mut *tx).await.map_err(database)?;
    sqlx::query("INSERT INTO schedule_entity_snapshot(id,schedule_id,definition) VALUES(?,?,?)")
        .bind(Uuid::new_v4().to_string())
        .bind(&id)
        .bind(work.to_string())
        .execute(&mut *tx)
        .await
        .map_err(database)?;
    for (position, (source, key)) in selected.iter().enumerate() {
        append_preset(
            &mut tx,
            &id,
            source,
            position as i64,
            customizations.get(key),
        )
        .await?;
    }
    let s = read(&mut tx, &id).await?;
    let result = detail(&mut tx, s).await?;
    tx.commit().await.map_err(database)?;
    Ok(result)
}
pub async fn patch(pool: &SqlitePool, id: &str, value: Value) -> Result<Value> {
    let id = identifier(id)?;
    let changes = value.as_object().ok_or_else(invalid)?;
    if changes.get("end_time").and_then(Value::as_str) == Some("00:00") {
        return Err(invalid());
    }
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    let s = read(&mut tx, &id).await?;
    let mut fields = serde_json::to_value(&s.fields).map_err(|_| invalid())?;
    for (k, v) in changes {
        if fields.get(k).is_none() {
            return Err(invalid());
        }
        fields[k] = v.clone();
    }
    if changes.contains_key("scheduled_date")
        && !changes.contains_key("end_date")
        && s.fields.end_date == s.fields.scheduled_date
    {
        fields["end_date"] = fields["scheduled_date"].clone();
    }
    let mut f: Fields = serde_json::from_value(fields).map_err(|_| invalid())?;
    if f.end_date.is_empty() {
        f.end_date = f.scheduled_date.clone();
    }
    validate(&mut f)?;
    let (reminder_at, reminder_start_at) = reminder_times(&f)?;
    sqlx::query("UPDATE schedules SET title=?,scheduled_date=?,end_date=?,start_time=?,end_time=?,time_zone=?,notes=?,color=?,reminder_enabled=?,reminder_value=?,reminder_unit=?,reminder_at=?,reminder_start_at=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND user_id=?").bind(f.title).bind(f.scheduled_date).bind(f.end_date).bind(f.start_time).bind(f.end_time).bind(f.time_zone).bind(f.notes).bind(f.color).bind(f.reminder_enabled).bind(f.reminder_value).bind(f.reminder_unit).bind(reminder_at).bind(reminder_start_at).bind(&id).bind(current_user_id()).execute(&mut *tx).await.map_err(database)?;
    let s = read(&mut tx, &id).await?;
    let result = detail(&mut tx, s).await?;
    tx.commit().await.map_err(database)?;
    Ok(result)
}
pub async fn list(pool: &SqlitePool, q: ListQuery) -> Result<Value> {
    let limit = q.limit.unwrap_or(20);
    let search = q.q.as_deref().unwrap_or_default().trim();
    if search.chars().count() > 200 || search.contains('\0') {
        return Err(invalid());
    }
    let pattern = (!search.is_empty()).then(|| {
        format!(
            "%{}%",
            search
                .replace('!', "!!")
                .replace('%', "!%")
                .replace('_', "!_")
        )
    });
    if !(1..=100).contains(&limit)
        || !(0..=1_000_000).contains(&q.offset)
        || (q.date.is_some() && (q.from.is_some() || q.to.is_some()))
        || q.from.is_some() != q.to.is_some()
    {
        return Err(invalid());
    }
    for d in [&q.date, &q.from, &q.to].into_iter().flatten() {
        if !date(d) {
            return Err(invalid());
        }
    }
    if q.from > q.to {
        return Err(invalid());
    }
    let work = q.entity_id.as_deref().map(identifier).transpose()?;
    let from = q.date.as_ref().or(q.from.as_ref());
    let to = q.date.as_ref().or(q.to.as_ref());
    let mut tx = pool.begin().await.map_err(database)?;
    let revision: i64 = sqlx::query_scalar(
        "SELECT COALESCE((SELECT revision FROM schedule_revisions WHERE user_id=?),0)",
    )
    .bind(current_user_id())
    .fetch_one(&mut *tx)
    .await
    .map_err(database)?;
    if q.revision.is_some_and(|expected| expected != revision) {
        return Err(ApiError::ScheduleListChanged);
    }
    let filter = " FROM schedules WHERE user_id=? AND (? IS NULL OR end_date>=?) AND (? IS NULL OR scheduled_date<=?) AND (? IS NULL OR entity_id=?) AND (? IS NULL OR title LIKE ? ESCAPE '!' OR notes LIKE ? ESCAPE '!' OR EXISTS(SELECT 1 FROM schedule_entity_snapshot e WHERE e.schedule_id=schedules.id AND json_extract(e.definition,'$.name') LIKE ? ESCAPE '!') OR EXISTS(SELECT 1 FROM schedule_tasks t WHERE t.schedule_id=schedules.id AND t.user_id=schedules.user_id AND t.name_snapshot LIKE ? ESCAPE '!'))";
    let total: i64 = sqlx::query_scalar(&format!("SELECT count(*){filter}"))
        .bind(current_user_id())
        .bind(from)
        .bind(from)
        .bind(to)
        .bind(to)
        .bind(&work)
        .bind(&work)
        .bind(&pattern)
        .bind(&pattern)
        .bind(&pattern)
        .bind(&pattern)
        .bind(&pattern)
        .fetch_one(&mut *tx)
        .await
        .map_err(database)?;
    let items: Vec<Schedule> = sqlx::query_as(&format!(
        "SELECT *{filter} ORDER BY scheduled_date,start_time,id LIMIT ? OFFSET ?"
    ))
    .bind(current_user_id())
    .bind(from)
    .bind(from)
    .bind(to)
    .bind(to)
    .bind(&work)
    .bind(&work)
    .bind(&pattern)
    .bind(&pattern)
    .bind(&pattern)
    .bind(&pattern)
    .bind(&pattern)
    .bind(limit)
    .bind(q.offset)
    .fetch_all(&mut *tx)
    .await
    .map_err(database)?;
    let values = if q.include_details {
        details(&mut tx, items).await?
    } else {
        items
            .into_iter()
            .map(|item| serde_json::to_value(item).map_err(|_| ApiError::DatabaseUnavailable))
            .collect::<Result<Vec<_>>>()?
    };
    tx.commit().await.map_err(database)?;
    Ok(json!({"items":values,"total":total,"limit":limit,"offset":q.offset,"revision":revision}))
}

pub(super) async fn append_preset(
    conn: &mut SqliteConnection,
    schedule: &str,
    source: &str,
    position: i64,
    customization: Option<&super::task_parameters::Customization>,
) -> Result<()> {
    let p = super::task_presets::snapshot(&mut *conn, source).await?;
    if p["archived"] == true {
        return Err(invalid());
    }
    let task = Uuid::new_v4().to_string();
    let defaults = super::task_parameters::Customization::default();
    let customization = customization.unwrap_or(&defaults);
    let template = p["name"].as_str().ok_or(ApiError::DatabaseUnavailable)?;
    let (name, parameters) = super::task_parameters::resolve(template, &customization.parameters)?;
    if customization.execution_notes.chars().count() > 5000
        || customization.execution_notes.contains('\0')
    {
        return Err(invalid());
    }
    sqlx::query("INSERT INTO schedule_tasks(id,schedule_id,user_id,source_task_preset_id,source_task_preset_version,name_snapshot,default_notes_snapshot,position,name_template_snapshot,parameter_values,execution_notes) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(&task).bind(schedule).bind(current_user_id()).bind(source).bind(p["version"].as_i64()).bind(name).bind(p["default_notes"].as_str()).bind(position).bind(template).bind(json!(parameters).to_string()).bind(&customization.execution_notes).execute(&mut *conn).await.map_err(database)?;
    for i in p["items"].as_array().ok_or(ApiError::DatabaseUnavailable)? {
        let completed = match i["item_type"].as_str() {
            Some("checkbox") => i["default_value"] == true,
            Some("text") => i["default_value"]
                .as_str()
                .is_some_and(|v| !v.trim().is_empty()),
            Some("number") => i["default_value"].as_f64().is_some_and(f64::is_finite),
            _ => return Err(ApiError::DatabaseUnavailable),
        };
        sqlx::query("INSERT INTO schedule_task_items(id,schedule_task_id,source_preset_item_id,position,definition,value_boolean,value_text,value_number,completed,completed_at) VALUES(?,?,?,?,?,?,?,?,?,CASE WHEN ? THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE NULL END)").bind(Uuid::new_v4().to_string()).bind(&task).bind(i["id"].as_str()).bind(i["position"].as_i64()).bind(i.to_string()).bind(i["default_value"].as_bool()).bind(i["default_value"].as_str()).bind(i["default_value"].as_f64()).bind(completed).bind(completed).execute(&mut *conn).await.map_err(database)?;
    }
    Ok(())
}

pub async fn reminders(pool: &SqlitePool) -> Result<Value> {
    let rows = sqlx::query("SELECT id,title,start_time,scheduled_date,time_zone,reminder_at,reminder_start_at,reminder_version FROM schedules WHERE user_id=? AND reminder_enabled=1 AND status IN ('planned','in_progress') AND reminder_at<=unixepoch('now') AND reminder_start_at>unixepoch('now') ORDER BY reminder_at,id")
        .bind(current_user_id()).fetch_all(pool).await.map_err(database)?;
    Ok(json!(rows.into_iter().map(|r| json!({
        "id": r.get::<String,_>("id"), "title": r.get::<String,_>("title"),
        "start_time": r.get::<String,_>("start_time"), "scheduled_date": r.get::<String,_>("scheduled_date"),
        "time_zone": r.get::<String,_>("time_zone"), "reminder_at": r.get::<i64,_>("reminder_at"),
        "start_at": r.get::<i64,_>("reminder_start_at"), "reminder_version": r.get::<i64,_>("reminder_version")
    })).collect::<Vec<_>>()))
}
