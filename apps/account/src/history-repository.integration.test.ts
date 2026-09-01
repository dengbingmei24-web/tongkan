import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { BilibiliMetadataResolver } from "./bilibili-metadata";
import { hmacHex } from "./crypto";
import type { Env } from "./env";
import { HistoryService } from "./history-service";
import { D1HistoryRepository } from "./history-repository";
import type { HistoryIngestInterval, HistoryIngestSnapshot } from "./history-models";
import type { UserRecord } from "./models";
import { AccountRepository } from "./repository";

const migrationNames = ["0001_auth", "0002_pairing", "0003_device_tokens", "0004_pair_archives", "0005_shared_library", "0006_active_pair_rooms", "0007_calendar_plans", "0008_watch_history"];
const migrationUrls = migrationNames.map((name) => new URL("../migrations/" + name + ".sql", import.meta.url));
let database: D1Database;
let disposePlatform: (() => Promise<void>) | undefined;

const baseNow = 1_788_228_000_000;
const env = { HISTORY_GRANT_SECRET: "integration-grant-secret", HISTORY_INGEST_SECRET: "integration-ingest-secret", AUTH_SECRET: "integration-auth-secret" } as Env;
const metadata = new BilibiliMetadataResolver(async () => new Response("", { status: 503 }));

beforeAll(async () => {
  const fsSpecifier = "node:fs/promises";
  const urlSpecifier = "node:url";
  const { readFile } = await import(fsSpecifier) as { readFile(path: URL, encoding: string): Promise<string> };
  const { fileURLToPath } = await import(urlSpecifier) as { fileURLToPath(url: URL): string };
  const platform = await getPlatformProxy<{ DB: D1Database }>({
    configPath: fileURLToPath(new URL("../wrangler.toml", import.meta.url)), envFiles: [], persist: false, remoteBindings: false,
  });
  database = platform.env.DB;
  disposePlatform = platform.dispose;
  for (let index = 0; index < migrationUrls.length - 1; index += 1) await executeMigration(await readFile(migrationUrls[index]!, "utf8"));
  expect(await tableExists("watch_room_sources")).toBe(false);
  await executeMigration(await readFile(migrationUrls.at(-1)!, "utf8"));
}, 120_000);

afterAll(async () => { await disposePlatform?.(); });

