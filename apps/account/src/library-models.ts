export type LibraryMetadataStatus = "ready" | "partial";
export type LibraryWatchStatus = "unwatched" | "watched";
export type LibraryStatusFilter = "all" | LibraryWatchStatus;

export interface LibraryActor {
  id: string;
  nickname: string;
}

export interface LibraryStateRecord {
  pairId: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
}

export interface LibraryCategoryRecord {
  id: string;
  pairId: string;
  name: string;
  nameKey: string;
  position: number;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface LibraryItemRecord {
  id: string;
  pairId: string;
  mediaKey: string;
  bvid: string;
  page: number;
  cid: number | null;
  canonicalUrl: string;
  title: string;
  coverUrl: string | null;
  ownerName: string | null;
  durationSeconds: number | null;
  metadataStatus: LibraryMetadataStatus;
  categoryId: string | null;
  watchStatus: LibraryWatchStatus;
  position: number;
  addedByUserId: string | null;
  addedByNicknameSnapshot: string;
  updatedByUserId: string | null;
  updatedByNicknameSnapshot: string;
  createdAt: number;
  updatedAt: number;
}

export interface LibraryCategory {
  id: string;
  name: string;
  position: number;
  createdAt: number;
  updatedAt: number;
}

export interface LibraryItem {
  id: string;
  bvid: string;
  page: number;
  cid: number | null;
  canonicalUrl: string;
  title: string;
  coverUrl: string | null;
  ownerName: string | null;
  durationSeconds: number | null;
  metadataStatus: LibraryMetadataStatus;
  categoryId: string | null;
  watchStatus: LibraryWatchStatus;
  position: number;
  addedBy: LibraryActor;
  updatedBy: LibraryActor;
  createdAt: number;
  updatedAt: number;
}

export interface LibrarySnapshot {
  pairId: string;
  revision: number;
  readOnly: boolean;
  categories: LibraryCategory[];
  items: LibraryItem[];
}

export interface LibraryFilters {
  query?: string;
  status?: LibraryStatusFilter;
  categoryId?: string;
}

export type BatchItemErrorCode =
  | "INVALID_BILIBILI_URL"
  | "B23_RESOLUTION_FAILED"
  | "CATEGORY_NOT_FOUND"
  | "LIBRARY_LIMIT_REACHED";

export interface BatchItemResult {
  input: string;
  status: "added" | "duplicate" | "rejected";
  item?: LibraryItem | null;
  error?: BatchItemErrorCode | null;
}

export interface LibraryItemInsert {
  id: string;
  mediaKey: string;
  bvid: string;
  page: number;
  cid: number | null;
  canonicalUrl: string;
  title: string;
  coverUrl: string | null;
  ownerName: string | null;
  durationSeconds: number | null;
  metadataStatus: LibraryMetadataStatus;
  categoryId: string | null;
  position: number;
}

export interface LibraryMetadata {
  cid: number | null;
  title: string;
  coverUrl: string | null;
  ownerName: string | null;
  durationSeconds: number | null;
  status: LibraryMetadataStatus;
}

export interface MutationResult {
  applied: boolean;
  currentRevision: number;
}
