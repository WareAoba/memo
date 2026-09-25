use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use preset_execution_api::{app_with_auth, auth::AuthMode, db, security::RequestPolicy};
use serde_json::Value;
use tower::ServiceExt;

const OWNER: &str = "00000000-0000-4000-8000-000000000001";
const OTHER: &str = "00000000-0000-4000-8000-000000000002";

async fn request(pool: &sqlx::SqlitePool, mode: AuthMode, path: &str) -> (u16, Value) {
    let response = app_with_auth(
        pool.clone(),
        "unused".into(),
        None,
        RequestPolicy::default(),
        mode,
    )
    .oneshot(
        Request::builder()
            .uri(path)
            .header("host", "localhost:3000")
            .header("x-user-id", OTHER)
            .header("authorization", format!("Bearer {OTHER}"))
            .body(Body::empty())
            .unwrap(),
    )
    .await
    .unwrap();
    let status = response.status().as_u16();
    assert_eq!(response.headers()["cache-control"], "no-store");
    (
        status,
        serde_json::from_slice(&to_bytes(response.into_body(), 100_000).await.unwrap()).unwrap(),
    )
}

#[tokio::test]
async fn virtual_identity_is_server_owned_and_disabled_mode_fails_closed() {
    let directory = tempfile::tempdir().unwrap();
    let pool = db::connect(&directory.path().join("test.sqlite3"))
        .await
        .unwrap();
    let (status, value) = request(&pool, AuthMode::Virtual, "/api/auth/me").await;
    assert_eq!(status, 200);
    assert_eq!(value["user"]["id"], OWNER);
    assert_eq!(value["mode"], "virtual");
    for path in [
        "/api/auth/me",
        "/api/entities",
        "/api/settings",
        "/api/schedules",
        "/api/photos",
        "/api/push/config",
    ] {
        let (status, value) = request(&pool, AuthMode::Disabled, path).await;
        assert_eq!(status, 401, "{path}");
        assert_eq!(value["error"]["code"], "UNAUTHORIZED");
    }
    assert_eq!(
        request(&pool, AuthMode::Disabled, "/api/health").await.0,
        200
    );
    sqlx::query("DELETE FROM auth_identities")
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        request(&pool, AuthMode::Virtual, "/api/entities").await.0,
        401
    );
    assert!(AuthMode::parse("google").is_err());
    pool.close().await;
}

#[tokio::test]
async fn migrated_owner_preserves_data_and_request_identity_can_change_without_service_changes() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("test.sqlite3");
    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .connect_with(
            sqlx::sqlite::SqliteConnectOptions::new()
                .filename(&path)
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    let mut historical = sqlx::migrate!("./migrations");
    historical.migrations = std::borrow::Cow::Owned(
        historical
            .iter()
            .filter(|m| m.version < 202609260002)
            .cloned()
            .collect(),
    );
    historical.run(&pool).await.unwrap();
    sqlx::query("INSERT INTO entities(id,user_id,name) VALUES('legacy',?,'Legacy work')")
        .bind(OWNER)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO users(id,display_name) VALUES(?,'Other')")
        .bind(OTHER)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO entities(id,user_id,name) VALUES('other',?,'Other work')")
        .bind(OTHER)
        .execute(&pool)
        .await
        .unwrap();
    pool.close().await;
    let pool = db::connect(&path).await.unwrap();
    let (_, value) = request(&pool, AuthMode::Virtual, "/api/entities").await;
    assert_eq!(value["total"], 1);
    assert_eq!(value["items"][0]["id"], "legacy");
    // Change only the trusted identity mapping; every domain query follows that account.
    sqlx::query("UPDATE auth_identities SET user_id=?")
        .bind(OTHER)
        .execute(&pool)
        .await
        .unwrap();
    let (_, value) = request(&pool, AuthMode::Virtual, "/api/entities").await;
    assert_eq!(value["total"], 1);
    assert_eq!(value["items"][0]["id"], "other");
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT user_id FROM entities WHERE id='legacy'")
            .fetch_one(&pool)
            .await
            .unwrap(),
        OWNER
    );
    pool.close().await;
    let pool = db::connect(&path).await.unwrap();
    assert_eq!(
        request(&pool, AuthMode::Virtual, "/api/auth/me").await.1["user"]["id"],
        OTHER
    );
    pool.close().await;
}