describe("D1 watch history integration", () => {
  it("upgrades 0001-0007 to 0008 with all source tables and cascade foreign keys", async () => {
    expect(await tableExists("watch_room_sources")).toBe(true);
    expect(await tableExists("watch_intervals")).toBe(true);
    expect(await tableExists("watch_sessions")).toBe(true);
    const foreignKeys = await database.prepare("PRAGMA foreign_key_list(watch_intervals)").all<Record<string, unknown>>();
    expect(foreignKeys.results.some((row) => row.table === "pairs" && row.on_delete === "CASCADE")).toBe(true);
    expect(foreignKeys.results.some((row) => row.table === "watch_room_sources" && row.on_delete === "CASCADE")).toBe(true);
  });

  it("issues host, guest and refresh grants while rejecting wrong slot, room and pair reuse", async () => {
    let now = baseNow + 10_000;
    const first = await seedPair(10, now);
    const repository = new D1HistoryRepository(database);
    const service = new HistoryService(env, repository, metadata, () => now);
    const host = await service.issueGrant(first.userA, { roomId: first.roomId, slot: "host" });
    const guest = await service.issueGrant(first.userB, { roomId: first.roomId, slot: "guest" });
    expect(guest.sourceId).toBe(host.sourceId);
    now += 60_000;
    expect((await service.issueGrant(first.userA, { roomId: first.roomId, slot: "host" })).sourceId).toBe(host.sourceId);
    await expect(service.issueGrant(first.userB, { roomId: first.roomId, slot: "host" })).rejects.toMatchObject({ code: "HISTORY_GRANT_FORBIDDEN" });
    await expect(service.issueGrant(first.userA, { roomId: hexId(9_991), slot: "host" })).rejects.toMatchObject({ code: "HISTORY_GRANT_FORBIDDEN" });

    const second = await seedPair(11, now, first.roomId);
    await expect(service.issueGrant(second.userA, { roomId: second.roomId, slot: "host" })).rejects.toMatchObject({ code: "HISTORY_SOURCE_CONFLICT" });
    const source = await repository.sourceById(host.sourceId);
    now = source!.absoluteExpiresAt;
    await expect(service.issueGrant(first.userA, { roomId: first.roomId, slot: "host" })).rejects.toMatchObject({ code: "HISTORY_GRANT_EXPIRED" });
  });

  it("keeps 20 duplicate and reordered ingests idempotent and rolls back interval conflicts", async () => {
    const now = baseNow + 1_000_000;
    const pair = await seedPair(20, now);
    const repository = new D1HistoryRepository(database);
    const service = new HistoryService(env, repository, metadata, () => now);
    const grants = await bindSource(service, pair);
    const sessionId = hexId(20_500);
    for (let revision = 1; revision <= 20; revision += 1) {
      const interval = intervalFor(revision, sessionId, now - 900_000 + revision * 35_000, 30_000);
      const snapshot = snapshotFor(pair, grants.sourceId, revision, now, [interval]);
      await expect(service.ingestSnapshot(snapshot)).resolves.toMatchObject({ acceptedRevision: revision, stale: false });
      await expect(service.ingestSnapshot(snapshot)).resolves.toMatchObject({ acceptedRevision: revision, stale: true });
    }
    const staleInterval = intervalFor(10, sessionId, now - 900_000 + 10 * 35_000, 30_000);
    await expect(service.ingestSnapshot(snapshotFor(pair, grants.sourceId, 10, now, [staleInterval]))).resolves.toMatchObject({ acceptedRevision: 20, stale: true });
    expect(await count("SELECT COUNT(*) AS count FROM watch_intervals WHERE source_id = ?", grants.sourceId)).toBe(20);
    expect(await scalar("SELECT watched_ms FROM watch_sessions WHERE id = ?", sessionId)).toBe(600_000);

    const conflicting = { ...intervalFor(1, sessionId, now - 865_000, 30_000), endedAt: now - 834_000 };
    const newInterval = intervalFor(99, sessionId, now - 100_000, 30_000);
    await expect(service.ingestSnapshot(snapshotFor(pair, grants.sourceId, 21, now, [conflicting, newInterval])))
      .rejects.toMatchObject({ code: "HISTORY_INTERVAL_CONFLICT" });
    expect(await count("SELECT COUNT(*) AS count FROM watch_intervals WHERE source_id = ?", grants.sourceId)).toBe(20);
    expect(await scalar("SELECT last_ingested_revision FROM watch_room_sources WHERE id = ?", grants.sourceId)).toBe(20);
    const history = await service.getHistory(pair.userA, null, "20");
    expect(history.items).toHaveLength(1);
    expect(history.items[0]?.watchedSeconds).toBe(600);
  }, 30_000);

  it("validates timestamp, raw-body HMAC and replay at the internal route", async () => {
    const now = baseNow + 2_000_000;
    const pair = await seedPair(21, now);
    const repository = new D1HistoryRepository(database);
    const service = new HistoryService(env, repository, metadata, () => now);
    const grants = await bindSource(service, pair);
    const body = JSON.stringify(snapshotFor(pair, grants.sourceId, 1, now, [intervalFor(1, hexId(21_500), now - 60_000, 60_000)]));
    await expect(service.ingestInternal(await signedRequest(pair.roomId, body, now), pair.roomId)).resolves.toMatchObject({ acceptedRevision: 1 });
    await expect(service.ingestInternal(await signedRequest(pair.roomId, body, now), pair.roomId)).resolves.toMatchObject({ stale: true });
    const boundarySnapshot = snapshotFor(pair, grants.sourceId, 2, now, [intervalFor(1, hexId(21_500), now - 60_000, 60_000)]);
    boundarySnapshot.closed = true;
    const boundaryBody = JSON.stringify(boundarySnapshot);
    await expect(service.ingestInternal(await signedRequest(pair.roomId, boundaryBody, now - 300_000), pair.roomId)).resolves.toMatchObject({ acceptedRevision: 2 });
    await expect(service.ingestInternal(await signedRequest(pair.roomId, boundaryBody, now), pair.roomId)).resolves.toMatchObject({ acceptedRevision: 2, stale: true });
    await expect(service.ingestSnapshot(snapshotFor(pair, grants.sourceId, 3, now, []))).rejects.toMatchObject({ code: "HISTORY_SOURCE_REVOKED" });
    const tampered = body.replace('"sourceRevision":1', '"sourceRevision":2');
    const signed = await signedRequest(pair.roomId, body, now);
    await expect(service.ingestInternal(new Request(signed.url, { method: "POST", headers: signed.headers, body: tampered }), pair.roomId))
      .rejects.toMatchObject({ code: "HISTORY_SIGNATURE_INVALID" });
    await expect(service.ingestInternal(await signedRequest(pair.roomId, body, now - 300_001), pair.roomId))
      .rejects.toMatchObject({ code: "HISTORY_SIGNATURE_INVALID" });
  });
});

