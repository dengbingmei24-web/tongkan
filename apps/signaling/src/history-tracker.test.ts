import { describe, expect, it } from "vitest";
import type { ClientPlaybackReport, MemberSlot, RoomSnapshot } from "@tongkan/protocol";
import {
  HISTORY_FLUSH_GRACE_MS,
  HISTORY_REPORT_STALE_MS,
  HistoryTracker,
  type HistoryGrantPayload,
} from "./history-tracker";

const SECRET = "history-grant-secret-for-tests";
const ROOM_ID = "1".repeat(32);
const SOURCE_ID = "2".repeat(32);
const PAIR_ID = "3".repeat(32);
const HOST_USER_ID = "4".repeat(32);
const GUEST_USER_ID = "5".repeat(32);
const MEDIA = {
  type: "bilibili" as const,
  bvid: "BV1xx411c7mD",
  page: 1,
  canonicalUrl: "https://www.bilibili.com/video/BV1xx411c7mD",
  title: "测试视频",
};
const OTHER_MEDIA = {
  type: "bilibili" as const,
  bvid: "BV1GJ411x7h7",
  page: 2,
  canonicalUrl: "https://www.bilibili.com/video/BV1GJ411x7h7?p=2",
  title: "另一个视频",
};

function createTracker(): HistoryTracker {
  let id = 0;
  return HistoryTracker.create(ROOM_ID, {
    idFactory: () => (++id).toString(16).padStart(32, "0"),
  });
}

function snapshot(nowMs: number): RoomSnapshot {
  return {
    roomId: ROOM_ID,
    mode: "bilibili",
    locked: true,
    members: {
      host: { id: "host-member", role: "host", nickname: "A", connected: true, joinedAt: 1, lastSeenAt: nowMs },
      guest: { id: "guest-member", role: "guest", nickname: "B", connected: true, joinedAt: 1, lastSeenAt: nowMs },
    },
    playback: {
      media: MEDIA,
      paused: false,
      positionSeconds: 0,
      playbackRate: 1,
      anchoredAtServerMs: nowMs,
      sequence: 1,
      actorId: "host-member",
    },
    screenShare: null,
    bufferingSlots: [],
    serverNowMs: nowMs,
  };
}

function report(room: RoomSnapshot, overrides: Partial<ClientPlaybackReport> = {}): ClientPlaybackReport {
  return {
    sequenceApplied: room.playback.sequence,
    positionSeconds: 0,
    paused: false,
    readyState: 4,
    buffering: false,
    ended: false,
    durationSeconds: 1_200,
    media: room.playback.media,
    sentAtClientMs: room.serverNowMs,
    ...overrides,
  };
}

async function bindPair(tracker: HistoryTracker, room: RoomSnapshot, nowMs: number, exp = nowMs + 600_000): Promise<void> {
  const hostGrant = await signGrant("host", HOST_USER_ID, nowMs, exp);
  const guestGrant = await signGrant("guest", GUEST_USER_ID, nowMs, exp);
  await expect(tracker.bind("host", hostGrant, SECRET, room, nowMs)).resolves.toEqual({ ok: true, expiresAt: exp });
  await expect(tracker.bind("guest", guestGrant, SECRET, room, nowMs)).resolves.toEqual({ ok: true, expiresAt: exp });
}

