# Tongkan - Current Development Context

> Current cross-conversation snapshot. Historical conversation logs are archived at `docs/archive/context/CONTEXT_HISTORY_2026-08.md`.

---
last_updated: 2026-08-17T16:56:00+08:00
current_version: 1.0.0-alpha10.1-p1.0 (versionCode 35)
target_version: 1.0.0-alpha10.2 shared library Preview acceptance and Android test APK
status: TK-003 shared library is integrated on `codex/TK-003-shared-library`; Account/D1, Android and QA worker deliveries are reviewed and merged locally. Preview migration/deployment, live black-box acceptance and a reviewer-built APK remain pending.
---

## Current Baseline

- Branch: `codex/TK-003-shared-library`; TK-003 specs and W1/W2/W3 integration are committed locally and have not been pushed.
- Accepted P0 baseline: portrait composer stays above the keyboard, continuous deletion works, keyboard/App send share one path, one local bubble is created, input clears and no composer remains after transitions.
- Integrated P1 scope: unilateral unbind/archive Account code, Android bound/pending/archive UI, hardened QA contracts, FCM-ready invitation flow and the existing Beta playback/chat controls.
- Frozen APK: `release/tongkan-android-1.0.0-alpha10.1-p1.0-dual-device.apk`.
- APK SHA-256: `50C2AC0656592E5B402303558DAB19C26AEF55B47FF251EB5B001DD2F6932001`.

## Recently Completed

- Froze TK-003 specs/OpenAPI and integrated W1 Account/D1, W3 QA and W2 Android from isolated worktrees.
- Account shared-library validation passed 48/48 tests, including 20 stale-revision D1 races, archive authorization and cascade cleanup; typecheck also passed.
- QA contract JSON, PowerShell AST and 15-case ValidateOnly passed without reading secrets or sending network requests.
- W2 reported `pnpm android:check` passing with 39 JVM tests, Lint and Debug build in its isolated worktree; reviewer rerun is blocked only because the main workspace Gradle wrapper requires network access.

- Reviewed W1 Account, W2 Android and W3 QA with three parallel agents; all initial findings were fixed and revalidated before integration.
- Account passed typecheck/build and 41/41 tests, including nine real local D1 integration tests and twenty concurrent-unbind rounds.
- Android passed unit tests, Lint and Debug APK build while preserving nickname, chat, top-level composer, unread red dot, brightness and volume behavior.
- QA passed JSON parsing, PowerShell AST and 13-case ValidateOnly; preview-host allowlisting, third-account authorization and dependency expansion are enforced.
- Applied migration `0004_pair_archives.sql` to `tongkan-account-preview` and deployed preview Worker version `4eaaf9e9-0152-46cc-bd6a-c49d58b22999`.
- Completed documentation governance: only four Markdown entry files remain at root, topic documents are indexed under `docs/`, D-085 records the long-term rule, and the full prior Context is preserved in `docs/archive/context/`.
- Regenerated the dependency inventory and passed dependency freshness, 83-file Markdown link validation, Web typecheck/build, residual-path scans and `git diff --check`.

## In Progress

- TK-003 integration now awaits Preview `0005_shared_library.sql`, Preview Worker deployment, W3 Live black-box/D1 checks, reviewer Android rebuild and dual-device product acceptance.
- User will run the frozen P1.0 APK on two physical devices after work.
- Required FCM checks: background/lock-screen delivery, notification tap into the correct room and cold-start deep-link recovery.
- Required Beta checks: create/join, play/pause, seek, all six speeds, media switch, 15-second disconnect/reconnect, landscape unread red dot/input and at least 30 minutes continuous viewing.
- TK-001 online black-box API acceptance remains blocked until a stable preview Pages route exists or production rollout is explicitly approved.

## Known Issues

1. TK-003 has not been applied to Preview or production; the new Android page cannot complete live API acceptance until migration `0005_shared_library.sql` and the matching Account Worker are deployed to Preview.
2. Reviewer Android rerun attempted to download Gradle 8.9 and was blocked by sandbox network; the isolated W2 worktree already passed tests/Lint/assembleDebug, but no integrated Alpha 10.2 APK has been produced yet.

