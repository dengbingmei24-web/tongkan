import type {
  BiliMediaIdentity,
  ClientPlaybackReport,
  MemberSlot,
  PlaybackCommandKind,
  RoomSnapshot,
} from "@tongkan/protocol";

export const HISTORY_REPORT_STALE_MS = 12_000;
export const HISTORY_CHECKPOINT_MS = 60_000;
export const HISTORY_RETRY_BASE_MS = 1_000;
export const HISTORY_RETRY_MAX_MS = 60_000;
export const HISTORY_MAX_RETRY_ATTEMPTS = 8;
export const HISTORY_MAX_PENDING_INTERVALS = 256;
export const HISTORY_FLUSH_GRACE_MS = 2 * 60_000;

export type HistoryIntervalEndReason =
  | "pause"
  | "buffering"
  | "stale-report"
  | "disconnect"
  | "media-change"
  | "ended"
  | "grant-expired"
  | "history-unbind"
  | "room-expired"
  | "checkpoint";

export interface HistoryGrantPayload {
  v: 1;
  grantId: string;
  sourceId: string;
  pairId: string;
  userId: string;
  roomId: string;
  slot: MemberSlot;
  iat: number;
  exp: number;
}

export interface HistoryGrantSummary extends HistoryGrantPayload {}

interface StoredHistoryPlaybackReport {
  report: ClientPlaybackReport & { ended: boolean; durationSeconds: number | null };
  receivedAtMs: number;
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
  participants: {
    hostUserId: string;
    guestUserId: string;
  };
  intervals: HistoryIngestInterval[];
}

export interface HistoryIngestAck {
  sourceId: string;
  acceptedRevision: number;
  acceptedIntervalIds: string[];
  stale: boolean;
}

interface StoredActiveInterval {
  intervalId: string;
  sessionId: string;
  media: HistoryIngestMedia;
  startedAt: number;
}

interface StoredRetryState {
  attempts: number;
  nextRetryAtMs: number;
}

export interface StoredHistoryTrackerState {
  version: 1;
  roomId: string;
  sourceId: string | null;
  pairId: string | null;
  participants: Partial<Record<MemberSlot, string>>;
  bindings: Partial<Record<MemberSlot, HistoryGrantSummary>>;
  reports: Partial<Record<MemberSlot, StoredHistoryPlaybackReport>>;
  sessionMediaKey: string | null;
  sessionId: string | null;
  activeInterval: StoredActiveInterval | null;
  pendingIntervals: HistoryIngestInterval[];
  closurePending: boolean;
  sourceRevision: number;
  retry: StoredRetryState | null;
  closedAtMs: number | null;
  flushDeadlineAtMs: number | null;
  droppedIntervals: number;
}

export type HistoryBindResult =
  | { ok: true; expiresAt: number }
  | { ok: false; code: "INVALID_HISTORY_GRANT" | "HISTORY_GRANT_EXPIRED" | "HISTORY_BIND_CONFLICT" };

interface HistoryTrackerOptions {
  idFactory?: () => string;
}

const HEX_ID = /^[a-f0-9]{32}$/;
const GRANT_KEYS = ["exp", "grantId", "iat", "pairId", "roomId", "slot", "sourceId", "userId", "v"];

export class HistoryTracker {
  private readonly idFactory: () => string;

  constructor(private readonly state: StoredHistoryTrackerState, options: HistoryTrackerOptions = {}) {
    this.idFactory = options.idFactory ?? randomHexId;
  }

  static create(roomId: string, options: HistoryTrackerOptions = {}): HistoryTracker {
    return new HistoryTracker({
      version: 1,
      roomId,
      sourceId: null,
      pairId: null,
      participants: {},
      bindings: {},
      reports: {},
      sessionMediaKey: null,
      sessionId: null,
      activeInterval: null,
      pendingIntervals: [],
      closurePending: false,
      sourceRevision: 0,
      retry: null,
      closedAtMs: null,
      flushDeadlineAtMs: null,
      droppedIntervals: 0,
    }, options);
  }

