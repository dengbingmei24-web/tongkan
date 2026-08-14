# Worker Task Contract: [TASK ID] [TITLE]

**Feature**: [TK-XXX]
**Baseline Commit**: [HASH]
**Branch**: `codex/[TASK-ID]-[slug]`
**Worktree**: [ABSOLUTE PATH]
**Owner**: [WORKER TASK]
**Depends On**: [NONE OR CONTRACT/COMMIT]

## Goal

[One verifiable outcome.]

## Non-Goals

- [Explicit exclusion]

## Write Scope

- [Allowed path]

## Forbidden Scope

- `CONTEXT.md`, `DECISIONS.md`, `PROJECT_CONTEXT.md`, global PRDs, production configuration and deployment state. These paths can never be delegated to a worker.
- Other worker branches/worktrees.
- Secrets, APKs, Firebase JSON, service-account JSON and build outputs.
- Worker-initiated push, merge, rebase, force push, production migration or deployment.

## Frozen Contracts

- [API/data/UI contract that cannot be changed without reviewer approval]

## Required Validation

- [Command and expected result]

## Done When

- [ ] Contract goal is implemented.
- [ ] Required validation passes.
- [ ] Changes are committed on the assigned branch.
- [ ] Handoff or Draft PR includes risks and rollback notes.
