CREATE TABLE IF NOT EXISTS secure_credentials (
  name TEXT PRIMARY KEY,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