  serialize(): StoredHistoryTrackerState {
    return structuredClone(this.state);
  }

  async bind(
    slot: MemberSlot,
    grant: string,
    secret: string,
    snapshot: RoomSnapshot,
    nowMs: number,
  ): Promise<HistoryBindResult> {
    this.advance(snapshot, nowMs);
    const verified = await verifyHistoryGrant(grant, secret, nowMs);
    if (!verified.ok) return verified;
    const payload = verified.payload;
    if (payload.roomId !== this.state.roomId || payload.slot !== slot) {
      return { ok: false, code: "HISTORY_BIND_CONFLICT" };
    }
    if ((this.state.sourceId && this.state.sourceId !== payload.sourceId)
      || (this.state.pairId && this.state.pairId !== payload.pairId)) {
      return { ok: false, code: "HISTORY_BIND_CONFLICT" };
    }
    const knownUser = this.state.participants[slot];
    const otherSlot: MemberSlot = slot === "host" ? "guest" : "host";
    const otherUser = this.state.participants[otherSlot];
    if ((knownUser && knownUser !== payload.userId) || otherUser === payload.userId) {
      return { ok: false, code: "HISTORY_BIND_CONFLICT" };
    }

    this.state.sourceId = payload.sourceId;
    this.state.pairId = payload.pairId;
    this.state.participants[slot] = payload.userId;
    this.state.bindings[slot] = payload;
    this.reconcile(snapshot, nowMs);
    return { ok: true, expiresAt: payload.exp };
  }

  recordReport(slot: MemberSlot, report: ClientPlaybackReport, snapshot: RoomSnapshot, nowMs: number): void {
    this.processTimedBoundaries(snapshot, nowMs);
    if (!isHistoryCapableReport(report) || !this.state.bindings[slot]) {
      this.closeActive(nowMs, "history-unbind");
      delete this.state.reports[slot];
      return;
    }
    this.state.reports[slot] = { report: structuredClone(report), receivedAtMs: nowMs };
    this.reconcile(snapshot, nowMs, reportEndReason(report, snapshot));
  }

  playbackCommand(
    kind: PlaybackCommandKind,
    previousSnapshot: RoomSnapshot,
    nextSnapshot: RoomSnapshot,
    nowMs: number,
  ): void {
    this.processTimedBoundaries(previousSnapshot, nowMs);
    this.closeActive(nowMs, commandEndReason(kind));
    if (kind === "media-change") {
      this.state.sessionMediaKey = null;
      this.state.sessionId = null;
    }
    this.reconcile(nextSnapshot, nowMs);
  }

  modeChanged(snapshot: RoomSnapshot, nowMs: number): void {
    this.processTimedBoundaries(snapshot, nowMs);
    this.closeActive(nowMs, "media-change");
    this.reconcile(snapshot, nowMs);
  }

  disconnect(slot: MemberSlot, snapshot: RoomSnapshot, nowMs: number): void {
    this.processTimedBoundaries(snapshot, nowMs);
    this.closeActive(nowMs, "disconnect");
    delete this.state.reports[slot];
    delete this.state.bindings[slot];
  }

  unbind(slot: MemberSlot, snapshot: RoomSnapshot, nowMs: number): void {
    this.processTimedBoundaries(snapshot, nowMs);
    this.closeActive(nowMs, "history-unbind");
    delete this.state.reports[slot];
    delete this.state.bindings[slot];
  }

  advance(snapshot: RoomSnapshot, nowMs: number): void {
    this.processTimedBoundaries(snapshot, nowMs);
    this.reconcile(snapshot, nowMs);
  }

  closeRoom(snapshot: RoomSnapshot, nowMs: number): void {
    if (this.state.closedAtMs !== null) return;
    this.processTimedBoundaries(snapshot, nowMs);
    this.closeActive(nowMs, "room-expired");
    this.state.closedAtMs = nowMs;
    this.state.flushDeadlineAtMs = nowMs + HISTORY_FLUSH_GRACE_MS;
    if (this.hasCompleteSourceIdentity()) {
      this.state.closurePending = true;
      this.state.sourceRevision += 1;
      this.state.retry = { attempts: 0, nextRetryAtMs: nowMs };
    }
  }

