use super::{ListQuery, Result, database, identifier, invalid};
use crate::{errors::ApiError, local_user::current_user_id};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{FromRow, SqliteConnection, SqlitePool};
use uuid::Uuid;

#[derive(Clone, Default, Deserialize, Serialize, FromRow)]
#[serde(default, deny_unknown_fields)]
struct Fields {
    group_name: String,
    name: String,
    default_notes: String,
    archived: bool,
}
#[derive(Serialize, FromRow)]
struct TaskPreset {
    id: String,
    #[sqlx(flatten)]
    #[serde(flatten)]
    fields: Fields,
    created_at: String,
    updated_at: String,
    #[sqlx(skip)]
    tags: Vec<String>,
    version: i64,
    #[sqlx(skip)]
    items: Vec<Item>,
}
#[derive(Serialize, FromRow)]
struct TaskPresetSummary {
    id: String,
    #[sqlx(flatten)]
    #[serde(flatten)]
    fields: Fields,
    created_at: String,
    updated_at: String,
    version: i64,
    #[sqlx(skip)]
    tags: Vec<String>,
    #[sqlx(rename = "tags")]
    #[serde(skip)]
    tags_json: String,
    item_count: i64,
}
#[derive(Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
struct Item {
    #[serde(default)]
    id: Option<String>,
    position: i64,
    label: String,
    item_type: String,
    #[serde(default)]
    required: bool,
    #[serde(default)]
    default_value: Value,
    #[serde(default)]
    unit: String,
}
fn clean(value: &mut String, max: usize) -> Result<()> {
    *value = value.trim().to_owned();
    if value.chars().count() > max || value.contains('\0') {
        return Err(invalid());
    }
    Ok(())
}
fn validate(
    fields: &mut Fields,
    tags: &mut Vec<String>,
    items: &mut [Item],
    previous: Option<&TaskPreset>,
) -> Result<()> {
    clean(&mut fields.group_name, 100)?;
    clean(&mut fields.name, 200)?;
    clean(&mut fields.default_notes, 5000)?;
    if fields.name.is_empty() || tags.len() > 20 || items.len() > 100 {
        return Err(invalid());
    }
    for tag in tags.iter_mut() {
        clean(tag, 50)?;
        if tag.is_empty() || tag.chars().any(char::is_control) {
            return Err(invalid());
        }
    }
    tags.sort();
    tags.dedup();
    let mut ids = std::collections::HashSet::new();
    for (position, item) in items.iter_mut().enumerate() {
        clean(&mut item.label, 200)?;
        clean(&mut item.unit, 50)?;
        if item.label.is_empty() || item.position != position as i64 {
            return Err(invalid());
        }
        let valid = match item.item_type.as_str() {
            "checkbox" => {
                item.unit.is_empty()
                    && (item.default_value.is_null() || item.default_value.is_boolean())
            }
            "text" => {
                item.unit.is_empty()
                    && (item.default_value.is_null()
                        || item
                            .default_value
                            .as_str()
                            .is_some_and(|s| s.chars().count() <= 5000 && !s.contains('\0')))
            }
            "number" => {
                item.default_value.is_null()
                    || item.default_value.as_f64().is_some_and(f64::is_finite)
            }
            _ => false,
        };
        if !valid {
            return Err(invalid());
        }
        if let Some(id) = &item.id {
            let normalized = identifier(id)?;
            if !ids.insert(normalized.clone())
                || !previous
                    .is_some_and(|p| p.items.iter().any(|i| i.id.as_ref() == Some(&normalized)))
            {
                return Err(invalid());
            }
            item.id = Some(normalized);
        } else {
            item.id = Some(Uuid::new_v4().to_string());
        }
    }
    Ok(())
}
async fn read_items(conn: &mut SqliteConnection, id: &str) -> Result<Vec<Item>> {
    let rows: Vec<(String,i64,String,String,bool,String,String)> = sqlx::query_as("SELECT id,position,label,item_type,required,default_value,unit FROM task_preset_items WHERE task_preset_id=? ORDER BY position")
        .bind(id).fetch_all(conn).await.map_err(database)?;
    rows.into_iter()
        .map(|(id, position, label, item_type, required, value, unit)| {
            Ok(Item {
                id: Some(id),
                position,
                label,
                item_type,
                required,
                default_value: serde_json::from_str(&value)
                    .map_err(|_| ApiError::DatabaseUnavailable)?,
                unit,
            })
        })
        .collect()
}
async fn read(conn: &mut SqliteConnection, id: &str) -> Result<TaskPreset> {
    let mut task_preset =
        sqlx::query_as::<_, TaskPreset>("SELECT * FROM task_presets WHERE id=? AND user_id=?")
            .bind(id)
            .bind(current_user_id())
            .fetch_optional(&mut *conn)
            .await
            .map_err(database)?
            .ok_or(ApiError::TaskPresetNotFound)?;
    task_preset.tags = read_tags(conn, id).await?;
    task_preset.items = read_items(conn, id).await?;
    Ok(task_preset)
}
async fn read_tags(conn: &mut SqliteConnection, id: &str) -> Result<Vec<String>> {
    sqlx::query_scalar("SELECT t.name FROM tags t JOIN task_preset_tags et ON t.id=et.tag_id AND t.user_id=et.user_id WHERE et.task_preset_id=? AND et.user_id=? ORDER BY t.name")
        .bind(id).bind(current_user_id()).fetch_all(conn).await.map_err(database)
}
async fn write_tags(conn: &mut SqliteConnection, id: &str, tags: &[String]) -> Result<()> {
    sqlx::query("DELETE FROM task_preset_tags WHERE task_preset_id=? AND user_id=?")
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
        sqlx::query("INSERT INTO task_preset_tags(task_preset_id,tag_id,user_id) SELECT ?,id,user_id FROM tags WHERE user_id=? AND name=?")
            .bind(id).bind(current_user_id()).bind(name).execute(&mut *conn).await.map_err(database)?;
    }
    Ok(())
}
async fn write(
    conn: &mut SqliteConnection,
    id: &str,
    f: &Fields,
    tags: &[String],
    items: &[Item],
    previous: Option<&TaskPreset>,
) -> Result<()> {
    sqlx::query("UPDATE task_presets SET group_name=?,name=?,default_notes=?,archived=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND user_id=?")
        .bind(&f.group_name).bind(&f.name).bind(&f.default_notes).bind(f.archived).bind(id).bind(current_user_id()).execute(&mut *conn).await.map_err(database)?;
    let old_items = previous.map(|p| p.items.as_slice()).unwrap_or_default();
    let created: Vec<(String, String)> = if old_items != items {
        sqlx::query_as("SELECT id,created_at FROM task_preset_items WHERE task_preset_id=?")
            .bind(id)
            .fetch_all(&mut *conn)
            .await
            .map_err(database)?
    } else {
        Vec::new()
    };
    // Remove deleted or moved rows first so position swaps satisfy the UNIQUE constraint.
    for old in old_items {
        if !items
            .iter()
            .any(|item| item.id == old.id && item.position == old.position)
        {
            sqlx::query("DELETE FROM task_preset_items WHERE id=? AND task_preset_id=?")
                .bind(&old.id)
                .bind(id)
                .execute(&mut *conn)
                .await
                .map_err(database)?;
        }
    }
    for item in items {
        if old_items.contains(item) {
            continue;
        }
        if old_items
            .iter()
            .any(|old| old.id == item.id && old.position == item.position)
        {
            sqlx::query("UPDATE task_preset_items SET label=?,item_type=?,required=?,default_value=?,unit=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND task_preset_id=?")
                .bind(&item.label).bind(&item.item_type).bind(item.required).bind(item.default_value.to_string()).bind(&item.unit).bind(&item.id).bind(id)
                .execute(&mut *conn).await.map_err(database)?;
            continue;
        }
        let created_at = created
            .iter()
            .find(|(key, _)| Some(key) == item.id.as_ref())
            .map(|(_, time)| time);
        sqlx::query("INSERT INTO task_preset_items(id,task_preset_id,position,label,item_type,required,default_value,unit,created_at) VALUES(?,?,?,?,?,?,?,?,COALESCE(?,strftime('%Y-%m-%dT%H:%M:%fZ','now')))")
            .bind(&item.id).bind(id).bind(item.position).bind(&item.label).bind(&item.item_type).bind(item.required).bind(item.default_value.to_string()).bind(&item.unit).bind(created_at)
            .execute(&mut *conn).await.map_err(database)?;
    }
    if previous.is_none_or(|p| p.tags != tags) {
        write_tags(conn, id, tags).await?;
    }
    Ok(())
}
fn input(value: Value, previous: Option<&TaskPreset>) -> Result<(Fields, Vec<String>, Vec<Item>)> {
    let mut object = value.as_object().cloned().ok_or_else(invalid)?;
    if object.is_empty() {
        return Err(invalid());
    }
    let mut tags = match object.remove("tags") {
        Some(value) => serde_json::from_value::<Vec<String>>(value).map_err(|_| invalid())?,
        None => previous.map(|e| e.tags.clone()).unwrap_or_default(),
    };
    let mut items = match object.remove("items") {
        Some(value) => serde_json::from_value::<Vec<Item>>(value).map_err(|_| invalid())?,
        None => previous.map(|e| e.items.clone()).unwrap_or_default(),
    };
    let mut merged = previous
        .map(|e| serde_json::to_value(&e.fields).unwrap())
        .unwrap_or(json!({}));
    merged.as_object_mut().unwrap().extend(object);
    let mut fields: Fields = serde_json::from_value(merged).map_err(|_| invalid())?;
    validate(&mut fields, &mut tags, &mut items, previous)?;
    Ok((fields, tags, items))
}
pub async fn create(pool: &SqlitePool, value: Value) -> Result<Value> {
    let (fields, tags, items) = input(value, None)?;
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    let existing = super::unmanaged_presets::matching(&mut tx, "task", &fields.name).await?;
    let promoted = existing.is_some();
    let id = existing.unwrap_or_else(|| Uuid::new_v4().to_string());
    if !promoted {
        sqlx::query("INSERT INTO task_presets(id,user_id,name) VALUES(?,?,?)")
            .bind(&id)
            .bind(current_user_id())
            .bind(&fields.name)
            .execute(&mut *tx)
            .await
            .map_err(database)?;
    }
    write(&mut tx, &id, &fields, &tags, &items, None).await?;
    let task_preset = read(&mut tx, &id).await?;
    if promoted {
        super::unmanaged_presets::promote(&mut tx, "task", &id, &json!(task_preset)).await?;
    }
    tx.commit().await.map_err(database)?;
    Ok(json!(task_preset))
}
pub async fn get(pool: &SqlitePool, id: &str) -> Result<Value> {
    let id = identifier(id)?;
    if sqlx::query_scalar::<_, bool>("SELECT unmanaged FROM task_presets WHERE id=? AND user_id=?")
        .bind(&id)
        .bind(current_user_id())
        .fetch_optional(pool)
        .await
        .map_err(database)?
        .unwrap_or(false)
    {
        return Err(ApiError::TaskPresetNotFound);
    }
    let mut tx = pool.begin().await.map_err(database)?;
    let task_preset = read(&mut tx, &id).await?;
    tx.commit().await.map_err(database)?;
    Ok(json!(task_preset))
}
pub async fn patch(pool: &SqlitePool, id: &str, value: Value) -> Result<Value> {
    let id = identifier(id)?;
    if sqlx::query_scalar::<_, bool>("SELECT unmanaged FROM task_presets WHERE id=? AND user_id=?")
        .bind(&id)
        .bind(current_user_id())
        .fetch_optional(pool)
        .await
        .map_err(database)?
        .unwrap_or(false)
    {
        return Err(ApiError::TaskPresetNotFound);
    }
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    let previous = read(&mut tx, &id).await?;
    let (fields, tags, items) = input(value, Some(&previous))?;
    if serde_json::to_value(&fields).unwrap() == serde_json::to_value(&previous.fields).unwrap()
        && tags == previous.tags
        && items == previous.items
    {
        tx.commit().await.map_err(database)?;
        return Ok(json!(previous));
    }
    sqlx::query("UPDATE task_presets SET version=version+1 WHERE id=? AND user_id=?")
        .bind(&id)
        .bind(current_user_id())
        .execute(&mut *tx)
        .await
        .map_err(database)?;
    write(&mut tx, &id, &fields, &tags, &items, Some(&previous)).await?;
    let task_preset = read(&mut tx, &id).await?;
    tx.commit().await.map_err(database)?;
    Ok(json!(task_preset))
}
pub async fn archive(pool: &SqlitePool, id: &str) -> Result<()> {
    let id = identifier(id)?;
    if sqlx::query_scalar::<_, bool>("SELECT unmanaged FROM task_presets WHERE id=? AND user_id=?")
        .bind(&id)
        .bind(current_user_id())
        .fetch_optional(pool)
        .await
        .map_err(database)?
        .unwrap_or(false)
    {
        return Err(ApiError::TaskPresetNotFound);
    }
    let result = sqlx::query("UPDATE task_presets SET version=version+CASE WHEN archived=0 THEN 1 ELSE 0 END,archived=1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND user_id=?")
        .bind(id).bind(current_user_id()).execute(pool).await.map_err(database)?;
    if result.rows_affected() == 0 {
        return Err(ApiError::TaskPresetNotFound);
    }
    Ok(())
}
pub async fn list(pool: &SqlitePool, q: ListQuery) -> Result<Value> {
    let limit = q.limit.unwrap_or(20);
    let search = q.search()?;
    let mut tx = pool.begin().await.map_err(database)?;
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM task_presets WHERE user_id=? AND unmanaged=0 AND archived=? AND (? IS NULL OR group_name=?) AND (name LIKE ? ESCAPE '!' OR EXISTS (SELECT 1 FROM task_preset_tags pt JOIN tags t ON t.id=pt.tag_id AND t.user_id=pt.user_id WHERE pt.task_preset_id=task_presets.id AND pt.user_id=task_presets.user_id AND t.name LIKE ? ESCAPE '!'))")
        .bind(current_user_id()).bind(q.archived).bind(&q.group_name).bind(&q.group_name).bind(&search).bind(&search).fetch_one(&mut *tx).await.map_err(database)?;
    let mut items = sqlx::query_as::<_,TaskPresetSummary>("SELECT p.*, (SELECT COUNT(*) FROM task_preset_items i WHERE i.task_preset_id=p.id) AS item_count, (SELECT json_group_array(name) FROM (SELECT t.name FROM task_preset_tags pt JOIN tags t ON t.id=pt.tag_id AND t.user_id=pt.user_id WHERE pt.task_preset_id=p.id AND pt.user_id=p.user_id ORDER BY t.name)) AS tags FROM task_presets p WHERE user_id=? AND unmanaged=0 AND archived=? AND (? IS NULL OR group_name=?) AND (name LIKE ? ESCAPE '!' OR EXISTS (SELECT 1 FROM task_preset_tags pt JOIN tags t ON t.id=pt.tag_id AND t.user_id=pt.user_id WHERE pt.task_preset_id=p.id AND pt.user_id=p.user_id AND t.name LIKE ? ESCAPE '!')) ORDER BY group_name,name,id LIMIT ? OFFSET ?")
        .bind(current_user_id()).bind(q.archived).bind(&q.group_name).bind(&q.group_name).bind(&search).bind(&search).bind(limit).bind(q.offset).fetch_all(&mut *tx).await.map_err(database)?;
    for item in &mut items {
        item.tags =
            serde_json::from_str(&item.tags_json).map_err(|_| ApiError::DatabaseUnavailable)?;
    }
    tx.commit().await.map_err(database)?;
    Ok(json!({"items":items,"total":total,"limit":limit,"offset":q.offset}))
}

pub(super) async fn snapshot(conn: &mut SqliteConnection, id: &str) -> Result<Value> {
    serde_json::to_value(read(conn, id).await?).map_err(|_| ApiError::DatabaseUnavailable)
}

pub async fn groups(pool: &SqlitePool) -> Result<Value> {
    let names: Vec<String> = sqlx::query_scalar("SELECT DISTINCT group_name FROM task_presets WHERE user_id=? AND unmanaged=0 AND group_name<>'' ORDER BY group_name").bind(current_user_id()).fetch_all(pool).await.map_err(database)?;
    Ok(json!(names))
}
