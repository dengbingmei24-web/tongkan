import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot, ServerEvent } from "@tongkan/protocol";
import {
  createRoom,
  reconnectDelayMs,
  roomClientCapabilities,
  RoomClient,
  type ConnectionState,
} from "./room-client";

class FakeSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = FakeSocket.CONNECTING;
  readonly sent: string[] = [];

  constructor(readonly url: string) {
    super();
    sockets.push(this);
  }

  open(): void {
    this.readyState = FakeSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  message(event: ServerEvent): void {
    const message = new Event("message");
    Object.defineProperty(message, "data", { value: JSON.stringify(event) });
    this.dispatchEvent(message);
  }

  drop(code = 1006): void {
    this.readyState = FakeSocket.CLOSED;
    const close = new Event("close");
    Object.defineProperty(close, "code", { value: code });
    this.dispatchEvent(close);
  }

  close(code = 1000): void {
    this.drop(code);
  }

  send(payload: string): void {
    this.sent.push(payload);
  }
}

const sockets: FakeSocket[] = [];

function snapshot(serverNowMs: number): RoomSnapshot {
  return {
    roomId: "room",
    mode: "direct-video",
    locked: false,
    members: {},
    playback: {
      media: {
        type: "direct",
        url: "https://media.example.com/movie.mp4",
        title: "movie.mp4",
      },
      paused: false,
      positionSeconds: 12,
      playbackRate: 1,
      anchoredAtServerMs: serverNowMs,
      sequence: 4,
      actorId: "host-id",
    },
    screenShare: null,
    bufferingSlots: [],
    serverNowMs,
  };
}

function authOk(serverNowMs: number): ServerEvent {
  return {
    type: "auth.ok",
    member: {
      id: "host-id",
      role: "host",
      nickname: "测试者",
      connected: true,
      joinedAt: 1,
      lastSeenAt: serverNowMs,
    },
    snapshot: snapshot(serverNowMs),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  sockets.length = 0;
  const browserWindow = new EventTarget() as EventTarget & typeof globalThis;
  Object.assign(browserWindow, {
    setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
    clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
    setInterval: (...args: Parameters<typeof setInterval>) => setInterval(...args),
    clearInterval: (timer: ReturnType<typeof setInterval>) => clearInterval(timer),
  });
  vi.stubGlobal("window", browserWindow);
  vi.stubGlobal("WebSocket", FakeSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("RoomClient reconnect", () => {
  it("reconnects automatically and becomes connected only after a fresh snapshot", () => {
    const states: ConnectionState[] = [];
    const events: ServerEvent[] = [];
    const capabilities = roomClientCapabilities({
      platform: "web",
      canControlBilibili: false,
      canShareScreen: true,
      canShareSystemAudio: true,
      canUseMicrophone: false,
    }, "installed");
    expect(capabilities).not.toBeNull();
    const client = new RoomClient({
      roomId: "room",
      key: "host-key",
      nickname: "测试者",
      capabilities: capabilities!,
      onConnectionChange: (state) => states.push(state),
      onEvent: (event) => events.push(event),
    });

    client.connect();
    expect(states).toEqual(["connecting"]);
    expect(sockets).toHaveLength(1);

    sockets[0]!.open();
    expect(JSON.parse(sockets[0]!.sent[0] ?? "{}")).toMatchObject({
      type: "auth",
      key: "host-key",
      capabilities: { canControlBilibili: true },
    });
    expect(states).toEqual(["connecting"]);

    sockets[0]!.message(authOk(20_000));
    expect(states.at(-1)).toBe("connected");
    expect(events.at(-1)).toMatchObject({ type: "auth.ok", snapshot: { playback: { sequence: 4 } } });
    expect(client.serverNow()).toBe(20_000);

    sockets[0]!.drop();
    expect(states.at(-1)).toBe("reconnecting");
    vi.advanceTimersByTime(499);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
    expect(states.at(-1)).toBe("connecting");

    sockets[1]!.open();
    expect(JSON.parse(sockets[1]!.sent[0] ?? "{}")).toMatchObject({
      type: "auth",
      key: "host-key",
      capabilities: { canControlBilibili: true },
    });
    sockets[1]!.message(authOk(21_000));
    expect(states.at(-1)).toBe("connected");
    expect(events).toHaveLength(2);

    client.close();
    vi.advanceTimersByTime(20_000);
    expect(sockets).toHaveLength(2);
  });

  it("does not fight a newer tab that has replaced the same room slot", () => {
    const states: ConnectionState[] = [];
    const client = new RoomClient({
      roomId: "room",
      key: "host-key",
      nickname: "测试者",
      capabilities: {
        platform: "web",
        canControlBilibili: false,
        canShareScreen: false,
        canShareSystemAudio: false,
        canUseMicrophone: false,
      },
      onConnectionChange: (state) => states.push(state),
      onEvent: vi.fn(),
    });

    client.connect();
    sockets[0]!.open();
    sockets[0]!.drop(4002);
    vi.advanceTimersByTime(20_000);

    expect(states.at(-1)).toBe("error");
    expect(sockets).toHaveLength(1);
  });

  it("caps exponential backoff at eight seconds", () => {
    expect([0, 1, 2, 3, 4, 8].map(reconnectDelayMs)).toEqual([500, 1_000, 2_000, 4_000, 8_000, 8_000]);
  });
});

describe("roomClientCapabilities", () => {
  const base = {
    platform: "web" as const,
    canControlBilibili: false,
    canShareScreen: true,
    canShareSystemAudio: true,
    canUseMicrophone: false,
  };

  it("waits for extension detection before authentication", () => {
    expect(roomClientCapabilities(base, "checking")).toBeNull();
  });

  it("reports Bilibili control only when the extension is installed", () => {
    expect(roomClientCapabilities(base, "installed")?.canControlBilibili).toBe(true);
    expect(roomClientCapabilities(base, "missing")?.canControlBilibili).toBe(false);
  });
});

describe("createRoom", () => {
  it("creates a room without requiring media input", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ roomId: "room-id", hostKey: "host-key", inviteKey: "invite-key" }),
    }));

    await expect(createRoom()).resolves.toEqual({
      roomId: "room-id",
      hostKey: "host-key",
      inviteKey: "invite-key",
    });
  });

  it("reports a clear error when the local signaling service does not answer", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));

    const assertion = expect(createRoom()).rejects.toThrow("创建房间超时，请确认本地信令服务已经启动。");
    await vi.advanceTimersByTimeAsync(8_000);

    await assertion;
  });
});
