use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("Request origin is not allowed")]
    Forbidden,
    #[error("Upload capacity exceeded")]
    UploadBusy,
    #[error("Photo storage limit exceeded")]
    PhotoStorageFull,
    #[error("Upload body timed out")]
    UploadTimeout,
    #[error("Push unavailable")]
    PushUnavailable,
    #[error("Schedule list changed")]
    ScheduleListChanged,
    #[error("Photo too large")]
    PhotoTooLarge,
    #[error("Execution target not found")]
    ExecutionNotFound,
    #[error("Required items incomplete")]
    RequirementsIncomplete,
    #[error("Execution is locked")]
    ExecutionLocked,
    #[error("Schedule not found")]
    ScheduleNotFound,
    #[error("Invalid input")]
    InvalidInput,
    #[error("Work not found")]
    WorkNotFound,
    #[error("Task preset not found")]
    TaskPresetNotFound,
    #[error("Database unavailable")]
    DatabaseUnavailable,
    #[error("Endpoint not found")]
    NotFound,
    #[error("Method not allowed")]
    MethodNotAllowed,
}

#[derive(Serialize)]
struct ErrorEnvelope {
    error: ErrorBody,
}

#[derive(Serialize)]
struct ErrorBody {
    code: &'static str,
    message: &'static str,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code, message) = match self {
            Self::Forbidden => (
                StatusCode::FORBIDDEN,
                "FORBIDDEN",
                "Request origin is not allowed",
            ),
            Self::UploadBusy => (
                StatusCode::TOO_MANY_REQUESTS,
                "UPLOAD_BUSY",
                "Retry the upload later",
            ),
            Self::PhotoStorageFull => (
                StatusCode::INSUFFICIENT_STORAGE,
                "PHOTO_STORAGE_FULL",
                "Photo storage limit reached",
            ),
            Self::UploadTimeout => (
                StatusCode::REQUEST_TIMEOUT,
                "UPLOAD_TIMEOUT",
                "Upload body timed out",
            ),
            Self::PushUnavailable => (
                StatusCode::SERVICE_UNAVAILABLE,
                "PUSH_UNAVAILABLE",
                "Push is not configured",
            ),
            Self::ScheduleListChanged => (
                StatusCode::CONFLICT,
                "SCHEDULE_LIST_CHANGED",
                "Reload the schedule list",
            ),
            Self::PhotoTooLarge => (
                StatusCode::PAYLOAD_TOO_LARGE,
                "PHOTO_TOO_LARGE",
                "Photos must not exceed 10 MiB",
            ),
            Self::ExecutionNotFound => (
                StatusCode::NOT_FOUND,
                "EXECUTION_NOT_FOUND",
                "Execution target not found",
            ),
            Self::RequirementsIncomplete => (
                StatusCode::CONFLICT,
                "REQUIREMENTS_INCOMPLETE",
                "Complete all required items first",
            ),
            Self::ExecutionLocked => (
                StatusCode::CONFLICT,
                "EXECUTION_LOCKED",
                "Restore or resume the schedule first",
            ),
            Self::ScheduleNotFound => (
                StatusCode::NOT_FOUND,
                "SCHEDULE_NOT_FOUND",
                "Schedule not found",
            ),
            Self::InvalidInput => (
                StatusCode::BAD_REQUEST,
                "INVALID_INPUT",
                "Check the request fields and values",
            ),
            Self::WorkNotFound => (StatusCode::NOT_FOUND, "ENTITY_NOT_FOUND", "Work not found"),
            Self::TaskPresetNotFound => (
                StatusCode::NOT_FOUND,
                "TASK_PRESET_NOT_FOUND",
                "Task preset not found",
            ),
            Self::DatabaseUnavailable => (
                StatusCode::SERVICE_UNAVAILABLE,
                "DATABASE_UNAVAILABLE",
                "The service is temporarily unavailable",
            ),
            Self::NotFound => (StatusCode::NOT_FOUND, "NOT_FOUND", "Endpoint not found"),
            Self::MethodNotAllowed => (
                StatusCode::METHOD_NOT_ALLOWED,
                "METHOD_NOT_ALLOWED",
                "Method not allowed",
            ),
        };
        (
            status,
            Json(ErrorEnvelope {
                error: ErrorBody { code, message },
            }),
        )
            .into_response()
    }
}
