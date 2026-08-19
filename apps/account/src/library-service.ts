import { parseBilibiliUrl } from "@tongkan/protocol";
import { BilibiliMetadataResolver } from "./bilibili-metadata";
import { randomHex } from "./crypto";
import { AuthError } from "./errors";
import type {
  BatchItemResult,
  LibraryCategoryRecord,
  LibraryFilters,
  LibraryItemInsert,
  LibraryItemRecord,
  LibrarySnapshot,
  LibraryWatchStatus,
  MutationResult,
} from "./library-models";
import type { LibraryRepository } from "./library-repository";
import type { UserRecord } from "./models";

const MAX_BATCH_SIZE = 20;
const MAX_LIBRARY_ITEMS = 1000;
const ID_RE = /^[a-f0-9]{32}$/;

export interface ItemPatch {
  categoryProvided: boolean;
  categoryId?: string | null;
  watchStatus?: LibraryWatchStatus;
  refreshMetadata?: boolean;
  title?: string;
}

export class LibraryService {
  constructor(
    private readonly repository: LibraryRepository,
    private readonly metadata: BilibiliMetadataResolver = new BilibiliMetadataResolver(),
    private readonly now: () => number = () => Date.now(),
  ) {}

  async getActiveLibrary(user: UserRecord, filters: LibraryFilters = {}): Promise<LibrarySnapshot> {
    const pairId = await this.requireActivePair(user.id);
    return this.repository.snapshot(pairId, false, filters);
  }

  async getArchiveLibrary(user: UserRecord, pairId: string): Promise<LibrarySnapshot> {
    this.requireId(pairId);
    if (!await this.repository.pairExists(pairId)) {
      throw new AuthError("NOT_FOUND", "旧双人空间不存在。", 404);
    }
    const retention = await this.repository.archiveRetention(pairId, user.id);
    if (retention !== "keep") {
      throw new AuthError("ARCHIVE_FORBIDDEN", "该旧双人空间不可查看。", 403);
    }
    return this.repository.snapshot(pairId, true);
  }

