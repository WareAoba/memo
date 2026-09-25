use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use preset_execution_api::{app_with_photo_dir, cleanup_photos, db};
use serde_json::{Value, json};
use sqlx::SqlitePool;
use std::path::Path;
use tower::ServiceExt;
const OWNER: &str = "00000000-0000-4000-8000-000000000001";
const OTHER: &str = "00000000-0000-4000-8000-000000000002";
fn png() -> Vec<u8> {
    let mut bytes = std::io::Cursor::new(Vec::new());
    image::DynamicImage::new_rgb8(1, 1)
        .write_to(&mut bytes, image::ImageFormat::Png)
        .unwrap();
    bytes.into_inner()
}

#[tokio::test]
async fn upload_admission_is_bounded_before_body_polling_and_released_on_cancel() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let root = dir.path().join("photos");
    let schedule = fixture(&pool, &root).await;
    let path = uri("schedule", schedule["id"].as_str().unwrap());
    let app = app_with_photo_dir(pool.clone(), root);
    let polled = std::sync::Arc::new(tokio::sync::Semaphore::new(0));
    let mut requests = Vec::new();
    for _ in 0..4 {
        let polled = polled.clone();
        let mut first = true;
        let body = Body::from_stream(futures_util::stream::poll_fn(move |_| {
            if first {
                polled.add_permits(1);
                first = false;
            }
            std::task::Poll::<Option<Result<axum::body::Bytes, std::io::Error>>>::Pending
        }));
        requests.push(tokio::spawn(
            app.clone().oneshot(
                Request::builder()
                    .header("host", "localhost:3000")
                    .header("content-type", "image/png")
                    .method("POST")
                    .uri(&path)
                    .body(body)
                    .unwrap(),
            ),
        ));
    }
    tokio::time::timeout(std::time::Duration::from_secs(5), polled.acquire_many(4))
        .await
        .unwrap()
        .unwrap()
        .forget();
    let body = Body::from_stream(futures_util::stream::poll_fn(|_| {
        panic!("Rejected upload body must never be polled");
        #[allow(unreachable_code)]
        std::task::Poll::<Option<Result<axum::body::Bytes, std::io::Error>>>::Pending
    }));
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .header("content-type", "image/png")
                .method("POST")
                .uri(&path)
                .body(body)
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 429);
    for request in requests {
        request.abort();
        let _ = request.await;
    }
    let response = app
        .oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .header("content-type", "image/png")
                .method("POST")
                .uri(path)
                .body(Body::from(png()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 201);
    pool.close().await;
}

#[tokio::test]
async fn invalid_target_is_rejected_before_reading_body() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let body = Body::from_stream(futures_util::stream::poll_fn(|_| {
        panic!("Missing target must be rejected before body polling");
        #[allow(unreachable_code)]
        std::task::Poll::<Option<Result<axum::body::Bytes, std::io::Error>>>::Pending
    }));
    let response = app_with_photo_dir(pool.clone(), dir.path().join("photos"))
        .oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .header("content-type", "image/png")
                .method("POST")
                .uri(uri("schedule", "00000000-0000-4000-8000-000000000099"))
                .body(body)
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 404);
    pool.close().await;
}

#[tokio::test]
async fn stalled_upload_times_out_and_releases_admission() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let root = dir.path().join("photos");
    let schedule = fixture(&pool, &root).await;
    let path = uri("schedule", schedule["id"].as_str().unwrap());
    let app = app_with_photo_dir(pool.clone(), root);
    let polled = std::sync::Arc::new(tokio::sync::Notify::new());
    let signal = polled.clone();
    let body = Body::from_stream(futures_util::stream::poll_fn(move |_| {
        signal.notify_one();
        std::task::Poll::<Option<Result<axum::body::Bytes, std::io::Error>>>::Pending
    }));
    let task = tokio::spawn(
        app.clone().oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .header("content-type", "image/png")
                .method("POST")
                .uri(&path)
                .body(body)
                .unwrap(),
        ),
    );
    polled.notified().await;
    tokio::time::pause();
    tokio::time::advance(std::time::Duration::from_secs(31)).await;
    let response = task.await.unwrap().unwrap();
    assert_eq!(response.status(), 408);
    tokio::time::resume();
    let response = app
        .oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .header("content-type", "image/png")
                .method("POST")
                .uri(path)
                .body(Body::from(png()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 201);
    pool.close().await;
}

