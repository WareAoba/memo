use super::{Result, database, execution, identifier, schedules, settings};
use crate::{errors::ApiError, local_user::current_user_id};
use serde_json::Value;
use sqlx::{Row, SqlitePool};
use std::path::Path;

// Photo tombstones survive the transaction and allow failed file cleanup to retry.
pub async fn delete(pool: &SqlitePool, root: &Path, id: &str, task: bool) -> Result<Option<Value>> {
    let id = identifier(id)?;
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    let schedule: String = if task {
        sqlx::query_scalar("SELECT schedule_id FROM schedule_tasks WHERE id=? AND user_id=?")
            .bind(&id)
            .bind(current_user_id())
            .fetch_optional(&mut *tx)
            .await
            .map_err(database)?
            .ok_or(ApiError::ExecutionNotFound)?
    } else {
        id.clone()
    };
    let row = sqlx::query("SELECT status FROM schedules WHERE id=? AND user_id=?")
        .bind(&schedule)
        .bind(current_user_id())
        .fetch_optional(&mut *tx)
        .await
        .map_err(database)?
        .ok_or(ApiError::ScheduleNotFound)?;
    let cancelled = row.get::<&str, _>("status") == "cancelled";
    let photo_filter = if task {
        "schedule_task_id=? AND user_id=?"
    } else {
        "(schedule_id=? OR schedule_task_id IN (SELECT id FROM schedule_tasks WHERE schedule_id=?)) AND user_id=?"
    };
    for prefix in [
        "INSERT INTO photo_deletions(user_id,id,mime_type) SELECT user_id,id,mime_type FROM photos WHERE ",
        "DELETE FROM photos WHERE ",
    ] {
        let sql = format!("{prefix}{photo_filter}");
        let mut query = sqlx::query(&sql).bind(&id);
        if !task {
            query = query.bind(&id);
        }
        query
            .bind(current_user_id())
            .execute(&mut *tx)
            .await
            .map_err(database)?;
    }
    if task {
        sqlx::query("DELETE FROM schedule_task_items WHERE schedule_task_id=?")
            .bind(&id)
            .execute(&mut *tx)
            .await
            .map_err(database)?;
        sqlx::query("DELETE FROM schedule_tasks WHERE id=? AND user_id=?")
            .bind(&id)
            .bind(current_user_id())
            .execute(&mut *tx)
            .await
            .map_err(database)?;
        let remaining: Vec<String> = sqlx::query_scalar(
            "SELECT id FROM schedule_tasks WHERE schedule_id=? ORDER BY position",
        )
        .bind(&schedule)
        .fetch_all(&mut *tx)
        .await
        .map_err(database)?;
        for (position, task_id) in remaining.iter().enumerate() {
            sqlx::query("UPDATE schedule_tasks SET position=? WHERE id=?")
                .bind(position as i64)
                .bind(task_id)
                .execute(&mut *tx)
                .await
                .map_err(database)?;
        }
        if !cancelled {
            execution::refresh_schedule(&mut tx, &schedule).await?;
        }
    } else {
        for sql in [
            "DELETE FROM push_deliveries WHERE schedule_id=?",
            "DELETE FROM schedule_task_items WHERE schedule_task_id IN (SELECT id FROM schedule_tasks WHERE schedule_id=?)",
            "DELETE FROM schedule_tasks WHERE schedule_id=?",
            "DELETE FROM schedule_entity_snapshot WHERE schedule_id=?",
            "DELETE FROM schedules WHERE id=?",
        ] {
            sqlx::query(sql)
                .bind(&id)
                .execute(&mut *tx)
                .await
                .map_err(database)?;
        }
    }
    let result = if task {
        Some(schedules::in_transaction(&mut tx, &schedule).await?)
    } else {
        None
    };
    tx.commit().await.map_err(database)?;
    if settings::cleanup_reset_photos(pool, root).await.is_err() {
        tracing::warn!("Deleted schedule data; photo cleanup deferred until startup");
    }
    Ok(result)
}
