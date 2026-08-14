# Worker Task Contract: TK-001-W2 Android

**Feature**: TK-001
**Baseline Commit**: reviewer records the workflow-setup HEAD in the GitHub Issue before worktree creation
**Branch**: `codex/TK-001-W2-android`
**Worktree**: `C:\Users\dengbingmei\Documents\tongkan-worktrees\TK-001-W2-android`
**Owner**: Android execution task
**Depends On**: frozen OpenAPI examples; does not wait for W1 code

## Goal

Add discoverable unbind, pending retention choice and read-only archive-summary states to the native Java “我们” page.

## Non-Goals

- Account Worker or migration changes.
- Full archive library/calendar/history detail pages.
- Player, room protocol, FCM or visual-system redesign.

## Write Scope

- `apps/android/app/src/main/java/com/tongkan/mobile/MainActivity.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/account/AccountClient.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/account/AccountModels.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/ui/MainNavigationView.java`
- `apps/android/app/src/test/java/com/tongkan/mobile/account/AccountModelsTest.java`

## Forbidden Scope

- Account Worker, signaling, Web, protocol, Gradle dependencies, manifests and global docs.
- `CONTEXT.md`, `DECISIONS.md`, PRDs, release APKs and production configuration.

## Frozen Contracts

- Parse the exact OpenAPI response while remaining compatible with `{ "pair": ... }` old responses.
- Unbind requests use the `pairId` rendered in the current bound state; no request may omit or re-resolve the target pair.
- UI submits `keep/delete` only after explicit confirmation and prevents duplicate taps.
- Network uncertainty refreshes `GET /api/pair`; local UI never invents a successful unbind.
- Unbind does not log out, unregister push tokens or alter anonymous room state.

## Required Validation

- Android `testDebugUnitTest lintDebug assembleDebug` through the repository script.
- `git diff --check`

## Done When

- [ ] Bound, submitting, unbound, pending choice, kept archive and error states are reachable.
- [ ] Old/new JSON model tests pass.
- [ ] Android checks pass without new dependencies.
- [ ] Changes are committed and a Draft PR/handoff is submitted.
