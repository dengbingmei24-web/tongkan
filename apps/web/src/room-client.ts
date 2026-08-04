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
  onConnectionChange: (state: "connecting" | "connected" | "closed" | "error") => void;
}

const SIGNALING_HTTP = import.meta.env.VITE_SIGNALING_HTTP ?? "http://localhost:8787";
const SIGNALING_WS = import.meta.env.VITE_SIGNALING_WS
  ?? SIGNALING_HTTP.replace(/^http/, "ws");

export class RoomClient {
  private socket: WebSocket | null = null;
  private pingTimer: number | null = null;
  private serverOffsetMs = 0;

  constructor(private readonly options: RoomClientOptions) {}

  connect(): void {
    this.options.onConnectionChange("connecting");
    this.socket = new WebSocket(`${SIGNALING_WS}/rooms/${this.options.roomId}`);
    this.socket.addEventListener("open", () => {
      this.options.onConnectionChange("connected");
      this.send({
        type: "auth",
        key: this.options.key,
        nickname: this.options.nickname,
        capabilities: this.options.capabilities,
      } satisfies AuthMessage);
      this.pingTimer = window.setInterval(() => {
        this.send({ type: "ping", clientSentAtMs: Date.now() });
      }, 5_000);
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as ServerEvent;
      if (message.type === "pong") {
        const receivedAt = Date.now();
        const midpoint = message.clientSentAtMs + (receivedAt - message.clientSentAtMs) / 2;
        this.serverOffsetMs = message.serverSentAtMs - midpoint;
      }
      this.options.onEvent(message);
    });
    this.socket.addEventListener("close", () => {
      this.clearTimer();
      this.options.onConnectionChange("closed");
    });
    this.socket.addEventListener("error", () => {
      this.options.onConnectionChange("error");
    });
  }

  close(): void {
    this.clearTimer();
    this.socket?.close(1000, "client closed");
    this.socket = null;
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

  private clearTimer(): void {
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
    this.pingTimer = null;
  }
}

export async function createRoom(): Promise<{
  roomId: string;
  hostKey: string;
  inviteKey: string;
}> {
  const response = await fetch(`${SIGNALING_HTTP}/api/rooms`, { method: "POST" });
  if (!response.ok) throw new Error("房间服务没有响应，请确认信令服务已经启动。");
  return response.json();
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
