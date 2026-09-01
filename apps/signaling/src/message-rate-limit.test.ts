import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage, ClientMessage, HistoryBindMessage, PingMessage, RtcSignalMessage } from "@tongkan/protocol";
import { MemberMessageRateLimiter, MESSAGE_RATE_LIMIT_POLICIES } from "./message-rate-limit";
import { RoomSession } from "./room-session";
import { RoomDurableObject } from "./worker";

afterEach(() => {
  vi.useRealTimers();
});

function chat(index: number): ChatMessage {
  return { type: "chat.message", messageId: `message-${index}`, text: `hello ${index}`, clientSentAtMs: 1_000 };
}

const ping: PingMessage = { type: "ping", clientSentAtMs: 1_000 };
const historyBind: HistoryBindMessage = { type: "history.bind", grant: "x".repeat(20) };
const candidate: RtcSignalMessage = {
  type: "rtc.signal",
  shareId: "share-1",
  signal: {
    kind: "candidate",
    candidate: { candidate: "candidate:1 1 UDP 1 192.0.2.1 9999 typ host", sdpMid: "0", sdpMLineIndex: 0 },
  },
};
const playback: ClientMessage = {
  type: "playback.command",
  commandId: "command-1",
  kind: "play",
  positionSeconds: 0,
  clientSentAtMs: 1_000,
};

describe("MemberMessageRateLimiter", () => {
  it("limits a chat burst and restores one token after one second", () => {
    const limiter = new MemberMessageRateLimiter();
    const capacity = MESSAGE_RATE_LIMIT_POLICIES["chat.message"].capacity;
    for (let index = 0; index < capacity; index += 1) {
      expect(limiter.allow("host", chat(index), 1_000)).toBe(true);
    }
    expect(limiter.allow("host", chat(capacity), 1_000)).toBe(false);
    expect(limiter.allow("host", chat(capacity + 1), 2_000)).toBe(true);
    expect(limiter.allow("host", chat(capacity + 2), 2_000)).toBe(false);
  });

  it("isolates member slots and message categories", () => {
    const limiter = new MemberMessageRateLimiter();
    const capacity = MESSAGE_RATE_LIMIT_POLICIES["chat.message"].capacity;
    for (let index = 0; index < capacity; index += 1) limiter.allow("host", chat(index), 1_000);

    expect(limiter.allow("host", chat(capacity), 1_000)).toBe(false);
    expect(limiter.allow("guest", chat(0), 1_000)).toBe(true);
    expect(limiter.allow("host", playback, 1_000)).toBe(true);
  });

  it("allows normal pings and ICE bursts but rejects sustained floods", () => {
    const limiter = new MemberMessageRateLimiter();
    const pingCapacity = MESSAGE_RATE_LIMIT_POLICIES.ping.capacity;
    for (let index = 0; index < pingCapacity; index += 1) expect(limiter.allow("host", ping, 1_000)).toBe(true);
    expect(limiter.allow("host", ping, 1_000)).toBe(false);
    expect(limiter.allow("host", ping, 3_000)).toBe(true);

    const candidateCapacity = MESSAGE_RATE_LIMIT_POLICIES["rtc.candidate"].capacity;
    for (let index = 0; index < candidateCapacity; index += 1) {
      expect(limiter.allow("guest", candidate, 1_000)).toBe(true);
    }
    expect(limiter.allow("guest", candidate, 1_000)).toBe(false);
    expect(limiter.allow("guest", candidate, 1_100)).toBe(true);
  });

  it("limits history grants without consuming playback capacity", () => {
    const limiter = new MemberMessageRateLimiter();
    const capacity = MESSAGE_RATE_LIMIT_POLICIES["history.bind"].capacity;
    for (let index = 0; index < capacity; index += 1) {
      expect(limiter.allow("host", historyBind, 1_000)).toBe(true);
    }
    expect(limiter.allow("host", historyBind, 1_000)).toBe(false);
    expect(limiter.allow("host", playback, 1_000)).toBe(true);
    expect(limiter.allow("host", historyBind, 6_000)).toBe(true);
  });
});

describe("RoomDurableObject message rate limit", () => {
  it("returns RATE_LIMITED after a member exhausts the chat bucket", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T00:00:00Z"));
    const values = new Map<string, unknown>();
    const sent: string[] = [];
    const socket = {
      readyState: 1,
      deserializeAttachment: () => ({ authenticated: true, slot: "host" }),
      send: (payload: string) => { sent.push(payload); },
    } as unknown as WebSocket;
    const state = {
      storage: {
        get: async (key: string) => values.get(key),
        put: async (key: string, value: unknown) => { values.set(key, value); },
        setAlarm: async () => undefined,
        deleteAlarm: async () => undefined,
      },
      getWebSockets: () => [socket],
      acceptWebSocket: () => undefined,
    } as unknown as DurableObjectState;
    const session = RoomSession.create("room", "a".repeat(32), "b".repeat(32), Date.now());
    session.authenticate({
      type: "auth",
      key: "a".repeat(32),
      nickname: "小明",
      capabilities: {
        platform: "web",
        canControlBilibili: true,
        canShareScreen: true,
        canShareSystemAudio: true,
        canUseMicrophone: true,
      },
    }, Date.now());
    const room = new RoomDurableObject(state);
    await room.fetch(new Request("https://room.internal/initialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(session.serialize()),
    }));

    const capacity = MESSAGE_RATE_LIMIT_POLICIES["chat.message"].capacity;
    for (let index = 0; index <= capacity; index += 1) {
      await room.webSocketMessage(socket, JSON.stringify(chat(index)));
    }

    expect(sent).toHaveLength(capacity + 1);
    expect(JSON.parse(sent.at(-1) ?? "{}")).toMatchObject({ type: "error", code: "RATE_LIMITED" });

    const historyStart = sent.length;
    const historyCapacity = MESSAGE_RATE_LIMIT_POLICIES["history.bind"].capacity;
    for (let index = 0; index <= historyCapacity; index += 1) {
      await room.webSocketMessage(socket, JSON.stringify(historyBind));
    }
    const historyResponses = sent.slice(historyStart).map((value) => JSON.parse(value));
    expect(historyResponses).toHaveLength(historyCapacity + 1);
    expect(historyResponses[0]).toMatchObject({ type: "error", code: "INVALID_HISTORY_GRANT" });
    expect(historyResponses.at(-1)).toMatchObject({ type: "error", code: "RATE_LIMITED" });
  });
});
