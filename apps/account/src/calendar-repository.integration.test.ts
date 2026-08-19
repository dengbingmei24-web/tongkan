import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import type { Env } from "./env";
import { D1CalendarRepository } from "./calendar-repository";
import { CalendarService } from "./calendar-service";
import type { PairInviteRecord, UserRecord } from "./models";
import { PairService } from "./pair-service";
import { AccountRepository } from "./repository";

const migrationNames = ["0001_auth", "0002_pairing", "0003_device_tokens", "0004_pair_archives", "0005_shared_library", "0006_active_pair_rooms", "0007_calendar_plans"];
const migrationUrls = migrationNames.map((name) => new URL("../migrations/" + name + ".sql", import.meta.url));
let database: D1Database;
let disposePlatform: (() => Promise<void>) | undefined;

function hexId(value: number): string { return value.toString(16).padStart(32, "0"); }
function userRecord(id: string, nickname: string): UserRecord {
  return { id, emailHmac: "hmac-" + id, emailMasked: nickname + "***@qq.com", nickname, avatarId: "signal-01", createdAt: 1, updatedAt: 1 };
}
async function executeMigration(sql: string): Promise<void> {
  for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) await database.prepare(statement).run();
}
async function count(sql: string, ...bindings: unknown[]): Promise<number> {
  const row = await database.prepare(sql).bind(...bindings).first<{ count: number }>();
  return Number(row?.count ?? 0);
}
async function seedUser(user: UserRecord): Promise<void> {
  await database.prepare("INSERT INTO users (id, email_hmac, email_masked, nickname, avatar_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(user.id, user.emailHmac, user.emailMasked, user.nickname, user.avatarId, 1, 1).run();
}
async function seedPair(seed: number): Promise<{ pairId: string; userA: UserRecord; userB: UserRecord; itemIds: string[] }> {
  const pairId = hexId(seed * 100 + 1);
  const userA = userRecord("calendar-a-" + seed, "A" + seed);
  const userB = userRecord("calendar-b-" + seed, "B" + seed);
  const boundAt = 2_100_000_000_000 + seed;
  const itemIds = [hexId(seed * 100 + 11), hexId(seed * 100 + 12), hexId(seed * 100 + 13)];
  await database.batch([
    database.prepare("INSERT INTO users (id, email_hmac, email_masked, nickname, avatar_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(userA.id, userA.emailHmac, userA.emailMasked, userA.nickname, userA.avatarId, 1, 1),
    database.prepare("INSERT INTO users (id, email_hmac, email_masked, nickname, avatar_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(userB.id, userB.emailHmac, userB.emailMasked, userB.nickname, userB.avatarId, 1, 1),
    database.prepare("INSERT INTO pairs (id, user_a_id, user_b_id, status, bound_at) VALUES (?, ?, ?, 'active', ?)").bind(pairId, userA.id, userB.id, boundAt),
    database.prepare("INSERT INTO pair_library_state (pair_id, revision, created_at, updated_at) VALUES (?, 0, ?, ?)").bind(pairId, boundAt, boundAt),
    database.prepare("INSERT INTO pair_calendar_state (pair_id, revision, created_at, updated_at) VALUES (?, 0, ?, ?)").bind(pairId, boundAt, boundAt),
    database.prepare("INSERT INTO active_pair_members (user_id, pair_id, partner_user_id, joined_at) VALUES (?, ?, ?, ?)").bind(userA.id, pairId, userB.id, boundAt),
    database.prepare("INSERT INTO active_pair_members (user_id, pair_id, partner_user_id, joined_at) VALUES (?, ?, ?, ?)").bind(userB.id, pairId, userA.id, boundAt),
    ...itemIds.map((itemId, index) => database.prepare(
      `INSERT INTO library_items (
         id, pair_id, media_key, bvid, page, cid, canonical_url, title, cover_url, owner_name, duration_seconds,
         metadata_status, category_id, watch_status, position, added_by_user_id, added_by_nickname_snapshot,
         updated_by_user_id, updated_by_nickname_snapshot, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, NULL, 'partial', NULL, 'unwatched', ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      itemId, pairId, "media-" + seed + "-" + index,
      index === 0 ? "BV1xx411c7mD" : index === 1 ? "BV1Q5411c7mD" : "av123456789",
      index + 1,
      index === 2 ? "https://www.bilibili.com/video/av123456789?p=3" : `https://www.bilibili.com/video/${index === 0 ? "BV1xx411c7mD" : "BV1Q5411c7mD"}?p=${index + 1}`,
      "视频 " + (index + 1), index === 1 ? null : "https://i.example/" + index + ".jpg", index,
      userA.id, userA.nickname, userA.id, userA.nickname, boundAt + index, boundAt + index,
    )),
  ]);
  return { pairId, userA, userB, itemIds };
}

beforeAll(async () => {
  const fsSpecifier = "node:fs/promises";
  const urlSpecifier = "node:url";
  const { readFile } = await import(fsSpecifier) as { readFile(path: URL, encoding: string): Promise<string> };
  const { fileURLToPath } = await import(urlSpecifier) as { fileURLToPath(url: URL): string };
  const platform = await getPlatformProxy<{ DB: D1Database }>({
    configPath: fileURLToPath(new URL("../wrangler.toml", import.meta.url)), envFiles: [], persist: false, remoteBindings: false,
  });
  database = platform.env.DB;
  disposePlatform = platform.dispose;
  for (const migrationUrl of migrationUrls) await executeMigration(await readFile(migrationUrl, "utf8"));
}, 120_000);

afterAll(async () => { await disposePlatform?.(); });

describe("D1 calendar integration", () => {
  it("initializes calendar state when a new pair invite is accepted", async () => {
    const repository = new AccountRepository(database);
    const userA = userRecord("calendar-accept-a", "接受A");
    const userB = userRecord("calendar-accept-b", "接受B");
    await seedUser(userA); await seedUser(userB);
    const now = 2_200_000_000_000;
    const invite: PairInviteRecord = {
      id: hexId(9_001), inviterUserId: userA.id, codeHash: "calendar-accept-hash", expiresAt: now + 100_000,
      usedAt: null, acceptedByUserId: null, createdAt: now,
    };
    await database.prepare("INSERT INTO pair_invites (id, inviter_user_id, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(invite.id, invite.inviterUserId, invite.codeHash, invite.expiresAt, invite.createdAt).run();
    const pairId = hexId(9_002);
    await expect(repository.acceptPairInvite(invite, userB.id, pairId, now)).resolves.toBe(true);
    expect(await count("SELECT COUNT(*) AS count FROM pair_calendar_state WHERE pair_id = ? AND revision = 0", pairId)).toBe(1);
  });

  it("runs twenty stale-revision races with one winner and no partial plan", async () => {
    for (let round = 1; round <= 20; round += 1) {
      const { pairId, userA, userB, itemIds } = await seedPair(round);
      const repository = new D1CalendarRepository(database);
      const serviceA = new CalendarService(repository, () => 3_100_000_000_000 + round);
      const serviceB = new CalendarService(repository, () => 3_100_000_000_100 + round);
      const results = await Promise.allSettled([
        serviceA.createPlan(userA, itemIds[0]!, "2026-08-20", "20:00", null, 0),
        serviceB.createPlan(userB, itemIds[1]!, "2026-08-20", "18:30", null, 0),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      if (!rejected || rejected.status !== "rejected") throw new Error("Expected one revision conflict.");
      expect(rejected.reason).toMatchObject({ code: "CALENDAR_VERSION_CONFLICT", currentRevision: 1 });
      expect(await count("SELECT COUNT(*) AS count FROM calendar_plans WHERE pair_id = ?", pairId)).toBe(1);
      expect(await count("SELECT COUNT(*) AS count FROM pair_calendar_state WHERE pair_id = ? AND revision = 1", pairId)).toBe(1);
    }
  }, 120_000);

  it("sorts timed plans first, filters today, preserves snapshots and supports reschedule/delete", async () => {
    const { pairId, userA, itemIds } = await seedPair(100);
    const repository = new D1CalendarRepository(database);
    let now = 3_200_000_000_000;
    const service = new CalendarService(repository, () => ++now);
    await service.createPlan(userA, itemIds[0]!, "2026-08-20", "20:00", "晚一点", 0);
    await service.createPlan(userA, itemIds[1]!, "2026-08-20", null, null, 1);
    await service.createPlan(userA, itemIds[2]!, "2026-08-20", "18:30", null, 2);
    const day = await service.getActiveDate(userA, "2026-08-20");
    expect(day.plans.map((plan) => plan.startTime)).toEqual(["18:30", "20:00", null]);
    const first = day.plans.find((plan) => plan.libraryItemId === itemIds[0]);
    expect(first?.media).toMatchObject({ bvid: "BV1xx411c7mD", title: "视频 1" });
    if (!first) throw new Error("Expected first plan.");
    await service.updatePlan(userA, first.id, { status: "completed" }, 3);
    expect((await service.getToday(userA, "2026-08-20")).plans).toHaveLength(2);
    const second = (await service.getActiveDate(userA, "2026-08-20")).plans.find((plan) => plan.libraryItemId === itemIds[1]);
    if (!second) throw new Error("Expected second plan.");
    await service.updatePlan(userA, second.id, { date: "2026-08-21", startTime: "19:00", note: "改期" }, 4);
    expect((await service.getActiveDate(userA, "2026-08-21")).plans[0]).toMatchObject({ date: "2026-08-21", startTime: "19:00", note: "改期" });
    const third = (await service.getActiveDate(userA, "2026-08-20")).plans.find((plan) => plan.libraryItemId === itemIds[2]);
    if (!third) throw new Error("Expected third plan.");
    await service.deletePlan(userA, third.id, 5);
    expect(await count("SELECT COUNT(*) AS count FROM calendar_plans WHERE pair_id = ?", pairId)).toBe(2);
    expect((await repository.state(pairId))?.revision).toBe(6);
  }, 120_000);

  it("keeps archives read-only, rejects late writes, and cascades both-delete data", async () => {
    const accountRepository = new AccountRepository(database);
    const pairService = new PairService({ DB: database, AUTH_SECRET: "calendar-secret" } as Env, accountRepository, () => 4_200_000_000_000);
    const repository = new D1CalendarRepository(database);
    const service = new CalendarService(repository, () => 4_200_000_000_000);
    const kept = await seedPair(200);
    await service.createPlan(kept.userA, kept.itemIds[0]!, "2026-08-20", null, null, 0);
    await pairService.unbind(kept.userA, kept.pairId, "keep");
    await expect(service.createPlan(kept.userA, kept.itemIds[1]!, "2026-08-21", null, null, 1)).rejects.toMatchObject({ code: "PAIR_REQUIRED" });
    await expect(service.getArchiveMonth(kept.userA, kept.pairId, "2026-08")).resolves.toMatchObject({ readOnly: true, plans: [{ date: "2026-08-20" }] });
    await expect(service.getArchiveMonth(kept.userB, kept.pairId, "2026-08")).rejects.toMatchObject({ code: "ARCHIVE_FORBIDDEN" });

    const deleted = await seedPair(201);
    await service.createPlan(deleted.userA, deleted.itemIds[0]!, "2026-08-20", null, null, 0);
    await pairService.unbind(deleted.userA, deleted.pairId, "delete");
    await pairService.decideArchiveRetention(deleted.userB, deleted.pairId, "delete");
    expect(await count("SELECT COUNT(*) AS count FROM pairs WHERE id = ?", deleted.pairId)).toBe(0);
    expect(await count("SELECT COUNT(*) AS count FROM pair_calendar_state WHERE pair_id = ?", deleted.pairId)).toBe(0);
    expect(await count("SELECT COUNT(*) AS count FROM calendar_plans WHERE pair_id = ?", deleted.pairId)).toBe(0);
  }, 120_000);
});