  isClosed(): boolean {
    return this.state.closedAtMs !== null;
  }

  shouldDestroy(nowMs: number): boolean {
    return this.state.closedAtMs !== null
      && (this.state.pendingIntervals.length === 0 && !this.state.closurePending
        || (this.state.flushDeadlineAtMs !== null && nowMs >= this.state.flushDeadlineAtMs));
  }

  nextAlarmAt(): number | null {
    const deadlines: number[] = [];
    for (const slot of ["host", "guest"] satisfies MemberSlot[]) {
      const binding = this.state.bindings[slot];
      const report = this.state.reports[slot];
      if (binding) deadlines.push(binding.exp);
      if (report) deadlines.push(report.receivedAtMs + HISTORY_REPORT_STALE_MS);
    }
    if (this.state.activeInterval) deadlines.push(this.state.activeInterval.startedAt + HISTORY_CHECKPOINT_MS);
    if (this.state.retry) deadlines.push(this.state.retry.nextRetryAtMs);
    if (this.state.flushDeadlineAtMs !== null) deadlines.push(this.state.flushDeadlineAtMs);
    return deadlines.length > 0 ? Math.min(...deadlines) : null;
  }

  pendingSnapshot(nowMs: number): HistoryIngestSnapshot | null {
    const sourceId = this.state.sourceId;
    const pairId = this.state.pairId;
    const hostUserId = this.state.participants.host;
    const guestUserId = this.state.participants.guest;
    if (!sourceId || !pairId || !hostUserId || !guestUserId
      || (this.state.pendingIntervals.length === 0 && !this.state.closurePending)) return null;
    return {
      sourceId,
      pairId,
      roomId: this.state.roomId,
      sourceRevision: this.state.sourceRevision,
      observedAt: nowMs,
      closed: this.state.closedAtMs !== null,
      participants: { hostUserId, guestUserId },
      intervals: structuredClone(this.state.pendingIntervals),
    };
  }

  retryDue(nowMs: number): boolean {
    return (this.state.pendingIntervals.length > 0 || this.state.closurePending)
      && (!this.state.retry || nowMs >= this.state.retry.nextRetryAtMs);
  }

  acknowledge(ack: HistoryIngestAck, nowMs: number): void {
    if (ack.sourceId !== this.state.sourceId) return;
    const accepted = new Set(ack.acceptedIntervalIds);
    if (ack.stale && ack.acceptedRevision >= this.state.sourceRevision) {
      this.state.pendingIntervals = [];
    } else {
      this.state.pendingIntervals = this.state.pendingIntervals.filter((interval) => !accepted.has(interval.intervalId));
    }
    if (ack.acceptedRevision >= this.state.sourceRevision) this.state.closurePending = false;
    this.state.retry = this.state.pendingIntervals.length > 0 || this.state.closurePending
      ? { attempts: 0, nextRetryAtMs: nowMs }
      : null;
  }

  markRecoverableFailure(nowMs: number): void {
    const attempts = (this.state.retry?.attempts ?? 0) + 1;
    if (attempts >= HISTORY_MAX_RETRY_ATTEMPTS
      || (this.state.flushDeadlineAtMs !== null && nowMs >= this.state.flushDeadlineAtMs)) {
      this.dropPending();
      return;
    }
    const delayMs = Math.min(HISTORY_RETRY_MAX_MS, HISTORY_RETRY_BASE_MS * 2 ** (attempts - 1));
    this.state.retry = { attempts, nextRetryAtMs: nowMs + delayMs };
  }

  markTerminalFailure(): void {
    this.dropPending();
  }

