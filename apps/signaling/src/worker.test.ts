import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { RoomCreationRateLimiter } from "./worker";
import type { Env } from "./env";

function createNamespace(fetch: (request: Request) => Promise<Response>): DurableObjectNamespace {
  const stub = { fetch } as unknown as DurableObjectStub;
  return {
    idFromName: vi.fn(() => ({}) as DurableObjectId),
    get: vi.fn(() => stub),
  } as unknown as DurableObjectNamespace;
}

function createEnv(rateLimitResponse = new Response(JSON.stringify({ allowed: true }))): Env {
  return {
    ALLOWED_WEB_ORIGINS: "https://watch.example.com,https://staging.example.com",
    ROOM_CREATION_RATE_LIMITER: createNamespace(async () => rateLimitResponse.clone()),
    ROOMS: createNamespace(async () => new Response(JSON.stringify({ initialized: true }), { status: 201 })),
  };
}

describe("signaling Worker browser origin policy", () => {
  it("rejects a cross-origin room creation request before allocating resources", async () => {
    const env = createEnv();
    const response = await worker.fetch(new Request("https://signal.example.com/api/rooms", {
      method: "POST",
      headers: { origin: "https://evil.example.com", "cf-connecting-ip": "203.0.113.10" },
    }), env);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "ORIGIN_NOT_ALLOWED" });
    expect(env.ROOM_CREATION_RATE_LIMITER.idFromName).not.toHaveBeenCalled();
    expect(env.ROOMS.idFromName).not.toHaveBeenCalled();
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("answers an allowed preflight with the exact origin instead of a wildcard", async () => {
    const env = createEnv();
    const response = await worker.fetch(new Request("https://signal.example.com/api/rooms", {
      method: "OPTIONS",
      headers: { origin: "https://watch.example.com" },
    }), env);

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://watch.example.com");
    expect(response.headers.get("access-control-allow-origin")).not.toBe("*");
    expect(response.headers.get("vary")).toContain("Origin");
  });

  it("creates a room for an allowed origin after charging the client IP quota", async () => {
    const env = createEnv();
    const response = await worker.fetch(new Request("https://signal.example.com/api/rooms", {
      method: "POST",
      headers: { origin: "https://watch.example.com", "cf-connecting-ip": "203.0.113.20" },
    }), env);

    expect(response.status).toBe(201);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://watch.example.com");
    expect(env.ROOM_CREATION_RATE_LIMITER.idFromName).toHaveBeenCalledWith("203.0.113.20");
    expect(env.ROOMS.idFromName).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({
      roomId: expect.stringMatching(/^[a-f0-9]{32}$/),
      hostKey: expect.stringMatching(/^[a-f0-9]{32}$/),
      inviteKey: expect.stringMatching(/^[a-f0-9]{32}$/),
    });
  });

  it("returns 429 without creating a room when the client IP exceeds its quota", async () => {
    const env = createEnv(new Response(JSON.stringify({ allowed: false, retryAfterSeconds: 42 }), {
      status: 429,
      headers: { "retry-after": "42" },
    }));
    const response = await worker.fetch(new Request("https://signal.example.com/api/rooms", {
      method: "POST",
      headers: { origin: "https://watch.example.com", "cf-connecting-ip": "203.0.113.10" },
    }), env);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(response.headers.get("access-control-allow-origin")).toBe("https://watch.example.com");
    expect(env.ROOMS.idFromName).not.toHaveBeenCalled();
  });
});

describe("RoomCreationRateLimiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows twenty room creations per minute for one client and then blocks it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-04T00:00:00Z"));
    const values = new Map<string, unknown>();
    const transaction = {
      get: vi.fn(async (key: string) => values.get(key)),
      put: vi.fn(async (key: string, value: unknown) => values.set(key, value)),
    };
    const state = {
      storage: {
        transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
      },
    } as unknown as DurableObjectState;
    const limiter = new RoomCreationRateLimiter(state);

    for (let index = 0; index < 20; index += 1) {
      const response = await limiter.fetch(new Request("https://rate-limit.internal/consume", { method: "POST" }));
      expect(response.status).toBe(200);
    }
    const blocked = await limiter.fetch(new Request("https://rate-limit.internal/consume", { method: "POST" }));

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("60");
  });
});
