import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import type { Env } from './env';
import type { UserRecord } from './models';
import { PairService } from './pair-service';
import { AccountRepository } from './repository';

const migrationUrls = [
  new URL('../migrations/0001_auth.sql', import.meta.url),
  new URL('../migrations/0002_pairing.sql', import.meta.url),
  new URL('../migrations/0003_device_tokens.sql', import.meta.url),
  new URL('../migrations/0004_pair_archives.sql', import.meta.url),
];

let database: D1Database;
let disposePlatform: (() => Promise<void>) | undefined;

function hexId(value: number): string {
  return value.toString(16).padStart(32, '0');
}

function userRecord(id: string, label: string): UserRecord {
  return {
    id,
    emailHmac: 'hmac-' + id,
    emailMasked: label.toLowerCase() + '***@example.com',
    nickname: label,
    avatarId: 'signal-01',
    createdAt: 1,
    updatedAt: 1,
  };
}

async function countRows(sql: string, ...bindings: unknown[]): Promise<number> {
  const row = await database.prepare(sql).bind(...bindings).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

async function executeMigration(sql: string): Promise<void> {
  for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
    await database.prepare(statement).run();
  }
}

async function seedActivePair(seed: number): Promise<{ pairId: string; userA: UserRecord; userB: UserRecord }> {
  const pairId = hexId(seed * 10 + 1);
  const userA = userRecord('user-a-' + seed, 'A' + seed);
  const userB = userRecord('user-b-' + seed, 'B' + seed);
  const boundAt = 1_800_000_000_000 + seed;
  await database.batch([
    database.prepare(
      `INSERT OR IGNORE INTO users (id, email_hmac, email_masked, nickname, avatar_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(userA.id, userA.emailHmac, userA.emailMasked, userA.nickname, userA.avatarId, userA.createdAt, userA.updatedAt),
    database.prepare(
      `INSERT OR IGNORE INTO users (id, email_hmac, email_masked, nickname, avatar_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(userB.id, userB.emailHmac, userB.emailMasked, userB.nickname, userB.avatarId, userB.createdAt, userB.updatedAt),
    database.prepare(
      `INSERT INTO pairs (id, user_a_id, user_b_id, status, bound_at)
       VALUES (?, ?, ?, 'active', ?)`,
    ).bind(pairId, userA.id, userB.id, boundAt),
    database.prepare(
      `INSERT INTO active_pair_members (user_id, pair_id, partner_user_id, joined_at)
       VALUES (?, ?, ?, ?)`,
    ).bind(userA.id, pairId, userB.id, boundAt),
    database.prepare(
      `INSERT INTO active_pair_members (user_id, pair_id, partner_user_id, joined_at)
       VALUES (?, ?, ?, ?)`,
    ).bind(userB.id, pairId, userA.id, boundAt),
    database.prepare(
      `INSERT INTO pair_invites (id, inviter_user_id, code_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind('invite-a-' + seed, userA.id, 'hash-a-' + seed, boundAt + 100_000, boundAt),
    database.prepare(
      `INSERT INTO pair_invites (id, inviter_user_id, code_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind('invite-b-' + seed, userB.id, 'hash-b-' + seed, boundAt + 100_000, boundAt),
    database.prepare(
      `INSERT INTO test_pair_future_children (id, pair_id) VALUES (?, ?)`,
    ).bind('child-' + seed, pairId),
  ]);
  return { pairId, userA, userB };
}

beforeAll(async () => {
  const fsSpecifier = 'node:fs/promises';
  const urlSpecifier = 'node:url';
  const { readFile } = await import(fsSpecifier) as { readFile(path: URL, encoding: string): Promise<string> };
  const { fileURLToPath } = await import(urlSpecifier) as { fileURLToPath(url: URL): string };
  const platform = await getPlatformProxy<{ DB: D1Database }>({
    configPath: fileURLToPath(new URL('../wrangler.toml', import.meta.url)),
    envFiles: [],
    persist: false,
    remoteBindings: false,
  });
  database = platform.env.DB;
  disposePlatform = platform.dispose;
  for (const migrationUrl of migrationUrls) {
    await executeMigration(await readFile(migrationUrl, 'utf8'));
  }
  await database.prepare(
    `CREATE TABLE test_pair_future_children (
       id TEXT PRIMARY KEY,
       pair_id TEXT NOT NULL,
       FOREIGN KEY (pair_id) REFERENCES pairs(id) ON DELETE CASCADE
     );`,
  ).run();
}, 120_000);

afterAll(async () => {
  await disposePlatform?.();
});

describe('AccountRepository local D1 integration', () => {
  it('completes twenty concurrent unbind rounds without split state or duplicate archives', async () => {
    const repository = new AccountRepository(database);
    const env = { DB: database, AUTH_SECRET: 'integration-secret' } as Env;

    for (let round = 1; round <= 20; round += 1) {
      const { pairId, userA, userB } = await seedActivePair(round);
      const serviceA = new PairService(env, repository, () => 1_900_000_000_000 + round);
      const serviceB = new PairService(env, repository, () => 1_900_000_000_100 + round);
      const bothDelete = round % 2 === 0;
      const results = await Promise.allSettled([
        serviceA.unbind(userA, pairId, bothDelete ? 'delete' : 'keep'),
        serviceB.unbind(userB, pairId, 'delete'),
      ]);

      expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
      expect(await countRows('SELECT COUNT(*) AS count FROM active_pair_members WHERE pair_id = ?', pairId)).toBe(0);
      expect(await countRows('SELECT COUNT(*) AS count FROM pair_invites WHERE inviter_user_id IN (?, ?) AND used_at IS NULL', userA.id, userB.id)).toBe(0);
      if (bothDelete) {
        expect(await countRows('SELECT COUNT(*) AS count FROM pairs WHERE id = ?', pairId)).toBe(0);
        expect(await countRows('SELECT COUNT(*) AS count FROM pair_archive_members WHERE pair_id = ?', pairId)).toBe(0);
        expect(await countRows('SELECT COUNT(*) AS count FROM test_pair_future_children WHERE pair_id = ?', pairId)).toBe(0);
      } else {
        expect(await countRows(`SELECT COUNT(*) AS count FROM pairs WHERE id = ? AND status = 'unbound'`, pairId)).toBe(1);
        expect(await countRows('SELECT COUNT(*) AS count FROM pair_archive_members WHERE pair_id = ?', pairId)).toBe(2);
        expect(await countRows(`SELECT COUNT(*) AS count FROM pair_archive_members WHERE pair_id = ? AND retention_status = 'keep'`, pairId)).toBe(1);
        expect(await countRows(`SELECT COUNT(*) AS count FROM pair_archive_members WHERE pair_id = ? AND retention_status = 'delete'`, pairId)).toBe(1);
        expect(await countRows('SELECT COUNT(*) AS count FROM test_pair_future_children WHERE pair_id = ?', pairId)).toBe(1);
      }
    }
  }, 120_000);

  it('rolls the whole batch back when archive creation fails', async () => {
    const repository = new AccountRepository(database);
    const { pairId, userA, userB } = await seedActivePair(101);
    await database.prepare(
      `CREATE TRIGGER test_abort_archive
       BEFORE INSERT ON pair_archive_members
       WHEN NEW.pair_id = '${pairId}'
       BEGIN
         SELECT RAISE(ABORT, 'forced archive failure');
       END;`,
    ).run();

    await expect(repository.unbindPair(pairId, userA.id, 'keep', 1_900_000_001_000)).rejects.toThrow();
    await database.prepare('DROP TRIGGER test_abort_archive;').run();

    expect(await countRows(`SELECT COUNT(*) AS count FROM pairs WHERE id = ? AND status = 'active'`, pairId)).toBe(1);
    expect(await countRows('SELECT COUNT(*) AS count FROM active_pair_members WHERE pair_id = ?', pairId)).toBe(2);
    expect(await countRows('SELECT COUNT(*) AS count FROM pair_archive_members WHERE pair_id = ?', pairId)).toBe(0);
    expect(await countRows('SELECT COUNT(*) AS count FROM pair_invites WHERE inviter_user_id IN (?, ?) AND used_at IS NULL', userA.id, userB.id)).toBe(2);
  });

  it('rejects cross-user CAS without changing the target pair', async () => {
    const repository = new AccountRepository(database);
    const { pairId } = await seedActivePair(102);

    await expect(repository.unbindPair(pairId, 'outsider', 'keep', 1_900_000_002_000)).resolves.toBe(false);
    expect(await countRows(`SELECT COUNT(*) AS count FROM pairs WHERE id = ? AND status = 'active'`, pairId)).toBe(1);
    expect(await countRows('SELECT COUNT(*) AS count FROM active_pair_members WHERE pair_id = ?', pairId)).toBe(2);
    expect(await countRows('SELECT COUNT(*) AS count FROM pair_archive_members WHERE pair_id = ?', pairId)).toBe(0);
  });

  it('keeps a new pair active when an old-pair request arrives late', async () => {
    const repository = new AccountRepository(database);
    const env = { DB: database, AUTH_SECRET: 'integration-secret' } as Env;
    const oldPair = await seedActivePair(103);
    const service = new PairService(env, repository, () => 1_900_000_003_000);
    await service.unbind(oldPair.userA, oldPair.pairId, 'keep');

    const newPairId = hexId(9_999);
    const newPartner = userRecord('user-c-103', 'C103');
    await database.batch([
      database.prepare(
        `INSERT INTO users (id, email_hmac, email_masked, nickname, avatar_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(newPartner.id, newPartner.emailHmac, newPartner.emailMasked, newPartner.nickname, newPartner.avatarId, 1, 1),
      database.prepare(
        `INSERT INTO pairs (id, user_a_id, user_b_id, status, bound_at) VALUES (?, ?, ?, 'active', ?)`,
      ).bind(newPairId, oldPair.userA.id, newPartner.id, 1_900_000_003_100),
      database.prepare(
        `INSERT INTO active_pair_members (user_id, pair_id, partner_user_id, joined_at) VALUES (?, ?, ?, ?)`,
      ).bind(oldPair.userA.id, newPairId, newPartner.id, 1_900_000_003_100),
      database.prepare(
        `INSERT INTO active_pair_members (user_id, pair_id, partner_user_id, joined_at) VALUES (?, ?, ?, ?)`,
      ).bind(newPartner.id, newPairId, oldPair.userA.id, 1_900_000_003_100),
    ]);

    await expect(service.unbind(oldPair.userA, oldPair.pairId, 'keep')).resolves.toMatchObject({ pairDeleted: false });
    expect((await repository.activePairByUser(oldPair.userA.id))?.pairId).toBe(newPairId);
    expect(await countRows(`SELECT COUNT(*) AS count FROM pairs WHERE id = ? AND status = 'active'`, newPairId)).toBe(1);
  });
});
