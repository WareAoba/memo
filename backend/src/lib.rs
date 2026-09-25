pub mod auth;
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
    app_with_auth(pool, photo_dir, push, policy, auth::AuthMode::Virtual)
}

pub fn app_with_auth(
    pool: SqlitePool,
    photo_dir: std::path::PathBuf,
    push: Option<std::sync::Arc<push::PushService>>,
    policy: security::RequestPolicy,
    mode: auth::AuthMode,
) -> Router {
    let state = AppState {
        pool,
        photo_dir,
        push,
        uploads: std::sync::Arc::new(tokio::sync::Semaphore::new(4)),
    };
    routes::router()
        .route("/api/auth/me", axum::routing::get(auth::me))
        .route_layer(middleware::from_fn_with_state(
            (state.clone(), mode),
            auth::protect,
        ))
        .route("/api/health", axum::routing::get(routes::health::health))
        .method_not_allowed_fallback(|| async { errors::ApiError::MethodNotAllowed })
        .with_state(state)
        .layer(middleware::from_fn_with_state(policy, security::protect))
}

pub use services::photos::cleanup as cleanup_photos;
