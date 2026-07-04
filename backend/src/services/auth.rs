// src/services/auth.rs
use anyhow::{anyhow, Result};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};

use crate::models::user::{Claims, GoogleTokenInfo, User};

const TOKEN_TTL_DAYS: i64 = 7;

// ---------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------

pub fn hash_password(password: &str) -> Result<String> {
    bcrypt::hash(password, bcrypt::DEFAULT_COST).map_err(|e| anyhow!("failed to hash password: {e}"))
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool> {
    bcrypt::verify(password, hash).map_err(|e| anyhow!("failed to verify password: {e}"))
}

// ---------------------------------------------------------------------
// JWT issuing / verification
// ---------------------------------------------------------------------

pub fn issue_token(user: &User, jwt_secret: &str) -> Result<String> {
    let now = Utc::now();
    let claims = Claims {
        sub: user.id.to_string(),
        username: user.username.clone(),
        role: user.role.clone(),
        iat: now.timestamp(),
        exp: (now + Duration::days(TOKEN_TTL_DAYS)).timestamp(),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_bytes()),
    )
    .map_err(|e| anyhow!("failed to issue token: {e}"))
}

pub fn verify_token(token: &str, jwt_secret: &str) -> Result<Claims> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|e| anyhow!("invalid token: {e}"))?;
    Ok(data.claims)
}

// ---------------------------------------------------------------------
// Google ID token verification
// ---------------------------------------------------------------------

/// Verifies a Google "ID token" (the `credential` returned by Google
/// Identity Services on the frontend) by asking Google's tokeninfo
/// endpoint to validate the signature/expiry for us, then checks that the
/// token was issued for *our* OAuth client (the `aud` claim).
pub async fn verify_google_id_token(
    http_client: &reqwest::Client,
    id_token: &str,
    expected_client_id: &str,
) -> Result<GoogleTokenInfo> {
    if expected_client_id.trim().is_empty() {
        return Err(anyhow!("Google auth is not configured on the server"));
    }

    let url = format!(
        "https://oauth2.googleapis.com/tokeninfo?id_token={}",
        id_token
    );

    let resp = http_client
        .get(&url)
        .send()
        .await
        .map_err(|e| anyhow!("failed to reach Google: {e}"))?;

    if !resp.status().is_success() {
        return Err(anyhow!("Google rejected the id token"));
    }

    let info: GoogleTokenInfo = resp
        .json()
        .await
        .map_err(|e| anyhow!("unexpected response from Google: {e}"))?;

    if info.aud != expected_client_id {
        return Err(anyhow!("token was not issued for this application"));
    }

    let exp: i64 = info
        .exp
        .parse()
        .map_err(|_| anyhow!("malformed expiry in Google token"))?;
    if exp < Utc::now().timestamp() {
        return Err(anyhow!("Google token has expired"));
    }

    Ok(info)
}