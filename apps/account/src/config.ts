import type { Env } from "./env";

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function codeTtlSeconds(env: Env): number {
  return positiveInteger(env.CODE_TTL_SECONDS, 300);
}

export function codeResendSeconds(env: Env): number {
  return positiveInteger(env.CODE_RESEND_SECONDS, 60);
}

export function sessionTtlSeconds(env: Env): number {
  return positiveInteger(env.SESSION_TTL_SECONDS, 2_592_000);
}

export function isTestMode(env: Env): boolean {
  return env.AUTH_TEST_MODE === "true";
}

export function requireSecrets(env: Env): void {
  if (!env.EMAIL_HMAC_SECRET || !env.AUTH_SECRET || !env.SESSION_SECRET) {
    throw new Error("Account cryptographic secrets are not configured.");
  }
}

export function historyGrantSecret(env: Env): string {
  const secret = env.HISTORY_GRANT_SECRET?.trim();
  if (!secret) throw new Error("History grant secret is not configured.");
  return secret;
}

export function historyIngestSecret(env: Env): string {
  const secret = env.HISTORY_INGEST_SECRET?.trim();
  if (!secret) throw new Error("History ingest secret is not configured.");
  return secret;
}
