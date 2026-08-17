# Worker Task Contract: TK-003-W3 QA Shared Library

**Feature**: TK-003
**Baseline Commit**: BASELINE_PENDING_SPEC_COMMIT
**Branch**: `codex/TK-003-W3-qa`
**Worktree**: C:\Users\dengbingmei\Documents\tongkan-worktrees\TK-003-W3-qa
**Owner**: W3 QA worker
**Depends On**: Frozen OpenAPI/error codes only.

## Goal

Deliver a secure, deterministic contract and Preview acceptance package for shared-library API, concurrency, archive authorization and D1 cleanup.

## Non-Goals

- Application implementation, Android tests, production data changes or deployment.

## Write Scope

- `qa/shared-library/**`

## Forbidden Scope

- `CONTEXT.md`, `docs/decisions/DECISIONS.md`, `PROJECT_CONTEXT.md`, global PRDs, specs, production configuration and deployment state.
- Account, Android, signaling, Web, extension and other Worker branches/worktrees.
- Secrets, APKs, Firebase JSON, service-account JSON and build outputs.
- Worker-initiated push, merge, rebase, force push, migration or deployment.

## Frozen Contracts

- Token only from environment variables or secure stdin; never command-line arguments, files, logs or screenshots.
- Exact Preview hosts only; no arbitrary host allowlist broadening.
- Cases cover two bound accounts plus a third unauthorized account.
- Required cases: batch partial success, duplicate, metadata partial, categories, filters, status, reorder, 20 stale-revision races, late old-pair request, keep/pending/delete/third-party archive access and both-delete D1 cleanup.
- Verify B23/BV same-media dedupe, unresolved/unsafe B23 rejection, exact HTTP/error-code mapping, `currentRevision` on conflicts and no revision bump for duplicate/rejected-only batches.
- Script supports `-ValidateOnly` without secrets or network.

## Required Validation

- JSON files parse.
- PowerShell files pass parser/AST checks.
- `run-preview.ps1 -ValidateOnly` passes all declared cases.
- `git diff --check`.

## Done When

- [ ] T010, T019, T027, T033 and T036 are implemented.
- [ ] QA package contains no token, full invite link or personal data.
- [ ] Changes are committed with handoff, risks and exact live prerequisites.
