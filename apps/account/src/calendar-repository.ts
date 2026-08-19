import type { UserRecord } from "./models";
import type {
  CalendarLibraryItemRecord,
  CalendarMutationResult,
  CalendarPlan,
  CalendarPlanInsert,
  CalendarPlanRecord,
  CalendarRange,
  CalendarSnapshot,
  CalendarStateRecord,
} from "./calendar-models";

function nullableString(value: unknown): string | null { return value === null || value === undefined ? null : String(value); }
function nullableNumber(value: unknown): number | null { return value === null || value === undefined ? null : Number(value); }
function stateFromRow(row: Record<string, unknown>): CalendarStateRecord {
  return { pairId: String(row.pair_id), revision: Number(row.revision), createdAt: Number(row.created_at), updatedAt: Number(row.updated_at) };
}
function libraryItemFromRow(row: Record<string, unknown>): CalendarLibraryItemRecord {
  return { id: String(row.id), pairId: String(row.pair_id), bvid: String(row.bvid), page: Number(row.page), canonicalUrl: String(row.canonical_url), title: String(row.title), coverUrl: nullableString(row.cover_url) };
}
function planFromRow(row: Record<string, unknown>): CalendarPlanRecord {
  return {
    id: String(row.id), pairId: String(row.pair_id), libraryItemId: nullableString(row.library_item_id), date: String(row.scheduled_date),
    startTime: nullableString(row.start_time), note: nullableString(row.note), status: String(row.status) as CalendarPlanRecord["status"],
    bvid: String(row.bvid), page: Number(row.page), canonicalUrl: String(row.canonical_url), titleSnapshot: String(row.title_snapshot),
    coverUrlSnapshot: nullableString(row.cover_url_snapshot), createdByUserId: nullableString(row.created_by_user_id),
    createdByNicknameSnapshot: String(row.created_by_nickname_snapshot), updatedByUserId: nullableString(row.updated_by_user_id),
    updatedByNicknameSnapshot: String(row.updated_by_nickname_snapshot), createdAt: Number(row.created_at), updatedAt: Number(row.updated_at),
    completedAt: nullableNumber(row.completed_at),
  };
}
function publicPlan(plan: CalendarPlanRecord): CalendarPlan {
  return {
    id: plan.id, libraryItemId: plan.libraryItemId, date: plan.date, startTime: plan.startTime, note: plan.note, status: plan.status,
    media: { bvid: plan.bvid, page: plan.page, canonicalUrl: plan.canonicalUrl, title: plan.titleSnapshot, coverUrl: plan.coverUrlSnapshot },
    createdBy: { id: plan.createdByUserId ?? "deleted", nickname: plan.createdByNicknameSnapshot },
    updatedBy: { id: plan.updatedByUserId ?? "deleted", nickname: plan.updatedByNicknameSnapshot },
    createdAt: plan.createdAt, updatedAt: plan.updatedAt, completedAt: plan.completedAt,
  };
}

export interface CalendarRepository {
  activePairId(userId: string): Promise<string | null>;
  pairExists(pairId: string): Promise<boolean>;
  archiveRetention(pairId: string, userId: string): Promise<string | null>;
  state(pairId: string): Promise<CalendarStateRecord | null>;
  libraryItemById(pairId: string, itemId: string): Promise<CalendarLibraryItemRecord | null>;
  planById(pairId: string, planId: string): Promise<CalendarPlanRecord | null>;
  planByLibraryItemDate(pairId: string, libraryItemId: string, date: string): Promise<CalendarPlanRecord | null>;
  snapshot(pairId: string, readOnly: boolean, range: CalendarRange, plannedOnly?: boolean): Promise<CalendarSnapshot>;
  createPlan(pairId: string, actor: UserRecord, expectedRevision: number, plan: CalendarPlanInsert, now: number): Promise<CalendarMutationResult>;
  updatePlan(pairId: string, actor: UserRecord, expectedRevision: number, plan: CalendarPlanRecord, now: number): Promise<CalendarMutationResult>;
  deletePlan(pairId: string, actor: UserRecord, expectedRevision: number, planId: string, now: number): Promise<CalendarMutationResult>;
}

