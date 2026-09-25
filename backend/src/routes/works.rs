use crate::{
    AppState,
    errors::ApiError,
    services::{ListQuery, Result, works as service},
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
pub async fn archive(State(state): State<AppState>, Path(id): Path<String>) -> Result<StatusCode> {
    service::archive(&state.pool, &id).await?;
    Ok(StatusCode::NO_CONTENT)
}
pub async fn list(
    State(state): State<AppState>,
    query: std::result::Result<Query<ListQuery>, QueryRejection>,
) -> Result<Json<Value>> {
    let Query(query) = query.map_err(|_| ApiError::InvalidInput)?;
    service::list(&state.pool, query).await.map(Json)
}

pub async fn local_user(
    State(state): State<AppState>,
    body: std::result::Result<Json<service::TimeZoneInput>, JsonRejection>,
) -> Result<Json<Value>> {
    let Json(input) = body.map_err(|_| ApiError::InvalidInput)?;
    service::local_user(&state.pool, input).await.map(Json)
}

pub async fn field_names(State(state): State<AppState>) -> Result<Json<Value>> {
    service::field_names(&state.pool).await.map(Json)
}
