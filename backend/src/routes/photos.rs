use crate::{
    AppState,
    errors::ApiError,
    services::{
        Result,
        photos::{self, Target},
    },
};
use axum::{
    Json,
    body::to_bytes,
    extract::{Path, Query, Request, State, rejection::QueryRejection},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
fn query(value: std::result::Result<Query<Target>, QueryRejection>) -> Result<Target> {
    value.map(|Query(q)| q).map_err(|_| ApiError::InvalidInput)
}
pub async fn list(
    State(state): State<AppState>,
    q: std::result::Result<Query<Target>, QueryRejection>,
) -> Result<Json<Vec<photos::Photo>>> {
    photos::list(&state.pool, query(q)?).await.map(Json)
}
pub async fn upload(
    State(state): State<AppState>,
    q: std::result::Result<Query<Target>, QueryRejection>,
    request: Request,
) -> Result<(StatusCode, Json<photos::Photo>)> {
    // Admit before polling the body; never queue fully buffered uploads.
    let permit = std::sync::Arc::new(
        state
            .uploads
            .clone()
            .try_acquire_owned()
            .map_err(|_| ApiError::UploadBusy)?,
    );
    let query = query(q)?;
    let mime = request
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .ok_or(ApiError::InvalidInput)?
        .to_owned();
    photos::preflight(&state.pool, &query, &mime).await?;
    let bytes = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        to_bytes(request.into_body(), photos::MAX_SIZE),
    )
    .await
    .map_err(|_| ApiError::UploadTimeout)?
    .map_err(|error| {
        use std::error::Error;
        if error
            .source()
            .is_some_and(|source| source.is::<http_body_util::LengthLimitError>())
        {
            ApiError::PhotoTooLarge
        } else {
            ApiError::InvalidInput
        }
    })?;
    Ok((
        StatusCode::CREATED,
        Json(photos::upload(&state.pool, &state.photo_dir, query, &mime, &bytes, permit).await?),
    ))
}
pub async fn get(State(state): State<AppState>, Path(id): Path<String>) -> Result<Response> {
    let photo = photos::get(&state.pool, &id).await?;
    let bytes = tokio::fs::read(photo.path(&state.photo_dir)?)
        .await
        .map_err(|_| ApiError::DatabaseUnavailable)?;
    Ok((
        [
            (header::CONTENT_TYPE, photo.mime_type.as_str()),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff"),
            (header::CONTENT_DISPOSITION, "inline"),
            (
                header::CONTENT_SECURITY_POLICY,
                "default-src 'none'; sandbox",
            ),
        ],
        bytes,
    )
        .into_response())
}
pub async fn delete(State(state): State<AppState>, Path(id): Path<String>) -> Result<StatusCode> {
    photos::delete(&state.pool, &state.photo_dir, &id).await?;
    Ok(StatusCode::NO_CONTENT)
}
