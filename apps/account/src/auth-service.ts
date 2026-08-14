import { codeResendSeconds, codeTtlSeconds, isTestMode, sessionTtlSeconds } from "./config";
import { AuthError } from "./errors";
import { constantTimeEqual, hmacHex, isValidEmail, maskEmail, normalizeEmail, randomCode, randomHex } from "./crypto";
import type { Env } from "./env";
import type { Mailer } from "./mailer";
import type { AuthenticatedSession, ChallengeRecord, PublicUser, SessionRecord, UserRecord } from "./models";

export interface AuthRepository {
  latestChallenge(emailHmac: string): Promise<ChallengeRecord | null>;
  insertChallenge(challenge: ChallengeRecord): Promise<void>;
  deleteChallenge(id: string): Promise<void>;
  incrementChallengeAttempts(id: string): Promise<void>;
  consumeChallenge(id: string, consumedAt: number): Promise<boolean>;
  userByEmail(emailHmac: string): Promise<UserRecord | null>;
  userById(id: string): Promise<UserRecord | null>;
  createUser(user: UserRecord): Promise<void>;
  insertSession(session: SessionRecord): Promise<void>;
  sessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  revokeSession(id: string, revokedAt: number): Promise<void>;
}

export interface SendCodeResult {
  retryAfterSeconds: number;
  expiresInSeconds: number;
  debugCode?: string;
}

export interface AuthResult {
  token: string;
  expiresAt: number;
  user: PublicUser;
}

