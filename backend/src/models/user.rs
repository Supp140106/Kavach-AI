// src/models/user.rs
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Row as stored in / read from Postgres.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: Option<String>,
    pub password_hash: Option<String>,
    pub google_id: Option<String>,
    pub name: Option<String>,
    pub picture: Option<String>,
    pub role: String,
    pub official_id: Option<String>,
    pub location: Option<String>,
    pub phone: Option<String>,
    pub is_approved: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Safe-to-serialize view of a user, returned to the frontend.
#[derive(Debug, Serialize, Clone)]
pub struct UserResponse {
    pub id: Uuid,
    pub username: String,
    pub email: Option<String>,
    pub name: String,
    pub picture: Option<String>,
    pub role: String,
    #[serde(rename = "isApproved")]
    pub is_approved: bool,
}

impl From<User> for UserResponse {
    fn from(u: User) -> Self {
        let name = u.name.clone().unwrap_or_else(|| u.username.clone());
        Self {
            id: u.id,
            username: u.username,
            email: u.email,
            name,
            picture: u.picture,
            role: u.role,
            is_approved: u.is_approved,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub email: Option<String>,
    pub password: Option<String>,
    #[serde(default = "default_role")]
    pub role: String,
    pub location: Option<String>,
    pub phone: Option<String>,
    #[serde(alias = "officialId")]
    pub official_id: Option<String>,
}

fn default_role() -> String {
    "user".to_string()
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct GoogleLoginRequest {
    /// The Google ID token (JWT credential) issued by Google Identity Services
    /// on the frontend (`credentialResponse.credential`).
    pub token: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

/// JWT claims embedded in the token we issue to the client.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    /// Subject - user id
    pub sub: String,
    pub username: String,
    pub role: String,
    /// Issued-at (unix seconds)
    pub iat: i64,
    /// Expiry (unix seconds)
    pub exp: i64,
}

/// Payload returned by Google's tokeninfo endpoint after we validate the
/// ID token the client sent us.
#[derive(Debug, Deserialize)]
pub struct GoogleTokenInfo {
    pub aud: String,
    pub sub: String,
    pub email: Option<String>,
    #[serde(default)]
    pub email_verified: Option<String>,
    pub name: Option<String>,
    pub picture: Option<String>,
    pub exp: String,
}