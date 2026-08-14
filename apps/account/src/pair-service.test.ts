import { describe, expect, it } from "vitest";
import type { Env } from "./env";
import type { ActivePairRecord, PairInviteRecord, UserRecord } from "./models";
import { PairService, type PairRepository } from "./pair-service";

class MemoryPairRepository implements PairRepository {
  readonly invites: PairInviteRecord[] = [];
  readonly pairs = new Map<string, ActivePairRecord>();
  readonly users = new Map<string, UserRecord>();

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
  async acceptPairInvite(invite: PairInviteRecord, accepterUserId: string, pairId: string, now: number): Promise<boolean> {
    if (invite.usedAt !== null || this.pairs.has(invite.inviterUserId) || this.pairs.has(accepterUserId)) return false;
    const inviter = this.users.get(invite.inviterUserId);
    const accepter = this.users.get(accepterUserId);
    if (!inviter || !accepter) return false;
    invite.usedAt = now;
    invite.acceptedByUserId = accepterUserId;
    this.pairs.set(inviter.id, { pairId, boundAt: now, partner: accepter });
    this.pairs.set(accepter.id, { pairId, boundAt: now, partner: inviter });
    return true;
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
