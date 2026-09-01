import { parseBilibiliUrl } from "@tongkan/protocol";
import { BilibiliMetadataResolver } from "./bilibili-metadata";
import { historyGrantSecret, historyIngestSecret } from "./config";
import { constantTimeEqual, hmacHex, randomHex } from "./crypto";
import type { Env } from "./env";
import { AuthError } from "./errors";
import { signHistoryGrant } from "./history-grant";
import type {
  DailyWatchSummary,
  HistoryCalendarMarkers,
  HistoryCursor,
  HistoryGrantResponse,
  HistoryIngestAck,
  HistoryIngestInterval,
  HistoryIngestSnapshot,
  HistoryIntervalEndReason,
  HistoryIntervalSlice,
  HistoryMetadataSnapshot,
  HistoryPage,
  HistoryRoomSlot,
  MonthlyHistorySummary,
  WatchIntervalRecord,
  WatchRoomSourceRecord,
  WatchSessionRecord,
} from "./history-models";
import type { HistoryRepository, HistorySessionSeed } from "./history-repository";
import type { UserRecord } from "./models";

const ID_PATTERN = /^[a-f0-9]{32}$/;
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const GRANT_TTL_MS = 10 * 60 * 1000;
const GRANT_REFRESH_MS = 5 * 60 * 1000;
const SOURCE_TTL_MS = 8 * 60 * 60 * 1000;
const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;
const MAX_BODY_BYTES = 256 * 1024;
const MAX_INTERVAL_MS = 60 * 1000;
const VISIBLE_SESSION_MS = 60 * 1000;
const END_REASONS = new Set<HistoryIntervalEndReason>([
  "pause", "buffering", "stale-report", "disconnect", "media-change", "ended",
  "grant-expired", "history-unbind", "room-expired", "checkpoint",
]);

export class HistoryService {
  constructor(
    private readonly env: Env,
    private readonly repository: HistoryRepository,
    private readonly metadataResolver: BilibiliMetadataResolver = new BilibiliMetadataResolver(),
    private readonly now: () => number = () => Date.now(),
  ) {}

  async issueGrant(user: UserRecord, body: Record<string, unknown>): Promise<HistoryGrantResponse> {
    assertExactKeys(body, ["roomId", "slot"]);
    const roomId = idValue(body.roomId);
    const slot = slotValue(body.slot);
    const pair = await this.repository.pairIdentityByUser(user.id);
    if (!pair) throw new AuthError("PAIR_REQUIRED", "请先绑定好友。", 409);
    const now = this.now();
    let source = await this.repository.sourceByRoomId(roomId);
    if (!source) {
      if (slot !== "host") throw new AuthError("HISTORY_SOURCE_NOT_FOUND", "共同观看来源尚未创建。", 409);
      const activeRoom = await this.repository.activeRoomByPair(pair.pairId);
      if (!activeRoom || activeRoom.roomId !== roomId || activeRoom.hostUserId !== user.id || activeRoom.expiresAt <= now) {
        throw new AuthError("HISTORY_GRANT_FORBIDDEN", "当前房间不能签发共同观看授权。", 403);
      }
      const candidate: WatchRoomSourceRecord = {
        id: randomHex(16), pairId: pair.pairId, roomId, hostUserId: user.id, guestUserId: null,
        status: "active", lastIngestedRevision: 0, absoluteExpiresAt: now + SOURCE_TTL_MS,
        createdAt: now, updatedAt: now, closedAt: null, revokedAt: null,
      };
      if (await this.repository.createSource(candidate)) source = candidate;
      else source = await this.repository.sourceByRoomId(roomId);
      if (!source) throw new AuthError("HISTORY_SOURCE_CONFLICT", "房间历史来源创建冲突。", 409);
    }
    this.assertGrantSource(source, pair.pairId, roomId, now);
    if (slot === "host") {
      if (source.hostUserId !== user.id) throw new AuthError("HISTORY_GRANT_FORBIDDEN", "当前账号不是房主。", 403);
    } else {
      if (source.hostUserId !== pair.partnerUserId || source.hostUserId === user.id) {
        throw new AuthError("HISTORY_GRANT_FORBIDDEN", "当前账号不能使用 guest 授权。", 403);
      }
      if (source.guestUserId !== user.id) {
        if (!await this.repository.attachGuest(source.id, source.pairId, user.id, now)) {
          source = await this.repository.sourceById(source.id);
          if (!source || source.guestUserId !== user.id) throw new AuthError("HISTORY_SOURCE_CONFLICT", "房间 guest 授权冲突。", 409);
        } else {
          source = { ...source, guestUserId: user.id, updatedAt: now };
        }
      }
    }
    const expiresAt = Math.min(now + GRANT_TTL_MS, source.absoluteExpiresAt);
    if (expiresAt <= now) throw new AuthError("HISTORY_GRANT_EXPIRED", "共同观看来源已过期。", 403);
    const refreshAfter = Math.min(now + GRANT_REFRESH_MS, expiresAt - 1);
    const grant = await signHistoryGrant(historyGrantSecret(this.env), {
      v: 1, grantId: randomHex(16), sourceId: source.id, pairId: source.pairId,
      userId: user.id, roomId, slot, iat: now, exp: expiresAt,
    });
    return { sourceId: source.id, pairId: source.pairId, roomId, slot, grant, expiresAt, refreshAfter };
  }

