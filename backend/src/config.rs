use std::{env, net::SocketAddr, path::PathBuf};

#[derive(Debug)]
pub struct Config {
    pub auth_mode: crate::auth::AuthMode,
    pub bind_address: SocketAddr,
    pub database_path: PathBuf,
    pub photo_dir: PathBuf,
    pub request_policy: crate::security::RequestPolicy,
}

impl Config {
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        let bind_address = env::var("BIND_ADDRESS")
            .unwrap_or_else(|_| "127.0.0.1:3000".into())
            .parse()?;
        let database_path = PathBuf::from(
            env::var("DATABASE_PATH").unwrap_or_else(|_| "data/database/app.sqlite3".into()),
        );
        if database_path.as_os_str().is_empty() {
            return Err("DATABASE_PATH must not be empty".into());
        }
        Ok(Self {
            auth_mode: crate::auth::AuthMode::parse(
                &env::var("AUTH_MODE").unwrap_or_else(|_| "virtual".into()),
            )?,
            bind_address,
            request_policy: match env::var("APP_ORIGINS") {
                Ok(value) => crate::security::RequestPolicy::parse(&value)?,
                Err(env::VarError::NotPresent) => crate::security::RequestPolicy::default(),
                Err(error) => return Err(error.into()),
            },
            database_path,
            photo_dir: PathBuf::from(
                env::var("PHOTO_DIR").unwrap_or_else(|_| "data/photos".into()),
            ),
        })
    }
}
