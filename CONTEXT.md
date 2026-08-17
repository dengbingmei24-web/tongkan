# Tongkan - Current Development Context

> Current cross-conversation snapshot. Historical conversation logs are archived at `docs/archive/context/CONTEXT_HISTORY_2026-08.md`.

---
last_updated: 2026-08-17T15:32:27+08:00
current_version: 1.0.0-alpha10.1-p1.0 (versionCode 35)
target_version: Complete TK-001 online API acceptance and real two-device FCM + Beta regression
status: Documentation governance is complete on `codex/TK-002-player-chat`; TK-001 Account → Android → QA remains integrated and the frozen dual-device APK is unchanged. Production TK-001 rollout and real two-device acceptance remain pending.
---

## Current Baseline

- Branch: `codex/TK-002-player-chat`; local branch is ahead of its remote and has not been pushed after TK-001 integration.
- Accepted P0 baseline: portrait composer stays above the keyboard, continuous deletion works, keyboard/App send share one path, one local bubble is created, input clears and no composer remains after transitions.
- Integrated P1 scope: unilateral unbind/archive Account code, Android bound/pending/archive UI, hardened QA contracts, FCM-ready invitation flow and the existing Beta playback/chat controls.
- Frozen APK: `release/tongkan-android-1.0.0-alpha10.1-p1.0-dual-device.apk`.
- APK SHA-256: `50C2AC0656592E5B402303558DAB19C26AEF55B47FF251EB5B001DD2F6932001`.

## Recently Completed

- Reviewed W1 Account, W2 Android and W3 QA with three parallel agents; all initial findings were fixed and revalidated before integration.
- Account passed typecheck/build and 41/41 tests, including nine real local D1 integration tests and twenty concurrent-unbind rounds.
- Android passed unit tests, Lint and Debug APK build while preserving nickname, chat, top-level composer, unread red dot, brightness and volume behavior.
- QA passed JSON parsing, PowerShell AST and 13-case ValidateOnly; preview-host allowlisting, third-account authorization and dependency expansion are enforced.
- Applied migration `0004_pair_archives.sql` to `tongkan-account-preview` and deployed preview Worker version `4eaaf9e9-0152-46cc-bd6a-c49d58b22999`.
- Completed documentation governance: only four Markdown entry files remain at root, topic documents are indexed under `docs/`, D-085 records the long-term rule, and the full prior Context is preserved in `docs/archive/context/`.
- Regenerated the dependency inventory and passed dependency freshness, 83-file Markdown link validation, Web typecheck/build, residual-path scans and `git diff --check`.

## In Progress

- User will run the frozen P1.0 APK on two physical devices after work.
- Required FCM checks: background/lock-screen delivery, notification tap into the correct room and cold-start deep-link recovery.
- Required Beta checks: create/join, play/pause, seek, all six speeds, media switch, 15-second disconnect/reconnect, landscape unread red dot/input and at least 30 minutes continuous viewing.
- TK-001 online black-box API acceptance remains blocked until a stable preview Pages route exists or production rollout is explicitly approved.

## Known Issues

1. Production Account D1/Worker do not yet contain migration 0004 or the TK-001 endpoints; unbind/archive actions must not be judged against production yet.
2. `https://account-preview.tongkan-personal.pages.dev/account-api/health` returns 404 because no stable Pages preview route binds `ACCOUNT` to `tongkan-account-preview`.
3. Real FCM delivery and the complete Beta matrix require two physical devices; automated tests cannot replace them.
4. Android artifacts are Debug-signed; stable Release signing is not configured.
5. Recent commits use automatic Git identity `unknown <dengbingmei@game.ntes>`; configure a GitHub noreply identity before future public commits if desired.

## Next Steps

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