  async ingestInternal(request: Request, pathRoomId: string): Promise<HistoryIngestAck> {
    if (new URL(request.url).hostname !== "account.internal") signatureError();
    if (!ID_PATTERN.test(pathRoomId)) invalidRequest("房间标识无效。");
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/json")) invalidRequest("请求必须使用 JSON。");
    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_BODY_BYTES) invalidRequest("历史快照过大。");
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) invalidRequest("历史快照过大。");
    const timestampValue = request.headers.get("x-tongkan-history-timestamp") ?? "";
    const signature = (request.headers.get("x-tongkan-history-signature") ?? "").toLowerCase();
    if (!/^\d{1,16}$/.test(timestampValue) || !/^[a-f0-9]{64}$/.test(signature)) signatureError();
    const timestamp = Number(timestampValue);
    if (!Number.isSafeInteger(timestamp) || Math.abs(this.now() - timestamp) > SIGNATURE_TOLERANCE_MS) signatureError();
    const expected = await hmacHex(historyIngestSecret(this.env), timestampValue + "\n" + rawBody);
    if (!constantTimeEqual(expected, signature)) signatureError();
    let value: unknown;
    try { value = JSON.parse(rawBody); } catch { invalidRequest("历史快照不是有效 JSON。"); }
    const snapshot = parseSnapshot(value);
    if (snapshot.roomId !== pathRoomId) throw new AuthError("HISTORY_SOURCE_CONFLICT", "房间与历史来源不匹配。", 409);
    return this.ingestSnapshot(snapshot);
  }

  async ingestSnapshot(snapshot: HistoryIngestSnapshot): Promise<HistoryIngestAck> {
    const now = this.now();
    if (snapshot.observedAt > now + SIGNATURE_TOLERANCE_MS) invalidRequest("历史快照时间无效。");
    const source = await this.repository.sourceById(snapshot.sourceId);
    if (!source) throw new AuthError("HISTORY_SOURCE_NOT_FOUND", "共同观看来源不存在。", 404);
    this.assertIngestIdentity(source, snapshot);
    const ids = snapshot.intervals.map((interval) => interval.intervalId);
    const existing = await this.repository.intervalsByIds(ids);
    const existingById = new Map(existing.map((interval) => [interval.intervalId, interval]));
    for (const interval of snapshot.intervals) {
      const stored = existingById.get(interval.intervalId);
      if (stored && !sameInterval(stored, snapshot, interval)) intervalConflict(source.lastIngestedRevision);
    }
    if (snapshot.sourceRevision <= source.lastIngestedRevision) {
      return { sourceId: source.id, acceptedRevision: source.lastIngestedRevision, acceptedIntervalIds: existing.map((item) => item.intervalId), stale: true };
    }
    this.assertIngestWritable(source, now);
    const sessionSeeds = await this.sessionSeeds(source.pairId, snapshot.intervals);
    const storedSessions = await this.repository.sessionsByIds(sessionSeeds.map((seed) => seed.sessionId));
    const seedById = new Map(sessionSeeds.map((seed) => [seed.sessionId, seed]));
    for (const session of storedSessions) {
      const seed = seedById.get(session.id);
      if (!seed || session.sourceId !== source.id || session.pairId !== source.pairId || session.roomId !== source.roomId
        || session.bvid !== seed.media.bvid || session.page !== seed.media.page || session.canonicalUrl !== seed.media.canonicalUrl) {
        intervalConflict(source.lastIngestedRevision);
      }
    }
    const newIntervals = snapshot.intervals.filter((interval) => !existingById.has(interval.intervalId));
    const result = await this.repository.commitSnapshot(source, snapshot, newIntervals, sessionSeeds, now);
    if (!result.applied) {
      const current = await this.repository.sourceById(source.id);
      if (current && current.lastIngestedRevision >= snapshot.sourceRevision) {
        return { sourceId: source.id, acceptedRevision: current.lastIngestedRevision, acceptedIntervalIds: ids, stale: true };
      }
      throw new AuthError("HISTORY_SOURCE_REVOKED", "共同观看来源已撤销或过期。", 403);
    }
    return { sourceId: source.id, acceptedRevision: snapshot.sourceRevision, acceptedIntervalIds: ids, stale: false };
  }

  private assertGrantSource(source: WatchRoomSourceRecord, pairId: string, roomId: string, now: number): void {
    if (source.pairId !== pairId || source.roomId !== roomId) throw new AuthError("HISTORY_SOURCE_CONFLICT", "房间已绑定到其他双人空间。", 409);
    if (source.status !== "active") throw new AuthError("HISTORY_SOURCE_REVOKED", "共同观看来源已关闭或撤销。", 403);
    if (source.absoluteExpiresAt <= now) throw new AuthError("HISTORY_GRANT_EXPIRED", "共同观看来源已过期。", 403);
  }

  private assertIngestIdentity(source: WatchRoomSourceRecord, snapshot: HistoryIngestSnapshot): void {
    if (source.pairId !== snapshot.pairId || source.roomId !== snapshot.roomId) throw new AuthError("HISTORY_SOURCE_CONFLICT", "历史来源身份冲突。", 409);
    if (source.hostUserId !== snapshot.participants.hostUserId || source.guestUserId !== snapshot.participants.guestUserId) {
      throw new AuthError("HISTORY_SOURCE_CONFLICT", "历史参与者与授权不匹配。", 409);
    }
  }

  private assertIngestWritable(source: WatchRoomSourceRecord, now: number): void {
    if (source.status === "revoked" || source.status === "closed" || source.absoluteExpiresAt <= now) {
      throw new AuthError("HISTORY_SOURCE_REVOKED", "共同观看来源已撤销或过期。", 403);
    }
  }

  private async sessionSeeds(pairId: string, intervals: HistoryIngestInterval[]): Promise<HistorySessionSeed[]> {
    const mediaBySession = new Map<string, HistoryIngestInterval["media"]>();
    for (const interval of intervals) {
      const existing = mediaBySession.get(interval.sessionId);
      if (existing && (existing.bvid !== interval.media.bvid || existing.page !== interval.media.page || existing.canonicalUrl !== interval.media.canonicalUrl)) intervalConflict();
      mediaBySession.set(interval.sessionId, interval.media);
    }
    const seeds: HistorySessionSeed[] = [];
    for (const [sessionId, media] of mediaBySession) seeds.push({ sessionId, media, metadata: await this.resolveMetadata(pairId, media) });
    return seeds;
  }

  private async resolveMetadata(pairId: string, media: HistoryIngestInterval["media"]): Promise<HistoryMetadataSnapshot> {
    const library = await this.repository.libraryMetadata(pairId, media.bvid, media.page);
    if (library) return library;
    const identity = parseBilibiliUrl(media.canonicalUrl);
    if (identity && !identity.unresolved) {
      const metadata = await this.metadataResolver.metadataFor(identity);
      if (metadata.status === "ready") return { title: metadata.title, coverUrl: metadata.coverUrl, source: "bilibili" };
    }
    return { title: media.titleHint ?? (media.page > 1 ? media.bvid + " · P" + media.page : media.bvid), coverUrl: null, source: "fallback" };
  }

  async getHistory(user: UserRecord, cursorValue: string | null, limitValue: string | null): Promise<HistoryPage> {
    return this.historyPage(await this.activePairId(user.id), false, cursorValue, limitValue);
  }

  async getArchiveHistory(user: UserRecord, pairId: string, cursorValue: string | null, limitValue: string | null): Promise<HistoryPage> {
    return this.historyPage(await this.keptArchivePairId(user.id, pairId), true, cursorValue, limitValue);
  }

  async getMonthly(user: UserRecord, month: string | null, offsetValue: string | null): Promise<MonthlyHistorySummary> {
    return this.monthly(await this.activePairId(user.id), false, month, offsetValue);
  }

  async getArchiveMonthly(user: UserRecord, pairId: string, month: string | null, offsetValue: string | null): Promise<MonthlyHistorySummary> {
    return this.monthly(await this.keptArchivePairId(user.id, pairId), true, month, offsetValue);
  }

  async getCalendarMarkers(user: UserRecord, month: string | null, offsetValue: string | null): Promise<HistoryCalendarMarkers> {
    const summary = await this.getMonthly(user, month, offsetValue);
    return markersFromSummary(summary);
  }

  async getArchiveCalendarMarkers(user: UserRecord, pairId: string, month: string | null, offsetValue: string | null): Promise<HistoryCalendarMarkers> {
    const summary = await this.getArchiveMonthly(user, pairId, month, offsetValue);
    return markersFromSummary(summary);
  }

  private async activePairId(userId: string): Promise<string> {
    const pair = await this.repository.pairIdentityByUser(userId);
    if (!pair) throw new AuthError("PAIR_REQUIRED", "请先绑定好友。", 409);
    return pair.pairId;
  }

  private async keptArchivePairId(userId: string, pairId: string): Promise<string> {
    if (!ID_PATTERN.test(pairId)) invalidRequest("旧空间标识无效。");
    const access = await this.repository.archiveAccess(pairId, userId);
    if (access === "not-found") throw new AuthError("NOT_FOUND", "旧空间不存在或已删除。", 404);
    if (access !== "keep") throw new AuthError("ARCHIVE_FORBIDDEN", "旧空间历史不可读取。", 403);
    return pairId;
  }

  private async historyPage(pairId: string, readOnly: boolean, cursorValue: string | null, limitValue: string | null): Promise<HistoryPage> {
    const cursor = parseCursor(cursorValue);
    const limit = parseLimit(limitValue);
    const sessions = await this.repository.historySessions(pairId, cursor, limit + 1);
    const hasMore = sessions.length > limit;
    const visible = hasMore ? sessions.slice(0, limit) : sessions;
    return {
      pairId,
      readOnly,
      nextCursor: hasMore && visible.length > 0 ? encodeCursor(visible[visible.length - 1]!) : null,
      items: visible.map(publicHistoryItem),
    };
  }

  private async monthly(pairId: string, readOnly: boolean, monthValue: string | null, offsetValue: string | null): Promise<MonthlyHistorySummary> {
    const { month, offset, from, to } = parseMonthWindow(monthValue, offsetValue);
    return aggregateHistoryMonth(pairId, readOnly, month, offset, from, to, await this.repository.intervalsOverlapping(pairId, from, to));
  }
}