interface SeededPair { pairId: string; roomId: string; userA: UserRecord; userB: UserRecord; }

async function seedPair(seed: number, now: number, forcedRoomId?: string): Promise<SeededPair> {
  const pairId = hexId(seed * 100 + 1);
  const roomId = forcedRoomId ?? hexId(seed * 100 + 2);
  const userA = userRecord(hexId(seed * 100 + 3), "A" + seed);
  const userB = userRecord(hexId(seed * 100 + 4), "B" + seed);
  await database.batch([
    userInsert(userA), userInsert(userB),
    database.prepare("INSERT INTO pairs (id, user_a_id, user_b_id, status, bound_at) VALUES (?, ?, ?, 'active', ?)").bind(pairId, userA.id, userB.id, now),
    database.prepare("INSERT INTO pair_library_state (pair_id, revision, created_at, updated_at) VALUES (?, 0, ?, ?)").bind(pairId, now, now),
    database.prepare("INSERT INTO pair_calendar_state (pair_id, revision, created_at, updated_at) VALUES (?, 0, ?, ?)").bind(pairId, now, now),
    database.prepare("INSERT INTO active_pair_members (user_id, pair_id, partner_user_id, joined_at) VALUES (?, ?, ?, ?)").bind(userA.id, pairId, userB.id, now),
    database.prepare("INSERT INTO active_pair_members (user_id, pair_id, partner_user_id, joined_at) VALUES (?, ?, ?, ?)").bind(userB.id, pairId, userA.id, now),
    database.prepare("INSERT INTO active_pair_rooms (pair_id, host_user_id, room_id, invite_url_ciphertext, expires_at, created_at, updated_at) VALUES (?, ?, ?, 'ciphertext', ?, ?, ?)").bind(pairId, userA.id, roomId, now + 1_800_000, now, now),
  ]);
  return { pairId, roomId, userA, userB };
}

async function bindSource(service: HistoryService, pair: SeededPair): Promise<{ sourceId: string }> {
  const host = await service.issueGrant(pair.userA, { roomId: pair.roomId, slot: "host" });
  await service.issueGrant(pair.userB, { roomId: pair.roomId, slot: "guest" });
  return { sourceId: host.sourceId };
}

