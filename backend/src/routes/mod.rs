mod execution;
pub(crate) mod health;
mod photos;
mod push;
mod schedules;
mod settings;
mod task_presets;
pub(crate) mod tracks;
mod unmanaged_presets;
mod works;

use axum::{Router, routing::get};

use crate::{AppState, errors::ApiError};

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/api/unmanaged-presets/{kind}",
            get(unmanaged_presets::suggestions),
        )
        .route("/api/settings", get(settings::get).patch(settings::patch))
        .route(
            "/api/settings/bootstrap",
            axum::routing::post(settings::bootstrap),
        )
        .route("/api/settings/reset", axum::routing::post(settings::reset))
        .route("/api/push/config", get(push::config))
        .route(
            "/api/push/subscriptions",
            axum::routing::post(push::subscribe),
        )
        .route(
            "/api/push/subscriptions/{id}",
            axum::routing::delete(push::unsubscribe),
        )
        .route("/api/push/presence", axum::routing::post(push::presence))
        .route(
            "/api/schedules/{id}/reopen",
            axum::routing::post(execution::reopen_schedule),
        )
        .route("/api/reminders", get(schedules::reminders))
        .route("/api/work-field-names", get(works::field_names))
        .route("/api/task-groups", get(task_presets::groups))
        .route(
            "/api/schedules/{id}/complete",
            axum::routing::post(execution::complete_schedule),
        )
        .route(
            "/api/schedules/{id}/tasks",
            axum::routing::post(execution::add_task),
        )
        .route(
            "/api/photos",
            get(photos::list)
                .post(photos::upload)
                .layer(axum::extract::DefaultBodyLimit::max(10 * 1024 * 1024)),
        )
        .route("/api/photos/{id}", get(photos::get).delete(photos::delete))
        .route(
            "/api/schedule-tasks/{id}",
            axum::routing::patch(execution::task).delete(execution::delete_task),
        )
        .route(
            "/api/schedule-tasks/{id}/start",
            axum::routing::post(execution::start),
        )
        .route(
            "/api/schedule-tasks/{id}/complete",
            axum::routing::post(execution::complete),
        )
        .route(
            "/api/schedule-task-items/{id}",
            axum::routing::patch(execution::item),
        )
        .route(
            "/api/schedules/{id}/status",
            axum::routing::patch(execution::status),
        )
        .route(
            "/api/schedules",
            get(schedules::list).post(schedules::create),
        )
        .route(
            "/api/schedules/{id}",
            get(schedules::get)
                .patch(schedules::patch)
                .delete(schedules::delete),
        )
        .route(
            "/api/task-presets",
            get(task_presets::list).post(task_presets::create),
        )
        .route(
            "/api/task-presets/{id}",
            get(task_presets::get).patch(task_presets::patch),
        )
        .route("/api/entities", get(works::list).post(works::create))
        .route("/api/entities/{id}", get(works::get).patch(works::patch))
        .route("/api/local-user", axum::routing::post(works::local_user))
        .layer(axum::middleware::from_fn_with_state(state, tracks::scope))
        .route("/api/tracks", get(tracks::list).post(tracks::create))
        .route("/api/tracks/{id}", axum::routing::patch(tracks::rename))
        .fallback(|| async { ApiError::NotFound })
        .method_not_allowed_fallback(|| async { ApiError::MethodNotAllowed })
}
