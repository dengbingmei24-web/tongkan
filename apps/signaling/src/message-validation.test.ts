import { describe, expect, it } from "vitest";
import {
  MAX_CHAT_LENGTH,
  MAX_CLIENT_MESSAGE_BYTES,
  MAX_ICE_CANDIDATE_LENGTH,
  MAX_DURATION_SECONDS,
  MAX_HISTORY_GRANT_LENGTH,
  MAX_NICKNAME_LENGTH,
  MAX_SDP_LENGTH,
  parseClientMessage,
} from "./message-validation";
import { RoomSession } from "./room-session";
import { RoomDurableObject } from "./worker";

const validCapabilities = {
  platform: "web",
  canControlBilibili: true,
  canShareScreen: true,
  canShareSystemAudio: true,
  canUseMicrophone: true,
};

function parse(value: unknown) {
  return parseClientMessage(JSON.stringify(value));
}

describe("parseClientMessage", () => {
  it("accepts optional history bind and both legacy and history-capable playback reports", () => {
    const baseReport = {
      sequenceApplied: 1,
      positionSeconds: 10,
      paused: false,
      readyState: 4,
      buffering: false,
      media: {
        type: "bilibili",
        bvid: "BV1xx411c7mD",
        page: 1,
        canonicalUrl: "https://www.bilibili.com/video/BV1xx411c7mD",
      },
      sentAtClientMs: 1_000,
    };
    expect(parse({ type: "history.bind", grant: "x".repeat(20) }).ok).toBe(true);
    expect(parse({ type: "playback.report", report: baseReport }).ok).toBe(true);
    expect(parse({
      type: "playback.report",
      report: { ...baseReport, ended: false, durationSeconds: null },
    }).ok).toBe(true);
  });

  it("rejects partial or invalid history report fields and oversized grants", () => {
    const report = {
      sequenceApplied: 1,
      positionSeconds: 10,
      paused: false,
      readyState: 4,
      buffering: false,
      media: null,
      sentAtClientMs: 1_000,
    };
    expect(parse({ type: "playback.report", report: { ...report, ended: false } }).ok).toBe(false);
    expect(parse({ type: "playback.report", report: { ...report, durationSeconds: 10 } }).ok).toBe(false);
    expect(parse({ type: "playback.report", report: { ...report, ended: false, durationSeconds: 0 } }).ok).toBe(false);
    expect(parse({
      type: "playback.report",
      report: { ...report, ended: false, durationSeconds: MAX_DURATION_SECONDS + 1 },
    }).ok).toBe(false);
    expect(parse({ type: "history.bind", grant: "x".repeat(MAX_HISTORY_GRANT_LENGTH + 1) }).ok).toBe(false);
  });

  it("accepts current auth, B23 media and RTC candidate messages", () => {
    expect(parse({
      type: "auth",
      key: "a".repeat(32),
      nickname: "小明",
      capabilities: validCapabilities,
    }).ok).toBe(true);
    expect(parse({
      type: "playback.command",
      commandId: "command-1",
      kind: "media-change",
      positionSeconds: 0,
      media: {
        type: "bilibili",
        bvid: "b23:AbCd123",
        page: 1,
        canonicalUrl: "https://b23.tv/AbCd123",
        unresolved: true,
      },
      clientSentAtMs: 1_000,
    }).ok).toBe(true);
    expect(parse({
      type: "rtc.signal",
      shareId: "share-1",
      signal: {
        kind: "candidate",
        candidate: { candidate: "candidate:1 1 UDP 1 192.0.2.1 9999 typ host", sdpMid: "0", sdpMLineIndex: 0 },
      },
    }).ok).toBe(true);
  });

  it("accepts legacy auth without webpage capability and valid ZIP0 media with it", () => {
    expect(parse({
      type: "auth",
      key: "a".repeat(32),
      nickname: "小明",
      capabilities: validCapabilities,
    }).ok).toBe(true);
    expect(parse({
      type: "auth",
      key: "a".repeat(32),
      nickname: "小明",
      capabilities: { ...validCapabilities, canControlWebpage: true },
    }).ok).toBe(true);
    expect(parse({
      type: "playback.command",
      commandId: "command-zip0",
      kind: "media-change",
      positionSeconds: 0,
      media: {
        type: "webpage",
        site: "zip0",
        url: "https://www.zip0.com/watch?episode=1&id=158205&source=bfzy",
        contentKey: "zip0:bfzy:158205:1",
        title: "测试视频",
      },
      clientSentAtMs: 1_000,
    }).ok).toBe(true);
  });

  it("rejects invalid webpage identities and malformed optional capability", () => {
    expect(parse({
      type: "auth",
      key: "a".repeat(32),
      nickname: "小明",
      capabilities: { ...validCapabilities, canControlWebpage: "yes" },
    }).ok).toBe(false);
    expect(parse({
      type: "playback.command",
      commandId: "command-zip0-fragment",
      kind: "media-change",
      positionSeconds: 0,
      media: {
        type: "webpage",
        site: "zip0",
        url: "https://zip0.com/watch?source=bfzy&id=158205&episode=1#secret",
        contentKey: "zip0:bfzy:158205:1",
      },
      clientSentAtMs: 1_000,
    }).ok).toBe(false);
    expect(parse({
      type: "playback.command",
      commandId: "command-zip0-stream",
      kind: "media-change",
      positionSeconds: 0,
      media: {
        type: "webpage",
        site: "zip0",
        url: "https://zip0.com/watch?source=bfzy&id=158205&episode=1&stream=https%3A%2F%2Fcdn.example%2Fv.m3u8",
        contentKey: "zip0:bfzy:158205:1",
      },
      clientSentAtMs: 1_000,
    }).ok).toBe(false);
  });

  it("rejects malformed JSON, binary payloads and messages above 64 KiB", () => {
    expect(parseClientMessage("{"))
      .toEqual({ ok: false, reason: "INVALID_MESSAGE" });
    expect(parseClientMessage(new ArrayBuffer(8)))
      .toEqual({ ok: false, reason: "INVALID_MESSAGE" });
    expect(parseClientMessage("x".repeat(MAX_CLIENT_MESSAGE_BYTES + 1)))
      .toEqual({ ok: false, reason: "MESSAGE_TOO_LARGE" });
  });

  it("rejects unknown top-level and nested fields", () => {
    expect(parse({ type: "ping", clientSentAtMs: 1_000, admin: true }).ok).toBe(false);
    expect(parse({
      type: "auth",
      key: "a".repeat(32),
      nickname: "小明",
      capabilities: { ...validCapabilities, elevated: true },
    }).ok).toBe(false);
  });

  it("rejects an AV media identity whose aid disagrees with its av identifier", () => {
    expect(parse({
      type: "playback.command",
      commandId: "command-av-mismatch",
      kind: "media-change",
      positionSeconds: 0,
      media: {
        type: "bilibili",
        bvid: "av123",
        aid: 456,
        page: 1,
        canonicalUrl: "https://www.bilibili.com/video/av456",
      },
      clientSentAtMs: 1_000,
    }).ok).toBe(false);
  });

  it("rejects non-finite playback values produced by extreme JSON numbers", () => {
    const result = parseClientMessage(
      '{"type":"playback.command","commandId":"c","kind":"seek","positionSeconds":1e400,"clientSentAtMs":1000}',
    );
    expect(result).toEqual({ ok: false, reason: "INVALID_MESSAGE" });
  });

  it("rejects overlong nicknames and chat messages", () => {
    expect(parse({
      type: "auth",
      key: "a".repeat(32),
      nickname: "x".repeat(MAX_NICKNAME_LENGTH + 1),
      capabilities: validCapabilities,
    }).ok).toBe(false);
    expect(parse({
      type: "chat.message",
      messageId: "message-1",
      text: "x".repeat(MAX_CHAT_LENGTH + 1),
      clientSentAtMs: 1_000,
    }).ok).toBe(false);
  });

  it("rejects overlong SDP and ICE candidate strings", () => {
    expect(parse({
      type: "rtc.signal",
      shareId: "share-1",
      signal: {
        kind: "description",
        description: { type: "offer", sdp: "x".repeat(MAX_SDP_LENGTH + 1) },
      },
    }).ok).toBe(false);
    expect(parse({
      type: "rtc.signal",
      shareId: "share-1",
      signal: {
        kind: "candidate",
        candidate: {
          candidate: "x".repeat(MAX_ICE_CANDIDATE_LENGTH + 1),
          sdpMid: "0",
          sdpMLineIndex: 0,
        },
      },
    }).ok).toBe(false);
  });
});

