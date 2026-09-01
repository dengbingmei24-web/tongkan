import { describe, expect, it } from "vitest";
import { signHistoryGrant, verifyHistoryGrant } from "./history-grant";
import type { HistoryGrantPayload } from "./history-models";

const now = 1_788_228_000_000;
const payload: HistoryGrantPayload = {
  v: 1,
  grantId: "1".repeat(32),
  sourceId: "2".repeat(32),
  pairId: "3".repeat(32),
  userId: "4".repeat(32),
  roomId: "5".repeat(32),
  slot: "host",
  iat: now,
  exp: now + 600_000,
};

describe("history grant", () => {
  it("round-trips every frozen identity field", async () => {
    const token = await signHistoryGrant("grant-secret", payload);
    await expect(verifyHistoryGrant("grant-secret", token, now + 1)).resolves.toEqual(payload);
    expect(token).not.toContain(payload.sourceId);
  });

  it("rejects signature and payload tampering", async () => {
    const token = await signHistoryGrant("grant-secret", payload);
    await expect(verifyHistoryGrant("wrong-secret", token, now)).rejects.toMatchObject({ code: "HISTORY_GRANT_FORBIDDEN" });
    const [body, signature] = token.split(".");
    await expect(verifyHistoryGrant("grant-secret", body + "x." + signature, now)).rejects.toMatchObject({ code: "HISTORY_GRANT_FORBIDDEN" });
  });

  it("rejects expired grants and invalid slots", async () => {
    const token = await signHistoryGrant("grant-secret", payload);
    await expect(verifyHistoryGrant("grant-secret", token, payload.exp)).rejects.toMatchObject({ code: "HISTORY_GRANT_EXPIRED" });
    const invalid = await signHistoryGrant("grant-secret", { ...payload, slot: "invalid" as "host" });
    await expect(verifyHistoryGrant("grant-secret", invalid, now)).rejects.toMatchObject({ code: "HISTORY_GRANT_FORBIDDEN" });
  });
});
