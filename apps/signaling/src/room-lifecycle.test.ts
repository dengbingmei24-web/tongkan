import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthMessage } from "@tongkan/protocol";
import { ROOM_EMPTY_TTL_MS, RoomSession } from "./room-session";
import { RoomDurableObject } from "./worker";

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

function authMessage(): AuthMessage {
  return {
    type: "auth",
    key: "host-key",
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
    const stored = RoomSession.create("room", "host-key", "guest-key", nowMs).serialize();

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
    const stored = RoomSession.create("room", "host-key", "guest-key", Date.now()).serialize();
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
    const stored = RoomSession.create("room", "host-key", "guest-key", nowMs - 5_000).serialize();
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
});
