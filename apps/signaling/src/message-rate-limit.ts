import type { ClientMessage, MemberSlot } from "@tongkan/protocol";

export type MessageRateLimitCategory =
  | "auth"
  | "playback.command"
  | "playback.report"
  | "chat.message"
  | "ping"
  | "screen"
  | "rtc.description"
  | "rtc.candidate";

interface RateLimitPolicy {
  capacity: number;
  refillPerSecond: number;
}

interface TokenBucket {
  tokens: number;
  updatedAtMs: number;
}

export const MESSAGE_RATE_LIMIT_POLICIES: Record<MessageRateLimitCategory, RateLimitPolicy> = {
  auth: { capacity: 2, refillPerSecond: 0.2 },
  "playback.command": { capacity: 12, refillPerSecond: 6 },
  "playback.report": { capacity: 10, refillPerSecond: 5 },
  "chat.message": { capacity: 5, refillPerSecond: 1 },
  ping: { capacity: 4, refillPerSecond: 0.5 },
  screen: { capacity: 8, refillPerSecond: 2 },
  "rtc.description": { capacity: 6, refillPerSecond: 1 },
  "rtc.candidate": { capacity: 30, refillPerSecond: 10 },
};

export class MemberMessageRateLimiter {
  private readonly buckets = new Map<string, TokenBucket>();

  allow(slot: MemberSlot, message: ClientMessage, nowMs: number): boolean {
    const category = categoryForMessage(message);
    const policy = MESSAGE_RATE_LIMIT_POLICIES[category];
    const key = `${slot}:${category}`;
    const previous = this.buckets.get(key) ?? { tokens: policy.capacity, updatedAtMs: nowMs };
    const elapsedMs = Math.max(0, nowMs - previous.updatedAtMs);
    const tokens = Math.min(policy.capacity, previous.tokens + elapsedMs / 1_000 * policy.refillPerSecond);
    if (tokens < 1) {
      this.buckets.set(key, { tokens, updatedAtMs: nowMs });
      return false;
    }
    this.buckets.set(key, { tokens: tokens - 1, updatedAtMs: nowMs });
    return true;
  }
}

export function categoryForMessage(message: ClientMessage): MessageRateLimitCategory {
  switch (message.type) {
    case "auth":
      return "auth";
    case "playback.command":
      return "playback.command";
    case "playback.report":
      return "playback.report";
    case "chat.message":
      return "chat.message";
    case "ping":
      return "ping";
    case "screen.start":
    case "screen.stop":
    case "screen.watch.ready":
      return "screen";
    case "rtc.signal":
      return message.signal.kind === "candidate" ? "rtc.candidate" : "rtc.description";
  }
}
