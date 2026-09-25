use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use p256::{
    SecretKey,
    elliptic_curve::{rand_core::OsRng, sec1::ToEncodedPoint},
};
use preset_execution_api::{
    app, app_with_push, db,
    push::{self, DeliveryResult, Keys, PushService, PushTransport, Subscription},
    reminder_worker::{claim, deliver},
};
use serde_json::{Value, json};
use sqlx::SqlitePool;
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};
use tower::ServiceExt;

async fn request(pool: &SqlitePool, path: &str, body: Value) -> Value {
    let response = app(pool.clone())
        .oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .method("POST")
                .uri(path)
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let value: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), 100000).await.unwrap()).unwrap();
    assert!(status.is_success(), "{value}");
    value
}
fn subscription() -> (SecretKey, Subscription) {
    let key = SecretKey::random(&mut OsRng);
    let sub = Subscription {
        endpoint: format!(
            "https://fcm.googleapis.com/fcm/send/{}",
            uuid::Uuid::new_v4()
        ),
        keys: Keys {
            p256dh: URL_SAFE_NO_PAD.encode(key.public_key().to_encoded_point(false).as_bytes()),
            auth: URL_SAFE_NO_PAD.encode([7; 16]),
        },
        expiration_time: None,
    };
    (key, sub)
}
async fn fixture() -> (tempfile::TempDir, SqlitePool, String, String) {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    let work = request(&pool, "/api/entities", json!({"name":"Push test"})).await;
    let schedule=request(&pool,"/api/schedules",json!({"entity_id":work["id"],"task_preset_ids":[],"scheduled_date":"2077-01-01","start_time":"09:00","end_time":"10:00","time_zone":"Asia/Tokyo","reminder_enabled":true})).await;
    let schedule = schedule["id"].as_str().unwrap().to_owned();
    sqlx::query("UPDATE schedules SET reminder_at=unixepoch()-1,reminder_start_at=unixepoch()+3600 WHERE id=?").bind(&schedule).execute(&pool).await.unwrap();
    let installation = uuid::Uuid::new_v4().to_string();
    push::register(
        &pool,
        "00000000-0000-4000-8000-000000000001",
        push::Registration {
            installation_id: installation.clone(),
            subscription: subscription().1,
        },
    )
    .await
    .unwrap();
    sqlx::query("UPDATE push_subscriptions SET visible_until=0")
        .execute(&pool)
        .await
        .unwrap();
    (dir, pool, schedule, installation)
}
struct Fake {
    result: DeliveryResult,
    calls: AtomicUsize,
}
impl PushTransport for Fake {
    async fn send(&self, _: Subscription, payload: Vec<u8>, ttl: u64) -> DeliveryResult {
        self.calls.fetch_add(1, Ordering::SeqCst);
        let payload: Value = serde_json::from_slice(&payload).unwrap();
        assert_eq!(payload["type"], "reminder");
        assert!(payload["scheduled_date"].is_string());
        assert!(payload["start_time"].is_string());
        assert!(payload["time_zone"].is_string());
        assert!(ttl > 0 && ttl <= 3600);
        match self.result {
            DeliveryResult::Accepted => DeliveryResult::Accepted,
            DeliveryResult::Expired => DeliveryResult::Expired,
            DeliveryResult::Retry(delay) => DeliveryResult::Retry(delay),
            DeliveryResult::Rejected => DeliveryResult::Rejected,
        }
    }
}
fn fake(result: DeliveryResult) -> Fake {
    Fake {
        result,
        calls: AtomicUsize::new(0),
    }
}

#[tokio::test]
async fn sends_once_and_persists_across_restarts() {
    let (dir, pool, _, _) = fixture().await;
    let jobs = claim(&pool).await.unwrap();
    assert_eq!(jobs.len(), 1);
    assert!(claim(&pool).await.unwrap().is_empty());
    let transport = fake(DeliveryResult::Accepted);
    deliver(&pool, &transport, jobs.into_iter().next().unwrap())
        .await
        .unwrap();
    pool.close().await;
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    assert!(claim(&pool).await.unwrap().is_empty());
    assert_eq!(transport.calls.load(Ordering::SeqCst), 1);
    let status: String = sqlx::query_scalar("SELECT status FROM push_deliveries")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(status, "sent");
}

