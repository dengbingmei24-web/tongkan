import { decryptToken, encryptToken, hmacHex, randomHex } from "./crypto";
import { AuthError } from "./errors";
import type { Env } from "./env";
import type { ActivePairRecord, DeviceTokenRecord, UserRecord } from "./models";

export interface DeviceRepository {
  upsertDeviceToken(device: DeviceTokenRecord): Promise<void>;
  revokeDeviceToken(userId: string, tokenHash: string, revokedAt: number): Promise<boolean>;
  revokeAllDeviceTokens(userId: string, revokedAt: number): Promise<void>;
  activeDeviceTokensByUser(userId: string): Promise<DeviceTokenRecord[]>;
  activePairByUser(userId: string): Promise<ActivePairRecord | null>;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  expiresAt: number;
  inviterUserId: string;
}

export interface PushProvider {
  send(token: string, message: PushMessage): Promise<void>;
}

export interface DeviceRegistrationResult {
  deviceId: string;
  provider: string;
  lastSeenAt: number;
}

export interface WatchInviteResult {
  recipientUserId: string;
  attempted: number;
  delivered: number;
  fallbackRequired: boolean;
}

const MAX_TOKEN_LENGTH = 4096;
const MAX_URL_LENGTH = 1024;
const MAX_TITLE_LENGTH = 80;

export class PushService {
  constructor(
    private readonly env: Env,
    private readonly repository: DeviceRepository,
    private readonly provider: PushProvider = createPushProvider(env),
    private readonly now: () => number = () => Date.now(),
  ) {}

  async registerDevice(
    user: UserRecord,
    provider: string,
    token: string,
    deviceName: string | undefined,
    appVersion: string | undefined,
  ): Promise<DeviceRegistrationResult> {
    const normalizedProvider = normalizeProvider(provider);
    const normalizedToken = normalizeToken(token);
    const now = this.now();
    const tokenHash = await hmacHex(this.env.AUTH_SECRET, `device-token:${normalizedProvider}:${normalizedToken}`);
    await this.repository.upsertDeviceToken({
      id: randomHex(16),
      userId: user.id,
      provider: normalizedProvider,
      tokenHash,
      tokenCiphertext: await encryptToken(this.pushSecret(), normalizedToken),
      deviceName: normalizeText(deviceName, "Android device", 80),
      appVersion: normalizeText(appVersion, "unknown", 40),
      lastSeenAt: now,
      createdAt: now,
      revokedAt: null,
    });
    return { deviceId: tokenHash.slice(0, 32), provider: normalizedProvider, lastSeenAt: now };
  }

  async unregisterDevice(user: UserRecord, provider: string, token: string): Promise<void> {
    const normalizedProvider = normalizeProvider(provider);
    const normalizedToken = normalizeToken(token);
    const tokenHash = await hmacHex(this.env.AUTH_SECRET, `device-token:${normalizedProvider}:${normalizedToken}`);
    await this.repository.revokeDeviceToken(user.id, tokenHash, this.now());
  }

  async sendWatchInvite(
    user: UserRecord,
    url: string,
    title: string | undefined,
    expiresAt: number | undefined,
  ): Promise<WatchInviteResult> {
    const pair = await this.repository.activePairByUser(user.id);
    if (!pair) throw new AuthError("PAIR_REQUIRED", "请先绑定好友，再邀请一起看。", 409);
    const normalizedUrl = validateWatchInviteUrl(url);
    const now = this.now();
    const message: PushMessage = {
      title: normalizeText(title, "好友邀请你一起看", MAX_TITLE_LENGTH),
      body: `${user.nickname} 邀请你进入同看房间`,
      url: normalizedUrl,
      expiresAt: normalizeExpiry(expiresAt, now),
      inviterUserId: user.id,
    };
    const devices = await this.repository.activeDeviceTokensByUser(pair.partner.id);
    let delivered = 0;
    for (const device of devices) {
      try {
        const token = await decryptToken(this.pushSecret(), device.tokenCiphertext);
        await this.provider.send(token, message);
        delivered += 1;
      } catch (error) {
        console.error("Push delivery failed", error instanceof Error ? error.message : String(error));
      }
    }
    return {
      recipientUserId: pair.partner.id,
      attempted: devices.length,
      delivered,
      fallbackRequired: delivered === 0,
    };
  }

