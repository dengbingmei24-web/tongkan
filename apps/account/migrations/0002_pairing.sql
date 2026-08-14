PRAGMA foreign_keys = ON;

CREATE TABLE pair_invites (
  id TEXT PRIMARY KEY,
  inviter_user_id TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  accepted_by_user_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (inviter_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (accepted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX pair_invites_inviter_created_idx
  ON pair_invites (inviter_user_id, created_at DESC);

CREATE TABLE pairs (
  id TEXT PRIMARY KEY,
  user_a_id TEXT NOT NULL,
  user_b_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'unbound')),
  bound_at INTEGER NOT NULL,
  unbound_at INTEGER,
  unbound_by_user_id TEXT,
  CHECK (user_a_id <> user_b_id),
  FOREIGN KEY (user_a_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_b_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (unbound_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE active_pair_members (
  user_id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL,
  partner_user_id TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  CHECK (user_id <> partner_user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (pair_id) REFERENCES pairs(id) ON DELETE CASCADE,
  FOREIGN KEY (partner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX active_pair_members_pair_idx ON active_pair_members (pair_id);