  private processTimedBoundaries(snapshot: RoomSnapshot, nowMs: number): void {
    let iterations = 0;
    while (this.state.activeInterval && iterations < HISTORY_MAX_PENDING_INTERVALS) {
      iterations += 1;
      const boundary = this.nextActiveBoundary();
      if (!boundary || boundary.atMs > nowMs) break;
      this.closeActive(boundary.atMs, boundary.reason);
      this.removeExpiredEvidence(boundary.atMs);
      if (boundary.reason === "checkpoint" && this.isEligible(snapshot, boundary.atMs)) {
        this.openActive(snapshot, boundary.atMs);
      }
    }
    this.removeExpiredEvidence(nowMs);
  }

  private nextActiveBoundary(): { atMs: number; reason: HistoryIntervalEndReason } | null {
    const active = this.state.activeInterval;
    if (!active) return null;
    const candidates: Array<{ atMs: number; reason: HistoryIntervalEndReason }> = [
      { atMs: active.startedAt + HISTORY_CHECKPOINT_MS, reason: "checkpoint" },
    ];
    for (const slot of ["host", "guest"] satisfies MemberSlot[]) {
      const binding = this.state.bindings[slot];
      const report = this.state.reports[slot];
      if (binding) candidates.push({ atMs: binding.exp, reason: "grant-expired" });
      if (report) candidates.push({ atMs: report.receivedAtMs + HISTORY_REPORT_STALE_MS, reason: "stale-report" });
    }
    candidates.sort((first, second) => first.atMs - second.atMs || boundaryPriority(first.reason) - boundaryPriority(second.reason));
    return candidates[0] ?? null;
  }

  private removeExpiredEvidence(nowMs: number): void {
    for (const slot of ["host", "guest"] satisfies MemberSlot[]) {
      const binding = this.state.bindings[slot];
      const report = this.state.reports[slot];
      if (binding && binding.exp <= nowMs) delete this.state.bindings[slot];
      if (report && report.receivedAtMs + HISTORY_REPORT_STALE_MS <= nowMs) delete this.state.reports[slot];
    }
  }

  private reconcile(snapshot: RoomSnapshot, nowMs: number, preferredReason?: HistoryIntervalEndReason): void {
    const mediaKey = bilibiliMediaKey(snapshot.playback.media);
    if (mediaKey !== this.state.sessionMediaKey) {
      this.closeActive(nowMs, "media-change");
      this.state.sessionMediaKey = mediaKey;
      this.state.sessionId = null;
    }
    if (!this.isEligible(snapshot, nowMs)) {
      this.closeActive(nowMs, preferredReason ?? invalidStateReason(snapshot, this.state, nowMs));
      return;
    }
    if (!this.state.activeInterval) this.openActive(snapshot, nowMs);
  }

  private isEligible(snapshot: RoomSnapshot, nowMs: number): boolean {
    if (this.state.closedAtMs !== null || snapshot.mode !== "bilibili" || snapshot.playback.paused) return false;
    const media = snapshot.playback.media;
    if (!isResolvedBilibiliMedia(media)) return false;
    if (!snapshot.members.host?.connected || !snapshot.members.guest?.connected) return false;
    const hostBinding = this.state.bindings.host;
    const guestBinding = this.state.bindings.guest;
    const hostReport = this.state.reports.host;
    const guestReport = this.state.reports.guest;
    if (!hostBinding || !guestBinding || !hostReport || !guestReport) return false;
    if (hostBinding.exp <= nowMs || guestBinding.exp <= nowMs) return false;
    if (hostBinding.sourceId !== guestBinding.sourceId || hostBinding.pairId !== guestBinding.pairId) return false;
    if (hostBinding.userId === guestBinding.userId) return false;
    return reportMatches(hostReport, snapshot, nowMs) && reportMatches(guestReport, snapshot, nowMs);
  }

  private openActive(snapshot: RoomSnapshot, nowMs: number): void {
    const media = snapshot.playback.media;
    if (!isResolvedBilibiliMedia(media)) return;
    if (!this.state.sessionId) this.state.sessionId = this.idFactory();
    this.state.activeInterval = {
      intervalId: this.idFactory(),
      sessionId: this.state.sessionId,
      media: {
        bvid: media.bvid,
        page: media.page,
        canonicalUrl: media.canonicalUrl,
        titleHint: media.title?.slice(0, 160) ?? null,
      },
      startedAt: nowMs,
    };
  }

