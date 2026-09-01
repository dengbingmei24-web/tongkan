import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthMessage } from "@tongkan/protocol";
import type { Env } from "./env";
import type { HistoryGrantPayload, HistoryIngestSnapshot } from "./history-tracker";
import { ROOM_EMPTY_TTL_MS, RoomSession } from "./room-session";
import { RoomDurableObject } from "./worker";

const HOST_KEY = "a".repeat(32);
const GUEST_KEY = "b".repeat(32);

function createStateHarness() {
  const values = new Map<string, unknown>();
  let sockets: WebSocket[] = [];
  const storage = {
    get: vi.fn(async (key: string) => values.get(key)),
    put: vi.fn(async (key: string, value: unknown) => { values.set(key, value); }),
    setAlarm: vi.fn(async (_scheduledTime: number | Date) => undefined),
    deleteAlarm: vi.fn(async () => undefined),
    deleteAll: vi.fn(async () => { values.clear(); }),
  };
  const state = {
    storage,
    getWebSockets: vi.fn(() => sockets),
    acceptWebSocket: vi.fn(),
  } as unknown as DurableObjectState;
  return {
    state,
    storage,
    seed(key: string, value: unknown) { values.set(key, value); },
    read(key: string) { return values.get(key); },
    setSockets(value: WebSocket[]) { sockets = value; },
  };
}

