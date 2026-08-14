# Worker Task Contract: TK-001-W1 Account Worker

**Feature**: TK-001
**Baseline Commit**: reviewer records the workflow-setup HEAD in the GitHub Issue before worktree creation
**Branch**: `codex/TK-001-W1-account`
**Worktree**: `C:\Users\dengbingmei\Documents\tongkan-worktrees\TK-001-W1-account`
**Owner**: Account Worker execution task
**Depends On**: frozen OpenAPI and data model in this feature directory

## Goal

Implement atomic unilateral unbind, independent retention decisions and archive queries in the Account Worker.

## Non-Goals

- Android UI or client changes.
- Production/preview migration execution or Worker deployment.
- Shared library, calendar, history or statistics implementation.

## Write Scope

- `apps/account/migrations/0004_pair_archives.sql`
- `apps/account/src/models.ts`
- `apps/account/src/repository.ts`
- `apps/account/src/pair-service.ts`
- `apps/account/src/pair-service.test.ts`
- `apps/account/src/pair-repository.integration.test.ts`
- `apps/account/src/worker.ts`

## Forbidden Scope

- All Android, Web, signaling, protocol, global docs and deployment files.
- `CONTEXT.md`, `DECISIONS.md`, PRDs and existing migrations.
- Secrets, `.dev.vars`, production data changes and build outputs.

## Frozen Contracts

- Follow `contracts/account-unbind.openapi.yaml` exactly; additions require reviewer approval.
- Unbind MUST target the request `pairId`; never resolve and unbind a later current pair when an old request arrives.
- `GET /api/pair` must preserve the existing `pair` field for old clients.
- `pending -> keep/delete` only; no keep-to-delete endpoint in TK-001.
- Physical pair deletion occurs only after both member records are `delete`.
- Same-decision retry is idempotent while rows exist; a different decision is a conflict; after physical deletion requests return a non-disclosing 404 and clients refresh GET.
- Both users' unused pair invites are invalidated by the unbind transaction.

## Required Validation

- `pnpm --filter @tongkan/account typecheck`
- `pnpm --filter @tongkan/account test`
- `pnpm --filter @tongkan/account build`
- Local D1 integration test with at least 20 concurrent-unbind rounds and row-level deletion assertions.
- Delayed old-pair request after a new bind must leave the new pair active; future-child cascade is verified with a local temporary table only.
- `git diff --check`

## Done When

- [ ] Migration, repository, service, routes and tests are complete.
- [ ] Concurrent/repeated unbind and cross-user authorization are covered.
- [ ] Required validation passes.
- [ ] Changes are committed and a Draft PR/handoff is submitted.
