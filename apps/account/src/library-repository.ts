import type { UserRecord } from "./models";
import type {
  LibraryCategory,
  LibraryCategoryRecord,
  LibraryFilters,
  LibraryItem,
  LibraryItemInsert,
  LibraryItemRecord,
  LibrarySnapshot,
  LibraryStateRecord,
  LibraryWatchStatus,
  MutationResult,
} from "./library-models";

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function stateFromRow(row: Record<string, unknown>): LibraryStateRecord {
  return { pairId: String(row.pair_id), revision: Number(row.revision), createdAt: Number(row.created_at), updatedAt: Number(row.updated_at) };
}

function categoryFromRow(row: Record<string, unknown>): LibraryCategoryRecord {
  return {
    id: String(row.id), pairId: String(row.pair_id), name: String(row.name), nameKey: String(row.name_key),
    position: Number(row.position), createdByUserId: nullableString(row.created_by_user_id),
    updatedByUserId: nullableString(row.updated_by_user_id), createdAt: Number(row.created_at), updatedAt: Number(row.updated_at),
  };
}

function itemFromRow(row: Record<string, unknown>): LibraryItemRecord {
  return {
    id: String(row.id), pairId: String(row.pair_id), mediaKey: String(row.media_key), bvid: String(row.bvid),
    page: Number(row.page), cid: nullableNumber(row.cid), canonicalUrl: String(row.canonical_url), title: String(row.title),
    coverUrl: nullableString(row.cover_url), ownerName: nullableString(row.owner_name), durationSeconds: nullableNumber(row.duration_seconds),
    metadataStatus: String(row.metadata_status) as LibraryItemRecord["metadataStatus"], categoryId: nullableString(row.category_id),
    watchStatus: String(row.watch_status) as LibraryWatchStatus, position: Number(row.position),
    addedByUserId: nullableString(row.added_by_user_id), addedByNicknameSnapshot: String(row.added_by_nickname_snapshot),
    updatedByUserId: nullableString(row.updated_by_user_id), updatedByNicknameSnapshot: String(row.updated_by_nickname_snapshot),
    createdAt: Number(row.created_at), updatedAt: Number(row.updated_at),
  };
}

function publicCategory(category: LibraryCategoryRecord): LibraryCategory {
  return { id: category.id, name: category.name, position: category.position, createdAt: category.createdAt, updatedAt: category.updatedAt };
}

function publicItem(item: LibraryItemRecord): LibraryItem {
  return {
    id: item.id, bvid: item.bvid, page: item.page, cid: item.cid, canonicalUrl: item.canonicalUrl, title: item.title,
    coverUrl: item.coverUrl, ownerName: item.ownerName, durationSeconds: item.durationSeconds, metadataStatus: item.metadataStatus,
    categoryId: item.categoryId, watchStatus: item.watchStatus, position: item.position,
    addedBy: { id: item.addedByUserId ?? "deleted", nickname: item.addedByNicknameSnapshot },
    updatedBy: { id: item.updatedByUserId ?? "deleted", nickname: item.updatedByNicknameSnapshot },
    createdAt: item.createdAt, updatedAt: item.updatedAt,
  };
}

function escapedLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => "\\" + match);
}

export interface LibraryRepository {
  activePairId(userId: string): Promise<string | null>;
  pairExists(pairId: string): Promise<boolean>;
  archiveRetention(pairId: string, userId: string): Promise<string | null>;
  state(pairId: string): Promise<LibraryStateRecord | null>;
  snapshot(pairId: string, readOnly: boolean, filters?: LibraryFilters): Promise<LibrarySnapshot>;
  categoryById(pairId: string, categoryId: string): Promise<LibraryCategoryRecord | null>;
  categoryByNameKey(pairId: string, nameKey: string): Promise<LibraryCategoryRecord | null>;
  categoryIds(pairId: string): Promise<string[]>;
  nextCategoryPosition(pairId: string): Promise<number>;
  itemById(pairId: string, itemId: string): Promise<LibraryItemRecord | null>;
  itemsByMediaKeys(pairId: string, mediaKeys: string[]): Promise<LibraryItemRecord[]>;
  itemIds(pairId: string): Promise<string[]>;
  itemCount(pairId: string): Promise<number>;
  nextItemPosition(pairId: string): Promise<number>;
  insertItems(pairId: string, actor: UserRecord, expectedRevision: number, items: LibraryItemInsert[], now: number): Promise<MutationResult>;
  createCategory(pairId: string, actor: UserRecord, expectedRevision: number, category: LibraryCategoryRecord, now: number): Promise<MutationResult>;
  renameCategory(pairId: string, actor: UserRecord, expectedRevision: number, categoryId: string, name: string, nameKey: string, now: number): Promise<MutationResult>;
  deleteCategory(pairId: string, actor: UserRecord, expectedRevision: number, categoryId: string, now: number): Promise<MutationResult>;
  reorderCategories(pairId: string, actor: UserRecord, expectedRevision: number, orderedIds: string[], now: number): Promise<MutationResult>;
  updateItem(pairId: string, actor: UserRecord, expectedRevision: number, item: LibraryItemRecord, now: number): Promise<MutationResult>;
  deleteItem(pairId: string, actor: UserRecord, expectedRevision: number, itemId: string, now: number): Promise<MutationResult>;
  reorderItems(pairId: string, actor: UserRecord, expectedRevision: number, orderedIds: string[], now: number): Promise<MutationResult>;
}