  async addBatch(
    user: UserRecord,
    inputs: string[],
    categoryId: string | null,
    expectedRevision: number,
  ): Promise<{ results: BatchItemResult[]; library: LibrarySnapshot }> {
    if (inputs.length < 1 || inputs.length > MAX_BATCH_SIZE || inputs.some((input) => typeof input !== "string" || input.length < 1 || input.length > 2000)) {
      throw new AuthError("INVALID_REQUEST", "每次请输入 1 到 20 条有效链接。", 400);
    }
    const pairId = await this.requireCurrentRevision(user.id, expectedRevision);
    if (categoryId !== null) {
      this.requireId(categoryId);
      if (!await this.repository.categoryById(pairId, categoryId)) {
        return {
          results: inputs.map((input) => ({ input, status: "rejected", item: null, error: "CATEGORY_NOT_FOUND" })),
          library: await this.repository.snapshot(pairId, false),
        };
      }
    }

    const resolutions = await Promise.all(inputs.map((input) => this.metadata.resolveIdentity(input)));
    const mediaKeys = resolutions.flatMap((resolution) => resolution.identity ? [mediaKey(resolution.identity.bvid, resolution.identity.page)] : []);
    const existingItems = await this.repository.itemsByMediaKeys(pairId, [...new Set(mediaKeys)]);
    const existingByKey = new Map(existingItems.map((item) => [item.mediaKey, item]));
    const currentCount = await this.repository.itemCount(pairId);
    let remaining = Math.max(0, MAX_LIBRARY_ITEMS - currentCount);
    let nextPosition = await this.repository.nextItemPosition(pairId);
    const seen = new Set<string>();
    const planned: Array<{ index: number; input: string; identity: NonNullable<(typeof resolutions)[number]["identity"]> }> = [];
    const results: BatchItemResult[] = inputs.map((input) => ({ input, status: "rejected", item: null, error: "INVALID_BILIBILI_URL" }));

    for (let index = 0; index < inputs.length; index += 1) {
      const input = inputs[index] ?? "";
      const resolution = resolutions[index];
      if (!resolution?.identity) {
        results[index] = { input, status: "rejected", item: null, error: resolution?.error ?? "INVALID_BILIBILI_URL" };
        continue;
      }
      const key = mediaKey(resolution.identity.bvid, resolution.identity.page);
      if (existingByKey.has(key) || seen.has(key)) {
        results[index] = { input, status: "duplicate", item: null, error: null };
        seen.add(key);
        continue;
      }
      if (remaining <= 0) {
        results[index] = { input, status: "rejected", item: null, error: "LIBRARY_LIMIT_REACHED" };
        continue;
      }
      remaining -= 1;
      seen.add(key);
      planned.push({ index, input, identity: resolution.identity });
    }

    const inserts: LibraryItemInsert[] = [];
    const metadataValues = await Promise.all(planned.map((entry) => this.metadata.metadataFor(entry.identity)));
    for (let index = 0; index < planned.length; index += 1) {
      const entry = planned[index];
      const metadata = metadataValues[index];
      if (!entry || !metadata) continue;
      inserts.push({
        id: randomHex(16),
        mediaKey: mediaKey(entry.identity.bvid, entry.identity.page),
        bvid: entry.identity.bvid,
        page: entry.identity.page,
        cid: metadata.cid,
        canonicalUrl: canonicalUrl(entry.identity.bvid, entry.identity.page),
        title: metadata.title,
        coverUrl: metadata.coverUrl,
        ownerName: metadata.ownerName,
        durationSeconds: metadata.durationSeconds,
        metadataStatus: metadata.status,
        categoryId,
        position: nextPosition,
      });
      nextPosition += 1;
      results[entry.index] = { input: entry.input, status: "added", item: null, error: null };
    }

    if (inserts.length > 0) {
      const mutation = await this.repository.insertItems(pairId, user, expectedRevision, inserts, this.now());
      await this.ensureApplied(user.id, pairId, mutation);
    }
    const library = await this.repository.snapshot(pairId, false);
    const itemByKey = new Map(library.items.map((item) => [mediaKey(item.bvid, item.page), item]));
    for (let index = 0; index < resolutions.length; index += 1) {
      const identity = resolutions[index]?.identity;
      if (!identity || results[index]?.status === "rejected") continue;
      const item = itemByKey.get(mediaKey(identity.bvid, identity.page)) ?? null;
      results[index] = { ...results[index], item } as BatchItemResult;
    }
    return { results, library };
  }

  async createCategory(user: UserRecord, nameValue: string, expectedRevision: number): Promise<LibrarySnapshot> {
    const pairId = await this.requireCurrentRevision(user.id, expectedRevision);
    const { name, key } = normalizedCategoryName(nameValue);
    if (await this.repository.categoryByNameKey(pairId, key)) this.categoryConflict();
    const now = this.now();
    const category: LibraryCategoryRecord = {
      id: randomHex(16), pairId, name, nameKey: key, position: await this.repository.nextCategoryPosition(pairId),
      createdByUserId: user.id, updatedByUserId: user.id, createdAt: now, updatedAt: now,
    };
    const mutation = await this.repository.createCategory(pairId, user, expectedRevision, category, now);
    await this.ensureApplied(user.id, pairId, mutation);
    return this.repository.snapshot(pairId, false);
  }

  async renameCategory(user: UserRecord, categoryId: string, nameValue: string, expectedRevision: number): Promise<LibrarySnapshot> {
    this.requireId(categoryId);
    const pairId = await this.requireCurrentRevision(user.id, expectedRevision);
    const category = await this.repository.categoryById(pairId, categoryId);
    if (!category) this.notFound("分类不存在。");
    const { name, key } = normalizedCategoryName(nameValue);
    const conflict = await this.repository.categoryByNameKey(pairId, key);
    if (conflict && conflict.id !== categoryId) this.categoryConflict();
    if (category.name === name && category.nameKey === key) return this.repository.snapshot(pairId, false);
    const mutation = await this.repository.renameCategory(pairId, user, expectedRevision, categoryId, name, key, this.now());
    await this.ensureApplied(user.id, pairId, mutation);
    return this.repository.snapshot(pairId, false);
  }