#[tokio::test]
async fn storage_quota_counts_pending_and_deleted_files_across_targets() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let root = dir.path().join("photos");
    let first = fixture(&pool, &root).await;
    let second = fixture(&pool, &root).await;
    for index in 0..103 {
        sqlx::query("INSERT INTO photos(id,user_id,schedule_id,filename,mime_type,size_bytes,state) VALUES(?,?,?,'fixture.png','image/png',10485760,?)")
            .bind(uuid::Uuid::new_v4().to_string()).bind(OWNER).bind(first["id"].as_str().unwrap())
            .bind(if index % 2 == 0 { "pending" } else { "deleted" }).execute(&pool).await.unwrap();
    }
    let (code, _) = raw(
        &pool,
        &root,
        "POST",
        &uri("schedule", second["id"].as_str().unwrap()),
        "image/png",
        png(),
    )
    .await;
    assert_eq!(code, 507);
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM photos WHERE schedule_id=?")
        .bind(second["id"].as_str().unwrap())
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);
    // Reset may remove photo rows before deferred disk cleanup; it must not free quota.
    sqlx::query(
        "INSERT INTO photo_deletions(id,user_id,mime_type) SELECT id,user_id,mime_type FROM photos",
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("DELETE FROM photos")
        .execute(&pool)
        .await
        .unwrap();
    let (code, _) = raw(
        &pool,
        &root,
        "POST",
        &uri("schedule", second["id"].as_str().unwrap()),
        "image/png",
        png(),
    )
    .await;
    assert_eq!(code, 507);
    // Cleanup of missing files releases reservations without touching other data.
    cleanup_photos(&pool, &root).await.unwrap();
    let (code, _) = raw(
        &pool,
        &root,
        "POST",
        &uri("schedule", second["id"].as_str().unwrap()),
        "image/png",
        png(),
    )
    .await;
    assert_eq!(code, 201);
    pool.close().await;
}