export class D1LibraryRepository implements LibraryRepository {
  constructor(private readonly db: D1Database) {}

  async activePairId(userId: string): Promise<string | null> {
    const row = await this.db.prepare("SELECT pair_id FROM active_pair_members WHERE user_id = ? LIMIT 1").bind(userId).first<{ pair_id: string }>();
    return row ? String(row.pair_id) : null;
  }

  async pairExists(pairId: string): Promise<boolean> {
    const row = await this.db.prepare("SELECT 1 AS found FROM pairs WHERE id = ? LIMIT 1").bind(pairId).first<{ found: number }>();
    return row?.found === 1;
  }

  async archiveRetention(pairId: string, userId: string): Promise<string | null> {
    const row = await this.db.prepare("SELECT retention_status FROM pair_archive_members WHERE pair_id = ? AND user_id = ? LIMIT 1")
      .bind(pairId, userId).first<{ retention_status: string }>();
    return row ? String(row.retention_status) : null;
  }

  async state(pairId: string): Promise<LibraryStateRecord | null> {
    const row = await this.db.prepare("SELECT * FROM pair_library_state WHERE pair_id = ? LIMIT 1").bind(pairId).first<Record<string, unknown>>();
    return row ? stateFromRow(row) : null;
  }

  async snapshot(pairId: string, readOnly: boolean, filters: LibraryFilters = {}): Promise<LibrarySnapshot> {
    const state = await this.state(pairId);
    const categoriesResult = await this.db.prepare("SELECT * FROM library_categories WHERE pair_id = ? ORDER BY position, created_at, id")
      .bind(pairId).all<Record<string, unknown>>();
    const conditions = ["pair_id = ?"];
    const bindings: unknown[] = [pairId];
    if (filters.status && filters.status !== "all") { conditions.push("watch_status = ?"); bindings.push(filters.status); }
    if (filters.categoryId) { conditions.push("category_id = ?"); bindings.push(filters.categoryId); }
    const query = filters.query?.trim();
    if (query) {
      conditions.push("(title LIKE ? ESCAPE '\\' OR owner_name LIKE ? ESCAPE '\\' OR bvid LIKE ? ESCAPE '\\')");
      const pattern = "%" + escapedLike(query) + "%";
      bindings.push(pattern, pattern, pattern);
    }
    const itemsResult = await this.db.prepare("SELECT * FROM library_items WHERE " + conditions.join(" AND ") + " ORDER BY position, created_at, id")
      .bind(...bindings).all<Record<string, unknown>>();
    return {
      pairId, revision: state?.revision ?? 0, readOnly,
      categories: categoriesResult.results.map(categoryFromRow).map(publicCategory),
      items: itemsResult.results.map(itemFromRow).map(publicItem),
    };
  }

  async categoryById(pairId: string, categoryId: string): Promise<LibraryCategoryRecord | null> {
    const row = await this.db.prepare("SELECT * FROM library_categories WHERE pair_id = ? AND id = ? LIMIT 1")
      .bind(pairId, categoryId).first<Record<string, unknown>>();
    return row ? categoryFromRow(row) : null;
  }

  async categoryByNameKey(pairId: string, nameKey: string): Promise<LibraryCategoryRecord | null> {
    const row = await this.db.prepare("SELECT * FROM library_categories WHERE pair_id = ? AND name_key = ? LIMIT 1")
      .bind(pairId, nameKey).first<Record<string, unknown>>();
    return row ? categoryFromRow(row) : null;
  }

  async categoryIds(pairId: string): Promise<string[]> {
    const result = await this.db.prepare("SELECT id FROM library_categories WHERE pair_id = ? ORDER BY position, created_at, id")
      .bind(pairId).all<{ id: string }>();
    return result.results.map((row) => String(row.id));
  }

  async nextCategoryPosition(pairId: string): Promise<number> {
    const row = await this.db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS position FROM library_categories WHERE pair_id = ?")
      .bind(pairId).first<{ position: number }>();
    return Number(row?.position ?? 0);
  }