describe("D1 history aggregation and retention", () => {
  for (const [index, offset] of [-840, 0, 480, 840].entries()) {
    it(`splits real D1 intervals across local midnight at offset ${offset}`, async () => {
      const now = Date.UTC(2026, 7, 20, 12);
      const pair = await seedPair(30 + index, now);
      const repository = new D1HistoryRepository(database);
      const service = new HistoryService(env, repository, metadata, () => now);
      const grants = await bindSource(service, pair);
      const offsetMs = offset * 60_000;
      const midnight = Date.UTC(2026, 7, 16) - offsetMs;
      const sessionId = hexId(30_500 + index);
      await service.ingestSnapshot(snapshotFor(pair, grants.sourceId, 1, now, [
        intervalFor(1, sessionId, midnight - 60_000, 60_000),
        intervalFor(2, sessionId, midnight, 60_000),
      ]));
      const summary = await service.getMonthly(pair.userA, "2026-08", String(offset));
      expect(summary.days).toEqual([
        { date: "2026-08-15", watchedSeconds: 60, sessionCount: 1 },
        { date: "2026-08-16", watchedSeconds: 60, sessionCount: 1 },
      ]);
      expect(summary.sessionCount).toBe(1);
      expect((await service.getCalendarMarkers(pair.userA, "2026-08", String(offset))).markers).toEqual(summary.days);
      expect(await scalar("SELECT revision FROM pair_calendar_state WHERE pair_id = ?", pair.pairId)).toBe(0);
      expect(await scalar("SELECT revision FROM pair_library_state WHERE pair_id = ?", pair.pairId)).toBe(0);
    });
  }

  it("clips a visible session at the requested month boundary", async () => {
    const offset = 480;
    const offsetMs = offset * 60_000;
    const now = Date.UTC(2026, 8, 1, 12);
    const pair = await seedPair(40, now);
    const repository = new D1HistoryRepository(database);
    const service = new HistoryService(env, repository, metadata, () => now);
    const grants = await bindSource(service, pair);
    const midnight = Date.UTC(2026, 8, 1) - offsetMs;
    const sessionId = hexId(40_500);
    await service.ingestSnapshot(snapshotFor(pair, grants.sourceId, 1, now, [
      intervalFor(1, sessionId, midnight - 60_000, 60_000),
      intervalFor(2, sessionId, midnight, 60_000),
    ]));
    const summary = await service.getMonthly(pair.userA, "2026-08", String(offset));
    expect(summary.totalWatchedSeconds).toBe(60);
    expect(summary.days).toEqual([{ date: "2026-08-31", watchedSeconds: 60, sessionCount: 1 }]);
  });

  it("shows sessions at 60 seconds, hides 59 seconds, and paginates with a stable cursor", async () => {
    const now = Date.UTC(2026, 8, 1, 12);
    const pair = await seedPair(42, now);
    const repository = new D1HistoryRepository(database);
    const service = new HistoryService(env, repository, metadata, () => now);
    const grants = await bindSource(service, pair);
    const older = hexId(42_500);
    const newer = hexId(42_501);
    const hidden = hexId(42_502);
    await service.ingestSnapshot(snapshotFor(pair, grants.sourceId, 1, now, [
      intervalFor(1, older, now - 180_000, 60_000),
      intervalFor(1, newer, now - 60_000, 60_000),
      intervalFor(1, hidden, now - 300_000, 59_000),
    ]));
    const first = await service.getHistory(pair.userA, null, "1");
    expect(first.items.map((item) => item.id)).toEqual([newer]);
    expect(first.nextCursor).not.toBeNull();
    const second = await service.getHistory(pair.userA, first.nextCursor, "1");
    expect(second.items.map((item) => item.id)).toEqual([older]);
    expect(second.nextCursor).toBeNull();
    expect(first.items[0]?.completionState).toBe("unknown");
  });

  it("prefers shared-library metadata and falls back without rolling back intervals", async () => {
    const now = Date.UTC(2026, 7, 20);
    const pair = await seedPair(41, now);
    await seedLibraryItem(pair, now);
    const repository = new D1HistoryRepository(database);
    const service = new HistoryService(env, repository, metadata, () => now);
    const grants = await bindSource(service, pair);
    const librarySession = hexId(41_500);
    await service.ingestSnapshot(snapshotFor(pair, grants.sourceId, 1, now, [intervalFor(1, librarySession, now - 60_000, 60_000)]));
    expect(await scalar("SELECT metadata_source FROM watch_sessions WHERE id = ?", librarySession)).toBe("library");
    expect(await scalar("SELECT title_snapshot FROM watch_sessions WHERE id = ?", librarySession)).toBe("片库标题");

    const fallbackSession = hexId(41_501);
    const fallback = intervalFor(2, fallbackSession, now - 120_000, 60_000);
    fallback.media = { bvid: "BV17x411w7KC", page: 1, canonicalUrl: "https://www.bilibili.com/video/BV17x411w7KC", titleHint: "房间标题提示" };
    await service.ingestSnapshot(snapshotFor(pair, grants.sourceId, 2, now, [fallback]));
    expect(await scalar("SELECT metadata_source FROM watch_sessions WHERE id = ?", fallbackSession)).toBe("fallback");
    expect(await count("SELECT COUNT(*) AS count FROM watch_intervals WHERE session_id = ?", fallbackSession)).toBe(1);
  });

  it("keeps archive history read-only, rejects pending/delete/third-party, and blocks late ingest after unbind", async () => {
    const now = Date.UTC(2026, 7, 20);
    const pair = await seedPair(50, now);
    const historyRepository = new D1HistoryRepository(database);
    const service = new HistoryService(env, historyRepository, metadata, () => now);
    const grants = await bindSource(service, pair);
    const sessionId = hexId(50_500);
    await service.ingestSnapshot(snapshotFor(pair, grants.sourceId, 1, now, [intervalFor(1, sessionId, now - 60_000, 60_000)]));
    const accountRepository = new AccountRepository(database);
    await expect(accountRepository.unbindPair(pair.pairId, pair.userA.id, "keep", now + 1)).resolves.toBe(true);
    expect(await scalar("SELECT status FROM watch_room_sources WHERE id = ?", grants.sourceId)).toBe("revoked");
    await expect(service.ingestSnapshot(snapshotFor(pair, grants.sourceId, 2, now + 2, [intervalFor(2, sessionId, now - 120_000, 60_000)])))
      .rejects.toMatchObject({ code: "HISTORY_SOURCE_REVOKED" });
    await expect(service.getArchiveHistory(pair.userA, pair.pairId, null, null)).resolves.toMatchObject({ readOnly: true, items: [{ id: sessionId }] });
    await expect(service.getArchiveMonthly(pair.userA, pair.pairId, "2026-08", "480")).resolves.toMatchObject({ readOnly: true, completedCount: null });
    await expect(service.getArchiveCalendarMarkers(pair.userA, pair.pairId, "2026-08", "480")).resolves.toMatchObject({ readOnly: true });
    await expect(service.getArchiveHistory(pair.userB, pair.pairId, null, null)).rejects.toMatchObject({ code: "ARCHIVE_FORBIDDEN" });
    await expect(service.getArchiveHistory(userRecord(hexId(50_999), "C"), pair.pairId, null, null)).rejects.toMatchObject({ code: "ARCHIVE_FORBIDDEN" });
    await accountRepository.setPairArchiveRetention(pair.pairId, pair.userB.id, "delete", now + 3);
    await expect(service.getArchiveHistory(pair.userB, pair.pairId, null, null)).rejects.toMatchObject({ code: "ARCHIVE_FORBIDDEN" });
    expect(await count("SELECT COUNT(*) AS count FROM watch_intervals WHERE source_id = ?", grants.sourceId)).toBe(1);
  });

  it("cascades source, interval and session rows when both members choose delete", async () => {
    const now = Date.UTC(2026, 7, 21);
    const pair = await seedPair(51, now);
    const historyRepository = new D1HistoryRepository(database);
    const service = new HistoryService(env, historyRepository, metadata, () => now);
    const grants = await bindSource(service, pair);
    await service.ingestSnapshot(snapshotFor(pair, grants.sourceId, 1, now, [intervalFor(1, hexId(51_500), now - 60_000, 60_000)]));
    const accountRepository = new AccountRepository(database);
    await accountRepository.unbindPair(pair.pairId, pair.userA.id, "delete", now + 1);
    await expect(accountRepository.setPairArchiveRetention(pair.pairId, pair.userB.id, "delete", now + 2)).resolves.toMatchObject({ updated: true });
    expect(await count("SELECT COUNT(*) AS count FROM pairs WHERE id = ?", pair.pairId)).toBe(0);
    expect(await count("SELECT COUNT(*) AS count FROM watch_room_sources WHERE pair_id = ?", pair.pairId)).toBe(0);
    expect(await count("SELECT COUNT(*) AS count FROM watch_intervals WHERE pair_id = ?", pair.pairId)).toBe(0);
    expect(await count("SELECT COUNT(*) AS count FROM watch_sessions WHERE pair_id = ?", pair.pairId)).toBe(0);
  });
});

