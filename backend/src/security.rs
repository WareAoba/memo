//! Browser request boundary for the local app; this is not authentication.
use crate::errors::ApiError;
use axum::{
    extract::{Request, State},
    http::{HeaderValue, header},
    middleware::Next,
    response::{IntoResponse, Response},
};

#[derive(Clone, Debug)]
pub struct RequestPolicy {
    origins: Vec<reqwest::Url>,
}

impl RequestPolicy {
    pub fn parse(value: &str) -> Result<Self, &'static str> {
        let origins = value
            .split(',')
            .map(|value| {
                let url = reqwest::Url::parse(value.trim()).map_err(|_| "Invalid APP_ORIGINS")?;
                if !matches!(url.scheme(), "http" | "https")
                    || url.host_str().is_none()
                    || !url.username().is_empty()
                    || url.password().is_some()
                    || url.path() != "/"
                    || url.query().is_some()
                    || url.fragment().is_some()
                {
                    return Err("APP_ORIGINS must contain exact HTTP(S) origins");
                }
                Ok(url)
            })
            .collect::<Result<Vec<_>, _>>()?;
        Ok(Self { origins })
    }

    fn permits(&self, request: &Request) -> bool {
        let headers = request.headers();
        // Reject ambiguous headers and never trust client-supplied forwarding headers.
        if headers.get_all(header::HOST).iter().count() > 1
            || headers.get_all(header::ORIGIN).iter().count() > 1
        {
            return false;
        }
        let host = headers
            .get(header::HOST)
            .and_then(|v| v.to_str().ok())
            .or_else(|| request.uri().authority().map(|a| a.as_str()));
        let Some(host) = host else {
            return false;
        };
        let matches_host = |url: &reqwest::Url| {
            let origin = url.origin().ascii_serialization();
            let authority = origin
                .split_once("://")
                .map_or("", |(_, authority)| authority);
            host.eq_ignore_ascii_case(authority)
        };
        if !self.origins.iter().any(matches_host) {
            return false;
        }
        if request
            .uri()
            .authority()
            .is_some_and(|a| !a.as_str().eq_ignore_ascii_case(host))
        {
            return false;
        }
        if let Some(site) = headers.get("sec-fetch-site")
            && site != "same-origin"
            && site != "none"
        {
            return false;
        }
        if let Some(origin) = headers.get(header::ORIGIN) {
            let Ok(origin) = origin.to_str() else {
                return false;
            };
            return self
                .origins
                .iter()
                .any(|url| origin == url.origin().ascii_serialization() && matches_host(url));
        }
        // Fetch metadata is absent for CLI clients. Browser writes must carry Origin.
        !headers.contains_key("sec-fetch-site")
            || matches!(
                *request.method(),
                axum::http::Method::GET | axum::http::Method::HEAD | axum::http::Method::OPTIONS
            )
    }
}

impl Default for RequestPolicy {
    fn default() -> Self {
        Self::parse("http://localhost:3000,http://127.0.0.1:3000,http://[::1]:3000,http://localhost:15173,http://127.0.0.1:15173,http://[::1]:15173,http://localhost:8080,http://127.0.0.1:8080,http://[::1]:8080,http://127.0.0.1").expect("fixed local origins")
    }
}

pub async fn protect(
    State(policy): State<RequestPolicy>,
    request: Request,
    next: Next,
) -> Response {
    let mut response = if policy.permits(&request) {
        next.run(request).await
    } else {
        ApiError::Forbidden.into_response()
    };
    let headers = response.headers_mut();
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));
    headers
        .entry(header::CONTENT_SECURITY_POLICY)
        .or_insert(HeaderValue::from_static("frame-ancestors 'none'"));
    response
}