  async itemById(pairId: string, itemId: string): Promise<LibraryItemRecord | null> {
    const row = await this.db.prepare("SELECT * FROM library_items WHERE pair_id = ? AND id = ? LIMIT 1")
      .bind(pairId, itemId).first<Record<string, unknown>>();
    return row ? itemFromRow(row) : null;
  }

  async itemsByMediaKeys(pairId: string, mediaKeys: string[]): Promise<LibraryItemRecord[]> {
    if (mediaKeys.length === 0) return [];
    const placeholders = mediaKeys.map(() => "?").join(", ");
    const result = await this.db.prepare("SELECT * FROM library_items WHERE pair_id = ? AND media_key IN (" + placeholders + ")")
      .bind(pairId, ...mediaKeys).all<Record<string, unknown>>();
    return result.results.map(itemFromRow);
  }

  async itemIds(pairId: string): Promise<string[]> {
    const result = await this.db.prepare("SELECT id FROM library_items WHERE pair_id = ? ORDER BY position, created_at, id")
      .bind(pairId).all<{ id: string }>();
    return result.results.map((row) => String(row.id));
  }

  async itemCount(pairId: string): Promise<number> {
    const row = await this.db.prepare("SELECT COUNT(*) AS count FROM library_items WHERE pair_id = ?").bind(pairId).first<{ count: number }>();
    return Number(row?.count ?? 0);
  }

  async nextItemPosition(pairId: string): Promise<number> {
    const row = await this.db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS position FROM library_items WHERE pair_id = ?")
      .bind(pairId).first<{ position: number }>();
    return Number(row?.position ?? 0);
  }

  async insertItems(pairId: string, actor: UserRecord, expectedRevision: number, items: LibraryItemInsert[], now: number): Promise<MutationResult> {
    const statements = items.map((item) => this.db.prepare(
      `INSERT INTO library_items (
         id, pair_id, media_key, bvid, page, cid, canonical_url, title, cover_url, owner_name,
         duration_seconds, metadata_status, category_id, watch_status, position,
         added_by_user_id, added_by_nickname_snapshot, updated_by_user_id, updated_by_nickname_snapshot,
         created_at, updated_at
       )
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unwatched', ?, ?, ?, ?, ?, ?, ?
       WHERE EXISTS (
         SELECT 1 FROM pair_library_state state
         JOIN active_pair_members member ON member.pair_id = state.pair_id
         WHERE state.pair_id = ? AND state.revision = ? AND member.user_id = ?
       )`,
    ).bind(
      item.id, pairId, item.mediaKey, item.bvid, item.page, item.cid, item.canonicalUrl, item.title, item.coverUrl,
      item.ownerName, item.durationSeconds, item.metadataStatus, item.categoryId, item.position, actor.id, actor.nickname,
      actor.id, actor.nickname, now, now, pairId, expectedRevision, actor.id,
    ));
    return this.runMutation(pairId, actor.id, expectedRevision, statements, now);
  }

  async createCategory(pairId: string, actor: UserRecord, expectedRevision: number, category: LibraryCategoryRecord, now: number): Promise<MutationResult> {
    const statement = this.db.prepare(
      `INSERT INTO library_categories (id, pair_id, name, name_key, position, created_by_user_id, updated_by_user_id, created_at, updated_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE EXISTS (
         SELECT 1 FROM pair_library_state state
         JOIN active_pair_members member ON member.pair_id = state.pair_id
         WHERE state.pair_id = ? AND state.revision = ? AND member.user_id = ?
       )`,
    ).bind(category.id, pairId, category.name, category.nameKey, category.position, actor.id, actor.id, now, now, pairId, expectedRevision, actor.id);
    return this.runMutation(pairId, actor.id, expectedRevision, [statement], now);
  }

  async renameCategory(pairId: string, actor: UserRecord, expectedRevision: number, categoryId: string, name: string, nameKey: string, now: number): Promise<MutationResult> {
    const statement = this.db.prepare(
      `UPDATE library_categories SET name = ?, name_key = ?, updated_by_user_id = ?, updated_at = ?
       WHERE pair_id = ? AND id = ? AND EXISTS (
         SELECT 1 FROM pair_library_state state JOIN active_pair_members member ON member.pair_id = state.pair_id
         WHERE state.pair_id = ? AND state.revision = ? AND member.user_id = ?
       )`,
    ).bind(name, nameKey, actor.id, now, pairId, categoryId, pairId, expectedRevision, actor.id);
    return this.runMutation(pairId, actor.id, expectedRevision, [statement], now);
  }