describe("RoomDurableObject message validation gate", () => {
  it("rejects an auth message with an unknown field before authenticating the socket", async () => {
    const values = new Map<string, unknown>();
    const storage = {
      get: async (key: string) => values.get(key),
      put: async (key: string, value: unknown) => { values.set(key, value); },
      setAlarm: async () => undefined,
      deleteAlarm: async () => undefined,
    };
    const sent: string[] = [];
    const socket = {
      deserializeAttachment: () => ({ authenticated: false }),
      serializeAttachment: () => { throw new Error("invalid message must not authenticate"); },
      send: (payload: string) => { sent.push(payload); },
    } as unknown as WebSocket;
    const state = {
      storage,
      getWebSockets: () => [socket],
      acceptWebSocket: () => undefined,
    } as unknown as DurableObjectState;
    const room = new RoomDurableObject(state);
    const stored = RoomSession.create("room", "a".repeat(32), "b".repeat(32), Date.now()).serialize();
    await room.fetch(new Request("https://room.internal/initialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(stored),
    }));

    await room.webSocketMessage(socket, JSON.stringify({
      type: "auth",
      key: "a".repeat(32),
      nickname: "小明",
      capabilities: validCapabilities,
      admin: true,
    }));

    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0] ?? "{}")).toMatchObject({ type: "error", code: "INVALID_MESSAGE" });
  });
});
