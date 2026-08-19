import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import { ActiveRoomService } from './active-room-service';
import type { Env } from './env';
import type { UserRecord } from './models';
import { PairService } from './pair-service';
import { AccountRepository } from './repository';

const migrationUrls = [
  new URL('../migrations/0001_auth.sql', import.meta.url),
  new URL('../migrations/0002_pairing.sql', import.meta.url),
  new URL('../migrations/0003_device_tokens.sql', import.meta.url),
  new URL('../migrations/0004_pair_archives.sql', import.meta.url),
  new URL('../migrations/0006_active_pair_rooms.sql', import.meta.url),
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
  it('publishes, replaces, reads and clears one active room per pair', async () => {
    const repository = new AccountRepository(database);
    const env = { DB: database, AUTH_SECRET: 'integration-secret' } as Env;
    const { pairId, userA, userB } = await seedActivePair(111);
    const firstNow = 1_900_000_011_000;
    const firstRoomId = hexId(1_111);
    const firstInviteKey = hexId(1_112);
    const firstInviteUrl = `https://tongkan-personal.pages.dev/room/${firstRoomId}#join=${firstInviteKey}`;
    const firstService = new ActiveRoomService(env, repository, () => firstNow);

    await expect(firstService.publish(userA, firstInviteUrl, firstNow + 600_000)).resolves.toEqual({ room: null });
    await expect(firstService.get(userA)).resolves.toEqual({ room: null });
    await expect(firstService.get(userB)).resolves.toMatchObject({
      room: {
        roomId: firstRoomId,
        url: firstInviteUrl,
        host: { id: userA.id },
      },
    });
    const firstStored = await database.prepare(
      'SELECT host_user_id, invite_url_ciphertext FROM active_pair_rooms WHERE pair_id = ?',
    ).bind(pairId).first<{ host_user_id: string; invite_url_ciphertext: string }>();
    expect(firstStored?.host_user_id).toBe(userA.id);
    expect(firstStored?.invite_url_ciphertext).not.toContain(firstInviteKey);

    const secondNow = firstNow + 1_000;
    const secondRoomId = hexId(1_113);
    const secondInviteKey = hexId(1_114);
    const secondInviteUrl = `https://tongkan-personal.pages.dev/room/${secondRoomId}#join=${secondInviteKey}`;
    const secondService = new ActiveRoomService(env, repository, () => secondNow);
    await expect(secondService.publish(userB, secondInviteUrl, secondNow + 600_000)).resolves.toEqual({ room: null });

    expect(await countRows('SELECT COUNT(*) AS count FROM active_pair_rooms WHERE pair_id = ?', pairId)).toBe(1);
    await expect(secondService.get(userA)).resolves.toMatchObject({
      room: {
        roomId: secondRoomId,
        url: secondInviteUrl,
        host: { id: userB.id },
      },
    });
    await expect(secondService.get(userB)).resolves.toEqual({ room: null });

    await secondService.clear(userA);
    expect(await countRows('SELECT COUNT(*) AS count FROM active_pair_rooms WHERE pair_id = ?', pairId)).toBe(1);
    await secondService.clear(userB);
    expect(await countRows('SELECT COUNT(*) AS count FROM active_pair_rooms WHERE pair_id = ?', pairId)).toBe(0);
  });

  it('completes twenty concurrent unbind rounds without split state or duplicate archives', async () => {
    const repository = new AccountRepository(database);
    const env = { DB: database, AUTH_SECRET: 'integration-secret' } as Env;

    for (let round = 1; round <= 20; round += 1) {
      const { pairId, userA, userB } = await seedActivePair(round);
      const serviceA = new PairService(env, repository, () => 1_900_000_000_000 + round);
      const serviceB = new PairService(env, repository, () => 1_900_000_000_100 + round);
      const bothDelete = round % 2 === 0;
      const decisionA = bothDelete ? 'delete' : 'keep';
      const decisionB = 'delete';
      const results = await Promise.allSettled([
        serviceA.unbind(userA, pairId, decisionA),
        serviceB.unbind(userB, pairId, decisionB),
      ]);
      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected');
      const rejectedResult = results.find((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      if (!rejectedResult || rejectedResult.status !== 'rejected') throw new Error('Expected one rejected unbind.');
      expect(rejectedResult.reason).toMatchObject({ code: 'PAIR_UNBIND_CONFLICT', status: 409 });
      if (results[0]?.status === 'rejected') {
        await serviceA.decideArchiveRetention(userA, pairId, decisionA);
      } else {
        await serviceB.decideArchiveRetention(userB, pairId, decisionB);
      }

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

  it('makes concurrent same-user keep and delete requests idempotent', async () => {
    const repository = new AccountRepository(database);
    const env = { DB: database, AUTH_SECRET: 'integration-secret' } as Env;

    for (const [seed, decision] of [[104, 'keep'], [105, 'delete']] as const) {
      const { pairId, userA, userB } = await seedActivePair(seed);
      const firstService = new PairService(env, repository, () => 1_900_000_004_000 + seed);
      const secondService = new PairService(env, repository, () => 1_900_000_004_000 + seed);

      const [first, second] = await Promise.all([
        firstService.unbind(userA, pairId, decision),
        secondService.unbind(userA, pairId, decision),
      ]);

      expect(second).toEqual(first);
      expect(await countRows(
        'SELECT COUNT(*) AS count FROM pair_archive_members WHERE pair_id = ? AND user_id = ? AND retention_status = ?',
        pairId,
        userA.id,
        decision,
      )).toBe(1);
      expect(await countRows(
        `SELECT COUNT(*) AS count FROM pair_archive_members WHERE pair_id = ? AND user_id = ? AND retention_status = 'pending'`,
        pairId,
        userB.id,
      )).toBe(1);
    }
  });

  it('rejects the losing decision for concurrent same-user unbind requests', async () => {
    const repository = new AccountRepository(database);
    const env = { DB: database, AUTH_SECRET: 'integration-secret' } as Env;
    const { pairId, userA } = await seedActivePair(106);
    const keepService = new PairService(env, repository, () => 1_900_000_005_000);
    const deleteService = new PairService(env, repository, () => 1_900_000_005_000);

    const results = await Promise.allSettled([
      keepService.unbind(userA, pairId, 'keep'),
      deleteService.unbind(userA, pairId, 'delete'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    if (!rejected || rejected.status !== 'rejected') throw new Error('Expected one rejected unbind.');
    expect(rejected.reason).toMatchObject({ code: 'PAIR_RETENTION_FINAL', status: 409 });
    const winnerDecision = results[0]?.status === 'fulfilled' ? 'keep' : 'delete';
    expect(await countRows(
      'SELECT COUNT(*) AS count FROM pair_archive_members WHERE pair_id = ? AND user_id = ? AND retention_status = ?',
      pairId,
      userA.id,
      winnerDecision,
    )).toBe(1);
  });

  it('keeps the losing member pending when the other user wins the unbind CAS', async () => {
    const repository = new AccountRepository(database);
    const env = { DB: database, AUTH_SECRET: 'integration-secret' } as Env;
    const { pairId, userA, userB } = await seedActivePair(107);
    const serviceA = new PairService(env, repository, () => 1_900_000_006_000);
    const serviceB = new PairService(env, repository, () => 1_900_000_006_100);

    const results = await Promise.allSettled([
      serviceA.unbind(userA, pairId, 'keep'),
      serviceB.unbind(userB, pairId, 'delete'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejectedIndex = results.findIndex((result) => result.status === 'rejected');
    const rejected = results[rejectedIndex];
    if (!rejected || rejected.status !== 'rejected') throw new Error('Expected one rejected unbind.');
    expect(rejected.reason).toMatchObject({ code: 'PAIR_UNBIND_CONFLICT', status: 409 });
    const losingUser = rejectedIndex === 0 ? userA : userB;
    expect(await countRows(
      `SELECT COUNT(*) AS count FROM pair_archive_members WHERE pair_id = ? AND user_id = ? AND retention_status = 'pending'`,
      pairId,
      losingUser.id,
    )).toBe(1);
  });

  it('returns a non-disclosing 404 when a lost CAS has already been physically deleted', async () => {
    const repository = new AccountRepository(database);
    const env = { DB: database, AUTH_SECRET: 'integration-secret' } as Env;
    const { pairId, userA, userB } = await seedActivePair(108);
    const service = new PairService(env, repository, () => 1_900_000_007_000);
    const applyWinningUnbind = repository.unbindPair.bind(repository);
    repository.unbindPair = async (targetPairId, _userId, _retention, now) => {
      await applyWinningUnbind(targetPairId, userA.id, 'delete', now);
      await repository.setPairArchiveRetention(targetPairId, userB.id, 'delete', now + 1);
      return false;
    };

    await expect(service.unbind(userA, pairId, 'delete')).rejects.toMatchObject({
      code: 'PAIR_ARCHIVE_NOT_FOUND',
      status: 404,
    });
    expect(await countRows('SELECT COUNT(*) AS count FROM pairs WHERE id = ?', pairId)).toBe(0);
  });

  it('does not attribute a later physical deletion to the successful unbind request', async () => {
    const repository = new AccountRepository(database);
    const env = { DB: database, AUTH_SECRET: 'integration-secret' } as Env;
    const { pairId, userA, userB } = await seedActivePair(109);
    const service = new PairService(env, repository, () => 1_900_000_008_000);
    const applyUnbind = repository.unbindPair.bind(repository);
    repository.unbindPair = async (targetPairId, userId, retention, now) => {
      const applied = await applyUnbind(targetPairId, userId, retention, now);
      if (applied) await repository.setPairArchiveRetention(targetPairId, userB.id, 'delete', now + 1);
      return applied;
    };

    await expect(service.unbind(userA, pairId, 'delete')).resolves.toEqual({
      archive: null,
      pairDeleted: false,
    });
    expect(await countRows('SELECT COUNT(*) AS count FROM pairs WHERE id = ?', pairId)).toBe(0);
  });

  it('removes the active pair room in the same unbind batch', async () => {
    const repository = new AccountRepository(database);
    const { pairId, userA } = await seedActivePair(110);
    await database.prepare(
      `INSERT INTO active_pair_rooms (
         pair_id, host_user_id, room_id, invite_url_ciphertext,
         expires_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(pairId, userA.id, hexId(1101), 'encrypted-invite', 2_000_000_000_000, 1, 1).run();

    await expect(repository.unbindPair(pairId, userA.id, 'keep', 1_900_000_010_000)).resolves.toBe(true);
    expect(await countRows('SELECT COUNT(*) AS count FROM active_pair_rooms WHERE pair_id = ?', pairId)).toBe(0);
  });

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
