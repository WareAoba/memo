use crate::{
    AppState,
    errors::ApiError,
    services::{
        Result,
        schedules::{self as service, ListQuery},
    },
};
use axum::{
    Json,
    extract::{
        Path, Query, State,
        rejection::{JsonRejection, QueryRejection},
    },
    http::StatusCode,
};
use serde_json::Value;

pub async fn create(
    State(state): State<AppState>,
    body: std::result::Result<Json<Value>, JsonRejection>,
) -> Result<(StatusCode, Json<Value>)> {
    let Json(value) = body.map_err(|_| ApiError::InvalidInput)?;
    Ok((
        StatusCode::CREATED,
        Json(service::create(&state.pool, value).await?),
    ))
}
pub async fn get(State(state): State<AppState>, Path(id): Path<String>) -> Result<Json<Value>> {
    service::get(&state.pool, &id).await.map(Json)
}
pub async fn patch(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: std::result::Result<Json<Value>, JsonRejection>,
) -> Result<Json<Value>> {
    let Json(value) = body.map_err(|_| ApiError::InvalidInput)?;
    service::patch(&state.pool, &id, value).await.map(Json)
}
pub async fn list(
    State(state): State<AppState>,
    query: std::result::Result<Query<ListQuery>, QueryRejection>,
) -> Result<Json<Value>> {
    let Query(query) = query.map_err(|_| ApiError::InvalidInput)?;
    service::list(&state.pool, query).await.map(Json)
}

pub async fn reminders(State(state): State<AppState>) -> Result<Json<Value>> {
    service::reminders(&state.pool).await.map(Json)
}

pub async fn delete(State(state): State<AppState>, Path(id): Path<String>) -> Result<StatusCode> {
    crate::services::schedule_deletion::delete(&state.pool, &state.photo_dir, &id, false).await?;
    Ok(StatusCode::NO_CONTENT)
}