async fn raw(
    pool: &SqlitePool,
    root: &Path,
    method: &str,
    path: &str,
    mime: &str,
    body: Vec<u8>,
) -> (u16, Vec<u8>) {
    let response = app_with_photo_dir(pool.clone(), root.into())
        .oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .method(method)
                .uri(path)
                .header("content-type", mime)
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    let code = response.status().as_u16();
    if method == "GET" && path.starts_with("/api/photos/") && code == 200 {
        assert_eq!(response.headers()["x-content-type-options"], "nosniff");
        assert_eq!(response.headers()["cache-control"], "no-store");
    }
    (
        code,
        to_bytes(response.into_body(), 12 * 1024 * 1024)
            .await
            .unwrap()
            .to_vec(),
    )
}
async fn json_req(
    pool: &SqlitePool,
    root: &Path,
    method: &str,
    path: &str,
    body: Value,
) -> (u16, Value) {
    let (code, bytes) = raw(
        pool,
        root,
        method,
        path,
        "application/json",
        body.to_string().into_bytes(),
    )
    .await;
    (
        code,
        if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes).unwrap()
        },
    )
}
async fn fixture(pool: &SqlitePool, root: &Path) -> Value {
    let (_, work) = json_req(pool, root, "POST", "/api/entities", json!({"name":"Work"})).await;
    let (_, task) = json_req(
        pool,
        root,
        "POST",
        "/api/task-presets",
        json!({"name":"Task"}),
    )
    .await;
    let (code,s)=json_req(pool,root,"POST","/api/schedules",json!({"entity_id":work["id"],"task_preset_ids":[task["id"]],"scheduled_date":"2026-09-24","start_time":"09:00","end_time":"10:00","time_zone":"Asia/Tokyo"})).await;
    assert_eq!(code, 201);
    s
}
fn uri(kind: &str, id: &str) -> String {
    format!("/api/photos?target_type={kind}&target_id={id}&filename=photo.png")
}
async fn upload(pool: &SqlitePool, root: &Path, kind: &str, id: &str) -> Value {
    let (code, bytes) = raw(pool, root, "POST", &uri(kind, id), "image/png", png()).await;
    assert_eq!(code, 201);
    serde_json::from_slice(&bytes).unwrap()
}
#[tokio::test]
async fn optional_schedule_and_task_photos_persist_and_delete_without_changing_execution() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("db");
    let root = dir.path().join("photos");
    let pool = db::connect(&path).await.unwrap();
    let s = fixture(&pool, &root).await;
    let id = s["id"].as_str().unwrap();
    let task = s["tasks"][0]["id"].as_str().unwrap();
    let p = upload(&pool, &root, "schedule", id).await;
    let t = upload(&pool, &root, "task", task).await;
    assert_eq!(
        json_req(&pool, &root, "GET", &uri("schedule", id), Value::Null)
            .await
            .1
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        json_req(&pool, &root, "GET", &uri("task", task), Value::Null)
            .await
            .1[0]["id"],
        t["id"]
    );
    pool.close().await;
    let pool = db::connect(&path).await.unwrap();
    cleanup_photos(&pool, &root).await.unwrap();
    let photo_path = format!("/api/photos/{}", p["id"].as_str().unwrap());
    assert_eq!(
        raw(&pool, &root, "GET", &photo_path, "", vec![]).await,
        (200, png())
    );
    assert_eq!(
        json_req(&pool, &root, "DELETE", &photo_path, Value::Null)
            .await
            .0,
        204
    );
    assert_eq!(
        raw(&pool, &root, "GET", &photo_path, "", vec![]).await.0,
        404
    );
    assert!(
        !root
            .join(OWNER)
            .join(format!("{}.png", p["id"].as_str().unwrap()))
            .exists()
    );
    assert_eq!(
        json_req(
            &pool,
            &root,
            "GET",
            &format!("/api/schedules/{id}"),
            Value::Null
        )
        .await
        .1["tasks"],
        s["tasks"]
    );
}
#[tokio::test]
async fn rejects_nonphotos_spoofed_mime_paths_oversize_and_locked_targets() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let root = dir.path().join("photos");
    let s = fixture(&pool, &root).await;
    let id = s["id"].as_str().unwrap();
    let url = uri("schedule", id);
    for (mime, data) in [
        ("application/pdf", b"%PDF-1.7".to_vec()),
        ("image/svg+xml", b"<svg/>".to_vec()),
        ("image/jpeg", png()),
        ("image/png", b"<html>fake</html>".to_vec()),
        ("image/png", vec![]),
    ] {
        assert_eq!(raw(&pool, &root, "POST", &url, mime, data).await.0, 400);
    }
    assert_eq!(
        raw(
            &pool,
            &root,
            "POST",
            &url.replace("photo.png", "..%2Fescape.png"),
            "image/png",
            png()
        )
        .await
        .0,
        400
    );
    assert_eq!(
        raw(
            &pool,
            &root,
            "POST",
            &url,
            "image/png",
            vec![0; 10 * 1024 * 1024 + 1]
        )
        .await
        .0,
        413
    );
    let p = upload(&pool, &root, "schedule", id).await;
    assert_eq!(
        json_req(
            &pool,
            &root,
            "PATCH",
            &format!("/api/schedules/{id}/status"),
            json!({"status":"cancelled"})
        )
        .await
        .0,
        200
    );
    assert_eq!(
        raw(&pool, &root, "POST", &url, "image/png", png()).await.0,
        409
    );
    let photo_path = format!("/api/photos/{}", p["id"].as_str().unwrap());
    assert_eq!(
        raw(&pool, &root, "GET", &photo_path, "", vec![]).await.0,
        200
    );
    assert_eq!(
        json_req(&pool, &root, "DELETE", &photo_path, Value::Null)
            .await
            .0,
        409
    );
    json_req(
        &pool,
        &root,
        "PATCH",
        &format!("/api/schedules/{id}/status"),
        json!({"status":"planned"}),
    )
    .await;
    assert_eq!(
        raw(&pool, &root, "POST", &url, "image/png", png()).await.0,
        201
    );
}
#[tokio::test]
async fn ownership_is_enforced_for_target_photo_and_database_foreign_keys() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let root = dir.path().join("photos");
    let s = fixture(&pool, &root).await;
    let id = s["id"].as_str().unwrap();
    let p = upload(&pool, &root, "schedule", id).await;
    sqlx::query("INSERT INTO users(id,display_name) VALUES(?,'Other')")
        .bind(OTHER)
        .execute(&pool)
        .await
        .unwrap();
    let foreign = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO entities(id,user_id,name) VALUES(?,?,'Other')")
        .bind(&foreign)
        .bind(OTHER)
        .execute(&pool)
        .await
        .unwrap();
    let foreign_s = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO schedules(id,user_id,entity_id,title,scheduled_date,end_date,start_time,end_time,time_zone) VALUES(?,?,?,'','2026-09-24','2026-09-24','09:00','10:00','Asia/Tokyo')").bind(&foreign_s).bind(OTHER).bind(foreign).execute(&pool).await.unwrap();
    for method in ["GET", "POST"] {
        assert_eq!(
            raw(
                &pool,
                &root,
                method,
                &uri("schedule", &foreign_s),
                "image/png",
                png()
            )
            .await
            .0,
            404
        );
    }
    assert!(
        sqlx::query("UPDATE photos SET user_id=? WHERE id=?")
            .bind(OTHER)
            .bind(p["id"].as_str().unwrap())
            .execute(&pool)
            .await
            .is_err()
    );
    sqlx::query("UPDATE photos SET user_id=?,schedule_id=? WHERE id=?")
        .bind(OTHER)
        .bind(&foreign_s)
        .bind(p["id"].as_str().unwrap())
        .execute(&pool)
        .await
        .unwrap();
    for method in ["GET", "DELETE"] {
        assert_eq!(
            raw(
                &pool,
                &root,
                method,
                &format!("/api/photos/{}", p["id"].as_str().unwrap()),
                "",
                vec![]
            )
            .await
            .0,
            404
        );
    }
}
#[tokio::test]
async fn failed_storage_and_database_writes_are_cleaned_and_crash_records_recovered() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let root = dir.path().join("photos");
    let s = fixture(&pool, &root).await;
    let id = s["id"].as_str().unwrap();
    std::fs::write(&root, b"blocked directory").unwrap();
    assert_eq!(
        raw(
            &pool,
            &root,
            "POST",
            &uri("schedule", id),
            "image/png",
            png()
        )
        .await
        .0,
        503
    );
    std::fs::remove_file(&root).unwrap();
    cleanup_photos(&pool, &root).await.unwrap();
    sqlx::query("CREATE TRIGGER fail_ready BEFORE UPDATE OF state ON photos WHEN NEW.state='ready' BEGIN SELECT RAISE(ABORT,'test'); END").execute(&pool).await.unwrap();
    assert_eq!(
        raw(
            &pool,
            &root,
            "POST",
            &uri("schedule", id),
            "image/png",
            png()
        )
        .await
        .0,
        503
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM photos")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
    sqlx::query("DROP TRIGGER fail_ready")
        .execute(&pool)
        .await
        .unwrap();
    let p = upload(&pool, &root, "schedule", id).await;
    let t = upload(&pool, &root, "schedule", id).await;
    sqlx::query("UPDATE photos SET state='pending' WHERE id=?")
        .bind(p["id"].as_str().unwrap())
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE photos SET state='deleted' WHERE id=?")
        .bind(t["id"].as_str().unwrap())
        .execute(&pool)
        .await
        .unwrap();
    cleanup_photos(&pool, &root).await.unwrap();
    assert_eq!(std::fs::read_dir(root.join(OWNER)).unwrap().count(), 0);
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM photos")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
}

