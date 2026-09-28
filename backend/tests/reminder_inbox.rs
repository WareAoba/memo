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
                .method(method)
                .uri(path)
                .header("host", "localhost:3000")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status().as_u16();
    let bytes = to_bytes(response.into_body(), 2_000_000).await.unwrap();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

#[tokio::test]
async fn retained_reminders_validate_after_start_and_keep_owner_and_status_boundaries() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("inbox.db")).await.unwrap();
    let (status, saved) = request(&pool, "POST", "/api/schedules", json!({
        "entity_id":{"name":"Inbox work"}, "task_preset_ids":[], "title":"Reminder",
        "scheduled_date":"2026-01-01", "start_time":"09:00", "end_time":"10:00",
        "time_zone":"Asia/Tokyo", "reminder_enabled":true, "reminder_value":15, "reminder_unit":"minutes"
    })).await;
    assert_eq!(status, 201, "{saved}");
    let id = saved["id"].as_str().unwrap();
    let url = format!("/api/reminders?include={id}");
    sqlx::query("UPDATE schedules SET reminder_at=unixepoch('now')-100,reminder_start_at=unixepoch('now')-10 WHERE id=?").bind(id).execute(&pool).await.unwrap();
    assert_eq!(
        request(&pool, "GET", "/api/reminders", Value::Null).await.1,
        json!([])
    );
    assert_eq!(
        request(&pool, "GET", &url, Value::Null).await.1[0]["id"],
        id
    );
    for state in ["completed", "cancelled"] {
        sqlx::query("UPDATE schedules SET status=? WHERE id=?")
            .bind(state)
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
        assert_eq!(request(&pool, "GET", &url, Value::Null).await.1, json!([]));
    }
    sqlx::query("UPDATE schedules SET status='planned',reminder_enabled=0 WHERE id=?")
        .bind(id)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(request(&pool, "GET", &url, Value::Null).await.1, json!([]));
    sqlx::query(
        "INSERT INTO users(id,display_name) VALUES('00000000-0000-4000-8000-000000000099','Other')",
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("UPDATE schedules SET reminder_enabled=1 WHERE id=?")
        .bind(id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE auth_identities SET user_id='00000000-0000-4000-8000-000000000099'")
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(request(&pool, "GET", &url, Value::Null).await.1, json!([]));
    assert_eq!(
        request(&pool, "GET", "/api/reminders?include=invalid", Value::Null)
            .await
            .0,
        400
    );
    let too_many = format!("/api/reminders?include={}", vec![id; 201].join(","));
    assert_eq!(request(&pool, "GET", &too_many, Value::Null).await.0, 400);
}
