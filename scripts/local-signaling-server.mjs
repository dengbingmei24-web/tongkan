// 同看 本地信令测试服务器
// 模拟 Cloudflare Durable Objects 房间的完整交互，用于 Android 本地调试
//
// 用法:
//   node scripts/local-signaling-server.mjs
//
// 然后在 Android RoomClient.java 中把 WS_ORIGIN 改为:
//   ws://你电脑的局域网IP:8787
//
// Android App 会通过 HTTP POST /api/rooms 创建房间，再通过 WebSocket 连接。

import { createServer } from "node:http";
import crypto from "node:crypto";
import { randomBytes } from "node:crypto";

// ============================================================
// 简易 WebSocket 实现（不依赖 ws 包，零外部依赖）
// ============================================================

function serveWebSocket(httpServer, pathPattern, onConnection) {
  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://localhost");
    if (!pathPattern.test(url.pathname)) return;

    const key = req.headers["sec-websocket-key"];
    if (!key) { socket.destroy(); return; }

    const accept = crypto.createHash("sha1")
      .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
      .digest("base64");

    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      "Sec-WebSocket-Accept: " + accept + "\r\n" +
      "\r\n"
    );

    const ws = createWebSocket(socket);
    onConnection(ws, req);
  });
}

function createWebSocket(socket) {
  const listeners = { message: [], close: [] };
  let closed = false;

  let buffer = Buffer.alloc(0);

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const opcode = buffer[0] & 0x0f;
      const masked = (buffer[1] & 0x80) !== 0;
      let payloadLen = buffer[1] & 0x7f;

      let offset = 2;
      if (payloadLen === 126) {
        if (buffer.length < 4) return;
        payloadLen = buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (buffer.length < 10) return;
        payloadLen = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }

      let maskKey = null;
      if (masked) {
        if (buffer.length < offset + 4) return;
        maskKey = buffer.slice(offset, offset + 4);
        offset += 4;
      }

      if (buffer.length < offset + payloadLen) return;

      let payload = buffer.slice(offset, offset + payloadLen);

      if (maskKey) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= maskKey[i % 4];
        }
      }

      buffer = buffer.slice(offset + payloadLen);

      if (opcode === 0x8) {
        // Close frame
        if (!closed) {
          closed = true;
          const code = payload.length >= 2 ? payload.readUInt16BE(0) : 1000;
          for (const cb of listeners.close) cb(code);
          socket.end();
        }
        return;
      }

      if (opcode === 0x9) {
        // Ping → Pong
        const pongFrame = Buffer.alloc(2 + payload.length);
        pongFrame[0] = 0x8a;
        pongFrame[1] = payload.length;
        payload.copy(pongFrame, 2);
        socket.write(pongFrame);
        continue;
      }

      if (opcode === 0x1 || opcode === 0x2) {
        const text = payload.toString("utf-8");
        for (const cb of listeners.message) cb(text);
      }
    }
  });

  socket.on("close", () => {
    if (!closed) {
      closed = true;
      for (const cb of listeners.close) cb(1006);
    }
  });

  return {
    onMessage(cb) { listeners.message.push(cb); },
    onClose(cb) { listeners.close.push(cb); },
    send(text) {
      if (closed) return;
      const payload = Buffer.from(text, "utf-8");
      const len = payload.length;
      let frame;
      if (len < 126) {
        frame = Buffer.alloc(2 + len);
        frame[0] = 0x81;
        frame[1] = len;
        payload.copy(frame, 2);
      } else if (len <= 65535) {
        frame = Buffer.alloc(4 + len);
        frame[0] = 0x81;
        frame[1] = 126;
        frame.writeUInt16BE(len, 2);
        payload.copy(frame, 4);
      } else {
        frame = Buffer.alloc(10 + len);
        frame[0] = 0x81;
        frame[1] = 127;
        frame.writeBigUInt64BE(BigInt(len), 2);
        payload.copy(frame, 10);
      }
      try { socket.write(frame); } catch (_) {}
    },
    close(code = 1000, reason = "") {
      if (closed) return;
      closed = true;
      const reasonBuf = Buffer.from(reason, "utf-8");
      const payload = Buffer.alloc(2 + reasonBuf.length);
      payload.writeUInt16BE(code, 0);
      reasonBuf.copy(payload, 2);
      const frame = Buffer.alloc(2 + payload.length);
      frame[0] = 0x88;
      frame[1] = payload.length;
      payload.copy(frame, 2);
      try { socket.write(frame); } catch (_) {}
      socket.end();
    },
    get remoteAddress() {
      return socket.remoteAddress || "unknown";
    }
  };
}

// ============================================================
// 房间状态
// ============================================================