export function aggregateHistoryMonth(
  pairId: string,
  readOnly: boolean,
  month: string,
  tzOffsetMinutes: number,
  from: number,
  to: number,
  intervals: HistoryIntervalSlice[],
): MonthlyHistorySummary {
  const offsetMs = tzOffsetMinutes * 60 * 1000;
  const dayMap = new Map<string, { watchedMs: number; sessions: Set<string> }>();
  const sessions = new Set<string>();
  const videos = new Set<string>();
  let totalWatchedMs = 0;
  for (const interval of intervals) {
    let cursor = Math.max(from, interval.startedAt);
    const end = Math.min(to, interval.endedAt);
    if (end <= cursor) continue;
    sessions.add(interval.sessionId);
    videos.add(interval.bvid + ":" + interval.page);
    totalWatchedMs += end - cursor;
    while (cursor < end) {
      const date = new Date(cursor + offsetMs).toISOString().slice(0, 10);
      const nextBoundary = nextLocalMidnight(date, offsetMs);
      const sliceEnd = Math.min(end, nextBoundary);
      const day = dayMap.get(date) ?? { watchedMs: 0, sessions: new Set<string>() };
      day.watchedMs += sliceEnd - cursor;
      day.sessions.add(interval.sessionId);
      dayMap.set(date, day);
      cursor = sliceEnd;
    }
  }
  const days: DailyWatchSummary[] = [...dayMap.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([date, day]) => ({
    date, watchedSeconds: Math.floor(day.watchedMs / 1000), sessionCount: day.sessions.size,
  })).filter((day) => day.watchedSeconds > 0);
  return {
    pairId, readOnly, month, tzOffsetMinutes,
    totalWatchedSeconds: Math.floor(totalWatchedMs / 1000),
    sessionCount: sessions.size,
    distinctVideoCount: videos.size,
    completedCount: null,
    lastWatchedDate: days.at(-1)?.date ?? null,
    days,
  };
}

