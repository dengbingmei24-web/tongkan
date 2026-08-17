import { describe, expect, it } from "vitest";
import type { Env } from "./env";
import type { ActivePairRecord, PairInviteRecord, UserRecord } from "./models";
import { PairService, type PairRepository } from "./pair-service";

import type { PairArchiveRecord, PairRetentionDecision } from './models';

class MemoryPairRepository implements PairRepository {
  readonly invites: PairInviteRecord[] = [];
  readonly pairs = new Map<string, ActivePairRecord>();
  readonly users = new Map<string, UserRecord>();
  readonly pairUsers = new Map<string, [string, string]>();
  readonly archives = new Map<string, PairArchiveRecord>();

  async insertPairInvite(invite: PairInviteRecord): Promise<void> { this.invites.push(invite); }
  async invalidatePairInvites(inviterUserId: string, invalidatedAt: number): Promise<void> {
    for (const invite of this.invites) {
      if (invite.inviterUserId === inviterUserId && invite.usedAt === null) invite.usedAt = invalidatedAt;
    }
  }
  async pairInviteByCodeHash(codeHash: string): Promise<PairInviteRecord | null> {
    return this.invites.find((invite) => invite.codeHash === codeHash) ?? null;
  }
  async activePairByUser(userId: string): Promise<ActivePairRecord | null> { return this.pairs.get(userId) ?? null; }
  async pairArchiveByUser(pairId: string, userId: string): Promise<PairArchiveRecord | null> {
    return this.archives.get(this.archiveKey(pairId, userId)) ?? null;
  }
  async pairArchivesByUser(userId: string): Promise<PairArchiveRecord[]> {
    return [...this.archives.values()]
      .filter((archive) => archive.userId === userId && archive.retentionStatus !== 'delete')
      .sort((left, right) => right.unboundAt - left.unboundAt || left.pairId.localeCompare(right.pairId));
  }
  async unbindPair(pairId: string, userId: string, retention: PairRetentionDecision, now: number): Promise<boolean> {
    const active = this.pairs.get(userId);
    const members = this.pairUsers.get(pairId);
    if (!active || active.pairId !== pairId || !members) return false;
    const [userAId, userBId] = members;
    const userARecord = this.users.get(userAId);
    const userBRecord = this.users.get(userBId);
    if (!userARecord || !userBRecord) return false;
    this.pairs.delete(userAId);
    this.pairs.delete(userBId);
    for (const invite of this.invites) {
      if ((invite.inviterUserId === userAId || invite.inviterUserId === userBId) && invite.usedAt === null) {
        invite.usedAt = now;
      }
    }
    this.archives.set(this.archiveKey(pairId, userAId), this.archiveRecord(
      pairId,
      active.boundAt,
      now,
      userARecord,
      userBRecord,
      userId === userAId ? retention : 'pending',
    ));
    this.archives.set(this.archiveKey(pairId, userBId), this.archiveRecord(
      pairId,
      active.boundAt,
      now,
      userBRecord,
      userARecord,
      userId === userBId ? retention : 'pending',
    ));
    return true;
  }
  async setPairArchiveRetention(
    pairId: string,
    userId: string,
    retention: PairRetentionDecision,
    now: number,
  ): Promise<{ updated: boolean; pairDeleted: boolean }> {
    const archive = this.archives.get(this.archiveKey(pairId, userId));
    if (!archive || archive.retentionStatus !== 'pending') return { updated: false, pairDeleted: false };
    archive.retentionStatus = retention;
    archive.decidedAt = now;
    const members = this.pairUsers.get(pairId);
    const bothDelete = members?.every((memberId) => this.archives.get(this.archiveKey(pairId, memberId))?.retentionStatus === 'delete') ?? false;
    if (bothDelete && members) {
      for (const memberId of members) this.archives.delete(this.archiveKey(pairId, memberId));
      this.pairUsers.delete(pairId);
    }
    return { updated: true, pairDeleted: bothDelete };
  }
  async acceptPairInvite(invite: PairInviteRecord, accepterUserId: string, pairId: string, now: number): Promise<boolean> {
    if (invite.usedAt !== null || this.pairs.has(invite.inviterUserId) || this.pairs.has(accepterUserId)) return false;
    const inviter = this.users.get(invite.inviterUserId);
    const accepter = this.users.get(accepterUserId);
    if (!inviter || !accepter) return false;
    invite.usedAt = now;
    invite.acceptedByUserId = accepterUserId;
    this.pairs.set(inviter.id, { pairId, boundAt: now, partner: accepter });
    this.pairs.set(accepter.id, { pairId, boundAt: now, partner: inviter });
    this.pairUsers.set(pairId, [inviter.id, accepter.id]);
    return true;
  }

  private archiveKey(pairId: string, userId: string): string { return pairId + ':' + userId; }

