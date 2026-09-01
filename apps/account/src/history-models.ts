export type HistoryRoomSlot = "host" | "guest";
export type HistorySourceStatus = "active" | "closed" | "revoked";
export type HistoryMetadataSource = "library" | "bilibili" | "fallback";
export type HistoryCompletionState = "unknown" | "completed" | "incomplete";
export type HistoryIntervalEndReason =
  | "pause" | "buffering" | "stale-report" | "disconnect" | "media-change"
  | "ended" | "grant-expired" | "history-unbind" | "room-expired" | "checkpoint";

export interface HistoryPairIdentity { pairId: string; partnerUserId: string; }
export interface HistoryActiveRoom { pairId: string; hostUserId: string; roomId: string; expiresAt: number; }

export interface WatchRoomSourceRecord {
  id: string;
  pairId: string;
  roomId: string;
  hostUserId: string | null;
  guestUserId: string | null;
  status: HistorySourceStatus;
  lastIngestedRevision: number;
  absoluteExpiresAt: number;
  createdAt: number;
  updatedAt: number;
  closedAt: number | null;
  revokedAt: number | null;
}

export interface HistoryGrantPayload {
  v: 1;
  grantId: string;
  sourceId: string;
  pairId: string;
  userId: string;
  roomId: string;
  slot: HistoryRoomSlot;
  iat: number;
  exp: number;
}

export interface HistoryGrantResponse {
  sourceId: string;
  pairId: string;
  roomId: string;
  slot: HistoryRoomSlot;
  grant: string;
  expiresAt: number;
  refreshAfter: number;
}

export interface HistoryIngestMedia {
  bvid: string;
  page: number;
  canonicalUrl: string;
  titleHint: string | null;
}

export interface HistoryIngestInterval {
  intervalId: string;
  sessionId: string;
  media: HistoryIngestMedia;
  startedAt: number;
  endedAt: number;
  endReason: HistoryIntervalEndReason;
  durationSecondsHint: number | null;
}

export interface HistoryIngestSnapshot {
  sourceId: string;
  pairId: string;
  roomId: string;
  sourceRevision: number;
  observedAt: number;
  closed: boolean;
  participants: { hostUserId: string; guestUserId: string; };
  intervals: HistoryIngestInterval[];
}

export interface HistoryIngestAck {
  sourceId: string;
  acceptedRevision: number;
  acceptedIntervalIds: string[];
  stale: boolean;
}

export interface WatchIntervalRecord extends HistoryIngestInterval {
  sourceId: string;
  pairId: string;
  sourceRevision: number;
  watchedMs: number;
  createdAt: number;
}

export interface HistoryMetadataSnapshot {
  title: string;
  coverUrl: string | null;
  source: HistoryMetadataSource;
}

export interface WatchSessionRecord {
  id: string;
  sourceId: string;
  pairId: string;
  roomId: string;
  bvid: string;
  page: number;
  canonicalUrl: string;
  titleSnapshot: string;
  coverUrlSnapshot: string | null;
  metadataSource: HistoryMetadataSource;
  startedAt: number;
  endedAt: number;
  watchedMs: number;
  intervalCount: number;
  completionState: HistoryCompletionState;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryCursor { startedAt: number; id: string; }
export interface HistoryMedia { bvid: string; page: number; canonicalUrl: string; title: string; coverUrl: string | null; }
export interface HistoryItem {
  id: string;
  roomId: string;
  startedAt: number;
  endedAt: number;
  watchedSeconds: number;
  completionState: HistoryCompletionState;
  media: HistoryMedia;
}
export interface HistoryPage { pairId: string; readOnly: boolean; nextCursor: string | null; items: HistoryItem[]; }

export interface HistoryIntervalSlice {
  id: string;
  sessionId: string;
  bvid: string;
  page: number;
  startedAt: number;
  endedAt: number;
}

export interface DailyWatchSummary { date: string; watchedSeconds: number; sessionCount: number; }
export interface MonthlyHistorySummary {
  pairId: string;
  readOnly: boolean;
  month: string;
  tzOffsetMinutes: number;
  totalWatchedSeconds: number;
  sessionCount: number;
  distinctVideoCount: number;
  completedCount: null;
  lastWatchedDate: string | null;
  days: DailyWatchSummary[];
}
export interface HistoryCalendarMarkers {
  pairId: string;
  readOnly: boolean;
  month: string;
  tzOffsetMinutes: number;
  markers: DailyWatchSummary[];
}
