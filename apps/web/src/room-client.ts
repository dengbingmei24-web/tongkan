import type {
  AuthMessage,
  ChatMessage,
  ClientMessage,
  PeerCapabilities,
  PlaybackCommandMessage,
  PlaybackReportMessage,
  RtcSignalPayload,
  RoomSnapshot,
  ScreenStartMessage,
  ScreenStopMessage,
  ServerEvent,
} from "@tongkan/protocol";

export interface RoomClientOptions {
  roomId: string;
  key: string;
  nickname: string;
  capabilities: PeerCapabilities;
  onEvent: (event: ServerEvent) => void;
  onConnectionChange: (state: ConnectionState) => void;
}

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "closed" | "error";
export type ExtensionDetectionState = "checking" | "installed" | "missing";

const RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 4_000, 8_000] as const;
const CREATE_ROOM_TIMEOUT_MS = 8_000;

export function reconnectDelayMs(attempt: number): number {
  const index = Math.min(Math.max(0, attempt), RECONNECT_DELAYS_MS.length - 1);
  return RECONNECT_DELAYS_MS[index] ?? RECONNECT_DELAYS_MS.at(-1) ?? 8_000;
}

export function roomClientCapabilities(
  base: PeerCapabilities,
  extensionState: ExtensionDetectionState,
): PeerCapabilities | null {
  if (extensionState === "checking") return null;
  return { ...base, canControlBilibili: extensionState === "installed" };
}

const SIGNALING_HTTP = import.meta.env.VITE_SIGNALING_HTTP ?? "http://localhost:8787";
const SIGNALING_WS = import.meta.env.VITE_SIGNALING_WS
  ?? SIGNALING_HTTP.replace(/^http/, "ws");

export class RoomClient {
  private socket: WebSocket | null = null;
  private pingTimer: number | null = null;
  private authTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private shouldReconnect = false;
  private listeningForOnline = false;
  private serverOffsetMs = 0;

  constructor(private readonly options: RoomClientOptions) {}

  connect(): void {
    this.shouldReconnect = true;
    if (!this.listeningForOnline) {
      window.addEventListener("online", this.handleOnline);
      this.listeningForOnline = true;
    }
    if (this.socket || this.reconnectTimer !== null) return;
    this.openSocket();
  }

  reconnectNow(): void {
    this.shouldReconnect = true;
    if (!this.listeningForOnline) {
      window.addEventListener("online", this.handleOnline);
      this.listeningForOnline = true;
    }
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    const previous = this.socket;
    this.socket = null;
    this.clearConnectionTimers();
    previous?.close(4000, "manual reconnect");
    this.openSocket();
  }

  private openSocket(): void {
    this.options.onConnectionChange("connecting");
    const socket = new WebSocket(`${SIGNALING_WS}/rooms/${this.options.roomId}`);
    this.socket = socket;
    socket.addEventListener("open", () => {
      if (socket !== this.socket) return;
      this.sendOn(socket, {
        type: "auth",
        key: this.options.key,
        nickname: this.options.nickname,
        capabilities: this.options.capabilities,
      } satisfies AuthMessage);
      this.authTimer = window.setTimeout(() => {
        if (socket === this.socket) socket.close(4000, "authentication timeout");
      }, 8_000);
    });
    socket.addEventListener("message", (event) => {
      if (socket !== this.socket) return;
      const message = JSON.parse(String(event.data)) as ServerEvent;
      const receivedAt = Date.now();
      if (message.type === "pong") {
        const midpoint = message.clientSentAtMs + (receivedAt - message.clientSentAtMs) / 2;
        this.serverOffsetMs = message.serverSentAtMs - midpoint;
      }
      if (message.type === "auth.ok" || message.type === "room.snapshot") {
        this.serverOffsetMs = message.snapshot.serverNowMs - receivedAt;
      }
      if (message.type === "auth.ok") {
        this.clearAuthTimer();
        this.reconnectAttempt = 0;
        this.options.onConnectionChange("connected");
        this.clearPingTimer();
        this.pingTimer = window.setInterval(() => {
          this.send({ type: "ping", clientSentAtMs: Date.now() });
        }, 5_000);
      }
      this.options.onEvent(message);
    });
    socket.addEventListener("close", (event) => {
      if (socket !== this.socket) return;
      this.socket = null;
      this.clearConnectionTimers();
      if (!this.shouldReconnect) {
        this.options.onConnectionChange("closed");
        return;
      }
      if (event.code === 4001 || event.code === 4002) {
        this.shouldReconnect = false;
        this.options.onConnectionChange("error");
        return;
      }
      this.scheduleReconnect();
    });
    socket.addEventListener("error", () => {
      if (socket !== this.socket) return;
      this.options.onConnectionChange("reconnecting");
    });
  }

