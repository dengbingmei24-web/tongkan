# Worker Task Contract: TK-001-W3 QA

**Feature**: TK-001
**Baseline Commit**: reviewer records the workflow-setup HEAD in the GitHub Issue before worktree creation
**Branch**: `codex/TK-001-W3-qa`
**Worktree**: `C:\Users\dengbingmei\Documents\tongkan-worktrees\TK-001-W3-qa`
**Owner**: QA execution task
**Depends On**: feature spec and OpenAPI contract

## Goal

Create a repeatable, secret-safe preview-environment contract and two-account acceptance package for unbind.

## Non-Goals

- Product requirements, API implementation, Android UI or deployment.
- Storing test tokens, emails or room links in repository files.

## Write Scope

- `qa/account-unbind/contract-cases.json`
- `qa/account-unbind/run-preview.ps1`
- `qa/account-unbind/acceptance.md`

## Forbidden Scope

- All existing source, migrations, global docs, workflows and production configuration.
- Any credentials, real emails, Session Tokens or captured response bodies containing private data.

## Frozen Contracts

- Test cases map to `contracts/account-unbind.openapi.yaml` and spec acceptance scenarios.
- Script accepts API origin through arguments, but bearer tokens only through environment variables or secure stdin; it never accepts, writes or prints token values.
- Script defaults to preview and refuses production origin unless an explicit reviewer-only override is added later.

## Required Validation

- PowerShell parser/static execution with fake tokens and mocked/blocked network.
- JSON parse validation for `contract-cases.json`.
- `git diff --check`.

## Done When

- [ ] Success, mixed retention, both delete, repeat, concurrent and unauthorized cases are listed.
- [ ] Restart/rebind Android steps and evidence fields are documented.
- [ ] No sensitive value is written or echoed.
- [ ] Changes are committed and a Draft PR/handoff is submitted.
