import { describe, expect, it } from "vitest";
import { BilibiliMetadataResolver } from "./bilibili-metadata";
import { hmacHex } from "./crypto";
import type { Env } from "./env";
import { verifyHistoryGrant } from "./history-grant";
import type {
  HistoryActiveRoom, HistoryCursor, HistoryIngestInterval, HistoryIngestSnapshot, HistoryIntervalSlice,
  HistoryMetadataSnapshot, HistoryPairIdentity, WatchIntervalRecord, WatchRoomSourceRecord, WatchSessionRecord,
} from "./history-models";
import type { HistoryArchiveAccess, HistoryCommitResult, HistoryRepository, HistorySessionSeed } from "./history-repository";
import { aggregateHistoryMonth, HistoryService } from "./history-service";
import type { UserRecord } from "./models";

const id = (digit: string): string => digit.repeat(32);
const userA = user(id("a"), "A");
const userB = user(id("b"), "B");
const pairId = id("1");
const roomId = id("2");

class MemoryHistoryRepository implements HistoryRepository {
  source: WatchRoomSourceRecord | null = null;
  readonly intervals = new Map<string, WatchIntervalRecord>();
  room: HistoryActiveRoom | null = { pairId, hostUserId: userA.id, roomId, expiresAt: 1_788_228_600_000 };

  async pairIdentityByUser(userId: string): Promise<HistoryPairIdentity | null> {
    if (userId === userA.id) return { pairId, partnerUserId: userB.id };
    if (userId === userB.id) return { pairId, partnerUserId: userA.id };
    return null;
  }
  async activeRoomByPair(targetPairId: string): Promise<HistoryActiveRoom | null> { return targetPairId === pairId ? this.room : null; }
  async sourceByRoomId(targetRoomId: string): Promise<WatchRoomSourceRecord | null> { return this.source?.roomId === targetRoomId ? this.source : null; }
  async sourceById(sourceId: string): Promise<WatchRoomSourceRecord | null> { return this.source?.id === sourceId ? this.source : null; }
  async createSource(source: WatchRoomSourceRecord): Promise<boolean> { if (this.source) return false; this.source = source; return true; }
  async attachGuest(sourceId: string, targetPairId: string, guestUserId: string, now: number): Promise<boolean> {
    if (!this.source || this.source.id !== sourceId || this.source.pairId !== targetPairId || (this.source.guestUserId && this.source.guestUserId !== guestUserId)) return false;
    this.source = { ...this.source, guestUserId, updatedAt: now };
    return true;
  }
  async intervalsByIds(ids: string[]): Promise<WatchIntervalRecord[]> { return ids.flatMap((value) => this.intervals.get(value) ?? []); }
  async sessionsByIds(_ids: string[]): Promise<WatchSessionRecord[]> { return []; }
  async libraryMetadata(_pairId: string, _bvid: string, _page: number): Promise<HistoryMetadataSnapshot | null> { return null; }
  async commitSnapshot(source: WatchRoomSourceRecord, snapshot: HistoryIngestSnapshot, newIntervals: HistoryIngestInterval[], _sessions: HistorySessionSeed[], now: number): Promise<HistoryCommitResult> {
    if (!this.source || this.source.status !== "active" || this.source.lastIngestedRevision >= snapshot.sourceRevision) return { applied: false };
    for (const interval of newIntervals) this.intervals.set(interval.intervalId, {
      ...interval, sourceId: source.id, pairId: source.pairId, sourceRevision: snapshot.sourceRevision,
      watchedMs: interval.endedAt - interval.startedAt, createdAt: now,
    });
    this.source = { ...this.source, lastIngestedRevision: snapshot.sourceRevision, updatedAt: now, status: snapshot.closed ? "closed" : "active" };
    return { applied: true };
  }
  async historySessions(_pairId: string, _cursor: HistoryCursor | null, _limit: number): Promise<WatchSessionRecord[]> { return []; }
  async intervalsOverlapping(_pairId: string, _from: number, _to: number): Promise<HistoryIntervalSlice[]> { return []; }
  async archiveAccess(_pairId: string, _userId: string): Promise<HistoryArchiveAccess> { return "not-found"; }
}

const env = { HISTORY_GRANT_SECRET: "grant-secret", HISTORY_INGEST_SECRET: "ingest-secret" } as Env;
const metadata = new BilibiliMetadataResolver(async () => new Response("", { status: 503 }));

describe("history service grants", () => {
  it("creates host source, attaches guest and refreshes the same source", async () => {
    let now = 1_788_228_000_000;
    const repository = new MemoryHistoryRepository();
    const service = new HistoryService(env, repository, metadata, () => now);
    const host = await service.issueGrant(userA, { roomId, slot: "host" });
    expect((await verifyHistoryGrant("grant-secret", host.grant, now)).userId).toBe(userA.id);
    const guest = await service.issueGrant(userB, { roomId, slot: "guest" });
    expect((await verifyHistoryGrant("grant-secret", guest.grant, now)).slot).toBe("guest");
    now += 60_000;
    const refreshed = await service.issueGrant(userA, { roomId, slot: "host" });
    expect(refreshed.sourceId).toBe(host.sourceId);
    expect(repository.source?.guestUserId).toBe(userB.id);
  });

  it("rejects wrong slot, room and absolute expiry", async () => {
    let now = 1_788_228_000_000;
    const repository = new MemoryHistoryRepository();
    const service = new HistoryService(env, repository, metadata, () => now);
    await service.issueGrant(userA, { roomId, slot: "host" });
    await expect(service.issueGrant(userB, { roomId, slot: "host" })).rejects.toMatchObject({ code: "HISTORY_GRANT_FORBIDDEN" });
    await expect(service.issueGrant(userA, { roomId: id("3"), slot: "host" })).rejects.toMatchObject({ code: "HISTORY_GRANT_FORBIDDEN" });
    now = repository.source!.absoluteExpiresAt;
    await expect(service.issueGrant(userA, { roomId, slot: "host" })).rejects.toMatchObject({ code: "HISTORY_GRANT_EXPIRED" });
  });
});