#[tokio::test]
async fn concurrent_uploads_respect_target_limit_and_failed_delete_is_recoverable() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let root = dir.path().join("photos");
    let s = fixture(&pool, &root).await;
    let id = s["id"].as_str().unwrap();
    let p = upload(&pool, &root, "schedule", id).await;
    for _ in 0..98 {
        sqlx::query("INSERT INTO photos(id,user_id,schedule_id,filename,mime_type,size_bytes,state) VALUES(?,?,?,'placeholder.png','image/png',1,'ready')")
            .bind(uuid::Uuid::new_v4().to_string()).bind(OWNER).bind(id).execute(&pool).await.unwrap();
    }
    let url = uri("schedule", id);
    let (a, b) = tokio::join!(
        raw(&pool, &root, "POST", &url, "image/png", png()),
        raw(&pool, &root, "POST", &url, "image/png", png())
    );
    let mut statuses = [a.0, b.0];
    statuses.sort();
    assert_eq!(statuses, [201, 400]);
    let file = root
        .join(OWNER)
        .join(format!("{}.png", p["id"].as_str().unwrap()));
    std::fs::remove_file(&file).unwrap();
    std::fs::create_dir(&file).unwrap();
    let url = format!("/api/photos/{}", p["id"].as_str().unwrap());
    assert_eq!(raw(&pool, &root, "DELETE", &url, "", vec![]).await.0, 204);
    assert_eq!(raw(&pool, &root, "GET", &url, "", vec![]).await.0, 404);
    std::fs::remove_dir(&file).unwrap();
    cleanup_photos(&pool, &root).await.unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM photos WHERE state='deleted'")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
}