function createSocket() {
  let attachment: unknown = { authenticated: false };
  const socket = {
    readyState: 1,
    deserializeAttachment: vi.fn(() => attachment),
    serializeAttachment: vi.fn((value: unknown) => { attachment = value; }),
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as WebSocket;
  return socket;
}

function createRecordingSocket() {
  let attachment: unknown = { authenticated: false };
  const sent: string[] = [];
  const close = vi.fn();
  const socket = {
    readyState: 1,
    deserializeAttachment: vi.fn(() => attachment),
    serializeAttachment: vi.fn((value: unknown) => { attachment = value; }),
    send: vi.fn((payload: string) => { sent.push(payload); }),
    close,
  } as unknown as WebSocket;
  return { socket, sent, close };
}

function authMessage(): AuthMessage {
  return {
    type: "auth",
    key: HOST_KEY,
    nickname: "小明",
    capabilities: {
      platform: "web",
      canControlBilibili: true,
      canShareScreen: true,
      canShareSystemAudio: true,
      canUseMicrophone: true,
    },
  };
}

function authFor(key: string, nickname: string): AuthMessage {
  return { ...authMessage(), key, nickname, capabilities: { ...authMessage().capabilities, platform: "android" } };
}

describe("RoomDurableObject lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("deletes an unused room when its ten-minute alarm expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T00:00:00Z"));
    const nowMs = Date.now();
    const harness = createStateHarness();
    const room = new RoomDurableObject(harness.state);
    const stored = RoomSession.create("room", HOST_KEY, GUEST_KEY, nowMs).serialize();

    await room.fetch(new Request("https://room.internal/initialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(stored),
    }));
    expect(harness.storage.setAlarm).toHaveBeenLastCalledWith(nowMs + ROOM_EMPTY_TTL_MS);

    vi.advanceTimersByTime(ROOM_EMPTY_TTL_MS);
    await room.alarm();

    expect(harness.storage.deleteAll).toHaveBeenCalledOnce();
    const response = await room.fetch(new Request("https://room.internal/snapshot"));
    expect(response.status).toBe(404);
  });

  it("cancels the alarm on authentication and restores it after the last socket leaves", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T00:00:00Z"));
    const harness = createStateHarness();
    const socket = createSocket();
    harness.setSockets([socket]);
    const room = new RoomDurableObject(harness.state);
    const stored = RoomSession.create("room", HOST_KEY, GUEST_KEY, Date.now()).serialize();
    await room.fetch(new Request("https://room.internal/initialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(stored),
    }));

    await room.webSocketMessage(socket, JSON.stringify(authMessage()));
    expect(harness.storage.deleteAlarm).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(2_000);
    await room.webSocketClose(socket);
    expect(harness.storage.setAlarm).toHaveBeenLastCalledWith(Date.now() + ROOM_EMPTY_TTL_MS);
  });

  it("reconciles stale online state and purges a sensitive URL during cold load", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T00:00:00Z"));
    const nowMs = Date.now();
    const harness = createStateHarness();
    const stored = RoomSession.create("room", HOST_KEY, GUEST_KEY, nowMs - 5_000).serialize();
    const active = new RoomSession(stored);
    active.authenticate(authMessage(), nowMs - 4_000);
    const legacy = active.serialize();
    legacy.mode = "direct-video";
    legacy.playback = {
      ...legacy.playback,
      media: { type: "direct", url: "https://media.example.com/movie.mp4?token=private" },
    };
    harness.seed("session", legacy);
    const room = new RoomDurableObject(harness.state);

    const response = await room.fetch(new Request("https://room.internal/snapshot"));
    const snapshot = await response.json() as { members: { host?: { connected: boolean } }; playback: { media: unknown } };
    const persisted = harness.read("session") as ReturnType<RoomSession["serialize"]>;

    expect(response.status).toBe(200);
    expect(snapshot.members.host?.connected).toBe(false);
    expect(snapshot.playback.media).toBeNull();
    expect(persisted.playback.media).toBeNull();
    expect(harness.storage.setAlarm).toHaveBeenLastCalledWith(nowMs + ROOM_EMPTY_TTL_MS);
  });

  it("binds account history, retries failed ingest by alarm, and keeps chat fail-open", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    const nowMs = Date.now();
    const roomId = "1".repeat(32);
    const harness = createStateHarness();
    const host = createRecordingSocket();
    const guest = createRecordingSocket();
    harness.setSockets([host.socket, guest.socket]);
    let attempts = 0;
    const accountFetch = vi.fn(async (request: Request) => {
      attempts += 1;
      const body = await request.json() as HistoryIngestSnapshot;
      if (attempts === 1) return new Response("temporary", { status: 503 });
      return Response.json({
        sourceId: body.sourceId,
        acceptedRevision: body.sourceRevision,
        acceptedIntervalIds: body.intervals.map((interval) => interval.intervalId),
        stale: false,
      });
    });
    const room = new RoomDurableObject(harness.state, {
      HISTORY_GRANT_SECRET: "grant-secret",
      HISTORY_INGEST_SECRET: "ingest-secret",
      ACCOUNT_HISTORY: { fetch: accountFetch } as unknown as Fetcher,
    } as Env);
    await room.fetch(new Request("https://room.internal/initialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(RoomSession.create(roomId, HOST_KEY, GUEST_KEY, nowMs).serialize()),
    }));
    await room.webSocketMessage(host.socket, JSON.stringify(authFor(HOST_KEY, "A")));
    await room.webSocketMessage(guest.socket, JSON.stringify(authFor(GUEST_KEY, "B")));
    await room.webSocketMessage(host.socket, JSON.stringify({ type: "history.bind", grant: "x".repeat(20) }));
    expect(host.sent.map((payload) => JSON.parse(payload))).toContainEqual(
      expect.objectContaining({ type: "error", code: "INVALID_HISTORY_GRANT" }),
    );
    expect(host.close).not.toHaveBeenCalled();
    const hostGrant = await signGrant("host", "4".repeat(32), roomId, nowMs);
    const guestGrant = await signGrant("guest", "5".repeat(32), roomId, nowMs);
    await room.webSocketMessage(host.socket, JSON.stringify({ type: "history.bind", grant: hostGrant }));
    await room.webSocketMessage(guest.socket, JSON.stringify({ type: "history.bind", grant: guestGrant }));
    const persistedHistory = JSON.stringify(harness.read("history"));
    expect(persistedHistory).not.toContain(hostGrant);
    expect(persistedHistory).not.toContain(guestGrant);
    expect(persistedHistory).not.toContain("grant-secret");
    expect(persistedHistory).not.toContain("ingest-secret");

    const media = {
      type: "bilibili",
      bvid: "BV1xx411c7mD",
      page: 1,
      canonicalUrl: "https://www.bilibili.com/video/BV1xx411c7mD",
    };
    await room.webSocketMessage(host.socket, JSON.stringify({
      type: "playback.command",
      commandId: "media",
      kind: "media-change",
      positionSeconds: 0,
      media,
      clientSentAtMs: nowMs,
    }));
    await room.webSocketMessage(host.socket, JSON.stringify({
      type: "playback.command",
      commandId: "play",
      kind: "play",
      positionSeconds: 0,
      clientSentAtMs: nowMs,
    }));
    const playbackReport = {
      sequenceApplied: 2,
      positionSeconds: 0,
      paused: false,
      readyState: 4,
      buffering: false,
      ended: false,
      durationSeconds: 1_200,
      media,
      sentAtClientMs: nowMs,
    };
    await room.webSocketMessage(host.socket, JSON.stringify({ type: "playback.report", report: playbackReport }));
    await room.webSocketMessage(guest.socket, JSON.stringify({ type: "playback.report", report: playbackReport }));
    expect(harness.storage.setAlarm).toHaveBeenLastCalledWith(nowMs + 12_000);

    vi.advanceTimersByTime(5_000);
    await room.webSocketMessage(host.socket, JSON.stringify({
      type: "playback.command",
      commandId: "pause",
      kind: "pause",
      positionSeconds: 5,
      clientSentAtMs: Date.now(),
    }));
    expect(accountFetch).toHaveBeenCalledOnce();
    expect(harness.storage.setAlarm).toHaveBeenLastCalledWith(Date.now() + 1_000);

    await room.webSocketMessage(host.socket, JSON.stringify({
      type: "chat.message",
      messageId: "after-history-failure",
      text: "房间继续可用",
      clientSentAtMs: Date.now(),
    }));
    expect(guest.sent.map((payload) => JSON.parse(payload))).toContainEqual(
      expect.objectContaining({ type: "chat.message", text: "房间继续可用" }),
    );
    expect(host.close).not.toHaveBeenCalled();
    expect(guest.close).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_000);
    await room.alarm();
    expect(accountFetch).toHaveBeenCalledTimes(2);
    expect(host.sent.map((payload) => JSON.parse(payload))).toContainEqual(
      expect.objectContaining({ type: "history.bound" }),
    );
    expect(guest.sent.map((payload) => JSON.parse(payload))).toContainEqual(
      expect.objectContaining({ type: "history.bound" }),
    );
    const boundEvent = host.sent.map((payload) => JSON.parse(payload) as Record<string, unknown>)
      .find((event) => event.type === "history.bound");
    expect(Object.keys(boundEvent ?? {}).sort()).toEqual(["expiresAt", "type"]);
  });

  it("restores active history state after Durable Object reload and closes at stale deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T01:00:00Z"));
    const nowMs = Date.now();
    const roomId = "1".repeat(32);
    const harness = createStateHarness();
    const host = createRecordingSocket();
    const guest = createRecordingSocket();
    harness.setSockets([host.socket, guest.socket]);
    const accountFetch = vi.fn(async (request: Request) => {
      const body = await request.json() as HistoryIngestSnapshot;
      return Response.json({
        sourceId: body.sourceId,
        acceptedRevision: body.sourceRevision,
        acceptedIntervalIds: body.intervals.map((interval) => interval.intervalId),
        stale: false,
      });
    });
    const env = {
      HISTORY_GRANT_SECRET: "grant-secret",
      HISTORY_INGEST_SECRET: "ingest-secret",
      ACCOUNT_HISTORY: { fetch: accountFetch } as unknown as Fetcher,
    } as Env;
    const first = new RoomDurableObject(harness.state, env);
    await first.fetch(new Request("https://room.internal/initialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(RoomSession.create(roomId, HOST_KEY, GUEST_KEY, nowMs).serialize()),
    }));
    await first.webSocketMessage(host.socket, JSON.stringify(authFor(HOST_KEY, "A")));
    await first.webSocketMessage(guest.socket, JSON.stringify(authFor(GUEST_KEY, "B")));
    await first.webSocketMessage(host.socket, JSON.stringify({
      type: "history.bind",
      grant: await signGrant("host", "4".repeat(32), roomId, nowMs),
    }));
    await first.webSocketMessage(guest.socket, JSON.stringify({
      type: "history.bind",
      grant: await signGrant("guest", "5".repeat(32), roomId, nowMs),
    }));
    const media = {
      type: "bilibili",
      bvid: "BV1xx411c7mD",
      page: 1,
      canonicalUrl: "https://www.bilibili.com/video/BV1xx411c7mD",
    };
    await first.webSocketMessage(host.socket, JSON.stringify({
      type: "playback.command",
      commandId: "media",
      kind: "media-change",
      positionSeconds: 0,
      media,
      clientSentAtMs: nowMs,
    }));
    await first.webSocketMessage(host.socket, JSON.stringify({
      type: "playback.command",
      commandId: "play",
      kind: "play",
      positionSeconds: 0,
      clientSentAtMs: nowMs,
    }));
    const playbackReport = {
      sequenceApplied: 2,
      positionSeconds: 0,
      paused: false,
      readyState: 4,
      buffering: false,
      ended: false,
      durationSeconds: null,
      media,
      sentAtClientMs: nowMs,
    };
    await first.webSocketMessage(host.socket, JSON.stringify({ type: "playback.report", report: playbackReport }));
    await first.webSocketMessage(guest.socket, JSON.stringify({ type: "playback.report", report: playbackReport }));

    const reloaded = new RoomDurableObject(harness.state, env);
    vi.advanceTimersByTime(12_000);
    await reloaded.alarm();

    expect(accountFetch).toHaveBeenCalledOnce();
    const persistedHistory = harness.read("history") as { pendingIntervals: unknown[]; activeInterval: unknown };
    expect(persistedHistory.pendingIntervals).toHaveLength(0);
    expect(persistedHistory.activeInterval).toBeNull();
  });
});

async function signGrant(slot: "host" | "guest", userId: string, roomId: string, nowMs: number): Promise<string> {
  const payload: HistoryGrantPayload = {
    v: 1,
    grantId: slot === "host" ? "6".repeat(32) : "7".repeat(32),
    sourceId: "2".repeat(32),
    pairId: "3".repeat(32),
    userId,
    roomId,
    slot,
    iat: nowMs - 1_000,
    exp: nowMs + 10 * 60_000,
  };
  const payloadSegment = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("grant-secret"),
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
