//! Durable scheduler; independent of the concrete delivery provider.
use crate::push::{DeliveryResult, Keys, PushTransport, Subscription, now};
use serde_json::json;
use sqlx::{Row, SqlitePool};
use std::{sync::Arc, time::Duration};

pub struct Job {
    pub id: String,
    pub token: String,
}

pub async fn claim(pool: &SqlitePool) -> Result<Vec<Job>, sqlx::Error> {
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    sqlx::query("UPDATE push_deliveries SET status='cancelled',lease_token=NULL,lease_until=NULL,updated_at=unixepoch() WHERE status IN ('pending','sending') AND NOT EXISTS(SELECT 1 FROM schedules s JOIN push_subscriptions p ON p.id=push_deliveries.subscription_id AND p.user_id=s.user_id WHERE s.id=push_deliveries.schedule_id AND s.reminder_version=push_deliveries.reminder_version AND s.reminder_enabled=1 AND s.status IN ('planned','in_progress') AND s.reminder_start_at>unixepoch() AND p.enabled=1)").execute(&mut *tx).await?;
    sqlx::query("INSERT OR IGNORE INTO push_deliveries(id,subscription_id,schedule_id,reminder_version) SELECT lower(hex(randomblob(16))),p.id,s.id,s.reminder_version FROM schedules s JOIN push_subscriptions p ON p.user_id=s.user_id AND p.enabled=1 AND EXISTS(SELECT 1 FROM users u WHERE u.id=p.user_id AND COALESCE(json_extract(u.settings_json,'$.push_enabled'),1)=1) WHERE s.reminder_enabled=1 AND s.status IN ('planned','in_progress') AND s.reminder_at<=unixepoch() AND s.reminder_start_at>unixepoch()")
        .execute(&mut *tx).await?;
    sqlx::query("UPDATE push_deliveries SET status='failed',result_code='attempt_limit',updated_at=unixepoch() WHERE status='sending' AND lease_until<=unixepoch() AND attempts>=5").execute(&mut *tx).await?;
    let rows = sqlx::query("SELECT d.id FROM push_deliveries d JOIN push_subscriptions p ON p.id=d.subscription_id WHERE p.enabled=1 AND EXISTS(SELECT 1 FROM users u WHERE u.id=p.user_id AND COALESCE(json_extract(u.settings_json,'$.push_enabled'),1)=1) AND p.visible_until<=unixepoch() AND d.attempts<5 AND ((d.status='pending' AND d.available_at<=unixepoch()) OR (d.status='sending' AND d.lease_until<=unixepoch())) ORDER BY d.available_at,d.id LIMIT 4")
        .fetch_all(&mut *tx).await?;
    let mut jobs = Vec::new();
    for row in rows {
        let id: String = row.get("id");
        let token = uuid::Uuid::new_v4().to_string();
        sqlx::query("UPDATE push_deliveries SET status='sending',attempts=attempts+1,lease_until=unixepoch()+30,lease_token=?,updated_at=unixepoch() WHERE id=?")
            .bind(&token).bind(&id).execute(&mut *tx).await?;
        jobs.push(Job { id, token });
    }
    // Bounded retention: old delivery history is not needed for future occurrences.
    sqlx::query("DELETE FROM push_deliveries WHERE updated_at<unixepoch()-2592000 AND status IN ('sent','failed','cancelled') AND NOT EXISTS(SELECT 1 FROM schedules s WHERE s.id=push_deliveries.schedule_id AND s.reminder_version=push_deliveries.reminder_version AND s.reminder_start_at>unixepoch())").execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(jobs)
}

