import { describe, expect, it } from "vitest";
import type { Env } from "./env";
import { hasTestAccess } from "./access-guard";

function env(token?: string): Env {
  const value: Env = {
    DB: {} as D1Database,
    EMAIL_HMAC_SECRET: "email",
    AUTH_SECRET: "auth",
    SESSION_SECRET: "session",
  };
  if (token !== undefined) value.TEST_ACCESS_TOKEN = token;
  return value;
}

describe("preview access guard", () => {
  it("allows production environments without a test token", () => {
    expect(hasTestAccess(new Request("https://example.com/api/me"), env())).toBe(true);
  });

  it("requires the matching preview token", () => {
    expect(hasTestAccess(new Request("https://example.com/api/me"), env("preview-key"))).toBe(false);
    expect(hasTestAccess(new Request("https://example.com/api/me", { headers: { "x-tongkan-test-key": "wrong-key" } }), env("preview-key"))).toBe(false);
    expect(hasTestAccess(new Request("https://example.com/api/me", { headers: { "x-tongkan-test-key": "preview-key" } }), env("preview-key"))).toBe(true);
  });
});
