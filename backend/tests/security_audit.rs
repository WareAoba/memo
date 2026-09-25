//! Browser boundary regressions. Local CLI use remains intentionally unauthenticated.
use axum::{body::Body, http::Request};
use preset_execution_api::{app_with_photo_dir, db};
use tower::ServiceExt;

#[tokio::test]
async fn local_cli_workflow_remains_available_without_login() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("audit.sqlite3"))
        .await
        .unwrap();
    let app = app_with_photo_dir(pool.clone(), dir.path().join("photos"));
    let create = app
        .clone()
        .oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .method("POST")
                .uri("/api/entities")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"name":"Audit-only fixture"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create.status(), 201);
    let read = app
        .clone()
        .oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .uri("/api/entities")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(read.status(), 200);
    let reset = app
        .oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .method("POST")
                .uri("/api/settings/reset")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"target":"works","confirmation":"works"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(reset.status(), 204);
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM entities")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);
    pool.close().await;
}

#[tokio::test]
async fn foreign_origin_and_arbitrary_host_are_rejected_without_writes() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("audit.sqlite3"))
        .await
        .unwrap();
    let app = app_with_photo_dir(pool.clone(), dir.path().join("photos"));
    for (host, origin, site) in [
        ("untrusted.example", None, None),
        ("localhost:3000", Some("https://other.example"), None),
        ("localhost:3000", Some("https://localhost:3000"), None),
        ("localhost:3000", Some("null"), None),
        (
            "localhost:3000",
            Some("http://localhost:3000"),
            Some("cross-site"),
        ),
        (
            "localhost:3000",
            Some("http://localhost:3000"),
            Some("same-site"),
        ),
        ("localhost:3000", None, Some("same-origin")),
    ] {
        let mut request = Request::builder()
            .header("host", host)
            .method("POST")
            .uri("/api/entities")
            .header("content-type", "application/json");
        if let Some(origin) = origin {
            request = request.header("origin", origin);
        }
        if let Some(site) = site {
            request = request.header("sec-fetch-site", site);
        }
        let response = app
            .clone()
            .oneshot(request.body(Body::from(r#"{"name":"Rejected"}"#)).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), 403, "{host} {origin:?} {site:?}");
        assert_eq!(response.headers()["x-frame-options"], "DENY");
    }
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM entities")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);
    let response = app
        .oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .header("origin", "http://localhost:3000")
                .header("sec-fetch-site", "same-origin")
                .method("POST")
                .uri("/api/entities")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"name":"Allowed"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 201);
    pool.close().await;
}

#[tokio::test]
async fn configured_origin_and_http2_authority_are_enforced() {
    use preset_execution_api::{app_with_policy, security::RequestPolicy};
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let app = app_with_policy(
        pool.clone(),
        dir.path().join("photos"),
        None,
        RequestPolicy::parse("https://memo.example").unwrap(),
    );
    for (uri, host, origin, expected) in [
        (
            "https://memo.example/api/health",
            None,
            Some("https://memo.example"),
            200,
        ),
        (
            "/api/health",
            Some("memo.example"),
            Some("http://memo.example"),
            403,
        ),
        ("/api/health", Some("localhost:3000"), None, 403),
        ("/api/health", None, None, 403),
        (
            "https://evil.example/api/health",
            Some("memo.example"),
            None,
            403,
        ),
    ] {
        let mut request = Request::builder().uri(uri);
        if let Some(host) = host {
            request = request.header("host", host);
        }
        if let Some(origin) = origin {
            request = request.header("origin", origin);
        }
        // Forwarding headers cannot bypass the request authority checks.
        let response = app
            .clone()
            .oneshot(
                request
                    .header("x-forwarded-host", "memo.example")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), expected);
    }
    for invalid in [
        "",
        "*",
        "null",
        "https://a.example/path",
        "https://u:p@a.example",
        "https://a.example?x=1",
    ] {
        assert!(RequestPolicy::parse(invalid).is_err());
    }
    pool.close().await;
}
