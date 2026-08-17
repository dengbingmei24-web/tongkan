import { describe, expect, it } from "vitest";
import { AuthService, type AuthRepository } from "./auth-service";
import { AuthError } from "./errors";
import type { Env } from "./env";
import type { Mailer, VerificationMail } from "./mailer";
import type { ChallengeRecord, SessionRecord, UserRecord } from "./models";

class MemoryRepository implements AuthRepository {
  challenges: ChallengeRecord[] = [];
  users: UserRecord[] = [];
  sessions: SessionRecord[] = [];

  async latestChallenge(emailHmac: string): Promise<ChallengeRecord | null> {
    return [...this.challenges].filter((item) => item.emailHmac === emailHmac).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  }
  async insertChallenge(challenge: ChallengeRecord): Promise<void> { this.challenges.push(challenge); }
  async deleteChallenge(id: string): Promise<void> { this.challenges = this.challenges.filter((item) => item.id !== id); }
  async incrementChallengeAttempts(id: string): Promise<void> {
    const challenge = this.challenges.find((item) => item.id === id);
    if (challenge) challenge.attempts += 1;
  }
  async consumeChallenge(id: string, consumedAt: number): Promise<boolean> {
    const challenge = this.challenges.find((item) => item.id === id);
    if (!challenge || challenge.consumedAt !== null) return false;
    challenge.consumedAt = consumedAt;
    return true;
  }
  async userByEmail(emailHmac: string): Promise<UserRecord | null> { return this.users.find((item) => item.emailHmac === emailHmac) ?? null; }
  async userById(id: string): Promise<UserRecord | null> { return this.users.find((item) => item.id === id) ?? null; }
  async createUser(user: UserRecord): Promise<void> { this.users.push(user); }
  async updateUserNickname(id: string, nickname: string, updatedAt: number): Promise<void> {
    const user = this.users.find((item) => item.id === id);
    if (user) {
      user.nickname = nickname;
      user.updatedAt = updatedAt;
    }
  }
  async insertSession(session: SessionRecord): Promise<void> { this.sessions.push(session); }
  async sessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> { return this.sessions.find((item) => item.tokenHash === tokenHash) ?? null; }
  async revokeSession(id: string, revokedAt: number): Promise<void> {
    const session = this.sessions.find((item) => item.id === id);
    if (session) session.revokedAt = revokedAt;
  }
}

class MemoryMailer implements Mailer {
  messages: VerificationMail[] = [];
  fail = false;
  async sendVerificationCode(message: VerificationMail): Promise<void> {
    if (this.fail) throw new Error("delivery failed");
    this.messages.push(message);
  }
}

function env(): Env {
  return {
    DB: {} as D1Database,
    AUTH_TEST_MODE: "true",
    EMAIL_HMAC_SECRET: "email-secret-for-tests",
    AUTH_SECRET: "auth-secret-for-tests",
    SESSION_SECRET: "session-secret-for-tests",
    CODE_TTL_SECONDS: "300",
    CODE_RESEND_SECONDS: "60",
    SESSION_TTL_SECONDS: "3600",
  };
}

function createService(now = 1_800_000_000_000) {
  const repository = new MemoryRepository();
  const mailer = new MemoryMailer();
  const service = new AuthService(env(), repository, mailer, () => now);
  return { repository, mailer, service };
}

describe("AuthService", () => {
  it("sends a code, creates a user, and restores the session", async () => {
    const { repository, mailer, service } = createService();
    const sent = await service.sendCode(" User@Example.com ", "203.0.113.8");
    expect(sent.debugCode).toMatch(/^\d{6}$/);
    expect(mailer.messages).toHaveLength(1);
    expect(mailer.messages[0]?.to).toBe("user@example.com");
    const verified = await service.verifyCode("user@example.com", sent.debugCode ?? "", "Pixel Test");
    expect(verified.token).toMatch(/^[a-f0-9]{64}$/);
    expect(verified.user.email).toBe("u***@example.com");
    expect(repository.users).toHaveLength(1);
    const authenticated = await service.authenticate(verified.token);
    expect(authenticated.user.id).toBe(verified.user.id);
  });

  it("enforces the resend window", async () => {
    const { service } = createService();
    await service.sendCode("user@example.com", null);
    await expect(service.sendCode("user@example.com", null)).rejects.toMatchObject({ code: "CODE_SEND_TOO_FREQUENT", status: 429, retryAfterSeconds: 60 });
  });

  it("increments attempts for an incorrect code", async () => {
    const { repository, service } = createService();
    const sent = await service.sendCode("user@example.com", null);
    const wrongCode = sent.debugCode === "000000" ? "000001" : "000000";
    await expect(service.verifyCode("user@example.com", wrongCode, undefined)).rejects.toMatchObject({ code: "CODE_INCORRECT" });
    expect(repository.challenges[0]?.attempts).toBe(1);
  });

  it("removes the challenge when delivery fails", async () => {
    const { repository, mailer, service } = createService();
    mailer.fail = true;
    await expect(service.sendCode("user@example.com", null)).rejects.toBeInstanceOf(AuthError);
    expect(repository.challenges).toHaveLength(0);
  });

  it("revokes the previous token when refreshing", async () => {
    const { repository, service } = createService();
    const sent = await service.sendCode("user@example.com", null);
    const verified = await service.verifyCode("user@example.com", sent.debugCode ?? "", "Android");
    const refreshed = await service.refresh(verified.token);
    expect(refreshed.token).not.toBe(verified.token);
    expect(repository.sessions[0]?.revokedAt).not.toBeNull();
    await expect(service.authenticate(verified.token)).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });

  it("rejects a verification code after it has been consumed", async () => {
    const { service } = createService();
    const sent = await service.sendCode("user@example.com", null);
    await service.verifyCode("user@example.com", sent.debugCode ?? "", "Android");
    await expect(service.verifyCode("user@example.com", sent.debugCode ?? "", "Android"))
      .rejects.toMatchObject({ code: "CODE_NOT_FOUND" });
  });

  it("updates the authenticated nickname and rejects invalid values", async () => {
    const { repository, service } = createService();
    const sent = await service.sendCode("user@example.com", null);
    const verified = await service.verifyCode("user@example.com", sent.debugCode ?? "", "Android");
    const updated = await service.updateProfile(verified.token, "  两个人的昵称  ");
    expect(updated.nickname).toBe("两个人的昵称");
    expect(repository.users[0]?.nickname).toBe("两个人的昵称");
    await expect(service.updateProfile(verified.token, "   "))
      .rejects.toMatchObject({ code: "INVALID_NICKNAME", status: 400 });
  });
});
