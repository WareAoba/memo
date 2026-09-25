use axum::{Json, extract::State};
use serde::Serialize;
use std::time::Duration;

use crate::{AppState, errors::ApiError};

#[derive(Serialize)]
pub struct HealthResponse {
    status: &'static str,
}

pub async fn health(State(state): State<AppState>) -> Result<Json<HealthResponse>, ApiError> {
    match tokio::time::timeout(
        Duration::from_secs(2),
        sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(&state.pool),
    )
    .await
    {
        Ok(Ok(1)) => Ok(Json(HealthResponse { status: "ok" })),
        Ok(Err(error)) => {
            tracing::error!(event = "health_database_failure", error = %error, "Database readiness failed");
            Err(ApiError::DatabaseUnavailable)
        }
        _ => {
            tracing::error!(
                event = "health_database_timeout",
                "Database readiness timed out"
            );
            Err(ApiError::DatabaseUnavailable)
        }
    }
}
