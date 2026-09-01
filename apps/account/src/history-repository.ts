import type {
  HistoryActiveRoom,
  HistoryCursor,
  HistoryIngestInterval,
  HistoryIngestSnapshot,
  HistoryIntervalSlice,
  HistoryMetadataSnapshot,
  HistoryPairIdentity,
  WatchIntervalRecord,
  WatchRoomSourceRecord,
  WatchSessionRecord,
} from "./history-models";

export type HistoryArchiveAccess = "keep" | "pending" | "delete" | "forbidden" | "not-found";

export interface HistorySessionSeed {
  sessionId: string;
  media: HistoryIngestInterval["media"];
  metadata: HistoryMetadataSnapshot;
}

export interface HistoryCommitResult { applied: boolean; }

export interface HistoryRepository {
  pairIdentityByUser(userId: string): Promise<HistoryPairIdentity | null>;
  activeRoomByPair(pairId: string): Promise<HistoryActiveRoom | null>;
  sourceByRoomId(roomId: string): Promise<WatchRoomSourceRecord | null>;
  sourceById(sourceId: string): Promise<WatchRoomSourceRecord | null>;
  createSource(source: WatchRoomSourceRecord): Promise<boolean>;
  attachGuest(sourceId: string, pairId: string, guestUserId: string, now: number): Promise<boolean>;
  intervalsByIds(ids: string[]): Promise<WatchIntervalRecord[]>;
  sessionsByIds(ids: string[]): Promise<WatchSessionRecord[]>;
  libraryMetadata(pairId: string, bvid: string, page: number): Promise<HistoryMetadataSnapshot | null>;
  commitSnapshot(source: WatchRoomSourceRecord, snapshot: HistoryIngestSnapshot, newIntervals: HistoryIngestInterval[], sessions: HistorySessionSeed[], now: number): Promise<HistoryCommitResult>;
  historySessions(pairId: string, cursor: HistoryCursor | null, limit: number): Promise<WatchSessionRecord[]>;
  intervalsOverlapping(pairId: string, from: number, to: number): Promise<HistoryIntervalSlice[]>;
  archiveAccess(pairId: string, userId: string): Promise<HistoryArchiveAccess>;
}

function nullableString(value: unknown): string | null { return value === null || value === undefined ? null : String(value); }
function sourceFromRow(row: Record<string, unknown>): WatchRoomSourceRecord {
  return {
    id: String(row.id), pairId: String(row.pair_id), roomId: String(row.room_id),
    hostUserId: nullableString(row.host_user_id), guestUserId: nullableString(row.guest_user_id),
    status: String(row.status) as WatchRoomSourceRecord["status"],
    lastIngestedRevision: Number(row.last_ingested_revision), absoluteExpiresAt: Number(row.absolute_expires_at),
    createdAt: Number(row.created_at), updatedAt: Number(row.updated_at),
    closedAt: row.closed_at === null ? null : Number(row.closed_at),
    revokedAt: row.revoked_at === null ? null : Number(row.revoked_at),
  };
}

function intervalFromRow(row: Record<string, unknown>): WatchIntervalRecord {
  return {
    intervalId: String(row.id), sessionId: String(row.session_id), sourceId: String(row.source_id), pairId: String(row.pair_id),
    sourceRevision: Number(row.source_revision),
    media: { bvid: String(row.bvid), page: Number(row.page), canonicalUrl: String(row.canonical_url), titleHint: nullableString(row.title_hint) },
    durationSecondsHint: row.duration_seconds_hint === null ? null : Number(row.duration_seconds_hint),
    startedAt: Number(row.started_at), endedAt: Number(row.ended_at), watchedMs: Number(row.watched_ms),
    endReason: String(row.end_reason) as WatchIntervalRecord["endReason"], createdAt: Number(row.created_at),
  };
}

function sessionFromRow(row: Record<string, unknown>): WatchSessionRecord {
  return {
    id: String(row.id), sourceId: String(row.source_id), pairId: String(row.pair_id), roomId: String(row.room_id),
    bvid: String(row.bvid), page: Number(row.page), canonicalUrl: String(row.canonical_url),
    titleSnapshot: String(row.title_snapshot), coverUrlSnapshot: nullableString(row.cover_url_snapshot),
    metadataSource: String(row.metadata_source) as WatchSessionRecord["metadataSource"],
    startedAt: Number(row.started_at), endedAt: Number(row.ended_at), watchedMs: Number(row.watched_ms),
    intervalCount: Number(row.interval_count), completionState: String(row.completion_state) as WatchSessionRecord["completionState"],
    createdAt: Number(row.created_at), updatedAt: Number(row.updated_at),
  };
}

