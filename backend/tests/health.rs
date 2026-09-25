use axum::{
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use preset_execution_api::{app, db};
use serde_json::{Value, json};
use tower::ServiceExt;

#[tokio::test]
async fn health_checks_real_database_and_returns_contract() {
    let directory = tempfile::tempdir().unwrap();
    let pool = db::connect(&directory.path().join("database/app.sqlite3"))
        .await
        .unwrap();
    let response = app(pool.clone())
        .oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .uri("/api/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()["cache-control"], "no-store");
    let body = to_bytes(response.into_body(), 4096).await.unwrap();
    assert_eq!(
        serde_json::from_slice::<Value>(&body).unwrap(),
        json!({"status": "ok"})
    );
    pool.close().await;
}

#[tokio::test]
async fn closed_database_is_unavailable_without_internal_details() {
    let directory = tempfile::tempdir().unwrap();
    let pool = db::connect(&directory.path().join("app.sqlite3"))
        .await
        .unwrap();
    pool.close().await;
    let response = app(pool)
        .oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .uri("/api/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    let body = to_bytes(response.into_body(), 4096).await.unwrap();
    assert_eq!(
        serde_json::from_slice::<Value>(&body).unwrap(),
        json!({
            "error": { "code": "DATABASE_UNAVAILABLE", "message": "The service is temporarily unavailable" }
        })
    );
}

#[tokio::test]
async fn migrations_are_persistent_and_safe_to_run_again() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("app.sqlite3");
    let pool = db::connect(&path).await.unwrap();
    let enabled: i32 = sqlx::query_scalar("PRAGMA foreign_keys")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(enabled, 1);
    let mode: String = sqlx::query_scalar("PRAGMA journal_mode")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(mode, "wal");
    pool.close().await;
    let pool = db::connect(&path).await.unwrap();
    let value: String =
        sqlx::query_scalar("SELECT value FROM app_metadata WHERE name = 'schema_generation'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(value, "1");
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM _sqlx_migrations WHERE success = 1")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, sqlx::migrate!("./migrations").iter().count() as i64);
    pool.close().await;
}

#[tokio::test]
async fn missing_routes_and_wrong_methods_use_error_envelope() {
    let directory = tempfile::tempdir().unwrap();
    let pool = db::connect(&directory.path().join("app.sqlite3"))
        .await
        .unwrap();
    for (method, path, expected_status, expected_code) in [
        ("GET", "/api/unknown", StatusCode::NOT_FOUND, "NOT_FOUND"),
        (
            "POST",
            "/api/health",
            StatusCode::METHOD_NOT_ALLOWED,
            "METHOD_NOT_ALLOWED",
        ),
    ] {
        let response = app(pool.clone())
            .oneshot(
                Request::builder()
                    .header("host", "localhost:3000")
                    .method(method)
                    .uri(path)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), expected_status);
        let body = to_bytes(response.into_body(), 4096).await.unwrap();
        let parsed: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(parsed["error"]["code"], expected_code);
    }
    pool.close().await;
}
