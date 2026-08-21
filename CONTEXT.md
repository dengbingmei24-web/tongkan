# Tongkan - Current Development Context

> Current cross-conversation snapshot. Historical conversation logs are archived at `docs/archive/context/CONTEXT_HISTORY_2026-08.md`.

---
last_updated: 2026-08-21T11:36:02+08:00
current_version: 1.0.0-alpha10.2.4 released for physical verification
target_version: 1.0.0-alpha10.3 shared calendar; local integration and Preview acceptance complete, production/APK pending separate approval
status: Alpha 10.2.4 production remains the current delivery and its remaining two-device P0 checks are still deferred but required. TK-004 Preview D1 migration 0007, Preview Account Worker and the full disposable Calendar Live QA are complete and recorded in a local checkpoint. Production migration/deployment, Alpha 10.3 APK, push and additional merge remain unauthorized and unperformed.
---

## Current Baseline

- Review branch: `codex/TK-004-calendar`; its latest local checkpoint contains the approved W1 Account, W2 Android and W3 QA commits, T404/T405 closure, Calendar Preview migration/deployment evidence and the Live QA runner/contract fixes on top of baseline `a5324c5e5b15eb4798e0e3af159175477fd15647`. The branch has not been pushed. After the checkpoint, the pre-existing untracked `合作方-透明.png` remains untouched and outside the commit.
- Approved isolated tips: W1 Account `51f6791`, W2 Android `89c213a`, W3 QA `46ea3c3`; all are locally integrated in W1 → W2 → W3 order. Safety stashes `safety-before-tk004-t404-20260820`, `safety-before-tk004-cherry-pick-20260819-review-docs`, `safety-before-calendar-live-contract-fix-20260821-112108`, `safety-before-calendar-preview-docs-20260821-112820` and `safety-before-calendar-preview-qa-commit-20260821-113558` remain preserved and must not be dropped.
- Accepted P0 baseline: portrait composer stays above the keyboard, continuous deletion works, keyboard/App send share one path, one local bubble is created, input clears and no composer remains after transitions.
- Integrated P1 scope: unilateral unbind/archive Account code, Android bound/pending/archive UI, hardened QA contracts, FCM-ready invitation flow and the existing Beta playback/chat controls.
- Production Account Worker: version `519be06a-5d10-4f8e-ba69-a00e7216493e`, `AUTH_TEST_MODE=false`, production D1 migrations are current through `0006_active_pair_rooms.sql`.
- Current delivery APK: `release/tongkan-android-1.0.0-alpha10.2.4.apk` (production API + FCM, Debug-signed, no Preview token), SHA-256 `64D6530D50E127528CA0BD57E9F2F04C37E20EAB25E9F174BDB11C0581A09BA6`.
- Previous Alpha 10.2.1 APK remains local only as the pre-hotfix comparison build.
- Previous Preview APK remains local for isolated QA only: `release/tongkan-android-1.0.0-alpha10.2-preview.apk`.

## Recently Completed