export class AuthService {
  constructor(
    private readonly env: Env,
    private readonly repository: AuthRepository,
    private readonly mailer: Mailer,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async sendCode(rawEmail: string, requesterIp: string | null): Promise<SendCodeResult> {
    const email = normalizeEmail(rawEmail);
    if (!isValidEmail(email)) throw new AuthError("INVALID_EMAIL", "请输入有效邮箱地址。", 400);
    const now = this.now();
    const emailHmac = await hmacHex(this.env.EMAIL_HMAC_SECRET, email);
    const latest = await this.repository.latestChallenge(emailHmac);
    if (latest && latest.availableAfter > now) {
      const retryAfterSeconds = Math.max(1, Math.ceil((latest.availableAfter - now) / 1000));
      throw new AuthError("CODE_SEND_TOO_FREQUENT", "验证码发送得太频繁，请稍后再试。", 429, retryAfterSeconds);
    }

    const code = randomCode();
    const challengeId = randomHex(16);
    const ttlSeconds = codeTtlSeconds(this.env);
    const resendSeconds = codeResendSeconds(this.env);
    const challenge: ChallengeRecord = {
      id: challengeId,
      emailHmac,
      codeHash: await hmacHex(this.env.AUTH_SECRET, challengeId + ":" + code),
      expiresAt: now + ttlSeconds * 1000,
      availableAfter: now + resendSeconds * 1000,
      attempts: 0,
      consumedAt: null,
      requesterIpHash: requesterIp ? await hmacHex(this.env.AUTH_SECRET, "ip:" + requesterIp) : null,
      createdAt: now,
    };
    await this.repository.insertChallenge(challenge);
    try {
      await this.mailer.sendVerificationCode({
        to: email,
        code,
        expiresInMinutes: Math.ceil(ttlSeconds / 60),
      });
    } catch (error) {
      await this.repository.deleteChallenge(challengeId).catch(() => undefined);
      throw new AuthError("EMAIL_DELIVERY_FAILED", "验证码暂时无法发送，请稍后重试。", 503);
    }

    const result: SendCodeResult = { retryAfterSeconds: resendSeconds, expiresInSeconds: ttlSeconds };
    if (isTestMode(this.env)) result.debugCode = code;
    return result;
  }

  async verifyCode(rawEmail: string, rawCode: string, rawDeviceName: string | undefined): Promise<AuthResult> {
    const email = normalizeEmail(rawEmail);
    const code = rawCode.trim();
    if (!isValidEmail(email)) throw new AuthError("INVALID_EMAIL", "请输入有效邮箱地址。", 400);
    if (!/^\d{6}$/.test(code)) throw new AuthError("INVALID_CODE", "请输入 6 位验证码。", 400);
    const now = this.now();
    const emailHmac = await hmacHex(this.env.EMAIL_HMAC_SECRET, email);
    const challenge = await this.repository.latestChallenge(emailHmac);
    if (!challenge || challenge.consumedAt !== null) {
      throw new AuthError("CODE_NOT_FOUND", "请先获取新的验证码。", 400);
    }
    if (challenge.expiresAt <= now) throw new AuthError("CODE_EXPIRED", "验证码已过期，请重新获取。", 400);
    if (challenge.attempts >= 5) throw new AuthError("CODE_ATTEMPTS_EXCEEDED", "验证码尝试次数过多，请重新获取。", 429);

    const candidateHash = await hmacHex(this.env.AUTH_SECRET, challenge.id + ":" + code);
    if (!constantTimeEqual(candidateHash, challenge.codeHash)) {
      await this.repository.incrementChallengeAttempts(challenge.id);
      throw new AuthError("CODE_INCORRECT", "验证码不正确，请检查后重试。", 400);
    }
    const consumed = await this.repository.consumeChallenge(challenge.id, now);
    if (!consumed) throw new AuthError("CODE_ALREADY_USED", "验证码已被使用，请重新获取。", 409);

    let user = await this.repository.userByEmail(emailHmac);
    if (!user) {
      const localPart = email.split("@")[0] ?? "同看用户";
      user = {
        id: randomHex(16),
        emailHmac,
        emailMasked: maskEmail(email),
        nickname: safeNickname(localPart),
        avatarId: "signal-01",
        createdAt: now,
        updatedAt: now,
      };
      await this.repository.createUser(user);
    }
    return this.createSession(user, rawDeviceName, now);
  }

  async authenticate(rawToken: string | null): Promise<AuthenticatedSession> {
    if (!rawToken) throw new AuthError("AUTH_REQUIRED", "请先登录。", 401);
    const tokenHash = await hmacHex(this.env.SESSION_SECRET, rawToken);
    const session = await this.repository.sessionByTokenHash(tokenHash);
    const now = this.now();
    if (!session || session.revokedAt !== null || session.expiresAt <= now) {
      throw new AuthError("SESSION_INVALID", "登录状态已失效，请重新登录。", 401);
    }
    const user = await this.repository.userById(session.userId);
    if (!user) throw new AuthError("SESSION_INVALID", "登录状态已失效，请重新登录。", 401);
    return { session, user };
  }

  async refresh(rawToken: string | null): Promise<AuthResult> {
    const authenticated = await this.authenticate(rawToken);
    const now = this.now();
    await this.repository.revokeSession(authenticated.session.id, now);
    return this.createSession(authenticated.user, authenticated.session.deviceName, now);
  }

  async logout(rawToken: string | null): Promise<void> {
    const authenticated = await this.authenticate(rawToken);
    await this.repository.revokeSession(authenticated.session.id, this.now());
  }

  publicUser(user: UserRecord): PublicUser {
    return {
      id: user.id,
      email: user.emailMasked,
      nickname: user.nickname,
      avatarId: user.avatarId,
    };
  }

  private async createSession(user: UserRecord, rawDeviceName: string | undefined, now: number): Promise<AuthResult> {
    const token = randomHex(32);
    const expiresAt = now + sessionTtlSeconds(this.env) * 1000;
    const session: SessionRecord = {
      id: randomHex(16),
      userId: user.id,
      tokenHash: await hmacHex(this.env.SESSION_SECRET, token),
      deviceName: safeDeviceName(rawDeviceName),
      expiresAt,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.insertSession(session);
    return { token, expiresAt, user: this.publicUser(user) };
  }
}

function safeNickname(value: string): string {
  const trimmed = value.trim().slice(0, 24);
  return trimmed || "同看用户";
}

function safeDeviceName(value: string | undefined): string {
  const trimmed = value?.trim().slice(0, 80);
  return trimmed || "Android 设备";
}