describe("history signed ingest", () => {
  it("accepts signed snapshots, treats replay as stale and rejects tampering", async () => {
    const now = 1_788_228_000_000;
    const repository = new MemoryHistoryRepository();
    repository.source = source(now);
    const service = new HistoryService(env, repository, metadata, () => now);
    const body = JSON.stringify(snapshot(1, now));
    await expect(service.ingestInternal(await signedRequest(body, now), roomId)).resolves.toMatchObject({ acceptedRevision: 1, stale: false });
    await expect(service.ingestInternal(await signedRequest(body, now), roomId)).resolves.toMatchObject({ acceptedRevision: 1, stale: true });
    const tampered = JSON.stringify(snapshot(2, now));
    const request = await signedRequest(body, now);
    await expect(service.ingestInternal(new Request(request.url, { method: "POST", headers: request.headers, body: tampered }), roomId))
      .rejects.toMatchObject({ code: "HISTORY_SIGNATURE_INVALID" });
    await expect(service.ingestInternal(await signedRequest(tampered, now - 300_001), roomId)).rejects.toMatchObject({ code: "HISTORY_SIGNATURE_INVALID" });
  });

  it("requires the internal service-binding hostname", async () => {
    const now = 1_788_228_000_000;
    const repository = new MemoryHistoryRepository();
    repository.source = source(now);
    const service = new HistoryService(env, repository, metadata, () => now);
    const body = JSON.stringify(snapshot(1, now));
    const request = await signedRequest(body, now, "https://public.example");
    await expect(service.ingestInternal(request, roomId)).rejects.toMatchObject({ code: "HISTORY_SIGNATURE_INVALID" });
  });
});

describe("history timezone aggregation", () => {
  for (const offset of [-840, 0, 480, 840]) {
    it(`splits local midnight at offset ${offset}`, () => {
      const offsetMs = offset * 60_000;
      const from = Date.UTC(2026, 7, 1) - offsetMs;
      const to = Date.UTC(2026, 8, 1) - offsetMs;
      const startedAt = Date.UTC(2026, 7, 15, 23, 59) - offsetMs;
      const summary = aggregateHistoryMonth(pairId, false, "2026-08", offset, from, to, [{
        id: id("5"), sessionId: id("6"), bvid: "BV1xx411c7mD", page: 1, startedAt, endedAt: startedAt + 120_000,
      }]);
      expect(summary.days).toEqual([
        { date: "2026-08-15", watchedSeconds: 60, sessionCount: 1 },
        { date: "2026-08-16", watchedSeconds: 60, sessionCount: 1 },
      ]);
      expect(summary.totalWatchedSeconds).toBe(120);
    });
  }

  it("clips cross-month intervals and returns an empty month", () => {
    const start = Date.UTC(2026, 7, 31, 23, 59);
    const summary = aggregateHistoryMonth(pairId, false, "2026-08", 0, Date.UTC(2026, 7, 1), Date.UTC(2026, 8, 1), [{
      id: id("7"), sessionId: id("8"), bvid: "BV1xx411c7mD", page: 1, startedAt: start, endedAt: start + 120_000,
    }]);
    expect(summary.totalWatchedSeconds).toBe(60);
    expect(summary.lastWatchedDate).toBe("2026-08-31");
    expect(aggregateHistoryMonth(pairId, false, "2026-08", 0, 0, 1, []).days).toEqual([]);
  });
});

function user(userId: string, nickname: string): UserRecord {
  return { id: userId, emailHmac: "hmac-" + userId, emailMasked: nickname + "***@example.com", nickname, avatarId: "signal-01", createdAt: 1, updatedAt: 1 };
}

function source(now: number): WatchRoomSourceRecord {
  return { id: id("4"), pairId, roomId, hostUserId: userA.id, guestUserId: userB.id, status: "active", lastIngestedRevision: 0, absoluteExpiresAt: now + 3_600_000, createdAt: now, updatedAt: now, closedAt: null, revokedAt: null };
}

function snapshot(revision: number, now: number): HistoryIngestSnapshot {
  return { sourceId: id("4"), pairId, roomId, sourceRevision: revision, observedAt: now, closed: false, participants: { hostUserId: userA.id, guestUserId: userB.id }, intervals: [] };
}

async function signedRequest(body: string, timestamp: number, origin = "https://account.internal"): Promise<Request> {
  return new Request(origin + "/internal/history/sources/" + roomId + "/snapshot", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tongkan-history-timestamp": String(timestamp),
      "x-tongkan-history-signature": await hmacHex("ingest-secret", String(timestamp) + "\n" + body),
    },
    body,
  });
}
