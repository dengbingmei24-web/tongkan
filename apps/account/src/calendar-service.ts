import { randomHex } from "./crypto";
import { AuthError } from "./errors";
import type { CalendarPlanPatchInput, CalendarPlanRecord, CalendarPlanStatus, CalendarRange, CalendarSnapshot } from "./calendar-models";
import type { CalendarRepository } from "./calendar-repository";
import type { UserRecord } from "./models";

const ID_RE = /^[a-f0-9]{32}$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CalendarService {
  constructor(private readonly repository: CalendarRepository, private readonly now: () => number = () => Date.now()) {}

  async getActiveMonth(user: UserRecord, month: string): Promise<CalendarSnapshot> {
    const pairId = await this.requireActivePair(user.id);
    return this.repository.snapshot(pairId, false, monthRange(validMonth(month)));
  }
  async getActiveDate(user: UserRecord, date: string): Promise<CalendarSnapshot> {
    const pairId = await this.requireActivePair(user.id);
    const normalized = validDate(date);
    return this.repository.snapshot(pairId, false, { from: normalized, to: normalized });
  }
  async getToday(user: UserRecord, date: string): Promise<CalendarSnapshot> {
    const pairId = await this.requireActivePair(user.id);
    const normalized = validDate(date);
    return this.repository.snapshot(pairId, false, { from: normalized, to: normalized }, true);
  }
  async getArchiveMonth(user: UserRecord, pairId: string, month: string): Promise<CalendarSnapshot> {
    requireId(pairId);
    if (!await this.repository.pairExists(pairId)) throw new AuthError("NOT_FOUND", "旧双人空间不存在。", 404);
    if (await this.repository.archiveRetention(pairId, user.id) !== "keep") throw new AuthError("ARCHIVE_FORBIDDEN", "该旧双人空间日历不可查看。", 403);
    return this.repository.snapshot(pairId, true, monthRange(validMonth(month)));
  }

  async createPlan(
    user: UserRecord,
    libraryItemId: string,
    dateValue: string,
    startTimeValue: string | null | undefined,
    noteValue: string | null | undefined,
    expectedRevision: number,
  ): Promise<CalendarSnapshot> {
    requireId(libraryItemId);
    const date = validDate(dateValue);
    const startTime = validStartTime(startTimeValue);
    const note = validNote(noteValue);
    const pairId = await this.requireCurrentRevision(user.id, expectedRevision);
    const item = await this.repository.libraryItemById(pairId, libraryItemId);
    if (!item) throw new AuthError("LIBRARY_ITEM_NOT_FOUND", "共同片库中没有这个视频。", 404);
    if (await this.repository.planByLibraryItemDate(pairId, libraryItemId, date)) throw new AuthError("PLAN_ALREADY_EXISTS", "这个视频当天已经安排过了。", 409);
    try {
      const result = await this.repository.createPlan(pairId, user, expectedRevision, {
        id: randomHex(16), libraryItemId, date, startTime, note, bvid: item.bvid, page: item.page,
        canonicalUrl: item.canonicalUrl, titleSnapshot: item.title, coverUrlSnapshot: item.coverUrl,
      }, this.now());
      this.requireApplied(result.applied, result.currentRevision);
    } catch (error) {
      if (isDuplicatePlanError(error)) throw new AuthError("PLAN_ALREADY_EXISTS", "这个视频当天已经安排过了。", 409);
      throw error;
    }
    return this.repository.snapshot(pairId, false, { from: date, to: date });
  }

  async updatePlan(user: UserRecord, planId: string, patch: CalendarPlanPatchInput, expectedRevision: number): Promise<CalendarSnapshot> {
    requireId(planId);
    if (!hasPatch(patch)) throw new AuthError("INVALID_REQUEST", "没有可更新的计划字段。", 400);
    const pairId = await this.requireCurrentRevision(user.id, expectedRevision);
    const existing = await this.repository.planById(pairId, planId);
    if (!existing) throw new AuthError("PLAN_NOT_FOUND", "观看计划不存在。", 404);
    const date = Object.prototype.hasOwnProperty.call(patch, "date") ? validDate(patch.date ?? "") : existing.date;
    const startTime = Object.prototype.hasOwnProperty.call(patch, "startTime") ? validStartTime(patch.startTime) : existing.startTime;
    const note = Object.prototype.hasOwnProperty.call(patch, "note") ? validNote(patch.note) : existing.note;
    const status = Object.prototype.hasOwnProperty.call(patch, "status") ? validStatus(patch.status) : existing.status;
    const completedAt = status === "completed"
      ? (existing.status === "completed" && existing.completedAt !== null ? existing.completedAt : this.now())
      : null;
    if (existing.libraryItemId !== null && date !== existing.date) {
      const duplicate = await this.repository.planByLibraryItemDate(pairId, existing.libraryItemId, date);
      if (duplicate && duplicate.id !== existing.id) throw new AuthError("PLAN_ALREADY_EXISTS", "这个视频当天已经安排过了。", 409);
    }
    const updated: CalendarPlanRecord = { ...existing, date, startTime, note, status, completedAt };
    try {
      const result = await this.repository.updatePlan(pairId, user, expectedRevision, updated, this.now());
      this.requireApplied(result.applied, result.currentRevision);
    } catch (error) {
      if (isDuplicatePlanError(error)) throw new AuthError("PLAN_ALREADY_EXISTS", "这个视频当天已经安排过了。", 409);
      throw error;
    }
    return this.repository.snapshot(pairId, false, { from: date, to: date });
  }

  async deletePlan(user: UserRecord, planId: string, expectedRevision: number): Promise<CalendarSnapshot> {
    requireId(planId);
    const pairId = await this.requireCurrentRevision(user.id, expectedRevision);
    const existing = await this.repository.planById(pairId, planId);
    if (!existing) throw new AuthError("PLAN_NOT_FOUND", "观看计划不存在。", 404);
    const result = await this.repository.deletePlan(pairId, user, expectedRevision, planId, this.now());
    this.requireApplied(result.applied, result.currentRevision);
    return this.repository.snapshot(pairId, false, { from: existing.date, to: existing.date });
  }

  private async requireActivePair(userId: string): Promise<string> {
    const pairId = await this.repository.activePairId(userId);
    if (!pairId) throw new AuthError("PAIR_REQUIRED", "请先绑定好友再使用共同日历。", 409);
    return pairId;
  }
  private async requireCurrentRevision(userId: string, expectedRevision: number): Promise<string> {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new AuthError("INVALID_REQUEST", "日历版本无效，请刷新后重试。", 400);
    const pairId = await this.requireActivePair(userId);
    const state = await this.repository.state(pairId);
    if (!state) throw new AuthError("NOT_FOUND", "共同日历尚未初始化。", 404);
    if (state.revision !== expectedRevision) throw new AuthError("CALENDAR_VERSION_CONFLICT", "共同日历刚刚被更新，请刷新后重试。", 409, undefined, state.revision);
    return pairId;
  }
  private requireApplied(applied: boolean, currentRevision: number): void {
    if (!applied) throw new AuthError("CALENDAR_VERSION_CONFLICT", "共同日历刚刚被更新，请刷新后重试。", 409, undefined, currentRevision);
  }
}

