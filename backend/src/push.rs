//! Web Push transport and browser registration. Scheduling lives in reminder_worker.
use crate::errors::ApiError;
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use p256::{
    SecretKey,
    elliptic_curve::{rand_core::OsRng, sec1::ToEncodedPoint},
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{Row, SqlitePool};
use std::{path::Path, time::Duration};
use web_push_native::{Auth, WebPushBuilder, jwt_simple::algorithms::ES256KeyPair};

pub type Result<T> = std::result::Result<T, ApiError>;
fn db(_: sqlx::Error) -> ApiError {
    ApiError::DatabaseUnavailable
}

pub struct PushService {
    key: ES256KeyPair,
    pub public_key: String,
    subject: String,
    client: reqwest::Client,
}

impl PushService {
    pub fn load(
        path: &Path,
        subject: String,
    ) -> std::result::Result<Self, Box<dyn std::error::Error>> {
        if !(subject.starts_with("mailto:") && subject.contains('@')
            || subject.starts_with("https://"))
        {
            return Err("VAPID_SUBJECT must be a mailto contact or HTTPS URL".into());
        }
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        if !path.exists() {
            use std::io::Write;
            let secret = SecretKey::random(&mut OsRng);
            let mut options = std::fs::OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o600);
            }
            match options.open(path) {
                Ok(mut file) => {
                    file.write_all(URL_SAFE_NO_PAD.encode(secret.to_bytes()).as_bytes())?;
                    file.sync_all()?;
                }
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
                Err(e) => return Err(e.into()),
            }
        }
        let bytes = URL_SAFE_NO_PAD
            .decode(std::fs::read_to_string(path)?.trim())
            .map_err(|_| "Invalid VAPID key file")?;
        let secret = SecretKey::from_slice(&bytes).map_err(|_| "Invalid VAPID key file")?;
        Ok(Self {
            key: ES256KeyPair::from_bytes(&bytes).map_err(|_| "Invalid VAPID key file")?,
            public_key: URL_SAFE_NO_PAD
                .encode(secret.public_key().to_encoded_point(false).as_bytes()),
            subject,
            client: reqwest::Client::builder()
                .https_only(true)
                .redirect(reqwest::redirect::Policy::none())
                .connect_timeout(Duration::from_secs(5))
                .timeout(Duration::from_secs(10))
                .build()?,
        })
    }

    pub fn request(
        &self,
        target: &Subscription,
        payload: Vec<u8>,
        ttl: u64,
    ) -> std::result::Result<reqwest::Request, &'static str> {
        validate_subscription(target).map_err(|_| "invalid_subscription")?;
        let public = p256::PublicKey::from_sec1_bytes(
            &URL_SAFE_NO_PAD
                .decode(&target.keys.p256dh)
                .map_err(|_| "invalid_key")?,
        )
        .map_err(|_| "invalid_key")?;
        let auth: [u8; 16] = URL_SAFE_NO_PAD
            .decode(&target.keys.auth)
            .map_err(|_| "invalid_auth")?
            .try_into()
            .map_err(|_| "invalid_auth")?;
        let request = WebPushBuilder::new(
            target.endpoint.parse().map_err(|_| "invalid_endpoint")?,
            public,
            Auth::from(auth),
        )
        .with_valid_duration(Duration::from_secs(12 * 3600))
        .with_vapid(&self.key, &self.subject)
        .build(payload)
        .map_err(|_| "encryption_failed")?;
        let (mut parts, body) = request.into_parts();
        parts.headers.insert(
            "ttl",
            axum::http::HeaderValue::from_str(&ttl.min(86400).to_string())
                .map_err(|_| "invalid_ttl")?,
        );
        self.client
            .post(&target.endpoint)
            .headers(parts.headers)
            .header("Urgency", "high")
            .body(body)
            .build()
            .map_err(|_| "request_failed")
    }
}

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Keys {
    pub p256dh: String,
    pub auth: String,
}
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Subscription {
    pub endpoint: String,
    pub keys: Keys,
    #[serde(rename = "expirationTime", default)]
    pub expiration_time: Option<f64>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Registration {
    pub installation_id: String,
    pub subscription: Subscription,
}

pub fn validate_subscription(s: &Subscription) -> Result<()> {
    let invalid = || ApiError::InvalidInput;
    if s.endpoint.len() > 4096 || s.keys.p256dh.len() > 100 || s.keys.auth.len() > 30 {
        return Err(invalid());
    }
    let url = reqwest::Url::parse(&s.endpoint).map_err(|_| invalid())?;
    let host = url.host_str().unwrap_or_default();
    // User-provided URLs must never turn the sender into an arbitrary HTTP client.
    let allowed = host == "fcm.googleapis.com"
        || host == "updates.push.services.mozilla.com"
        || host.ends_with(".push.services.mozilla.com")
        || host == "web.push.apple.com"
        || host.ends_with(".push.apple.com")
        || host.ends_with(".notify.windows.com");
    if !allowed
        || url.scheme() != "https"
        || url.port_or_known_default() != Some(443)
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
    {
        return Err(invalid());
    }
    let key = URL_SAFE_NO_PAD
        .decode(&s.keys.p256dh)
        .map_err(|_| invalid())?;
    if key.len() != 65
        || p256::PublicKey::from_sec1_bytes(&key).is_err()
        || URL_SAFE_NO_PAD
            .decode(&s.keys.auth)
            .map_err(|_| invalid())?
            .len()
            != 16
    {
        return Err(invalid());
    }
    Ok(())
}

pub async fn register(
    pool: &SqlitePool,
    user_id: &str,
    registration: Registration,
) -> Result<Value> {
    let installation = uuid::Uuid::parse_str(&registration.installation_id)
        .map_err(|_| ApiError::InvalidInput)?
        .to_string();
    validate_subscription(&registration.subscription)?;
    let s = registration.subscription;
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(db)?;
    let owner: Option<String> =
        sqlx::query_scalar("SELECT user_id FROM push_subscriptions WHERE endpoint=?")
            .bind(&s.endpoint)
            .fetch_optional(&mut *tx)
            .await
            .map_err(db)?;
    if owner.as_deref().is_some_and(|owner| owner != user_id) {
        return Err(ApiError::InvalidInput);
    }
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM push_subscriptions WHERE user_id=? AND installation_id!=? AND endpoint!=?")
        .bind(user_id).bind(&installation).bind(&s.endpoint).fetch_one(&mut *tx).await.map_err(db)?;
    if count >= 20 {
        return Err(ApiError::InvalidInput);
    }
    // A browser can lose local storage while retaining its push subscription.
    sqlx::query(
        "DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=? AND installation_id!=?",
    )
    .bind(user_id)
    .bind(&s.endpoint)
    .bind(&installation)
    .execute(&mut *tx)
    .await
    .map_err(db)?;
    sqlx::query("UPDATE push_deliveries SET status='pending',attempts=0,available_at=unixepoch(),lease_token=NULL,lease_until=NULL WHERE status IN ('sending','failed','cancelled') AND subscription_id IN (SELECT id FROM push_subscriptions WHERE user_id=? AND installation_id=? AND (endpoint!=? OR p256dh!=? OR auth!=? OR enabled=0))")
        .bind(user_id).bind(&installation).bind(&s.endpoint).bind(&s.keys.p256dh).bind(&s.keys.auth).execute(&mut *tx).await.map_err(db)?;
    sqlx::query("INSERT INTO push_subscriptions(id,user_id,installation_id,endpoint,p256dh,auth,visible_until) VALUES(?,?,?,?,?,?,unixepoch()+45) ON CONFLICT(user_id,installation_id) DO UPDATE SET endpoint=excluded.endpoint,p256dh=excluded.p256dh,auth=excluded.auth,enabled=1,visible_until=excluded.visible_until,updated_at=unixepoch()")
        .bind(uuid::Uuid::new_v4().to_string()).bind(user_id).bind(&installation).bind(s.endpoint).bind(s.keys.p256dh).bind(s.keys.auth)
        .execute(&mut *tx).await.map_err(db)?;
    tx.commit().await.map_err(db)?;
    Ok(json!({"enabled":true}))
}

pub async fn unregister(pool: &SqlitePool, user_id: &str, installation: &str) -> Result<()> {
    let installation = uuid::Uuid::parse_str(installation)
        .map_err(|_| ApiError::InvalidInput)?
        .to_string();
    sqlx::query("UPDATE push_subscriptions SET enabled=0,visible_until=0,updated_at=unixepoch() WHERE installation_id=? AND user_id=?")
        .bind(installation).bind(user_id).execute(pool).await.map_err(db)?;
    Ok(())
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Receipt {
    pub schedule_id: String,
    pub reminder_version: i64,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Presence {
    pub installation_id: String,
    pub visible: bool,
    #[serde(default)]
    pub tab_id: String,
    #[serde(default)]
    pub seen: Vec<Receipt>,
}
pub async fn presence(pool: &SqlitePool, user_id: &str, value: Presence) -> Result<Value> {
    uuid::Uuid::parse_str(&value.installation_id).map_err(|_| ApiError::InvalidInput)?;
    if value.seen.len() > 100 || value.tab_id.len() > 100 {
        return Err(ApiError::InvalidInput);
    }
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(db)?;
    let sub = sqlx::query("UPDATE push_subscriptions SET visible_until=?,updated_at=unixepoch() WHERE user_id=? AND installation_id=? AND enabled=1 RETURNING id")
        .bind(if value.visible { now()+45 } else { 0 }).bind(user_id).bind(value.installation_id).fetch_optional(&mut *tx).await.map_err(db)?;
    if let Some(sub) = sub {
        sqlx::query("INSERT INTO push_presence(subscription_id,tab_id,expires_at) VALUES(?,?,?) ON CONFLICT(subscription_id,tab_id) DO UPDATE SET expires_at=excluded.expires_at")
            .bind(sub.get::<String,_>("id")).bind(&value.tab_id).bind(if value.visible { now()+45 } else { 0 }).execute(&mut *tx).await.map_err(db)?;
        sqlx::query(
            "DELETE FROM push_presence WHERE subscription_id=? AND expires_at<=unixepoch()",
        )
        .bind(sub.get::<String, _>("id"))
        .execute(&mut *tx)
        .await
        .map_err(db)?;
        sqlx::query("UPDATE push_subscriptions SET visible_until=COALESCE((SELECT MAX(expires_at) FROM push_presence WHERE subscription_id=?),0) WHERE id=?")
            .bind(sub.get::<String,_>("id")).bind(sub.get::<String,_>("id")).execute(&mut *tx).await.map_err(db)?;
        for receipt in value.seen {
            sqlx::query("INSERT INTO push_deliveries(id,subscription_id,schedule_id,reminder_version,status,result_code) SELECT ?,?,id,reminder_version,'sent','in_app' FROM schedules WHERE id=? AND user_id=? AND reminder_version=? AND reminder_enabled=1 AND reminder_at<=unixepoch() AND reminder_start_at>unixepoch() ON CONFLICT(subscription_id,schedule_id,reminder_version) DO UPDATE SET status='sent',result_code='in_app',lease_token=NULL,lease_until=NULL,updated_at=unixepoch()")
                .bind(uuid::Uuid::new_v4().to_string()).bind(sub.get::<String,_>("id")).bind(receipt.schedule_id).bind(user_id).bind(receipt.reminder_version)
                .execute(&mut *tx).await.map_err(db)?;
        }
        tx.commit().await.map_err(db)?;
        return Ok(json!({"enabled":true}));
    }
    tx.commit().await.map_err(db)?;
    Ok(json!({"enabled":false}))
}

pub fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[derive(Debug, PartialEq)]
pub enum DeliveryResult {
    Accepted,
    Expired,
    Retry(u64),
    Rejected,
}
pub trait PushTransport: Send + Sync {
    fn send(
        &self,
        target: Subscription,
        payload: Vec<u8>,
        ttl: u64,
    ) -> impl std::future::Future<Output = DeliveryResult> + Send;
}
impl PushTransport for PushService {
    async fn send(&self, target: Subscription, payload: Vec<u8>, ttl: u64) -> DeliveryResult {
        let Ok(request) = self.request(&target, payload, ttl) else {
            return DeliveryResult::Rejected;
        };
        let Ok(response) = self.client.execute(request).await else {
            return DeliveryResult::Retry(0);
        };
        match response.status().as_u16() {
            200..=299 => DeliveryResult::Accepted,
            404 | 410 => DeliveryResult::Expired,
            408 | 425 | 429 | 500..=599 => DeliveryResult::Retry(
                response
                    .headers()
                    .get("retry-after")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(0)
                    .min(3600),
            ),
            _ => DeliveryResult::Rejected,
        }
    }
}
