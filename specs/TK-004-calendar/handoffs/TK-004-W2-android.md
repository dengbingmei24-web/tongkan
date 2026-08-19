# Handoff: TK-004-W2 Android Calendar

**Status**: READY_FOR_REVIEW
**Implementation Commit**: `0472e8662b75b421d94e21341de1fc494ecc091d`
**Branch**: `codex/TK-004-W2-android`
**Baseline**: `a5324c5e5b15eb4798e0e3af159175477fd15647`
**Safety Stash**: `safety-before-w2-review-20260819-163455`

## Completed

- Added strict Calendar range/media/plan/snapshot parsing, real date/time validation, stable date/time/created/id ordering and planned-only date filtering.
- Added Calendar month/date/today/archive Account client reads plus create, edit, complete/restore and cancel requests with `expectedRevision`.
- Added a native Breath Tech month grid, selected-date details, plan editor, read-only archive view and loading/empty/error states.
- Added “安排日期” to the active shared library and “今天想看” to Home; all-day items display “当天”.
- Reused the existing room media switch, room creation, active pair-room publication and optional FCM invitation path when starting from a plan.
- Added stale-revision refresh, pair/archive-scope refresh, account/anonymous/unbind/pair-change cleanup and request-generation guards. Leaving Calendar during an in-flight request now prevents stale callbacks from reopening the tab.
- Preserved active-library state when Calendar temporarily loads items for the plan editor instead of leaving the UI pointed at an old archive.

## Changed Files

- `apps/android/app/src/main/java/com/tongkan/mobile/MainActivity.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/account/AccountClient.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/account/AccountModels.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/ui/CalendarScreen.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/ui/HomeScreen.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/ui/LibraryScreen.java`
- `apps/android/app/src/test/java/com/tongkan/mobile/account/AccountModelsTest.java`
- `apps/android/app/src/test/java/com/tongkan/mobile/account/AccountClientTest.java`
- `apps/android/app/src/test/java/com/tongkan/mobile/ui/CalendarScreenStateTest.java`
- `apps/android/app/src/test/java/com/tongkan/mobile/ui/HomeScreenStateTest.java`

## Validation

Clean ASCII build directory: `C:\tmp\android-build\project-tk004-w2-review-20260819-171000`. Source and build-copy SHA-256 hashes matched for all 10 changed Android files.

- `gradlew.bat testDebugUnitTest --no-daemon` — PASS, 55/55 tests.
- `gradlew.bat lintDebug --no-daemon` — PASS, 0 errors and 25 pre-existing warnings.
- `gradlew.bat assembleDebug --no-daemon` — PASS.
- `git diff --check -- apps/android` — PASS before commit.
- Focused secret-pattern scan on the Android diff — PASS.

JVM coverage includes Calendar JSON and malformed responses, leap/invalid dates, HH:mm validation, month and same-day sorting, today planned-only filtering, all-day labels, create/update/status bodies and `CALENDAR_VERSION_CONFLICT` parsing.

## UI and Lifecycle Risks

- No physical-device UI test was performed. Month-grid density, dialogs, Home card layout, theme switching and starting a real two-device room from a plan still require later device verification.
- Alpha 10.2.4 two-device P0 acceptance remains deferred and is not marked passed by this task.
- The temporary Debug APK is validation-only. No release APK was copied to `release/`, opened for installation or published.
- Account migration 0007 and Calendar Worker routes are not integrated into this branch; UI network flows require reviewer integration with W1.

## Security and Compatibility

- No dependency, permission, SDK, signing, production origin, test token or Firebase configuration changed.
- Blank optional time/note fields are serialized as explicit JSON `null`; invalid non-empty time is rejected locally.
- Archive snapshots remain read-only and hide edit, complete and cancel actions.
- Anonymous mode and logged-out state never request or expose Calendar data.

## Rollback

- Revert commit `0472e8662b75b421d94e21341de1fc494ecc091d`.
- No database, Worker, production environment or release artifact changed.

## Review Notes

- Automatic local Git identity remained `unknown <dengbingmei@game.ntes>`; no Git identity configuration changed.
- The worktree contains only this handoff after the implementation commit and is ready for reviewer inspection.
