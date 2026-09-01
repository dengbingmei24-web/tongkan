import { describe, expect, it, vi } from "vitest";
import { HistoryIngestClient, hmacHex } from "./history-ingest-client";
import type { HistoryIngestSnapshot } from "./history-tracker";

const snapshot: HistoryIngestSnapshot = {
  sourceId: "1".repeat(32),
  pairId: "2".repeat(32),
  roomId: "3".repeat(32),
  sourceRevision: 7,
  observedAt: 1_788_228_660_000,
  closed: false,
  participants: { hostUserId: "4".repeat(32), guestUserId: "5".repeat(32) },
  intervals: [{
    intervalId: "6".repeat(32),
    sessionId: "7".repeat(32),
    media: {
      bvid: "BV1xx411c7mD",
      page: 1,
      canonicalUrl: "https://www.bilibili.com/video/BV1xx411c7mD",
      titleHint: "测试视频",
    },
    startedAt: 1_788_228_620_000,
    endedAt: 1_788_228_650_000,
    endReason: "checkpoint",
    durationSecondsHint: 1_320,
  }],
};

describe("HistoryIngestClient", () => {
  it("signs the exact timestamp and raw body and accepts a valid ack", async () => {
    const fetch = vi.fn(async (request: Request) => {
      const body = await request.text();
      const timestamp = request.headers.get("x-tongkan-history-timestamp")!;
      expect(request.url).toBe(`https://account.internal/internal/history/sources/${snapshot.roomId}/snapshot`);
      expect(request.headers.get("x-tongkan-history-signature")).toBe(
        await hmacHex("ingest-secret", `${timestamp}\n${body}`),
      );
      expect(JSON.parse(body)).toEqual(snapshot);
      return Response.json({
        sourceId: snapshot.sourceId,
        acceptedRevision: snapshot.sourceRevision,
        acceptedIntervalIds: [snapshot.intervals[0]!.intervalId],
        stale: false,
      });
    });
    const client = new HistoryIngestClient({ fetch } as unknown as Fetcher, "ingest-secret");

    await expect(client.ingest(snapshot, snapshot.observedAt)).resolves.toEqual({
      kind: "success",
      ack: {
        sourceId: snapshot.sourceId,
        acceptedRevision: snapshot.sourceRevision,
        acceptedIntervalIds: [snapshot.intervals[0]!.intervalId],
        stale: false,
      },
    });
  });

  it.each([400, 401, 403, 409, 429])("treats HTTP %s as terminal", async (status) => {
    const fetcher = { fetch: vi.fn(async () => new Response("{}", { status })) } as unknown as Fetcher;
    await expect(new HistoryIngestClient(fetcher, "secret").ingest(snapshot, 1_000)).resolves.toEqual({
      kind: "terminal",
      status,
    });
  });

  it.each([500, 502, 503])("treats HTTP %s as recoverable", async (status) => {
    const fetcher = { fetch: vi.fn(async () => new Response("{}", { status })) } as unknown as Fetcher;
    await expect(new HistoryIngestClient(fetcher, "secret").ingest(snapshot, 1_000)).resolves.toEqual({
      kind: "recoverable",
      status,
    });
  });

  it("treats network failures and malformed success bodies as recoverable", async () => {
    const networkFailure = { fetch: vi.fn(async () => { throw new Error("offline"); }) } as unknown as Fetcher;
    await expect(new HistoryIngestClient(networkFailure, "secret").ingest(snapshot, 1_000)).resolves.toEqual({
      kind: "recoverable",
      status: null,
    });
    const malformed = { fetch: vi.fn(async () => Response.json({ accepted: true })) } as unknown as Fetcher;
    await expect(new HistoryIngestClient(malformed, "secret").ingest(snapshot, 1_000)).resolves.toEqual({
      kind: "recoverable",
      status: 200,
    });
  });
});
