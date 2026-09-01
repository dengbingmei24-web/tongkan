PRAGMA foreign_keys = ON;

CREATE TABLE watch_room_sources (
  id TEXT PRIMARY KEY CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  pair_id TEXT NOT NULL,
  room_id TEXT NOT NULL UNIQUE CHECK (length(room_id) = 32 AND room_id NOT GLOB '*[^0-9a-f]*'),
  host_user_id TEXT,
  guest_user_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'closed', 'revoked')),
  last_ingested_revision INTEGER NOT NULL DEFAULT 0 CHECK (last_ingested_revision >= 0),
  absolute_expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  closed_at INTEGER,
  revoked_at INTEGER,
  CHECK (host_user_id IS NULL OR guest_user_id IS NULL OR host_user_id <> guest_user_id),
  FOREIGN KEY (pair_id) REFERENCES pairs(id) ON DELETE CASCADE,
  FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (guest_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX watch_room_sources_pair_status_idx ON watch_room_sources (pair_id, status, updated_at);
CREATE INDEX watch_room_sources_expiry_idx ON watch_room_sources (status, absolute_expires_at);

CREATE TABLE watch_intervals (
  id TEXT PRIMARY KEY CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  source_id TEXT NOT NULL,
  session_id TEXT NOT NULL CHECK (length(session_id) = 32 AND session_id NOT GLOB '*[^0-9a-f]*'),
  pair_id TEXT NOT NULL,
  source_revision INTEGER NOT NULL CHECK (source_revision > 0),
  bvid TEXT NOT NULL CHECK ((length(bvid) = 12 AND substr(bvid, 1, 2) = 'BV') OR (substr(bvid, 1, 2) = 'av' AND length(bvid) > 2 AND substr(bvid, 3) NOT GLOB '*[^0-9]*')),
  page INTEGER NOT NULL CHECK (page >= 1),
  canonical_url TEXT NOT NULL CHECK (length(canonical_url) <= 1000 AND canonical_url LIKE 'https://www.bilibili.com/video/%'),
  title_hint TEXT CHECK (title_hint IS NULL OR length(title_hint) BETWEEN 1 AND 160),
  duration_seconds_hint REAL CHECK (duration_seconds_hint IS NULL OR duration_seconds_hint > 0),
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  watched_ms INTEGER NOT NULL CHECK (watched_ms > 0 AND watched_ms = ended_at - started_at),
  end_reason TEXT NOT NULL CHECK (end_reason IN ('pause', 'buffering', 'stale-report', 'disconnect', 'media-change', 'ended', 'grant-expired', 'history-unbind', 'room-expired', 'checkpoint')),
  created_at INTEGER NOT NULL,
  CHECK (ended_at > started_at),
  FOREIGN KEY (source_id) REFERENCES watch_room_sources(id) ON DELETE CASCADE,
  FOREIGN KEY (pair_id) REFERENCES pairs(id) ON DELETE CASCADE
);

CREATE INDEX watch_intervals_pair_time_idx ON watch_intervals (pair_id, started_at, ended_at);
CREATE INDEX watch_intervals_session_time_idx ON watch_intervals (session_id, started_at, id);
CREATE INDEX watch_intervals_source_revision_idx ON watch_intervals (source_id, source_revision, id);

CREATE TABLE watch_sessions (
  id TEXT PRIMARY KEY CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  source_id TEXT NOT NULL,
  pair_id TEXT NOT NULL,
  room_id TEXT NOT NULL CHECK (length(room_id) = 32 AND room_id NOT GLOB '*[^0-9a-f]*'),
  bvid TEXT NOT NULL CHECK ((length(bvid) = 12 AND substr(bvid, 1, 2) = 'BV') OR (substr(bvid, 1, 2) = 'av' AND length(bvid) > 2 AND substr(bvid, 3) NOT GLOB '*[^0-9]*')),
  page INTEGER NOT NULL CHECK (page >= 1),
  canonical_url TEXT NOT NULL CHECK (length(canonical_url) <= 1000 AND canonical_url LIKE 'https://www.bilibili.com/video/%'),
  title_snapshot TEXT NOT NULL CHECK (length(title_snapshot) BETWEEN 1 AND 160),
  cover_url_snapshot TEXT CHECK (cover_url_snapshot IS NULL OR (length(cover_url_snapshot) <= 1000 AND cover_url_snapshot LIKE 'https://%')),
  metadata_source TEXT NOT NULL CHECK (metadata_source IN ('library', 'bilibili', 'fallback')),
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  watched_ms INTEGER NOT NULL CHECK (watched_ms > 0),
  interval_count INTEGER NOT NULL CHECK (interval_count > 0),
  completion_state TEXT NOT NULL CHECK (completion_state IN ('unknown', 'completed', 'incomplete')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (ended_at > started_at),
  FOREIGN KEY (source_id) REFERENCES watch_room_sources(id) ON DELETE CASCADE,
  FOREIGN KEY (pair_id) REFERENCES pairs(id) ON DELETE CASCADE
);

CREATE INDEX watch_sessions_pair_started_idx ON watch_sessions (pair_id, started_at DESC, id DESC);
CREATE INDEX watch_sessions_pair_media_idx ON watch_sessions (pair_id, bvid, page, started_at);