- With explicit user approval, applied Preview D1 migration `0007_calendar_plans.sql` to `tongkan-account-preview`, verified `pair_calendar_state` and `calendar_plans`, deployed Preview Account Worker version `439139cb-ab48-4f72-a3f5-3012d6c37477`, and confirmed `/health` returns HTTP 200 with `testMode=true`.
- Completed the disposable Calendar Preview Live contract: all 16 cases passed, including 20/20 revision races, A/B consistency, mutation boundaries, keep/pending/delete/third-account archive rules and both-delete D1 cascade evidence (`pair=0 state=0 plans=0`). One-time fixtures were removed (`users=0 pairs=0`) and the Preview test access key was rotated after QA.
- Live execution exposed and fixed a PowerShell case-insensitive parameter/local-variable collision in `qa/calendar/run-preview.ps1` and corrected the QA-only response path from `media.url` to the frozen `media.canonicalUrl` contract. Runner AST, JSON checks, 16/16 ValidateOnly and `git diff --check` pass.
- Completed TK-004 T404 integrated validation: `pnpm typecheck`, 149 regular tests, localhost/seven-scenario integration, full build, dependency freshness, Account/Signaling Wrangler dry-runs, Calendar 16-case offline ValidateOnly, Android 55/55 with Lint 0 errors/25 warnings and Debug assemble, ten-file Android SHA parity, `git diff --check`, 110-file Markdown links and a 413-path credential scan all passed.
- Stabilized the Windows Account test command with `vitest run --no-file-parallelism` because parallel D1 test files intermittently collide on the Wrangler registry with `EBUSY`; real local D1 coverage and the 20-round concurrent revision race remain enabled.
- Completed TK-004 T405 documentation closure: synchronized the account PRD, Now/Next/Later roadmap, Alpha 10 selected design, release QA, unreleased changelog, tasks and Context, and accepted D-090 for the independent calendar revision/media snapshot/state/archive boundaries. Alpha 10.4 remains the owner of actual viewing-history markers.
- With explicit user approval, committed the TK-004 local integration/documentation baseline with message `chore: close TK-004 calendar integration`; no push, migration, deployment or APK publication occurred.
- With explicit user approval, stashed all tracked and untracked reviewer documents, cherry-picked the eight approved W1/W2/W3 commits without conflicts, restored the documents with `stash apply`, and retained the safety stash. No deployment, migration, APK publication, push or extra merge occurred.
- With explicit user approval, committed the complete Alpha 10.2.4/TK-003 workspace as clean TK-004 baseline `a5324c5e5b15eb4798e0e3af159175477fd15647` on `codex/TK-004-calendar`; the safety stash `safety-before-alpha10.3-calendar-20260819-143040` remains available.
- W1 Account/D1 is APPROVED at `51f6791`: additive migration 0007, independent calendar revision, month/date/today/archive reads, CRUD/status, media snapshots, pair initialization, 20-round D1 race, archive and cascade coverage. Review fixed empty-string `startTime` so only `HH:mm` or `null` is accepted; Calendar 5/5, Account 68/68, typecheck, protocol build and Wrangler dry-run pass.
- W2 Android is APPROVED at `89c213a`: native month calendar and date details, plan create/edit/complete/cancel, library scheduling, Home “今天想看”, existing room/invitation reuse, revision recovery and lifecycle cleanup. A clean ASCII build passed 55/55 JVM tests, Lint 0 errors/25 existing warnings and Debug assemble; no release APK was produced.
- W3 QA is APPROVED at `46ea3c3`: 16-case offline/Preview contract, protected-host allowlist, input/CRUD/sorting/today/race/archive/cascade coverage. AST, JSON and `-ValidateOnly` pass without secret access, HTTP client creation or network traffic.
- Added formal reviewer verdicts under `specs/TK-004-calendar/reviews/`; all three approved tips are locally integrated, while Preview Live and production actions remain separately gated.