function markersFromSummary(summary: MonthlyHistorySummary): HistoryCalendarMarkers {
  return { pairId: summary.pairId, readOnly: summary.readOnly, month: summary.month, tzOffsetMinutes: summary.tzOffsetMinutes, markers: summary.days };
}

function publicHistoryItem(session: WatchSessionRecord): HistoryPage["items"][number] {
  return {
    id: session.id, roomId: session.roomId, startedAt: session.startedAt, endedAt: session.endedAt,
    watchedSeconds: Math.max(1, Math.floor(session.watchedMs / 1000)), completionState: session.completionState,
    media: { bvid: session.bvid, page: session.page, canonicalUrl: session.canonicalUrl, title: session.titleSnapshot, coverUrl: session.coverUrlSnapshot },
  };
}

function parseCursor(value: string | null): HistoryCursor | null {
  if (value === null) return null;
  if (value.length < 1 || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) invalidRequest("历史游标无效。");
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
    const parsed = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)))) as unknown;
    const object = objectValue(parsed);
    assertExactKeys(object, ["startedAt", "id"]);
    return { startedAt: positiveInteger(object.startedAt), id: idValue(object.id) };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    invalidRequest("历史游标无效。");
  }
}

function encodeCursor(session: WatchSessionRecord): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ startedAt: session.startedAt, id: session.id }));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function parseLimit(value: string | null): number {
  if (value === null) return 20;
  if (!/^\d{1,2}$/.test(value)) invalidRequest("历史分页数量无效。");
  const limit = Number(value);
  if (limit < 1 || limit > 50) invalidRequest("历史分页数量无效。");
  return limit;
}