  private archiveRecord(
    pairId: string,
    boundAt: number,
    unboundAt: number,
    user: UserRecord,
    partner: UserRecord,
    retentionStatus: PairArchiveRecord['retentionStatus'],
  ): PairArchiveRecord {
    return {
      pairId,
      userId: user.id,
      partnerUserId: partner.id,
      boundAt,
      unboundAt,
      retentionStatus,
      decidedAt: retentionStatus === 'pending' ? null : unboundAt,
      createdAt: unboundAt,
      partnerEmailSnapshot: partner.emailMasked,
      partnerNicknameSnapshot: partner.nickname,
      partnerAvatarSnapshot: partner.avatarId,
    };
  }
}

const testEnv = { AUTH_SECRET: "pair-secret" } as Env;
const userA: UserRecord = { id: "a", emailHmac: "a", emailMasked: "a***@example.com", nickname: "A", avatarId: "signal-01", createdAt: 1, updatedAt: 1 };
const userB: UserRecord = { id: "b", emailHmac: "b", emailMasked: "b***@example.com", nickname: "B", avatarId: "signal-02", createdAt: 1, updatedAt: 1 };

describe("PairService", () => {
  it("creates a one-time invite and binds two users", async () => {
    const repository = new MemoryPairRepository();
    repository.users.set(userA.id, userA);
    repository.users.set(userB.id, userB);
    const service = new PairService(testEnv, repository, () => 1_800_000_000_000);
    const invite = await service.createInvite(userA);
    expect(invite.code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/);
    const pair = await service.acceptInvite(userB, invite.code.toLowerCase());
    expect(pair.partner.id).toBe(userA.id);
    expect((await service.getPair(userA))?.partner.id).toBe(userB.id);
    await expect(service.acceptInvite(userB, invite.code)).rejects.toMatchObject({ code: "PAIR_ALREADY_BOUND" });
  });

  it("rejects self binding", async () => {
    const repository = new MemoryPairRepository();
    repository.users.set(userA.id, userA);
    const service = new PairService(testEnv, repository, () => 1_800_000_000_000);
    const invite = await service.createInvite(userA);
    await expect(service.acceptInvite(userA, invite.code)).rejects.toMatchObject({ code: "PAIR_SELF_BIND" });
  });

  it("rejects expired invites", async () => {
    const repository = new MemoryPairRepository();
    repository.users.set(userA.id, userA);
    repository.users.set(userB.id, userB);
    let now = 1_800_000_000_000;
    const service = new PairService(testEnv, repository, () => now);
    const invite = await service.createInvite(userA);
    now += 24 * 60 * 60 * 1000 + 1;
    await expect(service.acceptInvite(userB, invite.code)).rejects.toMatchObject({ code: "PAIR_INVITE_EXPIRED" });
  });

  it("invalidates the previous code when generating a replacement", async () => {
    const repository = new MemoryPairRepository();
    repository.users.set(userA.id, userA);
    repository.users.set(userB.id, userB);
    const service = new PairService(testEnv, repository, () => 1_800_000_000_000);
    const previous = await service.createInvite(userA);
    const replacement = await service.createInvite(userA);
    expect(replacement.code).not.toBe(previous.code);
    await expect(service.acceptInvite(userB, previous.code)).rejects.toMatchObject({ code: "PAIR_INVITE_NOT_FOUND" });
  });
});

describe('PairService retention combinations', () => {
  it('supports every keep and delete combination without overwriting either user', async () => {
    const combinations = [
      ['keep', 'keep'],
      ['keep', 'delete'],
      ['delete', 'keep'],
      ['delete', 'delete'],
    ] as const;

    for (const [initiatorDecision, partnerDecision] of combinations) {
      const repository = new MemoryPairRepository();
      repository.users.set(userA.id, userA);
      repository.users.set(userB.id, userB);
      const service = new PairService(testEnv, repository, () => 1_800_000_000_000);
      const invite = await service.createInvite(userA);
      const pairId = (await service.acceptInvite(userB, invite.code)).pairId;
      await service.unbind(userA, pairId, initiatorDecision);
      const result = await service.decideArchiveRetention(userB, pairId, partnerDecision);

      expect(result.pairDeleted).toBe(initiatorDecision === 'delete' && partnerDecision === 'delete');
      if (!result.pairDeleted) {
        expect(repository.archives.get(pairId + ':' + userA.id)?.retentionStatus).toBe(initiatorDecision);
        expect(repository.archives.get(pairId + ':' + userB.id)?.retentionStatus).toBe(partnerDecision);
      }
    }
  });
});

