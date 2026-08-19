import { describe, expect, it } from "vitest";
import type {
  CalendarLibraryItemRecord,
  CalendarMutationResult,
  CalendarPlanInsert,
  CalendarPlanRecord,
  CalendarRange,
  CalendarSnapshot,
  CalendarStateRecord,
} from "./calendar-models";
import type { CalendarRepository } from "./calendar-repository";
import { CalendarService } from "./calendar-service";
import type { UserRecord } from "./models";

const pairId = "11111111111111111111111111111111";
const itemId = "22222222222222222222222222222222";
const secondItemId = "33333333333333333333333333333333";
const user: UserRecord = { id: "user-a", emailHmac: "hmac-a", emailMasked: "a***@qq.com", nickname: "小同", avatarId: "signal-01", createdAt: 1, updatedAt: 1 };

class MemoryCalendarRepository implements CalendarRepository {
  revision = 0;
  active = true;
  exists = true;
  retention: string | null = "keep";
  items: CalendarLibraryItemRecord[] = [
    { id: itemId, pairId, bvid: "BV1xx411c7mD", page: 1, canonicalUrl: "https://www.bilibili.com/video/BV1xx411c7mD?p=1", title: "第一部", coverUrl: "https://i.example/1.jpg" },
    { id: secondItemId, pairId, bvid: "BV1Q5411c7mD", page: 2, canonicalUrl: "https://www.bilibili.com/video/BV1Q5411c7mD?p=2", title: "第二部", coverUrl: null },
  ];
  plans: CalendarPlanRecord[] = [];

  async activePairId(userId: string): Promise<string | null> { return this.active && userId === user.id ? pairId : null; }
  async pairExists(targetPairId: string): Promise<boolean> { return this.exists && targetPairId === pairId; }
  async archiveRetention(): Promise<string | null> { return this.retention; }
  async state(targetPairId: string): Promise<CalendarStateRecord | null> {
    return targetPairId === pairId ? { pairId, revision: this.revision, createdAt: 1, updatedAt: 1 } : null;
  }
  async libraryItemById(_pairId: string, id: string): Promise<CalendarLibraryItemRecord | null> { return this.items.find((item) => item.id === id) ?? null; }
  async planById(_pairId: string, id: string): Promise<CalendarPlanRecord | null> { return this.plans.find((plan) => plan.id === id) ?? null; }
  async planByLibraryItemDate(_pairId: string, id: string, date: string): Promise<CalendarPlanRecord | null> {
    return this.plans.find((plan) => plan.libraryItemId === id && plan.date === date) ?? null;
  }
  async snapshot(targetPairId: string, readOnly: boolean, range: CalendarRange, plannedOnly = false): Promise<CalendarSnapshot> {
    const plans = this.plans.filter((plan) => plan.date >= range.from && plan.date <= range.to && (!plannedOnly || plan.status === "planned"))
      .sort((left, right) => left.date.localeCompare(right.date)
        || Number(left.startTime === null) - Number(right.startTime === null)
        || (left.startTime ?? "").localeCompare(right.startTime ?? "")
        || left.createdAt - right.createdAt || left.id.localeCompare(right.id));
    return {
      pairId: targetPairId, revision: this.revision, readOnly, range,
      plans: plans.map((plan) => ({
        id: plan.id, libraryItemId: plan.libraryItemId, date: plan.date, startTime: plan.startTime, note: plan.note, status: plan.status,
        media: { bvid: plan.bvid, page: plan.page, canonicalUrl: plan.canonicalUrl, title: plan.titleSnapshot, coverUrl: plan.coverUrlSnapshot },
        createdBy: { id: plan.createdByUserId ?? "deleted", nickname: plan.createdByNicknameSnapshot },
        updatedBy: { id: plan.updatedByUserId ?? "deleted", nickname: plan.updatedByNicknameSnapshot },
        createdAt: plan.createdAt, updatedAt: plan.updatedAt, completedAt: plan.completedAt,
      })),
    };
  }
  async createPlan(_pairId: string, actor: UserRecord, expectedRevision: number, plan: CalendarPlanInsert, now: number): Promise<CalendarMutationResult> {
    if (expectedRevision !== this.revision) return { applied: false, currentRevision: this.revision };
    if (this.plans.some((existing) => existing.libraryItemId === plan.libraryItemId && existing.date === plan.date)) {
      throw new Error("UNIQUE constraint failed: calendar_plans.pair_id, calendar_plans.library_item_id, calendar_plans.scheduled_date");
    }
    this.plans.push({
      ...plan, pairId, status: "planned", createdByUserId: actor.id, createdByNicknameSnapshot: actor.nickname,
      updatedByUserId: actor.id, updatedByNicknameSnapshot: actor.nickname, createdAt: now, updatedAt: now, completedAt: null,
    });
    this.revision += 1;
    return { applied: true, currentRevision: this.revision };
  }
  async updatePlan(_pairId: string, actor: UserRecord, expectedRevision: number, plan: CalendarPlanRecord, now: number): Promise<CalendarMutationResult> {
    if (expectedRevision !== this.revision) return { applied: false, currentRevision: this.revision };
    const index = this.plans.findIndex((existing) => existing.id === plan.id);
    if (index < 0) return { applied: false, currentRevision: this.revision };
    this.plans[index] = { ...plan, updatedByUserId: actor.id, updatedByNicknameSnapshot: actor.nickname, updatedAt: now };
    this.revision += 1;
    return { applied: true, currentRevision: this.revision };
  }
  async deletePlan(_pairId: string, _actor: UserRecord, expectedRevision: number, planId: string): Promise<CalendarMutationResult> {
    if (expectedRevision !== this.revision) return { applied: false, currentRevision: this.revision };
    const before = this.plans.length;
    this.plans = this.plans.filter((plan) => plan.id !== planId);
    if (this.plans.length === before) return { applied: false, currentRevision: this.revision };
    this.revision += 1;
    return { applied: true, currentRevision: this.revision };
  }
}

