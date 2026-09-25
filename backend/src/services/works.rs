use super::{ListQuery, Result, database, identifier, invalid};
use crate::{errors::ApiError, local_user::current_user_id};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{FromRow, SqliteConnection, SqlitePool};
use uuid::Uuid;

#[derive(Clone, Default, Deserialize, Serialize, FromRow)]
#[serde(default, deny_unknown_fields)]
struct Fields {
    #[sqlx(json)]
    custom_fields: Vec<CustomField>,
    name: String,
    reference_code: String,
    address: String,
    contact_name: String,
    contact_info: String,
    advance_contact_required: bool,
    notice_required: bool,
    default_work_start_time: Option<String>,
    default_work_end_time: Option<String>,
    access_instructions: String,
    parking_info: String,
    special_notes: String,
    general_notes: String,
    archived: bool,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct CustomField {
    name: String,
    value: String,
}
#[derive(Serialize, FromRow)]
struct Work {
    id: String,
    #[sqlx(flatten)]
    #[serde(flatten)]
    fields: Fields,
    created_at: String,
    updated_at: String,
    #[sqlx(skip)]
    tags: Vec<String>,
}
fn valid_time(value: &str) -> bool {
    let b = value.as_bytes();
    b.len() == 5
        && b[2] == b':'
        && [b[0], b[1], b[3], b[4]].iter().all(u8::is_ascii_digit)
        && &value[..2] < "24"
        && &value[3..] < "60"
}
fn validate(fields: &mut Fields, tags: &mut Vec<String>) -> Result<()> {
    if fields.custom_fields.len() > 100 {
        return Err(invalid());
    }
    let mut names = std::collections::HashSet::new();
    for field in &mut fields.custom_fields {
        field.name = field.name.trim().to_owned();
        if field.name.chars().count() > 100
            || field.name.chars().any(char::is_control)
            || field.value.chars().count() > 5000
            || field.value.contains('\0')
            || (!field.name.is_empty() && !names.insert(field.name.clone()))
        {
            return Err(invalid());
        }
    }
    for (value, max) in [
        (&mut fields.name, 200),
        (&mut fields.reference_code, 100),
        (&mut fields.address, 500),
        (&mut fields.contact_name, 200),
        (&mut fields.contact_info, 500),
        (&mut fields.access_instructions, 5000),
        (&mut fields.parking_info, 5000),
        (&mut fields.special_notes, 5000),
        (&mut fields.general_notes, 5000),
    ] {
        *value = value.trim().to_owned();
        if value.chars().count() > max || value.contains('\0') {
            return Err(invalid());
        }
    }
    if fields.name.is_empty() || tags.len() > 20 {
        return Err(invalid());
    }
    match (
        &fields.default_work_start_time,
        &fields.default_work_end_time,
    ) {
        (None, None) => (),
        (Some(start), Some(end)) if valid_time(start) && valid_time(end) && start < end => (),
        _ => return Err(invalid()),
    }
    for tag in tags.iter_mut() {
        *tag = tag.trim().to_owned();
        if tag.is_empty() || tag.chars().count() > 50 || tag.chars().any(char::is_control) {
            return Err(invalid());
        }
    }
    tags.sort();
    tags.dedup();
    Ok(())
}
async fn read(conn: &mut SqliteConnection, id: &str) -> Result<Work> {
    let mut work = sqlx::query_as::<_, Work>("SELECT * FROM entities WHERE id=? AND user_id=?")
        .bind(id)
        .bind(current_user_id())
        .fetch_optional(&mut *conn)
        .await
        .map_err(database)?
        .ok_or(ApiError::WorkNotFound)?;
    work.tags = read_tags(conn, id).await?;
    Ok(work)
}
async fn read_tags(conn: &mut SqliteConnection, id: &str) -> Result<Vec<String>> {
    sqlx::query_scalar("SELECT t.name FROM tags t JOIN entity_tags et ON t.id=et.tag_id AND t.user_id=et.user_id WHERE et.entity_id=? AND et.user_id=? ORDER BY t.name")
        .bind(id).bind(current_user_id()).fetch_all(conn).await.map_err(database)
}
async fn write_tags(conn: &mut SqliteConnection, id: &str, tags: &[String]) -> Result<()> {
    sqlx::query("DELETE FROM entity_tags WHERE entity_id=? AND user_id=?")
        .bind(id)
        .bind(current_user_id())
        .execute(&mut *conn)
        .await
        .map_err(database)?;
    for name in tags {
        sqlx::query(
            "INSERT INTO tags(id,user_id,name) VALUES(?,?,?) ON CONFLICT(user_id,name) DO NOTHING",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(current_user_id())
        .bind(name)
        .execute(&mut *conn)
        .await
        .map_err(database)?;
        sqlx::query("INSERT INTO entity_tags(entity_id,tag_id,user_id) SELECT ?,id,user_id FROM tags WHERE user_id=? AND name=?")
            .bind(id).bind(current_user_id()).bind(name).execute(&mut *conn).await.map_err(database)?;
    }
    Ok(())
}
async fn write(conn: &mut SqliteConnection, id: &str, f: &Fields, tags: &[String]) -> Result<()> {
    sqlx::query("UPDATE entities SET custom_fields=?,name=?,reference_code=?,address=?,contact_name=?,contact_info=?,advance_contact_required=?,notice_required=?,default_work_start_time=?,default_work_end_time=?,access_instructions=?,parking_info=?,special_notes=?,general_notes=?,archived=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND user_id=?")
        .bind(serde_json::to_string(&f.custom_fields).map_err(|_| invalid())?).bind(&f.name).bind(&f.reference_code).bind(&f.address).bind(&f.contact_name).bind(&f.contact_info)
        .bind(f.advance_contact_required).bind(f.notice_required).bind(&f.default_work_start_time).bind(&f.default_work_end_time)
        .bind(&f.access_instructions).bind(&f.parking_info).bind(&f.special_notes).bind(&f.general_notes).bind(f.archived)
        .bind(id).bind(current_user_id()).execute(&mut *conn).await.map_err(database)?;
    for field in f
        .custom_fields
        .iter()
        .filter(|field| !field.name.is_empty())
    {
        sqlx::query(
            "INSERT INTO work_field_names(user_id,name) VALUES(?,?) ON CONFLICT DO NOTHING",
        )
        .bind(current_user_id())
        .bind(&field.name)
        .execute(&mut *conn)
        .await
        .map_err(database)?;
    }
    write_tags(conn, id, tags).await
}
fn input(value: Value, previous: Option<&Work>) -> Result<(Fields, Vec<String>)> {
    let mut object = value.as_object().cloned().ok_or_else(invalid)?;
    if object.is_empty() {
        return Err(invalid());
    }
    let mut tags = match object.remove("tags") {
        Some(value) => serde_json::from_value::<Vec<String>>(value).map_err(|_| invalid())?,
        None => previous.map(|e| e.tags.clone()).unwrap_or_default(),
    };
    let mut merged = previous
        .map(|e| serde_json::to_value(&e.fields).unwrap())
        .unwrap_or(json!({}));
    merged.as_object_mut().unwrap().extend(object);
    let mut fields: Fields = serde_json::from_value(merged).map_err(|_| invalid())?;
    validate(&mut fields, &mut tags)?;
    Ok((fields, tags))
}
pub async fn create(pool: &SqlitePool, value: Value) -> Result<Value> {
    let (fields, tags) = input(value, None)?;
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    let existing = super::unmanaged_presets::matching(&mut tx, "work", &fields.name).await?;
    let promoted = existing.is_some();
    let id = existing.unwrap_or_else(|| Uuid::new_v4().to_string());
    if !promoted {
        sqlx::query("INSERT INTO entities(id,user_id,name) VALUES(?,?,?)")
            .bind(&id)
            .bind(current_user_id())
            .bind(&fields.name)
            .execute(&mut *tx)
            .await
            .map_err(database)?;
    }
    write(&mut tx, &id, &fields, &tags).await?;
    let work = read(&mut tx, &id).await?;
    if promoted {
        super::unmanaged_presets::promote(&mut tx, "work", &id, &json!(work)).await?;
    }
    tx.commit().await.map_err(database)?;
    Ok(json!(work))
}
pub async fn get(pool: &SqlitePool, id: &str) -> Result<Value> {
    let id = identifier(id)?;
    if sqlx::query_scalar::<_, bool>("SELECT unmanaged FROM entities WHERE id=? AND user_id=?")
        .bind(&id)
        .bind(current_user_id())
        .fetch_optional(pool)
        .await
        .map_err(database)?
        .unwrap_or(false)
    {
        return Err(ApiError::WorkNotFound);
    }
    let mut tx = pool.begin().await.map_err(database)?;
    let work = read(&mut tx, &id).await?;
    tx.commit().await.map_err(database)?;
    Ok(json!(work))
}
pub async fn patch(pool: &SqlitePool, id: &str, value: Value) -> Result<Value> {
    let id = identifier(id)?;
    if sqlx::query_scalar::<_, bool>("SELECT unmanaged FROM entities WHERE id=? AND user_id=?")
        .bind(&id)
        .bind(current_user_id())
        .fetch_optional(pool)
        .await
        .map_err(database)?
        .unwrap_or(false)
    {
        return Err(ApiError::WorkNotFound);
    }
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    let previous = read(&mut tx, &id).await?;
    let (fields, tags) = input(value, Some(&previous))?;
    write(&mut tx, &id, &fields, &tags).await?;
    let work = read(&mut tx, &id).await?;
    tx.commit().await.map_err(database)?;
    Ok(json!(work))
}
pub async fn archive(pool: &SqlitePool, id: &str) -> Result<()> {
    let id = identifier(id)?;
    if sqlx::query_scalar::<_, bool>("SELECT unmanaged FROM entities WHERE id=? AND user_id=?")
        .bind(&id)
        .bind(current_user_id())
        .fetch_optional(pool)
        .await
        .map_err(database)?
        .unwrap_or(false)
    {
        return Err(ApiError::WorkNotFound);
    }
    let result = sqlx::query("UPDATE entities SET archived=1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND user_id=?")
        .bind(id).bind(current_user_id()).execute(pool).await.map_err(database)?;
    if result.rows_affected() == 0 {
        return Err(ApiError::WorkNotFound);
    }
    Ok(())
}
pub async fn list(pool: &SqlitePool, q: ListQuery) -> Result<Value> {
    let limit = q.limit.unwrap_or(20);
    let search = q.search()?;
    let mut tx = pool.begin().await.map_err(database)?;
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM entities WHERE user_id=? AND unmanaged=0 AND archived=? AND (name LIKE ? ESCAPE '!' OR reference_code LIKE ? ESCAPE '!' OR address LIKE ? ESCAPE '!' OR general_notes LIKE ? ESCAPE '!' OR special_notes LIKE ? ESCAPE '!' OR contact_name LIKE ? ESCAPE '!' OR contact_info LIKE ? ESCAPE '!' OR access_instructions LIKE ? ESCAPE '!' OR parking_info LIKE ? ESCAPE '!' OR EXISTS (SELECT 1 FROM json_each(entities.custom_fields) AS detail WHERE json_extract(detail.value, '$.name') LIKE ? ESCAPE '!' OR json_extract(detail.value, '$.value') LIKE ? ESCAPE '!'))")
        .bind(current_user_id()).bind(q.archived).bind(&search).bind(&search).bind(&search).bind(&search).bind(&search).bind(&search).bind(&search).bind(&search).bind(&search).bind(&search).bind(&search).fetch_one(&mut *tx).await.map_err(database)?;
    let mut items = sqlx::query_as::<_,Work>("SELECT * FROM entities WHERE user_id=? AND unmanaged=0 AND archived=? AND (name LIKE ? ESCAPE '!' OR reference_code LIKE ? ESCAPE '!' OR address LIKE ? ESCAPE '!' OR general_notes LIKE ? ESCAPE '!' OR special_notes LIKE ? ESCAPE '!' OR contact_name LIKE ? ESCAPE '!' OR contact_info LIKE ? ESCAPE '!' OR access_instructions LIKE ? ESCAPE '!' OR parking_info LIKE ? ESCAPE '!' OR EXISTS (SELECT 1 FROM json_each(entities.custom_fields) AS detail WHERE json_extract(detail.value, '$.name') LIKE ? ESCAPE '!' OR json_extract(detail.value, '$.value') LIKE ? ESCAPE '!')) ORDER BY name,id LIMIT ? OFFSET ?")
        .bind(current_user_id()).bind(q.archived).bind(&search).bind(&search).bind(&search).bind(&search).bind(&search).bind(&search).bind(&search).bind(&search).bind(&search).bind(&search).bind(&search).bind(limit).bind(q.offset).fetch_all(&mut *tx).await.map_err(database)?;
    for work in &mut items {
        work.tags = read_tags(&mut tx, &work.id).await?;
    }
    tx.commit().await.map_err(database)?;
    Ok(json!({"items":items,"total":total,"limit":limit,"offset":q.offset}))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TimeZoneInput {
    time_zone: String,
}
pub async fn local_user(pool: &SqlitePool, input: TimeZoneInput) -> Result<Value> {
    let zone = input.time_zone;
    zone.parse::<chrono_tz::Tz>().map_err(|_| invalid())?;
    // First successfully observed device zone wins. A later settings feature can explicitly change it.
    sqlx::query("UPDATE users SET time_zone=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND time_zone IS NULL")
        .bind(&zone).bind(current_user_id()).execute(pool).await.map_err(database)?;
    let zone: String = sqlx::query_scalar("SELECT time_zone FROM users WHERE id=?")
        .bind(current_user_id())
        .fetch_one(pool)
        .await
        .map_err(database)?;
    Ok(json!({"time_zone":zone}))
}

pub(super) async fn snapshot(conn: &mut SqliteConnection, id: &str) -> Result<Value> {
    serde_json::to_value(read(conn, id).await?).map_err(|_| ApiError::DatabaseUnavailable)
}

pub async fn field_names(pool: &SqlitePool) -> Result<Value> {
    let names: Vec<String> =
        sqlx::query_scalar("SELECT name FROM work_field_names WHERE user_id=? ORDER BY name")
            .bind(current_user_id())
            .fetch_all(pool)
            .await
            .map_err(database)?;
    Ok(json!(names))
}