- Completed the TK-004 Alpha 10.3 calendar specification package under `specs/TK-004-calendar/`: user stories, data model, OpenAPI, research, plan, tasks, requirements checklist, quickstart and disjoint W1 Account/W2 Android/W3 QA contracts.
- Created and restored `safety-before-alpha10.3-calendar-20260819-143040` with all tracked and untracked Alpha 10.2.4 changes preserved before calendar planning.
- User physically confirmed that Alpha 10.2.4 can successfully unbind a friend.
- Added `docs/product/ROADMAP.md` as the Now / Next / Later priority source: Now closes the real two-device daily-use loop, Next considers calendar plans and a home-page today list, and Later keeps history/statistics plus 1.0 hardening as non-committed directions. Unsupported functions and dates are explicitly marked TBD.
- With explicit user approval, exported a private production D1 backup outside Git, applied `0006_active_pair_rooms.sql`, deployed production Account Worker `519be06a-5d10-4f8e-ba69-a00e7216493e`, and verified 100% traffic plus Pages health/authorization boundaries.
- Built `release/tongkan-android-1.0.0-alpha10.2.4.apk` in `C:\tmp\android-build\project-alpha10.2.4-production`: versionCode 40/versionName verified, 46/46 JVM tests passed, Lint reported 0 errors/25 warnings, production API and FCM were present, Preview token was empty, and source/release hashes matched.
- Completed Alpha 10.2.4 implementation: explicit unbind keep/delete/cancel buttons, encrypted pair-only active-room publish/read/clear APIs, Android 10-second home discovery/direct guest join, host-leave cleanup and FCM-as-optional-reminder behavior.
- Added a real local D1 publish/read/upsert/clear integration test. Account 59/59, workspace 140 tests, typecheck, full build, Android unit/Lint/assemble and `git diff --check` all pass.
- Applied `0006_active_pair_rooms.sql` to Preview D1 and deployed Preview Worker version `5238a35c-09d7-478e-961f-5554e697af9b`. Through the protected `tongkan-account-preview-gateway.pages.dev` gateway, disposable A/B/C accounts passed creator-hidden, partner-visible, third-account rejection, one-row upsert, ciphertext-only storage, host delete, expiry cleanup and unbind cleanup; all temporary sessions/users were removed.
- Fixed the five production reports: logged-in users can enter anonymous mode without discarding the saved session and return from Home; logout/switch resets the full login form; unbind is a single keep/delete choice; library playback prioritizes the bound-friend push invitation with explicit copy/share fallback; library items support rename and JPEG cover thumbnails.
- Added Account item PATCH `title` validation (1-160 characters) using the existing column. Metadata refresh preserves non-placeholder custom titles while still updating cid, cover, owner and duration; no D1 migration was added.
- Passed Account 53/53, Android 44/44, workspace 134 tests, typecheck, full build, live signaling integration, diff check and Android Lint with 0 errors/23 warnings.
- Deployed Preview Worker `093b89a5-2bcd-42fe-b7a6-9e8c04c0bd8c` and production Worker `62bc7034-2599-4519-bf3b-dd119e68dd67`; production health is 200/testMode=false, unauthenticated library is 401, and remote D1 reports no migrations to apply.
- Built and verified `release/tongkan-android-1.0.0-alpha10.2.3.apk` in `C:\tmp\android-build\project-alpha10.2.3-production`; versionCode 39/versionName, production API + FCM, empty Preview token and matching hashes passed. SHA-256 is `C081BC427C8E1650374E48C711C937D2F620883EEA9F0E4E492A3A8BE89EE681`.
- With explicit user approval, deployed the Account Worker hotfix to production as version `1198e7ba-ff25-4aca-8369-105e2e1efa19`; deployment listing confirms 100% traffic. Production Pages health returned 200/`testMode=false`, and unauthenticated `/api/library` returned 401 `AUTH_REQUIRED`. Production D1, signaling and Pages configuration were unchanged.
- Reproduced `https://b23.tv/XM569Iw` in local Workers Runtime: before the fix it returned per-item `B23_RESOLUTION_FAILED` and logged Cloudflare `Illegal invocation`; after binding default fetch through `globalThis`, the same request added `BV1SBbS6hEHa` page 1 with ready metadata and revision 1.
- Hardened B23 resolution to stop at the first safe resolved redirect, accept a bounded safe Bilibili video URL from a 200 HTML response, and preserve trusted-host/HTTPS/redirect limits. Android now combines a multiline Bilibili share caption with its following URL and submits canonical URLs.
- Account 51/51, Android 42/42 with Lint 0 errors/23 warnings, workspace 132 tests, typecheck, full build and diff check passed. Preview Worker version `4d3a1955-bf92-49dc-965b-cdee4489debb` was uploaded; production Worker/D1 were not changed.
- Built production-configured candidate `release/tongkan-android-1.0.0-alpha10.2.2.apk` in `C:\tmp\android-build\project-alpha10.2.2-production`; package/versionCode 38/versionName, production API + FCM, empty Preview token and source/release hash match were verified. SHA-256 is `F48C5CC4C06A1A6BC1B17EC3D8AC90E6466E85B2644E953DD6B7C00036499FB2`.
- Completed Alpha 10.2.1 five-item P0/P1: bottom-sheet add flow, client-side per-row recognition, per-row server results with corrected B23 wording, category thumbnail sections, and portrait bottom/landscape side room-library drawers that preserve the video surface.
- Built `release/tongkan-android-1.0.0-alpha10.2.1.apk` in `C:\tmp\android-build\project-alpha10.2.1-production`: 41/41 Android tests, Lint 0 errors/23 warnings, production Account API and FCM configured, Preview token empty, package/versionCode 37/versionName verified, SHA-256 frozen as `9C3CBA2031D6B4C3E3457E84EF6E0519AEE4642D1F06748592AA90E85E360A5B`.
- Re-ran workspace typecheck and 129 tests; all passed. Decision D-087, PRD, Alpha 10 design, QA, changelog and TK-003 T044-T049 were synchronized; production backend and migrations were not changed.