  private closeActive(endedAt: number, reason: HistoryIntervalEndReason): void {
    const active = this.state.activeInterval;
    if (!active) return;
    this.state.activeInterval = null;
    if (endedAt <= active.startedAt) return;
    const durationHints = [this.state.reports.host?.report.durationSeconds, this.state.reports.guest?.report.durationSeconds]
      .filter((value): value is number => typeof value === "number" && value > 0);
    const interval: HistoryIngestInterval = {
      intervalId: active.intervalId,
      sessionId: active.sessionId,
      media: active.media,
      startedAt: active.startedAt,
      endedAt,
      endReason: reason,
      durationSecondsHint: durationHints.length > 0 ? Math.max(...durationHints) : null,
    };
    this.state.sourceRevision += 1;
    this.state.pendingIntervals.push(interval);
    if (this.state.pendingIntervals.length > HISTORY_MAX_PENDING_INTERVALS) {
      const overflow = this.state.pendingIntervals.length - HISTORY_MAX_PENDING_INTERVALS;
      this.state.pendingIntervals.splice(0, overflow);
      this.state.droppedIntervals += overflow;
    }
    this.state.retry = { attempts: 0, nextRetryAtMs: endedAt };
  }

  private dropPending(): void {
    this.state.droppedIntervals += this.state.pendingIntervals.length;
    this.state.pendingIntervals = [];
    this.state.closurePending = false;
    this.state.retry = null;
  }

  private hasCompleteSourceIdentity(): boolean {
    return Boolean(
      this.state.sourceId
      && this.state.pairId
      && this.state.participants.host
      && this.state.participants.guest,
    );
  }
}

export async function verifyHistoryGrant(
  grant: string,
  secret: string,
  nowMs: number,
): Promise<
  | { ok: true; payload: HistoryGrantPayload }
  | { ok: false; code: "INVALID_HISTORY_GRANT" | "HISTORY_GRANT_EXPIRED" }
> {
  if (!secret || grant.length < 20 || grant.length > 4_096) return { ok: false, code: "INVALID_HISTORY_GRANT" };
  const segments = grant.split(".");
  const payloadSegment = segments[0];
  const signatureSegment = segments[1];
  if (segments.length !== 2 || !payloadSegment || !signatureSegment) return { ok: false, code: "INVALID_HISTORY_GRANT" };
  try {
    const signature = base64UrlDecode(signatureSegment);
    if (signature.length !== 32) return { ok: false, code: "INVALID_HISTORY_GRANT" };
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signatureBytes = signature.buffer.slice(
      signature.byteOffset,
      signature.byteOffset + signature.byteLength,
    ) as ArrayBuffer;
    const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(payloadSegment));
    if (!valid) return { ok: false, code: "INVALID_HISTORY_GRANT" };
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(base64UrlDecode(payloadSegment));
    const value = JSON.parse(decoded) as unknown;
    if (!isHistoryGrantPayload(value)) return { ok: false, code: "INVALID_HISTORY_GRANT" };
    if (value.exp <= nowMs) return { ok: false, code: "HISTORY_GRANT_EXPIRED" };
    if (value.iat > nowMs + 5 * 60_000) return { ok: false, code: "INVALID_HISTORY_GRANT" };
    return { ok: true, payload: value };
  } catch {
    return { ok: false, code: "INVALID_HISTORY_GRANT" };
  }
}

function isHistoryGrantPayload(value: unknown): value is HistoryGrantPayload {
  if (!isObject(value) || Object.keys(value).sort().join(",") !== GRANT_KEYS.join(",")) return false;
  return value.v === 1
    && isHexId(value.grantId)
    && isHexId(value.sourceId)
    && isHexId(value.pairId)
    && isHexId(value.userId)
    && isHexId(value.roomId)
    && (value.slot === "host" || value.slot === "guest")
    && isPositiveInteger(value.iat)
    && isPositiveInteger(value.exp)
    && value.exp > value.iat;
}

