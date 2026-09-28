use crate::{AppState, errors::ApiError, local_user::current_user_id, push};
use axum::{
    Json,
    extract::{Path, Query, State, rejection::JsonRejection},
    http::StatusCode,
};
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Default, Deserialize)]
pub struct ConfigQuery {
    installation_id: Option<String>,
}
pub async fn config(
    State(state): State<AppState>,
    Query(query): Query<ConfigQuery>,
) -> push::Result<Json<Value>> {
    let subscribed = push::is_subscribed(
        &state.pool,
        &current_user_id(),
        query.installation_id.as_deref(),
    )
    .await?;
    Ok(Json(
        json!({"enabled":state.push.is_some(),"public_key":state.push.as_ref().map(|p| &p.public_key),"subscribed":subscribed}),
    ))
}
pub async fn subscribe(
    State(state): State<AppState>,
    body: Result<Json<push::Registration>, JsonRejection>,
) -> push::Result<Json<Value>> {
    if state.push.is_none() {
        return Err(ApiError::PushUnavailable);
    }
    push::register(
        &state.pool,
        &current_user_id(),
        body.map_err(|_| ApiError::InvalidInput)?.0,
    )
    .await
    .map(Json)
}
pub async fn unsubscribe(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> push::Result<StatusCode> {
    push::unregister(&state.pool, &current_user_id(), &id).await?;
    Ok(StatusCode::NO_CONTENT)
}
pub async fn presence(
    State(state): State<AppState>,
    body: Result<Json<push::Presence>, JsonRejection>,
) -> push::Result<Json<Value>> {
    push::presence(
        &state.pool,
        &current_user_id(),
        body.map_err(|_| ApiError::InvalidInput)?.0,
    )
    .await
    .map(Json)
}