#[tokio::test]
async fn retries_and_recovers_expired_leases_without_overwriting_receipts() {
    let (_dir, pool, schedule, installation) = fixture().await;
    let job = claim(&pool).await.unwrap().pop().unwrap();
    deliver(&pool, &fake(DeliveryResult::Retry(120)), job)
        .await
        .unwrap();
    assert!(claim(&pool).await.unwrap().is_empty());
    let (status, available): (String, i64) =
        sqlx::query_as("SELECT status,available_at FROM push_deliveries")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(status, "pending");
    assert!(available >= push::now() + 119);
    sqlx::query("UPDATE push_deliveries SET available_at=0")
        .execute(&pool)
        .await
        .unwrap();
    let old = claim(&pool).await.unwrap().pop().unwrap();
    sqlx::query("UPDATE push_deliveries SET lease_until=0")
        .execute(&pool)
        .await
        .unwrap();
    let new = claim(&pool).await.unwrap().pop().unwrap();
    assert_ne!(old.token, new.token);
    let transport = fake(DeliveryResult::Accepted);
    deliver(&pool, &transport, old).await.unwrap();
    assert_eq!(transport.calls.load(Ordering::SeqCst), 0);
    push::presence(
        &pool,
        "00000000-0000-4000-8000-000000000001",
        push::Presence {
            tab_id: "test".into(),
            installation_id: installation,
            visible: true,
            seen: vec![push::Receipt {
                schedule_id: schedule,
                reminder_version: 1,
            }],
        },
    )
    .await
    .unwrap();
    deliver(&pool, &transport, new).await.unwrap();
    assert_eq!(transport.calls.load(Ordering::SeqCst), 0);
    assert!(claim(&pool).await.unwrap().is_empty());
}

#[tokio::test]
async fn changing_or_cancelling_after_claim_prevents_send() {
    let (_dir, pool, schedule, _) = fixture().await;
    let job = claim(&pool).await.unwrap().pop().unwrap();
    sqlx::query("UPDATE schedules SET reminder_value=30 WHERE id=?")
        .bind(&schedule)
        .execute(&pool)
        .await
        .unwrap();
    let transport = fake(DeliveryResult::Accepted);
    deliver(&pool, &transport, job).await.unwrap();
    assert_eq!(transport.calls.load(Ordering::SeqCst), 0);
    let job = claim(&pool).await.unwrap().pop().unwrap();
    sqlx::query("UPDATE schedules SET status='cancelled' WHERE id=?")
        .bind(&schedule)
        .execute(&pool)
        .await
        .unwrap();
    deliver(&pool, &transport, job).await.unwrap();
    assert_eq!(transport.calls.load(Ordering::SeqCst), 0);
    assert!(claim(&pool).await.unwrap().is_empty());
}

#[tokio::test]
async fn foreground_expiry_unsubscribe_and_expired_endpoint() {
    let (_dir, pool, _, installation) = fixture().await;
    push::presence(
        &pool,
        "00000000-0000-4000-8000-000000000001",
        push::Presence {
            tab_id: "test".into(),
            installation_id: installation.clone(),
            visible: true,
            seen: vec![],
        },
    )
    .await
    .unwrap();
    assert!(claim(&pool).await.unwrap().is_empty());
    push::presence(
        &pool,
        "00000000-0000-4000-8000-000000000001",
        push::Presence {
            tab_id: "test".into(),
            installation_id: installation.clone(),
            visible: false,
            seen: vec![],
        },
    )
    .await
    .unwrap();
    let job = claim(&pool).await.unwrap().pop().unwrap();
    deliver(&pool, &fake(DeliveryResult::Expired), job)
        .await
        .unwrap();
    let enabled: bool = sqlx::query_scalar("SELECT enabled FROM push_subscriptions")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(!enabled);
    assert!(claim(&pool).await.unwrap().is_empty());
    push::unregister(&pool, "00000000-0000-4000-8000-000000000001", &installation)
        .await
        .unwrap();
}

#[tokio::test]
async fn excludes_other_owners_and_started_schedules() {
    let (_dir, pool, _, _) = fixture().await;
    sqlx::query("INSERT INTO users(id,display_name,time_zone) VALUES('other','Other','UTC')")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE push_subscriptions SET user_id='other'")
        .execute(&pool)
        .await
        .unwrap();
    assert!(claim(&pool).await.unwrap().is_empty());
    sqlx::query("UPDATE push_subscriptions SET user_id='00000000-0000-4000-8000-000000000001'")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE schedules SET reminder_start_at=unixepoch()-1")
        .execute(&pool)
        .await
        .unwrap();
    assert!(claim(&pool).await.unwrap().is_empty());
}