- Completed T041: workspace typecheck, 129 tests including 11 local D1 integrations, live WebSocket integration, all builds, dependency freshness, 15-case QA validation, diff check, 95-file Markdown link validation and a 379-path credential scan passed.
- Exported a private pre-migration production D1 backup outside the repository, then applied `0004_pair_archives.sql` and `0005_shared_library.sql`; no remote migrations remain and all four archive/library tables were verified.
- Deployed production Account Worker version `1dc75739-52bf-4db1-828e-6b11e70906c0`; production health returned `testMode=false` and unauthenticated `/api/library` returned 401.
- Built `release/tongkan-android-1.0.0-alpha10.2.apk`: 39/39 Android tests, Lint 0 errors/19 warnings, production Account API and FCM configured, Preview token empty/not present, package/version verified and SHA-256 frozen as `E678D2943BD16D4470BF80ED9116EF82E6FC81856923C06B0F345157B58CA76D`.
- Completed T042/T043 documentation and delivery; Decision D-086 records production rollout with physical dual-device acceptance deferred.
- Froze TK-003 specs/OpenAPI and integrated W1 Account/D1, W3 QA and W2 Android from isolated worktrees.
- Account shared-library validation passed 48/48 tests, including 20 stale-revision D1 races, archive authorization and cascade cleanup; typecheck also passed.
- QA contract JSON, PowerShell AST and 15-case ValidateOnly passed without reading secrets or sending network requests.
- Completed T040 reviewer validation in `C:\tmp\android-build\project-alpha10.2-preview`: 39/39 JVM tests passed, Lint reported 0 errors and 19 warnings, `assembleDebug` succeeded, and `aapt` verified package `com.tongkan.mobile`, versionCode 36 and versionName `1.0.0-alpha10.2`.
- Applied `0005_shared_library.sql` to Preview D1 `tongkan-account-preview`; the migration ledger is clean and `pair_library_state`, `library_categories` and `library_items` were verified by a read-only query.
- Deployed TK-003 Account Preview Worker version `fbae269d-5909-40fd-bbfa-b79318e319b9`; production D1, Worker, Secrets and Pages bindings were not modified.
- Completed T039 with disposable A/B/C accounts: all 15 Live contract cases passed, all 20 revision races produced exactly one 200 and one 409, archive/rebind authorization passed, and direct D1 cascade counts were all zero. Temporary QA Worker/Pages routes, credentials and fixture rows were deleted afterward.
- Live QA exposed and fixed three PowerShell runner defects (single-item array expansion, case-insensitive variable shadowing and missing optional batch error access) and aligned the TK-003 contract with existing `AUTH_REQUIRED`/HTTP 415 account semantics.

- Reviewed W1 Account, W2 Android and W3 QA with three parallel agents; all initial findings were fixed and revalidated before integration.
- Account passed typecheck/build and 41/41 tests, including nine real local D1 integration tests and twenty concurrent-unbind rounds.
- Android passed unit tests, Lint and Debug APK build while preserving nickname, chat, top-level composer, unread red dot, brightness and volume behavior.
- QA passed JSON parsing, PowerShell AST and 13-case ValidateOnly; preview-host allowlisting, third-account authorization and dependency expansion are enforced.
- Applied migration `0004_pair_archives.sql` to `tongkan-account-preview` and deployed preview Worker version `4eaaf9e9-0152-46cc-bd6a-c49d58b22999`.
- Completed documentation governance: only four Markdown entry files remain at root, topic documents are indexed under `docs/`, D-085 records the long-term rule, and the full prior Context is preserved in `docs/archive/context/`.
- Regenerated the dependency inventory and passed dependency freshness, 83-file Markdown link validation, Web typecheck/build, residual-path scans and `git diff --check`.

