PRAGMA foreign_keys = ON;

CREATE TABLE active_pair_rooms (
  pair_id TEXT PRIMARY KEY,
  host_user_id TEXT NOT NULL,
  room_id TEXT NOT NULL CHECK (length(room_id) = 32 AND room_id NOT GLOB '*[^0-9a-f]*'),
  invite_url_ciphertext TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (pair_id) REFERENCES pairs(id) ON DELETE CASCADE,
  FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX active_pair_rooms_host_idx
  ON active_pair_rooms (host_user_id, expires_at);

CREATE INDEX active_pair_rooms_expiry_idx
  ON active_pair_rooms (expires_at);