describe("HistoryTracker strict overlap", () => {
  it("opens only after both grants and valid reports, then closes on pause", async () => {
    const tracker = createTracker();
    const room = snapshot(1_000);
    await bindPair(tracker, room, 1_000);

    tracker.recordReport("host", report(room), room, 1_000);
    expect(tracker.serialize().activeInterval).toBeNull();
    tracker.recordReport("guest", report(room), room, 1_000);
    expect(tracker.serialize().activeInterval?.startedAt).toBe(1_000);

    tracker.recordReport("guest", report(room, { paused: true }), room, 9_000);
    expect(tracker.pendingSnapshot(9_000)?.intervals).toEqual([
      expect.objectContaining({ startedAt: 1_000, endedAt: 9_000, endReason: "pause" }),
    ]);
  });

  it.each([
    ["host disconnected", (room: RoomSnapshot, guest: ClientPlaybackReport) => { room.members.host!.connected = false; return guest; }],
    ["anchor paused", (room: RoomSnapshot, guest: ClientPlaybackReport) => { room.playback.paused = true; return guest; }],
    ["screen share mode", (room: RoomSnapshot, guest: ClientPlaybackReport) => { room.mode = "screen-share"; return guest; }],
    ["guest not ready", (_room: RoomSnapshot, guest: ClientPlaybackReport) => ({ ...guest, readyState: 2 })],
    ["guest buffering", (_room: RoomSnapshot, guest: ClientPlaybackReport) => ({ ...guest, buffering: true })],
    ["guest ended", (_room: RoomSnapshot, guest: ClientPlaybackReport) => ({ ...guest, ended: true })],
    ["sequence mismatch", (_room: RoomSnapshot, guest: ClientPlaybackReport) => ({ ...guest, sequenceApplied: 0 })],
    ["media mismatch", (_room: RoomSnapshot, guest: ClientPlaybackReport) => ({ ...guest, media: OTHER_MEDIA })],
  ])("does not count invalid overlap: %s", async (_name, mutate) => {
    const tracker = createTracker();
    const room = snapshot(1_000);
    await bindPair(tracker, room, 1_000);
    const guestReport = mutate(room, report(room));
    tracker.recordReport("host", report(room), room, 1_000);
    tracker.recordReport("guest", guestReport, room, 1_000);
    tracker.advance(room, 5_000);

    expect(tracker.serialize().activeInterval).toBeNull();
    expect(tracker.pendingSnapshot(5_000)).toBeNull();
  });

  it("does not count when only one side has a history grant", async () => {
    const tracker = createTracker();
    const room = snapshot(1_000);
    const hostGrant = await signGrant("host", HOST_USER_ID, 1_000, 100_000);
    await tracker.bind("host", hostGrant, SECRET, room, 1_000);
    tracker.recordReport("host", report(room), room, 1_000);
    tracker.recordReport("guest", report(room), room, 1_000);
    tracker.advance(room, 10_000);

    expect(tracker.serialize().activeInterval).toBeNull();
    expect(tracker.pendingSnapshot(10_000)).toBeNull();
  });
});