function intervalFor(sequence: number, sessionId: string, startedAt: number, durationMs: number): HistoryIngestInterval {
  return {
    intervalId: sequence.toString(16).padStart(8, "0") + sessionId.slice(8),
    sessionId,
    media: { bvid: "BV1xx411c7mD", page: 1, canonicalUrl: "https://www.bilibili.com/video/BV1xx411c7mD", titleHint: null },
    startedAt, endedAt: startedAt + durationMs, endReason: "checkpoint", durationSecondsHint: 1200,
  };
}

function snapshotFor(pair: SeededPair, sourceId: string, revision: number, observedAt: number, intervals: HistoryIngestInterval[]): HistoryIngestSnapshot {
  return { sourceId, pairId: pair.pairId, roomId: pair.roomId, sourceRevision: revision, observedAt, closed: false, participants: { hostUserId: pair.userA.id, guestUserId: pair.userB.id }, intervals };
}

async function signedRequest(room: string, body: string, timestamp: number): Promise<Request> {
  return new Request("https://account.internal/internal/history/sources/" + room + "/snapshot", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tongkan-history-timestamp": String(timestamp),
      "x-tongkan-history-signature": await hmacHex("integration-ingest-secret", String(timestamp) + "\n" + body),
    },
    body,
  });
}

function userRecord(userId: string, nickname: string): UserRecord {
  return { id: userId, emailHmac: "hmac-" + userId, emailMasked: nickname + "***@example.com", nickname, avatarId: "signal-01", createdAt: 1, updatedAt: 1 };
}

