PRAGMA foreign_keys = ON;

CREATE TABLE pair_library_state (
  pair_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (pair_id) REFERENCES pairs(id) ON DELETE CASCADE
);

INSERT INTO pair_library_state (pair_id, revision, created_at, updated_at)
SELECT id, 0, bound_at, COALESCE(unbound_at, bound_at)
FROM pairs;


CREATE TABLE library_categories (
  id TEXT PRIMARY KEY CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  pair_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 24),
  name_key TEXT NOT NULL CHECK (length(name_key) BETWEEN 1 AND 24),
  position INTEGER NOT NULL CHECK (position >= 0),
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (pair_id) REFERENCES pairs(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (pair_id, name_key)
);

CREATE INDEX library_categories_pair_position_idx
  ON library_categories (pair_id, position, created_at, id);

CREATE TABLE library_items (
  id TEXT PRIMARY KEY CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  pair_id TEXT NOT NULL,
  media_key TEXT NOT NULL CHECK (length(media_key) BETWEEN 1 AND 64),
  bvid TEXT NOT NULL CHECK (
    (length(bvid) = 12 AND substr(bvid, 1, 2) = 'BV')
    OR (substr(bvid, 1, 2) = 'av' AND length(bvid) > 2 AND substr(bvid, 3) NOT GLOB '*[^0-9]*')
  ),
  page INTEGER NOT NULL CHECK (page >= 1),
  cid INTEGER CHECK (cid IS NULL OR cid >= 0),
  canonical_url TEXT NOT NULL CHECK (
    length(canonical_url) <= 1000
    AND canonical_url LIKE 'https://www.bilibili.com/video/%'
  ),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  cover_url TEXT CHECK (
    cover_url IS NULL OR (length(cover_url) <= 1000 AND cover_url LIKE 'https://%')
  ),
  owner_name TEXT CHECK (owner_name IS NULL OR length(owner_name) <= 80),
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  metadata_status TEXT NOT NULL CHECK (metadata_status IN ('ready', 'partial')),
  category_id TEXT,
  watch_status TEXT NOT NULL CHECK (watch_status IN ('unwatched', 'watched')),
  position INTEGER NOT NULL CHECK (position >= 0),
  added_by_user_id TEXT,
  added_by_nickname_snapshot TEXT NOT NULL CHECK (length(added_by_nickname_snapshot) BETWEEN 1 AND 40),
  updated_by_user_id TEXT,
  updated_by_nickname_snapshot TEXT NOT NULL CHECK (length(updated_by_nickname_snapshot) BETWEEN 1 AND 40),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (pair_id) REFERENCES pairs(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES library_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (added_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (pair_id, media_key)
);

CREATE INDEX library_items_pair_position_idx
  ON library_items (pair_id, position, created_at, id);

CREATE INDEX library_items_pair_status_position_idx
  ON library_items (pair_id, watch_status, position, created_at, id);

CREATE INDEX library_items_pair_category_position_idx
  ON library_items (pair_id, category_id, position, created_at, id);
