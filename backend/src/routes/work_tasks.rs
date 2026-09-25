use crate::{
    AppState,
    errors::ApiError,
    services::{Result, work_tasks as service},
};
use axum::{
    Json,
    extract::{Path, State, rejection::JsonRejection},
};
use serde_json::Value;
pub async fn get(State(state): State<AppState>, Path(id): Path<String>) -> Result<Json<Value>> {
    service::get(&state.pool, &id).await.map(Json)
}
pub async fn replace(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: std::result::Result<Json<Value>, JsonRejection>,
) -> Result<Json<Value>> {
    let Json(value) = body.map_err(|_| ApiError::InvalidInput)?;
    service::replace(&state.pool, &id, value).await.map(Json)
}