describe("HistoryTracker timing boundaries", () => {
  it("ends at the exact 12 second stale deadline", async () => {
    const tracker = createTracker();
    const room = snapshot(1_000);
    await bindPair(tracker, room, 1_000);
    tracker.recordReport("host", report(room), room, 1_000);
    tracker.recordReport("guest", report(room), room, 1_000);

    tracker.advance(room, 1_000 + HISTORY_REPORT_STALE_MS - 1);
    expect(tracker.serialize().activeInterval).not.toBeNull();
    tracker.advance(room, 1_000 + HISTORY_REPORT_STALE_MS);

    expect(tracker.pendingSnapshot(20_000)?.intervals[0]).toMatchObject({
      startedAt: 1_000,
      endedAt: 13_000,
      endReason: "stale-report",
    });
  });

  it("ends at grant expiry and rejects expired or conflicting grants without mutating the source", async () => {
    const tracker = createTracker();
    const room = snapshot(1_000);
    await bindPair(tracker, room, 1_000, 5_000);
    tracker.recordReport("host", report(room), room, 1_000);
    tracker.recordReport("guest", report(room), room, 1_000);
    tracker.advance(room, 5_000);
    expect(tracker.pendingSnapshot(5_000)?.intervals[0]).toMatchObject({ endedAt: 5_000, endReason: "grant-expired" });

    const expired = await signGrant("host", HOST_USER_ID, 1_000, 2_000);
    await expect(tracker.bind("host", expired, SECRET, room, 5_000)).resolves.toEqual({
      ok: false,
      code: "HISTORY_GRANT_EXPIRED",
    });
    const wrongUser = await signGrant("guest", HOST_USER_ID, 5_000, 10_000);
    await expect(tracker.bind("guest", wrongUser, SECRET, room, 5_000)).resolves.toEqual({
      ok: false,
      code: "HISTORY_BIND_CONFLICT",
    });
    const tampered = (await signGrant("host", HOST_USER_ID, 5_000, 10_000)).replace(/.$/, "x");
    await expect(tracker.bind("host", tampered, SECRET, room, 5_000)).resolves.toEqual({
      ok: false,
      code: "INVALID_HISTORY_GRANT",
    });
  });

  it("checkpoints long playback, preserves sessions across seek/rate, and rotates on media change", async () => {
    const tracker = createTracker();
    let room = snapshot(1_000);
    await bindPair(tracker, room, 1_000, 200_000);
    tracker.recordReport("host", report(room), room, 1_000);
    tracker.recordReport("guest", report(room), room, 1_000);
    for (const nowMs of [10_000, 19_000, 28_000, 37_000, 46_000, 55_000]) {
      room = { ...room, serverNowMs: nowMs };
      tracker.recordReport("host", report(room), room, nowMs);
      tracker.recordReport("guest", report(room), room, nowMs);
    }
    room = { ...room, serverNowMs: 61_000 };
    tracker.recordReport("host", report(room), room, 61_000);
    tracker.recordReport("guest", report(room), room, 61_000);

    const seekRoom = structuredClone(room);
    seekRoom.playback.sequence = 2;
    tracker.playbackCommand("seek", room, seekRoom, 62_000);
    tracker.recordReport("host", report(seekRoom), seekRoom, 62_000);
    tracker.recordReport("guest", report(seekRoom), seekRoom, 62_000);

    const rateRoom = structuredClone(seekRoom);
    rateRoom.playback.sequence = 3;
    rateRoom.playback.playbackRate = 1.5;
    tracker.playbackCommand("rate", seekRoom, rateRoom, 63_000);
    tracker.recordReport("host", report(rateRoom), rateRoom, 63_000);
    tracker.recordReport("guest", report(rateRoom), rateRoom, 63_000);

    const changedRoom = structuredClone(rateRoom);
    changedRoom.playback.sequence = 4;
    changedRoom.playback.media = OTHER_MEDIA;
    changedRoom.playback.paused = true;
    tracker.playbackCommand("media-change", rateRoom, changedRoom, 64_000);
    const playingOther = structuredClone(changedRoom);
    playingOther.playback.sequence = 5;
    playingOther.playback.paused = false;
    tracker.playbackCommand("play", changedRoom, playingOther, 64_500);
    tracker.recordReport("host", report(playingOther), playingOther, 64_500);
    tracker.recordReport("guest", report(playingOther), playingOther, 64_500);
    tracker.recordReport("guest", report(playingOther, { ended: true }), playingOther, 65_000);

    const intervals = tracker.pendingSnapshot(65_000)?.intervals ?? [];
    expect(intervals.map((interval) => interval.endReason)).toEqual([
      "checkpoint",
      "checkpoint",
      "checkpoint",
      "media-change",
      "ended",
    ]);
    expect(new Set(intervals.slice(0, 4).map((interval) => interval.sessionId)).size).toBe(1);
    expect(intervals[4]?.sessionId).not.toBe(intervals[0]?.sessionId);
    expect(intervals.reduce((sum, interval) => sum + interval.endedAt - interval.startedAt, 0)).toBe(63_500);
  });

  it("restores an active interval after Durable Object reload and closes it deterministically", async () => {
    const tracker = createTracker();
    const room = snapshot(1_000);
    await bindPair(tracker, room, 1_000);
    tracker.recordReport("host", report(room), room, 1_000);
    tracker.recordReport("guest", report(room), room, 1_000);
    const stored = tracker.serialize();
    const activeIntervalId = stored.activeInterval?.intervalId;

    const restored = new HistoryTracker(stored, { idFactory: () => "f".repeat(32) });
    restored.advance(room, 13_000);

    expect(restored.pendingSnapshot(13_000)?.intervals[0]).toMatchObject({
      intervalId: activeIntervalId,
      endedAt: 13_000,
      endReason: "stale-report",
    });
  });

  it("closes on disconnect, resumes after rebind, and preserves the room/media session", async () => {
    const tracker = createTracker();
    const room = snapshot(1_000);
    await bindPair(tracker, room, 1_000);
    tracker.recordReport("host", report(room), room, 1_000);
    tracker.recordReport("guest", report(room), room, 1_000);
    const disconnected = structuredClone(room);
    disconnected.members.host!.connected = false;
    tracker.disconnect("host", disconnected, 3_000);

    const reconnected = structuredClone(room);
    const refreshedGrant = await signGrant("host", HOST_USER_ID, 4_000, 100_000);
    await tracker.bind("host", refreshedGrant, SECRET, reconnected, 4_000);
    tracker.recordReport("host", report(reconnected), reconnected, 4_000);
    tracker.recordReport("guest", report(reconnected), reconnected, 4_000);
    tracker.recordReport("guest", report(reconnected, { ended: true }), reconnected, 5_000);

    const intervals = tracker.pendingSnapshot(5_000)?.intervals ?? [];
    expect(intervals.map((interval) => interval.endReason)).toEqual(["disconnect", "ended"]);
    expect(intervals[0]?.sessionId).toBe(intervals[1]?.sessionId);
  });
});