pub async fn deliver<T: PushTransport>(
    pool: &SqlitePool,
    transport: &T,
    job: Job,
) -> Result<(), sqlx::Error> {
    // Re-read just before I/O; edits after this point are an unavoidable in-flight race.
    let row=sqlx::query("SELECT d.subscription_id,d.attempts,s.id,s.title,s.scheduled_date,s.start_time,s.time_zone,s.reminder_version,s.reminder_start_at,p.endpoint,p.p256dh,p.auth,p.visible_until FROM push_deliveries d JOIN schedules s ON s.id=d.schedule_id JOIN push_subscriptions p ON p.id=d.subscription_id AND p.user_id=s.user_id WHERE d.id=? AND d.lease_token=? AND d.status='sending' AND s.reminder_version=d.reminder_version AND s.reminder_enabled=1 AND s.status IN ('planned','in_progress') AND s.reminder_at<=unixepoch() AND s.reminder_start_at>unixepoch() AND p.enabled=1 AND EXISTS(SELECT 1 FROM users u WHERE u.id=p.user_id AND COALESCE(json_extract(u.settings_json,'$.push_enabled'),1)=1)")
        .bind(&job.id).bind(&job.token).fetch_optional(pool).await?;
    let Some(row) = row else {
        sqlx::query("UPDATE push_deliveries SET status='cancelled',lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?")
            .bind(job.id).bind(job.token).execute(pool).await?;
        return Ok(());
    };
    if row.get::<i64, _>("visible_until") > now() {
        sqlx::query("UPDATE push_deliveries SET status='pending',attempts=attempts-1,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?")
            .bind(job.id).bind(job.token).execute(pool).await?;
        return Ok(());
    }
    let start = row.get::<i64, _>("reminder_start_at");
    let id = row.get::<String, _>("id");
    let version = row.get::<i64, _>("reminder_version");
    let payload = json!({"type":"reminder","schedule_id":id,"reminder_version":version,"notification_id":format!("{id}:{version}"),"title":row.get::<String,_>("title"),"body":format!("{} · {} ({})",row.get::<String,_>("scheduled_date"),row.get::<String,_>("start_time"),row.get::<String,_>("time_zone")),"scheduled_date":row.get::<String,_>("scheduled_date"),"start_time":row.get::<String,_>("start_time"),"time_zone":row.get::<String,_>("time_zone"),"url":format!("/#/schedules/{id}"),"start_at":start});
    let target = Subscription {
        endpoint: row.get("endpoint"),
        keys: Keys {
            p256dh: row.get("p256dh"),
            auth: row.get("auth"),
        },
        expiration_time: None,
    };
    let result = transport
        .send(
            target,
            serde_json::to_vec(&payload).expect("JSON values serialize"),
            (start - now()).max(0) as u64,
        )
        .await;
    let attempts = row.get::<i64, _>("attempts");
    let (status, code, delay) = match result {
        DeliveryResult::Accepted => ("sent", "accepted", 0),
        DeliveryResult::Expired => ("failed", "expired", 0),
        DeliveryResult::Rejected => ("failed", "rejected", 0),
        DeliveryResult::Retry(delay) if attempts < 5 => (
            "pending",
            "retry",
            delay.max((15u64 * (1 << attempts)).min(300)),
        ),
        DeliveryResult::Retry(_) => ("failed", "attempt_limit", 0),
    };
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    // CAS prevents a late HTTP response from overwriting a newer lease or in-app receipt.
    sqlx::query("UPDATE push_deliveries SET status=?,result_code=?,available_at=?,lease_until=NULL,lease_token=NULL,updated_at=unixepoch() WHERE id=? AND lease_token=?")
        .bind(status).bind(code).bind(now()+delay as i64).bind(job.id).bind(job.token).execute(&mut *tx).await?;
    if result == DeliveryResult::Expired {
        sqlx::query("UPDATE push_subscriptions SET enabled=0 WHERE id=? AND endpoint=? AND p256dh=? AND auth=?")
            .bind(row.get::<String,_>("subscription_id")).bind(row.get::<String,_>("endpoint")).bind(row.get::<String,_>("p256dh")).bind(row.get::<String,_>("auth")).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}

pub async fn run<T: PushTransport + 'static>(
    pool: SqlitePool,
    transport: Arc<T>,
    mut shutdown: tokio::sync::watch::Receiver<bool>,
) {
    let mut interval = tokio::time::interval(Duration::from_secs(5));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        tokio::select! { _=shutdown.changed()=>break, _=interval.tick()=>{} }
        let jobs = match claim(&pool).await {
            Ok(jobs) => jobs,
            Err(_) => {
                tracing::error!(event = "push_scheduler_failed");
                continue;
            }
        };
        let mut tasks = tokio::task::JoinSet::new();
        for job in jobs {
            let pool = pool.clone();
            let transport = transport.clone();
            tasks.spawn(async move { deliver(&pool, transport.as_ref(), job).await });
        }
        while let Some(result) = tasks.join_next().await {
            if !matches!(result, Ok(Ok(()))) {
                tracing::error!(event = "push_delivery_failed");
            }
        }
    }
}
