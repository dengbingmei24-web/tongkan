# TK-005-W3 Android/QA Handoff

**Date**: 2026-09-01
**Status**: READY_FOR_REVIEW
**Baseline**: `9473dcdba18341169ad3e7e0ac976f9140cf65b5`
**Implementation Commit**: `9d7305791873fd0a3cf92f945fc46dd0ee561849`
**Review Fix Commit**: `edd0f3358abf8771a2a5c5a1d6c2c90a03d33431`
**Branch**: `codex/TK-005-W3-android-qa`

## Delivered

- Added Android Account models and client calls for history grants, active/archive history pagination, monthly summaries and calendar watch markers.
- Added account active-room grant lifecycle after room `auth.ok`, including refresh, expiry, transient retry, authentication failure handling and stale RoomClient callback rejection.
- Added optional `history.bind`, five-second playback reports and immediate reports for sequence, pause, readiness, buffering, media, ended and duration state changes.
- Added complete cleanup for logout, anonymous mode, account/pair/room replacement, leave-room, Activity destruction and RoomClient close/reconnect transitions.
- Added the “一起看过” section and monthly summary inside the existing “我们” tab, with loading, empty, error, retry, pagination, fallback cover and play-in-room actions.
- Added distinct calendar plan and actual-watch markers without changing calendar revision or plan state.
- Added keep-archive history/monthly/marker reads and read-only UI; pending/delete/third-party archives expose no Android history entry.
- Added safe-by-default `qa/watch-history` contract inventory and Preview-only ValidateOnly runner.

## Changed Files

- `apps/android/app/src/main/java/com/tongkan/mobile/MainActivity.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/RoomClient.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/RoomProtocol.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/account/AccountClient.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/account/AccountModels.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/ui/CalendarScreen.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/ui/HistorySectionView.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/ui/MainNavigationView.java`
- `apps/android/app/src/test/java/com/tongkan/mobile/MainActivityHistoryLifecycleTest.java`
- `apps/android/app/src/test/java/com/tongkan/mobile/RoomClientContractTest.java`
- `apps/android/app/src/test/java/com/tongkan/mobile/RoomClientHistoryLifecycleTest.java`
- `apps/android/app/src/test/java/com/tongkan/mobile/account/AccountClientTest.java`
- `apps/android/app/src/test/java/com/tongkan/mobile/account/AccountModelsTest.java`
- `apps/android/app/src/test/java/com/tongkan/mobile/ui/CalendarScreenStateTest.java`
- `apps/android/app/src/test/java/com/tongkan/mobile/ui/HistorySectionViewStateTest.java`
- `qa/watch-history/README.md`
- `qa/watch-history/contract-cases.json`
- `qa/watch-history/run-preview.ps1`

## UI State Inventory

- Current pair history: initial loading, populated history, empty-under-60-seconds, partial monthly/history error, retry and load-more states.
- Monthly summary: month, total shared duration, session count, distinct video count and latest watched date; completion count remains hidden/null.
- Archive history: explicit read-only heading, archive partner label, back-to-current-space action, pagination and playback into the current/new room without archive mutation.
- Calendar: planned-only `•`, watched-only `◆`, combined `• ◆`, selected-day detail and independent actual-watch duration/session panel.
- Calendar archive: explicit read-only title, no create/edit/status/delete controls and current-space return action.
- Existing four-tab navigation remains unchanged; no fifth tab, Kotlin, Compose or new dependency was added.

## Lifecycle Evidence

- Grants are requested only when account mode, current session, active pair, room `auth.ok`, host/guest slot and confirmed App active-room all match.
- Grant callbacks validate session, pair, room, slot, active-room, authentication and lifecycle generation; RoomClient identity prevents callbacks queued by a replaced room from mutating the new room.
- Refresh and expiry callbacks use a minimum one-second delay, are replaced on each grant update and are removed on every lifecycle cleanup path.
- Transient pair/grant failures retry after the frozen delay; authentication failures clear only the account state and preserve core anonymous room behavior.
- Playback reports run every 5 seconds while active and send immediately on authority state changes; clearing history drops `ended`/`durationSeconds` so Signaling closes history timing while legacy synchronization remains compatible.
- RoomClient reconnect cancels the report future, rebinds history after the next `auth.ok` and restarts reports only when authenticated and an active state exists.
- Leave-room, logout/account expiry, anonymous switch, pair replacement and Activity destruction clear the grant, pending callbacks and playback report state.

## Review Corrections

- Aligned Android history display ordering with the Account cursor contract: `startedAt DESC, id DESC`. This prevents cross-page reorder when a long earlier session ends after a later short session.
- Added current RoomClient identity guards for `history.bound` and history error callbacks queued across room replacement.
- Added retry after transient pair lookup failure and account-session handling for grant authentication failures.
- Added removal of an open history archive when the refreshed pair snapshot no longer grants archive access.

## QA Contract Inventory

- 14 cases cover A/B grants and refresh, third account C denial, anonymous exclusion, Android cadence/cleanup, strict overlap matrix, retry/idempotency, active pagination, monthly timezone offset, plan/actual marker independence, keep archive read-only, pending/delete/third-party denial, both-delete cascade and sensitive-output scanning.
- 13 required coverage tags are enforced by ValidateOnly before any live request can start.
- The runner rejects non-Preview base URLs, defaults to ValidateOnly and contains no session token, full email, room key, invite URL, grant, signature or production endpoint.

## Security

- Android treats grants as opaque values and never parses, displays or persists them.
- No watch total is calculated or uploaded by Android; only playback state reports are sent to the room.
- No session token, full email, room key, invite URL, grant, internal HMAC secret/signature, Firebase credential or production configuration was added to logs, QA output or Git.
- Archive UI is exposed only for `keep`; server responses must also match pair ID and `readOnly` state before display.

## Validation

- `pnpm android:test` — PASS after the review fixes.
- `pnpm android:lint` — PASS after the review fixes; no lint errors.
- PowerShell parser check for `qa/watch-history/run-preview.ps1` — PASS.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File qa/watch-history/run-preview.ps1 -ValidateOnly` — PASS, 14 cases / 13 coverage tags / Preview-only.
- JSON parse for `qa/watch-history/contract-cases.json` — PASS.
- `git diff --check -- apps/android qa/watch-history` — PASS.
- `pnpm android:build` — NOT RUN because the reviewer/user explicitly prohibited APK build or publication for TK-005.
- No Preview/production request, migration, deployment, production access or APK task was executed.

## Integration Notes

- Integrate W1 Account/D1 and W2 Signaling/Protocol before W3 so Android compiles against the final frozen HTTP and WebSocket contracts.
- The reviewer must provide the Account service binding and history secrets only in the integration branch/configuration; this branch intentionally contains no deployment configuration.
- Account pagination is authoritative as `startedAt DESC, id DESC`; Android now preserves that order across merged pages.
- Live Preview QA remains separately gated by explicit user approval and test account/room fixtures.

## Rollback

- Revert implementation commit `9d7305791873fd0a3cf92f945fc46dd0ee561849`, review fix commit `edd0f3358abf8771a2a5c5a1d6c2c90a03d33431` and the later handoff-only commit.
- No migration, remote state, deployment, APK, production configuration or public release was changed, so rollback is code-only.

## Blockers

- None for local W3 completion.
- Integrated validation depends on reviewer cherry-picking the approved W1 and W2 commits first.