export class D1HistoryRepository implements HistoryRepository {
  constructor(private readonly db: D1Database) {}

  async pairIdentityByUser(userId: string): Promise<HistoryPairIdentity | null> {
    const row = await this.db.prepare(
      `SELECT ap.pair_id, ap.partner_user_id FROM active_pair_members ap
       JOIN pairs p ON p.id = ap.pair_id AND p.status = 'active' WHERE ap.user_id = ? LIMIT 1`,
    ).bind(userId).first<Record<string, unknown>>();
    return row ? { pairId: String(row.pair_id), partnerUserId: String(row.partner_user_id) } : null;
  }

  async activeRoomByPair(pairId: string): Promise<HistoryActiveRoom | null> {
    const row = await this.db.prepare(
      `SELECT pair_id, host_user_id, room_id, expires_at FROM active_pair_rooms WHERE pair_id = ? LIMIT 1`,
    ).bind(pairId).first<Record<string, unknown>>();
    return row ? { pairId: String(row.pair_id), hostUserId: String(row.host_user_id), roomId: String(row.room_id), expiresAt: Number(row.expires_at) } : null;
  }

  async sourceByRoomId(roomId: string): Promise<WatchRoomSourceRecord | null> {
    const row = await this.db.prepare("SELECT * FROM watch_room_sources WHERE room_id = ? LIMIT 1").bind(roomId).first<Record<string, unknown>>();
    return row ? sourceFromRow(row) : null;
  }

  async sourceById(sourceId: string): Promise<WatchRoomSourceRecord | null> {
    const row = await this.db.prepare("SELECT * FROM watch_room_sources WHERE id = ? LIMIT 1").bind(sourceId).first<Record<string, unknown>>();
    return row ? sourceFromRow(row) : null;
  }

  async createSource(source: WatchRoomSourceRecord): Promise<boolean> {
    try {
      const result = await this.db.prepare(
        `INSERT INTO watch_room_sources (id, pair_id, room_id, host_user_id, guest_user_id, status, last_ingested_revision, absolute_expires_at, created_at, updated_at, closed_at, revoked_at)
         SELECT ?, p.id, ?, ?, NULL, 'active', 0, ?, ?, ?, NULL, NULL FROM pairs p
         JOIN active_pair_rooms apr ON apr.pair_id = p.id
         WHERE p.id = ? AND p.status = 'active' AND apr.room_id = ? AND apr.host_user_id = ? AND apr.expires_at > ?`,
      ).bind(source.id, source.roomId, source.hostUserId, source.absoluteExpiresAt, source.createdAt, source.updatedAt,
        source.pairId, source.roomId, source.hostUserId, source.createdAt).run();
      return result.meta.changes === 1;
    } catch (error) {
      if (String(error).includes("UNIQUE constraint failed")) return false;
      throw error;
    }
  }

  async attachGuest(sourceId: string, pairId: string, guestUserId: string, now: number): Promise<boolean> {
    const result = await this.db.prepare(
      `UPDATE watch_room_sources SET guest_user_id = ?, updated_at = ?
       WHERE id = ? AND pair_id = ? AND status = 'active' AND absolute_expires_at > ?
         AND host_user_id <> ? AND (guest_user_id IS NULL OR guest_user_id = ?)`,
    ).bind(guestUserId, now, sourceId, pairId, now, guestUserId, guestUserId).run();
    return result.meta.changes === 1;
  }

