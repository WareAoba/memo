use preset_execution_api::{
    app_with_auth, cleanup_photos, config::Config, db, push::PushService, reminder_worker,
};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    match dotenvy::dotenv() {
        Ok(_) => {}
        Err(error) if error.not_found() => {}
        Err(error) => return Err(error.into()),
    }
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let config = Config::from_env()?;
    let pool = db::connect(&config.database_path).await?;
    cleanup_photos(&pool, &config.photo_dir).await?;
    let push = if std::env::var("PUSH_ENABLED").as_deref() == Ok("false") {
        None
    } else {
        let key_path =
            std::env::var("VAPID_KEY_PATH").unwrap_or_else(|_| "data/push/vapid.key".into());
        let subject = std::env::var("VAPID_SUBJECT")
            .unwrap_or_else(|_| "mailto:admin@example.invalid".into());
        Some(std::sync::Arc::new(PushService::load(
            std::path::Path::new(&key_path),
            subject,
        )?))
    };
    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);
    let worker = push
        .clone()
        .map(|push| tokio::spawn(reminder_worker::run(pool.clone(), push, shutdown_rx)));
    let listener = tokio::net::TcpListener::bind(config.bind_address).await?;
    tracing::info!(event = "server_start", address = %listener.local_addr()?, "API listening");
    let result = axum::serve(
        listener,
        app_with_auth(
            pool.clone(),
            config.photo_dir,
            push,
            config.request_policy,
            config.auth_mode,
        ),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await;
    let _ = shutdown_tx.send(true);
    if let Some(worker) = worker {
        let _ = worker.await;
    }
    pool.close().await;
    result?;
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(error) = tokio::signal::ctrl_c().await {
            tracing::error!(%error, "Failed to listen for Ctrl+C");
        }
    };

    #[cfg(unix)]
    {
        let terminate = async {
            match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
                Ok(mut signal) => {
                    signal.recv().await;
                }
                Err(error) => {
                    tracing::error!(%error, "Failed to listen for SIGTERM");
                }
            }
        };
        tokio::select! { _ = ctrl_c => {}, _ = terminate => {} }
    }
    #[cfg(not(unix))]
    ctrl_c.await;

    tracing::info!(event = "server_shutdown", "Shutting down");
}