function parseMonthWindow(monthValue: string | null, offsetValue: string | null): { month: string; offset: number; from: number; to: number } {
  const match = monthValue?.match(MONTH_PATTERN);
  if (!match) invalidRequest("月份格式无效。");
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (year < 1970 || year > 9999) invalidRequest("月份格式无效。");
  if (offsetValue === null || !/^-?\d{1,4}$/.test(offsetValue)) invalidRequest("时区偏移无效。");
  const offset = Number(offsetValue);
  if (!Number.isInteger(offset) || offset < -840 || offset > 840) invalidRequest("时区偏移无效。");
  const offsetMs = offset * 60 * 1000;
  return { month: match[0], offset, from: Date.UTC(year, monthIndex, 1) - offsetMs, to: Date.UTC(year, monthIndex + 1, 1) - offsetMs };
}

function nextLocalMidnight(date: string, offsetMs: number): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day! + 1) - offsetMs;
}

function parseSnapshot(value: unknown): HistoryIngestSnapshot {
  const body = objectValue(value);
  assertExactKeys(body, ["sourceId", "pairId", "roomId", "sourceRevision", "observedAt", "closed", "participants", "intervals"]);
  const participants = objectValue(body.participants);
  assertExactKeys(participants, ["hostUserId", "guestUserId"]);
  const hostUserId = idValue(participants.hostUserId);
  const guestUserId = idValue(participants.guestUserId);
  if (hostUserId === guestUserId) invalidRequest("历史参与者无效。");
  if (!Array.isArray(body.intervals) || body.intervals.length > 256) invalidRequest("历史区间列表无效。");
  const observedAt = positiveInteger(body.observedAt);
  const intervals = body.intervals.map((interval) => parseInterval(interval, observedAt));
  const intervalIds = new Set<string>();
  for (const interval of intervals) {
    if (intervalIds.has(interval.intervalId)) invalidRequest("历史区间标识重复。");
    intervalIds.add(interval.intervalId);
  }
  if (typeof body.closed !== "boolean") invalidRequest("历史来源关闭状态无效。");
  return {
    sourceId: idValue(body.sourceId), pairId: idValue(body.pairId), roomId: idValue(body.roomId),
    sourceRevision: positiveInteger(body.sourceRevision), observedAt, closed: body.closed,
    participants: { hostUserId, guestUserId }, intervals,
  };
}

