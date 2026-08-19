export type CalendarPlanStatus = "planned" | "completed";
export interface CalendarActor { id: string; nickname: string; }
export interface CalendarStateRecord { pairId: string; revision: number; createdAt: number; updatedAt: number; }
export interface CalendarLibraryItemRecord { id: string; pairId: string; bvid: string; page: number; canonicalUrl: string; title: string; coverUrl: string | null; }
export interface CalendarPlanRecord {
  id: string; pairId: string; libraryItemId: string | null; date: string; startTime: string | null; note: string | null;
  status: CalendarPlanStatus; bvid: string; page: number; canonicalUrl: string; titleSnapshot: string; coverUrlSnapshot: string | null;
  createdByUserId: string | null; createdByNicknameSnapshot: string; updatedByUserId: string | null; updatedByNicknameSnapshot: string;
  createdAt: number; updatedAt: number; completedAt: number | null;
}
export interface CalendarMedia { bvid: string; page: number; canonicalUrl: string; title: string; coverUrl: string | null; }
export interface CalendarPlan {
  id: string; libraryItemId: string | null; date: string; startTime: string | null; note: string | null; status: CalendarPlanStatus;
  media: CalendarMedia; createdBy: CalendarActor; updatedBy: CalendarActor; createdAt: number; updatedAt: number; completedAt: number | null;
}
export interface CalendarRange { from: string; to: string; }
export interface CalendarSnapshot { pairId: string; revision: number; readOnly: boolean; range: CalendarRange; plans: CalendarPlan[]; }
export interface CalendarPlanInsert {
  id: string; libraryItemId: string; date: string; startTime: string | null; note: string | null; bvid: string; page: number;
  canonicalUrl: string; titleSnapshot: string; coverUrlSnapshot: string | null;
}
export interface CalendarMutationResult { applied: boolean; currentRevision: number; }
export interface CalendarPlanPatchInput { date?: string; startTime?: string | null; note?: string | null; status?: CalendarPlanStatus; }