## In Progress

- TK-004 implementation, review, local integration, T404 validation and T405 documentation closure are complete in the local TK-004 closure commit; the branch remains unpushed.
- The Calendar QA runner/contract fixes and Preview evidence documentation are preserved in the authorized local checkpoint; the branch remains unpushed.
- Production migration 0007, production Account Worker deployment and any Alpha 10.3 APK remain unexecuted and separately gated as T406/release work.

## Known Issues

1. The daily-use APK is Debug-signed; stable public distribution requires a long-term Release signing key and signed release build.
2. Real two-device shared-library behavior, FCM delivery and the complete Beta matrix remain physically unverified; automated tests cannot replace them.
3. The Preview gateway and an isolated, newly rotated Preview test key still exist for future QA; the production APK does not use or contain them. Remove or rotate them before abandoning Preview testing.
4. TK-004 W1/W2/W3, reviewer closure and the Calendar Preview QA checkpoint are committed locally; the branch has not been pushed.
5. Recent commits use automatic Git identity `unknown <dengbingmei@game.ntes>`; configure a GitHub noreply identity before future public commits if desired.
6. Basic friend unbinding is physically confirmed. The keep/delete retention matrix and App-home room discovery still require two-device production acceptance, currently deferred by the user.
7. Calendar migration 0007 and Worker routes are accepted on Preview only; production remains on migration 0006, and the Android calendar has not received physical-device validation.

## Next Steps

1. Keep the local Calendar Preview QA checkpoint as the branch baseline; push only after separate user authorization.
2. Only after a new explicit authorization, consider production migration 0007, production Account Worker deployment and an Alpha 10.3 APK build/release.
3. Resume the deferred Alpha 10.2.4 two-device physical matrix and add Alpha 10.3 calendar/device checks when the user has access to both devices.

## Primary References

- AI execution rules: `AGENTS.md`
- Stable project map: `PROJECT_CONTEXT.md`
- Documentation index: `docs/README.md`
- Long-term decisions: `docs/decisions/DECISIONS.md`
- Product PRDs: `docs/product/`
- Product roadmap: `docs/product/ROADMAP.md`
- Release QA: `docs/quality/QA_CHECKLIST.md`
- TK-001 specification: `specs/TK-001-unilateral-unbind/`
- TK-004 calendar specification: `specs/TK-004-calendar/`
- Multi-session workflow: `docs/development/MULTI_SESSION_WORKFLOW.md`

## Recent Conversation Log
- 2026-08-21: User explicitly approved committing the current Calendar Preview QA workspace while forbidding push, deployment and APK work. Recorded the runner variable-collision fix, frozen `media.canonicalUrl` contract correction, Preview deployment/Live evidence and synchronized Context/QA/product/operations/release/task status in one local checkpoint; excluded and preserved the unrelated untracked `合作方-透明.png`.
- 2026-08-21: User explicitly approved Preview migration 0007, Preview Account Worker deployment and Calendar Live QA, while forbidding production and APK actions. Applied migration 0007 to `tongkan-account-preview`, deployed Preview Worker `439139cb-ab48-4f72-a3f5-3012d6c37477`, and passed all 16 Live cases including 20/20 races, archive authorization and D1 cascade evidence. Fixed the PowerShell variable collision and QA-only `media.canonicalUrl` path, removed disposable fixtures, rotated the Preview key, and left production/APK untouched.
- 2026-08-20: User requested continued progress after the TK-004 local checkpoint. Ran the non-destructive Preview preflight: Calendar 16/16 ValidateOnly, Account typecheck and Wrangler dry-run passed. No remote request, migration, Worker deployment, APK build or push occurred; Preview migration/Worker remains separately gated.

