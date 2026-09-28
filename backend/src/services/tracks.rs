use super::{Result, database, identifier, invalid};
use crate::{errors::ApiError, local_user::current_user_id};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

tokio::task_local! { pub(crate) static CURRENT_TRACK: String; }

pub(crate) fn current_track_id() -> String {
    CURRENT_TRACK.with(Clone::clone)
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Track {
    id: String,
    name: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Input {
    name: String,
}

impl Input {
    fn name(&self) -> Result<&str> {
        let name = self.name.trim();
        if name.is_empty() || name.chars().count() > 80 || name.chars().any(char::is_control) {
            return Err(invalid());
        }
        Ok(name)
    }
}

pub async fn resolve(pool: &SqlitePool, requested: Option<&str>) -> Result<String> {
    let owner = current_user_id();
    let id = identifier(requested.unwrap_or(&owner))?;
    sqlx::query_scalar("SELECT id FROM tracks WHERE id=? AND user_id=?")
        .bind(id)
        .bind(owner)
        .fetch_optional(pool)
        .await
        .map_err(database)?
        .ok_or(ApiError::NotFound)
}

pub async fn list(pool: &SqlitePool) -> Result<serde_json::Value> {
    let mut tx = pool.begin().await.map_err(database)?;
    let items = sqlx::query_as::<_, Track>(
        "SELECT id,name FROM tracks WHERE user_id=? ORDER BY created_at,id",
    )
    .bind(current_user_id())
    .fetch_all(&mut *tx)
    .await
    .map_err(database)?;
    let limit: i64 = sqlx::query_scalar("SELECT track_limit FROM users WHERE id=?")
        .bind(current_user_id())
        .fetch_one(&mut *tx)
        .await
        .map_err(database)?;
    tx.commit().await.map_err(database)?;
    Ok(serde_json::json!({"items":items,"limit":limit,"default_id":current_user_id()}))
}

pub async fn create(pool: &SqlitePool, input: Input) -> Result<Track> {
    let name = input.name()?.to_owned();
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    let allowed: bool = sqlx::query_scalar("SELECT (SELECT COUNT(*) FROM tracks WHERE user_id=users.id)<track_limit FROM users WHERE id=?")
        .bind(current_user_id()).fetch_one(&mut *tx).await.map_err(database)?;
    if !allowed {
        return Err(ApiError::TrackLimit);
    }
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO tracks(id,user_id,name) VALUES(?,?,?)")
        .bind(&id)
        .bind(current_user_id())
        .bind(&name)
        .execute(&mut *tx)
        .await
        .map_err(database)?;
    tx.commit().await.map_err(database)?;
    Ok(Track { id, name })
}

pub async fn rename(pool: &SqlitePool, id: &str, input: Input) -> Result<Track> {
    let id = identifier(id)?;
    let name = input.name()?.to_owned();
    let result = sqlx::query("UPDATE tracks SET name=? WHERE id=? AND user_id=?")
        .bind(&name)
        .bind(&id)
        .bind(current_user_id())
        .execute(pool)
        .await
        .map_err(database)?;
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(Track { id, name })
}
