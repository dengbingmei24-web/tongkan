import type {
  AuthMessage,
  ChatMessage,
  ClientMessage,
  CreateRoomResponse,
  MemberSlot,
  PlaybackCommandMessage,
  PlaybackReportMessage,
  RtcSignalMessage,
  ScreenStartMessage,
  ScreenStopMessage,
  ScreenWatchReadyMessage,
  ServerEvent,
} from "@tongkan/protocol";
import type { Env } from "./env";
import { RoomSession, type StoredRoomSession } from "./room-session";

interface SocketAttachment {
  slot?: MemberSlot;
  authenticated: boolean;
}

const SESSION_KEY = "session";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
    },
  });
}

function randomKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function send(socket: WebSocket, event: ServerEvent): void {
  socket.send(JSON.stringify(event));
}

export class RoomDurableObject implements DurableObject {
  private session: RoomSession | null = null;

  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/initialize" && request.method === "POST") {
      if (this.session) return json({ initialized: true });
      const stored = await request.json<StoredRoomSession>();
      this.session = new RoomSession(stored);
      await this.persist();
      return json({ initialized: true }, 201);
    }

    await this.ensureLoaded();
    if (!this.session) return json({ error: "ROOM_NOT_FOUND" }, 404);

    if (url.pathname === "/snapshot") {
      return json(this.session.snapshot(Date.now()));
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return json({ error: "WEBSOCKET_REQUIRED" }, 426);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ authenticated: false } satisfies SocketAttachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    await this.ensureLoaded();
    if (!this.session || typeof raw !== "string") return;

    let message: ClientMessage;
    try {
      message = JSON.parse(raw) as ClientMessage;
    } catch {
      send(socket, { type: "error", code: "INVALID_MESSAGE", message: "消息格式无法识别。" });
      return;
    }

    const attachment = socket.deserializeAttachment() as SocketAttachment | null;
    if (!attachment?.authenticated) {
      if (message.type !== "auth") {
        send(socket, { type: "error", code: "NOT_AUTHENTICATED", message: "请先加入房间。" });
        return;
      }
      await this.authenticateSocket(socket, message);
      return;
    }

    const slot = attachment.slot;
    if (!slot) return;
    const nowMs = Date.now();
    this.session.touch(slot, nowMs);

    switch (message.type) {
      case "playback.command":
        await this.handlePlaybackCommand(socket, slot, message, nowMs);
        break;
      case "playback.report":
        await this.handlePlaybackReport(slot, message, nowMs);
        break;
      case "chat.message":
        this.handleChat(slot, message, nowMs);
        break;
      case "ping":
        send(socket, { type: "pong", clientSentAtMs: message.clientSentAtMs, serverSentAtMs: nowMs });
        break;
      case "screen.start":
        await this.handleScreenStart(socket, slot, message, nowMs);
        break;
      case "screen.stop":
        await this.handleScreenStop(socket, slot, message);
        break;
      case "screen.watch.ready":
        this.handleScreenWatchReady(socket, slot, message);
        break;
      case "rtc.signal":
        this.handleRtcSignal(socket, slot, message);
        break;
      case "auth":
        break;
    }
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    await this.ensureLoaded();
    const attachment = socket.deserializeAttachment() as SocketAttachment | null;
    if (!this.session || !attachment?.slot) return;
    const replacement = this.state.getWebSockets().some((candidate) => {
      if (candidate === socket || candidate.readyState !== WebSocket.OPEN) return false;
      const candidateAttachment = candidate.deserializeAttachment() as SocketAttachment | null;
      return candidateAttachment?.authenticated && candidateAttachment.slot === attachment.slot;
    });
    if (replacement) return;
    const member = this.session.disconnect(attachment.slot, Date.now());
    const stoppedShare = this.session.stopScreenShareForSlot(attachment.slot);
    await this.persist();
    if (member) this.broadcast({ type: "member.updated", member });
    if (stoppedShare) {
      this.broadcast({
        type: "screen.stopped",
        shareId: stoppedShare.shareId,
        reason: "disconnect",
        nextMode: stoppedShare.nextMode,
      });
      this.broadcast({ type: "room.snapshot", snapshot: this.session.snapshot(Date.now()) });
    }
  }

  private async authenticateSocket(socket: WebSocket, message: AuthMessage): Promise<void> {
    if (!this.session) return;
    const result = this.session.authenticate(message, Date.now());
    if (!result) {
      send(socket, { type: "error", code: "INVALID_KEY", message: "邀请链接已经失效。" });
      socket.close(4001, "invalid key");
      return;
    }
    let replacedExisting = false;
    for (const candidate of this.state.getWebSockets()) {
      if (candidate === socket || candidate.readyState !== WebSocket.OPEN) continue;
      const candidateAttachment = candidate.deserializeAttachment() as SocketAttachment | null;
      if (candidateAttachment?.authenticated && candidateAttachment.slot === result.slot) {
        replacedExisting = true;
        candidate.close(4002, "replaced by a newer connection");
      }
    }
    socket.serializeAttachment({ authenticated: true, slot: result.slot } satisfies SocketAttachment);
    const stoppedShare = replacedExisting ? this.session.stopScreenShareForSlot(result.slot) : null;
    await this.persist();
    send(socket, {
      type: "auth.ok",
      member: result.member,
      snapshot: this.session.snapshot(Date.now()),
    });
    this.broadcast({ type: "member.updated", member: result.member }, socket);
    if (stoppedShare) {
      this.broadcast({
        type: "screen.stopped",
        shareId: stoppedShare.shareId,
        reason: "disconnect",
        nextMode: stoppedShare.nextMode,
      });
      this.broadcast({ type: "room.snapshot", snapshot: this.session.snapshot(Date.now()) });
    }
  }

  private async handlePlaybackCommand(
    socket: WebSocket,
    slot: MemberSlot,
    message: PlaybackCommandMessage,
    nowMs: number,
  ): Promise<void> {
    if (!this.session) return;
    const anchor = this.session.applyPlaybackCommand(slot, message, nowMs);
    if (anchor === "RATE_LIMITED") {
      send(socket, { type: "error", code: "RATE_LIMITED", message: "拖动过于频繁，请松开进度条后再同步。" });
      return;
    }
    if (anchor === "INVALID_MEDIA") {
      send(socket, { type: "error", code: "INVALID_MESSAGE", message: "播放命令缺少必要数据。" });
      return;
    }
    await this.persist();
    const actor = this.session.getMember(slot);
    this.broadcast({
      type: "playback.anchor",
      anchor,
      actorNickname: actor?.nickname ?? "对方",
      commandId: message.commandId,
    });
  }

  private async handlePlaybackReport(
    slot: MemberSlot,
    message: PlaybackReportMessage,
    nowMs: number,
  ): Promise<void> {
    if (!this.session) return;
    const previousSequence = this.session.snapshot(nowMs).playback.sequence;
    this.session.applyPlaybackReport(slot, message.report, nowMs);
    const snapshot = this.session.snapshot(nowMs);
    await this.persist();
    if (snapshot.playback.sequence !== previousSequence) {
      this.broadcast({ type: "room.snapshot", snapshot });
    }
  }

  private handleChat(slot: MemberSlot, message: ChatMessage, nowMs: number): void {
    if (!this.session) return;
    const member = this.session.getMember(slot);
    if (!member) return;
    const text = message.text.trim().slice(0, 500);
    if (!text) return;
    this.broadcast({
      type: "chat.message",
      messageId: message.messageId,
      memberId: member.id,
      nickname: member.nickname,
      text,
      serverSentAtMs: nowMs,
    });
  }

  private async handleScreenStart(
    socket: WebSocket,
    slot: MemberSlot,
    message: ScreenStartMessage,
    nowMs: number,
  ): Promise<void> {
    if (!this.session) return;
    const result = this.session.startScreenShare(slot, message, nowMs);
    if (result === "SCREEN_BUSY") {
      send(socket, { type: "error", code: "SCREEN_BUSY", message: "对方正在共享屏幕，请先停止当前共享。" });
      return;
    }
    if (result === "INVALID_SCREEN_SHARE") {
      send(socket, { type: "error", code: "INVALID_SCREEN_SHARE", message: "屏幕共享请求缺少必要信息，请重试。" });
      return;
    }
    await this.persist();
    this.broadcast({ type: "screen.started", share: result });
  }

  private async handleScreenStop(
    socket: WebSocket,
    slot: MemberSlot,
    message: ScreenStopMessage,
  ): Promise<void> {
    if (!this.session) return;
    const result = this.session.stopScreenShare(slot, message.shareId);
    if (result === "INVALID_SCREEN_SHARE") {
      send(socket, { type: "error", code: "INVALID_SCREEN_SHARE", message: "当前共享已经结束，或由对方发起。" });
      return;
    }
    await this.persist();
    this.broadcast({ type: "screen.stopped", shareId: message.shareId, reason: message.reason, nextMode: result });
    this.broadcast({ type: "room.snapshot", snapshot: this.session.snapshot(Date.now()) });
  }

  private handleScreenWatchReady(
    socket: WebSocket,
    slot: MemberSlot,
    message: ScreenWatchReadyMessage,
  ): void {
    if (!this.session) return;
    const share = this.session.getScreenShare();
    if (!share || share.shareId !== message.shareId || share.sharerSlot === slot) {
      send(socket, { type: "error", code: "INVALID_SCREEN_SHARE", message: "当前没有可观看的屏幕共享。" });
      return;
    }
    if (!this.relayToOther(slot, { type: "screen.watch.ready", shareId: message.shareId, viewerSlot: slot })) {
      send(socket, { type: "error", code: "PEER_UNAVAILABLE", message: "共享者暂时离线，等待对方重新连接。" });
    }
  }

  private handleRtcSignal(socket: WebSocket, slot: MemberSlot, message: RtcSignalMessage): void {
    if (!this.session) return;
    const share = this.session.getScreenShare();
    if (!share || share.shareId !== message.shareId) {
      send(socket, { type: "error", code: "INVALID_SCREEN_SHARE", message: "这条连接信令已经过期，请重新发起共享。" });
      return;
    }
    if (!this.relayToOther(slot, { type: "rtc.signal", shareId: message.shareId, fromSlot: slot, signal: message.signal })) {
      send(socket, { type: "error", code: "PEER_UNAVAILABLE", message: "对方尚未连接，屏幕共享会在对方加入后继续。" });
    }
  }

  private broadcast(event: ServerEvent, except?: WebSocket): void {
    const payload = JSON.stringify(event);
    for (const socket of this.state.getWebSockets()) {
      if (socket !== except && socket.readyState === WebSocket.OPEN) socket.send(payload);
    }
  }

  private relayToOther(slot: MemberSlot, event: ServerEvent): boolean {
    const payload = JSON.stringify(event);
    let delivered = false;
    for (const socket of this.state.getWebSockets()) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      const attachment = socket.deserializeAttachment() as SocketAttachment | null;
      if (!attachment?.authenticated || attachment.slot === slot) continue;
      socket.send(payload);
      delivered = true;
    }
    return delivered;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.session) return;
    const stored = await this.state.storage.get<StoredRoomSession>(SESSION_KEY);
    if (stored) this.session = new RoomSession(stored);
  }

  private async persist(): Promise<void> {
    if (this.session) await this.state.storage.put(SESSION_KEY, this.session.serialize());
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return json(null, 204);

    if (request.method === "POST" && url.pathname === "/api/rooms") {
      const roomId = randomKey();
      const hostKey = randomKey();
      const inviteKey = randomKey();
      const id = env.ROOMS.idFromName(roomId);
      const stub = env.ROOMS.get(id);
      const session = RoomSession.create(roomId, hostKey, inviteKey, Date.now()).serialize();
      await stub.fetch("https://room.internal/initialize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(session),
      });
      return json({ roomId, hostKey, inviteKey } satisfies CreateRoomResponse, 201);
    }

    const match = url.pathname.match(/^\/rooms\/([a-f0-9]{32})$/);
    if (match?.[1]) {
      const id = env.ROOMS.idFromName(match[1]);
      return env.ROOMS.get(id).fetch(request);
    }

    return json({ service: "tongkan-signaling", status: "ok" });
  },
};
