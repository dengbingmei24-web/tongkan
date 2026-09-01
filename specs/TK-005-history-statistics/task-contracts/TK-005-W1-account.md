# Worker Task Contract: TK-005-W1 Account History

**Feature**: TK-005
**Baseline Commit**: `TBD_TK005_PLANNING_BASELINE`
**Branch**: `codex/TK-005-W1-account`
**Worktree**: `C:\Users\dengbingmei\Documents\tongkan-worktrees\TK-005-W1-account`
**Owner**: Account/D1 execution task
**Depends On**: PD-001..PD-005 frozen + clean planning baseline + frozen OpenAPI

## Goal

实现 migration 0008、history source/grant、签名 ingest、interval 幂等、session 聚合、历史/月度/日历 marker API、keep archive 只读与解绑撤销，并提供单元和真实本地 D1 integration 证据。

## Non-Goals

- Signaling overlap tracker、共享协议或 Durable Object alarm。
- Android UI、grant 生命周期或播放器报告。
- Preview/Production migration、Worker deployment、APK build、push 或发布。
- completion 规则、自动完成计划、单条历史编辑/删除、纠错或导出。

## Write Scope

- `apps/account/migrations/0008_watch_history.sql`
- `apps/account/src/history-models.ts`
- `apps/account/src/history-grant.ts`
- `apps/account/src/history-repository.ts`
- `apps/account/src/history-service.ts`
- `apps/account/src/history-*.test.ts`
- `apps/account/src/history-repository.integration.test.ts`
- `apps/account/src/worker.ts`
- `apps/account/src/env.ts`
- `apps/account/src/config.ts`
- `apps/account/src/crypto.ts` 仅新增独立 history HMAC helper 时
- `apps/account/src/repository.ts` 仅 source 创建/解绑撤销事务所需最小改动
- `apps/account/src/pair-service.ts` 及对应测试，仅解绑撤销 source 所需最小改动
- `apps/account/src/models.ts` 仅共享 Account 类型确有需要时
- `apps/account/.dev.vars.example` 仅增加 Secret 名称，不得包含值
- `specs/TK-005-history-statistics/handoffs/TK-005-W1-account.md`

## Forbidden Scope

- `CONTEXT.md`、`PROJECT_CONTEXT.md`、`docs/decisions/DECISIONS.md`、全局 PRD/设计/路线图、生产配置和部署状态。
- `apps/signaling/`、`packages/protocol/`、`apps/android/`、`qa/` 和其他 worker worktree。
- `apps/account/wrangler.toml` 的 Preview/Production binding 或 Secret 值。
- APK、Firebase/service-account JSON、session token、邮箱、room key、invite URL 或 Cookie。
- push、merge、rebase、force push、Preview/Production migration 或 deployment。

## Frozen Contracts

- Public/internal HTTP 合同：`contracts/openapi.yaml`。
- migration 文件名：`0008_watch_history.sql`。
- source 绑定 pair/room/host/guest，roomId 不得跨 pair 重用。
- grant payload/version/slot/iat/exp 与 `data-model.md` 一致，使用独立 Secret。
- ingest 需要 Service Binding 上下文、timestamp 与原始 body HMAC。
- intervalId immutable；相同内容重放成功，不同内容冲突；revision 不回退。
- UTC interval 是统计真源；跨日/月按调用方 offset 切分。
- completion 首切片遵守已冻结 PD-002；不得自行推导规则。
- 历史不复用 library/calendar revision。
- keep archive 只读；pending/delete/第三方拒绝；pair delete cascade。
- 元数据失败不得回滚 interval。

## Required Validation

```powershell
pnpm --filter @tongkan/account typecheck
pnpm --filter @tongkan/account test
pnpm --filter @tongkan/account build
git diff --check -- apps/account specs/TK-005-history-statistics/handoffs/TK-005-W1-account.md
```

真实本地 D1 integration 必须包含：

- 0001–0007 → 0008 migration 与空库 migration。
- grant host/guest/refresh/expiry/wrong slot/pair/room。
- HMAC timestamp/body tamper/replay boundary。
- 20 轮重复与乱序 ingest、interval conflict rollback。
- offset `-840/0/480/840` 的跨午夜和跨月。
- keep/pending/delete/third-party、unbind race 和 pair cascade。

## Done When

- [ ] Contract goal is implemented without expanding product scope.
- [ ] Required validation passes.
- [ ] No secret or sensitive identifier appears in source, fixture, logs, or handoff.
- [ ] Changes are committed on the assigned branch.
- [ ] Handoff includes commit hash, changed files, migration compatibility, tests, security, fail-open behavior and rollback notes.