  private pushSecret(): string {
    return this.env.PUSH_TOKEN_SECRET || this.env.AUTH_SECRET;
  }
}

class NoopPushProvider implements PushProvider {
  async send(): Promise<void> {
    throw new Error("PUSH_PROVIDER_NOT_CONFIGURED");
  }
}

class FirebasePushProvider implements PushProvider {
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly projectId: string,
    private readonly clientEmail: string,
    private readonly privateKey: string,
  ) {}

  async send(token: string, message: PushMessage): Promise<void> {
    const accessToken = await this.getAccessToken();
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.projectId)}/messages:send`,
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          message: {
            token,
            data: {
              url: message.url,
              expiresAt: String(message.expiresAt),
              inviterUserId: message.inviterUserId,
              title: message.title,
              body: message.body,
            },
            android: {
              priority: "HIGH",
              ttl: Math.max(0, Math.ceil((message.expiresAt - Date.now()) / 1000)) + "s",
            },
          },
        }),
      },
    );
    if (!response.ok) throw new Error(`FCM send failed ${response.status}`);
  }

  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.accessToken && this.accessToken.expiresAt > now + 60) return this.accessToken.value;
    const assertion = await createServiceAccountAssertion(this.clientEmail, this.privateKey, now);
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!response.ok) throw new Error(`FCM OAuth failed ${response.status}`);
    const result = await response.json() as { access_token?: string; expires_in?: number };
    if (!result.access_token || !result.expires_in) throw new Error("FCM OAuth response invalid");
    this.accessToken = { value: result.access_token, expiresAt: now + result.expires_in };
    return result.access_token;
  }
}

class WebhookPushProvider implements PushProvider {
  constructor(private readonly endpoint: string, private readonly authToken: string) {}

  async send(token: string, message: PushMessage): Promise<void> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.authToken ? { authorization: `Bearer ${this.authToken}` } : {}),
      },
      body: JSON.stringify({ token, ...message, data: { url: message.url, expiresAt: String(message.expiresAt) } }),
    });
    if (!response.ok) throw new Error(`push webhook returned ${response.status}`);
  }
}

function createPushProvider(env: Env): PushProvider {
  if (env.PUSH_PROVIDER === "fcm" && env.FCM_PROJECT_ID && env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY) {
    return new FirebasePushProvider(env.FCM_PROJECT_ID, env.FCM_CLIENT_EMAIL, env.FCM_PRIVATE_KEY);
  }
  if (env.PUSH_PROVIDER === "webhook" && env.PUSH_WEBHOOK_URL) {
    return new WebhookPushProvider(env.PUSH_WEBHOOK_URL, env.PUSH_WEBHOOK_AUTH_TOKEN ?? "");
  }
  return new NoopPushProvider();
}

function normalizeProvider(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,32}$/.test(normalized)) throw new AuthError("INVALID_DEVICE", "设备推送服务标识无效。", 400);
  return normalized;
}

function normalizeToken(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > MAX_TOKEN_LENGTH) throw new AuthError("INVALID_DEVICE", "设备通知令牌无效。", 400);
  return normalized;
}

function normalizeText(value: string | undefined, fallback: string, maxLength: number): string {
  const normalized = value?.trim().slice(0, maxLength);
  return normalized || fallback;
}

function normalizeExpiry(value: number | undefined, now: number): number {
  if (value === undefined || !Number.isFinite(value)) return now + 24 * 60 * 60 * 1000;
  if (value <= now || value > now + 7 * 24 * 60 * 60 * 1000) throw new AuthError("INVALID_REQUEST", "邀请有效期无效。", 400);
  return Math.floor(value);
}

function validateWatchInviteUrl(value: string): string {
  if (value.length > MAX_URL_LENGTH) throw new AuthError("INVALID_REQUEST", "房间邀请链接过长。", 400);
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.host !== "tongkan-personal.pages.dev" || !/^\/room\/[a-zA-Z0-9_-]+$/.test(url.pathname) || !url.hash.startsWith("#join=")) {
      throw new Error("invalid invite url");
    }
    return url.toString();
  } catch {
    throw new AuthError("INVALID_REQUEST", "房间邀请链接无效。", 400);
  }
}

async function createServiceAccountAssertion(clientEmail: string, privateKey: string, now: number): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;
}

function pemToArrayBuffer(value: string): ArrayBuffer {
  const normalized = value.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function base64UrlEncode(value: string | Uint8Array): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
