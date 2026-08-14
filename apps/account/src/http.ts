import type { Env } from "./env";
import { AuthError } from "./errors";

const LOCAL_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

export function json(data: unknown, status = 200, origin?: string, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  if (origin) addCors(headers, origin);
  return new Response(JSON.stringify(data), { status, headers });
}

export function errorResponse(error: unknown, origin?: string): Response {
  if (error instanceof AuthError) {
    const headers = error.retryAfterSeconds ? { "retry-after": String(error.retryAfterSeconds) } : undefined;
    return json({ error: error.code, message: error.message }, error.status, origin, headers);
  }
  console.error("Account request failed", error instanceof Error ? error.message : String(error));
  return json({ error: "INTERNAL_ERROR", message: "服务暂时不可用，请稍后重试。" }, 500, origin);
}

export function allowedOrigin(request: Request, env: Env): string | undefined | null {
  const origin = request.headers.get("origin");
  if (!origin) return undefined;
  const configured = env.ALLOWED_WEB_ORIGINS?.split(",") ?? LOCAL_ORIGINS;
  const normalized = configured.map((value) => normalizeOrigin(value.trim()));
  return normalized.includes(origin) ? origin : null;
}

export function preflight(origin: string): Response {
  const headers = new Headers();
  addCors(headers, origin);
  return new Response(null, { status: 204, headers });
}

export async function readObject(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new AuthError("JSON_REQUIRED", "请求必须使用 JSON。", 415);
  }
  try {
    const body = await request.json<unknown>();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
    return body as Record<string, unknown>;
  } catch {
    throw new AuthError("INVALID_JSON", "请求内容不是有效 JSON。", 400);
  }
}

export function stringField(body: Record<string, unknown>, name: string, required = true): string | undefined {
  const value = body[name];
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string") throw new AuthError("INVALID_REQUEST", "请求字段不完整。", 400);
  return value;
}

export function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

function addCors(headers: Headers, origin: string): void {
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-headers", "authorization, content-type");
  headers.set("access-control-allow-methods", "GET, POST, PATCH, DELETE, OPTIONS");
  headers.append("vary", "Origin");
}

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== "/")) {
    throw new Error("ALLOWED_WEB_ORIGINS contains an invalid origin.");
  }
  return url.origin;
}
