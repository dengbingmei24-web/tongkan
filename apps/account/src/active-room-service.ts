import { decryptSecret, encryptSecret } from "./crypto";
import type { Env } from "./env";
import { AuthError } from "./errors";
import type { ActivePairRecord, ActivePairRoomRecord, PublicUser, UserRecord } from "./models";

export interface ActiveRoomRepository {
  activePairByUser(userId: string): Promise<ActivePairRecord | null>;
  activePairRoomByPair(pairId: string): Promise<ActivePairRoomRecord | null>;
  upsertActivePairRoom(room: ActivePairRoomRecord): Promise<boolean>;
  clearActivePairRoomByHost(hostUserId: string): Promise<void>;
  clearActivePairRoom(pairId: string): Promise<void>;
}

export interface ActiveRoomState {
  roomId: string;
  url: string;
  expiresAt: number;
  createdAt: number;
  host: PublicUser;
}

export interface ActiveRoomResult {
  room: ActiveRoomState | null;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const MAX_TTL_MS = 30 * 60 * 1000;
const ROOM_ID_PATTERN = /^[a-f0-9]{32}$/;
const INVITE_KEY_PATTERN = /^[a-f0-9]{32}$/;

export class ActiveRoomService {
  constructor(
    private readonly env: Env,
    private readonly repository: ActiveRoomRepository,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async publish(user: UserRecord, rawUrl: string, rawExpiresAt: number | undefined): Promise<ActiveRoomResult> {
    const pair = await this.requirePair(user.id);
    const invite = parseInviteUrl(rawUrl);
    const now = this.now();
    const expiresAt = normalizeExpiry(rawExpiresAt, now);
    const stored = await this.repository.upsertActivePairRoom({
      pairId: pair.pairId,
      hostUserId: user.id,
      roomId: invite.roomId,
      inviteUrlCiphertext: await encryptSecret(this.roomSecret(), "active-room", invite.url),
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    if (!stored) throw new AuthError("PAIR_REQUIRED", "当前好友关系已变化，请刷新后重试。", 409);
    return { room: null };
  }

  async get(user: UserRecord): Promise<ActiveRoomResult> {
    const pair = await this.requirePair(user.id);
    const room = await this.repository.activePairRoomByPair(pair.pairId);
    if (!room) return { room: null };
    if (room.expiresAt <= this.now()) {
      await this.repository.clearActivePairRoom(pair.pairId);
      return { room: null };
    }
    if (room.hostUserId === user.id) return { room: null };
    if (room.hostUserId !== pair.partner.id) {
      await this.repository.clearActivePairRoom(pair.pairId);
      return { room: null };
    }
    let invite: { roomId: string; url: string };
    try {
      const url = await decryptSecret(this.roomSecret(), "active-room", room.inviteUrlCiphertext);
      invite = parseInviteUrl(url);
    } catch {
      await this.repository.clearActivePairRoom(pair.pairId);
      throw new AuthError("ACTIVE_ROOM_INVALID", "好友房间状态无效，请让对方重新创建。", 409);
    }
    if (invite.roomId !== room.roomId) {
      await this.repository.clearActivePairRoom(pair.pairId);
      throw new AuthError("ACTIVE_ROOM_INVALID", "好友房间状态无效，请让对方重新创建。", 409);
    }
    return {
      room: {
        roomId: room.roomId,
        url: invite.url,
        expiresAt: room.expiresAt,
        createdAt: room.createdAt,
        host: publicUser(pair.partner),
      },
    };
  }

  async clear(user: UserRecord): Promise<void> {
    await this.repository.clearActivePairRoomByHost(user.id);
  }

  private async requirePair(userId: string): Promise<ActivePairRecord> {
    const pair = await this.repository.activePairByUser(userId);
    if (!pair) throw new AuthError("PAIR_REQUIRED", "请先绑定好友。", 409);
    return pair;
  }

  private roomSecret(): string {
    return this.env.PUSH_TOKEN_SECRET?.trim() || this.env.AUTH_SECRET;
  }
}

function normalizeExpiry(value: number | undefined, now: number): number {
  if (value === undefined) return now + DEFAULT_TTL_MS;
  if (!Number.isSafeInteger(value) || value <= now || value > now + MAX_TTL_MS) {
    throw new AuthError("INVALID_REQUEST", "房间展示有效期无效。", 400);
  }
  return value;
}

function parseInviteUrl(value: string): { roomId: string; url: string } {
  if (value.length > 1024) throw new AuthError("INVALID_REQUEST", "房间邀请链接过长。", 400);
  try {
    const url = new URL(value);
    const roomId = url.pathname.match(/^\/room\/([a-f0-9]{32})$/)?.[1];
    const inviteKey = url.hash.match(/^#join=([a-f0-9]{32})$/)?.[1];
    if (
      url.protocol !== "https:"
      || url.hostname !== "tongkan-personal.pages.dev"
      || url.port
      || url.username
      || url.password
      || url.search
      || !roomId
      || !inviteKey
      || !ROOM_ID_PATTERN.test(roomId)
      || !INVITE_KEY_PATTERN.test(inviteKey)
    ) throw new Error("invalid invite url");
    return { roomId, url: url.toString() };
  } catch {
    throw new AuthError("INVALID_REQUEST", "房间邀请链接无效。", 400);
  }
}

function publicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.emailMasked,
    nickname: user.nickname,
    avatarId: user.avatarId,
  };
}