#[test]
fn encrypted_request_round_trip_and_key_persistence() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("push.key");
    let service = PushService::load(&path, "mailto:operator@example.com".into()).unwrap();
    let same = PushService::load(&path, "mailto:operator@example.com".into()).unwrap();
    assert_eq!(service.public_key, same.public_key);
    let (secret, sub) = subscription();
    let payload = b"confidential reminder".to_vec();
    let request = service.request(&sub, payload.clone(), 123).unwrap();
    assert_eq!(request.headers()["ttl"], "123");
    assert_eq!(request.headers()["content-encoding"], "aes128gcm");
    assert!(
        request.headers()["authorization"]
            .to_str()
            .unwrap()
            .starts_with("vapid t=")
    );
    let authorization = request.headers()["authorization"].to_str().unwrap();
    let token = authorization
        .strip_prefix("vapid t=")
        .unwrap()
        .split(',')
        .next()
        .unwrap();
    let claims: Value = serde_json::from_slice(
        &URL_SAFE_NO_PAD
            .decode(token.split('.').nth(1).unwrap())
            .unwrap(),
    )
    .unwrap();
    assert!(claims["exp"].as_i64().unwrap() <= push::now() + 86400);
    assert_eq!(claims["sub"], "mailto:operator@example.com");
    let long = service.request(&sub, payload.clone(), 365 * 86400).unwrap();
    assert_eq!(long.headers()["ttl"], "86400");
    let encrypted = request.body().unwrap().as_bytes().unwrap().to_vec();
    assert_ne!(encrypted, payload);
    assert_eq!(
        web_push_native::decrypt(encrypted, &secret, &web_push_native::Auth::from([7; 16]))
            .unwrap(),
        payload
    );
    for endpoint in [
        "https://127.0.0.1/private",
        "http://fcm.googleapis.com/send",
        "https://fcm.googleapis.com.evil.test/send",
        "https://fcm.googleapis.com:8443/send",
        "https://user@fcm.googleapis.com/send",
    ] {
        let mut invalid = sub.clone();
        invalid.endpoint = endpoint.into();
        assert!(push::validate_subscription(&invalid).is_err());
    }
    let mut invalid = sub;
    invalid.keys.auth = "short".into();
    assert!(push::validate_subscription(&invalid).is_err());
}