  async deleteCategory(user: UserRecord, categoryId: string, expectedRevision: number): Promise<LibrarySnapshot> {
    this.requireId(categoryId);
    const pairId = await this.requireCurrentRevision(user.id, expectedRevision);
    if (!await this.repository.categoryById(pairId, categoryId)) this.notFound("分类不存在。");
    const mutation = await this.repository.deleteCategory(pairId, user, expectedRevision, categoryId, this.now());
    await this.ensureApplied(user.id, pairId, mutation);
    return this.repository.snapshot(pairId, false);
  }

  async reorderCategories(user: UserRecord, orderedIds: string[], expectedRevision: number): Promise<LibrarySnapshot> {
    const pairId = await this.requireCurrentRevision(user.id, expectedRevision);
    this.validateCompleteOrder(orderedIds, await this.repository.categoryIds(pairId), 100);
    const currentIds = await this.repository.categoryIds(pairId);
    if (sameOrder(currentIds, orderedIds)) return this.repository.snapshot(pairId, false);
    const mutation = await this.repository.reorderCategories(pairId, user, expectedRevision, orderedIds, this.now());
    await this.ensureApplied(user.id, pairId, mutation);
    return this.repository.snapshot(pairId, false);
  }

  async updateItem(user: UserRecord, itemId: string, patch: ItemPatch, expectedRevision: number): Promise<LibrarySnapshot> {
    this.requireId(itemId);
    const pairId = await this.requireCurrentRevision(user.id, expectedRevision);
    const current = await this.repository.itemById(pairId, itemId);
    if (!current) this.notFound("片库条目不存在。");
    const next: LibraryItemRecord = { ...current };
    if (patch.categoryProvided) {
      const categoryId = patch.categoryId ?? null;
      if (categoryId !== null) {
        this.requireId(categoryId);
        if (!await this.repository.categoryById(pairId, categoryId)) this.notFound("分类不存在。");
      }
      next.categoryId = categoryId;
    }
    if (patch.watchStatus !== undefined) next.watchStatus = patch.watchStatus;
    if (patch.refreshMetadata) {
      const identity = parseBilibiliUrl(current.canonicalUrl);
      if (identity) {
        const metadata = await this.metadata.metadataFor(identity);
        if (metadata.status === "ready") {
          next.cid = metadata.cid;
          if (isFallbackTitle(current)) next.title = metadata.title;
          next.coverUrl = metadata.coverUrl;
          next.ownerName = metadata.ownerName;
          next.durationSeconds = metadata.durationSeconds;
          next.metadataStatus = metadata.status;
        }
      }
    }
    if (patch.title !== undefined) next.title = normalizedItemTitle(patch.title);
    if (sameMutableItem(current, next)) return this.repository.snapshot(pairId, false);
    const mutation = await this.repository.updateItem(pairId, user, expectedRevision, next, this.now());
    await this.ensureApplied(user.id, pairId, mutation);
    return this.repository.snapshot(pairId, false);
  }

  async deleteItem(user: UserRecord, itemId: string, expectedRevision: number): Promise<LibrarySnapshot> {
    this.requireId(itemId);
    const pairId = await this.requireCurrentRevision(user.id, expectedRevision);
    if (!await this.repository.itemById(pairId, itemId)) this.notFound("片库条目不存在。");
    const mutation = await this.repository.deleteItem(pairId, user, expectedRevision, itemId, this.now());
    await this.ensureApplied(user.id, pairId, mutation);
    return this.repository.snapshot(pairId, false);
  }

  async reorderItems(user: UserRecord, orderedIds: string[], expectedRevision: number): Promise<LibrarySnapshot> {
    const pairId = await this.requireCurrentRevision(user.id, expectedRevision);
    const currentIds = await this.repository.itemIds(pairId);
    this.validateCompleteOrder(orderedIds, currentIds, MAX_LIBRARY_ITEMS);
    if (sameOrder(currentIds, orderedIds)) return this.repository.snapshot(pairId, false);
    const mutation = await this.repository.reorderItems(pairId, user, expectedRevision, orderedIds, this.now());
    await this.ensureApplied(user.id, pairId, mutation);
    return this.repository.snapshot(pairId, false);
  }