- 2026-08-20: Continued the TK-004 reviewer closeout without overwriting existing changes. Preserved `safety-before-tk004-t404-20260820`; completed full integrated T404 validation, serialized Account test files to prevent Windows Wrangler registry `EBUSY`, synchronized PRD/roadmap/design/QA/changelog/tasks/Context plus D-090, and committed the local TK-004 closure checkpoint. Alpha 10.3 remains local and unreleased: no Preview/production migration 0007, Worker deployment, release APK, push or extra merge occurred.
- 2026-08-19: User explicitly authorized local integration of the three approved TK-004 branches. Created and preserved `safety-before-tk004-cherry-pick-20260819-review-docs`, cherry-picked eight W1/W2/W3 commits without conflicts, restored all reviewer documents, and advanced `codex/TK-004-calendar` to `1780acc`. Full workspace typecheck and 149 tests plus W3 offline ValidateOnly pass; current Account/Protocol, Android and QA trees match the approved tips. Preview/production migration, Worker deployment, APK publication, push and additional merge were not performed. Permission review blocked fresh integrated signaling/full dry-run and Android reruns, so the existing approved dry-run/Android gate evidence remains authoritative.
- 2026-08-19: User explicitly approved committing the current workspace as the TK-004 baseline. Created clean baseline `a5324c5e5b15eb4798e0e3af159175477fd15647`, completed and reviewed isolated W1 Account/D1, W2 Android and W3 QA branches, fixed W1 empty `startTime` handling and W2 cross-date/lifecycle issues, and recorded APPROVED verdicts. Account 68/68, Android 55/55 with Lint 0 errors/25 warnings and Debug build, plus W3 16-case ValidateOnly all pass. No isolated commits were integrated; no Preview/production migration, Worker deployment, release APK, push or merge occurred.

- 2026-08-19: User deferred the remaining Alpha 10.2.4 two-device P0 checks because testing is not convenient and authorized continuing other feature development. Selected the already-confirmed Next direction, TK-004 Alpha 10.3 shared calendar, and completed its spec/data/OpenAPI/plan/tasks/checklist plus disjoint Account/Android/QA contracts. A full tracked+untracked safety stash was created and restored. Per D-079, code implementation is blocked until the current deployed TK-003 workspace receives explicit commit authorization and becomes a clean baseline; no code, migration, deployment or APK changed.
- 2026-08-19: User asked how to redesign Tongkan's UI with external design software. Reviewed the current Alpha 10 Breath Tech Android/Web design baselines, existing HTML prototypes and screenshots, and prepared a project-specific Figma-first workflow covering required screens, component/state delivery, Android implementation constraints and alternative tools. No product scope, code, build, APK, deployment or accepted visual decision changed.
- 2026-08-19: Reviewed the current Context and Now roadmap for the user's daily task list. Today's priority remains Alpha 10.2.4 two-device physical acceptance: both unbind retention paths, App-home room discovery/direct join, room lifecycle fallbacks, login/mode switching and shared-library persistence. No code, build, deployment or roadmap scope changed.
- 2026-08-19: User confirmed that friend unbinding now succeeds and requested a product roadmap based only on confirmed goals, evidence and constraints. Added a Now / Next / Later roadmap without fixed delivery dates: Now prioritizes the physical daily-use loop, Next proposes calendar plans and a home-page today list, and Later keeps history/statistics plus 1.0 hardening as non-committed directions; unsupported features and dates are marked TBD.
- 2026-08-17: P0.13 physical chat matrix passed and was committed/pushed as the safe baseline.
- 2026-08-17: TK-001 three-agent review/revision/integration completed; preview migration and Worker deploy succeeded; production remained unchanged.
- 2026-08-17: P1.0 dual-device APK was frozen and opened for later physical testing.
- 2026-08-17: User postponed physical testing until after work and authorized the previously accepted documentation-governance migration.
- 2026-08-17: Completed the two-stage documentation migration, compacted current Context, archived full history, updated all known references and passed documentation/Web validation; frozen APK and production services were unchanged.
- 2026-08-17: Audited all current Context, PRD, TK-001 Spec Kit tasks, QA and security records. Confirmed the real remaining order is two-device P1.0 acceptance → TK-001 online/production acceptance → branch publication → Alpha 10.2 shared library → Alpha 10.3 calendar → Alpha 10.4 history/statistics → Beta/1.0 hardening; several unchecked TK-001 worker boxes are stale documentation because their code is already integrated. No code, APK, push or deployment changed.
- 2026-08-17: User chose Alpha 10.2 shared library as the next feature and requested multi-agent execution. Proposed TK-003 because TK-002 is already used: reviewer owns spec/contracts/integration; W1 owns Account Worker/D1; W2 owns Android client/UI; W3 owns QA/black-box acceptance. No worker was started yet because the baseline is not clean and old worktrees remain attached.