function hasPatch(patch: CalendarPlanPatchInput): boolean {
  return ["date", "startTime", "note", "status"].some((key) => Object.prototype.hasOwnProperty.call(patch, key));
}
function requireId(value: string): void { if (!ID_RE.test(value)) throw new AuthError("INVALID_REQUEST", "资源 ID 无效。", 400); }
function validMonth(value: string): string {
  const match = MONTH_RE.exec(value);
  if (!match) throw new AuthError("INVALID_REQUEST", "月份格式应为 YYYY-MM。", 400);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new AuthError("INVALID_REQUEST", "月份无效。", 400);
  return value;
}
function validDate(value: string): string {
  const match = DATE_RE.exec(value);
  if (!match) throw new AuthError("INVALID_REQUEST", "日期格式应为 YYYY-MM-DD。", 400);
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) throw new AuthError("INVALID_REQUEST", "日期无效。", 400);
  return value;
}
function validStartTime(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  const normalized = value.trim();
  if (!TIME_RE.test(normalized)) throw new AuthError("INVALID_REQUEST", "开始时间格式应为 HH:mm。", 400);
  return normalized;
}
function validNote(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  const normalized = value.trim();
  if (Array.from(normalized).length > 200) throw new AuthError("INVALID_REQUEST", "备注最多 200 个字符。", 400);
  return normalized;
}
function validStatus(value: CalendarPlanStatus | undefined): CalendarPlanStatus {
  if (value !== "planned" && value !== "completed") throw new AuthError("INVALID_REQUEST", "计划状态无效。", 400);
  return value;
}
function monthRange(month: string): CalendarRange {
  const [yearValue, monthValue] = month.split("-");
  const lastDay = String(daysInMonth(Number(yearValue), Number(monthValue))).padStart(2, "0");
  return { from: month + "-01", to: month + "-" + lastDay };
}
function daysInMonth(year: number, month: number): number { if (month === 2) return isLeapYear(year) ? 29 : 28; return [4, 6, 9, 11].includes(month) ? 30 : 31; }
function isLeapYear(year: number): boolean { return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0); }
function isDuplicatePlanError(error: unknown): boolean {
  const message = String(error);
  return message.includes("UNIQUE constraint failed") && message.includes("calendar_plans.pair_id")
    && message.includes("calendar_plans.library_item_id") && message.includes("calendar_plans.scheduled_date");
}
