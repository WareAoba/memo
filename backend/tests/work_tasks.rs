use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use preset_execution_api::{app, db};
use serde_json::{Value, json};
use sqlx::SqlitePool;
use tower::ServiceExt;
async fn request(pool: &SqlitePool, method: &str, path: &str, body: Value) -> (u16, Value) {
    let response = app(pool.clone())
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
async fn create(pool: &SqlitePool, kind: &str, name: &str) -> String {
    let (status, value) =
        request(pool, "POST", &format!("/api/{kind}"), json!({"name":name})).await;
    assert_eq!(status, 201);
    value["id"].as_str().unwrap().to_owned()
}
#[tokio::test]
async fn default_task_routes_are_removed_and_work_selection_creates_no_tasks() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    let work = create(&pool, "entities", "work").await;
    let task = create(&pool, "task-presets", "task").await;
    let uri = format!("/api/entities/{work}/task-presets");
    for method in ["GET", "PUT"] {
        assert_eq!(
            request(&pool, method, &uri, json!({"task_preset_ids":[task]}))
                .await
                .0,
            404
        );
    }
    // A historical link cannot add tasks to new schedules.
    sqlx::query("INSERT INTO work_task_presets(entity_id,task_preset_id,user_id,track_id,position) SELECT id,?,user_id,track_id,0 FROM entities WHERE id=?")
        .bind(&task).bind(&work).execute(&pool).await.unwrap();
    let (status, schedule) = request(
        &pool,
        "POST",
        "/api/schedules",
        json!({
            "entity_id": work, "task_preset_ids": [], "scheduled_date":"2026-09-27",
            "start_time":"09:00", "end_time":"10:00", "time_zone":"Asia/Tokyo"
        }),
    )
    .await;
    assert_eq!(status, 201, "{schedule}");
    assert_eq!(schedule["tasks"], json!([]));
}

#[tokio::test]
async fn retired_archive_migration_restores_definitions_without_touching_snapshots() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    let work = create(&pool, "entities", "work").await;
    let task = create(&pool, "task-presets", "task").await;
    let (_, schedule) = request(
        &pool,
        "POST",
        "/api/schedules",
        json!({
            "entity_id": work, "task_preset_ids": [task], "scheduled_date":"2026-09-27",
            "start_time":"09:00", "end_time":"10:00", "time_zone":"Asia/Tokyo"
        }),
    )
    .await;
    sqlx::query("UPDATE entities SET archived=1")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE task_presets SET archived=1")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::raw_sql(include_str!(
        "../migrations/202609270003_remove_preset_archiving.sql"
    ))
    .execute(&pool)
    .await
    .unwrap();
    for kind in ["entities", "task-presets"] {
        let (_, page) = request(&pool, "GET", &format!("/api/{kind}"), Value::Null).await;
        assert_eq!(page["total"], 1);
        assert_eq!(page["items"][0]["archived"], false);
    }
    let (_, after) = request(
        &pool,
        "GET",
        &format!("/api/schedules/{}", schedule["id"].as_str().unwrap()),
        Value::Null,
    )
    .await;
    assert_eq!(after, schedule);
}
