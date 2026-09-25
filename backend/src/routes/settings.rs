use crate::{
    AppState,
    errors::ApiError,
    services::{Result, settings as service},
};
use axum::{
    Json,
    extract::{State, rejection::JsonRejection},
    http::StatusCode,
};
use serde_json::Value;

pub async fn get(State(state): State<AppState>) -> Result<Json<service::Settings>> {
    service::get(&state.pool).await.map(Json)
}
pub async fn bootstrap(
    State(state): State<AppState>,
    body: std::result::Result<Json<service::Bootstrap>, JsonRejection>,
) -> Result<Json<service::Settings>> {
    service::bootstrap(&state.pool, body.map_err(|_| ApiError::InvalidInput)?.0)
        .await
        .map(Json)
}
pub async fn patch(
    State(state): State<AppState>,
    body: std::result::Result<Json<Value>, JsonRejection>,
) -> Result<Json<service::Settings>> {
    service::patch(&state.pool, body.map_err(|_| ApiError::InvalidInput)?.0)
        .await
        .map(Json)
}
pub async fn reset(
    State(state): State<AppState>,
    body: std::result::Result<Json<service::Reset>, JsonRejection>,
) -> Result<StatusCode> {
    service::reset(
        &state.pool,
        &state.photo_dir,
        body.map_err(|_| ApiError::InvalidInput)?.0,
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}