1. Production Account D1/Worker do not yet contain migration 0004 or the TK-001 endpoints; unbind/archive actions must not be judged against production yet.
2. `https://account-preview.tongkan-personal.pages.dev/account-api/health` returns 404 because no stable Pages preview route binds `ACCOUNT` to `tongkan-account-preview`.
3. Real FCM delivery and the complete Beta matrix require two physical devices; automated tests cannot replace them.
4. Android artifacts are Debug-signed; stable Release signing is not configured.
5. Recent commits use automatic Git identity `unknown <dengbingmei@game.ntes>`; configure a GitHub noreply identity before future public commits if desired.

## Next Steps

1. Review and apply migration 0005 to `tongkan-account-preview`, then deploy the TK-003 Preview Account Worker only.
2. Run `qa/shared-library/run-preview.ps1` Live with disposable A/B/C fixtures and verify 20/20 revision races plus direct D1 cascade counts.
3. Re-run integrated `pnpm android:check`, build the Alpha 10.2 test APK, open `release/`, and execute dual-device shared-library acceptance.
4. Do not apply production migration or deploy production Worker without separate explicit approval.

1. Complete the evening two-device FCM and Beta matrix using the frozen APK without changing server code during the test.
2. Record pass/fail results and attach only redacted screenshots or recordings; never share full invite links, session tokens or verification codes.
3. Choose the TK-001 rollout path: stable preview Pages binding or explicitly approved production migration/Worker deployment.
4. After online API verification, run unilateral unbind, keep/delete, rebind, restart recovery and both-delete D1 row checks.
5. Push the integration/documentation commits only when the user requests it.

## Primary References

- AI execution rules: `AGENTS.md`
- Stable project map: `PROJECT_CONTEXT.md`
- Documentation index: `docs/README.md`
- Long-term decisions: `docs/decisions/DECISIONS.md`
- Product PRDs: `docs/product/`
- Release QA: `docs/quality/QA_CHECKLIST.md`
- TK-001 specification: `specs/TK-001-unilateral-unbind/`
- Multi-session workflow: `docs/development/MULTI_SESSION_WORKFLOW.md`

## Recent Conversation Log

- 2026-08-17: P0.13 physical chat matrix passed and was committed/pushed as the safe baseline.
- 2026-08-17: TK-001 three-agent review/revision/integration completed; preview migration and Worker deploy succeeded; production remained unchanged.
- 2026-08-17: P1.0 dual-device APK was frozen and opened for later physical testing.
- 2026-08-17: User postponed physical testing until after work and authorized the previously accepted documentation-governance migration.
- 2026-08-17: Completed the two-stage documentation migration, compacted current Context, archived full history, updated all known references and passed documentation/Web validation; frozen APK and production services were unchanged.
- 2026-08-17: Audited all current Context, PRD, TK-001 Spec Kit tasks, QA and security records. Confirmed the real remaining order is two-device P1.0 acceptance → TK-001 online/production acceptance → branch publication → Alpha 10.2 shared library → Alpha 10.3 calendar → Alpha 10.4 history/statistics → Beta/1.0 hardening; several unchecked TK-001 worker boxes are stale documentation because their code is already integrated. No code, APK, push or deployment changed.
- 2026-08-17: User chose Alpha 10.2 shared library as the next feature and requested multi-agent execution. Proposed TK-003 because TK-002 is already used: reviewer owns spec/contracts/integration; W1 owns Account Worker/D1; W2 owns Android client/UI; W3 owns QA/black-box acceptance. No worker was started yet because the baseline is not clean and old worktrees remain attached.

- 2026-08-17: TK-003 shared library specs were frozen, three isolated workers implemented Account/D1, Android and QA, and all commits were reviewed and integrated locally. Account 48/48 and QA 15-case ValidateOnly passed; Preview rollout and integrated APK remain next.
