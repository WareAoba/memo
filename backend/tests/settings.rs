use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use preset_execution_api::{app_with_photo_dir, db};
use serde_json::{Value, json};
use sqlx::SqlitePool;
use tower::ServiceExt;
const OWNER: &str = "00000000-0000-4000-8000-000000000001";
const OTHER: &str = "00000000-0000-4000-8000-000000000002";
async fn request(
    pool: &SqlitePool,
    root: &std::path::Path,
    method: &str,
    path: &str,
    body: Value,
) -> (u16, Value) {
    let response = app_with_photo_dir(pool.clone(), root.into())
        .oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .method(method)
                .uri(path)
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status().as_u16();
    let bytes = to_bytes(response.into_body(), 1_000_000).await.unwrap();
    (
        status,
        if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes).unwrap()
        },
    )
}
#[tokio::test]
async fn settings_persist_validate_merge_and_preserve_owner_and_existing_zone() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("db");
    let pool = db::connect(&path).await.unwrap();
    sqlx::query("INSERT INTO users(id,display_name,time_zone) VALUES(?,'other','UTC')")
        .bind(OTHER)
        .execute(&pool)
        .await
        .unwrap();
    let (_, initial) = request(
        &pool,
        dir.path(),
        "POST",
        "/api/settings/bootstrap",
        json!({"language":"ja","time_zone":"Asia/Tokyo"}),
    )
    .await;
    assert_eq!(initial["language"], "ja");
    assert_eq!(initial["clock_step"], 5);
    let (_, second) = request(
        &pool,
        dir.path(),
        "POST",
        "/api/settings/bootstrap",
        json!({"language":"en","time_zone":"UTC"}),
    )
    .await;
    assert_eq!(initial, second);
    let a = request(
        &pool,
        dir.path(),
        "PATCH",
        "/api/settings",
        json!({"theme":"dark","content_scale":125,"content_width":"compact","accent":"blue","motion":"none","clock_step":1,"push_enabled":false}),
    );
    let b = request(
        &pool,
        dir.path(),
        "PATCH",
        "/api/settings",
        json!({"time_zone":"Pacific/Honolulu","language":"en"}),
    );
    let (a, b) = tokio::join!(a, b);
    assert_eq!(a.0, 200);
    assert_eq!(b.0, 200);
    for bad in [
        json!({"theme":"bad"}),
        json!({"clock_step":0}),
        json!({"content_scale":300}),
        json!({"language":"fr"}),
        json!({"time_zone":"Invalid/Zone"}),
        json!({"push_enabled":"true"}),
        json!({"motion":null}),
        json!({"user_id":OTHER}),
        json!({"accent":"#fff"}),
        json!({}),
    ] {
        assert_eq!(
            request(&pool, dir.path(), "PATCH", "/api/settings", bad)
                .await
                .0,
            400
        );
    }
    pool.close().await;
    let pool = db::connect(&path).await.unwrap();
    let (_, saved) = request(&pool, dir.path(), "GET", "/api/settings", Value::Null).await;
    assert_eq!(saved["theme"], "dark");
    assert_eq!(saved["language"], "en");
    assert_eq!(saved["clock_step"], 1);
    assert_eq!(saved["time_zone"], "Pacific/Honolulu");
    assert_eq!(saved["push_enabled"], false);
    let other: String = sqlx::query_scalar("SELECT settings_json FROM users WHERE id=?")
        .bind(OTHER)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(other, "{}");
    pool.close().await;
}
async fn fixtures(pool: &SqlitePool, root: &std::path::Path) -> Value {
    let (_, w) = request(
        pool,
        root,
        "POST",
        "/api/entities",
        json!({"name":"Original work","tags":["shared"]}),
    )
    .await;
    let (_, t) = request(
        pool,
        root,
        "POST",
        "/api/task-presets",
        json!({"name":"Original task"}),
    )
    .await;
    let (status,s)=request(pool,root,"POST","/api/schedules",json!({"entity_id":w["id"],"task_preset_ids":[t["id"]],"scheduled_date":"2077-01-01","start_time":"09:00","end_time":"10:00","time_zone":"Asia/Tokyo"})).await;
    assert_eq!(status, 201, "{s}");
    s
}
#[tokio::test]
async fn independent_resets_preserve_snapshots_then_remove_schedule_graph_and_photos() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let original = fixtures(&pool, dir.path()).await;
    let uri = format!("/api/schedules/{}", original["id"].as_str().unwrap());
    sqlx::query("INSERT INTO users(id,display_name) VALUES(?,'Other')")
        .bind(OTHER)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO entities(id,user_id,name) VALUES('other-work',?,'Other work')")
        .bind(OTHER)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO task_presets(id,user_id,name) VALUES('other-task',?,'Other task')")
        .bind(OTHER)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        request(
            &pool,
            dir.path(),
            "POST",
            "/api/settings/reset",
            json!({"target":"works","confirmation":"wrong"})
        )
        .await
        .0,
        400
    );
    for target in ["works", "tasks"] {
        assert_eq!(
            request(
                &pool,
                dir.path(),
                "POST",
                "/api/settings/reset",
                json!({"target":target,"confirmation":target})
            )
            .await
            .0,
            204
        );
        let (status, saved) = request(&pool, dir.path(), "GET", &uri, Value::Null).await;
        assert_eq!(status, 200);
        assert_eq!(saved["entity_snapshot"], original["entity_snapshot"]);
        assert_eq!(
            saved["tasks"][0]["name_snapshot"],
            original["tasks"][0]["name_snapshot"]
        );
        assert_eq!(saved["time_zone"], "Asia/Tokyo");
    }
    assert_eq!(
        request(
            &pool,
            dir.path(),
            "PATCH",
            &uri,
            json!({"notes":"Still editable"})
        )
        .await
        .0,
        200
    );
    let id = uuid::Uuid::new_v4().to_string();
    let photo_dir = dir.path().join(OWNER);
    tokio::fs::create_dir_all(&photo_dir).await.unwrap();
    let photo = photo_dir.join(format!("{id}.png"));
    tokio::fs::write(&photo, b"test").await.unwrap();
    sqlx::query("INSERT INTO photos(id,user_id,schedule_id,filename,mime_type,size_bytes,state) VALUES(?,?,?,'test.png','image/png',4,'ready')").bind(&id).bind(OWNER).bind(original["id"].as_str().unwrap()).execute(&pool).await.unwrap();
    assert_eq!(
        request(
            &pool,
            dir.path(),
            "POST",
            "/api/settings/reset",
            json!({"target":"schedules","confirmation":"schedules"})
        )
        .await
        .0,
        204
    );
    assert!(!photo.exists());
    assert_eq!(
        request(&pool, dir.path(), "GET", &uri, Value::Null).await.0,
        404
    );
    for table in [
        "schedules",
        "schedule_tasks",
        "schedule_task_items",
        "schedule_entity_snapshot",
        "photos",
        "photo_deletions",
    ] {
        let count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 0, "{table}");
    }
    for table in ["entities", "task_presets"] {
        let count: i64 =
            sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table} WHERE user_id=?"))
                .bind(OTHER)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(count, 1);
    }
    assert!(
        sqlx::query("PRAGMA foreign_key_check")
            .fetch_all(&pool)
            .await
            .unwrap()
            .is_empty()
    );
    pool.close().await;
}
#[tokio::test]
async fn migration_preserves_populated_snapshot_graph_and_revision_triggers() {
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(
            SqliteConnectOptions::new()
                .in_memory(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    let mut files = std::fs::read_dir(concat!(env!("CARGO_MANIFEST_DIR"), "/migrations"))
        .unwrap()
        .map(|v| v.unwrap().path())
        .collect::<Vec<_>>();
    files.sort();
    for file in files {
        if file.file_name().unwrap().to_str().unwrap() < "202609250005_user_settings.sql" {
            sqlx::raw_sql(&std::fs::read_to_string(file).unwrap())
                .execute(&pool)
                .await
                .unwrap();
        }
    }
    // Current fixture APIs require color; remove it before replaying the older migration.
    sqlx::raw_sql(include_str!(
        "../migrations/202609250006_schedule_color.sql"
    ))
    .execute(&pool)
    .await
    .unwrap();
    let root = tempfile::tempdir().unwrap();
    let before = fixtures(&pool, root.path()).await;
    sqlx::query("ALTER TABLE schedules DROP COLUMN color")
        .execute(&pool)
        .await
        .unwrap();
    let mut tx = pool.begin().await.unwrap();
    sqlx::raw_sql(include_str!("../migrations/202609250005_user_settings.sql"))
        .execute(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    sqlx::raw_sql(include_str!(
        "../migrations/202609250006_schedule_color.sql"
    ))
    .execute(&pool)
    .await
    .unwrap();
    let uri = format!("/api/schedules/{}", before["id"].as_str().unwrap());
    assert_eq!(
        request(&pool, root.path(), "GET", &uri, Value::Null)
            .await
            .1,
        before
    );
    let revision: i64 =
        sqlx::query_scalar("SELECT revision FROM schedule_revisions WHERE user_id=?")
            .bind(OWNER)
            .fetch_one(&pool)
            .await
            .unwrap();
    request(&pool, root.path(), "PATCH", &uri, json!({"notes":"edited"})).await;
    let next: i64 = sqlx::query_scalar("SELECT revision FROM schedule_revisions WHERE user_id=?")
        .bind(OWNER)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(next > revision);
    assert!(
        sqlx::query("PRAGMA foreign_key_check")
            .fetch_all(&pool)
            .await
            .unwrap()
            .is_empty()
    );
    pool.close().await;
}

#[tokio::test]
async fn reset_failure_rolls_back_source_detachment_and_related_rows() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let before = fixtures(&pool, dir.path()).await;
    sqlx::query("CREATE TRIGGER reject_reset BEFORE DELETE ON entities BEGIN SELECT RAISE(ABORT,'test'); END").execute(&pool).await.unwrap();
    assert_eq!(
        request(
            &pool,
            dir.path(),
            "POST",
            "/api/settings/reset",
            json!({"target":"works","confirmation":"works"})
        )
        .await
        .0,
        503
    );
    let uri = format!("/api/schedules/{}", before["id"].as_str().unwrap());
    assert_eq!(
        request(&pool, dir.path(), "GET", &uri, Value::Null).await.1,
        before
    );
    assert_eq!(
        request(&pool, dir.path(), "GET", "/api/entities", Value::Null)
            .await
            .1["total"],
        1
    );
    assert_eq!(
        request(
            &pool,
            dir.path(),
            "PATCH",
            &uri,
            json!({"start_time":"09:01","end_time":"10:02"})
        )
        .await
        .0,
        200
    );
    pool.close().await;
}