function parseInterval(value: unknown, observedAt: number): HistoryIngestInterval {
  const interval = objectValue(value);
  assertExactKeys(interval, ["intervalId", "sessionId", "media", "startedAt", "endedAt", "endReason", "durationSecondsHint"], ["durationSecondsHint"]);
  const media = objectValue(interval.media);
  assertExactKeys(media, ["bvid", "page", "canonicalUrl", "titleHint"], ["titleHint"]);
  const bvid = limitedString(media.bvid, 32, 3);
  const page = positiveInteger(media.page);
  const canonicalUrl = limitedString(media.canonicalUrl, 1000, 1);
  const identity = parseBilibiliUrl(canonicalUrl);
  if (!identity || identity.unresolved || identity.bvid !== bvid || identity.page !== page) {
    invalidRequest("B站媒体身份无效。");
  }
  const titleHint = nullableLimitedString(media.titleHint, 160);
  const startedAt = positiveInteger(interval.startedAt);
  const endedAt = positiveInteger(interval.endedAt);
  if (endedAt <= startedAt || endedAt - startedAt > MAX_INTERVAL_MS || endedAt > observedAt) invalidRequest("历史区间时间无效。");
  if (typeof interval.endReason !== "string" || !END_REASONS.has(interval.endReason as HistoryIntervalEndReason)) invalidRequest("历史区间结束原因无效。");
  const durationSecondsHint = nullablePositiveNumber(interval.durationSecondsHint);
  return {
    intervalId: idValue(interval.intervalId), sessionId: idValue(interval.sessionId),
    media: { bvid, page, canonicalUrl, titleHint }, startedAt, endedAt,
    endReason: interval.endReason as HistoryIntervalEndReason, durationSecondsHint,
  };
}

function sameInterval(stored: WatchIntervalRecord, snapshot: HistoryIngestSnapshot, interval: HistoryIngestInterval): boolean {
  return stored.sourceId === snapshot.sourceId
    && stored.pairId === snapshot.pairId
    && stored.sessionId === interval.sessionId
    && stored.media.bvid === interval.media.bvid
    && stored.media.page === interval.media.page
    && stored.media.canonicalUrl === interval.media.canonicalUrl
    && stored.media.titleHint === interval.media.titleHint
    && stored.startedAt === interval.startedAt
    && stored.endedAt === interval.endedAt
    && stored.endReason === interval.endReason
    && stored.durationSecondsHint === interval.durationSecondsHint;
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidRequest("请求对象无效。");
  return value as Record<string, unknown>;
}

function assertExactKeys(value: Record<string, unknown>, allowed: string[], optional: string[] = []): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(value).some((key) => !allowedSet.has(key))) invalidRequest("请求包含未知字段。");
  const optionalSet = new Set(optional);
  if (allowed.some((key) => !optionalSet.has(key) && !Object.prototype.hasOwnProperty.call(value, key))) invalidRequest("请求字段不完整。");
}

function idValue(value: unknown): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) invalidRequest("资源标识无效。");
  return value;
}

function slotValue(value: unknown): HistoryRoomSlot {
  if (value !== "host" && value !== "guest") invalidRequest("房间位置无效。");
  return value;
}

function positiveInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) invalidRequest("正整数参数无效。");
  return value as number;
}

function limitedString(value: unknown, maxLength: number, minLength: number): string {
  if (typeof value !== "string" || Array.from(value).length < minLength || Array.from(value).length > maxLength) invalidRequest("文本参数无效。");
  return value;
}

function nullableLimitedString(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") invalidRequest("文本参数无效。");
  const normalized = value.trim();
  if (!normalized) return null;
  if (Array.from(normalized).length > maxLength) invalidRequest("文本参数过长。");
  return normalized;
}

function nullablePositiveNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 7 * 24 * 60 * 60) invalidRequest("视频时长提示无效。");
  return value;
}

function intervalConflict(revision?: number): never {
  throw new AuthError("HISTORY_INTERVAL_CONFLICT", "历史区间与已保存内容冲突。", 409, undefined, revision);
}

function signatureError(): never {
  throw new AuthError("HISTORY_SIGNATURE_INVALID", "历史写入签名无效或已过期。", 401);
}

function invalidRequest(message: string): never {
  throw new AuthError("INVALID_REQUEST", message, 400);
}
