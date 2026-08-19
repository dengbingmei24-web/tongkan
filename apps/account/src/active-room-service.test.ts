import { describe, expect, it } from "vitest";
import { ActiveRoomService, type ActiveRoomRepository } from "./active-room-service";
import type { Env } from "./env";
import type { ActivePairRecord, ActivePairRoomRecord, UserRecord } from "./models";

class MemoryActiveRoomRepository implements ActiveRoomRepository {
  readonly pairs = new Map<string, ActivePairRecord>();
  readonly rooms = new Map<string, ActivePairRoomRecord>();

  async activePairByUser(userId: string): Promise<ActivePairRecord | null> {
    return this.pairs.get(userId) ?? null;
  }

  async activePairRoomByPair(pairId: string): Promise<ActivePairRoomRecord | null> {
    return this.rooms.get(pairId) ?? null;
  }

  async upsertActivePairRoom(room: ActivePairRoomRecord): Promise<boolean> {
    const pair = this.pairs.get(room.hostUserId);
    if (!pair || pair.pairId !== room.pairId) return false;
    this.rooms.set(room.pairId, room);
    return true;
  }

  async clearActivePairRoomByHost(hostUserId: string): Promise<void> {
    for (const [pairId, room] of this.rooms) if (room.hostUserId === hostUserId) this.rooms.delete(pairId);
  }

  async clearActivePairRoom(pairId: string): Promise<void> {
    this.rooms.delete(pairId);
  }
}

const env = { AUTH_SECRET: "active-room-secret" } as Env;
const userA: UserRecord = { id: "user-a", emailHmac: "a", emailMasked: "a***@example.com", nickname: "A", avatarId: "signal-01", createdAt: 1, updatedAt: 1 };
const userB: UserRecord = { id: "user-b", emailHmac: "b", emailMasked: "b***@example.com", nickname: "B", avatarId: "signal-02", createdAt: 1, updatedAt: 1 };
const pairId = "1".repeat(32);
const roomId = "2".repeat(32);
const inviteKey = "3".repeat(32);
const inviteUrl = `https://tongkan-personal.pages.dev/room/${roomId}#join=${inviteKey}`;

function repository(): MemoryActiveRoomRepository {
  const value = new MemoryActiveRoomRepository();
  value.pairs.set(userA.id, { pairId, boundAt: 1, partner: userB });
  value.pairs.set(userB.id, { pairId, boundAt: 1, partner: userA });
  return value;
}

describe("ActiveRoomService", () => {
  it("publishes for the pair and only exposes the room to the partner", async () => {
    const data = repository();
    const now = 1_800_000_000_000;
    const service = new ActiveRoomService(env, data, () => now);

    await expect(service.publish(userA, inviteUrl, now + 600_000)).resolves.toEqual({ room: null });
    expect(data.rooms.get(pairId)?.inviteUrlCiphertext).not.toContain(inviteKey);
    await expect(service.get(userA)).resolves.toEqual({ room: null });
    await expect(service.get(userB)).resolves.toMatchObject({
      room: { roomId, url: inviteUrl, expiresAt: now + 600_000, host: { id: userA.id, nickname: "A" } },
    });
  });

  it("hides and clears expired rooms", async () => {
    const data = repository();
    let now = 1_800_000_000_000;
    const service = new ActiveRoomService(env, data, () => now);
    await service.publish(userA, inviteUrl, now + 1_000);
    now += 1_001;

    await expect(service.get(userB)).resolves.toEqual({ room: null });
    expect(data.rooms.has(pairId)).toBe(false);
  });

  it("clears only rooms hosted by the caller", async () => {
    const data = repository();
    const now = 1_800_000_000_000;
    const service = new ActiveRoomService(env, data, () => now);
    await service.publish(userA, inviteUrl, now + 600_000);

    await service.clear(userB);
    expect(data.rooms.has(pairId)).toBe(true);
    await service.clear(userA);
    expect(data.rooms.has(pairId)).toBe(false);
  });

  it("rejects missing pairs, invalid links and excessive TTL", async () => {
    const now = 1_800_000_000_000;
    const data = repository();
    const service = new ActiveRoomService(env, data, () => now);
    await expect(service.publish({ ...userA, id: "outsider" }, inviteUrl, undefined)).rejects.toMatchObject({ code: "PAIR_REQUIRED" });
    await expect(service.publish(userA, "https://evil.example/room/x#join=y", undefined)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(service.publish(userA, inviteUrl, now + 31 * 60_000)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
});