function isHistoryCapableReport(
  report: ClientPlaybackReport,
): report is ClientPlaybackReport & { ended: boolean; durationSeconds: number | null } {
  return typeof report.ended === "boolean"
    && (report.durationSeconds === null || (typeof report.durationSeconds === "number" && report.durationSeconds > 0));
}

function reportMatches(reportState: StoredHistoryPlaybackReport, snapshot: RoomSnapshot, nowMs: number): boolean {
  const report = reportState.report;
  const anchorMedia = snapshot.playback.media;
  return reportState.receivedAtMs + HISTORY_REPORT_STALE_MS > nowMs
    && report.readyState >= 3
    && !report.paused
    && !report.buffering
    && !report.ended
    && report.sequenceApplied === snapshot.playback.sequence
    && isResolvedBilibiliMedia(report.media)
    && isResolvedBilibiliMedia(anchorMedia)
    && report.media.bvid === anchorMedia.bvid
    && report.media.page === anchorMedia.page;
}

function invalidStateReason(
  snapshot: RoomSnapshot,
  state: StoredHistoryTrackerState,
  nowMs: number,
): HistoryIntervalEndReason {
  if (!snapshot.members.host?.connected || !snapshot.members.guest?.connected) return "disconnect";
  if (snapshot.mode !== "bilibili" || !isResolvedBilibiliMedia(snapshot.playback.media)) return "media-change";
  if (snapshot.playback.paused) return "pause";
  for (const slot of ["host", "guest"] satisfies MemberSlot[]) {
    const binding = state.bindings[slot];
    const report = state.reports[slot];
    if (!binding) return "history-unbind";
    if (binding.exp <= nowMs) return "grant-expired";
    if (!report || report.receivedAtMs + HISTORY_REPORT_STALE_MS <= nowMs) return "stale-report";
    if (report.report.ended) return "ended";
    if (report.report.buffering || report.report.readyState < 3) return "buffering";
    if (report.report.paused) return "pause";
    if (!isResolvedBilibiliMedia(report.report.media)
      || report.report.media.bvid !== snapshot.playback.media.bvid
      || report.report.media.page !== snapshot.playback.media.page) return "media-change";
  }
  return "checkpoint";
}

function reportEndReason(report: ClientPlaybackReport, snapshot: RoomSnapshot): HistoryIntervalEndReason | undefined {
  if (report.ended) return "ended";
  if (report.buffering || report.readyState < 3) return "buffering";
  if (report.paused) return "pause";
  if (isResolvedBilibiliMedia(report.media) && isResolvedBilibiliMedia(snapshot.playback.media)
    && (report.media.bvid !== snapshot.playback.media.bvid || report.media.page !== snapshot.playback.media.page)) {
    return "media-change";
  }
  if (report.sequenceApplied !== snapshot.playback.sequence) return "checkpoint";
  return undefined;
}

function commandEndReason(kind: PlaybackCommandKind): HistoryIntervalEndReason {
  if (kind === "pause") return "pause";
  if (kind === "media-change") return "media-change";
  return "checkpoint";
}

function boundaryPriority(reason: HistoryIntervalEndReason): number {
  if (reason === "grant-expired") return 0;
  if (reason === "stale-report") return 1;
  return 2;
}

function bilibiliMediaKey(media: RoomSnapshot["playback"]["media"]): string | null {
  return isResolvedBilibiliMedia(media) ? `${media.bvid}:${media.page}` : null;
}

function isResolvedBilibiliMedia(media: unknown): media is BiliMediaIdentity {
  return isObject(media)
    && media.type === "bilibili"
    && typeof media.bvid === "string"
    && media.bvid.length >= 3
    && media.bvid.length <= 32
    && typeof media.page === "number"
    && Number.isInteger(media.page)
    && media.page >= 1
    && typeof media.canonicalUrl === "string"
    && media.canonicalUrl.length <= 1_000
    && media.unresolved !== true;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHexId(value: unknown): value is string {
  return typeof value === "string" && HEX_ID.test(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function randomHexId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function base64UrlDecode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid base64url");
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
