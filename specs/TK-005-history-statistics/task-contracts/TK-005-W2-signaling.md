# Worker Task Contract: TK-005-W2 Signaling History Tracker

**Feature**: TK-005
**Baseline Commit**: `9473dcdba18341169ad3e7e0ac976f9140cf65b5`
**Branch**: `codex/TK-005-W2-signaling`
**Worktree**: `C:\Users\dengbingmei\Documents\tongkan-worktrees\TK-005-W2-signaling`
**Owner**: Signaling/Protocol execution task
**Depends On**: PD-001..PD-005 frozen + clean planning baseline + frozen grant/ingest fixtures

## Goal

扩展共享协议和 Signaling Durable Object，完成可选 history.bind、严格双人 overlap 状态机、服务端墙钟 intervals、持久化 pending ingest、签名 Account client、统一 alarm 和 fail-open 测试。

## Non-Goals

- Account migration、grant issuance、D1 repository 或 public history APIs。
- Android Java 实现、UI 或 QA Preview runner。
- 修改生产 `wrangler.toml`、配置 Service Binding、部署 Worker 或执行 migration。
- 匿名、Web、扩展、direct-video 或 screen-share 的账号历史统计。

## Write Scope

- `packages/protocol/src/types.ts`
- `packages/protocol/src/index.ts` 仅导出新类型时
- `packages/protocol/src/protocol.test.ts`
- `packages/protocol/src/android-contract.test.ts`
- `apps/signaling/src/history-tracker.ts`
- `apps/signaling/src/history-tracker.test.ts`
- `apps/signaling/src/history-ingest-client.ts`
- `apps/signaling/src/history-ingest-client.test.ts`
- `apps/signaling/src/env.ts`
- `apps/signaling/src/message-validation.ts`
- `apps/signaling/src/message-validation.test.ts`
- `apps/signaling/src/room-session.ts`
- `apps/signaling/src/room-session.test.ts`
- `apps/signaling/src/worker.ts`
- `apps/signaling/src/worker.test.ts`
- `apps/signaling/src/room-lifecycle.test.ts`
- `apps/signaling/src/android-contract.test.ts`
- `specs/TK-005-history-statistics/handoffs/TK-005-W2-signaling.md`

## Forbidden Scope

- 全局 Context/Decision/PRD/设计/路线图、生产配置和部署状态。
- `apps/signaling/wrangler.toml`、`apps/account/`、`apps/android/`、`qa/` 和其他 worker worktree。
- Secret 值、Account session token、邮箱、room key、invite URL、Cookie 或 APK。
- push、merge、rebase、force push、deployment 或 migration。

## Frozen Contracts

- New client message: `{ "type": "history.bind", "grant": "opaque" }`，仅 auth 后有效；成功返回 `{ "type": "history.bound", "expiresAt": number }`。
- Existing error event 增加 `INVALID_HISTORY_GRANT`、`HISTORY_GRANT_EXPIRED`、`HISTORY_BIND_CONFLICT`，错误不得关闭 socket。
- `playback.report` 增加 `ended: boolean` 与 nullable/positive `durationSeconds`；旧客户端缺失时不启用 TK-005 计时。
- grant 必须验证 version/signature/exp/source/pair/user/room/slot；完整 grant 不写日志或 storage。
- overlap 条件、5 秒 cadence 假设、12 秒 stale、Seek/rate 和全部结束边界与 spec 一致。
- interval 使用稳定 32hex intervalId/sessionId；checkpoint 区间建议 <=60 秒。
- pending snapshot/sourceRevision 与 `data-model.md`、OpenAPI 一致。
- Account dependency failure不得影响 socket auth、playback、chat、screen-share 或 room expiry。
- W2 只提供可注入 `ACCOUNT_HISTORY` Fetcher seam；真实 binding 由 reviewer 配置。

## Required Validation

```powershell
pnpm --filter @tongkan/protocol typecheck
pnpm --filter @tongkan/protocol test
pnpm --filter @tongkan/signaling typecheck
pnpm --filter @tongkan/signaling test
pnpm --filter @tongkan/signaling build
git diff --check -- packages/protocol apps/signaling specs/TK-005-history-statistics/handoffs/TK-005-W2-signaling.md
```

必须使用 fake clock 覆盖：

- strict overlap valid/invalid matrix。
- 12 秒 stale 精确边界、grant expiry 和 media/sequence transitions。
- Seek/rate、checkpoint、disconnect/reconnect、ended。
- DO reload 恢复 active interval 与 pending queue。
- retry/backoff、4xx terminal、5xx/network recoverable、alarm multiplex 和 bounded flush grace。
- history disabled/failed 时全部现有 room tests 继续通过。

## Done When

- [ ] Contract goal is implemented without changing non-history room behavior.
- [ ] Required validation passes deterministically without network access.
- [ ] No full grant, secret, session token, room key, invite URL or email is logged or persisted.
- [ ] Changes are committed on the assigned branch.
- [ ] Handoff includes commit hash, changed files, protocol compatibility, timing matrix, retry/alarm evidence, security and rollback notes.
