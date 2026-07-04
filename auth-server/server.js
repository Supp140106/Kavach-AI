// server.js
//
// Standalone Google Sign-In endpoint. Talks directly to your existing
// Neon Postgres `users` table (same schema as the Rust backend).
//
// Run:
//   node server.js
//
// Env vars needed (same values as your existing backend/.env):
//   DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
//   GOOGLE_CLIENT_ID=690919168166-....apps.googleusercontent.com
//   JWT_SECRET=your-secret
//   PORT=8080  (optional, defaults to 8080)
//   CORS_ORIGIN=http://localhost:5173 (optional, defaults to that)

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");

const {
  DATABASE_URL,
  GOOGLE_CLIENT_ID,
  JWT_SECRET,
  PORT = 8080,
  CORS_ORIGIN = "http://localhost:5173",
} = process.env;

if (!DATABASE_URL) {
  console.error("FATAL: DATABASE_URL environment variable missing");
  process.exit(1);
}
if (!GOOGLE_CLIENT_ID) {
  console.error("FATAL: GOOGLE_CLIENT_ID environment variable missing");
  process.exit(1);
}
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable missing");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  })
);

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------

// Columns selected/returned everywhere - MUST match the actual users table.
const USER_COLUMNS = `
  id, username, email, password_hash, google_id, role,
  official_id, location, phone, bio, picture, is_approved,
  ngo_details, preferences, last_login, created_at, updated_at
`;

function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    officialId: row.official_id,
    location: row.location,
    phone: row.phone,
    bio: row.bio,
    picture: row.picture,
    isApproved: row.is_approved,
    ngoDetails: row.ngo_details,
    preferences: row.preferences,
    lastLogin: row.last_login,
    createdAt: row.created_at,
  };
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// ---------------------------------------------------------------------
// routes
// ---------------------------------------------------------------------

app.get("/api/auth/health", (_req, res) => {
  res.json({ status: "healthy", service: "quickfix-node-auth" });
});

app.post("/api/auth/google-login", async (req, res) => {
  const { token } = req.body || {};

  if (!token) {
    return res.status(400).json({ message: "Missing Google token" });
  }

  // 1. Verify the Google ID token
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (e) {
    console.error("Google token verification failed:", e);
    return res.status(401).json({ message: "Google authentication failed" });
  }

  const googleId = payload.sub;
  const email = payload.email || null;
  const picture = payload.picture || null;
  const displayName =
    payload.name || `user_${googleId.slice(0, 8)}`;

  const client = await pool.connect();
  try {
    // 2. Look up existing user by google_id
    const existing = await client.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE google_id = $1`,
      [googleId]
    );

    let userRow;

    if (existing.rows.length > 0) {
      userRow = existing.rows[0];
    } else {
      // 3. Create a new user
      const inserted = await client.query(
        `INSERT INTO users (google_id, email, username, picture, role, is_approved)
         VALUES ($1, $2, $3, $4, 'user', TRUE)
         RETURNING ${USER_COLUMNS}`,
        [googleId, email, displayName, picture]
      );
      userRow = inserted.rows[0];
    }

    // 4. Touch last_login (best-effort, don't fail the request if this errors)
    try {
      await client.query(
        "UPDATE users SET last_login = now(), updated_at = now() WHERE id = $1",
        [userRow.id]
      );
    } catch (touchErr) {
      console.warn("touch_last_login failed (non-fatal):", touchErr.message);
    }

    // 5. Issue JWT
    const authToken = generateToken(userRow);

    return res.json({
      token: authToken,
      user: toPublicUser(userRow),
    });
  } catch (e) {
    // Full, real error - this is the whole point of this file.
    console.error("google-login DB error:", e);
    return res.status(500).json({ message: "Database error", detail: e.message });
  } finally {
    client.release();
  }
});

app.listen(PORT, () => {
  console.log(`quickfix google-login server listening on :${PORT}`);
});