describe('PairService archives', () => {
  async function bind(repository: MemoryPairRepository, service: PairService, inviter: UserRecord, accepter: UserRecord): Promise<string> {
    repository.users.set(inviter.id, inviter);
    repository.users.set(accepter.id, accepter);
    const invite = await service.createInvite(inviter);
    return (await service.acceptInvite(accepter, invite.code)).pairId;
  }

  it('unbinds immediately, invalidates both users invites and exposes independent states', async () => {
    const repository = new MemoryPairRepository();
    const service = new PairService(testEnv, repository, () => 1_800_000_000_000);
    const pairId = await bind(repository, service, userA, userB);
    repository.invites.push(
      { id: 'unused-a', inviterUserId: userA.id, codeHash: 'unused-a', expiresAt: 1_900_000_000_000, usedAt: null, acceptedByUserId: null, createdAt: 1 },
      { id: 'unused-b', inviterUserId: userB.id, codeHash: 'unused-b', expiresAt: 1_900_000_000_000, usedAt: null, acceptedByUserId: null, createdAt: 1 },
    );

    const result = await service.unbind(userA, pairId, 'keep');

    expect(result.archive?.retention).toBe('keep');
    expect(await service.getPair(userA)).toBeNull();
    expect(await service.getPair(userB)).toBeNull();
    expect(repository.invites.every((invite) => invite.usedAt !== null)).toBe(true);
    expect((await service.getPairState(userA)).archives).toHaveLength(1);
    expect((await service.getPairState(userB)).pendingArchives[0]?.partner.nickname).toBe('A');
  });

  it('keeps retention decisions independent and hides delete records', async () => {
    const repository = new MemoryPairRepository();
    const service = new PairService(testEnv, repository, () => 1_800_000_000_000);
    const pairId = await bind(repository, service, userA, userB);
    await service.unbind(userA, pairId, 'keep');

    const deleted = await service.decideArchiveRetention(userB, pairId, 'delete');

    expect(deleted).toEqual({ archive: null, pairDeleted: false });
    expect((await service.getPairState(userA)).archives).toHaveLength(1);
    expect((await service.getPairState(userB)).archives).toHaveLength(0);
    expect(repository.pairUsers.has(pairId)).toBe(true);
  });

  it('makes same decisions idempotent and rejects a different finalized decision', async () => {
    const repository = new MemoryPairRepository();
    const service = new PairService(testEnv, repository, () => 1_800_000_000_000);
    const pairId = await bind(repository, service, userA, userB);
    const first = await service.unbind(userA, pairId, 'keep');

    await expect(service.unbind(userA, pairId, 'keep')).resolves.toEqual(first);
    await expect(service.unbind(userA, pairId, 'delete')).rejects.toMatchObject({ code: 'PAIR_RETENTION_FINAL' });
  });

  for (const decision of ['keep', 'delete'] as const) {
    it(`makes concurrent same-user ${decision} unbind requests idempotent`, async () => {
      const repository = new MemoryPairRepository();
      const firstService = new PairService(testEnv, repository, () => 1_800_000_000_000);
      const secondService = new PairService(testEnv, repository, () => 1_800_000_000_000);
      const pairId = await bind(repository, firstService, userA, userB);

      const [first, second] = await Promise.all([
        firstService.unbind(userA, pairId, decision),
        secondService.unbind(userA, pairId, decision),
      ]);

      expect(second).toEqual(first);
      expect(repository.archives.get(pairId + ':' + userA.id)?.retentionStatus).toBe(decision);
      expect(repository.archives.get(pairId + ':' + userB.id)?.retentionStatus).toBe('pending');
    });
  }

  it('rejects the losing decision when concurrent same-user unbind requests differ', async () => {
    const repository = new MemoryPairRepository();
    const keepService = new PairService(testEnv, repository, () => 1_800_000_000_000);
    const deleteService = new PairService(testEnv, repository, () => 1_800_000_000_000);
    const pairId = await bind(repository, keepService, userA, userB);

    const results = await Promise.allSettled([
      keepService.unbind(userA, pairId, 'keep'),
      deleteService.unbind(userA, pairId, 'delete'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    if (!rejected || rejected.status !== 'rejected') throw new Error('Expected one rejected unbind.');
    expect(rejected.reason).toMatchObject({ code: 'PAIR_RETENTION_FINAL', status: 409 });
  });

  it('returns a conflict when an active unbind loses the CAS race', async () => {
    const repository = new MemoryPairRepository();
    const service = new PairService(testEnv, repository, () => 1_800_000_000_000);
    const pairId = await bind(repository, service, userA, userB);
    const applyWinningUnbind = repository.unbindPair.bind(repository);
    repository.unbindPair = async (targetPairId, _userId, _retention, now) => {
      await applyWinningUnbind(targetPairId, userB.id, 'keep', now + 1);
      return false;
    };

    await expect(service.unbind(userA, pairId, 'delete')).rejects.toMatchObject({
      code: 'PAIR_UNBIND_CONFLICT',
      status: 409,
    });
    expect(repository.archives.get(pairId + ':' + userA.id)?.retentionStatus).toBe('pending');
  });

  it('returns not found when a lost unbind CAS has already been physically deleted', async () => {
    const repository = new MemoryPairRepository();
    const service = new PairService(testEnv, repository, () => 1_800_000_000_000);
    const pairId = await bind(repository, service, userA, userB);
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
  });

  it('does not attribute a later physical deletion to the successful unbind request', async () => {
    const repository = new MemoryPairRepository();
    const service = new PairService(testEnv, repository, () => 1_800_000_000_000);
    const pairId = await bind(repository, service, userA, userB);
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
  });

  it('does not finalize a pending archive through the unbind endpoint', async () => {
    const repository = new MemoryPairRepository();
    const service = new PairService(testEnv, repository, () => 1_800_000_000_000);
    const pairId = await bind(repository, service, userA, userB);
    await service.unbind(userA, pairId, 'keep');

    await expect(service.unbind(userB, pairId, 'delete')).rejects.toMatchObject({
      code: 'PAIR_NOT_ACTIVE',
      status: 409,
    });
    expect(repository.archives.get(pairId + ':' + userB.id)?.retentionStatus).toBe('pending');
    await expect(service.decideArchiveRetention(userB, pairId, 'delete')).resolves.toMatchObject({ pairDeleted: false });
  });

  it('returns not found when an archive disappears during retention finalization', async () => {
    const repository = new MemoryPairRepository();
    const service = new PairService(testEnv, repository, () => 1_800_000_000_000);
    const pairId = await bind(repository, service, userA, userB);
    await service.unbind(userA, pairId, 'keep');
    repository.setPairArchiveRetention = async (targetPairId) => {
      repository.archives.delete(targetPairId + ':' + userA.id);
      repository.archives.delete(targetPairId + ':' + userB.id);
      repository.pairUsers.delete(targetPairId);
      return { updated: false, pairDeleted: false };
    };

    await expect(service.decideArchiveRetention(userB, pairId, 'delete')).rejects.toMatchObject({
      code: 'PAIR_ARCHIVE_NOT_FOUND',
      status: 404,
    });
  });

  it('physically removes the pair only after both users delete', async () => {
    const repository = new MemoryPairRepository();
    const service = new PairService(testEnv, repository, () => 1_800_000_000_000);
    const pairId = await bind(repository, service, userA, userB);
    await service.unbind(userA, pairId, 'delete');

    await expect(service.decideArchiveRetention(userB, pairId, 'delete')).resolves.toEqual({ archive: null, pairDeleted: true });
    expect(repository.pairUsers.has(pairId)).toBe(false);
    expect(repository.archives.size).toBe(0);
    await expect(service.decideArchiveRetention(userA, pairId, 'delete')).rejects.toMatchObject({ code: 'PAIR_ARCHIVE_NOT_FOUND' });
  });

  it('does not let unauthorized or delayed old-pair requests affect a new active pair', async () => {
    const repository = new MemoryPairRepository();
    let now = 1_800_000_000_000;
    const service = new PairService(testEnv, repository, () => now);
    const oldPairId = await bind(repository, service, userA, userB);
    await service.unbind(userA, oldPairId, 'keep');
    const userC: UserRecord = { id: 'c', emailHmac: 'c', emailMasked: 'c***@example.com', nickname: 'C', avatarId: 'signal-03', createdAt: 1, updatedAt: 1 };
    now += 1;
    const newPairId = await bind(repository, service, userA, userC);

    await expect(service.unbind(userC, oldPairId, 'keep')).rejects.toMatchObject({ code: 'PAIR_ARCHIVE_NOT_FOUND' });
    await expect(service.unbind(userA, oldPairId, 'keep')).resolves.toMatchObject({ pairDeleted: false });
    expect((await service.getPair(userA))?.pairId).toBe(newPairId);
    expect((await service.getPair(userC))?.pairId).toBe(newPairId);
  });

  it('orders multiple pending archives by newest unbind time then pair id', async () => {
    const repository = new MemoryPairRepository();
    let now = 1_800_000_000_000;
    const service = new PairService(testEnv, repository, () => now);
    const firstPairId = await bind(repository, service, userA, userB);
    await service.unbind(userB, firstPairId, 'keep');
    const userC: UserRecord = { id: 'c', emailHmac: 'c', emailMasked: 'c***@example.com', nickname: 'C', avatarId: 'signal-03', createdAt: 1, updatedAt: 1 };
    now += 10;
    const secondPairId = await bind(repository, service, userA, userC);
    await service.unbind(userC, secondPairId, 'keep');

    expect((await service.getPairState(userA)).pendingArchives.map((archive) => archive.pairId)).toEqual([secondPairId, firstPairId]);
  });
});
