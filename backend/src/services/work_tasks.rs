use super::{Result, database, identifier, invalid};
use crate::{errors::ApiError, local_user::current_user_id};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{FromRow, SqliteConnection, SqlitePool};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Input {
    task_preset_ids: Vec<String>,
}
#[derive(Serialize, FromRow)]
struct Link {
    id: String,
    name: String,
    archived: bool,
    position: i64,
}
async fn owner(conn: &mut SqliteConnection, id: &str) -> Result<()> {
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM entities WHERE id=? AND user_id=?)")
            .bind(id)
            .bind(current_user_id())
            .fetch_one(conn)
            .await
            .map_err(database)?;
    if !exists {
        return Err(ApiError::WorkNotFound);
    }
    Ok(())
}
async fn read(conn: &mut SqliteConnection, id: &str) -> Result<Value> {
    let items = sqlx::query_as::<_,Link>("SELECT p.id,p.name,p.archived,w.position FROM work_task_presets w JOIN task_presets p ON p.id=w.task_preset_id AND p.user_id=w.user_id WHERE w.entity_id=? AND w.user_id=? ORDER BY w.position")
        .bind(id).bind(current_user_id()).fetch_all(conn).await.map_err(database)?;
    Ok(json!({"items":items}))
}
pub async fn get(pool: &SqlitePool, id: &str) -> Result<Value> {
    let id = identifier(id)?;
    let mut tx = pool.begin().await.map_err(database)?;
    owner(&mut tx, &id).await?;
    let result = read(&mut tx, &id).await?;
    tx.commit().await.map_err(database)?;
    Ok(result)
}
pub async fn replace(pool: &SqlitePool, id: &str, value: Value) -> Result<Value> {
    let id = identifier(id)?;
    let input: Input = serde_json::from_value(value).map_err(|_| invalid())?;
    if input.task_preset_ids.len() > 100 {
        return Err(invalid());
    }
    let ids = input
        .task_preset_ids
        .iter()
        .map(|id| identifier(id))
        .collect::<Result<Vec<_>>>()?;
    let mut unique = std::collections::HashSet::new();
    if !ids.iter().all(|id| unique.insert(id)) {
        return Err(invalid());
    }
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    owner(&mut tx, &id).await?;
    for task in &ids {
        let archived: Option<bool> =
            sqlx::query_scalar("SELECT archived FROM task_presets WHERE id=? AND user_id=?")
                .bind(task)
                .bind(current_user_id())
                .fetch_optional(&mut *tx)
                .await
                .map_err(database)?;
        let archived = archived.ok_or(ApiError::TaskPresetNotFound)?;
        if archived {
            let linked: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM work_task_presets WHERE entity_id=? AND task_preset_id=? AND user_id=?)")
                .bind(&id).bind(task).bind(current_user_id()).fetch_one(&mut *tx).await.map_err(database)?;
            if !linked {
                return Err(invalid());
            }
        }
    }
    sqlx::query("DELETE FROM work_task_presets WHERE entity_id=? AND user_id=?")
        .bind(&id)
        .bind(current_user_id())
        .execute(&mut *tx)
        .await
        .map_err(database)?;
    for (position, task) in ids.iter().enumerate() {
        sqlx::query("INSERT INTO work_task_presets(entity_id,task_preset_id,user_id,position) VALUES(?,?,?,?)")
            .bind(&id).bind(task).bind(current_user_id()).bind(position as i64).execute(&mut *tx).await.map_err(database)?;
    }
    let result = read(&mut tx, &id).await?;
    tx.commit().await.map_err(database)?;
    Ok(result)
}
