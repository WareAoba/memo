use crate::{AppState, errors::ApiError};
use axum::{
    Json,
    extract::{Request, State},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde::Serialize;

/// Server configuration only. Never select an identity from request headers or bodies.
#[derive(Clone, Debug)]
pub enum AuthMode {
    Virtual,
    Disabled,
}

impl AuthMode {
    pub fn parse(value: &str) -> Result<Self, &'static str> {
        match value {
            "virtual" => Ok(Self::Virtual),
            "disabled" => Ok(Self::Disabled),
            _ => Err("AUTH_MODE must be virtual or disabled"),
        }
    }
}

#[derive(Clone, Serialize, sqlx::FromRow)]
pub struct Account {
    pub id: String,
    pub display_name: String,
    pub email: Option<String>,
}

tokio::task_local! { static CURRENT_ACCOUNT: Account; }

// No global/default owner fallback: services must run inside an authenticated request.
pub(crate) fn current_user_id() -> String {
    CURRENT_ACCOUNT.with(|user| user.id.clone())
}

pub async fn protect(
    State((state, mode)): State<(AppState, AuthMode)>,
    request: Request,
    next: Next,
) -> Response {
    let account = match mode {
        AuthMode::Disabled => return ApiError::Unauthorized.into_response(),
        AuthMode::Virtual => sqlx::query_as::<_, Account>("SELECT u.id,u.display_name,u.email FROM users u JOIN auth_identities a ON a.user_id=u.id WHERE a.issuer='urn:preset:virtual' AND a.subject='local'")
            .fetch_optional(&state.pool).await,
    };
    match account {
        Ok(Some(account)) => CURRENT_ACCOUNT.scope(account, next.run(request)).await,
        Ok(None) => ApiError::Unauthorized.into_response(),
        Err(_) => ApiError::DatabaseUnavailable.into_response(),
    }
}

pub async fn me() -> Json<serde_json::Value> {
    Json(CURRENT_ACCOUNT.with(|account| serde_json::json!({"user": account, "mode": "virtual"})))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn overlapping_requests_never_share_identity_and_scope_does_not_leak() {
        async fn request(id: &str) {
            let account = Account {
                id: id.into(),
                display_name: id.into(),
                email: None,
            };
            CURRENT_ACCOUNT
                .scope(account, async {
                    for _ in 0..20 {
                        tokio::task::yield_now().await;
                        assert_eq!(current_user_id(), id);
                    }
                })
                .await;
        }
        tokio::join!(request("first"), request("second"));
        assert!(CURRENT_ACCOUNT.try_with(|_| ()).is_err());
    }
}