- 2026-08-17: TK-003 shared library specs were frozen, three isolated workers implemented Account/D1, Android and QA, and all commits were reviewed and integrated locally. Account 48/48 and QA 15-case ValidateOnly passed; Preview rollout and integrated APK remain next.

- 2026-08-18: User asked for the next development step. Priority remains TK-003 Preview migration/deployment and live QA first, followed by integrated Alpha 10.2 Android build and dual-device acceptance; production rollout stays separately gated.

- 2026-08-18: Applied TK-003 migration `0005_shared_library.sql` to Preview D1 and verified all three shared-library tables. Deployed Account Preview Worker version `fbae269d-5909-40fd-bbfa-b79318e319b9`; production remained unchanged. Next is W3 Live Preview QA.

- 2026-08-18: User asked what to do after the Preview backend deployment. The next gated task remains T039: run TK-003 Live Preview QA before building the integrated Alpha 10.2 Android APK.

- 2026-08-18: Completed T039 Preview Live QA using disposable A/B/C accounts and a temporary protected Pages/Worker route because `workers.dev` is unreachable locally. Official QA passed 15/15 cases and 20/20 races; keep/pending/delete/third-party, rebind isolation and D1 cascade counts passed. All temporary routes, credentials and fixture rows were removed; production remained unchanged. Next is T040 integrated Android build.

- 2026-08-18: Completed T040 Android reviewer build in the ASCII build directory. 39/39 JVM tests passed, Lint completed with 0 errors and 19 warnings, assembleDebug succeeded, and aapt verified com.tongkan.mobile versionCode 36 / 1.0.0-alpha10.2. Copied the Preview-only APK to release with SHA-256 1C7800B618A4A43D543A6161D6737ACAF15F375A2D872BE00FD5DDBB96B7B1A9; production remained unchanged.

- 2026-08-18: User asked how to physically test the Alpha 10.2 Preview APK. Prepared a two-device shared-library acceptance sequence covering login/binding, cross-device add/refresh, categories/status/search/order, optimistic conflict recovery, immediate watch, in-room media switching, restart persistence and optional archive read-only behavior; no code, deployment or production state changed.

- 2026-08-18: User has no available second tester and chose not to run the Alpha 10.2 dual-device checklist now. Agreed that the Preview APK can be used immediately and development can continue, but physical two-device synchronization/FCM/Beta acceptance remains deferred and must not be reported as passed; production rollout still requires separate approval.

- 2026-08-18: User authorized T041, documentation closure and conversion to a long-term daily-use version. T041 passed all workspace gates; a private production D1 backup was created outside Git, migrations 0004/0005 were applied, production Account Worker version 1dc75739-52bf-4db1-828e-6b11e70906c0 was deployed and verified, and the production-configured FCM-enabled APK was built without the Preview token. T042/T043 documentation and delivery completed; physical two-device acceptance remains deferred under D-086.