describe("HistoryTracker retry and cleanup", () => {
  it("persists exponential retry, acknowledges intervals, and bounds room flush grace", async () => {
    const tracker = createTracker();
    const room = snapshot(1_000);
    await bindPair(tracker, room, 1_000);
    tracker.recordReport("host", report(room), room, 1_000);
    tracker.recordReport("guest", report(room), room, 1_000);
    tracker.recordReport("guest", report(room, { paused: true }), room, 2_000);
    const pending = tracker.pendingSnapshot(2_000)!;

    expect(tracker.retryDue(2_000)).toBe(true);
    tracker.markRecoverableFailure(2_000);
    expect(tracker.retryDue(2_999)).toBe(false);
    expect(tracker.retryDue(3_000)).toBe(true);

    const restored = new HistoryTracker(tracker.serialize());
    restored.acknowledge({
      sourceId: pending.sourceId,
      acceptedRevision: pending.sourceRevision,
      acceptedIntervalIds: [pending.intervals[0]!.intervalId],
      stale: false,
    }, 3_000);
    expect(restored.pendingSnapshot(3_000)).toBeNull();

    const closing = createTracker();
    await bindPair(closing, room, 1_000);
    closing.recordReport("host", report(room), room, 1_000);
    closing.recordReport("guest", report(room), room, 1_000);
    closing.closeRoom(room, 2_000);
    expect(closing.pendingSnapshot(2_000)).toMatchObject({ closed: true });
    expect(closing.shouldDestroy(2_000 + HISTORY_FLUSH_GRACE_MS - 1)).toBe(false);
    expect(closing.shouldDestroy(2_000 + HISTORY_FLUSH_GRACE_MS)).toBe(true);
  });

  it("emits a closed empty snapshot for a fully bound source", async () => {
    const tracker = createTracker();
    const room = snapshot(1_000);
    await bindPair(tracker, room, 1_000);

    tracker.closeRoom(room, 2_000);

    expect(tracker.pendingSnapshot(2_000)).toMatchObject({
      closed: true,
      intervals: [],
    });
    expect(tracker.shouldDestroy(2_000)).toBe(false);
  });

  it("bounds exponential retries and drops history after the retry ceiling", async () => {
    const tracker = createTracker();
    const room = snapshot(1_000);
    await bindPair(tracker, room, 1_000);
    tracker.recordReport("host", report(room), room, 1_000);
    tracker.recordReport("guest", report(room), room, 1_000);
    tracker.recordReport("guest", report(room, { paused: true }), room, 2_000);

    let nowMs = 2_000;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      tracker.markRecoverableFailure(nowMs);
      const nextAlarmAt = tracker.nextAlarmAt();
      if (nextAlarmAt !== null) nowMs = nextAlarmAt;
    }

    expect(tracker.pendingSnapshot(nowMs)).toBeNull();
    expect(tracker.retryDue(nowMs)).toBe(false);
  });
});

async function signGrant(
  slot: MemberSlot,
  userId: string,
  nowMs: number,
  exp: number,
): Promise<string> {
  const payload: HistoryGrantPayload = {
    v: 1,
    grantId: slot === "host" ? "6".repeat(32) : "7".repeat(32),
    sourceId: SOURCE_ID,
    pairId: PAIR_ID,
    userId,
    roomId: ROOM_ID,
    slot,
    iat: Math.max(1, nowMs - 100),
    exp,
  };
  const payloadSegment = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadSegment));
  return `${payloadSegment}.${base64UrlEncode(new Uint8Array(signature))}`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