#[tokio::test]
async fn corrupt_images_and_pixel_limits_are_rejected_but_all_supported_formats_decode() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let root = dir.path().join("photos");
    let s = fixture(&pool, &root).await;
    let url = uri("schedule", s["id"].as_str().unwrap());
    assert_eq!(
        raw(
            &pool,
            &root,
            "POST",
            &url,
            "image/jpeg",
            vec![255, 216, 255, 255, 217]
        )
        .await
        .0,
        400
    );
    let mut corrupt = png();
    corrupt.truncate(corrupt.len() / 2);
    assert_eq!(
        raw(&pool, &root, "POST", &url, "image/png", corrupt)
            .await
            .0,
        400
    );
    for (format, mime) in [
        (image::ImageFormat::Jpeg, "image/jpeg"),
        (image::ImageFormat::Png, "image/png"),
        (image::ImageFormat::WebP, "image/webp"),
    ] {
        let mut bytes = std::io::Cursor::new(Vec::new());
        image::DynamicImage::new_rgb8(3, 2)
            .write_to(&mut bytes, format)
            .unwrap();
        assert_eq!(
            raw(&pool, &root, "POST", &url, mime, bytes.into_inner())
                .await
                .0,
            201
        );
    }
    let mut bytes = std::io::Cursor::new(Vec::new());
    image::DynamicImage::new_rgb8(8193, 1)
        .write_to(&mut bytes, image::ImageFormat::Png)
        .unwrap();
    assert_eq!(
        raw(&pool, &root, "POST", &url, "image/png", bytes.into_inner())
            .await
            .0,
        400
    );
}

#[tokio::test]
async fn cleanup_skips_unremovable_files_preserves_retry_and_keeps_other_features_available() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let root = dir.path().join("photos");
    let s = fixture(&pool, &root).await;
    let id = s["id"].as_str().unwrap();
    let p = upload(&pool, &root, "schedule", id).await;
    let other = upload(&pool, &root, "schedule", id).await;
    let path = root
        .join(OWNER)
        .join(format!("{}.png", p["id"].as_str().unwrap()));
    std::fs::remove_file(&path).unwrap();
    std::fs::create_dir(&path).unwrap();
    assert_eq!(
        raw(
            &pool,
            &root,
            "DELETE",
            &format!("/api/photos/{}", p["id"].as_str().unwrap()),
            "",
            vec![]
        )
        .await
        .0,
        204
    );
    sqlx::query("UPDATE photos SET state='pending' WHERE id=?")
        .bind(other["id"].as_str().unwrap())
        .execute(&pool)
        .await
        .unwrap();
    cleanup_photos(&pool, &root).await.unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM photos WHERE state='deleted'")
            .fetch_one(&pool)
            .await
            .unwrap(),
        1
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM photos WHERE state='pending'")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
    assert_eq!(
        json_req(&pool, &root, "GET", "/api/health", Value::Null)
            .await
            .0,
        200
    );
    assert_eq!(
        json_req(
            &pool,
            &root,
            "GET",
            &format!("/api/schedules/{id}"),
            Value::Null
        )
        .await
        .0,
        200
    );
    std::fs::remove_dir(&path).unwrap();
    cleanup_photos(&pool, &root).await.unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM photos")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
}
