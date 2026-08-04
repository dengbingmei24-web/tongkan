import {
  positionAt,
  type AuthMessage,
  type BiliMediaIdentity,
  type ClientPlaybackReport,
  type MediaIdentity,
  type MemberRole,
  type MemberSlot,
  type PlaybackAnchor,
  type PlaybackCommandMessage,
  type RoomMember,
  type RoomMode,
  type RoomSnapshot,
  type ScreenShareState,
  type ScreenStartMessage,
} from "@tongkan/protocol";

export interface StoredRoomSession {
  roomId: string;
  hostKey: string;
  inviteKey: string;
  mode: RoomMode;
  sequence: number;
  playback: PlaybackAnchor;
  members: Partial<Record<MemberSlot, RoomMember>>;
  bufferingSlots: MemberSlot[];
  screenShare?: ScreenShareState | null;
}

export interface AuthResult {
  slot: MemberSlot;
  member: RoomMember;
}

export class RoomSession {
  private roomId: string;
  private hostKey: string;
  private inviteKey: string;
  private mode: RoomMode;
  private sequence: number;
  private playback: PlaybackAnchor;
  private members: Partial<Record<MemberSlot, RoomMember>>;
  private bufferingSlots: Set<MemberSlot>;
  private screenShare: ScreenShareState | null;
  private seekWindows = new Map<string, number[]>();

  constructor(stored: StoredRoomSession) {
    this.roomId = stored.roomId;
    this.hostKey = stored.hostKey;
    this.inviteKey = stored.inviteKey;
    this.mode = stored.mode;
    this.sequence = stored.sequence;
    this.playback = stored.playback;
    this.members = stored.members;
    this.bufferingSlots = new Set(stored.bufferingSlots);
    this.screenShare = stored.screenShare ?? null;
  }

  static create(roomId: string, hostKey: string, inviteKey: string, nowMs: number): RoomSession {
    return new RoomSession({
      roomId,
      hostKey,
      inviteKey,
      mode: "bilibili",
      sequence: 0,
      playback: {
        media: null,
        paused: true,
        positionSeconds: 0,
        playbackRate: 1,
        anchoredAtServerMs: nowMs,
        sequence: 0,
        actorId: null,
      },
      members: {},
      bufferingSlots: [],
      screenShare: null,
    });
  }

  authenticate(message: AuthMessage, nowMs: number): AuthResult | null {
    const role: MemberRole | null = message.key === this.hostKey
      ? "host"
      : message.key === this.inviteKey
        ? "guest"
        : null;
    if (!role) return null;

    const slot: MemberSlot = role;
    const existing = this.members[slot];
    const member: RoomMember = {
      id: existing?.id ?? `${slot}-${crypto.randomUUID()}`,
      role,
      nickname: message.nickname.trim().slice(0, 24) || (slot === "host" ? "房主" : "朋友"),
      connected: true,
      joinedAt: existing?.joinedAt ?? nowMs,
      lastSeenAt: nowMs,
    };
    this.members[slot] = member;
    return { slot, member };
  }

  disconnect(slot: MemberSlot, nowMs: number): RoomMember | null {
    const member = this.members[slot];
    if (!member) return null;
    const updated = { ...member, connected: false, lastSeenAt: nowMs };
    this.members[slot] = updated;
    this.bufferingSlots.delete(slot);
    return updated;
  }

  touch(slot: MemberSlot, nowMs: number): void {
    const member = this.members[slot];
    if (member) this.members[slot] = { ...member, lastSeenAt: nowMs };
  }

  applyPlaybackCommand(
    slot: MemberSlot,
    message: PlaybackCommandMessage,
    nowMs: number,
  ): PlaybackAnchor | "RATE_LIMITED" | "INVALID_MEDIA" {
    const member = this.members[slot];
    if (!member) return "INVALID_MEDIA";

    if (message.kind === "seek" && !this.allowSeek(member.id, nowMs)) {
      return "RATE_LIMITED";
    }

    const currentPosition = positionAt(this.playback, nowMs);
    let media: MediaIdentity | null = this.playback.media;
    let paused = this.playback.paused;
    let positionSeconds = currentPosition;
    let playbackRate = this.playback.playbackRate;

    switch (message.kind) {
      case "play":
        paused = false;
        if (typeof message.positionSeconds === "number") positionSeconds = message.positionSeconds;
        break;
      case "pause":
        paused = true;
        if (typeof message.positionSeconds === "number") positionSeconds = message.positionSeconds;
        break;
      case "seek":
        if (typeof message.positionSeconds !== "number") return "INVALID_MEDIA";
        positionSeconds = Math.max(0, message.positionSeconds);
        break;
      case "rate":
        if (typeof message.playbackRate !== "number") return "INVALID_MEDIA";
        playbackRate = Math.min(2, Math.max(0.25, message.playbackRate));
        break;
      case "media-change":
        if (!message.media) return "INVALID_MEDIA";
        media = message.media;
        paused = true;
        positionSeconds = Math.max(0, message.positionSeconds ?? 0);
        playbackRate = 1;
        if (!this.screenShare) {
          this.mode = message.media.type === "bilibili" ? "bilibili" : "direct-video";
        }
        this.bufferingSlots.clear();
        break;
    }

    this.sequence += 1;
    this.playback = {
      media,
      paused,
      positionSeconds,
      playbackRate,
      anchoredAtServerMs: nowMs,
      sequence: this.sequence,
      actorId: member.id,
    };
    return this.playback;
  }

