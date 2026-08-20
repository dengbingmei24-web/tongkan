# Worker Task Contract: TK-004-W1 Account Calendar

**Feature**: TK-004
**Baseline Commit**: `a5324c5e5b15eb4798e0e3af159175477fd15647`
**Branch**: `codex/TK-004-W1-account`
**Worktree**: `C:\Users\dengbingmei\Documents\tongkan-worktrees\TK-004-W1-account`
**Owner**: Account/D1 execution task
**Depends On**: T004 clean baseline + frozen `contracts/openapi.yaml`

## Goal

实现双人观看日历的 D1 migration、Account repository/service/API 和自动化测试，提供活动 pair 共同读写、独立 revision、今日/月/日查询和 keep 归档只读。

## Non-Goals

- Android UI 或客户端实现。
- 自动提醒、重复计划、外部日历和实际观看统计。
- 直接从陌生链接原子创建片库条目与计划。
- Preview/Production migration、Worker deployment 或 APK 构建。

## Write Scope

- `apps/account/migrations/0007_calendar_plans.sql`
- `apps/account/src/calendar-models.ts`
- `apps/account/src/calendar-repository.ts`
- `apps/account/src/calendar-service.ts`
- `apps/account/src/calendar-service.test.ts`
- `apps/account/src/calendar-repository.integration.test.ts`
- `apps/account/src/worker.ts`
- `apps/account/src/repository.ts`
- 如类型系统确有需要：`apps/account/src/models.ts`
- `specs/TK-004-calendar/handoffs/TK-004-W1-account.md`

## Forbidden Scope

- `CONTEXT.md`, `docs/decisions/DECISIONS.md`, `PROJECT_CONTEXT.md`, global PRDs, production configuration and deployment state.
- `apps/android/`, `qa/`, other specs and other worker branches/worktrees.
- Secrets, APKs, Firebase JSON, service-account JSON and build outputs.
- Worker-initiated push, merge, rebase, force push, Preview/production migration or deployment.

## Frozen Contracts

- OpenAPI in `specs/TK-004-calendar/contracts/openapi.yaml`.
- 日期 `YYYY-MM-DD` 必填；时间 `HH:mm` 与 trim 后 200 字备注可选。
- calendar revision 与 library revision 独立。
- create 必须引用当前 pair 的 library item，并保存媒体快照。
- `library_item_id` 删除后置空，计划保留。
- 排序为 startTime 升序 → 全天 → createdAt → id。
- keep archive 只读；pending/delete/第三方禁止；pair 删除级联。
- 错误码：`CALENDAR_VERSION_CONFLICT`、`PLAN_ALREADY_EXISTS`、`PLAN_NOT_FOUND`、`LIBRARY_ITEM_NOT_FOUND`。

## Required Validation

```powershell
pnpm --filter @tongkan/account typecheck
pnpm --filter @tongkan/account test
pnpm --filter @tongkan/account build
git diff --check -- apps/account specs/TK-004-calendar/handoffs/TK-004-W1-account.md
```

必须包含真实本地 D1 integration：0007 migration、A/B 一致、20 轮竞争、失败不增 revision、归档和级联。

## Done When

- [ ] Contract goal is implemented.
- [ ] Required validation passes.
- [ ] Changes are committed on the assigned branch.
- [ ] Handoff includes commit hash, changed files, tests, migration compatibility, security and rollback notes.