#[tokio::test]
async fn subscription_http_contract_and_cross_origin_rejection() {
    let (dir, pool, _, installation) = fixture().await;
    let service = Arc::new(
        PushService::load(
            &dir.path().join("vapid.key"),
            "mailto:operator@example.com".into(),
        )
        .unwrap(),
    );
    let app = app_with_push(pool.clone(), dir.path().join("photos"), Some(service));
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .uri(format!("/api/push/config?installation_id={installation}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), 10000).await.unwrap()).unwrap();
    assert_eq!(body["subscribed"], true);
    assert!(body.get("private_key").is_none());
    let response = app
        .oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .method("DELETE")
                .uri(format!("/api/push/subscriptions/{installation}"))
                .header("origin", "https://evil.test")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 403);
    let enabled: bool = sqlx::query_scalar("SELECT enabled FROM push_subscriptions")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(enabled);
}

#[tokio::test]
async fn visible_tabs_are_independent_and_retries_are_bounded() {
    let (_dir, pool, _, installation) = fixture().await;
    for (tab, visible) in [("one", true), ("two", true), ("one", false)] {
        push::presence(
            &pool,
            "00000000-0000-4000-8000-000000000001",
            push::Presence {
                installation_id: installation.clone(),
                tab_id: tab.into(),
                visible,
                seen: vec![],
            },
        )
        .await
        .unwrap();
    }
    assert!(claim(&pool).await.unwrap().is_empty());
    push::presence(
        &pool,
        "00000000-0000-4000-8000-000000000001",
        push::Presence {
            installation_id: installation,
            tab_id: "two".into(),
            visible: false,
            seen: vec![],
        },
    )
    .await
    .unwrap();
    let transport = fake(DeliveryResult::Retry(0));
    for _ in 0..5 {
        let job = claim(&pool).await.unwrap().pop().unwrap();
        deliver(&pool, &transport, job).await.unwrap();
        sqlx::query("UPDATE push_deliveries SET available_at=0")
            .execute(&pool)
            .await
            .unwrap();
    }
    assert!(claim(&pool).await.unwrap().is_empty());
    assert_eq!(transport.calls.load(Ordering::SeqCst), 5);
}

#[tokio::test]
async fn account_push_setting_pauses_claimed_jobs_and_resumes_without_duplicate_delivery() {
    let (_dir, pool, _, _) = fixture().await;
    let jobs = claim(&pool).await.unwrap();
    assert_eq!(jobs.len(), 1);
    let patch = |enabled| {
        app(pool.clone()).oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .method("PATCH")
                .uri("/api/settings")
                .header("content-type", "application/json")
                .body(Body::from(json!({"push_enabled":enabled}).to_string()))
                .unwrap(),
        )
    };
    assert!(patch(false).await.unwrap().status().is_success());
    let transport = fake(DeliveryResult::Accepted);
    for job in jobs {
        deliver(&pool, &transport, job).await.unwrap();
    }
    assert_eq!(transport.calls.load(Ordering::SeqCst), 0);
    assert!(claim(&pool).await.unwrap().is_empty());
    assert!(patch(true).await.unwrap().status().is_success());
    let resumed = claim(&pool).await.unwrap();
    assert_eq!(resumed.len(), 1);
    for job in resumed {
        deliver(&pool, &transport, job).await.unwrap();
    }
    assert_eq!(transport.calls.load(Ordering::SeqCst), 1);
    assert!(claim(&pool).await.unwrap().is_empty());
    pool.close().await;
}
#[tokio::test]
async fn reopening_restores_unsent_reminders_without_reviving_sent_deliveries() {
    let (_dir, pool, schedule, _) = fixture().await;
    let stale = claim(&pool).await.unwrap().pop().unwrap();
    request(
        &pool,
        &format!("/api/schedules/{schedule}/complete"),
        json!({}),
    )
    .await;
    assert!(claim(&pool).await.unwrap().is_empty());
    request(
        &pool,
        &format!("/api/schedules/{schedule}/reopen"),
        json!({}),
    )
    .await;
    let restored = claim(&pool)
        .await
        .unwrap()
        .pop()
        .expect("unsent reminder restored");
    assert_eq!(stale.id, restored.id);
    assert_ne!(stale.token, restored.token);
    let transport = fake(DeliveryResult::Accepted);
    deliver(&pool, &transport, stale).await.unwrap();
    assert_eq!(transport.calls.load(Ordering::SeqCst), 0);
    deliver(&pool, &transport, restored).await.unwrap();
    assert_eq!(transport.calls.load(Ordering::SeqCst), 1);
    request(
        &pool,
        &format!("/api/schedules/{schedule}/complete"),
        json!({}),
    )
    .await;
    assert!(claim(&pool).await.unwrap().is_empty());
    request(
        &pool,
        &format!("/api/schedules/{schedule}/reopen"),
        json!({}),
    )
    .await;
    assert!(claim(&pool).await.unwrap().is_empty());
}

#[tokio::test]
async fn restored_reminders_preserve_backoff_and_attempt_limit() {
    let (_dir, pool, _, _) = fixture().await;
    let job = claim(&pool).await.unwrap().pop().unwrap();
    sqlx::query("UPDATE push_deliveries SET status='cancelled',attempts=4,available_at=unixepoch()+3600,lease_token=NULL,lease_until=NULL WHERE id=?")
        .bind(&job.id).execute(&pool).await.unwrap();
    assert!(claim(&pool).await.unwrap().is_empty());
    let attempts: i64 = sqlx::query_scalar("SELECT attempts FROM push_deliveries WHERE id=?")
        .bind(&job.id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(attempts, 4);
    sqlx::query("UPDATE push_deliveries SET available_at=0 WHERE id=?")
        .bind(&job.id)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(claim(&pool).await.unwrap().len(), 1);
    sqlx::query("UPDATE push_deliveries SET status='cancelled',lease_token=NULL,lease_until=NULL WHERE id=?").bind(&job.id).execute(&pool).await.unwrap();
    assert!(claim(&pool).await.unwrap().is_empty());
}