  applyPlaybackReport(slot: MemberSlot, report: ClientPlaybackReport, nowMs: number): void {
    this.touch(slot, nowMs);
    if (report.buffering) this.bufferingSlots.add(slot);
    else this.bufferingSlots.delete(slot);

    if (this.bufferingSlots.size > 0 && !this.playback.paused) {
      this.sequence += 1;
      this.playback = {
        ...this.playback,
        positionSeconds: positionAt(this.playback, nowMs),
        paused: true,
        anchoredAtServerMs: nowMs,
        sequence: this.sequence,
        actorId: null,
      };
    }
  }

  startScreenShare(
    slot: MemberSlot,
    message: ScreenStartMessage,
    nowMs: number,
  ): ScreenShareState | "SCREEN_BUSY" | "INVALID_SCREEN_SHARE" {
    const member = this.members[slot];
    if (!member || !message.shareId.trim()) return "INVALID_SCREEN_SHARE";
    if (this.screenShare && this.screenShare.sharerSlot !== slot) return "SCREEN_BUSY";

    this.screenShare = {
      shareId: message.shareId,
      sharerSlot: slot,
      sharerMemberId: member.id,
      sharerNickname: member.nickname,
      hasAudio: message.hasAudio,
      startedAtServerMs: nowMs,
    };
    this.mode = "screen-share";
    return this.screenShare;
  }

  stopScreenShare(slot: MemberSlot, shareId: string): RoomMode | "INVALID_SCREEN_SHARE" {
    if (!this.screenShare || this.screenShare.shareId !== shareId || this.screenShare.sharerSlot !== slot) {
      return "INVALID_SCREEN_SHARE";
    }
    this.screenShare = null;
    this.mode = this.playback.media?.type === "direct" ? "direct-video" : "bilibili";
    return this.mode;
  }

  stopScreenShareForSlot(slot: MemberSlot): { shareId: string; nextMode: RoomMode } | null {
    if (!this.screenShare || this.screenShare.sharerSlot !== slot) return null;
    const shareId = this.screenShare.shareId;
    this.screenShare = null;
    this.mode = this.playback.media?.type === "direct" ? "direct-video" : "bilibili";
    return { shareId, nextMode: this.mode };
  }

  getScreenShare(): ScreenShareState | null {
    return this.screenShare;
  }

  getMember(slot: MemberSlot): RoomMember | undefined {
    return this.members[slot];
  }

  getMemberById(id: string): RoomMember | undefined {
    return Object.values(this.members).find((member) => member?.id === id);
  }

  snapshot(nowMs: number): RoomSnapshot {
    return {
      roomId: this.roomId,
      mode: this.mode,
      locked: Boolean(this.members.host && this.members.guest),
      members: this.members,
      playback: this.playback,
      screenShare: this.screenShare,
      bufferingSlots: [...this.bufferingSlots],
      serverNowMs: nowMs,
    };
  }

  serialize(): StoredRoomSession {
    return {
      roomId: this.roomId,
      hostKey: this.hostKey,
      inviteKey: this.inviteKey,
      mode: this.mode,
      sequence: this.sequence,
      playback: this.playback,
      members: this.members,
      bufferingSlots: [...this.bufferingSlots],
      screenShare: this.screenShare,
    };
  }

  private allowSeek(memberId: string, nowMs: number): boolean {
    const recent = (this.seekWindows.get(memberId) ?? []).filter((value) => nowMs - value < 1_000);
    if (recent.length >= 2) {
      this.seekWindows.set(memberId, recent);
      return false;
    }
    recent.push(nowMs);
    this.seekWindows.set(memberId, recent);
    return true;
  }
}

export function isBilibiliMedia(media: MediaIdentity | null): media is BiliMediaIdentity {
  return media?.type === "bilibili";
}
