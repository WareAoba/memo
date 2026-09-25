use crate::{
    AppState,
    services::{Result, unmanaged_presets},
};
use axum::{
    Json,
    extract::{Path, Query, State, rejection::QueryRejection},
};
use serde::Deserialize;
use serde_json::Value;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct QueryInput {
    q: String,
}
pub async fn suggestions(
    State(state): State<AppState>,
    Path(kind): Path<String>,
    query: std::result::Result<Query<QueryInput>, QueryRejection>,
) -> Result<Json<Value>> {
    let Query(q) = query.map_err(|_| crate::errors::ApiError::InvalidInput)?;
    unmanaged_presets::suggestions(&state.pool, &kind, &q.q)
        .await
        .map(Json)
}
