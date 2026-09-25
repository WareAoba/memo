pub mod config;
pub mod db;
pub mod errors;
mod local_user;
pub mod push;
pub mod reminder_worker;
mod routes;
pub mod security;
mod services;

use axum::{Router, middleware};
use sqlx::SqlitePool;

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub push: Option<std::sync::Arc<push::PushService>>,
    pub photo_dir: std::path::PathBuf,
    pub uploads: std::sync::Arc<tokio::sync::Semaphore>,
}

pub fn app(pool: SqlitePool) -> Router {
    app_with_photo_dir(pool, "data/photos".into())
}

pub fn app_with_photo_dir(pool: SqlitePool, photo_dir: std::path::PathBuf) -> Router {
    app_with_push(pool, photo_dir, None)
}

pub fn app_with_push(
    pool: SqlitePool,
    photo_dir: std::path::PathBuf,
    push: Option<std::sync::Arc<push::PushService>>,
) -> Router {
    app_with_policy(pool, photo_dir, push, security::RequestPolicy::default())
}

pub fn app_with_policy(
    pool: SqlitePool,
    photo_dir: std::path::PathBuf,
    push: Option<std::sync::Arc<push::PushService>>,
    policy: security::RequestPolicy,
) -> Router {
    routes::router()
        .with_state(AppState {
            pool,
            photo_dir,
            push,
            uploads: std::sync::Arc::new(tokio::sync::Semaphore::new(4)),
        })
        .layer(middleware::from_fn_with_state(policy, security::protect))
}

pub use services::photos::cleanup as cleanup_photos;