  private async requireActivePair(userId: string): Promise<string> {
    const pairId = await this.repository.activePairId(userId);
    if (!pairId) throw new AuthError("PAIR_REQUIRED", "请先绑定好友。", 409);
    return pairId;
  }

  private async requireCurrentRevision(userId: string, expectedRevision: number): Promise<string> {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new AuthError("INVALID_REQUEST", "expectedRevision 无效。", 400);
    }
    const pairId = await this.requireActivePair(userId);
    const currentRevision = (await this.repository.state(pairId))?.revision ?? 0;
    if (currentRevision !== expectedRevision) this.versionConflict(currentRevision);
    return pairId;
  }

  private async ensureApplied(userId: string, pairId: string, result: MutationResult): Promise<void> {
    if (result.applied) return;
    if (await this.repository.activePairId(userId) !== pairId) {
      throw new AuthError("PAIR_REQUIRED", "好友关系已经变化，请刷新。", 409);
    }
    this.versionConflict(result.currentRevision);
  }

  private validateCompleteOrder(orderedIds: string[], currentIds: string[], maxItems: number): void {
    if (orderedIds.length > maxItems || orderedIds.some((id) => !ID_RE.test(id)) || new Set(orderedIds).size !== orderedIds.length) {
      throw new AuthError("INVALID_REQUEST", "排序列表无效。", 400);
    }
    if (orderedIds.length !== currentIds.length || !sameSet(orderedIds, currentIds)) {
      throw new AuthError("INVALID_REQUEST", "排序列表必须包含全部条目。", 400);
    }
  }

  private requireId(value: string): void {
    if (!ID_RE.test(value)) throw new AuthError("INVALID_REQUEST", "资源 ID 无效。", 400);
  }

  private versionConflict(currentRevision: number): never {
    throw new AuthError("LIBRARY_VERSION_CONFLICT", "片库已被好友更新，请刷新后重试。", 409, undefined, currentRevision);
  }

  private categoryConflict(): never {
    throw new AuthError("CATEGORY_NAME_CONFLICT", "已经有同名分类。", 409);
  }

  private notFound(message: string): never {
    throw new AuthError("NOT_FOUND", message, 404);
  }
}

function normalizedCategoryName(value: string): { name: string; key: string } {
  const name = value.trim();
  if (!name || Array.from(name).length > 24) throw new AuthError("INVALID_REQUEST", "分类名称需为 1 到 24 个字符。", 400);
  return { name, key: name.toLowerCase() };
}

function normalizedItemTitle(value: string): string {
  const title = value.trim();
  if (!title || Array.from(title).length > 160) {
    throw new AuthError("INVALID_REQUEST", "视频名称需为 1 到 160 个字符。", 400);
  }
  return title;
}

function isFallbackTitle(item: LibraryItemRecord): boolean {
  return item.title === (item.page > 1 ? item.bvid + " · P" + item.page : item.bvid);
}

function mediaKey(bvid: string, page: number): string {
  return "bilibili:" + bvid + ":p" + page;
}

function canonicalUrl(bvid: string, page: number): string {
  return "https://www.bilibili.com/video/" + bvid + "/?p=" + page;
}

function sameOrder(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameSet(left: string[], right: string[]): boolean {
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function sameMutableItem(left: LibraryItemRecord, right: LibraryItemRecord): boolean {
  return left.cid === right.cid
    && left.canonicalUrl === right.canonicalUrl
    && left.title === right.title
    && left.coverUrl === right.coverUrl
    && left.ownerName === right.ownerName
    && left.durationSeconds === right.durationSeconds
    && left.metadataStatus === right.metadataStatus
    && left.categoryId === right.categoryId
    && left.watchStatus === right.watchStatus;
}
