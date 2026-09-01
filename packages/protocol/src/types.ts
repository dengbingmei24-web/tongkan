export type RoomMode = "bilibili" | "direct-video" | "screen-share";
export type MemberRole = "host" | "guest";
export type MemberSlot = "host" | "guest";
export type PlaybackCommandKind = "play" | "pause" | "seek" | "rate" | "media-change";

export interface BiliMediaIdentity {
  type: "bilibili";
  bvid: string;
  aid?: number;
  cid?: number;
  page: number;
  title?: string;
  canonicalUrl: string;
  unresolved?: boolean;
}

export interface DirectMediaIdentity {
  type: "direct";
  url: string;
  title?: string;
  mimeType?: string;
}

export type MediaIdentity = BiliMediaIdentity | DirectMediaIdentity;

export interface PlaybackAnchor {
  media: MediaIdentity | null;
  paused: boolean;
  positionSeconds: number;
  playbackRate: number;
  anchoredAtServerMs: number;
  sequence: number;
  actorId: string | null;
}

export interface RoomMember {
  id: string;
  role: MemberRole;
  nickname: string;
  connected: boolean;
  joinedAt: number;
  lastSeenAt: number;
}

export interface PeerCapabilities {
  platform: "web" | "extension" | "android";
  canControlBilibili: boolean;
  canShareScreen: boolean;
  canShareSystemAudio: boolean;
  canUseMicrophone: boolean;
}

export interface ScreenShareState {
  shareId: string;
  sharerSlot: MemberSlot;
  sharerMemberId: string;
  sharerNickname: string;
  hasAudio: boolean;
  startedAtServerMs: number;
}

export interface RtcSessionDescriptionPayload {
  type: "offer" | "answer";
  sdp: string;
}

export interface RtcIceCandidatePayload {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment?: string | null;
}

export type RtcSignalPayload =
  | { kind: "description"; description: RtcSessionDescriptionPayload }
  | { kind: "candidate"; candidate: RtcIceCandidatePayload };

export interface ClientPlaybackReport {
  sequenceApplied: number;
  positionSeconds: number;
  paused: boolean;
  readyState: number;
  buffering: boolean;
  ended?: boolean;
  durationSeconds?: number | null;
  media: MediaIdentity | null;
  sentAtClientMs: number;
}

export interface RoomSnapshot {
  roomId: string;
  mode: RoomMode;
  locked: boolean;
  members: Partial<Record<MemberSlot, RoomMember>>;
  playback: PlaybackAnchor;
  screenShare: ScreenShareState | null;
  bufferingSlots: MemberSlot[];
  serverNowMs: number;
}

export interface AuthMessage {
  type: "auth";
  key: string;
  nickname: string;
  capabilities: PeerCapabilities;
}

export interface PlaybackCommandMessage {
  type: "playback.command";
  commandId: string;
  kind: PlaybackCommandKind;
  positionSeconds?: number;
  playbackRate?: number;
  media?: MediaIdentity;
  clientSentAtMs: number;
}

export interface PlaybackReportMessage {
  type: "playback.report";
  report: ClientPlaybackReport;
}

export interface HistoryBindMessage {
  type: "history.bind";
  grant: string;
}

export interface ChatMessage {
  type: "chat.message";
  messageId: string;
  text: string;
  clientSentAtMs: number;
}

export interface PingMessage {
  type: "ping";
  clientSentAtMs: number;
}

export interface ScreenStartMessage {
  type: "screen.start";
  shareId: string;
  hasAudio: boolean;
  clientSentAtMs: number;
}

export interface ScreenStopMessage {
  type: "screen.stop";
  shareId: string;
  reason: "user" | "track-ended" | "error";
}

export interface ScreenWatchReadyMessage {
  type: "screen.watch.ready";
  shareId: string;
}

export interface RtcSignalMessage {
  type: "rtc.signal";
  shareId: string;
  signal: RtcSignalPayload;
}

export type ClientMessage =
  | AuthMessage
  | PlaybackCommandMessage
  | PlaybackReportMessage
  | ChatMessage
  | PingMessage
  | ScreenStartMessage
  | ScreenStopMessage
  | ScreenWatchReadyMessage
  | RtcSignalMessage;

export type SignalingClientMessage = ClientMessage | HistoryBindMessage;

export interface AuthenticatedEvent {
  type: "auth.ok";
  member: RoomMember;
  snapshot: RoomSnapshot;
}

export interface ErrorEvent {
  type: "error";
  code:
    | "INVALID_MESSAGE"
    | "INVALID_KEY"
    | "ROOM_FULL"
    | "NOT_AUTHENTICATED"
    | "RATE_LIMITED"
    | "MEDIA_MISMATCH"
    | "SCREEN_BUSY"
    | "INVALID_SCREEN_SHARE"
    | "PEER_UNAVAILABLE"
    | "INVALID_HISTORY_GRANT"
    | "HISTORY_GRANT_EXPIRED"
    | "HISTORY_BIND_CONFLICT";
  message: string;
}

export interface HistoryBoundEvent {
  type: "history.bound";
  expiresAt: number;
}

export interface SnapshotEvent {
  type: "room.snapshot";
  snapshot: RoomSnapshot;
}

export interface PlaybackAnchorEvent {
  type: "playback.anchor";
  anchor: PlaybackAnchor;
  actorNickname: string;
  commandId: string;
}

export interface MemberEvent {
  type: "member.updated";
  member: RoomMember;
}

export interface ChatEvent {
  type: "chat.message";
  messageId: string;
  memberId: string;
  nickname: string;
  text: string;
  serverSentAtMs: number;
}

export interface PongEvent {
  type: "pong";
  clientSentAtMs: number;
  serverSentAtMs: number;
}

export interface ScreenStartedEvent {
  type: "screen.started";
  share: ScreenShareState;
}

export interface ScreenStoppedEvent {
  type: "screen.stopped";
  shareId: string;
  reason: "user" | "track-ended" | "error" | "disconnect";
  nextMode: RoomMode;
}

export interface ScreenWatchReadyEvent {
  type: "screen.watch.ready";
  shareId: string;
  viewerSlot: MemberSlot;
}

export interface RtcSignalEvent {
  type: "rtc.signal";
  shareId: string;
  fromSlot: MemberSlot;
  signal: RtcSignalPayload;
}

export type ServerEvent =
  | AuthenticatedEvent
  | ErrorEvent
  | HistoryBoundEvent
  | SnapshotEvent
  | PlaybackAnchorEvent
  | MemberEvent
  | ChatEvent
  | PongEvent
  | ScreenStartedEvent
  | ScreenStoppedEvent
  | ScreenWatchReadyEvent
  | RtcSignalEvent;

export interface CreateRoomResponse {
  roomId: string;
  hostKey: string;
  inviteKey: string;
}
