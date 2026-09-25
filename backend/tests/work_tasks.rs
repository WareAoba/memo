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
async fn order_archive_validation_rollback_and_persistence() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("app.sqlite3");
    let pool = db::connect(&path).await.unwrap();
    let work = create(&pool, "entities", "work").await;
    let a = create(&pool, "task-presets", "A").await;
    let b = create(&pool, "task-presets", "B").await;
    let uri = format!("/api/entities/{work}/task-presets");
    assert_eq!(
        request(&pool, "GET", &uri, Value::Null).await.1,
        json!({"items":[]})
    );
    assert_eq!(
        request(&pool, "PUT", &uri, json!({"task_preset_ids":[a,b]}))
            .await
            .0,
        200
    );
    let reordered = request(&pool, "PUT", &uri, json!({"task_preset_ids":[b,a]})).await;
    assert_eq!(reordered.1["items"][0]["id"], b);
    assert_eq!(reordered.1["items"][1]["position"], 1);
    for body in [
        json!({"task_preset_ids":[a,a]}),
        json!({"task_preset_ids":["bad"]}),
        json!({"task_preset_ids":[],"user_id":"x"}),
        json!({}),
        json!({"task_preset_ids":vec![a.clone();101]}),
    ] {
        assert_eq!(request(&pool, "PUT", &uri, body).await.0, 400);
        assert_eq!(
            request(&pool, "GET", &uri, Value::Null).await.1,
            reordered.1
        );
    }
    sqlx::query("CREATE TRIGGER reject_link BEFORE INSERT ON work_task_presets BEGIN SELECT RAISE(ABORT,'test'); END").execute(&pool).await.unwrap();
    assert_eq!(
        request(&pool, "PUT", &uri, json!({"task_preset_ids":[a]}))
            .await
            .0,
        503
    );
    assert_eq!(
        request(&pool, "GET", &uri, Value::Null).await.1,
        reordered.1
    );
    sqlx::query("DROP TRIGGER reject_link")
        .execute(&pool)
        .await
        .unwrap();
    request(
        &pool,
        "DELETE",
        &format!("/api/task-presets/{a}"),
        Value::Null,
    )
    .await;
    let kept = request(&pool, "PUT", &uri, json!({"task_preset_ids":[a,b]})).await;
    assert_eq!(kept.0, 200);
    assert_eq!(kept.1["items"][0]["archived"], true);
    pool.close().await;
    let pool = db::connect(&path).await.unwrap();
    assert_eq!(request(&pool, "GET", &uri, Value::Null).await.1, kept.1);
    assert_eq!(
        request(&pool, "PUT", &uri, json!({"task_preset_ids":[b]}))
            .await
            .0,
        200
    );
    assert_eq!(
        request(&pool, "PUT", &uri, json!({"task_preset_ids":[b,a]}))
            .await
            .0,
        400
    );
    assert_eq!(
        request(&pool, "PUT", &uri, json!({"task_preset_ids":[]}))
            .await
            .1,
        json!({"items":[]})
    );
    pool.close().await;
}
#[tokio::test]
async fn ownership_is_enforced_by_api_and_database() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    let work = create(&pool, "entities", "work").await;
    let task = create(&pool, "task-presets", "task").await;
    let other = "00000000-0000-4000-8000-000000000002";
    sqlx::query("INSERT INTO users(id,display_name) VALUES(?,'other')")
        .bind(other)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE task_presets SET user_id=? WHERE id=?")
        .bind(other)
        .bind(&task)
        .execute(&pool)
        .await
        .unwrap();
    let uri = format!("/api/entities/{work}/task-presets");
    assert_eq!(
        request(&pool, "PUT", &uri, json!({"task_preset_ids":[task]}))
            .await
            .0,
        404
    );
    assert!(sqlx::query("INSERT INTO work_task_presets(entity_id,task_preset_id,user_id,position) VALUES(?,?,?,0)").bind(&work).bind(&task).bind(other).execute(&pool).await.is_err());
    sqlx::query("UPDATE entities SET user_id=? WHERE id=?")
        .bind(other)
        .bind(&work)
        .execute(&pool)
        .await
        .unwrap();
    for method in ["GET", "PUT"] {
        assert_eq!(
            request(&pool, method, &uri, json!({"task_preset_ids":[]}))
                .await
                .0,
            404
        );
        assert_eq!(
            request(
                &pool,
                method,
                "/api/entities/bad/task-presets",
                json!({"task_preset_ids":[]})
            )
            .await
            .0,
            400
        );
    }
    pool.close().await;
}
