# Worker Task Contract: TK-003-W1 Account Shared Library

**Feature**: TK-003
**Frozen Specification Baseline**: `23aaef6`
**Branch**: `codex/TK-003-W1-account`
**Worktree**: C:\Users\dengbingmei\Documents\tongkan-worktrees\TK-003-W1-account
**Owner**: W1 Account/D1 worker
**Depends On**: Frozen `spec.md`, `data-model.md`, `contracts/openapi.yaml`

## Goal

Deliver the complete Account Worker and local D1 implementation for active shared libraries and kept read-only archives.

## Non-Goals

- Android UI/client, signaling room protocol, calendar plans, history/statistics, production migration or deployment.

## Write Scope

- `apps/account/**`
- `pnpm-lock.yaml` only for the internal `@tongkan/protocol` workspace dependency

## Forbidden Scope

- `CONTEXT.md`, `docs/decisions/DECISIONS.md`, `PROJECT_CONTEXT.md`, global PRDs, design files, specs, production configuration and deployment state.
- Android, signaling, Web, extension, QA and other Worker branches/worktrees.
- Secrets, APKs, Firebase JSON, service-account JSON and build outputs.
- Worker-initiated push, merge, rebase, force push, remote migration or deployment.

## Frozen Contracts

- Active pair is server-derived; active mutation endpoints never accept arbitrary pairId.
- Pair-level expectedRevision CAS; conflicts return `LIBRARY_VERSION_CONFLICT` with currentRevision and apply zero writes.
- Batch size <=20 with added/duplicate/rejected per input; BVID+page unique per pair.
- Metadata failure is partial, not fatal after identity validation.
- Parse direct BV/av/page and resolve B23 into the final trusted Bilibili BV/av identity; never persist unresolved `b23:*`.
- One mutation request increments revision exactly once only when state changes; batch added rows and that increment are atomic, while duplicate/rejected-only requests keep the revision.
- Use the frozen HTTP and per-item error codes from `spec.md`; `LIBRARY_VERSION_CONFLICT` includes `currentRevision`.
- keep archive is read-only; pending/delete/third-party cannot read; pair delete cascades all library rows.
- No calendar, private library, Bilibili login or autoplay.

## Required Validation

- `pnpm --filter @tongkan/protocol build`
- `pnpm --filter @tongkan/account typecheck`
- `pnpm --filter @tongkan/account test`
- `pnpm --filter @tongkan/account build`
- Apply migration to local D1 and run repository integration/concurrency tests.
- `git diff --check`

## Done When

- [ ] T005-T008, T011-T014, T020-T023, T028-T029 and T034 are implemented.
- [ ] Validation passes and no remote migration/deploy occurred.
- [ ] Changes are committed on the assigned branch.
- [ ] Handoff lists commit, files, tests, risks, rollback and unresolved metadata assumptions.
