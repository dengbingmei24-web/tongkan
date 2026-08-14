PRAGMA foreign_keys = ON;

CREATE TABLE pair_archive_members (
  pair_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  partner_user_id TEXT NOT NULL,
  partner_email_snapshot TEXT NOT NULL,
  partner_nickname_snapshot TEXT NOT NULL,
  partner_avatar_snapshot TEXT NOT NULL,
  retention_status TEXT NOT NULL CHECK (retention_status IN ('pending', 'keep', 'delete')),
  decided_at INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (pair_id, user_id),
  FOREIGN KEY (pair_id) REFERENCES pairs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (partner_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX pair_archive_members_user_status_created_idx
  ON pair_archive_members (user_id, retention_status, created_at DESC);
