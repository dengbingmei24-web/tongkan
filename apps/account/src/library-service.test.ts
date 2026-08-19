import { describe, expect, it } from "vitest";
import { BilibiliMetadataResolver, type FetchLike } from "./bilibili-metadata";
import type {
  LibraryCategoryRecord,
  LibraryFilters,
  LibraryItemInsert,
  LibraryItemRecord,
  LibrarySnapshot,
  LibraryStateRecord,
  MutationResult,
} from "./library-models";
import type { LibraryRepository } from "./library-repository";
import { LibraryService } from "./library-service";
import type { UserRecord } from "./models";

const pairId = "11111111111111111111111111111111";
const user: UserRecord = {
  id: "user-a",
  emailHmac: "hmac-a",
  emailMasked: "a***@qq.com",
  nickname: "小同",
  avatarId: "signal-01",
  createdAt: 1,
  updatedAt: 1,
};

class MemoryLibraryRepository implements LibraryRepository {
  revision = 0;
  active = true;
  categories: LibraryCategoryRecord[] = [];
  items: LibraryItemRecord[] = [];

  async activePairId(userId: string): Promise<string | null> { return this.active && userId === user.id ? pairId : null; }
  async pairExists(targetPairId: string): Promise<boolean> { return targetPairId === pairId; }
  async archiveRetention(): Promise<string | null> { return "keep"; }
  async state(targetPairId: string): Promise<LibraryStateRecord | null> {
    return targetPairId === pairId ? { pairId, revision: this.revision, createdAt: 1, updatedAt: 1 } : null;
  }
  async snapshot(targetPairId: string, readOnly: boolean, _filters: LibraryFilters = {}): Promise<LibrarySnapshot> {
    return {
      pairId: targetPairId,
      revision: this.revision,
      readOnly,
      categories: this.categories.map((category) => ({
        id: category.id, name: category.name, position: category.position, createdAt: category.createdAt, updatedAt: category.updatedAt,
      })),
      items: this.items.map((item) => ({
        id: item.id, bvid: item.bvid, page: item.page, cid: item.cid, canonicalUrl: item.canonicalUrl, title: item.title,
        coverUrl: item.coverUrl, ownerName: item.ownerName, durationSeconds: item.durationSeconds, metadataStatus: item.metadataStatus,
        categoryId: item.categoryId, watchStatus: item.watchStatus, position: item.position,
        addedBy: { id: item.addedByUserId ?? "deleted", nickname: item.addedByNicknameSnapshot },
        updatedBy: { id: item.updatedByUserId ?? "deleted", nickname: item.updatedByNicknameSnapshot },
        createdAt: item.createdAt, updatedAt: item.updatedAt,
      })),
    };
  }
  async categoryById(_targetPairId: string, categoryId: string): Promise<LibraryCategoryRecord | null> {
    return this.categories.find((category) => category.id === categoryId) ?? null;
  }
  async categoryByNameKey(_targetPairId: string, nameKey: string): Promise<LibraryCategoryRecord | null> {
    return this.categories.find((category) => category.nameKey === nameKey) ?? null;
  }
  async categoryIds(): Promise<string[]> { return this.categories.sort((a, b) => a.position - b.position).map((category) => category.id); }
  async nextCategoryPosition(): Promise<number> { return this.categories.length; }
  async itemById(_targetPairId: string, itemId: string): Promise<LibraryItemRecord | null> { return this.items.find((item) => item.id === itemId) ?? null; }
  async itemsByMediaKeys(_targetPairId: string, mediaKeys: string[]): Promise<LibraryItemRecord[]> {
    return this.items.filter((item) => mediaKeys.includes(item.mediaKey));
  }
  async itemIds(): Promise<string[]> { return this.items.sort((a, b) => a.position - b.position).map((item) => item.id); }
  async itemCount(): Promise<number> { return this.items.length; }
  async nextItemPosition(): Promise<number> { return this.items.length; }
  async insertItems(_targetPairId: string, actor: UserRecord, expectedRevision: number, items: LibraryItemInsert[], now: number): Promise<MutationResult> {
    return this.mutate(expectedRevision, () => {
      for (const item of items) {
        this.items.push({
          ...item, pairId, watchStatus: "unwatched", addedByUserId: actor.id, addedByNicknameSnapshot: actor.nickname,
          updatedByUserId: actor.id, updatedByNicknameSnapshot: actor.nickname, createdAt: now, updatedAt: now,
        });
      }
    });
  }
  async createCategory(_targetPairId: string, _actor: UserRecord, expectedRevision: number, category: LibraryCategoryRecord): Promise<MutationResult> {
    return this.mutate(expectedRevision, () => { this.categories.push(category); });
  }
  async renameCategory(_targetPairId: string, actor: UserRecord, expectedRevision: number, categoryId: string, name: string, nameKey: string, now: number): Promise<MutationResult> {
    return this.mutate(expectedRevision, () => {
      const category = this.categories.find((item) => item.id === categoryId);
      if (category) Object.assign(category, { name, nameKey, updatedByUserId: actor.id, updatedAt: now });
    });
  }
  async deleteCategory(_targetPairId: string, _actor: UserRecord, expectedRevision: number, categoryId: string): Promise<MutationResult> {
    return this.mutate(expectedRevision, () => {
      this.categories = this.categories.filter((category) => category.id !== categoryId);
      this.items.forEach((item) => { if (item.categoryId === categoryId) item.categoryId = null; });
    });
  }
  async reorderCategories(_targetPairId: string, _actor: UserRecord, expectedRevision: number, orderedIds: string[]): Promise<MutationResult> {
    return this.mutate(expectedRevision, () => orderedIds.forEach((id, position) => {
      const category = this.categories.find((item) => item.id === id); if (category) category.position = position;
    }));
  }
  async updateItem(_targetPairId: string, _actor: UserRecord, expectedRevision: number, item: LibraryItemRecord): Promise<MutationResult> {
    return this.mutate(expectedRevision, () => {
      const index = this.items.findIndex((current) => current.id === item.id); if (index >= 0) this.items[index] = item;
    });
  }
  async deleteItem(_targetPairId: string, _actor: UserRecord, expectedRevision: number, itemId: string): Promise<MutationResult> {
    return this.mutate(expectedRevision, () => { this.items = this.items.filter((item) => item.id !== itemId); });
  }
  async reorderItems(_targetPairId: string, _actor: UserRecord, expectedRevision: number, orderedIds: string[]): Promise<MutationResult> {
    return this.mutate(expectedRevision, () => orderedIds.forEach((id, position) => {
      const item = this.items.find((entry) => entry.id === id); if (item) item.position = position;
    }));
  }

