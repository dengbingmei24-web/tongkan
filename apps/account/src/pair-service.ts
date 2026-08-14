import { hmacHex, normalizePairCode, randomHex, randomPairCode } from "./crypto";
import type { Env } from "./env";
import { AuthError } from "./errors";
import type { ActivePairRecord, PairInviteRecord, PublicUser, UserRecord } from "./models";

export interface PairRepository {
  insertPairInvite(invite: PairInviteRecord): Promise<void>;
  invalidatePairInvites(inviterUserId: string, invalidatedAt: number): Promise<void>;
  pairInviteByCodeHash(codeHash: string): Promise<PairInviteRecord | null>;
  activePairByUser(userId: string): Promise<ActivePairRecord | null>;
  acceptPairInvite(invite: PairInviteRecord, accepterUserId: string, pairId: string, now: number): Promise<boolean>;
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
