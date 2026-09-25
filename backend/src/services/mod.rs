pub mod execution;
pub mod schedule_deletion;
pub mod settings;
mod task_parameters;
pub mod task_presets;
pub mod work_tasks;
pub mod works;

use crate::errors::ApiError;
use serde::Deserialize;
use uuid::Uuid;

pub type Result<T> = std::result::Result<T, ApiError>;

fn invalid() -> ApiError {
    ApiError::InvalidInput
}
fn database(_: sqlx::Error) -> ApiError {
    tracing::error!(
        event = "database_operation_failed",
        "Database operation failed"
    );
    ApiError::DatabaseUnavailable
}
fn identifier(id: &str) -> Result<String> {
    Uuid::parse_str(id)
        .map(|v| v.to_string())
        .map_err(|_| invalid())
}

#[derive(Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct ListQuery {
    q: String,
    group_name: Option<String>,
    archived: bool,
    limit: Option<i64>,
    offset: i64,
}
impl ListQuery {
    fn search(&self) -> Result<String> {
        if !(1..=100).contains(&self.limit.unwrap_or(20))
            || !(0..=1_000_000).contains(&self.offset)
            || self.q.chars().count() > 200
        {
            return Err(invalid());
        }
        Ok(format!(
            "%{}%",
            self.q
                .trim()
                .replace('!', "!!")
                .replace('%', "!%")
                .replace('_', "!_")
        ))
    }
}

pub mod schedules;

pub mod photos;