  private async mutate(expectedRevision: number, action: () => void): Promise<MutationResult> {
    if (!this.active || expectedRevision !== this.revision) return { applied: false, currentRevision: this.revision };
    action();
    this.revision += 1;
    return { applied: true, currentRevision: this.revision };
  }
}

function readyFetch(): FetchLike {
  return async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "b23.tv") {
      return new Response(null, { status: 302, headers: { location: "https://www.bilibili.com/video/BV1xx411c7mD/?p=2" } });
    }
    return Response.json({
      code: 0,
      data: {
        title: "测试视频",
        pic: "https://i0.hdslb.com/bfs/archive/test.jpg",
        owner: { name: "测试UP" },
        duration: 120,
        pages: [{ cid: 11, duration: 60, part: "上" }, { cid: 12, duration: 60, part: "下" }],
      },
    });
  };
}

function partialFetch(): FetchLike {
  return async () => new Response("unavailable", { status: 503 });
}

describe("LibraryService", () => {
  it("stops after a safe B23 redirect already reveals the video identity", async () => {
    const requests: string[] = [];
    const resolver = new BilibiliMetadataResolver(async (input) => {
      const url = new URL(String(input));
      requests.push(url.toString());
      return new Response(null, {
        status: 302,
        headers: { location: "https://www.bilibili.com/video/BV1SBbS6hEHa?p=2&share_source=COPY" },
      });
    });

    await expect(resolver.resolveIdentity("https://b23.tv/XM569Iw")).resolves.toMatchObject({
      identity: { bvid: "BV1SBbS6hEHa", page: 2 },
      error: null,
    });
    expect(requests).toEqual(["https://b23.tv/XM569Iw"]);
  });

  it("extracts a safe video target from a B23 200 HTML response", async () => {
    const resolver = new BilibiliMetadataResolver(async () => new Response(
      '<a href="https://www.bilibili.com/video/BV1SBbS6hEHa?share_source=COPY&amp;p=3">Found</a>',
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
    ));

    await expect(resolver.resolveIdentity("https://b23.tv/XM569Iw")).resolves.toMatchObject({
      identity: { bvid: "BV1SBbS6hEHa", page: 3 },
      error: null,
    });
  });

  it("calls the runtime fetch with the global receiver", async () => {
    const originalFetch = globalThis.fetch;
    const receivers: unknown[] = [];
    globalThis.fetch = (function (this: unknown) {
      receivers.push(this);
      return Promise.resolve(new Response(null, {
        status: 302,
        headers: { location: "https://www.bilibili.com/video/BV1SBbS6hEHa?p=1" },
      }));
    }) as typeof fetch;

    try {
      await expect(new BilibiliMetadataResolver().resolveIdentity("https://b23.tv/XM569Iw")).resolves.toMatchObject({
        identity: { bvid: "BV1SBbS6hEHa", page: 1 },
        error: null,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(receivers).toEqual([globalThis]);
  });

  it("deduplicates B23 and the final BV page while incrementing revision once", async () => {
    const repository = new MemoryLibraryRepository();
    const service = new LibraryService(repository, new BilibiliMetadataResolver(readyFetch()), () => 1000);
    const result = await service.addBatch(user, [
      "https://b23.tv/AbCd123",
      "https://www.bilibili.com/video/BV1xx411c7mD?p=2",
    ], null, 0);

    expect(result.results.map((item) => item.status)).toEqual(["added", "duplicate"]);
    expect(result.library.revision).toBe(1);
    expect(result.library.items).toHaveLength(1);
    expect(result.library.items[0]).toMatchObject({ bvid: "BV1xx411c7mD", page: 2, cid: 12, metadataStatus: "ready" });
  });

  it("stores a partial item when metadata fails and keeps duplicate-only revision unchanged", async () => {
    const repository = new MemoryLibraryRepository();
    const service = new LibraryService(repository, new BilibiliMetadataResolver(partialFetch()), () => 1000);
    const first = await service.addBatch(user, ["https://www.bilibili.com/video/av123?p=3"], null, 0);
    expect(first.library.items[0]).toMatchObject({ bvid: "av123", page: 3, title: "av123 · P3", metadataStatus: "partial" });
    const duplicate = await service.addBatch(user, ["https://www.bilibili.com/video/av123?p=3"], null, 1);
    expect(duplicate.results[0]?.status).toBe("duplicate");
    expect(duplicate.library.revision).toBe(1);
  });

  it("rejects unsafe and excessive B23 redirects without changing revision", async () => {
    let redirectCount = 0;
    const fetcher: FetchLike = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/evil") return new Response(null, { status: 302, headers: { location: "https://example.com/video/BV1xx411c7mD" } });
      redirectCount += 1;
      return new Response(null, { status: 302, headers: { location: "https://b23.tv/loop" + redirectCount } });
    };
    const repository = new MemoryLibraryRepository();
    const service = new LibraryService(repository, new BilibiliMetadataResolver(fetcher));
    const result = await service.addBatch(user, ["https://b23.tv/evil", "https://b23.tv/loop"], null, 0);
    expect(result.results.map((item) => item.error)).toEqual(["B23_RESOLUTION_FAILED", "B23_RESOLUTION_FAILED"]);
    expect(result.library.revision).toBe(0);
  });

  it("enforces the 1000 item limit as per-input rejection", async () => {
    const repository = new MemoryLibraryRepository();
    repository.items = Array.from({ length: 1000 }, (_, index) => seedItem(index));
    const service = new LibraryService(repository, new BilibiliMetadataResolver(partialFetch()));
    const result = await service.addBatch(user, ["https://www.bilibili.com/video/BV1xx411c7mD"], null, 0);
    expect(result.results[0]).toMatchObject({ status: "rejected", error: "LIBRARY_LIMIT_REACHED" });
    expect(result.library.revision).toBe(0);
  });

  it("supports category, watched state, no-op reorder and delete semantics", async () => {
    const repository = new MemoryLibraryRepository();
    const service = new LibraryService(repository, new BilibiliMetadataResolver(partialFetch()), () => 2000);
    const added = await service.addBatch(user, ["https://www.bilibili.com/video/BV1xx411c7mD"], null, 0);
    const categorized = await service.createCategory(user, "  周末  ", added.library.revision);
    const categoryId = categorized.categories[0]?.id ?? "";
    await expect(service.createCategory(user, "周末", categorized.revision)).rejects.toMatchObject({ code: "CATEGORY_NAME_CONFLICT" });
    const updated = await service.updateItem(user, categorized.items[0]?.id ?? "", {
      categoryProvided: true,
      categoryId,
      watchStatus: "watched",
    }, categorized.revision);
    expect(updated.items[0]).toMatchObject({ categoryId, watchStatus: "watched" });
    const noOp = await service.reorderItems(user, updated.items.map((item) => item.id), updated.revision);
    expect(noOp.revision).toBe(updated.revision);
    const deletedCategory = await service.deleteCategory(user, categoryId, noOp.revision);
    expect(deletedCategory.items[0]?.categoryId).toBeNull();
  });

  it("renames a video and preserves the custom title when metadata is refreshed", async () => {
    const repository = new MemoryLibraryRepository();
    const service = new LibraryService(repository, new BilibiliMetadataResolver(readyFetch()), () => 3000);
    const added = await service.addBatch(user, ["https://www.bilibili.com/video/BV1xx411c7mD"], null, 0);
    const renamed = await service.updateItem(user, added.library.items[0]?.id ?? "", {
      categoryProvided: false,
      title: "  周末一起看  ",
    }, added.library.revision);
    expect(renamed.items[0]?.title).toBe("周末一起看");
    const refreshed = await service.updateItem(user, renamed.items[0]?.id ?? "", {
      categoryProvided: false,
      refreshMetadata: true,
    }, renamed.revision);
    expect(refreshed.items[0]?.title).toBe("周末一起看");
    expect(refreshed.items[0]?.coverUrl).toBe("https://i0.hdslb.com/bfs/archive/test.jpg");
  });

  it("rejects empty or overlong video names", async () => {
    const repository = new MemoryLibraryRepository();
    const service = new LibraryService(repository, new BilibiliMetadataResolver(partialFetch()));
    const added = await service.addBatch(user, ["https://www.bilibili.com/video/BV1xx411c7mD"], null, 0);
    await expect(service.updateItem(user, added.library.items[0]?.id ?? "", {
      categoryProvided: false,
      title: "   ",
    }, added.library.revision)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(service.updateItem(user, added.library.items[0]?.id ?? "", {
      categoryProvided: false,
      title: "名".repeat(161),
    }, added.library.revision)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
});

function seedItem(index: number): LibraryItemRecord {
  const id = index.toString(16).padStart(32, "0");
  return {
    id, pairId, mediaKey: "bilibili:BV" + String(index).padStart(10, "0") + ":p1",
    bvid: "BV" + String(index).padStart(10, "0"), page: 1, cid: null,
    canonicalUrl: "https://www.bilibili.com/video/BV" + String(index).padStart(10, "0") + "/?p=1",
    title: "item " + index, coverUrl: null, ownerName: null, durationSeconds: null, metadataStatus: "partial",
    categoryId: null, watchStatus: "unwatched", position: index, addedByUserId: user.id,
    addedByNicknameSnapshot: user.nickname, updatedByUserId: user.id, updatedByNicknameSnapshot: user.nickname,
    createdAt: 1, updatedAt: 1,
  };
}