  async intervalsByIds(ids: string[]): Promise<WatchIntervalRecord[]> {
    if (ids.length === 0) return [];
    const result = await this.db.prepare(`SELECT * FROM watch_intervals WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<Record<string, unknown>>();
    return result.results.map(intervalFromRow);
  }

  async sessionsByIds(ids: string[]): Promise<WatchSessionRecord[]> {
    if (ids.length === 0) return [];
    const result = await this.db.prepare(`SELECT * FROM watch_sessions WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<Record<string, unknown>>();
    return result.results.map(sessionFromRow);
  }

  async libraryMetadata(pairId: string, bvid: string, page: number): Promise<HistoryMetadataSnapshot | null> {
    const row = await this.db.prepare(
      "SELECT title, cover_url FROM library_items WHERE pair_id = ? AND bvid = ? AND page = ? LIMIT 1",
    ).bind(pairId, bvid, page).first<Record<string, unknown>>();
    return row ? { title: String(row.title), coverUrl: nullableString(row.cover_url), source: "library" } : null;
  }

  async commitSnapshot(
    source: WatchRoomSourceRecord,
    snapshot: HistoryIngestSnapshot,
    newIntervals: HistoryIngestInterval[],
    sessions: HistorySessionSeed[],
    now: number,
  ): Promise<HistoryCommitResult> {
    const statements: D1PreparedStatement[] = [];
    for (const interval of newIntervals) {
      statements.push(this.db.prepare(
        `INSERT INTO watch_intervals (
           id, source_id, session_id, pair_id, source_revision, bvid, page, canonical_url,
           title_hint, duration_seconds_hint, started_at, ended_at, watched_ms, end_reason, created_at
         )
         SELECT ?, s.id, ?, s.pair_id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         FROM watch_room_sources s
         WHERE s.id = ? AND s.pair_id = ? AND s.room_id = ? AND s.status = 'active'
           AND s.absolute_expires_at > ? AND s.last_ingested_revision < ?
           AND s.host_user_id = ? AND s.guest_user_id = ?`,
      ).bind(
        interval.intervalId, interval.sessionId, snapshot.sourceRevision,
        interval.media.bvid, interval.media.page, interval.media.canonicalUrl, interval.media.titleHint,
        interval.durationSecondsHint, interval.startedAt, interval.endedAt, interval.endedAt - interval.startedAt,
        interval.endReason, now, source.id, source.pairId, source.roomId, now, snapshot.sourceRevision,
        snapshot.participants.hostUserId, snapshot.participants.guestUserId,
      ));
    }
    for (const session of sessions) {
      statements.push(this.db.prepare(
        `INSERT INTO watch_sessions (
           id, source_id, pair_id, room_id, bvid, page, canonical_url,
           title_snapshot, cover_url_snapshot, metadata_source,
           started_at, ended_at, watched_ms, interval_count, completion_state, created_at, updated_at
         )
         SELECT ?, s.id, s.pair_id, s.room_id, ?, ?, ?, ?, ?, ?,
           MIN(wi.started_at), MAX(wi.ended_at), SUM(wi.watched_ms), COUNT(*), 'unknown', ?, ?
         FROM watch_room_sources s JOIN watch_intervals wi ON wi.source_id = s.id AND wi.session_id = ?
         WHERE s.id = ? AND s.pair_id = ? AND s.room_id = ? AND s.status = 'active'
           AND s.absolute_expires_at > ? AND s.last_ingested_revision < ?
           AND s.host_user_id = ? AND s.guest_user_id = ?
         HAVING COUNT(*) > 0
         ON CONFLICT(id) DO UPDATE SET
           started_at = excluded.started_at,
           ended_at = excluded.ended_at,
           watched_ms = excluded.watched_ms,
           interval_count = excluded.interval_count,
           title_snapshot = CASE
             WHEN (CASE excluded.metadata_source WHEN 'library' THEN 3 WHEN 'bilibili' THEN 2 ELSE 1 END)
                > (CASE watch_sessions.metadata_source WHEN 'library' THEN 3 WHEN 'bilibili' THEN 2 ELSE 1 END)
             THEN excluded.title_snapshot ELSE watch_sessions.title_snapshot END,
           cover_url_snapshot = CASE
             WHEN (CASE excluded.metadata_source WHEN 'library' THEN 3 WHEN 'bilibili' THEN 2 ELSE 1 END)
                > (CASE watch_sessions.metadata_source WHEN 'library' THEN 3 WHEN 'bilibili' THEN 2 ELSE 1 END)
             THEN excluded.cover_url_snapshot ELSE watch_sessions.cover_url_snapshot END,
           metadata_source = CASE
             WHEN (CASE excluded.metadata_source WHEN 'library' THEN 3 WHEN 'bilibili' THEN 2 ELSE 1 END)
                > (CASE watch_sessions.metadata_source WHEN 'library' THEN 3 WHEN 'bilibili' THEN 2 ELSE 1 END)
             THEN excluded.metadata_source ELSE watch_sessions.metadata_source END,
           updated_at = excluded.updated_at
         WHERE watch_sessions.source_id = excluded.source_id AND watch_sessions.pair_id = excluded.pair_id
           AND watch_sessions.room_id = excluded.room_id AND watch_sessions.bvid = excluded.bvid
           AND watch_sessions.page = excluded.page AND watch_sessions.canonical_url = excluded.canonical_url`,
      ).bind(
        session.sessionId, session.media.bvid, session.media.page, session.media.canonicalUrl,
        session.metadata.title, session.metadata.coverUrl, session.metadata.source, now, now,
        session.sessionId, source.id, source.pairId, source.roomId, now, snapshot.sourceRevision,
        snapshot.participants.hostUserId, snapshot.participants.guestUserId,
      ));
    }
    statements.push(this.db.prepare(
      `UPDATE watch_room_sources SET last_ingested_revision = ?, updated_at = ?,
         status = CASE WHEN ? THEN 'closed' ELSE status END,
         closed_at = CASE WHEN ? THEN ? ELSE closed_at END
       WHERE id = ? AND pair_id = ? AND room_id = ? AND status = 'active'
         AND absolute_expires_at > ? AND last_ingested_revision < ?
         AND host_user_id = ? AND guest_user_id = ?`,
    ).bind(
      snapshot.sourceRevision, now, snapshot.closed ? 1 : 0, snapshot.closed ? 1 : 0, snapshot.closed ? now : null,
      source.id, source.pairId, source.roomId, now, snapshot.sourceRevision,
      snapshot.participants.hostUserId, snapshot.participants.guestUserId,
    ));
    const results = await this.db.batch(statements);
    return { applied: results.at(-1)?.meta.changes === 1 };
  }

  async historySessions(pairId: string, cursor: HistoryCursor | null, limit: number): Promise<WatchSessionRecord[]> {
    const result = await this.db.prepare(
      `SELECT * FROM watch_sessions
       WHERE pair_id = ? AND watched_ms >= 60000
         AND (? IS NULL OR started_at < ? OR (started_at = ? AND id < ?))
       ORDER BY started_at DESC, id DESC LIMIT ?`,
    ).bind(pairId, cursor?.startedAt ?? null, cursor?.startedAt ?? 0, cursor?.startedAt ?? 0, cursor?.id ?? "", limit).all<Record<string, unknown>>();
    return result.results.map(sessionFromRow);
  }

  async intervalsOverlapping(pairId: string, from: number, to: number): Promise<HistoryIntervalSlice[]> {
    const result = await this.db.prepare(
      `SELECT wi.id, wi.session_id, wi.bvid, wi.page, wi.started_at, wi.ended_at
       FROM watch_intervals wi JOIN watch_sessions ws ON ws.id = wi.session_id
       WHERE wi.pair_id = ? AND ws.watched_ms >= 60000 AND wi.ended_at > ? AND wi.started_at < ?
       ORDER BY wi.started_at, wi.id`,
    ).bind(pairId, from, to).all<Record<string, unknown>>();
    return result.results.map((row) => ({
      id: String(row.id), sessionId: String(row.session_id), bvid: String(row.bvid), page: Number(row.page),
      startedAt: Number(row.started_at), endedAt: Number(row.ended_at),
    }));
  }

  async archiveAccess(pairId: string, userId: string): Promise<HistoryArchiveAccess> {
    const pair = await this.db.prepare("SELECT status FROM pairs WHERE id = ? LIMIT 1").bind(pairId).first<{ status: string }>();
    if (!pair || pair.status !== "unbound") return "not-found";
    const row = await this.db.prepare(
      "SELECT retention_status FROM pair_archive_members WHERE pair_id = ? AND user_id = ? LIMIT 1",
    ).bind(pairId, userId).first<{ retention_status: string }>();
    if (!row) return "forbidden";
    if (row.retention_status === "keep" || row.retention_status === "pending" || row.retention_status === "delete") return row.retention_status;
    return "forbidden";
  }
}