export class D1CalendarRepository implements CalendarRepository {
  constructor(private readonly db: D1Database) {}
  async activePairId(userId: string): Promise<string | null> {
    const row = await this.db.prepare("SELECT pair_id FROM active_pair_members WHERE user_id = ? LIMIT 1").bind(userId).first<{ pair_id: string }>();
    return row?.pair_id ?? null;
  }
  async pairExists(pairId: string): Promise<boolean> {
    const row = await this.db.prepare("SELECT 1 AS found FROM pairs WHERE id = ? LIMIT 1").bind(pairId).first<{ found: number }>();
    return row?.found === 1;
  }
  async archiveRetention(pairId: string, userId: string): Promise<string | null> {
    const row = await this.db.prepare("SELECT retention_status FROM pair_archive_members WHERE pair_id = ? AND user_id = ? LIMIT 1").bind(pairId, userId).first<{ retention_status: string }>();
    return row?.retention_status ?? null;
  }
  async state(pairId: string): Promise<CalendarStateRecord | null> {
    const row = await this.db.prepare("SELECT pair_id, revision, created_at, updated_at FROM pair_calendar_state WHERE pair_id = ?").bind(pairId).first<Record<string, unknown>>();
    return row ? stateFromRow(row) : null;
  }
  async libraryItemById(pairId: string, itemId: string): Promise<CalendarLibraryItemRecord | null> {
    const row = await this.db.prepare("SELECT id, pair_id, bvid, page, canonical_url, title, cover_url FROM library_items WHERE pair_id = ? AND id = ? LIMIT 1").bind(pairId, itemId).first<Record<string, unknown>>();
    return row ? libraryItemFromRow(row) : null;
  }
  async planById(pairId: string, planId: string): Promise<CalendarPlanRecord | null> {
    const row = await this.db.prepare("SELECT * FROM calendar_plans WHERE pair_id = ? AND id = ? LIMIT 1").bind(pairId, planId).first<Record<string, unknown>>();
    return row ? planFromRow(row) : null;
  }
  async planByLibraryItemDate(pairId: string, libraryItemId: string, date: string): Promise<CalendarPlanRecord | null> {
    const row = await this.db.prepare("SELECT * FROM calendar_plans WHERE pair_id = ? AND library_item_id = ? AND scheduled_date = ? LIMIT 1").bind(pairId, libraryItemId, date).first<Record<string, unknown>>();
    return row ? planFromRow(row) : null;
  }
  async snapshot(pairId: string, readOnly: boolean, range: CalendarRange, plannedOnly = false): Promise<CalendarSnapshot> {
    const state = await this.state(pairId);
    const statement = plannedOnly
      ? this.db.prepare("SELECT * FROM calendar_plans WHERE pair_id = ? AND scheduled_date BETWEEN ? AND ? AND status = 'planned' ORDER BY CASE WHEN start_time IS NULL THEN 1 ELSE 0 END, start_time ASC, created_at ASC, id ASC").bind(pairId, range.from, range.to)
      : this.db.prepare("SELECT * FROM calendar_plans WHERE pair_id = ? AND scheduled_date BETWEEN ? AND ? ORDER BY scheduled_date ASC, CASE WHEN start_time IS NULL THEN 1 ELSE 0 END, start_time ASC, created_at ASC, id ASC").bind(pairId, range.from, range.to);
    const result = await statement.all<Record<string, unknown>>();
    return { pairId, revision: state?.revision ?? 0, readOnly, range, plans: result.results.map(planFromRow).map(publicPlan) };
  }
  async createPlan(pairId: string, actor: UserRecord, expectedRevision: number, plan: CalendarPlanInsert, now: number): Promise<CalendarMutationResult> {
    const statement = this.db.prepare(
      `INSERT INTO calendar_plans (
         id, pair_id, library_item_id, scheduled_date, start_time, note, status, bvid, page, canonical_url, title_snapshot, cover_url_snapshot,
         created_by_user_id, created_by_nickname_snapshot, updated_by_user_id, updated_by_nickname_snapshot, created_at, updated_at, completed_at
       ) SELECT ?, ?, ?, ?, ?, ?, 'planned', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL
       WHERE EXISTS (
         SELECT 1 FROM pair_calendar_state state JOIN active_pair_members member ON member.pair_id = state.pair_id
         WHERE state.pair_id = ? AND state.revision = ? AND member.user_id = ?
       )`,
    ).bind(plan.id, pairId, plan.libraryItemId, plan.date, plan.startTime, plan.note, plan.bvid, plan.page, plan.canonicalUrl,
      plan.titleSnapshot, plan.coverUrlSnapshot, actor.id, actor.nickname, actor.id, actor.nickname, now, now, pairId, expectedRevision, actor.id);
    return this.runMutation(pairId, actor.id, expectedRevision, statement, now);
  }
  async updatePlan(pairId: string, actor: UserRecord, expectedRevision: number, plan: CalendarPlanRecord, now: number): Promise<CalendarMutationResult> {
    const statement = this.db.prepare(
      `UPDATE calendar_plans SET scheduled_date = ?, start_time = ?, note = ?, status = ?, completed_at = ?,
         updated_by_user_id = ?, updated_by_nickname_snapshot = ?, updated_at = ?
       WHERE pair_id = ? AND id = ? AND EXISTS (
         SELECT 1 FROM pair_calendar_state state JOIN active_pair_members member ON member.pair_id = state.pair_id
         WHERE state.pair_id = ? AND state.revision = ? AND member.user_id = ?
       )`,
    ).bind(plan.date, plan.startTime, plan.note, plan.status, plan.completedAt, actor.id, actor.nickname, now, pairId, plan.id, pairId, expectedRevision, actor.id);
    return this.runMutation(pairId, actor.id, expectedRevision, statement, now);
  }
  async deletePlan(pairId: string, actor: UserRecord, expectedRevision: number, planId: string, now: number): Promise<CalendarMutationResult> {
    const statement = this.db.prepare(
      `DELETE FROM calendar_plans WHERE pair_id = ? AND id = ? AND EXISTS (
         SELECT 1 FROM pair_calendar_state state JOIN active_pair_members member ON member.pair_id = state.pair_id
         WHERE state.pair_id = ? AND state.revision = ? AND member.user_id = ?
       )`,
    ).bind(pairId, planId, pairId, expectedRevision, actor.id);
    return this.runMutation(pairId, actor.id, expectedRevision, statement, now);
  }
  private async runMutation(pairId: string, userId: string, expectedRevision: number, statement: D1PreparedStatement, now: number): Promise<CalendarMutationResult> {
    const revisionStatement = this.db.prepare(
      `UPDATE pair_calendar_state SET revision = revision + 1, updated_at = ?
       WHERE pair_id = ? AND revision = ? AND EXISTS (SELECT 1 FROM active_pair_members WHERE pair_id = ? AND user_id = ?)`,
    ).bind(now, pairId, expectedRevision, pairId, userId);
    const results = await this.db.batch([statement, revisionStatement]);
    const applied = results[0]?.meta.changes === 1 && results[1]?.meta.changes === 1;
    const current = await this.state(pairId);
    return { applied, currentRevision: current?.revision ?? 0 };
  }
}
