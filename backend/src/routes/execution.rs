use crate::{
    AppState,
    errors::ApiError,
    services::{Result, execution},
};
use axum::{
    Json,
    extract::{Path, State, rejection::JsonRejection},
};
use serde_json::{Value, json};
type Body = std::result::Result<Json<Value>, JsonRejection>;
pub async fn task(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Body,
) -> Result<Json<Value>> {
    execution::task(
        &state.pool,
        &id,
        body.map_err(|_| ApiError::InvalidInput)?.0,
    )
    .await
    .map(Json)
}
pub async fn item(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Body,
) -> Result<Json<Value>> {
    execution::item(
        &state.pool,
        &id,
        body.map_err(|_| ApiError::InvalidInput)?.0,
    )
    .await
    .map(Json)
}
pub async fn status(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Body,
) -> Result<Json<Value>> {
    execution::schedule_status(
        &state.pool,
        &id,
        body.map_err(|_| ApiError::InvalidInput)?.0,
    )
    .await
    .map(Json)
}
async fn action(state: AppState, id: String, body: Body, status: &str) -> Result<Json<Value>> {
    if body.map_err(|_| ApiError::InvalidInput)?.0 != json!({}) {
        return Err(ApiError::InvalidInput);
    }
    execution::task(&state.pool, &id, json!({"status":status}))
        .await
        .map(Json)
}
pub async fn start(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Body,
) -> Result<Json<Value>> {
    action(state, id, body, "in_progress").await
}
pub async fn complete(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Body,
) -> Result<Json<Value>> {
    action(state, id, body, "completed").await
}

pub async fn complete_schedule(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Body,
) -> Result<Json<Value>> {
    execution::complete_schedule(
        &state.pool,
        &id,
        body.map_err(|_| ApiError::InvalidInput)?.0,
    )
    .await
    .map(Json)
}
pub async fn add_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Body,
) -> Result<Json<Value>> {
    execution::add_task(
        &state.pool,
        &id,
        body.map_err(|_| ApiError::InvalidInput)?.0,
    )
    .await
    .map(Json)
}

pub async fn reopen_schedule(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Body,
) -> Result<Json<Value>> {
    execution::reopen_schedule(
        &state.pool,
        &id,
        body.map_err(|_| ApiError::InvalidInput)?.0,
    )
    .await
    .map(Json)
}
pub async fn delete_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    crate::services::schedule_deletion::delete(&state.pool, &state.photo_dir, &id, true)
        .await?
        .map(Json)
        .ok_or(ApiError::ExecutionNotFound)
}
