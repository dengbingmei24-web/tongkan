import type { HistoryIngestAck, HistoryIngestSnapshot } from "./history-tracker";

export type HistoryIngestResult =
  | { kind: "success"; ack: HistoryIngestAck }
  | { kind: "terminal"; status: number }
  | { kind: "recoverable"; status: number | null };

export class HistoryIngestClient {
  constructor(
    private readonly fetcher: Fetcher,
    private readonly secret: string,
  ) {}

  async ingest(snapshot: HistoryIngestSnapshot, nowMs: number): Promise<HistoryIngestResult> {
    const body = JSON.stringify(snapshot);
    const timestamp = String(nowMs);
    const signature = await hmacHex(this.secret, `${timestamp}\n${body}`);
    let response: Response;
    try {
      response = await this.fetcher.fetch(new Request(
        `https://account.internal/internal/history/sources/${snapshot.roomId}/snapshot`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-tongkan-history-timestamp": timestamp,
            "x-tongkan-history-signature": signature,
          },
          body,
        },
      ));
    } catch {
      return { kind: "recoverable", status: null };
    }
    if (response.status >= 400 && response.status < 500) {
      return { kind: "terminal", status: response.status };
    }
    if (!response.ok) return { kind: "recoverable", status: response.status };
    try {
      const value = await response.json<unknown>();
      return isHistoryIngestAck(value, snapshot.sourceId)
        ? { kind: "success", ack: value }
        : { kind: "recoverable", status: response.status };
    } catch {
      return { kind: "recoverable", status: response.status };
    }
  }
}

export async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isHistoryIngestAck(value: unknown, sourceId: string): value is HistoryIngestAck {
  if (!isObject(value)) return false;
  const keys = Object.keys(value);
  if (!keys.every((key) => ["sourceId", "acceptedRevision", "acceptedIntervalIds", "stale"].includes(key))) return false;
  return value.sourceId === sourceId
    && typeof value.acceptedRevision === "number"
    && Number.isSafeInteger(value.acceptedRevision)
    && value.acceptedRevision >= 0
    && Array.isArray(value.acceptedIntervalIds)
    && value.acceptedIntervalIds.length <= 256
    && value.acceptedIntervalIds.every((intervalId) => typeof intervalId === "string" && /^[a-f0-9]{32}$/.test(intervalId))
    && typeof value.stale === "boolean";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
