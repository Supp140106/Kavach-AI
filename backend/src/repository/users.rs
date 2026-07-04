// src/repository/users.rs
use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::user::User;

#[derive(Clone)]
pub struct UserRepository {
    pool: PgPool,
}

impl UserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn find_by_username(&self, username: &str) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = $1")
            .bind(username)
            .fetch_optional(&self.pool)
            .await?;
        Ok(user)
    }

    pub async fn find_by_email(&self, email: &str) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
            .bind(email)
            .fetch_optional(&self.pool)
            .await?;
        Ok(user)
    }

    pub async fn find_by_google_id(&self, google_id: &str) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE google_id = $1")
            .bind(google_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(user)
    }

    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(user)
    }

    /// Creates a normal username/password user.
    #[allow(clippy::too_many_arguments)]
    pub async fn create_local_user(
        &self,
        username: &str,
        email: Option<&str>,
        password_hash: &str,
        role: &str,
        location: Option<&str>,
        phone: Option<&str>,
        official_id: Option<&str>,
        is_approved: bool,
    ) -> Result<User> {
        let user = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (username, email, password_hash, role, location, phone, official_id, is_approved)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
        .bind(username)
        .bind(email)
        .bind(password_hash)
        .bind(role)
        .bind(location)
        .bind(phone)
        .bind(official_id)
        .bind(is_approved)
        .fetch_one(&self.pool)
        .await?;
        Ok(user)
    }

    /// Creates a user coming from Google sign-in (no password).
    pub async fn create_google_user(
        &self,
        google_id: &str,
        email: Option<&str>,
        name: Option<&str>,
        picture: Option<&str>,
        username: &str,
    ) -> Result<User> {
        let user = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (username, email, google_id, name, picture, role, is_approved)
            VALUES ($1, $2, $3, $4, $5, 'user', TRUE)
            RETURNING *
            "#,
        )
        .bind(username)
        .bind(email)
        .bind(google_id)
        .bind(name)
        .bind(picture)
        .fetch_one(&self.pool)
        .await?;
        Ok(user)
    }

    /// Links a Google account to an existing (e.g. previously password-only)
    /// user that was matched by email, so future logins resolve directly by
    /// google_id.
    pub async fn attach_google_id(
        &self,
        user_id: Uuid,
        google_id: &str,
        picture: Option<&str>,
    ) -> Result<User> {
        let user = sqlx::query_as::<_, User>(
            r#"
            UPDATE users
            SET google_id = $2,
                picture = COALESCE($3, picture),
                updated_at = now()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(google_id)
        .bind(picture)
        .fetch_one(&self.pool)
        .await?;
        Ok(user)
    }
}