  close(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.clearConnectionTimers();
    if (this.listeningForOnline) {
      window.removeEventListener("online", this.handleOnline);
      this.listeningForOnline = false;
    }
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, "client closed");
  }

  sendCommand(message: Omit<PlaybackCommandMessage, "type" | "commandId" | "clientSentAtMs">): void {
    this.send({
      ...message,
      type: "playback.command",
      commandId: crypto.randomUUID(),
      clientSentAtMs: Date.now(),
    } as PlaybackCommandMessage);
  }

  sendReport(report: PlaybackReportMessage["report"]): void {
    this.send({ type: "playback.report", report } satisfies PlaybackReportMessage);
  }

  sendChat(text: string): void {
    this.send({
      type: "chat.message",
      messageId: crypto.randomUUID(),
      text,
      clientSentAtMs: Date.now(),
    } satisfies ChatMessage);
  }

  sendScreenStart(shareId: string, hasAudio: boolean): void {
    this.send({
      type: "screen.start",
      shareId,
      hasAudio,
      clientSentAtMs: Date.now(),
    } satisfies ScreenStartMessage);
  }

  sendScreenStop(shareId: string, reason: ScreenStopMessage["reason"]): void {
    this.send({ type: "screen.stop", shareId, reason } satisfies ScreenStopMessage);
  }

  sendScreenWatchReady(shareId: string): void {
    this.send({ type: "screen.watch.ready", shareId });
  }

  sendRtcSignal(shareId: string, signal: RtcSignalPayload): void {
    this.send({ type: "rtc.signal", shareId, signal });
  }

  serverNow(): number {
    return Date.now() + this.serverOffsetMs;
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private sendOn(socket: WebSocket, message: ClientMessage): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer !== null) return;
    const delay = reconnectDelayMs(this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.options.onConnectionChange("reconnecting");
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect && !this.socket) this.openSocket();
    }, delay);
  }

  private readonly handleOnline = () => {
    if (!this.shouldReconnect || this.socket?.readyState === WebSocket.OPEN) return;
    this.reconnectNow();
  };

  private clearPingTimer(): void {
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private clearAuthTimer(): void {
    if (this.authTimer !== null) window.clearTimeout(this.authTimer);
    this.authTimer = null;
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private clearConnectionTimers(): void {
    this.clearPingTimer();
    this.clearAuthTimer();
  }
}

export async function createRoom(): Promise<{
  roomId: string;
  hostKey: string;
  inviteKey: string;
}> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), CREATE_ROOM_TIMEOUT_MS);
  try {
    const response = await fetch(`${SIGNALING_HTTP}/api/rooms`, {
      method: "POST",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("房间服务没有响应，请确认信令服务已经启动。");
    return await response.json();
  } catch (reason) {
    if (reason instanceof Error && reason.message === "房间服务没有响应，请确认信令服务已经启动。") {
      throw reason;
    }
    if (controller.signal.aborted) {
      throw new Error("创建房间超时，请确认本地信令服务已经启动。");
    }
    throw new Error("无法连接房间服务，请确认本地信令服务已经启动。");
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function inviteUrl(roomId: string, inviteKey: string): string {
  return `${window.location.origin}/room/${roomId}#join=${inviteKey}`;
}

export function persistIdentity(roomId: string, role: "host" | "guest", key: string, nickname: string): void {
  localStorage.setItem(`tongkan:${roomId}:${role}`, JSON.stringify({ key, nickname }));
}

export function loadIdentity(roomId: string): { role: "host" | "guest"; key: string; nickname: string } | null {
  for (const role of ["host", "guest"] as const) {
    const raw = localStorage.getItem(`tongkan:${roomId}:${role}`);
    if (raw) return { role, ...JSON.parse(raw) };
  }
  return null;
}

export function getRoomIdFromPath(): string | null {
  return window.location.pathname.match(/^\/room\/([a-f0-9]{32})\/?$/)?.[1] ?? null;
}

export function getHashCredential(): { role: "host" | "guest"; key: string } | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const host = params.get("host");
  const guest = params.get("join");
  if (host) return { role: "host", key: host };
  if (guest) return { role: "guest", key: guest };
  return null;
}

export function snapshotPartner(snapshot: RoomSnapshot, ownId: string): string {
  return Object.values(snapshot.members).find((member) => member && member.id !== ownId)?.nickname ?? "等待对方";
}
