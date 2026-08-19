PRAGMA foreign_keys = ON;

CREATE TABLE pair_calendar_state (
  pair_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (pair_id) REFERENCES pairs(id) ON DELETE CASCADE
);

INSERT INTO pair_calendar_state (pair_id, revision, created_at, updated_at)
SELECT id, 0, bound_at, COALESCE(unbound_at, bound_at)
FROM pairs;

CREATE TABLE calendar_plans (
  id TEXT PRIMARY KEY CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  pair_id TEXT NOT NULL,
  library_item_id TEXT,
  scheduled_date TEXT NOT NULL CHECK (length(scheduled_date) = 10 AND scheduled_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  start_time TEXT CHECK (start_time IS NULL OR (length(start_time) = 5 AND start_time GLOB '[0-9][0-9]:[0-9][0-9]')),
  note TEXT CHECK (note IS NULL OR length(trim(note)) BETWEEN 1 AND 200),
  status TEXT NOT NULL CHECK (status IN ('planned', 'completed')),
  bvid TEXT NOT NULL CHECK ((length(bvid) = 12 AND substr(bvid, 1, 2) = 'BV') OR (substr(bvid, 1, 2) = 'av' AND length(bvid) > 2 AND substr(bvid, 3) NOT GLOB '*[^0-9]*')),
  page INTEGER NOT NULL CHECK (page >= 1),
  canonical_url TEXT NOT NULL CHECK (length(canonical_url) <= 1000 AND canonical_url LIKE 'https://www.bilibili.com/video/%'),
  title_snapshot TEXT NOT NULL CHECK (length(title_snapshot) BETWEEN 1 AND 160),
  cover_url_snapshot TEXT CHECK (cover_url_snapshot IS NULL OR (length(cover_url_snapshot) <= 1000 AND cover_url_snapshot LIKE 'https://%')),
  created_by_user_id TEXT,
  created_by_nickname_snapshot TEXT NOT NULL CHECK (length(created_by_nickname_snapshot) BETWEEN 1 AND 40),
  updated_by_user_id TEXT,
  updated_by_nickname_snapshot TEXT NOT NULL CHECK (length(updated_by_nickname_snapshot) BETWEEN 1 AND 40),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  CHECK ((status = 'planned' AND completed_at IS NULL) OR (status = 'completed' AND completed_at IS NOT NULL)),
  FOREIGN KEY (pair_id) REFERENCES pairs(id) ON DELETE CASCADE,
  FOREIGN KEY (library_item_id) REFERENCES library_items(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (pair_id, library_item_id, scheduled_date)
);

CREATE INDEX calendar_plans_pair_date_idx ON calendar_plans (pair_id, scheduled_date, start_time, created_at, id);
CREATE INDEX calendar_plans_pair_status_date_idx ON calendar_plans (pair_id, status, scheduled_date, start_time, created_at, id);
