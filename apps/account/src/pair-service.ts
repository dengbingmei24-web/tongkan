import { hmacHex, normalizePairCode, randomHex, randomPairCode } from "./crypto";
import type { Env } from "./env";
import { AuthError } from "./errors";
import type { ActivePairRecord, PairInviteRecord, PublicUser, UserRecord } from "./models";

import type { PairArchiveRecord, PairArchiveState, PairMutationResult, PairRetentionDecision } from './models';

export interface PairRepository {
  insertPairInvite(invite: PairInviteRecord): Promise<void>;
  invalidatePairInvites(inviterUserId: string, invalidatedAt: number): Promise<void>;
  pairInviteByCodeHash(codeHash: string): Promise<PairInviteRecord | null>;
  activePairByUser(userId: string): Promise<ActivePairRecord | null>;
  acceptPairInvite(invite: PairInviteRecord, accepterUserId: string, pairId: string, now: number): Promise<boolean>;
  pairArchiveByUser(pairId: string, userId: string): Promise<PairArchiveRecord | null>;
  pairArchivesByUser(userId: string): Promise<PairArchiveRecord[]>;
  unbindPair(pairId: string, userId: string, retention: PairRetentionDecision, now: number): Promise<boolean>;
  setPairArchiveRetention(
    pairId: string,
    userId: string,
    retention: PairRetentionDecision,
    now: number,
  ): Promise<{ updated: boolean; pairDeleted: boolean }>;
}

export interface PairInviteResult {
  code: string;
  expiresAt: number;
}

export interface PairResult {
  pairId: string;
  boundAt: number;
  partner: PublicUser;
}