function userInsert(user: UserRecord): D1PreparedStatement {
  return database.prepare("INSERT INTO users (id, email_hmac, email_masked, nickname, avatar_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(user.id, user.emailHmac, user.emailMasked, user.nickname, user.avatarId, user.createdAt, user.updatedAt);
}

async function seedLibraryItem(pair: SeededPair, now: number): Promise<void> {
  await database.prepare(
    `INSERT INTO library_items (
       id, pair_id, media_key, bvid, page, cid, canonical_url, title, cover_url, owner_name,
       duration_seconds, metadata_status, category_id, watch_status, position,
       added_by_user_id, added_by_nickname_snapshot, updated_by_user_id, updated_by_nickname_snapshot,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, 1, NULL, ?, '片库标题', 'https://i0.hdslb.com/test.jpg', NULL,
       1200, 'ready', NULL, 'unwatched', 0, ?, ?, ?, ?, ?, ?)`,
  ).bind(hexId(41_600), pair.pairId, "BV1xx411c7mD:p1", "BV1xx411c7mD", "https://www.bilibili.com/video/BV1xx411c7mD",
    pair.userA.id, pair.userA.nickname, pair.userA.id, pair.userA.nickname, now, now).run();
}

async function executeMigration(sql: string): Promise<void> {
  for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) await database.prepare(statement).run();
}

async function tableExists(name: string): Promise<boolean> {
  return Boolean(await database.prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").bind(name).first());
}

async function count(sql: string, ...bindings: unknown[]): Promise<number> {
  return Number((await database.prepare(sql).bind(...bindings).first<{ count: number }>())?.count ?? 0);
}

async function scalar(sql: string, ...bindings: unknown[]): Promise<unknown> {
  const row = await database.prepare(sql).bind(...bindings).first<Record<string, unknown>>();
  return row ? Object.values(row)[0] : null;
}

function hexId(value: number): string { return value.toString(16).padStart(32, "0"); }
