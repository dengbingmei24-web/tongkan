import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { BilibiliMetadataResolver } from "./bilibili-metadata";
import type { Env } from "./env";
import { D1LibraryRepository } from "./library-repository";
import { LibraryService } from "./library-service";
import type { UserRecord } from "./models";
import { PairService } from "./pair-service";
import { AccountRepository } from "./repository";

const migrationUrls = [1, 2, 3, 4, 5].map((number) => new URL("../migrations/000" + number + "_" + ["auth", "pairing", "device_tokens", "pair_archives", "shared_library"][number - 1] + ".sql", import.meta.url));
let database: D1Database;
let disposePlatform: (() => Promise<void>) | undefined;

function hexId(value: number): string { return value.toString(16).padStart(32, "0"); }
function userRecord(id: string, nickname: string): UserRecord {
  return { id, emailHmac: "hmac-" + id, emailMasked: nickname + "***@qq.com", nickname, avatarId: "signal-01", createdAt: 1, updatedAt: 1 };
}

async function seedPair(seed: number): Promise<{ pairId: string; userA: UserRecord; userB: UserRecord }> {
  const pairId = hexId(seed * 100 + 1);
  const userA = userRecord("library-a-" + seed, "A" + seed);
  const userB = userRecord("library-b-" + seed, "B" + seed);
  const boundAt = 2_000_000_000_000 + seed;
  await database.batch([
    database.prepare("INSERT INTO users (id, email_hmac, email_masked, nickname, avatar_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(userA.id, userA.emailHmac, userA.emailMasked, userA.nickname, userA.avatarId, 1, 1),
    database.prepare("INSERT INTO users (id, email_hmac, email_masked, nickname, avatar_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(userB.id, userB.emailHmac, userB.emailMasked, userB.nickname, userB.avatarId, 1, 1),
    database.prepare("INSERT INTO pairs (id, user_a_id, user_b_id, status, bound_at) VALUES (?, ?, ?, 'active', ?)").bind(pairId, userA.id, userB.id, boundAt),
    database.prepare("INSERT INTO pair_library_state (pair_id, revision, created_at, updated_at) VALUES (?, 0, ?, ?)").bind(pairId, boundAt, boundAt),
    database.prepare("INSERT INTO active_pair_members (user_id, pair_id, partner_user_id, joined_at) VALUES (?, ?, ?, ?)").bind(userA.id, pairId, userB.id, boundAt),
    database.prepare("INSERT INTO active_pair_members (user_id, pair_id, partner_user_id, joined_at) VALUES (?, ?, ?, ?)").bind(userB.id, pairId, userA.id, boundAt),
  ]);
  return { pairId, userA, userB };
}

async function executeMigration(sql: string): Promise<void> {
  for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
    await database.prepare(statement).run();
  }
}

async function count(sql: string, ...bindings: unknown[]): Promise<number> {
  const row = await database.prepare(sql).bind(...bindings).first<{ count: number }>();
  return Number(row?.count ?? 0);
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

describe("D1 shared library integration", () => {
  it("runs twenty stale-revision races with one winner and zero partial writes", async () => {
    for (let round = 1; round <= 20; round += 1) {
      const { pairId, userA, userB } = await seedPair(round);
      const repository = new D1LibraryRepository(database);
      const serviceA = new LibraryService(repository, new BilibiliMetadataResolver(async () => new Response("", { status: 503 })), () => 3_000_000_000_000 + round);
      const serviceB = new LibraryService(repository, new BilibiliMetadataResolver(async () => new Response("", { status: 503 })), () => 3_000_000_000_100 + round);
      const results = await Promise.allSettled([
        serviceA.createCategory(userA, "A" + round, 0),
        serviceB.createCategory(userB, "B" + round, 0),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      if (!rejected || rejected.status !== "rejected") throw new Error("Expected one stale revision rejection.");
      expect(rejected.reason).toMatchObject({ code: "LIBRARY_VERSION_CONFLICT", currentRevision: 1 });
      expect(await count("SELECT COUNT(*) AS count FROM library_categories WHERE pair_id = ?", pairId)).toBe(1);
      expect((await repository.state(pairId))?.revision).toBe(1);
      const snapshot = await repository.snapshot(pairId, false);
      expect(snapshot.categories).toHaveLength(1);
      expect(snapshot.categories[0]?.position).toBe(0);
    }
  }, 120_000);

  it("rejects late writes, exposes only keep archives, and cascades both-delete data", async () => {
    const accountRepository = new AccountRepository(database);
    const pairService = new PairService({ DB: database, AUTH_SECRET: "integration-secret" } as Env, accountRepository, () => 4_000_000_000_000);
    const libraryRepository = new D1LibraryRepository(database);
    const libraryService = new LibraryService(libraryRepository, new BilibiliMetadataResolver(async () => new Response("", { status: 503 })), () => 4_000_000_000_000);
    const kept = await seedPair(100);
    await libraryService.addBatch(kept.userA, ["https://www.bilibili.com/video/BV1xx411c7mD"], null, 0);
    await pairService.unbind(kept.userA, kept.pairId, "keep");
    await expect(libraryService.createCategory(kept.userA, "晚到写入", 1)).rejects.toMatchObject({ code: "PAIR_REQUIRED" });
    await expect(libraryService.getArchiveLibrary(kept.userA, kept.pairId)).resolves.toMatchObject({ pairId: kept.pairId, readOnly: true });
    await expect(libraryService.getArchiveLibrary(kept.userB, kept.pairId)).rejects.toMatchObject({ code: "ARCHIVE_FORBIDDEN" });
    const outsider = userRecord("library-outsider", "外部");
    await database.prepare("INSERT INTO users (id, email_hmac, email_masked, nickname, avatar_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(outsider.id, outsider.emailHmac, outsider.emailMasked, outsider.nickname, outsider.avatarId, 1, 1).run();
    await expect(libraryService.getArchiveLibrary(outsider, kept.pairId)).rejects.toMatchObject({ code: "ARCHIVE_FORBIDDEN" });

    const deleted = await seedPair(101);
    await libraryService.addBatch(deleted.userA, ["https://www.bilibili.com/video/av123?p=2"], null, 0);
    await pairService.unbind(deleted.userA, deleted.pairId, "delete");
    await pairService.decideArchiveRetention(deleted.userB, deleted.pairId, "delete");
    expect(await count("SELECT COUNT(*) AS count FROM pairs WHERE id = ?", deleted.pairId)).toBe(0);
    expect(await count("SELECT COUNT(*) AS count FROM pair_library_state WHERE pair_id = ?", deleted.pairId)).toBe(0);
    expect(await count("SELECT COUNT(*) AS count FROM library_categories WHERE pair_id = ?", deleted.pairId)).toBe(0);
    expect(await count("SELECT COUNT(*) AS count FROM library_items WHERE pair_id = ?", deleted.pairId)).toBe(0);
  }, 120_000);
});
