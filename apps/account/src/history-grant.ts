import { constantTimeEqual } from "./crypto";
import { AuthError } from "./errors";
import type { HistoryGrantPayload } from "./history-models";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ID_PATTERN = /^[a-f0-9]{32}$/;

export async function signHistoryGrant(secret: string, payload: HistoryGrantPayload): Promise<string> {
  const payloadSegment = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  return payloadSegment + "." + base64UrlEncode(await hmacBytes(secret, payloadSegment));
}

export async function verifyHistoryGrant(secret: string, token: string, now: number): Promise<HistoryGrantPayload> {
  const [payloadSegment, signatureSegment, extra] = token.split(".");
  if (!payloadSegment || !signatureSegment || extra !== undefined || token.length > 4096) invalidGrant();
  const expected = base64UrlEncode(await hmacBytes(secret, payloadSegment));
  if (!constantTimeEqual(expected, signatureSegment)) invalidGrant();
  let payload: unknown;
  try {
    payload = JSON.parse(decoder.decode(base64UrlDecode(payloadSegment)));
  } catch {
    invalidGrant();
  }
  if (!isGrantPayload(payload)) invalidGrant();
  if (payload.exp <= now) throw new AuthError("HISTORY_GRANT_EXPIRED", "共同观看授权已过期。", 403);
  if (payload.iat > now + 5 * 60 * 1000 || payload.exp <= payload.iat) invalidGrant();
  return payload;
}

function isGrantPayload(value: unknown): value is HistoryGrantPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return Object.keys(payload).length === 9
    && payload.v === 1
    && isId(payload.grantId)
    && isId(payload.sourceId)
    && isId(payload.pairId)
    && isId(payload.userId)
    && isId(payload.roomId)
    && (payload.slot === "host" || payload.slot === "guest")
    && Number.isSafeInteger(payload.iat)
    && Number.isSafeInteger(payload.exp);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

async function hmacBytes(secret: string, value: string): Promise<Uint8Array> {
  if (!secret.trim()) throw new Error("History grant secret is not configured.");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) invalidGrant();
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    invalidGrant();
  }
}

function invalidGrant(): never {
  throw new AuthError("HISTORY_GRANT_FORBIDDEN", "共同观看授权无效。", 403);
}
