use super::{Result, database, identifier, invalid};
use crate::{errors::ApiError, local_user::current_user_id};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqliteConnection, SqlitePool};
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub const MAX_SIZE: usize = 10 * 1024 * 1024;
const MAX_STORAGE: i64 = 1024 * 1024 * 1024;

pub async fn preflight(pool: &SqlitePool, query: &Target, mime: &str) -> Result<()> {
    if !matches!(mime, "image/jpeg" | "image/png" | "image/webp") {
        return Err(invalid());
    }
    let filename = query.filename.as_deref().ok_or_else(invalid)?.trim();
    if filename.is_empty()
        || filename.chars().count() > 200
        || filename
            .chars()
            .any(|c| c.is_control() || c == '/' || c == '\\')
    {
        return Err(invalid());
    }
    let (schedule, task) = query.ids()?;
    let mut conn = pool.acquire().await.map_err(database)?;
    target(&mut conn, &schedule, &task, true).await
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Target {
    pub target_type: String,
    pub target_id: String,
    pub filename: Option<String>,
}
impl Target {
    fn ids(&self) -> Result<(Option<String>, Option<String>)> {
        let id = identifier(&self.target_id)?;
        match self.target_type.as_str() {
            "schedule" => Ok((Some(id), None)),
            "task" => Ok((None, Some(id))),
            _ => Err(invalid()),
        }
    }
}
#[derive(Serialize, FromRow)]
pub struct Photo {
    pub id: String,
    #[serde(skip)]
    user_id: String,
    pub schedule_id: Option<String>,
    pub schedule_task_id: Option<String>,
    pub filename: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub created_at: String,
    pub updated_at: String,
}
impl Photo {
    pub fn path(&self, root: &Path) -> Result<PathBuf> {
        let extension = match self.mime_type.as_str() {
            "image/jpeg" => "jpg",
            "image/png" => "png",
            "image/webp" => "webp",
            _ => return Err(invalid()),
        };
        Ok(root.join(identifier(&self.user_id)?).join(format!(
            "{}.{}",
            identifier(&self.id)?,
            extension
        )))
    }
}
async fn target(
    conn: &mut SqliteConnection,
    schedule: &Option<String>,
    task: &Option<String>,
    writable: bool,
) -> Result<()> {
    let row: Option<String> = sqlx::query_scalar("SELECT status FROM schedules WHERE user_id=? AND (id=? OR id=(SELECT schedule_id FROM schedule_tasks WHERE id=? AND user_id=?))")
        .bind(current_user_id()).bind(schedule).bind(task).bind(current_user_id()).fetch_optional(conn).await.map_err(database)?;
    let status = row.ok_or(ApiError::NotFound)?;
    if writable && status == "cancelled" {
        return Err(ApiError::ExecutionLocked);
    }
    Ok(())
}
fn validate(mime: &str, bytes: &[u8]) -> Result<()> {
    use image::{ImageFormat, ImageReader, Limits};
    use std::io::Cursor;
    if bytes.is_empty() || bytes.len() > MAX_SIZE {
        return Err(invalid());
    }
    let format = match mime {
        "image/jpeg" => ImageFormat::Jpeg,
        "image/png" => ImageFormat::Png,
        "image/webp" => ImageFormat::WebP,
        _ => return Err(invalid()),
    };
    if image::guess_format(bytes).map_err(|_| invalid())? != format {
        return Err(invalid());
    }
    let reader = || {
        let mut reader = ImageReader::with_format(Cursor::new(bytes), format);
        let mut limits = Limits::default();
        limits.max_image_width = Some(8192);
        limits.max_image_height = Some(8192);
        limits.max_alloc = Some(256 * 1024 * 1024);
        reader.limits(limits);
        reader
    };
    let (width, height) = reader().into_dimensions().map_err(|_| invalid())?;
    if width == 0
        || height == 0
        || width > 8192
        || height > 8192
        || u64::from(width) * u64::from(height) > 40_000_000
    {
        return Err(invalid());
    }
    reader().decode().map_err(|_| invalid())?;
    Ok(())
}

pub async fn list(pool: &SqlitePool, query: Target) -> Result<Vec<Photo>> {
    let (schedule, task) = query.ids()?;
    let mut conn = pool.acquire().await.map_err(database)?;
    target(&mut conn, &schedule, &task, false).await?;
    sqlx::query_as("SELECT * FROM photos WHERE user_id=? AND (schedule_id=? OR schedule_task_id=?) AND state='ready' ORDER BY created_at,id LIMIT 100")
        .bind(current_user_id()).bind(schedule).bind(task).fetch_all(&mut *conn).await.map_err(database)
}
pub async fn get(pool: &SqlitePool, id: &str) -> Result<Photo> {
    sqlx::query_as("SELECT * FROM photos WHERE id=? AND user_id=? AND state='ready'")
        .bind(identifier(id)?)
        .bind(current_user_id())
        .fetch_optional(pool)
        .await
        .map_err(database)?
        .ok_or(ApiError::NotFound)
}
async fn remove_file(path: &Path) -> Result<()> {
    match tokio::fs::remove_file(path).await {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err(ApiError::DatabaseUnavailable),
    }
}
async fn purge(pool: &SqlitePool, root: &Path, photo: &Photo) -> Result<()> {
    remove_file(&photo.path(root)?).await?;
    sqlx::query("DELETE FROM photos WHERE id=? AND state!='ready'")
        .bind(&photo.id)
        .execute(pool)
        .await
        .map_err(database)?;
    Ok(())
}
// Called once, before serving requests. Durable pending/deleted records make crash recovery possible.
pub async fn cleanup(pool: &SqlitePool, root: &Path) -> Result<()> {
    super::settings::cleanup_reset_photos(pool, root).await?;
    let photos: Vec<Photo> = sqlx::query_as("SELECT * FROM photos WHERE state!='ready'")
        .fetch_all(pool)
        .await
        .map_err(database)?;
    for photo in photos {
        if purge(pool, root, &photo).await.is_err() {
            tracing::warn!(event="photo_cleanup_deferred", photo_id=%photo.id, "Photo cleanup will be retried at next startup");
        }
    }
    Ok(())
}
pub async fn upload(
    pool: &SqlitePool,
    root: &Path,
    query: Target,
    mime: &str,
    bytes: &[u8],
    admission: std::sync::Arc<tokio::sync::OwnedSemaphorePermit>,
) -> Result<Photo> {
    static DECODERS: std::sync::LazyLock<std::sync::Arc<tokio::sync::Semaphore>> =
        std::sync::LazyLock::new(|| std::sync::Arc::new(tokio::sync::Semaphore::new(2)));
    let permit = DECODERS
        .clone()
        .acquire_owned()
        .await
        .map_err(|_| ApiError::DatabaseUnavailable)?;
    let owned_bytes = bytes.to_vec();
    let owned_mime = mime.to_owned();
    let decoding_admission = admission.clone();
    tokio::task::spawn_blocking(move || {
        // A cancelled HTTP request cannot free admission while its decoder still runs.
        let _admission = decoding_admission;
        let _permit = permit;
        validate(&owned_mime, &owned_bytes)
    })
    .await
    .map_err(|_| ApiError::DatabaseUnavailable)??;
    let filename = query.filename.as_deref().ok_or_else(invalid)?.trim();
    if filename.is_empty()
        || filename.chars().count() > 200
        || filename
            .chars()
            .any(|c| c.is_control() || c == '/' || c == '\\')
    {
        return Err(invalid());
    }
    let (schedule, task) = query.ids()?;
    let id = Uuid::new_v4().to_string();
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    target(&mut tx, &schedule, &task, true).await?;
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM photos WHERE user_id=? AND (schedule_id=? OR schedule_task_id=?) AND state!='deleted'").bind(current_user_id()).bind(&schedule).bind(&task).fetch_one(&mut *tx).await.map_err(database)?;
    if count >= 100 {
        return Err(invalid());
    }
    // Include pending and logically deleted files until physical cleanup succeeds.
    // Reset tombstones have no byte count: reserve the per-file maximum until cleanup.
    let used: i64 = sqlx::query_scalar("SELECT (SELECT COALESCE(SUM(size_bytes),0) FROM photos WHERE user_id=?) + (SELECT COUNT(*) * 10485760 FROM photo_deletions WHERE user_id=?)")
        .bind(current_user_id()).bind(current_user_id()).fetch_one(&mut *tx).await.map_err(database)?;
    if used.saturating_add(bytes.len() as i64) > MAX_STORAGE {
        return Err(ApiError::PhotoStorageFull);
    }
    sqlx::query("INSERT INTO photos(id,user_id,schedule_id,schedule_task_id,filename,mime_type,size_bytes,state) VALUES(?,?,?,?,?,?,?,'pending')")
        .bind(&id).bind(current_user_id()).bind(&schedule).bind(&task).bind(filename).bind(mime).bind(bytes.len() as i64).execute(&mut *tx).await.map_err(database)?;
    let photo: Photo = sqlx::query_as("SELECT * FROM photos WHERE id=?")
        .bind(&id)
        .fetch_one(&mut *tx)
        .await
        .map_err(database)?;
    tx.commit().await.map_err(database)?;
    let path = photo.path(root)?;
    let save = async {
        let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
        target(&mut tx, &schedule, &task, true).await?;
        // Serialize file creation against bulk reset so cleanup cannot run before a late write.
        tokio::fs::create_dir_all(path.parent().ok_or_else(invalid)?).await.map_err(|_| ApiError::DatabaseUnavailable)?;
        tokio::fs::write(&path, bytes).await.map_err(|_| ApiError::DatabaseUnavailable)?;
        sqlx::query("UPDATE photos SET state='ready',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND state='pending'").bind(&id).execute(&mut *tx).await.map_err(database)?;
        tx.commit().await.map_err(database)?;
        Ok::<(),ApiError>(())
    }.await;
    if let Err(error) = save {
        // Never remove a ready file if a commit outcome was uncertain.
        if let Ok(Some(pending)) =
            sqlx::query_as::<_, Photo>("SELECT * FROM photos WHERE id=? AND state='pending'")
                .bind(&id)
                .fetch_optional(pool)
                .await
        {
            let _ = purge(pool, root, &pending).await;
        }
        return Err(error);
    }
    get(pool, &id).await
}
pub async fn delete(pool: &SqlitePool, root: &Path, id: &str) -> Result<()> {
    let id = identifier(id)?;
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(database)?;
    let photo: Photo = sqlx::query_as(
        "SELECT * FROM photos WHERE id=? AND user_id=? AND state IN ('ready','deleted')",
    )
    .bind(&id)
    .bind(current_user_id())
    .fetch_optional(&mut *tx)
    .await
    .map_err(database)?
    .ok_or(ApiError::NotFound)?;
    target(&mut tx, &photo.schedule_id, &photo.schedule_task_id, true).await?;
    sqlx::query("UPDATE photos SET state='deleted' WHERE id=?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(database)?;
    tx.commit().await.map_err(database)?;
    if purge(pool, root, &photo).await.is_err() {
        tracing::warn!(event="photo_delete_cleanup_deferred", photo_id=%photo.id, "Logical deletion committed; file cleanup deferred");
    }
    Ok(())
}