function createRoom() {
  const roomId = randomHex(16);   // 32 chars
  const hostKey = randomHex(16);
  const inviteKey = randomHex(16);

  let host = null;   // { id, nickname, ws, connected, joinedAt, lastSeenAt }
  let guest = null;
  let sequence = 0;
  let playback = {
    media: null,
    paused: true,
    positionSeconds: 0,
    playbackRate: 1,
    anchoredAtServerMs: Date.now(),
    sequence: 0,
    actorId: null,
  };

  const room = {
    roomId,
    hostKey,
    inviteKey,
    get hostConnected() { return host?.connected ?? false; },
    get guestConnected() { return guest?.connected ?? false; },

    // ---------- auth ----------
    authenticate(key, nickname, ws) {
      const role = key === hostKey ? "host" : key === inviteKey ? "guest" : null;
      if (!role) return null;

      const member = {
        id: role + "-" + randomHex(6),
        role,
        nickname: nickname.substring(0, 24) || role,
        connected: true,
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
      };

      if (role === "host") {
        // Disconnect old host if any
        if (host?.ws) host.ws.close(4001);
        host = { ...member, ws };
      } else {
        if (guest?.ws) guest.ws.close(4001);
        guest = { ...member, ws };
      }

      return member;
    },

    // ---------- disconnect ----------
    disconnect(ws) {
      if (host?.ws === ws) {
        host.connected = false;
        host.lastSeenAt = Date.now();
        return host;
      }
      if (guest?.ws === ws) {
        guest.connected = false;
        guest.lastSeenAt = Date.now();
        return guest;
      }
      return null;
    },

    // ---------- snapshot ----------
    snapshot() {
      const members = {};
      if (host) members.host = { id: host.id, role: "host", nickname: host.nickname, connected: host.connected, joinedAt: host.joinedAt, lastSeenAt: host.lastSeenAt };
      if (guest) members.guest = { id: guest.id, role: "guest", nickname: guest.nickname, connected: guest.connected, joinedAt: guest.joinedAt, lastSeenAt: guest.lastSeenAt };
      return {
        roomId,
        mode: "bilibili",
        locked: Boolean(host?.connected && guest?.connected),
        members,
        playback: { ...playback },
        screenShare: null,
        bufferingSlots: [],
        serverNowMs: Date.now(),
      };
    },

    // ---------- broadcast ----------
    broadcast(event, excludeWs) {
      const data = JSON.stringify(event);
      for (const m of [host, guest]) {
        if (m?.ws && m.ws !== excludeWs && m.connected) {
          m.ws.send(data);
        }
      }
    },

    // ---------- apply command ----------
    applyCommand(kind, positionSeconds, playbackRate, media, actorId, now) {
      switch (kind) {
        case "play":
          playback.paused = false;
          if (typeof positionSeconds === "number") playback.positionSeconds = positionSeconds;
          break;
        case "pause":
          playback.paused = true;
          if (typeof positionSeconds === "number") playback.positionSeconds = positionSeconds;
          break;
        case "seek":
          if (typeof positionSeconds === "number") playback.positionSeconds = positionSeconds;
          break;
        case "rate":
          if (typeof playbackRate === "number") playback.playbackRate = playbackRate;
          break;
        case "media-change":
          if (media) playback.media = media;
          playback.positionSeconds = 0;
          break;
      }
      sequence += 1;
      playback.anchoredAtServerMs = now;
      playback.sequence = sequence;
      playback.actorId = actorId;
      return { ...playback };
    },

    getOtherMember(ws) {
      if (host?.ws === ws) return guest;
      if (guest?.ws === ws) return host;
      return null;
    },
  };

  return room;
}

