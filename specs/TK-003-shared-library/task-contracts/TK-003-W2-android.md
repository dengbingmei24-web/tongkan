# Worker Task Contract: TK-003-W2 Android Shared Library

**Feature**: TK-003
**Baseline Commit**: BASELINE_PENDING_SPEC_COMMIT
**Branch**: `codex/TK-003-W2-android`
**Worktree**: C:\Users\dengbingmei\Documents\tongkan-worktrees\TK-003-W2-android
**Owner**: W2 Android worker
**Depends On**: Frozen OpenAPI and JSON examples; does not depend on W1 source files.

## Goal

Deliver a production-quality Breath Tech shared library page and Android client integration while preserving the accepted player/chat baseline.

## Non-Goals

- Account Worker, D1, signaling protocol, calendar, history/statistics, Bilibili login/quality, new Android dependencies or release versioning.

## Write Scope

- `apps/android/**`

## Forbidden Scope

- `CONTEXT.md`, `docs/decisions/DECISIONS.md`, `PROJECT_CONTEXT.md`, global PRDs, design specs, feature specs, production configuration and deployment state.
- Account Worker, signaling, Web, extension, QA and other Worker branches/worktrees.
- Secrets, APK release artifacts, Firebase JSON, service-account JSON and build outputs.
- Worker-initiated push, merge, rebase, force push or deployment.

## Frozen Contracts

- Parse exact OpenAPI fields and fail closed on malformed snapshots.
- Handle the frozen error codes explicitly; refresh on `LIBRARY_VERSION_CONFLICT`, preserve input for retryable B23 rejection and never infer success from HTTP status alone.
- UI states: loading, empty, content, error, unauthenticated, unbound, conflict, archive read-only.
- Batch <=20; search/filter/category/status/reorder/delete must be discoverable and have immediate pressed/loading feedback.
- No new framework/dependency; use Java View, BreathComponents, OkHttp and current navigation.
- Playback reuses BilibiliMedia and current room flow; new media remains paused at 0 seconds and does not autoplay.
- Archive views are read-only and never expose mutation controls.

## Required Validation

- Relevant JVM tests for AccountModels/Library state/controller behavior.
- `pnpm android:check`
- `git diff --check`

## Done When

- [ ] T009, T015-T018, T024-T026, T030-T032 and T035 are implemented.
- [ ] Existing nickname/chat/composer/red-dot/brightness/volume/player behavior remains intact.
- [ ] Tests, Lint and assembleDebug pass.
- [ ] Changes are committed with handoff, risks and rollback notes.
