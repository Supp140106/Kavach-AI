// src/routes/auth.rs
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::models::user::{
    AuthResponse, GoogleLoginRequest, LoginRequest, RegisterRequest, UserResponse,
};
use crate::services::auth as auth_service;
use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/google-login", post(google_login))
        .with_state(state)
}

/// Extracts a bearer token from the `Authorization` header, if present.
fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
}

/// Health check. Also doubles as a lightweight "who am I" endpoint: if a
/// valid bearer token is supplied, the current user is included in the
/// response (this is what the frontend's `AuthContext` polls on load).
async fn health(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Json<Value> {
    let mut body = json!({
        "status": "healthy",
        "service": "VARUNA Rust Backend",
        "version": "1.0.0"
    });

    if let Some(token) = bearer_token(&headers) {
        if let Ok(claims) = auth_service::verify_token(token, &state.jwt_secret) {
            if let Ok(Some(user)) = state
                .users
                .find_by_id(claims.sub.parse().unwrap_or_default())
                .await
            {
                let user_response: UserResponse = user.into();
                body["user"] = json!(user_response);
            }
        }
    }

    Json(body)
}

/// Username/password registration.
async fn register(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<Value>)> {
    if payload.username.trim().is_empty() {
        return Err(bad_request("Username is required"));
    }

    let is_official = payload.role != "user";
    if is_official && payload.official_id.as_deref().unwrap_or("").is_empty() {
        return Err(bad_request("Official ID is required for this role"));
    }

    let password = if is_official {
        None
    } else {
        match payload.password.as_deref() {
            Some(p) if !p.is_empty() => Some(p),
            _ => return Err(bad_request("Password is required for regular users")),
        }
    };

    if let Some(email) = payload.email.as_deref() {
        if state
            .users
            .find_by_email(email)
            .await
            .map_err(internal_error)?
            .is_some()
        {
            return Err(bad_request("Email already registered"));
        }
    }

    if state
        .users
        .find_by_username(&payload.username)
        .await
        .map_err(internal_error)?
        .is_some()
    {
        return Err(bad_request("Username already taken"));
    }

    // Officials/NGOs/DDMO accounts require admin approval before they can log in.
    let is_approved = !is_official;

    let password_hash = match password {
        Some(p) => auth_service::hash_password(p).map_err(internal_error)?,
        // Officials without a password (approval-gated accounts) get a
        // random, unusable hash placeholder until password auth is added
        // for them separately.
        None => auth_service::hash_password(&uuid::Uuid::new_v4().to_string())
            .map_err(internal_error)?,
    };

    let user = state
        .users
        .create_local_user(
            &payload.username,
            payload.email.as_deref(),
            &password_hash,
            &payload.role,
            payload.location.as_deref(),
            payload.phone.as_deref(),
            payload.official_id.as_deref(),
            is_approved,
        )
        .await
        .map_err(internal_error)?;

    if !user.is_approved {
        return Ok(Json(AuthResponse {
            token: String::new(),
            user: user.into(),
        }));
    }

    let token = auth_service::issue_token(&user, &state.jwt_secret).map_err(internal_error)?;
    Ok(Json(AuthResponse {
        token,
        user: user.into(),
    }))
}

/// Username/password login.
async fn login(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<Value>)> {
    let user = state
        .users
        .find_by_username(&payload.username)
        .await
        .map_err(internal_error)?
        .ok_or_else(|| not_found("User not found"))?;

    if !user.is_approved {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "message": "Account pending admin approval" })),
        ));
    }

    let hash = user
        .password_hash
        .as_deref()
        .ok_or_else(|| bad_request("This account has no password set. Try Google sign-in."))?;

    let matches = auth_service::verify_password(&payload.password, hash).map_err(internal_error)?;
    if !matches {
        return Err(bad_request("Invalid credentials"));
    }

    let token = auth_service::issue_token(&user, &state.jwt_secret).map_err(internal_error)?;
    Ok(Json(AuthResponse {
        token,
        user: user.into(),
    }))
}

/// Google Sign-In: verifies the ID token issued by Google Identity Services
/// on the frontend, then finds-or-creates the corresponding local user and
/// issues our own JWT for subsequent API calls.
async fn google_login(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<GoogleLoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<Value>)> {
    let info = auth_service::verify_google_id_token(
        &state.http_client,
        &payload.token,
        &state.google_client_id,
    )
    .await
    .map_err(|e| {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "message": format!("Google authentication failed: {e}") })),
        )
    })?;

    // 1) Already linked to this Google account -> just log them in.
    if let Some(user) = state
        .users
        .find_by_google_id(&info.sub)
        .await
        .map_err(internal_error)?
    {
        let token = auth_service::issue_token(&user, &state.jwt_secret).map_err(internal_error)?;
        return Ok(Json(AuthResponse {
            token,
            user: user.into(),
        }));
    }

    // 2) An account with this email already exists (e.g. created via
    //    password signup) -> link the Google id to it instead of creating
    //    a duplicate account.
    if let Some(email) = info.email.as_deref() {
        if let Some(existing) = state.users.find_by_email(email).await.map_err(internal_error)? {
            let linked = state
                .users
                .attach_google_id(existing.id, &info.sub, info.picture.as_deref())
                .await
                .map_err(internal_error)?;
            let token =
                auth_service::issue_token(&linked, &state.jwt_secret).map_err(internal_error)?;
            return Ok(Json(AuthResponse {
                token,
                user: linked.into(),
            }));
        }
    }

    // 3) Brand new user -> create an account. Derive a unique username
    //    from their Google profile since Kavach usernames must be unique.
    let base_username = info
        .name
        .clone()
        .or_else(|| info.email.clone())
        .unwrap_or_else(|| format!("google_{}", &info.sub[..8.min(info.sub.len())]));
    let username = format!(
        "{}_{}",
        slugify(&base_username),
        &info.sub[..6.min(info.sub.len())]
    );

    let user = state
        .users
        .create_google_user(
            &info.sub,
            info.email.as_deref(),
            info.name.as_deref(),
            info.picture.as_deref(),
            &username,
        )
        .await
        .map_err(internal_error)?;

    let token = auth_service::issue_token(&user, &state.jwt_secret).map_err(internal_error)?;
    Ok(Json(AuthResponse {
        token,
        user: user.into(),
    }))
}

fn slugify(input: &str) -> String {
    input
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect::<String>()
}

fn bad_request(message: &str) -> (StatusCode, Json<Value>) {
    (
        StatusCode::BAD_REQUEST,
        Json(json!({ "message": message })),
    )
}

fn not_found(message: &str) -> (StatusCode, Json<Value>) {
    (StatusCode::NOT_FOUND, Json(json!({ "message": message })))
}

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("auth error: {err:#}");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "message": "Internal server error" })),
    )
}