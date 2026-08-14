PRAGMA foreign_keys = ON;

CREATE TABLE device_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_ciphertext TEXT NOT NULL,
  device_name TEXT NOT NULL,
  app_version TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  UNIQUE (user_id, token_hash),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX device_tokens_user_idx ON device_tokens (user_id, revoked_at, last_seen_at DESC);
CREATE INDEX device_tokens_hash_idx ON device_tokens (token_hash);
