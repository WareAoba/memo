use super::{Result, database, invalid};
use crate::local_user::current_user_id;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{Row, SqliteConnection, SqlitePool};

#[derive(Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Settings {
    language: String,
    time_zone: String,
    theme: String,
    content_scale: i64,
    content_width: String,
    clock_step: i64,
    accent: String,
    push_enabled: bool,
    motion: String,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            language: "ko".into(),
            time_zone: "UTC".into(),
            theme: "system".into(),
            content_scale: 100,
            content_width: "full".into(),
            clock_step: 5,
            accent: "violet".into(),
            push_enabled: true,
            motion: "system".into(),
        }
    }
}
fn validate(v: &Settings) -> Result<()> {
    v.time_zone
        .parse::<chrono_tz::Tz>()
        .map_err(|_| invalid())?;
    if !["ko", "en", "ja"].contains(&v.language.as_str())
        || !["light", "dark", "system"].contains(&v.theme.as_str())
        || ![80, 90, 100, 110, 125].contains(&v.content_scale)
        || !["compact", "standard", "full"].contains(&v.content_width.as_str())
        || ![1, 5, 10, 15, 30, 60].contains(&v.clock_step)
        || !["violet", "blue", "green", "rose", "orange"].contains(&v.accent.as_str())
        || !["system", "full", "reduced", "none"].contains(&v.motion.as_str())
    {
        return Err(invalid());
    }
    Ok(())
}
async fn read(conn: &mut SqliteConnection) -> Result<Settings> {
    let row = sqlx::query(
        "SELECT settings_json,COALESCE(time_zone,'UTC') AS time_zone FROM users WHERE id=?",
    )
    .bind(current_user_id())
    .fetch_one(conn)
    .await
    .map_err(database)?;
    let mut value: Settings =
        serde_json::from_str(row.get("settings_json")).map_err(|_| invalid())?;
    value.time_zone = row.get("time_zone");
    Ok(value)
}
pub async fn get(pool: &SqlitePool) -> Result<Settings> {
    read(&mut *pool.acquire().await.map_err(database)?).await
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Bootstrap {
    language: String,
    time_zone: String,
}
pub async fn bootstrap(pool: &SqlitePool, input: Bootstrap) -> Result<Settings> {
    validate(&Settings {
        language: input.language.clone(),
        time_zone: input.time_zone.clone(),
        ..Settings::default()
    })?;
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    sqlx::query("UPDATE users SET time_zone=COALESCE(time_zone,?),settings_json=CASE WHEN settings_json='{}' THEN ? ELSE settings_json END WHERE id=?")
        .bind(input.time_zone).bind(json!({"language":input.language}).to_string()).bind(current_user_id()).execute(&mut *tx).await.map_err(database)?;
    let value = read(&mut tx).await?;
    tx.commit().await.map_err(database)?;
    Ok(value)
}
pub async fn patch(pool: &SqlitePool, patch: Value) -> Result<Settings> {
    let fields = patch.as_object().ok_or_else(invalid)?;
    if fields.is_empty() || fields.values().any(Value::is_null) {
        return Err(invalid());
    }
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    let mut merged = serde_json::to_value(read(&mut tx).await?).map_err(|_| invalid())?;
    merged
        .as_object_mut()
        .ok_or_else(invalid)?
        .extend(fields.clone());
    let value: Settings = serde_json::from_value(merged).map_err(|_| invalid())?;
    validate(&value)?;
    sqlx::query("UPDATE users SET time_zone=?,settings_json=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?")
        .bind(&value.time_zone).bind(serde_json::to_string(&value).map_err(|_| invalid())?).bind(current_user_id()).execute(&mut *tx).await.map_err(database)?;
    if !value.push_enabled {
        sqlx::query("UPDATE push_deliveries SET status='pending',attempts=MAX(0,attempts-1),lease_token=NULL,lease_until=NULL WHERE status='sending' AND subscription_id IN (SELECT id FROM push_subscriptions WHERE user_id=?)")
            .bind(current_user_id()).execute(&mut *tx).await.map_err(database)?;
    }
    tx.commit().await.map_err(database)?;
    Ok(value)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Reset {
    target: String,
    confirmation: String,
}
pub async fn reset(pool: &SqlitePool, root: &std::path::Path, input: Reset) -> Result<()> {
    if input.target != input.confirmation {
        return Err(invalid());
    }
    // All SQL is selected from constants; the client cannot provide identifiers or owner IDs.
    let statements: &[&str] = match input.target.as_str() {
        "schedules" => &[
            "UPDATE photos SET state='deleted' WHERE user_id=?",
            "DELETE FROM push_deliveries WHERE schedule_id IN (SELECT id FROM schedules WHERE user_id=?)",
        ],
        "works" => &[
            "UPDATE schedules SET entity_id=NULL WHERE user_id=?",
            "DELETE FROM work_task_presets WHERE user_id=?",
            "DELETE FROM entity_tags WHERE user_id=?",
            "DELETE FROM entities WHERE user_id=?",
            "DELETE FROM work_field_names WHERE user_id=?",
        ],
        "tasks" => &[
            "UPDATE schedule_tasks SET source_task_preset_id=NULL WHERE user_id=?",
            "DELETE FROM work_task_presets WHERE user_id=?",
            "DELETE FROM task_preset_tags WHERE user_id=?",
            "DELETE FROM task_preset_items WHERE task_preset_id IN (SELECT id FROM task_presets WHERE user_id=?)",
            "DELETE FROM task_presets WHERE user_id=?",
        ],
        _ => return Err(invalid()),
    };
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    for sql in statements {
        sqlx::query(sql)
            .bind(current_user_id())
            .execute(&mut *tx)
            .await
            .map_err(database)?;
    }
    if input.target == "schedules" {
        // Keep durable cleanup records without retaining schedule foreign keys.
        sqlx::query("INSERT INTO photo_deletions(user_id,id,mime_type) SELECT user_id,id,mime_type FROM photos WHERE user_id=?")
            .bind(current_user_id()).execute(&mut *tx).await.map_err(database)?;
        for sql in [
            "DELETE FROM photos WHERE user_id=?",
            "DELETE FROM schedule_task_items WHERE schedule_task_id IN (SELECT id FROM schedule_tasks WHERE user_id=?)",
            "DELETE FROM schedule_tasks WHERE user_id=?",
            "DELETE FROM schedule_entity_snapshot WHERE schedule_id IN (SELECT id FROM schedules WHERE user_id=?)",
            "DELETE FROM schedules WHERE user_id=?",
        ] {
            sqlx::query(sql)
                .bind(current_user_id())
                .execute(&mut *tx)
                .await
                .map_err(database)?;
        }
    }
    sqlx::query("DELETE FROM tags WHERE user_id=? AND NOT EXISTS(SELECT 1 FROM entity_tags WHERE tag_id=tags.id) AND NOT EXISTS(SELECT 1 FROM task_preset_tags WHERE tag_id=tags.id)")
        .bind(current_user_id()).execute(&mut *tx).await.map_err(database)?;
    tx.commit().await.map_err(database)?;
    if cleanup_reset_photos(pool, root).await.is_err() {
        tracing::warn!(
            event = "reset_photo_cleanup_deferred",
            "Reset committed; photo cleanup deferred until startup"
        );
    }
    Ok(())
}
pub async fn cleanup_reset_photos(pool: &SqlitePool, root: &std::path::Path) -> Result<()> {
    let rows = sqlx::query("SELECT user_id,id,mime_type FROM photo_deletions")
        .fetch_all(pool)
        .await
        .map_err(database)?;
    for row in rows {
        let owner = super::identifier(row.get("user_id"))?;
        let id = super::identifier(row.get("id"))?;
        let extension = match row.get::<&str, _>("mime_type") {
            "image/jpeg" => "jpg",
            "image/png" => "png",
            "image/webp" => "webp",
            _ => return Err(invalid()),
        };
        match tokio::fs::remove_file(root.join(owner).join(format!("{id}.{extension}"))).await {
            Ok(()) => (),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(_) => {
                tracing::warn!(
                    event = "reset_photo_cleanup_deferred",
                    "Photo cleanup will retry at startup"
                );
                continue;
            }
        }
        sqlx::query("DELETE FROM photo_deletions WHERE id=?")
            .bind(id)
            .execute(pool)
            .await
            .map_err(database)?;
    }
    Ok(())
}