export interface PairStateResult {
  pair: PairResult | null;
  pendingArchives: PairArchiveState[];
  archives: PairArchiveState[];
}

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export class PairService {
  constructor(
    private readonly env: Env,
    private readonly repository: PairRepository,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async createInvite(user: UserRecord): Promise<PairInviteResult> {
    if (await this.repository.activePairByUser(user.id)) {
      throw new AuthError("PAIR_ALREADY_BOUND", "你已经绑定好友，不能再创建邀请。", 409);
    }
    const now = this.now();
    const code = randomPairCode();
    await this.repository.invalidatePairInvites(user.id, now);
    await this.repository.insertPairInvite({
      id: randomHex(16),
      inviterUserId: user.id,
      codeHash: await this.codeHash(code),
      expiresAt: now + INVITE_TTL_MS,
      usedAt: null,
      acceptedByUserId: null,
      createdAt: now,
    });
    return { code, expiresAt: now + INVITE_TTL_MS };
  }

  async acceptInvite(user: UserRecord, rawCode: string): Promise<PairResult> {
    const code = normalizePairCode(rawCode);
    if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/.test(code)) {
      throw new AuthError("PAIR_CODE_INVALID", "请输入有效的好友邀请码。", 400);
    }
    if (await this.repository.activePairByUser(user.id)) {
      throw new AuthError("PAIR_ALREADY_BOUND", "你已经绑定好友，不能接受新的邀请。", 409);
    }
    const invite = await this.repository.pairInviteByCodeHash(await this.codeHash(code));
    const now = this.now();
    if (!invite || invite.usedAt !== null) throw new AuthError("PAIR_INVITE_NOT_FOUND", "邀请码不存在或已经使用。", 404);
    if (invite.expiresAt <= now) throw new AuthError("PAIR_INVITE_EXPIRED", "邀请码已过期，请让好友重新生成。", 410);
    if (invite.inviterUserId === user.id) throw new AuthError("PAIR_SELF_BIND", "不能绑定自己的邀请码。", 400);
    if (await this.repository.activePairByUser(invite.inviterUserId)) {
      throw new AuthError("PAIR_PARTNER_ALREADY_BOUND", "对方已经绑定了好友。", 409);
    }
    const accepted = await this.repository.acceptPairInvite(invite, user.id, randomHex(16), now);
    if (!accepted) throw new AuthError("PAIR_BIND_CONFLICT", "绑定状态刚刚发生变化，请刷新后重试。", 409);
    const pair = await this.repository.activePairByUser(user.id);
    if (!pair) throw new AuthError("PAIR_BIND_FAILED", "绑定未完成，请稍后重试。", 500);
    return this.publicPair(pair);
  }

  async getPair(user: UserRecord): Promise<PairResult | null> {
    const pair = await this.repository.activePairByUser(user.id);
    return pair ? this.publicPair(pair) : null;
  }

  async getPairState(user: UserRecord): Promise<PairStateResult> {
    const [pair, archiveRecords] = await Promise.all([
      this.getPair(user),
      this.repository.pairArchivesByUser(user.id),
    ]);
    return {
      pair,
      pendingArchives: archiveRecords
        .filter((archive) => archive.retentionStatus === 'pending')
        .map((archive) => this.publicArchive(archive)),
      archives: archiveRecords
        .filter((archive) => archive.retentionStatus === 'keep')
        .map((archive) => this.publicArchive(archive)),
    };
  }

  async unbind(
    user: UserRecord,
    pairId: string,
    retentionValue: string,
  ): Promise<PairMutationResult> {
    const targetPairId = this.validPairId(pairId);
    const retention = this.validRetention(retentionValue);
    const activePair = await this.repository.activePairByUser(user.id);
    if (activePair?.pairId === targetPairId) {
      const applied = await this.repository.unbindPair(targetPairId, user.id, retention, this.now());
      if (!applied) {
        throw new AuthError('PAIR_UNBIND_CONFLICT', '绑定状态刚刚发生变化，请刷新后重试。', 409);
      }
      const archive = await this.repository.pairArchiveByUser(targetPairId, user.id);
      return archive ? this.mutationResult(archive, false) : { archive: null, pairDeleted: true };
    }
    return this.retryFinalizedUnbind(user.id, targetPairId, retention);
  }

  async decideArchiveRetention(
    user: UserRecord,
    pairId: string,
    retentionValue: string,
  ): Promise<PairMutationResult> {
    return this.finalizeArchiveDecision(
      user.id,
      this.validPairId(pairId),
      this.validRetention(retentionValue),
    );
  }

  private async finalizeArchiveDecision(
    userId: string,
    pairId: string,
    retention: PairRetentionDecision,
  ): Promise<PairMutationResult> {
    const existing = await this.repository.pairArchiveByUser(pairId, userId);
    if (!existing) throw new AuthError('PAIR_ARCHIVE_NOT_FOUND', '旧空间不存在或已删除。', 404);
    if (existing.retentionStatus === retention) return this.mutationResult(existing, false);
    if (existing.retentionStatus !== 'pending') {
      throw new AuthError('PAIR_RETENTION_FINAL', '数据保留选择已经确认，不能修改。', 409);
    }

    const result = await this.repository.setPairArchiveRetention(pairId, userId, retention, this.now());
    if (result.pairDeleted) return { archive: null, pairDeleted: true };
    const updated = await this.repository.pairArchiveByUser(pairId, userId);
    if (!updated) {
      if (result.updated) return { archive: null, pairDeleted: true };
      throw new AuthError('PAIR_ARCHIVE_NOT_FOUND', '旧空间不存在或已删除。', 404);
    }
    if (!result.updated && updated.retentionStatus !== retention) {
      throw new AuthError('PAIR_RETENTION_FINAL', '数据保留选择已经确认，不能修改。', 409);
    }
    return this.mutationResult(updated, false);
  }

  private async retryFinalizedUnbind(
    userId: string,
    pairId: string,
    retention: PairRetentionDecision,
  ): Promise<PairMutationResult> {
    const existing = await this.repository.pairArchiveByUser(pairId, userId);
    if (!existing) throw new AuthError('PAIR_ARCHIVE_NOT_FOUND', '旧空间不存在或已删除。', 404);
    if (existing.retentionStatus === retention) return this.mutationResult(existing, false);
    if (existing.retentionStatus === 'pending') {
      throw new AuthError('PAIR_NOT_ACTIVE', '当前没有可解绑的好友关系。', 409);
    }
    throw new AuthError('PAIR_RETENTION_FINAL', '数据保留选择已经确认，不能修改。', 409);
  }

  private validPairId(pairId: string): string {
    if (!/^[a-f0-9]{32}$/.test(pairId)) {
      throw new AuthError('INVALID_REQUEST', '好友关系标识无效。', 400);
    }
    return pairId;
  }

  private validRetention(retention: string): PairRetentionDecision {
    if (retention !== 'keep' && retention !== 'delete') {
      throw new AuthError('PAIR_RETENTION_INVALID', '请选择保留或删除旧空间。', 400);
    }
    return retention;
  }

  private mutationResult(archive: PairArchiveRecord, pairDeleted: boolean): PairMutationResult {
    return {
      archive: archive.retentionStatus === 'delete' ? null : this.publicArchive(archive),
      pairDeleted,
    };
  }

  private publicArchive(archive: PairArchiveRecord): PairArchiveState {
    if (archive.retentionStatus === 'delete') {
      throw new Error('Deleted pair archives are not public.');
    }
    return {
      pairId: archive.pairId,
      boundAt: archive.boundAt,
      unboundAt: archive.unboundAt,
      retention: archive.retentionStatus,
      partner: {
        id: archive.partnerUserId,
        email: archive.partnerEmailSnapshot,
        nickname: archive.partnerNicknameSnapshot,
        avatarId: archive.partnerAvatarSnapshot,
      },
    };
  }

  private async codeHash(code: string): Promise<string> {
    return hmacHex(this.env.AUTH_SECRET, "pair-invite:" + normalizePairCode(code));
  }

  private publicPair(pair: ActivePairRecord): PairResult {
    return {
      pairId: pair.pairId,
      boundAt: pair.boundAt,
      partner: {
        id: pair.partner.id,
        email: pair.partner.emailMasked,
        nickname: pair.partner.nickname,
        avatarId: pair.partner.avatarId,
      },
    };
  }
}
