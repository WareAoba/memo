use crate::{AppState, errors::ApiError, services::tracks};
use axum::{
    Json,
    extract::{Path, Request, State, rejection::JsonRejection},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};

pub async fn scope(State(state): State<AppState>, request: Request, next: Next) -> Response {
    let path = request.uri().path();
    if path.starts_with("/api/push/")
        || matches!(
            path,
            "/api/reminders" | "/api/settings" | "/api/settings/bootstrap" | "/api/local-user"
        )
    {
        return next.run(request).await;
    }
    let value = match request
        .headers()
        .get("x-track-id")
        .map(|v| v.to_str())
        .transpose()
    {
        Ok(value) => value,
        Err(_) => return ApiError::InvalidInput.into_response(),
    };
    // Image elements cannot set headers; only individual photo GETs accept this selector.
    let photo_track =
        if request.method() == axum::http::Method::GET && path.starts_with("/api/photos/") {
            request
                .uri()
                .query()
                .and_then(|q| q.split('&').find_map(|p| p.strip_prefix("track_id=")))
        } else {
            None
        };
    match tracks::resolve(&state.pool, value.or(photo_track)).await {
        Ok(id) => tracks::CURRENT_TRACK.scope(id, next.run(request)).await,
        Err(error) => error.into_response(),
    }
}

pub async fn list(State(state): State<AppState>) -> Result<Json<serde_json::Value>, ApiError> {
    tracks::list(&state.pool).await.map(Json)
}
pub async fn create(
    State(state): State<AppState>,
    body: Result<Json<tracks::Input>, JsonRejection>,
) -> Result<(StatusCode, Json<tracks::Track>), ApiError> {
    Ok((
        StatusCode::CREATED,
        Json(tracks::create(&state.pool, body.map_err(|_| ApiError::InvalidInput)?.0).await?),
    ))
}
pub async fn rename(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Result<Json<tracks::Input>, JsonRejection>,
) -> Result<Json<tracks::Track>, ApiError> {
    tracks::rename(
        &state.pool,
        &id,
        body.map_err(|_| ApiError::InvalidInput)?.0,
    )
    .await
    .map(Json)
}