  async deleteCategory(pairId: string, actor: UserRecord, expectedRevision: number, categoryId: string, now: number): Promise<MutationResult> {
    const statement = this.db.prepare(
      `DELETE FROM library_categories WHERE pair_id = ? AND id = ? AND EXISTS (
         SELECT 1 FROM pair_library_state state JOIN active_pair_members member ON member.pair_id = state.pair_id
         WHERE state.pair_id = ? AND state.revision = ? AND member.user_id = ?
       )`,
    ).bind(pairId, categoryId, pairId, expectedRevision, actor.id);
    return this.runMutation(pairId, actor.id, expectedRevision, [statement], now);
  }

  async reorderCategories(pairId: string, actor: UserRecord, expectedRevision: number, orderedIds: string[], now: number): Promise<MutationResult> {
    const statements = orderedIds.map((id, position) => this.db.prepare(
      `UPDATE library_categories SET position = ?, updated_by_user_id = ?, updated_at = ?
       WHERE pair_id = ? AND id = ? AND EXISTS (
         SELECT 1 FROM pair_library_state state JOIN active_pair_members member ON member.pair_id = state.pair_id
         WHERE state.pair_id = ? AND state.revision = ? AND member.user_id = ?
       )`,
    ).bind(position, actor.id, now, pairId, id, pairId, expectedRevision, actor.id));
    return this.runMutation(pairId, actor.id, expectedRevision, statements, now);
  }

  async updateItem(pairId: string, actor: UserRecord, expectedRevision: number, item: LibraryItemRecord, now: number): Promise<MutationResult> {
    const statement = this.db.prepare(
      `UPDATE library_items SET cid = ?, canonical_url = ?, title = ?, cover_url = ?, owner_name = ?, duration_seconds = ?,
         metadata_status = ?, category_id = ?, watch_status = ?, updated_by_user_id = ?, updated_by_nickname_snapshot = ?, updated_at = ?
       WHERE pair_id = ? AND id = ? AND EXISTS (
         SELECT 1 FROM pair_library_state state JOIN active_pair_members member ON member.pair_id = state.pair_id
         WHERE state.pair_id = ? AND state.revision = ? AND member.user_id = ?
       )`,
    ).bind(
      item.cid, item.canonicalUrl, item.title, item.coverUrl, item.ownerName, item.durationSeconds, item.metadataStatus,
      item.categoryId, item.watchStatus, actor.id, actor.nickname, now, pairId, item.id, pairId, expectedRevision, actor.id,
    );
    return this.runMutation(pairId, actor.id, expectedRevision, [statement], now);
  }

  async deleteItem(pairId: string, actor: UserRecord, expectedRevision: number, itemId: string, now: number): Promise<MutationResult> {
    const statement = this.db.prepare(
      `DELETE FROM library_items WHERE pair_id = ? AND id = ? AND EXISTS (
         SELECT 1 FROM pair_library_state state JOIN active_pair_members member ON member.pair_id = state.pair_id
         WHERE state.pair_id = ? AND state.revision = ? AND member.user_id = ?
       )`,
    ).bind(pairId, itemId, pairId, expectedRevision, actor.id);
    return this.runMutation(pairId, actor.id, expectedRevision, [statement], now);
  }

  async reorderItems(pairId: string, actor: UserRecord, expectedRevision: number, orderedIds: string[], now: number): Promise<MutationResult> {
    const statements = orderedIds.map((id, position) => this.db.prepare(
      `UPDATE library_items SET position = ?, updated_by_user_id = ?, updated_by_nickname_snapshot = ?, updated_at = ?
       WHERE pair_id = ? AND id = ? AND EXISTS (
         SELECT 1 FROM pair_library_state state JOIN active_pair_members member ON member.pair_id = state.pair_id
         WHERE state.pair_id = ? AND state.revision = ? AND member.user_id = ?
       )`,
    ).bind(position, actor.id, actor.nickname, now, pairId, id, pairId, expectedRevision, actor.id));
    return this.runMutation(pairId, actor.id, expectedRevision, statements, now);
  }

  private async runMutation(pairId: string, userId: string, expectedRevision: number, statements: D1PreparedStatement[], now: number): Promise<MutationResult> {
    const revisionStatement = this.db.prepare(
      `UPDATE pair_library_state SET revision = revision + 1, updated_at = ?
       WHERE pair_id = ? AND revision = ? AND EXISTS (
         SELECT 1 FROM active_pair_members WHERE pair_id = ? AND user_id = ?
       )`,
    ).bind(now, pairId, expectedRevision, pairId, userId);
    const results = await this.db.batch([...statements, revisionStatement]);
    const applied = results.at(-1)?.meta.changes === 1;
    const current = await this.state(pairId);
    return { applied, currentRevision: current?.revision ?? 0 };
  }
}