function randomHex(bytes) {
  return [...randomBytes(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================
// HTTP + WebSocket 服务器
// ============================================================

const rooms = new Map();  // roomId → room
const PORT = parseInt(process.env.PORT || "8787", 10);

const httpServer = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // POST /api/rooms — 创建房间
  if (req.method === "POST" && url.pathname === "/api/rooms") {
    const room = createRoom();
    rooms.set(room.roomId, room);
    const body = JSON.stringify({ roomId: room.roomId, hostKey: room.hostKey, inviteKey: room.inviteKey });
    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(body);
    log(`房间已创建: ${room.roomId}`);
    return;
  }

  // 健康检查
  if (url.pathname === "/" || url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ service: "tongkan-local-signaling", rooms: rooms.size, uptime: Math.floor(process.uptime()) }));
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

// WebSocket 升级
serveWebSocket(httpServer, /^\/rooms\/([a-f0-9]{32})$/, (ws, req) => {
  const url = new URL(req.url, "http://localhost");
  const match = url.pathname.match(/^\/rooms\/([a-f0-9]{32})$/);
  const roomId = match[1];
  const room = rooms.get(roomId);

  if (!room) {
    ws.send(JSON.stringify({ type: "error", code: "INVALID_KEY", message: "房间不存在或已过期" }));
    ws.close(4004);
    log(`[${ws.remoteAddress}] 房间不存在: ${roomId}`);
    return;
  }

  log(`[${ws.remoteAddress}] WebSocket 已连接 → ${roomId}`);

  let authenticated = false;
  let memberSlot = null;

  ws.onMessage((raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (_) {
      ws.send(JSON.stringify({ type: "error", code: "INVALID_MESSAGE", message: "消息格式无效" }));
      return;
    }

    const now = Date.now();

    switch (msg.type) {
      // ===== AUTH =====
      case "auth": {
        const member = room.authenticate(msg.key, msg.nickname, ws);
        if (!member) {
          ws.send(JSON.stringify({ type: "error", code: "INVALID_KEY", message: "邀请链接已经失效" }));
          ws.close(4001);
          log(`[${memberSlot || "?"}] 认证失败`);
          return;
        }
        authenticated = true;
        memberSlot = member.role;
        const snapshot = room.snapshot();

        // 回复 auth.ok
        ws.send(JSON.stringify({
          type: "auth.ok",
          member: { id: member.id, role: member.role, nickname: member.nickname, connected: true, joinedAt: member.joinedAt, lastSeenAt: member.lastSeenAt },
          snapshot,
        }));

        // 广播给对方
        const other = room.getOtherMember(ws);
        if (other?.ws && other.connected) {
          other.ws.send(JSON.stringify({ type: "member.updated", member }));
          other.ws.send(JSON.stringify({ type: "room.snapshot", snapshot }));
        }

        log(`[${member.role}] ${member.nickname} 已认证`);
        break;
      }

      // ===== PING =====
      case "ping": {
        ws.send(JSON.stringify({
          type: "pong",
          clientSentAtMs: msg.clientSentAtMs,
          serverSentAtMs: now,
        }));
        break;
      }

      // ===== PLAYBACK COMMAND =====
      case "playback.command": {
        if (!authenticated) {
          ws.send(JSON.stringify({ type: "error", code: "NOT_AUTHENTICATED", message: "请先加入房间" }));
          return;
        }
        const anchor = room.applyCommand(
          msg.kind, msg.positionSeconds, msg.playbackRate, msg.media,
          memberSlot === "host" ? "host-" + room.roomId : "guest-" + room.roomId,
          now
        );
        const actorNickname = memberSlot === "host"
          ? (room.hostConnected ? "host" : "对方")
          : (room.guestConnected ? "guest" : "对方");

        room.broadcast({
          type: "playback.anchor",
          anchor,
          actorNickname,
          commandId: msg.commandId || "",
        }, ws);
        // Also send to self
        ws.send(JSON.stringify({
          type: "playback.anchor",
          anchor,
          actorNickname,
          commandId: msg.commandId || "",
        }));
        log(`[${memberSlot}] 播放指令: ${msg.kind}`);
        break;
      }

      // ===== PLAYBACK REPORT =====
      case "playback.report": {
        if (!authenticated) break;
        log(`[${memberSlot}] 播放状态上报: pos=${msg.report?.positionSeconds}s`);
        break;
      }

      default:
        // 静默忽略未知消息类型
        break;
    }
  });

  ws.onClose((code) => {
    const member = room.disconnect(ws);
    if (member) {
      room.broadcast({ type: "member.updated", member }, ws);
      log(`[${member.role}] ${member.nickname} 已断开 (code=${code})`);
    }
    // 如果房间空了，30秒后清理
    if (!room.hostConnected && !room.guestConnected) {
      setTimeout(() => {
        if (!room.hostConnected && !room.guestConnected) {
          rooms.delete(roomId);
          log(`房间已清理: ${roomId}`);
        }
      }, 30_000);
    }
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   同看  本地信令测试服务器                 ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log(`║   HTTP API:  http://0.0.0.0:${PORT}       ║`);
  console.log(`║   WebSocket: ws://0.0.0.0:${PORT}        ║`);
  console.log("╠══════════════════════════════════════════╣");
  console.log("║  创建房间:                               ║");
  console.log(`║    curl -X POST http://localhost:${PORT}/api/rooms`);
  console.log("║                                          ║");
  console.log("║  Android 用法:                           ║");
  console.log("║    RoomClient.java 中临时改:             ║");
  console.log("║    HTTP_ORIGIN → http://你的电脑IP:${PORT}  ║");
  console.log("║    WS_ORIGIN  → ws://你的电脑IP:${PORT}    ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
});

function log(msg) {
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  console.log(`[${time}] ${msg}`);
}