describe("CalendarService", () => {
  it("creates normalized plans and keeps media snapshots", async () => {
    const repository = new MemoryCalendarRepository();
    const service = new CalendarService(repository, () => 1000);
    const snapshot = await service.createPlan(user, itemId, "2026-08-20", " 20:00 ", "  吃完饭一起看  ", 0);
    expect(snapshot).toMatchObject({ revision: 1, range: { from: "2026-08-20", to: "2026-08-20" } });
    expect(snapshot.plans[0]).toMatchObject({
      libraryItemId: itemId, date: "2026-08-20", startTime: "20:00", note: "吃完饭一起看", status: "planned",
      media: { bvid: "BV1xx411c7mD", page: 1, title: "第一部" },
    });
  });

  it("validates real dates, time, note length, pair and library membership without changing revision", async () => {
    const repository = new MemoryCalendarRepository();
    const service = new CalendarService(repository);
    await expect(service.createPlan(user, itemId, "2026-02-30", null, null, 0)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(service.createPlan(user, itemId, "2026-02-28", "", null, 0)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(service.createPlan(user, itemId, "2026-02-28", "24:00", null, 0)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(service.createPlan(user, itemId, "2026-02-28", null, "字".repeat(201), 0)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(service.createPlan(user, "f".repeat(32), "2026-02-28", null, null, 0)).rejects.toMatchObject({ code: "LIBRARY_ITEM_NOT_FOUND" });
    repository.active = false;
    await expect(service.getActiveMonth(user, "2026-08")).rejects.toMatchObject({ code: "PAIR_REQUIRED" });
    expect(repository.revision).toBe(0);
  });

  it("orders timed plans before all-day plans and excludes completed items from today", async () => {
    const repository = new MemoryCalendarRepository();
    const service = new CalendarService(repository, (() => { let now = 1000; return () => ++now; })());
    await service.createPlan(user, itemId, "2026-08-20", "20:00", null, 0);
    await service.createPlan(user, secondItemId, "2026-08-20", null, null, 1);
    const day = await service.getActiveDate(user, "2026-08-20");
    expect(day.plans.map((plan) => plan.startTime)).toEqual(["20:00", null]);
    await service.updatePlan(user, day.plans[0]!.id, { status: "completed" }, 2);
    const today = await service.getToday(user, "2026-08-20");
    expect(today.plans).toHaveLength(1);
    expect(today.plans[0]?.libraryItemId).toBe(secondItemId);
  });

  it("returns duplicate and stale revision conflicts", async () => {
    const repository = new MemoryCalendarRepository();
    const service = new CalendarService(repository);
    await service.createPlan(user, itemId, "2026-08-20", null, null, 0);
    await expect(service.createPlan(user, itemId, "2026-08-20", null, null, 1)).rejects.toMatchObject({ code: "PLAN_ALREADY_EXISTS" });
    await expect(service.createPlan(user, secondItemId, "2026-08-21", null, null, 0)).rejects.toMatchObject({ code: "CALENDAR_VERSION_CONFLICT", currentRevision: 1 });
  });

  it("exposes only kept archives as read-only", async () => {
    const repository = new MemoryCalendarRepository();
    const service = new CalendarService(repository);
    await expect(service.getArchiveMonth(user, pairId, "2026-08")).resolves.toMatchObject({ readOnly: true });
    repository.retention = "delete";
    await expect(service.getArchiveMonth(user, pairId, "2026-08")).rejects.toMatchObject({ code: "ARCHIVE_FORBIDDEN" });
    repository.exists = false;
    await expect(service.getArchiveMonth(user, pairId, "2026-08")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
