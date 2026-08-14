import { describe, expect, it } from "vitest";
import type { Env } from "./env";
import type { ActivePairRecord, DeviceTokenRecord, UserRecord } from "./models";
import { PushService, type DeviceRepository, type PushMessage, type PushProvider } from "./push-service";

class MemoryDeviceRepository implements DeviceRepository {
  readonly devices: DeviceTokenRecord[] = [];
  readonly pairs = new Map<string, ActivePairRecord>();

  async upsertDeviceToken(device: DeviceTokenRecord): Promise<void> {
    for (const item of this.devices) {
      if (item.userId !== device.userId && item.tokenHash === device.tokenHash && item.revokedAt === null) {
        item.revokedAt = device.lastSeenAt;
      }
    }
    const existing = this.devices.find((item) => item.userId === device.userId && item.tokenHash === device.tokenHash);
    if (existing) Object.assign(existing, device, { id: existing.id });
    else this.devices.push(device);
  }

  async revokeDeviceToken(userId: string, tokenHash: string, revokedAt: number): Promise<boolean> {
    const device = this.devices.find((item) => item.userId === userId && item.tokenHash === tokenHash && item.revokedAt === null);
    if (!device) return false;
    device.revokedAt = revokedAt;
    return true;
  }

  async revokeAllDeviceTokens(userId: string, revokedAt: number): Promise<void> {
    for (const device of this.devices) if (device.userId === userId && device.revokedAt === null) device.revokedAt = revokedAt;
  }

  async activeDeviceTokensByUser(userId: string): Promise<DeviceTokenRecord[]> {
    return this.devices.filter((device) => device.userId === userId && device.revokedAt === null);
  }

  async activePairByUser(userId: string): Promise<ActivePairRecord | null> {
    return this.pairs.get(userId) ?? null;
  }
}

class MemoryPushProvider implements PushProvider {
  readonly messages: Array<{ token: string; message: PushMessage }> = [];
  async send(token: string, message: PushMessage): Promise<void> { this.messages.push({ token, message }); }
}

const env = { AUTH_SECRET: "auth-secret" } as Env;
const userA: UserRecord = { id: "a", emailHmac: "a", emailMasked: "a***@example.com", nickname: "A", avatarId: "signal-01", createdAt: 1, updatedAt: 1 };
const userB: UserRecord = { id: "b", emailHmac: "b", emailMasked: "b***@example.com", nickname: "B", avatarId: "signal-02", createdAt: 1, updatedAt: 1 };

function pair(): ActivePairRecord {
  return { pairId: "pair-1", boundAt: 1, partner: userB };
}

describe("PushService", () => {
  it("stores a device token encrypted and sends a validated watch invite", async () => {
    const repository = new MemoryDeviceRepository();
    repository.pairs.set(userA.id, pair());
    const provider = new MemoryPushProvider();
    const service = new PushService(env, repository, provider, () => 1_800_000_000_000);
    const registration = await service.registerDevice(userB, "fcm", "token-value-123", "Pixel", "1.0.0");
    expect(registration.provider).toBe("fcm");
    expect(repository.devices[0]?.tokenCiphertext).not.toBe("token-value-123");

    const result = await service.sendWatchInvite(userA, "https://tongkan-personal.pages.dev/room/room-1#join=invite-key", undefined, undefined);
    expect(result).toMatchObject({ attempted: 1, delivered: 1, fallbackRequired: false });
    expect(provider.messages[0]?.token).toBe("token-value-123");
  });

  it("rejects sending without an active pair", async () => {
    const service = new PushService(env, new MemoryDeviceRepository(), new MemoryPushProvider());
    await expect(service.sendWatchInvite(userA, "https://tongkan-personal.pages.dev/room/room-1#join=invite-key", undefined, undefined)).rejects.toMatchObject({ code: "PAIR_REQUIRED" });
  });

  it("moves a reused device token away from the previous account", async () => {
    const repository = new MemoryDeviceRepository();
    const service = new PushService(env, repository, new MemoryPushProvider(), () => 1_800_000_000_000);
    await service.registerDevice(userA, "fcm", "shared-token-123", "Pixel", "1.0.0");
    await service.registerDevice(userB, "fcm", "shared-token-123", "Pixel", "1.0.0");

    expect(await repository.activeDeviceTokensByUser(userA.id)).toHaveLength(0);
    expect(await repository.activeDeviceTokensByUser(userB.id)).toHaveLength(1);
  });

  it("rejects non-Tongkan room URLs", async () => {
    const repository = new MemoryDeviceRepository();
    repository.pairs.set(userA.id, pair());
    const service = new PushService(env, repository, new MemoryPushProvider());
    await expect(service.sendWatchInvite(userA, "https://evil.example/room/room-1#join=invite-key", undefined, undefined)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
});