- 2026-08-18: User reported that a pasted B23 share did not appear and requested a Bilibili-inspired shared-library redesign plus easier room-time selection/switching. Inspection confirmed the input was extracted, but `https://b23.tv/kN7epIW` currently returns HTTP 200 JSON code -404 (`啥都木有`), while the backend only exposes generic `B23_RESOLUTION_FAILED`. Proposed Alpha 10.2.1: per-item parse/error states, a bottom-sheet add flow with preview rows, category-based thumbnail sections inspired by Bilibili favorites, and portrait/landscape in-room library drawers that keep video visible. No code or long-term decision changed pending user confirmation.

- 2026-08-18: User confirmed the five Alpha 10.2.1 P0/P1 items. Implemented the Android add-sheet preview/results, corrected B23 failure wording, category thumbnail sections and portrait/landscape room pickers; Decision D-087 and product/design/QA/spec docs were updated. Production-configured versionCode 37 APK passed 41/41 Android tests, Lint 0 errors/23 warnings, workspace typecheck and 129 tests; backend production state was unchanged.
- 2026-08-18: User reported that valid B23 additions still failed in the Alpha 10.2.1 APK. The screenshot link `https://b23.tv/XM569Iw` currently redirects to `BV1SBbS6hEHa`, disproving the earlier assumption that this failure was source unavailability. Local Workers Runtime reproduced Cloudflare `Illegal invocation` because the resolver invoked the stored global fetch with the wrong receiver. Fixed fetch binding, added bounded redirect/HTML fallbacks, normalized multiline Android share input, passed Account 51/51, Android 42/42, workspace 132 tests/typecheck/build, uploaded Preview Worker version `4d3a1955-bf92-49dc-965b-cdee4489debb`, and built verified versionCode 38 candidate APK. Production Worker remains unchanged pending explicit approval.
- 2026-08-18: User explicitly authorized production Account Worker deployment. Dry-run confirmed production D1 binding and `AUTH_TEST_MODE=false`; deployed hotfix version `1198e7ba-ff25-4aca-8369-105e2e1efa19`, verified it receives 100% traffic, then confirmed the Pages health endpoint returns 200/`testMode=false` and unauthenticated library access returns 401 `AUTH_REQUIRED`. No migration, signaling deployment or Pages configuration change occurred. Alpha 10.2.2 APK is ready for the exact physical B23 retest.

- 2026-08-19: User reported five daily-use failures and authorized production Account Worker deployment. Implemented saved-session anonymous mode and account switching, single-step unbind, bound-friend invite plus explicit fallback, library rename and JPEG thumbnails; all gates passed, Preview/Production Workers were deployed, and Alpha 10.2.3 APK was built for physical verification.
- 2026-08-19: Physical Alpha 10.2.3 evidence showed the unbind explanation dialog only displays Cancel because setMessage and setItems conflict on the device theme. Replaced it locally with explicit keep/delete/cancel buttons. User confirmed active bound-friend room discovery as the next P0: host publishes a short-lived pair-only room and partner joins from App without link sharing; implementation remains in progress. The custom Codex provider also rejected prompt_cache_retention during remote compaction, so C:\Users\dengbingmei\.codex\config.toml now disables remote_compaction_v2; restart is required.
- 2026-08-19: Completed Alpha 10.2.4 Preview gate. Added real D1 active-room integration coverage; Account 59/59 and workspace 140 tests plus typecheck/build/diff checks passed. Applied Preview migration 0006, deployed Worker `5238a35c-09d7-478e-961f-5554e697af9b`, corrected QA allowlists to the actual protected Preview gateway, and passed disposable A/B/C black-box checks for visibility, replacement, encryption, delete, expiry and unbind cleanup. Production migration/Worker/APK remain unchanged pending explicit migration approval.
- 2026-08-19: User explicitly approved production D1 migration 0006, Account Worker deployment and Alpha 10.2.4 APK build. Exported a private D1 backup outside Git, applied migration 0006, deployed Worker `519be06a-5d10-4f8e-ba69-a00e7216493e` at 100%, verified Pages health 200/testMode=false and unauthenticated library/active-room 401, then built production-configured versionCode 40 APK with 46/46 tests, Lint 0 errors/25 warnings and SHA-256 `64D6530D50E127528CA0BD57E9F2F04C37E20EAB25E9F174BDB11C0581A09BA6`.
