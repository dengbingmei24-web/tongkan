# Tongkan - Development Context Snapshot

> Purpose: Cross-conversation state transfer. Read at start, update at end.
> Format: `last_updated` required, others as needed.

---
last_updated: 2026-08-17T14:22:02+08:00
current_version: 1.0.0-alpha10.1-p1.0 (versionCode 35) TK-001 integrated dual-device validation build; production Account migration/deployment pending
target_version: Complete TK-001 online API acceptance and real two-device FCM + Beta regression
status: The reviewer/controller completed the three-agent TK-001 review/revision loop and integrated Account → Android → QA on `codex/TK-002-player-chat`. Initial W1/W2/W3 verdicts were CHANGES_REQUESTED; fixes `ef92e01`, `641f3ed`, and `8776c33` were independently revalidated before integration. Account 41/41 tests, real local D1 concurrency tests, Android test/Lint/assemble, QA 13-case ValidateOnly, full typecheck/test/integration/build and diff checks passed. Preview D1 migration `0004_pair_archives.sql` and preview Worker version `4eaaf9e9-0152-46cc-bd6a-c49d58b22999` are deployed, but the documented public preview Pages route returns 404, so online black-box cases remain blocked. Production Account D1/Worker were not changed. Frozen APK: `release/tongkan-android-1.0.0-alpha10.1-p1.0-dual-device.apk`, SHA-256 `50C2AC0656592E5B402303558DAB19C26AEF55B47FF251EB5B001DD2F6932001`. Real FCM and Beta two-device acceptance remain pending.
---

## Mandatory Conversation Lifecycle

- Start: read `AGENTS.md`, then `CONTEXT.md`, then `PROJECT_CONTEXT.md`; consult relevant entries in `DECISIONS.md` before product, architecture, protocol, UI, or release changes.
- Locate task-specific documents through the mapping in `PROJECT_CONTEXT.md` instead of guessing from filenames.
- End: update `CONTEXT.md` even when no code changed, including `last_updated`, current status, active work, completed work, known issues, next steps, and the conversation log as applicable.
- Record any newly confirmed long-term product, design, protocol, architecture, storage, or release choice in `DECISIONS.md`.
- Update `PROJECT_CONTEXT.md` only when stable project structure, product boundaries, architecture, or document ownership changes.
- Never leave a conversation without synchronizing the latest development state into this system.

## Completed

- [x] Ran the TK-001 reviewer/controller workflow with three parallel agents. W1 Account, W2 Android and W3 QA were initially rejected with actionable findings, corrected in their isolated worktrees, revalidated and integrated in dependency order. Full branch comparison confirmed the execution commits did not modify forbidden global context/PRD/configuration files.

- [x] Integrated TK-001 Account unilateral unbind and per-user archive decisions, including target-pair CAS, old-invite invalidation, same-user concurrent idempotency, independent keep/delete choices, non-disclosing 404 behavior and both-delete physical cleanup. Account typecheck/build and 41/41 tests passed, including nine real local D1 integration tests and twenty concurrent-unbind rounds.

- [x] Integrated TK-001 Android bound/pending/archive states while preserving the accepted TK-002 nickname, room chat, top-level composer, unread red dot, brightness and volume behavior. Android unit tests, Lint and assembleDebug passed after manual conflict resolution; successful unbind immediately clears stale binding UI and entering the “我们” tab refreshes authoritative state.

- [x] Integrated and hardened the TK-001 QA package with 13 contract cases, exact preview-host allowlisting, valid-third-account authorization checks, dependency expansion and least-required secure input. JSON parsing, PowerShell AST and ValidateOnly passed.

- [x] Applied `0004_pair_archives.sql` to the isolated `tongkan-account-preview` D1 and deployed preview Worker version `4eaaf9e9-0152-46cc-bd6a-c49d58b22999`. Read-only D1 inspection confirmed both `pairs` and `pair_archive_members` tables. Production Account D1/Worker remain unchanged.

- [x] Froze Android `1.0.0-alpha10.1-p1.0` / versionCode 35 and built `release/tongkan-android-1.0.0-alpha10.1-p1.0-dual-device.apk` (3,905,324 bytes), SHA-256 `50C2AC0656592E5B402303558DAB19C26AEF55B47FF251EB5B001DD2F6932001`.

- [x] Committed the accepted TK-002 Alpha 10.1 room-interaction baseline as `ce442c9` and pushed the new remote branch `origin/codex/TK-002-player-chat`.

- [x] User physically accepted the complete P0.13 chat matrix: typing, continuous deletion, keyboard/App send, exactly one local bubble, input clearing and no top-level composer residue across keyboard, landscape, fullscreen and room-exit transitions.

- [x] Rotated the exposed QQ SMTP authorization code through an interactive local Wrangler prompt without printing or storing it; production Secret listing contains `SMTP_AUTHORIZATION_CODE`, a real production send-code request returned HTTP 202, and Account Worker typecheck, 17/17 tests and dry-run build passed.

- [x] User physically accepted the P0.13 core keyboard fix: portrait text is visible while typing and continuous deletion works normally. Send-entrypoint and transition-residue checks remain open.

- [x] Implemented Alpha 10.1 P0.13 portrait top-level composer: the message list remains in the lower chat card while the composer is detached into an Activity-root overlay, positioned directly above the visible keyboard without moving the weighted chat card. IME send, physical Enter and App send share one submit path; successful sends immediately add the local bubble and clear the native EditText. Added positioning/send-trigger tests, bumped versionCode 34 / `1.0.0-alpha10.1-p0.13`, passed 32/32 tests, Lint 0 errors/19 warnings and account-configured assembleDebug. Built `release/tongkan-android-1.0.0-alpha10.1-p0.13-pair.apk` (3,888,936 bytes), SHA-256 `429B43859D8633C07C9A7A443B2E80F0227545117C6E50B915E8B8F0CE10EC6A`.

- [x] Reviewed the 18.04-second P0.12 physical chat recording frame by frame. Confirmed the portrait composer is still covered by the OEM keyboard; text becomes visible only after dismissing the IME, deletion likely occurs but has no visible feedback, the keyboard and App expose ambiguous duplicate “发送” actions, and no sent bubble appears in the recording. Submission failure remains unconfirmed because the recording does not clearly show a send action.

- [x] Implemented Alpha 10.1 P0.12 portrait chat input root-cause fix: system-bar and IME Insets are separated at `MainActivity`; keyboard avoidance is computed from real window/composer screen coordinates with visible-frame fallback; `RoomChatView` no longer performs duplicate internal translation; focus explicitly restores cursor/selection and opens the IME; the custom code-point InputFilter was replaced by native `LengthFilter(120)` so composing text and deletion remain standard Android behavior. VersionCode 33 / `1.0.0-alpha10.1-p0.12`; 28/28 Android tests, Lint and account-configured assembleDebug passed. Built and opened `release/tongkan-android-1.0.0-alpha10.1-p0.12-pair.apk` (3,888,940 bytes), SHA-256 `3617EB46A088E4996931DE5CEEAEE1B408BAA0ED0EE057BA486A3E8D530EAF10`.

- [x] Fixed the P0.10 portrait chat regression: `MainActivity` detects keyboard overlap from the visible display frame and moves the portrait chat view's bottom edge above the keyboard; `RoomChatView` applies a margin-based external offset, keeps native deletion/cursor behavior visible and avoids double translation when IME Insets are also delivered. Explicitly kept the landscape overlay path separate. Bumped Android to versionCode 31 / `1.0.0-alpha10.1-p0.10`; 28/28 Android unit tests, Lint and assembleDebug passed. Built and opened `release/tongkan-android-1.0.0-alpha10.1-p0.10-fcm.apk` (3,888,940 bytes), SHA-256 `9CCA04F70DDDBECAC05541B3D768590A3017B1E8F2C9B4875C9B847F7A828D52`.

- [x] Implemented Alpha 10.1 P0.9 chat/profile fixes: the “我们” page displays nickname, masked email and stable Tongkan ID with a persisted nickname editor through Account Worker `PATCH /api/me`; chat bubbles use real account/room nicknames; portrait chat composer follows IME Insets above the keyboard so typed text, cursor, deletion and App send button remain visible; immersive landscape chat shows a persistent unread red dot until opened. Built and opened `release/tongkan-android-1.0.0-alpha10.1-p0.9-fcm.apk` (3,935,235 bytes), SHA-256 `8CF9FC9F5E1BC08389433F70EC9E56EE86176249F429868E42F5F854DCDE3A6C`. Account tests 17/17, workspace typecheck/tests, Android 28/28 unit tests, Lint and production-configured assembleDebug passed; Worker deployment version `9d98c07f-f074-4195-9c6e-05667ae42d99` passed health and authenticated-route smoke checks.

- [x] Applied portrait chat fill based on physical feedback: the viewing footer now owns the remaining screen height, the portrait RoomChatView expands within it, the message list consumes flexible space, and the composer remains fixed at the bottom. Landscape overlay behavior is unchanged.

- [x] Fixed the first P0.7 physical-test regressions: creation/join now remains on the entry page until WebSocket `auth.ok`, video preparation is disabled while connecting without repetitive Toast errors, `RoomClient` now correctly sets authenticated state so a one-member room can send chat, and landscape chat disables IME full-screen extract/fullscreen modes. Added a regression test proving chat works immediately after authentication with only one member online.

- [x] Implemented TK-002 urgent Android viewing enhancements (D-080/D-081): left/right landscape gestures adjust local Window brightness and STREAM_MUSIC volume with a percentage HUD and one-time hint; portrait viewing now has a 20-message in-memory text chat, while landscape has a bottom chat button, right-side compact overlay and 3-second incoming bubble. Added Unicode-safe 120-code-point validation, messageId echo deduplication, reconnect send disabling, keyboard overlay mode and room-leave cleanup. No signaling/server change was required because `chat.message` already broadcasts.

- [x] Validated Alpha 10.1 P0.7 in `C:\tmp\android-build\project-tk002-p07`: `git diff --check`, 27/27 Android unit tests, Lint with 0 errors/19 warnings, and production-configured `assembleDebug` passed. Built `release/tongkan-android-1.0.0-alpha10.1-p0.7.apk` (3,934,009 bytes), SHA-256 `E36B1B2C53715A19B5247C6B8E3F749E339C6ECAA5370C56EE5DEAD7C7C34E22`, and opened Explorer with the APK selected.
- [x] User accepted the reviewer/controller plus isolated worker-session workflow, Spec Kit artifacts, GitHub Issues/Draft PR handoff, per-task worktrees and reviewer-owned acceptance gates (D-079).

- [x] Reconstructed the corrupted `DECISIONS.md`, `ACCOUNT_PAIR_SPACE_PRD.md` and `apps/account/README.md` from clean UTF-8 sources; added Firebase/service-account ignore patterns, explicit Android test-token opt-in and redacted FCM failure logging.

- [x] Passed `pnpm typecheck`, 97 workspace tests, `pnpm build`, Android `testDebugUnitTest lintDebug assembleDebug`, `git diff --check` and a tracked/unignored credential scan after review repairs. Production D1 had no pending migration; applied `0003_device_tokens.sql` to preview D1 and verified schema parity.

- [x] Committed the reviewed Alpha 10.1 account, unique-friend and FCM baseline as `42248e1 feat(account): establish alpha 10.1 account and push baseline`.

- [x] Installed uv 0.12.4, Spec Kit 0.8.15 and GitHub CLI 2.97.0; initialized `.specify/` and Codex Spec Kit skills, disabled automatic Git hooks, added the multi-session constitution/workflow/Issue/PR/contract templates, and created the complete `TK-001-unilateral-unbind` pilot artifacts.

- [x] Independent governance review approved the reviewer/worker authority, worktree isolation, commit/merge/deploy boundaries and Issue/PR templates. Independent technical review approved TK-001 after adding retention retry semantics, snapshot/sorting rules, stable errors, D1 CAS/rollback, real local D1 concurrency tests, old-invite invalidation and pairId-targeted unbind protection.

- [x] Cleaned the remaining generated-file whitespace, validated 15 YAML files, 5 JSON files, 9 PowerShell scripts, the 19/19 requirements checklist, Spec Kit availability and staged added lines for credentials, then committed the workflow/TK-001 baseline as `3bd9ed3 chore(workflow): add spec-kit review workflow`.

- [x] User physically verified `1.0.0-alpha10.0-p0.3`: preview email-code login, in-App test code, secure session restore, logout, anonymous room fallback, theme and player regression passed on a real device.

- [x] Implemented Alpha 10.1 P0.1 unique-friend binding. Added D1 migration `0002_pairing.sql`, one-time 24-hour invite codes stored only as HMAC, replacement-code invalidation, `pairs` and unique `active_pair_members` constraints, create/accept/query APIs, PairService tests, Android pair models/client calls, and a functional Us page with generate/copy/accept/refresh/paired states. Applied the preview migration, deployed Worker version `66c764f9-eb74-4935-849a-41cc7fde123f` at 100%, and passed online two-account create/accept/query plus old-code rejection loops. Android 18 tests passed, Lint reported 0 errors and 11 warnings, full workspace typecheck/93 tests/build passed. Built `release/tongkan-android-1.0.0-alpha10.1-p0.1.apk` with SHA-256 `2ECCEDFE6187C31B61B4B9D2952963C6BF1832CAEE4C3477D5F0638DAAFFB079`.

- [x] Built the Alpha 10 P0.2 Android account-integration test candidate: added `AccountClient`, response models, Android Keystore AES-GCM `SessionStore`, two-stage email-code UI, service-unavailable/anonymous fallback, session restore/refresh/logout, logged-in Home and account summary states, and Gradle `tongkanAccountApiOrigin` injection. Preserved deep links, anonymous rooms, WebView, WebSocket and player code paths. Clean `testDebugUnitTest`, `lintDebug` and `assembleDebug` passed with 17 tests, 0 errors and 10 non-blocking warnings; full workspace typecheck, 87 tests and builds passed. Built `release/tongkan-android-1.0.0-alpha10.0-p0.2.apk` with SHA-256 `C4E977D9CC24A6824DC1E991D753348B95178890FA0C88B28BFD0B87FE01870C`. The APK has an empty account origin and is for UI/anonymous regression only until the Worker is deployed.

- [x] Committed the physically verified Alpha 10 P0 Android baseline as `e577b23 feat(android): establish alpha 10 p0 baseline`; the unrelated untracked `videos/` workspace remained outside the commit.

- [x] Created and security-reviewed the Alpha 10 account foundation in `apps/account`: independent Worker/D1 architecture, production database `tongkan-account`, preview database `tongkan-account-preview`, migration `0001_auth.sql`, HMAC-only email index, hashed verification codes, atomic one-time consumption, opaque session tokens, send-code/verify/refresh/logout/me APIs, fixed QQ SMTP 465 implicit-TLS adapter, isolated test mode and six AuthService tests. Applied both remote D1 migrations, passed a full local HTTP login/refresh/logout flow, and passed workspace typecheck, 87 tests and production dry-run builds.

- [x] Verified QQ SMTP connectivity without credentials: local Windows TLS 1.3 handshake to `smtp.qq.com:465` succeeded; a temporary Cloudflare scheduled Worker in HKG received `220 ... QQ Mail Server` in 1,162 ms and was deleted immediately after the result was recorded.
- [x] Configured production QQ SMTP secrets without printing their values, deployed `tongkan-account` version `2a2aa2d2-f8c2-4f30-8ac2-7ce212ce59bf`, switched Pages `ACCOUNT` binding to production, and verified `GET /account-api/health` returns `testMode: false`. A real `POST /account-api/api/auth/send-code` to `28***@qq.com` returned HTTP 202 with no `debugCode` after the resend window elapsed.
- [x] Built the production-account Android candidate `release/tongkan-android-1.0.0-alpha10.1-p0.2.apk` (versionCode 23) with `https://tongkan-personal.pages.dev/account-api` and an empty `ACCOUNT_TEST_ACCESS_TOKEN`. Android unit tests, Lint and APK assembly passed; SHA-256: `521EAFA140FD7A20DC65B2561220FA43F8E40262472D33C66D5756D4A9319168`.

- [x] User confirmed `1.0.0-alpha10.0-p0.1` passed real-device testing on 2026-08-13; P0 Breath Tech Auth/Home/navigation, safe areas, light/dark themes and anonymous room/player compatibility are now the accepted Alpha 10 Android baseline.

- [x] Started Alpha 10 Android P0 Java View implementation: added Breath Tech theme/drawable/component foundations, Auth and anonymous Home screens, four-tab navigation placeholders, system-inset handling and theme persistence; preserved existing create/join/share/player/fullscreen logic. `testDebugUnitTest`, `lintDebug` and `assembleDebug` passed in `C:\tmp\android-build\project-alpha10-p0-1`. Built `release/tongkan-android-1.0.0-alpha10.0-p0.1.apk` (SHA-256 `B1DE9AB9DA58BC0898E6787C0EE7D9334194C271BD71F23208EF2BB26F426BE0`) and opened it in Explorer for installation.

- [x] User visually approved Breath Tech and authorized the Android implementation-planning step; created `design/alpha10-ui/ANDROID_IMPLEMENTATION_PLAN.md` with Java View layering, P0/P1 screen scope, development sequence and first-slice acceptance criteria

- [x] Accepted D-073 and replaced the rejected Air/Cinema/Together production direction with Breath Tech: rebuilt five Alpha 10 pages in neutral white/black themes, added signal-led visuals and immediate button/loading/Toast feedback, refreshed five screenshots, passed 10 page/theme browser QA combinations without overflow or undersized touch targets, and updated the selected-design truth source

- [x] Accepted D-072: selected Air as the Alpha 10 production structure, retained Cinema/Together as Air color palettes, created `design/alpha10-ui/SELECTED_DESIGN.md`, added restrained tactile button depth and verified 30 page/palette/theme combinations plus resting/pressed button states without errors or content overflow

- [x] Accepted D-071 and rebuilt the Alpha 10 comparison with a shared shadcn-inspired component system while retaining Air, Cinema and Together; exported five refreshed screenshots and verified five pages, three phone canvases, light/dark themes, loading/success feedback and bottom Drawer interactions without JavaScript errors or overflow

- [x] Created three Apple-inspired Alpha 10 UI candidates covering login, home, fully shared library, calendar and Us: A Air, B Cinema and C Together; exported five comparison screenshots and completed visual overflow review

- [x] Built a 45-second, 1920x1080 Chinese HyperFrames promo preview in `videos/tongkan-promo` from the current repository and live product website; `npm run check` passed with lint/runtime/layout/motion at 0 errors and 0 warnings plus 25/25 WCAG AA text checks, 17 snapshots were visually reviewed, the preview service is available at `http://localhost:4317/#project/tongkan-promo`, and no MP4 was rendered
- [x] Accepted D-059: Alpha 10 prioritizes Tongkan accounts and a persistent two-person space; the old no-account restriction D-002 is superseded
- [x] Accepted D-060: each account can have at most one active bound friend, enforced by the server rather than only by UI
- [x] Accepted D-061: the two-person space includes a shared categorized library, watch calendar, joint history and monthly/cumulative statistics
- [x] Accepted D-062: optional Bilibili login and quality selection are postponed until the account foundation is stable
- [x] Accepted D-063: Alpha 10.0 uses email one-time-code login; phone SMS and WeChat Open Platform are not first-version dependencies
- [x] Accepted D-064: QQ Mail SMTP is the initial verification-code sender; users may register with any deliverable email address
- [x] Accepted D-065: anonymous temporary rooms remain available without login, while persistent pair-space features require an account
- [x] Accepted D-066: either friend may unbind unilaterally; each person independently chooses whether to retain a read-only archive, and physical deletion occurs only after both choose delete
- [x] Accepted D-067: the active pair library is fully shared with equal permissions and no private library in the first version
- [x] Accepted D-068: accounts use built-in avatars only; the user will provide the selectable image assets later
- [x] Accepted D-069: joint watch duration counts overlapping wall-clock intervals when both paired users are online, ready and actually playing; pause, buffering, disconnect and anonymous rooms do not count
- [x] Accepted D-070: calendar plans require a date; start time and note are optional, while notifications and recurring plans are deferred
- [x] Created `ACCOUNT_PAIR_SPACE_PRD.md` with four-tab navigation, account/pair/content/history data models, API draft, security requirements and Alpha 10.0-10.4 delivery phases
- [x] Updated `PRD.md`, `ANDROID_FOLLOWUP_PRD.md`, `PROJECT_CONTEXT.md` and `DECISIONS.md` for the new long-term product boundary
- [x] Implemented Alpha 9.3.3 player-control consolidation: the App interaction layer now owns portrait video taps and immersive control visibility instead of passing taps into Bilibili page elements
- [x] Hid Bilibili native progress/control/center-button overlays while preserving video and danmaku rendering; immersive controls now hide after 2.8 seconds during playback and the center button only appears when paused or ended
- [x] Hardened WebView navigation: subframe navigation remains available for player internals, while user-gesture main-frame navigation is blocked whenever the player is visible
- [x] Added Alpha 9.3.3 PRD and QA coverage for duplicate controls, navigation protection, auto-hide behavior and orientation-state preservation
- [x] Passed bridge JavaScript syntax validation, 15 Android unit tests, Lint with 0 errors and 7 non-blocking warnings, and Debug APK assembly for versionCode 15 / versionName 1.0.0-alpha.9.3.3
- [x] Generated `release/tongkan-android-1.0-alpha9.3.3.apk` (1,401,551 bytes; SHA-256 `A945C48845442B437EF15CC81A642BFCD8B32C94549050273EB85B43DFE34897`)
- [x] Implemented Alpha 9.3.4 room-video loading feedback: 8-second slow-load state and 20-second recoverable 鈥滄崲瑙嗛閲嶈瘯鈥?state without forcing an already-connected room back to preparation
- [x] Added orientation playback-state protection: preserve playing/paused state across manual landscape/portrait changes and suppress the transient rotation pause from room broadcasts
- [x] Passed 15 Android unit tests, Lint with 0 errors and 7 non-blocking warnings, and Debug APK assembly for versionCode 16 / versionName 1.0.0-alpha.9.3.4
- [x] Generated `release/tongkan-android-1.0-alpha9.3.4.apk` (1,402,067 bytes; SHA-256 `F9594BB03A4DFCADC3175406338819E092B85AB74036A28C3676321C0A17CE8A`)
- [x] Accepted D-057 and changed the immersive landscape/fullscreen control container to a transparent overlay; individual controls retain their own contrast and pressed-state surfaces
- [x] Updated the selected Android design, Alpha 9 follow-up PRD and QA section 7.4 for the transparent control layer
- [x] Passed 15 Android unit tests, Lint with 0 errors and 7 non-blocking warnings, and Debug APK assembly for versionCode 17 / versionName 1.0.0-alpha.9.3.5
- [x] Generated `release/tongkan-android-1.0-alpha9.3.5.apk` (1,402,047 bytes; SHA-256 `885AE8A1C4AA0659F7C9A07D7411BDCFF25188D64391CC6CB4388885CF7D9DD1`)
- [x] Identified the Alpha 9.3.5 audio-only regression: `.bpx-player-video-perch` is the actual parent of Bilibili's `<video>`, not a native control overlay
- [x] Removed the dangerous selector while keeping Bilibili native controls, recommendation overlays and top-level navigation suppressed
- [x] Passed bridge syntax/live-DOM regression checks, 15 Android unit tests, Lint with 0 errors and 7 non-blocking warnings, and Debug APK assembly for versionCode 18 / versionName 1.0.0-alpha.9.3.6
- [x] Generated `release/tongkan-android-1.0-alpha9.3.6.apk` (1,402,039 bytes; SHA-256 `D148D582E934514EDAA6F2E6F9789A6E983A8EFD8F9886B415352DF9109B67E3`) and automatically opened it in File Explorer
- [x] User physically confirmed Alpha 9.3.6 restores visible video playback together with audio

- [x] Started P0 stabilization and implemented Alpha 9.3.2 Android buffering debounce: short buffering under 2 seconds no longer pauses the room
- [x] Added one buffering=true report and one buffering=false report per buffering episode, with cancellation on recovery, media switch and room leave
- [x] Added a visible hard-sync notice when room/local drift exceeds 1.5 seconds without changing the accepted viewing layout
- [x] Passed 15 Android unit tests, Lint with 0 errors and 7 non-blocking warnings, and Debug APK assembly for versionCode 14 / versionName 1.0.0-alpha.9.3.2
- [x] Generated `release/tongkan-android-1.0-alpha9.3.2.apk` (1,447,668 bytes; SHA-256 `41663F1D92BF1BDD7E8D94158E0D850DFEC59E4F10F47A944640BF8A053B861C`)
- [x] Fixed Alpha 9.3 portrait viewing controls disappearing after video load by centralizing `videoFooter` visibility synchronization in `MainActivity.java`
- [x] Built Alpha 9.3.1 with versionCode 13; 15 unit tests passed, Lint passed with 0 errors and 7 non-blocking warnings, and Debug APK assembly passed
- [x] Generated `release/tongkan-android-1.0-alpha9.3.1.apk` (1,400,383 bytes; SHA-256 `1ACCACA261AFB54D4819CF6A4F9E0F253E33EE2108075B0BB49FEFB85E7434C8`)
- [x] Accepted D-056 and synchronized option A into `DECISIONS.md`, `ANDROID_FOLLOWUP_PRD.md`, `design/alpha9-ui/SELECTED_DESIGN.md` and `QA_CHECKLIST.md`
- [x] Built Android Alpha 9.3 option-A controls: removed the top-right overflow menu, compacted five playback actions into the first row, and exposed change-video plus theme in the second row
- [x] Passed 15 Android unit tests, Android Lint with 0 errors and 7 non-blocking warnings, and Debug APK assembly for versionCode 12 / versionName 1.0.0-alpha.9.3
- [x] Generated `release/tongkan-android-1.0-alpha9.3.apk` (1,402,937 bytes; SHA-256 `9571DF61F24AA73AE440C6ED5565E6B3B02D2A8CE2B08953E33BFD73B632ED7C`)
- [x] Reviewed the Alpha 9.2 Android viewing hierarchy and confirmed the usability problem is first-screen visibility and action hierarchy rather than missing playback functions
- [x] Created and browser-validated three viewing-control alternatives plus recommended light, dark and immersive-landscape previews under `design/alpha9-ui/watch-controls-options.*`
- [x] Accepted D-052: portrait adds extra safe-area breathing room and landscape becomes a full-screen tap-to-show player overlay without persistent online/room/sidebar UI
- [x] Created `design/alpha9-ui/preview-v3.html` with visible and hidden immersive landscape control states

- [x] Accepted D-051: quiet viewing-tool visual hierarchy with a local date-based daily classic-film quote on the entry page
- [x] Generated and visually checked Alpha 9.2 V2 previews for light entry, light viewing, dark viewing and dark landscape

- [x] Generated a code-derived Alpha 9.1 two-screen UI preview at `design/alpha9-ui/current-alpha9.1-code-preview.png` showing the safe-area entry page and centered 16:9 viewing page

- [x] Cloudflare Durable Objects signaling (tongkan-personal.pages.dev)
- [x] React Web room page (create/join/Bilibili sync/screen share)
- [x] Chrome/Edge Manifest V3 extension (Bilibili player injection, dual sync)
- [x] Auto-reconnect (Web)
- [x] Chat + screen share basic pipeline
- [x] Android Alpha 1 (versionCode 1)
- [x] Android Alpha 2: IPv4/IPv6 rotation, detailed errors, Origin header, timeout (versionCode 2)
- [x] Android Alpha 3: java-websocket 1.5.7->1.6.0, NPE fix, try-catch, DNS diagnostics (versionCode 3)
- [x] Local debugging connected successfully (Alpha 4-local)
- [x] Alpha 4~6: setDoOutput fix, WebView crash fix, b23.tv short link, NPE diagnostics
- [x] Alpha 7: Replaced java-websocket with OkHttp 4.12.0, removed custom DNS, simplified error handling
- [x] Alpha 7 restored as the active development and installation baseline on 2026-08-07
- [x] Clean Alpha 7 unit-test and Debug APK build passed (15 tests)
- [x] Android follow-up development PRD discussion draft created
- [x] Installed and validated the third-party ui-ux-pro-max skill for UI/UX design support
- [x] Defined a two-stage UI process: design direction now, visual micro-polish after core stability
- [x] Generated three UI design systems with ui-ux-pro-max and adapted them for Tongkan
- [x] Created and browser-validated an interactive Alpha 9 HTML preview
- [x] Created and browser-validated the local playlist interactive preview with list, sort, batch add, viewing sheet, switching overlay, and completion states
- [x] Corrected the rejected green-tinted dark theme to neutral black/charcoal; green remains only for online and success semantics
- [x] Created PROJECT_CONTEXT.md as the stable product map, repository directory guide, architecture overview, task routing, and document source-of-truth index
- [x] Created DECISIONS.md with 19 accepted product, design, Android, protocol, and playlist decisions plus a supersession policy
- [x] Connected AGENTS.md, README.md, CONTEXT.md, PROJECT_CONTEXT.md, and DECISIONS.md into a fixed new-conversation reading and maintenance workflow
- [x] Alpha 8 direct-page experiment built previously, then rolled back; artifact retained only for comparison
- [x] Recovered the generated Alpha 9 reaction preview to `design/alpha9-ui/reaction-sticker-preview-v1.png` for reliable local display
- [x] Replaced the oversized reaction picker concept with a compact 5脳2 popup above the 鈥滀簰鍔ㄢ€?button and exported `design/alpha9-ui/preview-reaction-compact-v2.png`
- [x] Confirmed black-and-white outlined dumpling art direction and generated `design/alpha9-ui/reaction-sticker-art-direction-a-v2.png` with light and dark visibility tests

- [x] Completed isolated Bilibili playback verification across mobile direct, desktop direct, mobile Embed, and desktop Embed routes using av170001 and BV1Qxuc62E1y
- [x] Accepted D-049: desktop User-Agent plus top-level player.bilibili.com Embed is the Alpha 9 Android player route
- [x] Implemented Alpha 9 first usable native flow: room entry -> video preparation -> viewing, with local validation before media-change broadcast
- [x] Implemented default light and selectable neutral black/charcoal dark themes with 12dp controls and pressed-state color feedback
- [x] Implemented B绔?danmaku preference, six synchronized playback rates, manual landscape, App immersive fullscreen, and HTML player fullscreen handling
- [x] Implemented 8-second slow loading hint, 20-second preparation timeout, cancel preparation, and automatic system share after room creation
- [x] Passed 15 Android unit tests, Android Lint, and Debug APK build for Alpha 9
- [x] Built `release/tongkan-android-1.0-alpha9.apk` (1,383,668 bytes, SHA-256 `B530C274A5B11F1C6D3CB9635957FE9B2BC35194907C5F3C9FDBED42926956D9`)

- [x] Processed first Alpha 9 physical-device screenshots and identified safe-area overlap, default button elevation, full-height WebView, hidden native controls, Bilibili click-through navigation, and inaccessible landscape control
- [x] Implemented D-050: centered 16:9 watch stage, system inset handling, zero-elevation buttons, blocked Bilibili internal navigation, and explicit landscape immersive viewing
- [x] Real Embed control probe passed: URL remained on player.html, top click-through overlay hidden, danmaku toggled true -> false, and playback rate changed to 1.5脳
- [x] Passed 15 unit tests, Android Lint, and Debug build for Alpha 9.1
- [x] Built `release/tongkan-android-1.0-alpha9.1.apk` (1,385,392 bytes, SHA-256 `1AFC421B94F0CB970D23A4396CB274F07B025B3AA94AE3085021CB3A97960885`)
- [x] Implemented D-051/D-052 natively for Alpha 9.2: open entry layout, daily local movie quote, light/dark visual tokens, compact watch header/tools, extra safe-area spacing and full-screen landscape overlay controls
- [x] Completed immersive player state integration: synchronized play/pause icons, portrait/landscape progress and time, loading/buffering visibility rules and three-second auto-hide during active playback
- [x] Passed 15 unit tests, Android Lint with 0 errors (7 non-blocking warnings), Java compilation and Debug APK assembly for Alpha 9.2
- [x] Built `release/tongkan-android-1.0-alpha9.2.apk` (1,400,318 bytes, SHA-256 `96DD1A137A593827126893E34DFD8586411A2A869B72A36CF56DE9F1CBAF7A4C`)
- [x] User confirmed Alpha 9.2 passed physical-device testing on 2026-08-10
- [x] Added CHANGELOG, release guide, D-053 immutable GitHub version policy and tag-triggered Android Release workflow
- [x] Revalidated release source: typecheck passed; 80 Web/protocol tests passed; workspace build passed; 15 Android tests, Lint and Debug assembly passed
- [x] Published GitHub prerelease `v1.0.0-alpha.9.2` from commit `4312b10`; Release APK SHA-256 is `F43FA9513C364FA85D7899ADE514483F6E625A9A9532138E630C867F67CA600F`
- [x] Updated GitHub repository description, homepage and topics for Android, Bilibili, Cloudflare Workers, watch-party and WebSocket discovery
- [x] Fixed general CI in commits `4f4ded7` and `a53c9a4`; GitHub Actions run `31352245118` completed successfully
- [x] Reworked the GitHub README into a user-first homepage with a single balanced Alpha 9.2 product showcase, online Web/APK entry points, Android and Web usage steps, and an explicit platform capability table
- [x] Created root `design.md` as the Web cross-page design source and recorded D-054 for shared Android/Web quiet-tool styling
- [x] Replaced warm-orange Web tokens with default light and persisted neutral black/charcoal dark themes
- [x] Added the non-destructive `apps/web/src/redesign.css` layer for compact navigation, open entry/join layouts, media-first room layout and responsive states
- [x] Fixed Web accessibility gaps: decorative preview control, join validation semantics, live room status and disabled unimplemented voice action
- [x] Visually verified desktop Home light/dark, Join and Room pages in the in-app browser with no console warnings or errors
- [x] Passed workspace typecheck, 80 tests, Web production build and full workspace build
- [x] Published Pages deployment `3bd77a10` and verified the canonical `tongkan-personal.pages.dev` UI and room connection
- [x] Implemented D-055 Web no-extension Bilibili fallback: an in-player 鈥滄棤闇€鎵╁睍鍏变韩瑙傜湅鈥?card launches tab screen sharing, guides Bilibili tab/audio selection, hides unusable playback controls during fallback sharing, and preserves extension-based dual control as the advanced mode
- [x] Passed Web typecheck, all 16 Web tests and the production Web build after the D-055 implementation
- [x] Committed and pushed D-055 as `ece55c0 feat(web): add no-extension Bilibili sharing`
- [x] Published production Pages deployment `f71c6cf2` and verified canonical room `a07c14b27ccc3859a0dc9956405021d3` reached 鈥滄埧闂村凡杩炴帴鈥?with the new CTA, audio checklist and sharing status


- [x] Added Alpha 10.1 push foundation: D1 migration `0003_device_tokens.sql`, encrypted device-token storage with HMAC lookup, register/unregister APIs, logout token revocation, provider abstraction with optional webhook adapter, and `/api/pair/watch-invites` authorization/validation/delivery reporting. Added `PushService` tests; Account Worker typecheck, dry-run build and 15 tests passed.
- [x] Added Android `PushTokenProvider` boundary and safe `NoopPushTokenProvider`; account client models/APIs now support device registration and watch-invite notification calls. Invite flow prefers notification when a concrete token/provider exists and keeps Android system sharing as fallback. Android `testDebugUnitTest`, `lintDebug` and `assembleDebug` passed with JDK 17 in `C:\tmp\android-build\project`.
- [x] Applied production D1 migration `0003_device_tokens.sql` to `tongkan-account`, deployed `tongkan-account` Worker version `fa0d8a5a-dced-442d-8dfc-952bcef6cfed`, verified `/account-api/health` returns `testMode: false`, and confirmed all three push/device endpoints return `401` without authentication. Account Worker regression remains green at 15/15 tests. Real provider delivery is intentionally not enabled.

- [x] Selected FCM as the first real push provider (D-078). Added Android Firebase Messaging dependency with AndroidX compatibility, configurable Firebase client fields, Android 13 notification permission request, token refresh/register on login/restore/foreground, token unregister on logout, notification channel and validated room deep-link click handling. Added Account Worker FCM HTTP v1 JWT/OAuth Provider without storing private keys in code.
- [x] Hardened FCM delivery: added `TongkanApplication` cold-start initialization, immediate server registration from `onNewToken`, ordered old-token revocation, cached-token logout cleanup, high-priority data-only messages, invite TTL/expiry checks, strict invite fragments, and server-side prevention of one device token remaining active on two accounts.
- [x] Added `scripts/configure-fcm.ps1` plus `scripts/run-fcm-configure.mjs`: Firebase files must stay outside Git; `-ValidateOnly` checks package/project matching without build or network changes; full mode tests/builds Android, configures three Worker Secrets without printing values, deploys, checks health, hashes the APK and opens Explorer. Added ignore rules and setup documentation. A fake external configuration passed validation without leaking dummy API key, service email or private-key text.
## In Progress

- [ ] Run the frozen P1.0 APK on two physical devices for FCM invite delivery/click/cold-start deep link and the full Beta room/playback/reconnect/landscape-chat matrix.

- [ ] Complete TK-001 online black-box API cases after a stable Account preview Pages Service Binding route exists, or after the user explicitly approves production Account migration and Worker deployment.

- [ ] Production TK-001 rollout remains deliberately paused: do not apply migration 0004 or deploy the Account Worker to production without explicit user approval.

- [x] Completed the P0.13 physical matrix: input/deletion, keyboard and App send, single local bubble, successful clearing and transition cleanup all passed. FCM two-device delivery remains a separate postponed check.

- [x] Real-device test `1.0.0-alpha10.0-p0.1` passed: Auth/Home spacing, light/dark switching, four-tab shell and anonymous room/player compatibility were accepted by the user

- [ ] Await user review of the HyperFrames Studio preview; revise timing, copy or visuals if requested, and render only after explicit approval

- [x] Rotated the exposed QQ SMTP authorization code in production and verified the live send-code route returns HTTP 202; a future dedicated sender mailbox and provider-limit study are optional release-hardening tasks

- [ ] Decide the clarity route after confirming Bilibili anonymous Embed quality behavior: 360P is the highest non-login option; 480P/720P/1080P require official Bilibili login or membership

- [x] Physically verified Alpha 9.3.1 restores the portrait footer after video loading; user paused further interface optimization

- [x] Accepted and implemented the no-extension Web experience: Bilibili defaults to guided tab screen sharing, while the extension remains the advanced dual-control mode.
- [x] Completed connected-room production QA for the no-extension sharing card, including live room creation, Bilibili embed loading, CTA/guide visibility and updated status copy.

- [x] Changed GitHub repository `dengbingmei24-web/tongkan` from Private to Public and verified unauthenticated access

- [x] User approved the redesigned Web and README for a local Git commit
- [x] Push the approved redesign commit to GitHub `origin/master`
- [x] Deploy the redesigned Web and existing Pages Functions bundle to Cloudflare Pages
- [x] Verify the canonical domain, create-room API path and room WebSocket connection in production

- [x] Collected first Alpha 7 UX feedback: opening directly into the video interface feels unattractive and out of sequence
- [x] Confirmed desired flow: room entry -> create/join -> video loading -> viewing
- [x] Confirmed fullscreen viewing is required because the current video remains in a fixed small area
- [x] Confirmed milestone split: Alpha 9 core viewing experience; Alpha 10 complete persistent local playlist
- [x] Confirmed Alpha 9 final wording, loading flow, user-facing errors, room lifecycle, buffering, synchronization, and completion behavior
- [x] Confirmed playlist scope: a persistent local Android watchlist; the peer only follows selected media changes
- [x] Confirmed playlist video-switch completion: enter viewing screen at 0 seconds and remain paused until manual play
- [x] Confirmed playlist completion behavior: no automatic next video; show Play next and Return to playlist actions
- [x] Confirmed playlist sorting: explicit edit mode, long-press drag with feedback, automatic order saving, and move/delete fallback actions
- [x] Confirmed playlist entry and batch add: shown after room entry, bottom sheet during viewing, multiline paste, duplicate detection, and background metadata loading
- [ ] Define playlist metadata cards, sorting, and synchronized video-change overlay
- [ ] Collect feedback on playlist card density, watched-state label, bottom-sheet height, and switching overlay
- [x] Confirmed successful video preparation automatically enters the viewing screen
- [x] Confirmed button feedback: press color, bounded ripple, loading label/spinner, duplicate-click prevention, and visible success/failure result
- [x] Confirmed room-entry essentials: visible nickname, create-room action, and invite-link join
- [x] Confirmed either room member may select video before the peer arrives; local viewing does not wait for peer readiness
- [x] Confirmed pasted video links require an explicit Prepare Video button press before room media changes
- [x] Confirmed invite links use a manual Paste action followed by an explicit Join Room press; no startup clipboard read
- [x] Confirmed successful room creation automatically opens the Android share sheet once, with a persistent re-share action on the preparation page
- [x] Confirmed the last non-empty nickname is persisted, auto-filled, always visible/editable, and required for create/join
- [x] Confirmed cold launch returns to room entry, while current-session background/configuration interruptions restore the active room until explicit leave
- [x] Confirmed layered Back behavior, overflow-menu Leave Room, confirmation before disconnect, and contextual reconnect action
- [x] Confirmed peer offline keeps local playback running, while local disconnection pauses and auto-reconnects before offering manual retry
- [x] Confirmed user-readable error categories, direct recovery actions, preserved link/room state, and collapsed technical details
- [x] Confirmed room-entry control order and hierarchy
- [x] Used ui-ux-pro-max to generate and adapt three visual directions
- [x] User selected C: clean tool-oriented direction
- [x] Defined the selected C direction's base palette, spacing, buttons, inputs, and icon rules
- [x] Confirmed both light and dark themes, with light as default and no automatic viewing-page switch
- [x] Confirmed restrained corner radii: buttons/inputs 12dp, cards 16dp, pills only for short statuses
- [x] Confirmed theme switch placement: top-right on entry, loading, and viewing screens
- [x] Frozen immersive fullscreen behavior: current orientation by default, manual landscape, layered Back, black stage, and three-second control auto-hide
- [x] Added Alpha 9 requirements for visible Bilibili danmaku with a native toggle and for synchronized playback-speed selection
- [x] Frozen danmaku default/on-device persistence and six synchronized playback-speed options
- [x] Confirmed preset non-text room reaction danmaku as Alpha 9 P1, non-blocking for the core APK
- [x] Confirmed Bilibili danmaku and room-reaction visibility are independent persisted local controls
- [x] Generated a first visual concept preview for the ten-expression reaction picker and fullscreen overlay
- [x] Confirmed safe media switching: local prepare and bridge verification must succeed before broadcasting a new room media
- [x] Confirmed video-preparation timing: 8-second slow hint, optional cancel, 20-second recoverable failure, no fake percentage
- [x] Confirmed four video error categories with direct recovery actions and collapsed technical details
- [x] Confirmed peer-initiated media switches are automatic, independently loaded, locally retried, and synchronized to the current room anchor after readiness
- [x] Confirmed sustained buffering over 2 seconds pauses both viewers, recovery requires manual play, and 15-second stalls show recovery actions
- [x] Confirmed drift correction thresholds: ignore below 0.3 seconds, smooth speed correction through 1.5 seconds, hard seek above 1.5 seconds with a brief status message
- [x] Confirmed end-of-video overlay with synchronized replay or selecting another video, with no automatic replay or next video
- [x] Confirmed room create/join loading feedback, automatic share after navigation, invite error categories, and late-join automatic current-media loading
- [x] Confirmed waiting/join/leave/rejoin presence feedback, uninterrupted local playback on peer absence, and reusable invitation while the room remains active
- [x] Confirmed 10-minute empty-room expiry, local-only leave behavior, and no force-dissolve feature in Alpha 9
- [x] Confirmed the reaction picker placement: compact two-row popup above the control-bar interaction button, never at the top of the video
- [x] Confirmed reaction motion: short right-side glide, three upper/middle lanes, 48dp portrait / 56dp fullscreen, 2.5 seconds, peer nickname, and haptic send feedback
- [x] Collected feedback and froze the reaction-pack visual style as black-and-white outlined dumplings with yellow/red/blue accents
- [x] Real-device tested the implemented fullscreen and landscape overlay behavior
- [x] Re-evaluated the Bilibili player approach through isolated probes and retained the trusted embedded-player route

## Active Tasks

1. Commit the independently approved Spec Kit/workflow/TK-001 setup.
2. Open a fresh terminal, verify `gh --version`, authenticate GitHub CLI and create W1-W3 Worker Issues.
3. Create the three branches/worktrees from the exact setup commit and hand each task only its contract.
4. Start the TK-001 implementation/review loop without remote migration or deployment.

## Known Issues

1. `1.0.0-alpha10.1-p1.0` contains the TK-001 Android UI, but production Account D1/Worker have not received migration 0004 or the new endpoints. Unbind/archive actions will not work against the production Account origin until an explicitly approved rollout.
2. The isolated preview D1 and Worker are updated, but `https://account-preview.tongkan-personal.pages.dev/account-api/health` returns 404 because no stable Pages preview route currently binds `ACCOUNT` to `tongkan-account-preview`. Online QA tokens were not fabricated or printed.
3. Real two-device FCM delivery, notification click/cold-start recovery and the full Beta regression are still physical-device gates; automated checks cannot replace them.
4. Integration commits still use the automatic Git identity `unknown <dengbingmei@game.ntes>`; configure a GitHub noreply identity before future public commits if desired.
5. `1.0.0-alpha10.1-p0.13` with the production Account Worker base URL has passed the complete physical portrait chat matrix. P0.12 remains rejected and should not be redistributed.
6. A repeatable two-device regression matrix for create/join, media switching, speed, seek and reconnect should be completed before Beta.
7. Alpha 9.3.3 inherits the accepted Alpha 9.3.2 buffering debounce and one-report-per-buffering-episode guard; two-device physical verification is pending.
8. Full four-category error cards, playback-completion overlay and hard-sync notice remain stabilization work.
9. Android Release signing is not configured; Alpha artifacts use Debug signing. Configure a stable Release keystore before publishing the account-enabled Android app.
10. Alpha 10 persistent local playlist remains deferred until post-Alpha 9.2 usage feedback.
11. GitHub Actions reports non-blocking Node.js 20 runtime deprecation warnings for several third-party actions; migrate action majors in a separate maintenance change.
12. The redesigned README and Web UI are now pushed to GitHub and live on Cloudflare Pages. Future Web changes must continue deploying from `apps/web` so the existing `functions/_middleware.js` service-binding proxy is included.
13. The GitHub repository is Public. Its history exposes old commit email `dengbingmei@game.ntes` and the tracked local path `C:\Users\dengbingmei\.codex\skills\ui-ux-pro-max\SKILL.md`; the pre-public scan found no common token, private-key or credential patterns in Git history. Do not rewrite history unless explicitly requested.
14. A normal Web page cannot directly read or control the `<video>` element inside the cross-origin `player.bilibili.com` iframe, and the official external-player page documents URL parameters rather than a stable runtime control API. A no-extension Bilibili mode should therefore use screen sharing; reverse-engineering private player messages or proxying Bilibili streams is not recommended as the default route.
15. Alpha 9.3.1 footer visibility is physically verified. Remaining release-gate feedback covers first-screen spacing, button sizing, theme switching and immersive landscape controls.
16. The test recording shows roughly 10鈥?1 seconds of black/paused player state after entering the viewing page before the Bilibili video becomes visible; there is no clear app-level loading progress, timeout or retry action. Treat this as a P1 loading-feedback issue unless it reproduces as an actual stuck load.
17. Alpha 9.3.3 implements native Bilibili control suppression, an App-owned transparent interaction layer and user-gesture main-frame navigation blocking. Static/build validation passed, but physical verification is still required because Bilibili DOM classes and WebView gesture behavior can vary by player version.
18. The landscape stage is genuinely horizontal in the cropped frames; the large black areas in the portrait recording are caused by recording a landscape screen into a fixed 432x960 portrait canvas. The 16:9 video's left/right pillarboxing is normal. However, after the 51.9鈥?2.3s rotation back to portrait the player is paused at about 05:37鈥?5:38; the recording cannot prove whether this was an intentional tap or an unintended rotation side effect, so add a focused enter/exit-landscape playback-state regression.
19. This was a single-device visual recording only. It does not verify two-device synchronization, long/short buffering behavior, reconnect, hard-sync notices, peer media switching or completion-state behavior for Alpha 9.3.2.
20. Bilibili Embed currently exposes only Auto(360P) without a Bilibili login. `high_quality=1`, `quality=64`, `qn=64` and `quality=80&qn=80` all remain at 360P. Real clarity improvement requires an optional official Bilibili login flow and highest-available-quality selection; CSS sharpening cannot restore missing source detail.
21. Alpha 10 email login uses QQ Mail SMTP through `smtp.qq.com:465` implicit TLS. The previously exposed authorization code was rotated on 2026-08-17 through an interactive local Wrangler prompt, and the live send-code route returned HTTP 202. Never use or store the mailbox password.
22. Unbind/data ownership is resolved by D-066: either party may unbind immediately after confirmation; each party independently keeps or deletes access to a read-only archive, and underlying pair data is physically deleted only when both choose delete. Account-deletion interaction with retained archives still requires implementation-level validation.
23. The current Android UI is concentrated in `MainActivity.java`; Alpha 10 should introduce plain-Java account/session clients and separate auth/watch screen responsibilities without Kotlin, Compose or a large framework rewrite.
24. The HyperFrames promo preview is intentionally silent and local-only for review. TTS/BGM dependencies are unavailable offline, and final MP4 rendering is explicitly deferred until user approval.
25. Production Account Worker and Pages `/account-api` routing are live, but the current test APK still needs the next provider-enabled build for real push validation. Library and Calendar remain placeholders, while Us contains the account/pair shell and one-tap invite flow.
26. Production device-token storage is migrated and protected by HMAC lookup plus AES-GCM ciphertext. With no `PUSH_PROVIDER`/FCM secrets configured, the Worker returns `fallbackRequired` rather than claiming delivery; Android continues with system sharing.
27. Portable GitHub CLI 2.97.0 works from `C:\tmp\gh-cli-2.97.0\bin\gh.exe`, but `gh auth status` reports no authenticated host. A visible `gh auth login --web` terminal is open; Worker Issues and worktrees must wait until authentication succeeds.

## Architecture Decisions

- Room fixed at 2 people (host + guest), no multi-group
- Alpha 9 keeps anonymous temporary-key rooms; Alpha 10 adds email-code accounts while temporary keys remain the room-runtime and compatibility mechanism
- Android: Bilibili sync control only (no screen share, voice, chat)
- Server syncs control state only, no video stream relay
- Native Android remains Java + WebView; no Kotlin, Compose, or new architecture dependencies
- Alpha 7 is the safe rollback baseline
- Player experiments must be isolated and real-device verified before replacing the baseline
- UI changes must be based on the user's actual usage experience, not assumptions
- Confirmed UI flow: room entry screen -> video loading screen -> viewing screen
- Room-entry screen keeps the nickname field visible
- Confirmed entry order: nickname -> primary create-room button -> separator -> invite input -> join button
- Entering fullscreen must not force landscape; landscape is a user-selected action
- Fullscreen viewing is a P0 product requirement for the next UI iteration
- UX structure and the visual design system are decided before Alpha 9 implementation
- Animations and pixel-level visual polish wait until the core playback flow is stable
- ui-ux-pro-max provides design guidance and audits; implementation remains native Java without Compose
- Theme selection persists locally and must not reconnect the room or reload the current video
- Dark theme uses neutral black and charcoal surfaces; green is restricted to small online/success indicators
- Local playlist persists on the Android device across rooms and restarts; only the selected media is synchronized through existing media-change commands

## Android APK Build Environment

```
JDK:  C:\tmp\android-build\jdk17\jdk-17.0.14+7  (Microsoft JDK 17)
SDK:  C:\tmp\android-build\android-sdk  (platform 35, build-tools 35.0.0)
Project: C:\tmp\android-build\project-alpha92-20260807  (latest Alpha 9.2 validation copy; ASCII path avoids Gradle errors)
```

## Active Android Test Artifact

- APK: `release/tongkan-android-1.0.0-alpha10.0-p0.2.apk`
- Size: 1,438,115 bytes
- SHA-256: `C4E977D9CC24A6824DC1E991D753348B95178890FA0C88B28BFD0B87FE01870C`
- Version: `1.0.0-alpha10.0-p0.2`, versionCode 20
- Validation: clean `testDebugUnitTest`, `lintDebug` and `assembleDebug` passed on 2026-08-13
- Tests: 17 passed; Lint: 0 errors, 10 non-blocking warnings
- Account configuration: empty `ACCOUNT_API_ORIGIN`; verifies UI and anonymous fallback only, not real email delivery
- Build directory: `C:\tmp\android-build\project-alpha10-account-20260813-1205`
- Physical verification: pending
- Committed rollback baseline: `e577b23` / p0.1
- Signing: Android Debug signing; manual installation only

## Previous Verified Alpha 9.3.1 Artifact

- APK: `release/tongkan-android-1.0-alpha9.3.1.apk`
- Size: 1,400,383 bytes (1.34 MiB)
- SHA-256: `1ACCACA261AFB54D4819CF6A4F9E0F253E33EE2108075B0BB49FEFB85E7434C8`
- Physical verification: portrait footer visibility fix passed on 2026-08-11
## Published Alpha 9.2 Artifact

- APK: `release/tongkan-android-1.0-alpha9.2.apk`
- Size: 1,400,318 bytes (1.34 MiB)
- SHA-256: `96DD1A137A593827126893E34DFD8586411A2A869B72A36CF56DE9F1CBAF7A4C`
- Validation: `testDebugUnitTest lintDebug assembleDebug` passed on 2026-08-07
- Unit tests: 15 passed, 0 failed; Lint: 0 errors, 7 non-blocking warnings
- Signing: Android Debug signing; manual installation only
## Alpha 7 Rollback Artifact

- APK: `release\tongkan-android-1.0-alpha7.apk`
- Size: 1,374,384 bytes
- SHA-256: `5CA2707D44E1795ED2A4DEB1BF1E45F8E2D95DDABCB0F0ECF66B307B6D60C266`
- Validation: `clean testDebugUnitTest assembleDebug` passed on 2026-08-07
- Unit tests: 15 passed, 0 failed

## Archived Experimental Artifact

- Alpha 8 APK: `release\tongkan-android-1.0-alpha8.apk`
- Alpha 8 is not the current version and should only be used for comparison if needed
- Do not continue Alpha 8 implementation without first reviewing the user's real-device experience

## Next Steps

1. Install the frozen P1.0 APK on both phones and run FCM notification delivery, tap-to-room and cold-start deep-link checks.
2. On the same frozen APK/commit, run the Beta two-device room matrix: create/join, play/pause, seek, six speeds, media switch, 15-second disconnect/reconnect, landscape unread red dot/input and at least 30 minutes continuous viewing.
3. Decide the TK-001 server rollout path: either create a stable preview Pages route and provide three secure QA tokens, or explicitly approve production Account migration 0004 plus Worker deployment.
4. After online API verification, run unilateral unbind/keep/delete/rebind/restart and both-delete D1 row checks.
5. Push the current integration branch only when the user requests it; no production deployment or master merge has been performed.
6. Resume the postponed documentation-governance migration after the P1 dual-device gate is complete.

## Key Files

| Purpose | File |
|---|---|
| Android follow-up PRD | ANDROID_FOLLOWUP_PRD.md |
| Account and pair-space PRD | ACCOUNT_PAIR_SPACE_PRD.md |
| Alpha 9 interactive UI preview | design/alpha9-ui/preview.html |
| Local playlist interactive preview | design/alpha9-ui/playlist-preview.html |
| Alpha 9 design direction notes | design/alpha9-ui/DESIGN_DIRECTIONS.md |
| Selected Alpha 9 design specification | design/alpha9-ui/SELECTED_DESIGN.md |
| Android viewing-control options prototype | design/alpha9-ui/watch-controls-options.html |
| Android viewing-control comparison image | design/alpha9-ui/watch-controls-options-comparison.png |
| Installed UI/UX skill | C:\Users\dengbingmei\.codex\skills\ui-ux-pro-max\SKILL.md |
| Main product PRD | PRD.md |
| Android Bilibili URL parsing/embed URL | apps/android/.../BilibiliMedia.java |
| Android WebView/player bridge and UI | apps/android/.../MainActivity.java |
| Android WebSocket/API | apps/android/.../RoomClient.java (OkHttp 4.12.0) |
| Android build config | apps/android/app/build.gradle |
| Alpha 9.3.6 local APK | release/tongkan-android-1.0-alpha9.3.6.apk |
| Alpha 10 P0 Android UI APK | release/tongkan-android-1.0.0-alpha10.0-p0.1.apk |
| Protocol messages | apps/android/.../RoomProtocol.java |
| Player bridge script | apps/android/app/src/main/assets/bilibili-player-bridge.js |
| Signaling Worker | apps/signaling/src/worker.ts |
| Room session logic | apps/signaling/src/room-session.ts |
| Shared types | packages/protocol/src/types.ts |
| QA checklist | QA_CHECKLIST.md |
| Active local test APK | release/tongkan-android-1.0.0-alpha10.1-p1.0-dual-device.apk |

## Follow-up PRD Direction

The discussion draft in `ANDROID_FOLLOWUP_PRD.md` defines:

- Alpha 7 as the stable rollback baseline
- A feedback-first development process
- Separate milestones for player validation, room workflow, viewing UI, and stability
- P0/P1/P2 priority recommendations
- A simple user experience feedback template
- Open decisions that must be discussed before implementation
- Confirmed first UX decisions: staged room/video screens and P0 fullscreen viewing
- Confirmed nickname remains visible on the entry screen
- Confirmed fullscreen does not auto-rotate; landscape is manually selectable
- Interactive preview now covers all three staged screens and fullscreen/manual landscape behavior
- Selected Alpha 9 visual direction: C / clean utility
- Entry, loading, and viewing screens support both light and dark themes
- Default theme is light; theme selection is user-controlled and persisted
- Theme changes must not reconnect the room or reload the video
- Selected corner system: 12dp controls, 16dp cards, pills only for compact statuses
- Acceptance criteria for room flow, playback, UI, and long-duration stability

## Alpha 7 Changes Summary

- `networkErrorMessage`: string-match -> `instanceof` checks
- WebSocket dependency: `com.squareup.okhttp3:okhttp:4.12.0`
- `RoomClient.java`: OkHttp WebSocket implementation
- Removed custom DNS and java-websocket-specific NPE handling
- `MainActivity.java`: `super.onCreate(null)`, safety catches, WebView restore protection
- Version: versionCode 7, versionName `1.0.0-alpha.7`

## Crash Root Cause Analysis

See `.crash-analysis.md` and `.roomclient-loss-analysis.md` for detailed post-mortems.

## Conversation Log

- 2026-08-14 (155): Continued real FCM enablement. Confirmed the machine has no Firebase CLI, `google-services.json`, service-account JSON or FCM Worker Secrets. Added `scripts/configure-fcm.ps1`, `scripts/run-fcm-configure.mjs` and `pnpm run fcm:configure`; the workflow rejects Firebase files inside the repository, validates package/project matching, supports `-ValidateOnly`, runs Android tests/Lint/provider-enabled build before changing production, writes `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL` and `FCM_PRIVATE_KEY` through Wrangler stdin without echoing values, deploys, checks health, hashes the APK and opens Explorer. Added `.gitignore` protections and Android/Account documentation. Validation with fake files in the system temp directory passed and output contained none of the dummy API key, service email or private-key text. Actual FCM delivery remains blocked only by obtaining the two matching Firebase files. No commit or push was made.
- 2026-08-14 (156): Resumed the FCM rollout, reread the project context/decision and preserved the existing dirty worktree. Searched Downloads, Desktop and Documents recursively without exposing file contents; no matching `google-services.json` or Firebase service-account JSON was found. Opened the official Firebase console so the user can create/select a project, register Android package `com.tongkan.mobile` and download the two matching external JSON files. No code, production Secret, deployment, APK, commit or push changed; the next action is for the user to provide only the two absolute file paths, after which `pnpm run fcm:configure` can complete validation, deployment and the FCM-enabled APK build.
- 2026-08-14 (157): User reached the Firebase new-project naming screen and asked how to fill it. Recommended project name `Tongkan` (this field is not the Android package), leaving the auto-generated project ID unless Firebase reports a conflict, keeping the required Firebase terms accepted, disabling the optional Google developer program, and disabling Google Analytics on the next screen because Alpha 10.1 currently needs only FCM. No code, Secret, deployment, APK, commit or push changed.
- 2026-08-14 (158): User completed Firebase project creation and reached the Tongkan project overview. Directed them to click `+ 添加应用`, select the Android icon, enter exact case-sensitive package `com.tongkan.mobile`, use optional nickname `同看 Android` and leave SHA certificate fields empty for FCM-only setup. The next required artifact is `google-services.json`. No code, Secret, deployment, APK, commit or push changed.
- 2026-08-14 (159): User provided external path `C:\Users\dengbingmei\Downloads\google-services.json`. Safely validated existence, package `com.tongkan.mobile`, project ID, mobile application ID and API key without printing any values; the file is outside the repository and valid for the Android build. Searched Downloads for a matching Firebase Admin/service-account JSON and found none. The remaining setup action is Firebase console Settings > Service accounts > Firebase Admin SDK > Generate new private key, then provide only its absolute path. No code, production Secret, deployment, APK, commit or push changed.
- 2026-08-14 (160): User provided the external Firebase service-account JSON. `pnpm run fcm:configure` ValidateOnly confirmed both files match package `com.tongkan.mobile` and the same Firebase project without printing sensitive values. The full workflow passed Android unit tests, Lint and assemble, configured `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL` and `FCM_PRIVATE_KEY` as Cloudflare Secrets, deployed Account Worker version `7dbd0456-b2ed-431f-810b-42cd1e1d13cf` at 100%, and passed production health. A local service-account smoke test successfully obtained a Google OAuth token and reached FCM HTTP v1; the deliberate fake registration token returned HTTP 400 `INVALID_ARGUMENT`, confirming authentication/API availability without sending a real notification. Built and opened `release/tongkan-android-1.0.0-alpha10.1-p0.6-fcm.apk` (3,906,102 bytes), SHA-256 `12884431DAEEF47FD36F1914E80867BC8BAE67930B79BE73C8218D99AAD45BF4`. Real two-device delivery and notification click verification remain pending. No commit or push was made.
- 2026-08-14 (161): User postponed FCM physical testing and requested a cross-session development model with one global review window and multiple parallel execution windows, including result submission, rejection and revision loops, and asked to consider GitHub Spec Kit. Reviewed the official Spec Kit workflow and Codex integration. Proposed using Spec Kit for constitution/specification/plan/tasks/analyze/checklists, GitHub Issues and draft PRs as the durable cross-session communication bus, and one Git branch/worktree per worker for isolation; the review window owns integration, global context and verdicts. Spec Kit itself does not provide live session messaging. Local inspection found Python 3.12 available but no `uv`, `specify`, `pipx` or `gh`; only the master worktree exists. Because the current Alpha 10.1 account/pair/push implementation is still largely uncommitted while HEAD is `e577b23`, a reviewed baseline commit is mandatory before spawning worktrees or they will start from stale code. No installation, branch, worktree, commit, push or long-term decision was made; user approval of the collaboration model is pending.
- 2026-08-03~05: Android Alpha 1 initial development
- 2026-08-06 (1): Alpha 2 - IPv4/IPv6 rotation, detailed errors, timeout
- 2026-08-06 (2): Alpha 3 - NPE fix, java-websocket 1.6.0
- 2026-08-06 (3): AGENTS.md + CONTEXT.md mechanism, skill routing, local server
- 2026-08-06 (4): Local debug, WebView crash fix, b23.tv, OkHttp migration -> Alpha 7
- 2026-08-07 (1): Alpha 8 direct mobile Bilibili page experiment built
- 2026-08-07 (2): Made CONTEXT.md updates mandatory at the end of every conversation
- 2026-08-07 (3): Returned to Alpha 7, rebuilt APK, and drafted the Android follow-up PRD for user-experience discussion
- 2026-08-07 (4): User reported that the App opens directly into an unattractive video screen and cannot play fullscreen; staged entry flow and fullscreen were recorded as Alpha 9 P0 candidates
- 2026-08-07 (5): User confirmed nickname stays visible and fullscreen must not auto-rotate; landscape will be an explicit user choice
- 2026-08-07 (6): User approved the proposed room-entry order: nickname, create room, separator, invite link, join room
- 2026-08-07 (7): Installed ui-ux-pro-max and agreed to design UX structure and visual direction before Alpha 9, while leaving micro-polish until core functionality stabilizes
- 2026-08-07 (8): Generated three adapted visual directions and a validated interactive HTML preview for Alpha 9 design selection
- 2026-08-07 (9): User selected C / clean utility as the Alpha 9 UI direction; base design tokens were recorded
- 2026-08-07 (10): User requested selectable light/dark themes with light default and tighter corner radii; preview and design tokens were updated
- 2026-08-07 (11): Verified the completed light/dark previews, default-light behavior, and 12dp control radius; native theme-switch placement remains the next UX decision
- 2026-08-07 (12): User approved the top-right theme switch on all three screens; the interactive prototype and Alpha 9 specifications were updated
- 2026-08-07 (13): User confirmed automatic entry after video preparation and reported weak button feedback; press/loading feedback is now under discussion
- 2026-08-07 (14): User approved the three-stage button feedback specification for later Alpha 9 native implementation
- 2026-08-07 (15): User requested a multi-video playlist with thumbnails, titles, ordering, selectable switching, and a visible synchronized video-change state; product scope discussion started
- 2026-08-07 (16): User selected a persistent local Android watchlist for the first playlist version; shared room editing is deferred
- 2026-08-07 (17): User confirmed playlist switches enter the viewing screen at 0 seconds and remain paused until manual play
- 2026-08-07 (18): User confirmed playlist playback does not automatically advance; completion offers Play next and Return to playlist
- 2026-08-07 (19): User approved playlist sorting mode with explicit edit state, long-press drag, automatic saving, and fallback move actions
- 2026-08-07 (20): User approved playlist entry points and batch-add flow: no entry-screen clutter, full list after joining, viewing bottom sheet, multiline paste, and duplicate detection
- 2026-08-07 (21): Created and validated an interactive local-playlist preview covering light list, sorting, batch add, dark viewing sheet, switching overlay, and completion actions
- 2026-08-07 (22): User rejected the green-tinted dark theme; both previews and specifications were changed to neutral black/charcoal with green limited to semantic status indicators
- 2026-08-07 (23): Built a complete product context management system with a stable project map, directory/document routing, long-term decision log, mandatory AI read order, and README navigation
- 2026-08-07 (24): User clarified that the updated `ANDROID_FOLLOWUP_PRD.md` makes Alpha 9 the next development version; Alpha 7 remains the current stable baseline and Alpha 8 remains archived
- 2026-08-07 (25): User asked to continue Alpha 9 development discussion; scope freeze begins with deciding whether the persistent local playlist ships in Alpha 9 or a later milestone
- 2026-08-07 (26): User accepted the milestone split: Alpha 9 delivers the core room and viewing experience, while the complete persistent local playlist moves to Alpha 10
- 2026-08-07 (27): User accepted that either room member can select video without waiting for the peer; each client enters viewing when locally ready, and late joiners sync the current media
- 2026-08-07 (28): User accepted explicit video preparation: pasting validates the link and enables the button, but loading and room media changes only begin after tapping Prepare Video
- 2026-08-07 (29): User accepted manual invitation handling: the App does not read the clipboard on startup; Paste fills the invite field and Join Room remains a separate explicit action
- 2026-08-07 (30): User requested automatic sharing after room creation; Alpha 9 will open the Android share sheet once on successful creation and retain a manual re-share action
- 2026-08-07 (31): User accepted nickname persistence: Alpha 9 remembers the last non-empty nickname but keeps the field visible and editable on every room-entry screen
- 2026-08-07 (32): User accepted room lifecycle behavior: cold launch starts at room entry, current-session interruptions restore the room and page, and explicit leave clears the session
- 2026-08-07 (33): User accepted layered navigation: Back exits fullscreen, then returns viewing to preparation without disconnecting; leaving from preparation or the overflow menu requires confirmation
- 2026-08-07 (34): User accepted disconnect handling: peer offline does not pause local playback, while local room disconnection pauses immediately, auto-reconnects, and shows manual retry only after failure
- 2026-08-07 (35): User accepted error UX with plain-language categories and direct recovery actions while preserving technical diagnostics under a collapsed View Details section
- 2026-08-07 (36): User accepted fullscreen control behavior: black stage, tap-to-toggle controls, three-second auto-hide while playing, persistent controls during interaction or errors, and restored orientation on exit
- 2026-08-07 (37): User added Alpha 9 requirements for a danmaku option that preserves Bilibili comments and for a playback-speed feature; existing rate sync can be reused, while danmaku bridging remains to be implemented
- 2026-08-07 (38): User accepted danmaku as a default-on per-device persisted preference and accepted six room-synchronized speed options with new rooms starting at 1.0脳
- 2026-08-07 (39): User requested preset non-text reactions visible to both viewers; feasibility review found that the existing chat broadcast and rate limit can support an ephemeral room reaction overlay without persistent room state
- 2026-08-07 (40): User accepted room reaction danmaku as an Alpha 9 P1 feature with 8鈥?2 built-in non-text reactions, real-time broadcast, no history or offline replay, and no ability to block the core APK
- 2026-08-07 (41): User accepted independent local controls for Bilibili danmaku and room reactions; reactions remain visible with fullscreen controls hidden and use immediate local rendering plus server-message deduplication
- 2026-08-07 (42): Generated the first visual preview of the ten-expression clean-utility reaction pack, its light picker panel, and dark fullscreen overlay; awaiting user design feedback
- 2026-08-07 (43): User could not see the inline generation result; recovered its PNG from the Codex task record into the project and displayed it using an absolute local path
- 2026-08-07 (44): User said the large picker over the video obstructs viewing; changed it to a compact 5脳2 popup directly above the 鈥滀簰鍔ㄢ€?control, updated PRD/design/decision documents, and exported a revised preview
- 2026-08-07 (45): User explicitly accepted the compact reaction picker preview; its placement, 5脳2 layout, close behavior, and control-bar visibility rules are frozen for Alpha 9 P1 implementation
- 2026-08-07 (46): Began the next design discussion for reaction overlay motion; comparing full-screen danmaku traversal, a recommended short right-side glide, and a button-origin floating bubble, with exact size and timing awaiting user confirmation
- 2026-08-07 (47): User accepted the recommended short right-side glide: 48dp portrait / 56dp fullscreen, about 120dp travel with slight upward drift, 2.5-second lifetime, three upper/middle lanes, peer nickname labels, and button scale/color/haptic feedback
- 2026-08-07 (48): Began selecting the final art direction for the ten custom reaction assets; comparing minimal outlined dumplings, colorful flat emoji, and glossy 3D styles, with the minimal outlined system recommended
- 2026-08-07 (49): User accepted art direction A; recorded D-038 and generated `reaction-sticker-art-direction-a-v2.png`, showing the final ten black-and-white outlined dumpling expressions and dark-video visibility test
- 2026-08-07 (50): User accepted the new reaction concept and asked what remains; reorganized the roadmap so Alpha 9 core UI/player/lifecycle implementation and QA come before non-blocking P1 reaction asset production, followed by Alpha 10 playlist work
- 2026-08-07 (51): Began the final Alpha 9 loading/error-state discussion with a proposed safe media-change flow: load and verify the new video locally first, broadcast the room media change only after success, and leave the peer on the existing video if preparation fails
- 2026-08-07 (52): User accepted safe media switching; recorded D-039 so failed local preparation preserves the room鈥檚 current video and only successful local bridge readiness triggers the synchronized switch
- 2026-08-07 (53): Prepared the next loading-timing proposal for discussion: immediate spinner and 鈥滄鍦ㄥ噯澶囪棰戔€? a slower-loading hint after 8 seconds, a 20-second failure threshold, no fake percentage, an optional cancel action, and a brief success check before synchronized switching
- 2026-08-07 (54): User accepted the loading timing; recorded D-040 with the 8-second slow hint, cancel action, 20-second recoverable failure, no percentage, and 0.4-second success feedback
- 2026-08-07 (55): Prepared the next discussion around four user-facing video errors: invalid link, network/timeout, player bridge failure, and unavailable or restricted video, each with a direct recovery action and collapsed technical details
- 2026-08-07 (56): User accepted the four-category error matrix; recorded D-041 and froze exact natural-language copy, recovery actions, room-disconnect separation, state preservation, and collapsed diagnostics
- 2026-08-07 (57): Prepared the next discussion for receiving a peer-initiated video switch: automatic switch overlay, independent local loading, no wait between devices, and local retry if the receiver fails to load the room鈥檚 new current media
- 2026-08-07 (58): User accepted peer-initiated automatic switching; recorded D-042 with immediate pause/overlay, independent loading, no confirmation, local-only retry, and room-anchor catch-up after readiness
- 2026-08-07 (59): Prepared the next discussion for playback buffering: ignore very short stalls, optionally pause both viewers after a sustained stall, show which viewer is loading, and require an explicit resume after recovery
- 2026-08-07 (60): User accepted synchronized buffering pauses; recorded D-043 with a 2-second debounce, one pause per buffering episode, manual resume after recovery, and 15-second recovery actions
- 2026-08-07 (61): Code review confirmed the existing bridge already ignores drift below 0.3 seconds, temporarily adjusts speed for 0.3鈥?.5-second drift, and hard-seeks above 1.5 seconds; prepared this behavior for user confirmation
- 2026-08-07 (62): User accepted the existing drift correction thresholds; recorded D-044 and added the brief 鈥滃凡閲嶆柊鍚屾鈥?message only for hard seeks above 1.5 seconds
- 2026-08-07 (63): Prepared the next discussion for end-of-video behavior: stay in the room, show a completion overlay, offer synchronized replay or return to video preparation, and never auto-play or auto-select another video in Alpha 9
- 2026-08-07 (64): User accepted the Alpha 9 end-of-video screen; recorded D-045 with synchronized replay, local return to video preparation, peer selecting status, and no auto replay/recommendation/next-video behavior
- 2026-08-07 (65): Prepared the next discussion for room creation/join feedback, automatic share timing, expired/full-room invite errors, and late joiners automatically loading existing room media
- 2026-08-07 (66): User accepted room creation/join and late-join behavior; recorded D-046 with navigation-before-share, 8/15-second timing, categorized invite errors, and automatic loading of existing room media
- 2026-08-07 (67): Prepared the next discussion for room presence feedback: waiting alone, peer join notification, peer leave without stopping local playback, rejoin resynchronization, and whether the invitation remains reusable
- 2026-08-07 (68): User accepted room presence and invite reuse; recorded D-047 with non-blocking waiting state, two-second member notifications, uninterrupted playback on peer absence, and automatic resync on rejoin
- 2026-08-07 (69): Code review confirmed the signaling room currently expires 10 minutes after both member connections are gone; prepared the empty-room lifetime and leave-confirmation behavior for user discussion
- 2026-08-07 (70): User accepted the existing 10-minute empty-room expiry; recorded D-048 with local-only leave, reusable credentials during the grace period, expired-invite copy, and no force-dissolve feature
- 2026-08-07 (71): User asked for a categorized count of remaining decisions before development; began consolidating required Alpha 9 freezes, implementation-time choices, P1 reaction work, and later Alpha 10 playlist decisions
- 2026-08-07 (72): Consolidated the remaining inventory: one Alpha 9 core player decision, one non-blocking P1 release gate, five Alpha 10 playlist decisions, and two later Beta/1.0 milestone decisions; marked Alpha 9 wording/loading/error discussion complete and cleaned stale PRD decision statuses
- 2026-08-07 (73): Ran isolated real-page playback probes. Mobile direct pages exposed hidden/fragile video and no usable danmaku; mobile Embed played cleanly but lacked danmaku; desktop direct had full DOM but captcha risk; desktop Embed played both AV and BV fixtures with top-level video, bridge events, and native danmaku.
- 2026-08-07 (74): User requested a first usable Alpha 9 by about 18:00 and promoted light/dark theme switching into P0. Scope was reduced to core usability; reactions, playlist, complex error cards, buffering debounce, and visual micro-polish were deferred.
- 2026-08-07 (75): Implemented and built the first usable Alpha 9 Debug APK. Fifteen unit tests, Lint, and assembleDebug passed; no ADB device was connected, so installation and dual-device QA remain next.
- 2026-08-07 (76): User confirmed the computer cannot connect to the phone and will transfer, install, and test the Alpha 9 APK independently, then return with real-device experience feedback.
- 2026-08-07 (77): Opened Windows File Explorer with `release/tongkan-android-1.0-alpha9.apk` selected so the user can transfer it to the phone.
- 2026-08-07 (78): User returned first physical-device screenshots: entry flow and theme worked, but the UI overlapped the phone cutout, shadows looked unnatural, the player filled the portrait screen, tapping video navigated away, native controls were inaccessible, and landscape could not be reached. User proposed room status above the player and a future chat/interaction area below.
- 2026-08-07 (79): Built Alpha 9.1 with safe-area insets, zero-elevation buttons, centered 16:9 player, online count, blocked Bilibili navigation, hidden click-through overlays, restored controls, and explicit landscape immersive viewing. Real Embed control probe and Android checks passed.

- 2026-08-07 (80): Re-verified `release/tongkan-android-1.0-alpha9.1.apk` and opened Windows File Explorer with the APK selected for manual transfer and physical-device installation.

- 2026-08-07 (81): User asked to see the current UI. Generated and visually checked a code-derived Alpha 9.1 preview covering the room entry and viewing screens; clarified that it is a layout simulation rather than a physical-device screenshot.

- 2026-08-07 (82): User requested visual optimization before further testing. Invoked ui-ux-pro-max, reviewed its mobile professional rules, searched watch-party/minimal utility patterns, touch/safe-area guidance, neutral palettes and media-control icons, and audited the current code-derived preview against the two physical-device screenshots. No new visual decision is accepted yet; recommended direction is pending user confirmation.

- 2026-08-07 (83): User accepted the recommended visual redesign and added a daily rotating classic-film quote as the entry headline. Recorded D-051, updated the Android follow-up PRD and selected design specification, built `design/alpha9-ui/preview-v2.html`, exported four high-fidelity screenshots, and corrected preview-tool width/scale issues until the 430px portrait and landscape layouts rendered without clipping.

- 2026-08-07 (84): User requested more portrait top clearance and rejected the landscape sidebar. Recorded D-052, updated the PRD/design spec, and built `preview-v3.html` with full-screen video, tap-to-show controls, three-second auto-hide behavior, no persistent online status, and a controls-hidden state. Screenshot export was rejected because the local browser escalation approval quota was exhausted, so PNG generation remains pending explicit approval.

- 2026-08-07 (85): User explicitly authorized V3 screenshot export. Four Chrome headless export requests were submitted, but the escalation approval gateway returned HTTP 502 Bad Gateway for each request before execution. No PNG was generated or overwritten; `preview-v3.html` remains the source of truth and export should be retried only after the user is informed of this new gateway failure.

- 2026-08-07 (86): User asked to open the V3 prototype. A default-browser Start-Process request was submitted after the user had been informed of the gateway issue, but the approval service again returned HTTP 502 before execution. The prototype was not opened automatically; manual opening from `design/alpha9-ui/preview-v3.html` is the available path.

- 2026-08-07 (87): User reviewed the prototype and requested a final product audit followed by APK output if no major issue remained. Audit identified the release blocker that V3 exists only in HTML and is not yet in MainActivity; rebuilding now would still show Alpha 9.1. Initial git/diff inspection ran, but additional MainActivity/manifest/style reads were rejected by the approval gateway with HTTP 502. No native changes or APK build occurred.

- 2026-08-07 (88): User explicitly authorized continuing native Alpha 9.2 implementation and build. A resumed read-only MainActivity inspection was attempted immediately, but the approval gateway again returned HTTP 502 before execution. Work cannot safely proceed until the gateway recovers; no source or artifact changed.

- 2026-08-07 (89): Resumed successfully after the gateway recovered, completed the Alpha 9.2 native V3 UI and immersive player integration, synchronized playback icons/progress/buffering behavior, raised Android to versionCode 11 / 1.0.0-alpha.9.2, passed 15 unit tests plus Lint and assembleDebug, and produced `release/tongkan-android-1.0-alpha9.2.apk` (1,400,318 bytes; SHA-256 `96DD1A137A593827126893E34DFD8586411A2A869B72A36CF56DE9F1CBAF7A4C`). Real-device and dual-device QA remain next.

- 2026-08-07 (90): Opened Windows File Explorer with `release/tongkan-android-1.0-alpha9.2.apk` selected for manual transfer to the phone and physical-device installation.

- 2026-08-10 (91): User confirmed Alpha 9.2 passed physical-device testing and requested the GitHub repository be updated for sustainable future releases. Prepared D-053, README/Android documentation, CHANGELOG, RELEASING guide, ignore rules and an automated tag-triggered Android GitHub Release workflow. Verified typecheck, 80 Web/protocol tests, full workspace build, 15 Android tests, Lint and Debug APK assembly.

- 2026-08-10 (92): Published commit `4312b10` and tag `v1.0.0-alpha.9.2` as the first GitHub prerelease, uploaded the automatically built APK plus SHA-256, and updated repository description, homepage and topics. The published GitHub APK SHA-256 is `F43FA9513C364FA85D7899ADE514483F6E625A9A9532138E630C867F67CA600F`.

- 2026-08-10 (93): Repaired the general GitHub CI without changing the immutable Alpha 9.2 tag or Release. Commit `4f4ded7` skips native/non-JS directories when discovering package manifests; commit `a53c9a4` builds `@tongkan/protocol` before live integration tests and supplies Node-only window event shims. Local dependency inventory, typecheck, 80 ordinary tests and live signaling integration passed; GitHub CI run `31352245118` completed successfully.

- 2026-08-10 (94): Updated the GitHub repository homepage for end users. Added prominent online Web and Android APK entry points, four documentation-only Alpha 9.2 screenshots covering entry/light/dark/immersive landscape states, step-by-step Android and Web instructions, and a capability table clarifying that mobile Web Bilibili playback is local-only while full phone Bilibili sync uses the Android App. Verified all relative README paths and confirmed the deployed Web page returns HTTP 200.

- 2026-08-10 (95): User rejected the old README multi-image composition and requested an overall Web UI redesign. Created `design.md`, accepted D-054, replaced the old warm-orange tokens with the Android-aligned light-first neutral system, added persisted theme switching and a non-destructive redesign layer for Home/Join/Room, generated `docs/images/tongkan-alpha9.2-showcase.png`, and updated README/document maps. Visual browser QA passed for light/dark Home, Join and media-first Room with no console errors. Workspace typecheck, 80 tests, Web build and full build all passed. Changes remain local pending user review; no commit, push, release tag change or deployment occurred.

- 2026-08-10 (96): User approved the completed README and Web UI redesign for commit. Prepared one focused local commit containing the shared design system, theme switching, page restyling, accessibility corrections, unified README product board and context/decision documentation. Push and Cloudflare Pages deployment remain separate explicit actions.

- 2026-08-10 (97): User explicitly requested pushing the approved redesign to GitHub. Updated the handoff state, amended the focused redesign commit to include the final push record, and pushed `master` to `origin`. Cloudflare Pages deployment remains a separate pending action; no release tag or APK changed.

- 2026-08-10 (98): User explicitly requested updating the Cloudflare Pages production Web site. The broad `deploy:cloudflare` command was rejected because it would also redeploy the signaling Worker, so a safer Pages-only production build was used with same-origin HTTPS/WSS settings. Re-deployed from `apps/web` to include the existing Functions service-binding proxy; final deployment URL is `https://3bd77a10.tongkan-personal.pages.dev`. The canonical `https://tongkan-personal.pages.dev` shows the redesigned light-first UI. Production smoke testing created temporary room `74fc20c2a51d2c1702b6b67f48302855` and confirmed the WebSocket reached 鈥滄埧闂村凡杩炴帴鈥?with no browser warnings or errors. No signaling Worker source, Android APK or release tag changed.

- 2026-08-10 (99): User requested making the GitHub repository public. Scanned all tracked history for common GitHub/OpenAI/AWS/Cloudflare token formats, private-key markers, credential filenames and keystores; no credential patterns were found. Noted that public history will expose the auto-configured commit email `dengbingmei@game.ntes` and one tracked local username path. Opened GitHub Settings in the user鈥檚 logged-in Edge session, confirmed the repository was Private, accepted the public-visibility impact confirmations, and reached GitHub sudo mode. GitHub sent a verification code to `d************@gmail.com`; the visibility change is pending that code and the repository remains Private.


- 2026-08-10 (100): GitHub repository `dengbingmei24-web/tongkan` was successfully changed to Public and independently verified as accessible without authentication. The user later supplied the email verification code, but no further entry was needed because the visibility change had already completed; the code itself was not retained in project files. Updated the handoff state; no code, release tag, APK, deployment or Git history changed.

- 2026-08-10 (101): User requested a concise resume-ready project description demonstrating Vibe Coding ability. Drafted a two-line entry emphasizing the AI-assisted end-to-end delivery of Tongkan across native Android, React Web and Cloudflare Durable Objects, including synchronized Bilibili playback and public demo/repository availability. No code, deployment, release or product decision changed.

- 2026-08-10 (102): User asked whether the Web version can support synchronized viewing without installing the browser extension. Reviewed the current React embed, direct-video controller, extension all-frame injection and product constraints. Confirmed that reliable two-way control of the cross-origin Bilibili iframe is not available to the normal page; no-extension options are true synchronization for CORS-compatible direct video links or host-controlled WebRTC tab screen sharing for Bilibili. Recommended presenting two explicit modes and improving the no-extension screen-sharing flow before considering brittle private-player reverse engineering or media proxying. Product choice remains pending user confirmation; no code or deployment changed.


- 2026-08-10 (103): User accepted the recommended no-extension Web fallback. Recorded D-055 and implemented a desktop Bilibili player overlay with 鈥滄棤闇€鎵╁睍鍏变韩瑙傜湅鈥? a three-step browser-tab/audio guide, one-click `getDisplayMedia`, adaptive room status/action copy and removal of unusable playback controls during host-controlled sharing. Updated `PRD.md`, `README.md`, `design.md`, `DECISIONS.md` and mobile capability tests. Web typecheck, all 16 tests and the production build passed. Connected-room visual QA was attempted but the local preview environment hit an occupied Vite port and the known Wrangler Chinese-path restriction; no source failure occurred. Changes remain local and are not committed, pushed or deployed.

- 2026-08-10 (104): User explicitly requested committing, pushing and updating Cloudflare Pages. Committed the D-055 feature/docs/tests as `ece55c0 feat(web): add no-extension Bilibili sharing` and pushed `master` to GitHub. Built the Web with canonical HTTPS/WSS settings. Initial deployments `d1c21ad9` and `436cedfa` were correctly identified as Preview because the Pages production branch is `main`; then deployed with `--branch main`, producing production deployment `f71c6cf2`. Verified the canonical site loads asset `index-CJM37Qlg.js`, created temporary room `a07c14b27ccc3859a0dc9956405021d3`, confirmed 鈥滄埧闂村凡杩炴帴鈥? Bilibili embed loading, the 鈥滄棤闇€鎵╁睍鍏变韩瑙傜湅鈥?CTA, three-step tab/audio guide, 鈥滄湭瀹夎 路 鍙叡浜鐪嬧€?status and updated control ownership copy. No signaling Worker, Android APK or release tag changed.

- 2026-08-10 (105): User confirmed the no-extension Web sharing implementation, GitHub push and Cloudflare Pages deployment phase is complete. No further action was requested; the next project work should begin from normal-use feedback rather than continuing this deployment thread. No code, deployment, release or long-term decision changed.

- 2026-08-10 (106): User requested releasing viewing controls from the top-right overflow menu and asked for multiple design previews before implementation. Reviewed `MainActivity.java` and confirmed the overflow menu contains change-video, theme and leave-room while danmaku, speed, landscape and fullscreen already exist but may fall below the first visible screen. Used the UI/UX design skill guidance to create three high-fidelity alternatives: A persistent two-row controls (recommended), B bottom safe-area dock and C labelled bottom sheet. Exported and visually checked the combined comparison, recommended light/dark portrait and immersive landscape PNGs. No Android source, APK, release tag, PRD or accepted decision changed; user selection is pending.

- 2026-08-10 (107): User selected viewing-control option A. Recorded D-056, superseding the viewing-page portions of D-012 and D-051, and synchronized the Android PRD, selected design and QA checklist. Implemented Alpha 9.3 in native Java: removed the overflow menu and unused `ic_more`, placed play/danmaku/speed/landscape/fullscreen in a compact persistent first row, added direct change-video and light/dark theme actions in a second row, retained Back-to-confirm-leave, and added `ic_video`. Bumped to versionCode 12 / versionName 1.0.0-alpha.9.3. A clean isolated build passed 15 unit tests, Android Lint with 0 errors and 7 existing/non-blocking warnings, and Debug APK assembly. Produced `release/tongkan-android-1.0-alpha9.3.apk`, 1,402,937 bytes, SHA-256 `9571DF61F24AA73AE440C6ED5565E6B3B02D2A8CE2B08953E33BFD73B632ED7C`. Physical-device verification is still required; no commit, push, tag or GitHub release was created, and published Alpha 9.2 remains unchanged.
- 2026-08-11 (108): User reported that Alpha 9.3 could load and play Bilibili video, but the native buttons below the player were missing and the page showed blank space. Traced the issue to `showPreparationPanel()` setting `videoFooter` to `GONE`; the video-loading paths made `playerContainer` visible without restoring the footer. Added `syncVideoFooterVisibility()` and invoked it on video load, room-media application, viewing-screen entry, preparation-screen transitions and fullscreen transitions. Bumped Android to versionCode 13 / versionName `1.0.0-alpha.9.3.1`. Isolated Android validation passed: 15 unit tests, Lint 0 errors with 7 non-blocking warnings, and Debug APK assembly. Produced `release/tongkan-android-1.0-alpha9.3.1.apk` (1,400,383 bytes; SHA-256 `1ACCACA261AFB54D4819CF6A4F9E0F253E33EE2108075B0BB49FEFB85E7434C8`). No commit, push, tag or GitHub release was created; physical-device retest is pending.
- 2026-08-11 (109): User installed `release/tongkan-android-1.0-alpha9.3.1.apk` and confirmed the missing portrait control buttons are visible again after video loading. The footer visibility fix is accepted. No commit, push, tag or GitHub release was requested; continue from remaining Alpha 9.3.1 usability feedback and release discussion.

- 2026-08-11 (110): User confirmed no further interface optimization is needed for now and explicitly requested a local commit. Staged the accumulated Alpha 9.3.1 Android source, icon changes, design previews and synchronized project documents, then created commit `3fa5156` with message `feat(android): fix alpha 9.3 viewing controls`. No push, tag or GitHub release was performed.
- 2026-08-11 (111): User asked what should be developed next and confirmed that visual interface optimization is paused. Reviewed the current context and Android follow-up PRD. Recommended the next order: release-gate two-device regression and stabilization, optional push/release of verified Alpha 9.3.1, Alpha 9 P1 interactive reactions, then Alpha 10 persistent local playlist. No code or product decision changed.
- 2026-08-11 (112): User selected P0 as the next development phase. Audited the Android playback path and implemented the first P0 stabilization slice in Alpha 9.3.2: 2-second buffering debounce, one buffering and one recovery report per episode, cancellation on short recovery/media switch/room leave, and a visible hard-sync notice for drift above 1.5 seconds. Updated the Android follow-up PRD and added QA section 7.1. Android validation passed: 15 unit tests, Lint 0 errors with 7 non-blocking warnings, and Debug APK assembly. Produced `release/tongkan-android-1.0-alpha9.3.2.apk` (1,447,668 bytes; SHA-256 `41663F1D92BF1BDD7E8D94158E0D850DFEC59E4F10F47A944640BF8A053B861C`). Two-device physical verification and the remaining P0 recovery/completion work are pending; no commit, push, tag or release was created.
- 2026-08-11 (113): User accepted the first Alpha 9.3.2 P0 stabilization batch and test plan. No additional code, commit, push, tag or release action was requested. The next action is physical two-device verification using QA section 7.1, followed by the remaining P0 error-recovery and playback-completion work.
- 2026-08-11 (114): Opened Windows File Explorer with `release/tongkan-android-1.0-alpha9.3.2.apk` selected so the user can transfer and install it for physical two-device P0 verification. No code, commit, push, tag or release changed.
- 2026-08-11 (115): User provided a 73.63-second Alpha 9.3.x Android test recording for review. Single-device audit confirmed the room flow, automatic share, Bilibili playback, danmaku display, manual landscape, portrait return, theme switch and system sharing path. Findings: approximately 10鈥?1 seconds of black/paused loading without a clear progress/retry state; Bilibili native controls remain visible beside the app footer and the prior jump-to-page issue was not reproduced; landscape itself is horizontal and portrait-recording black space is mostly expected, but playback was paused after the rotation back to portrait and requires focused regression; no two-device P0 synchronization behavior can be certified from this recording. No code or release artifact changed.
- 2026-08-11 (116): User prioritized fixing duplicate Bilibili/App controls and top-level webpage navigation risk. Built Alpha 9.3.3: an App-owned transparent layer intercepts video taps in portrait and immersive viewing; portrait taps toggle playback through the bridge, immersive taps only toggle App controls; Bilibili native control, center-button, ending/recommendation and related overlay selectors are hidden while video/danmaku remain; immersive auto-hide uses 2.8 seconds and the center button is visible only while paused/ended; WebView blocks user-gesture main-frame navigation while allowing player subframes and trusted non-gesture loading. Updated Android PRD and QA section 7.2, bumped versionCode 15/versionName 1.0.0-alpha.9.3.3, passed bridge syntax validation, 15 unit tests, Lint 0 errors/7 warnings and Debug assembly. Produced `release/tongkan-android-1.0-alpha9.3.3.apk` (1,401,551 bytes; SHA-256 A945C48845442B437EF15CC81A642BFCD8B32C94549050273EB85B43DFE34897). Physical verification remains pending; no commit, push, tag or release was created.
- 2026-08-11 (117): User asked to batch any remaining high-value improvements before testing. Added Alpha 9.3.4 room-video slow-load feedback: 8-second status and 20-second recoverable change-video retry without forcing connected rooms back to preparation. Added orientation-state protection: record whether playback was active before manual rotation, restore playing state after layout settles, and ignore the transient rotation pause for about 1.2 seconds so it is not broadcast as a room pause. Added bridge `__tongkanSetPlaying`, QA section 7.3 and PRD section 16.11, bumped versionCode 16/versionName 1.0.0-alpha.9.3.4. Passed bridge syntax validation, 15 unit tests, Lint 0 errors/7 warnings and Debug assembly. Produced `release/tongkan-android-1.0-alpha9.3.4.apk` (1,402,067 bytes; SHA-256 `F9594BB03A4DFCADC3175406338819E092B85AB74036A28C3676321C0A17CE8A`). Physical verification remains pending; no commit, push, tag or release was created.
- 2026-08-11 (118): User reported that the opaque black bottom bar in landscape/fullscreen was too prominent and requested a transparent control layer showing only progress and controls. Accepted D-057, changed the immersive bottom container to transparent while retaining independent button surfaces, updated the selected design, PRD section 16.12 and QA section 7.4, bumped versionCode 17/versionName 1.0.0-alpha.9.3.5. Passed 15 unit tests, Lint 0 errors/7 warnings and Debug assembly. Produced `release/tongkan-android-1.0-alpha9.3.5.apk` (1,402,047 bytes; SHA-256 `885AE8A1C4AA0659F7C9A07D7411BDCFF25188D64391CC6CB4388885CF7D9DD1`). Physical verification remains pending; no commit, push, tag or release was created.
- 2026-08-11 (119): Re-checked the user's transparent landscape/fullscreen control request against the current worktree. Confirmed the immersive bottom container is fully transparent while the progress bar, time text and independently surfaced action buttons remain available; Alpha 9.3.5 APK and SHA-256 remain unchanged. No additional source change, commit, push, tag or release was made; physical verification is the next step.
- 2026-08-11 (120): User established a permanent APK test-delivery workflow: whenever a newly built Android package requires installation or physical-device testing, automatically open the `release/` folder and select the exact APK rather than only providing its path. Opened Windows File Explorer with `release/tongkan-android-1.0-alpha9.3.5.apk` selected, recorded D-058, and added the operational rule to `AGENTS.md`. No code, APK, commit, push, tag or release changed.
- 2026-08-11 (121): User reported audio playback without visible video in Alpha 9.3.5. Live Bilibili DOM inspection confirmed `.bpx-player-video-perch` directly contains the real `<video>` and had been mistakenly included in the hidden native-control selector list. Removed only that selector, retained navigation/native-control suppression, added QA section 7.5, bumped to versionCode 18/versionName 1.0.0-alpha.9.3.6, passed bridge syntax and live-DOM checks, 15 unit tests, Lint 0 errors/7 warnings and Debug assembly, produced `release/tongkan-android-1.0-alpha9.3.6.apk` (1,402,039 bytes; SHA-256 `D148D582E934514EDAA6F2E6F9789A6E983A8EFD8F9886B415352DF9109B67E3`), and automatically opened the APK. User then physically confirmed picture playback works. Quality investigation found anonymous Bilibili Embed remains at Auto(360P), including with quality/qn URL overrides; optional official Bilibili login is the pending real-quality solution. No commit, push, tag or release was created.
- 2026-08-11 (122): User asked whether Tongkan can add phone-number accounts and let users sign into Bilibili inside the App so each viewer can select higher quality. Architecture review separated two independent systems: a Tongkan account would require SMS OTP, persistent user storage, sessions, abuse controls, privacy/deletion flows and would supersede D-002; it does not itself unlock Bilibili quality. The recommended first step is an optional official Bilibili login in a separate WebView with no JavaScript bridge, local-only Bilibili cookies, no credential interception or server upload, and per-device highest-available quality selection. General viewer OAuth/session-cookie support is not clearly documented as a public Bilibili API, so unofficial login APIs and sharing one Bilibili session between users are rejected. No code, PRD, accepted decision, APK, commit, push, tag or release changed.
- 2026-08-11 (123): User explicitly chose the Tongkan account system before Bilibili quality work and expanded the product into a persistent two-person space: phone-number login, exactly one active friend per user, pair watch history, monthly watch duration, a calendar for planned videos and actual viewing records, daily planned-watch lists, and a categorized long-term library. Accepted D-059 through D-062, superseded D-002, created `ACCOUNT_PAIR_SPACE_PRD.md`, and updated the root PRD, Android follow-up PRD and project context. Recommended four Android destinations are Home, Library, Calendar and Us, with the watch page remaining immersive and separate. Proposed a new account Worker with D1 while preserving the existing signaling Durable Objects. No account code, database, SMS provider, APK, commit, push, tag or release was created; unbind/data ownership, anonymous fallback and SMS provider remain pending decisions.
- 2026-08-11 (124): User asked whether WeChat login can replace phone-number SMS login for the planned Tongkan account system. Feasibility review concluded that Android WeChat OpenSDK authorization plus server-side code exchange is viable and removes the SMS-provider dependency, but it requires a WeChat Open Platform mobile-app registration/review, AppID/AppSecret, stable package name and Release signature; AppSecret must remain in Cloudflare secrets. WeChat login does not expose a WeChat friend list, so Tongkan's one-friend relationship must still use its own invite/link/QR binding. No final authentication decision, PRD replacement, code, APK, commit, push, tag or release was made.

- 2026-08-11 (125): User asked what 鈥渉aving or applying for a WeChat Open Platform account as an individual鈥?means. Clarified that the Open Platform account is a developer console account and the 鈥渟ubject鈥?is the legal owner of the app, not an ordinary WeChat user. Corrected the earlier wording: an ordinary natural person with only an ID card should not be assumed eligible for mobile-app WeChat Login; the practical route generally requires developer qualification plus eligible company, organization or individual-business materials shown by the current Open Platform console. Therefore WeChat login may be unsuitable for this personal project unless the user has such a subject. No product decision, PRD replacement, code, APK, commit, push, tag or release was made.

- 2026-08-11 (126): User accepted email one-time-code login for Alpha 10 so the project does not depend on WeChat Open Platform review. Accepted D-063 and synchronized `AGENTS.md`, `ACCOUNT_PAIR_SPACE_PRD.md`, `PRD.md`, `ANDROID_FOLLOWUP_PRD.md`, `PROJECT_CONTEXT.md`, `DECISIONS.md` and `CONTEXT.md`. The account model now uses normalized email HMAC indexes, masked email display, `email_challenges`, five-minute codes, resend/attempt/IP/device rate limits, Keystore-protected sessions and a planned transactional email or SMTP/API provider stored in Cloudflare secrets. Phone SMS and WeChat login are not Alpha 10.0 dependencies. No account code, provider configuration, APK, commit, push, tag or release was created.

- 2026-08-11 (127): User selected QQ Mail as the Alpha 10 verification-code sender and confirmed that anonymous temporary rooms must remain available. Accepted D-064 and D-065, updated the account PRD, root PRD, Android follow-up PRD, project context and development context. QQ Mail is only the sender: users may register with any deliverable email address. The server must use an SMTP authorization code stored in Cloudflare secrets, never the mailbox password, and expose a replaceable mail adapter so provider changes do not affect the login API. Anonymous users retain current create/join room capabilities but cannot access cloud friend, library, calendar, history or statistics. No account code, SMTP credential, APK, commit, push, tag or release was created.

- 2026-08-11 (128): User confirmed that either friend may unbind unilaterally and that library, calendar and history retention should be user-controlled after unbind. Accepted D-066 and specified privacy-safe ownership: unbinding immediately releases both users from the active one-friend constraint and freezes the old pair space; each user independently chooses `keep` or `delete`, retained data is read-only, one user cannot delete the other user鈥檚 archive, and physical deletion occurs only after both choose delete. Updated the account PRD, root PRD, Android follow-up PRD, project context, decision log and development context. No account code, migration, API, APK, commit, push, tag or release was created.

- 2026-08-11 (129): User confirmed a fully shared pair library and built-in-only avatars, with avatar images to be supplied later, and asked to model joint-watch duration after NetEase Cloud Music together-listening time. Public material did not expose a precise official NetEase calculation formula, so Tongkan accepted D-067 through D-069 using a transparent server-verifiable equivalent: both paired users must be in the same pair-linked room, online, ready and actually playing; count overlapping wall-clock time only, exclude pause/buffering/offline/anonymous intervals, do not alter totals for seek, and count speed playback by real elapsed time. Updated the account PRD, root PRD, Android follow-up PRD, project context, decisions and development context. Proposed calendar first version as required date plus optional start time and optional note, with notifications and recurrence deferred; user confirmation is pending. No code, avatar assets, migration, APK, commit, push, tag or release was created.

- 2026-08-11 (130): User requested a 45-second, 16:9 Chinese product-promo video using HyperFrames, the current repository and the live product website, with preview only and no direct render. Installed/refreshed the HyperFrames workflow, captured `https://tongkan-personal.pages.dev/` (3 screenshots, 8 assets, Geist/JetBrains Mono), audited and adopted six real product images, and created `videos/tongkan-promo` with `BRIEF.md`, `frame.md`, `ASSET_AUDIT.md`, a six-frame `STORYBOARD.md`, six seek-safe sub-compositions and a 45-second master timeline. `npm run check` passed with lint/runtime/layout/motion at 0 errors and 0 warnings plus 25/25 WCAG AA text checks; 17 midpoint/transition snapshots were reviewed with no black frames or missing mounted styles. HyperFrames Studio is running at `http://localhost:4317/#project/tongkan-promo` (PID 27008). No MP4/MOV/WebM was generated, and no commit, push, tag, deployment or release was created.

- 2026-08-11 (131): User accepted the proposed Alpha 10.3 calendar fields. Accepted D-070: every watch plan requires a date, while start time and note are optional; plans without a time display as “当天”, timed plans sort chronologically before untimed plans, and notifications/reminders plus recurring plans are deferred. Updated the account PRD, root PRD, Android follow-up PRD, project context, decision log and development context while preserving the parallel completed HyperFrames promo-preview status. No code, database migration, notification implementation, APK, commit, push, tag or release was created.

- 2026-08-11 (132): Cleaned up the previous HyperFrames preview/calibration process tree rooted at PID 27008, reconfirmed that `videos/tongkan-promo` contains no MP4/MOV/WebM/MKV render artifact, and restarted the preview service hidden on `http://localhost:4317/#project/tongkan-promo` with root PID 21620. The HTTP endpoint returns 200; Studio was not automatically opened, and no render, commit, push, tag, deployment or release was created.

- 2026-08-11 (133): User requested three Apple-inspired redesign references for the entire Android App before implementing Alpha 10 account and pair-space features. Applied the Hallmark redesign workflow and Apple HIG principles without copying Apple product pixels. Created `design/alpha10-ui/options.html` and `OPTIONS.md` with synchronized comparison across login, home, library, calendar and Us, global light/dark switching and three structurally distinct directions: A Air (native system clarity), B Cinema (black media-led stage) and C Together (warm relationship-led space). Exported `options-home-light.png`, `options-login-light.png`, `options-library-light.png`, `options-calendar-dark.png` and `options-us-light.png`; browser QA confirmed all three 390x844 phone canvases fit without internal overflow. Fixed an SVG sizing collision in the library search field. Indexed the new design source in `PROJECT_CONTEXT.md`. Preview server is running at `http://127.0.0.1:4319/options.html` with PID 33896. No option has been accepted, no production Android code or selected-design document changed, and no APK, commit, push, tag or release was created.

- 2026-08-11 (134): User chose to retain all three Alpha 10 color systems but rejected the existing button and component styling, explicitly requesting a redesign informed by UI design skills and shadcn/ui. Applied Hallmark and UI UX Pro Max guidance, reviewed shadcn Button/Tabs composition principles, accepted D-071, and rebuilt the preview as `options-shadcn.html` + `options-shadcn.css` + `options-shadcn.js` while preserving `options.html` as the public local entry. Unified button variants, 46px action height, restrained 11-14px radii, light borders, limited elevation, labelled inputs, Tabs, fixed bottom navigation, bottom Drawer, Toast, pressed, disabled, loading and success states. Retained Air blue-gray, Cinema neutral black/warm-gold and Together warm-apricot/purple palettes with full light/dark support. Re-exported five comparison screenshots. Browser QA found no JavaScript errors; all three 376x830 visible phone areas fit without internal overflow; live interaction checks passed for `正在创建房间…` to `房间已创建`, Drawer open/confirm and saved feedback, and dark studio background `rgb(12, 13, 16)`. Production Android UI remains unchanged. The remaining design decision is whether the three palettes ship as full user-selectable themes or are assigned by page role.

- 2026-08-11 (135): User selected A · Air and requested another visual pass because the buttons still felt flat, asking for research into strong interface examples. Reviewed current official platform guidance and UI UX Pro Max tactile/elevation patterns, then accepted D-072. Air is now the sole page structure; Cinema and Together remain as black-gold and warm-apricot palette switches on the same Air UI, with blue-gray light as default. Reworked primary buttons with a restrained vertical gradient, top highlight, bottom edge, near shadow and theme-colored far shadow; pressed state descends 2px and compresses the shadow. Added separate depth rules for outline/destructive buttons, icon buttons, relationship cards, inputs, selected bottom-navigation items and Drawer, while keeping ordinary lists flat. Replaced temporary status-bar text glyphs with SVG. Changed the preview from three simultaneous phones to one selected Air phone and added page/palette/light-dark controls. During final audit, identified that the iPhone Dynamic Island mockup was inappropriate for an Android product, and replaced it with a neutral Android punch-hole frame, thinner bezel and Android-oriented safe area. Created `design/alpha10-ui/SELECTED_DESIGN.md` as the Alpha 10 production UI truth source, updated `OPTIONS.md`, `PROJECT_CONTEXT.md`, `DECISIONS.md` and `CONTEXT.md`, and refreshed all five screenshots. Browser QA passed all 30 page/palette/theme combinations with no JavaScript errors or content overflow; computed-style verification confirmed the primary button changes from layered resting shadow to translated/shrunken pressed shadow. Android production code and APK remain unchanged.

- 2026-08-11 (136): User rejected the previous Air direction as visually dated and explicitly requested a full restart using relevant UI design skills, with a technological yet breathable visual language and complete black/white themes. Applied Hallmark and UI UX Pro Max mobile rules, created the Breath Tech system in `breath-tech.html/css/js`, and kept `options.html` as the preview entry. Rebuilt login, home, shared library, calendar and Us around precise status codes, subtle grid/light fields, connection tracks, neutral monochrome surfaces, edge-to-edge lists and cold-blue focus signals. Removed the old production dependence on three palettes and tactile gradient buttons; primary controls now use monochrome reversal, 80-150ms press feedback, disabled loading state and success Toast. Fixed dark studio contrast, double-avatar positioning and all sub-44px controls. Browser QA passed 5 pages × 2 themes with no JavaScript errors, content overflow or undersized touch targets; live checks passed for create-room loading, duplicate-click disable, success Toast, Drawer, navigation and theme switching. Refreshed all five preview screenshots, accepted D-073, updated `SELECTED_DESIGN.md`, `OPTIONS.md`, `PROJECT_CONTEXT.md`, `DECISIONS.md` and `CONTEXT.md`. Android production code, APK, commit, push and deployment remain unchanged.

- 2026-08-11 (137): User approved the Breath Tech visual direction. Marked visual review complete and created `design/alpha10-ui/ANDROID_IMPLEMENTATION_PLAN.md`, defining native Java View boundaries, Theme/Drawable/Component foundations, Auth/Home P0 shell, Library/Calendar/Pair P1 pages, player migration constraints, implementation order and first-slice acceptance criteria. Updated the selected-design document, project document index and context. No Android production code, APK, commit, push or deployment was created in this confirmation turn.

- 2026-08-11 (138): User instructed direct P0 Android Java View development. Preserved the existing worktree with safety stash `codex-safety-alpha10-p0-20260811-172753`, completed Breath Tech native foundations and connected Auth/Home/four-tab navigation into `MainActivity` without changing the proven room, WebView, WebSocket or protocol paths. Fixed the icon-button minimum-size compile issue, updated Android to versionCode 19 / `1.0.0-alpha10.0-p0.1`, passed unit tests, Lint and Debug assembly, copied the APK to `release/tongkan-android-1.0.0-alpha10.0-p0.1.apk`, recorded SHA-256 `B1DE9AB9DA58BC0898E6787C0EE7D9334194C271BD71F23208EF2BB26F426BE0`, and opened Explorer with the artifact selected. Real-device UI and Alpha 9.3.6 player regression remain pending.

- 2026-08-13 (139): User requested the current APK. Confirmed `release/tongkan-android-1.0.0-alpha10.0-p0.1.apk` is still the latest Android test artifact, verified SHA-256 `B1DE9AB9DA58BC0898E6787C0EE7D9334194C271BD71F23208EF2BB26F426BE0`, and opened Explorer with the APK selected for installation. No code, build, version, commit, push or deployment changed.

- 2026-08-13 (140): User confirmed all Alpha 10 P0.1 real-device tests passed and asked for the subsequent development order. Promoted `1.0.0-alpha10.0-p0.1` to the physically verified Android UI baseline. The recommended critical path is: freeze P0 baseline; validate QQ SMTP; build Account Worker/D1 and secure auth APIs; connect Android AccountClient/Keystore session and complete real email login; then deliver unique friend binding, shared library, calendar, history/statistics, and only afterward migrate player responsibilities and run full two-device regression. No code, build, commit, push or deployment changed in this turn.

- 2026-08-13 (141): User requested committing the accepted P0 baseline and immediately starting QQ SMTP validation plus the Account Worker/D1 skeleton. Committed `e577b23 feat(android): establish alpha 10 p0 baseline`, excluding the unrelated untracked `videos/` directory. Created production and preview D1 databases, applied `0001_auth.sql`, implemented the independent account Worker with hashed email/code/session storage, QQ SMTP 465 adapter and authentication APIs, passed five unit tests and a complete local HTTP login/refresh/logout flow, and passed full workspace typecheck, 86 tests and builds. Verified `smtp.qq.com:465` locally with TLS 1.3 and from a temporary Cloudflare HKG scheduled Worker, which received a QQ Mail `220` greeting in 1,162 ms; deleted the temporary probe and table afterward. Recorded D-074. Real SMTP AUTH/delivery and Android account integration await a dedicated QQ sender mailbox and authorization code. The account skeleton remains uncommitted unless the user explicitly requests another commit.

- 2026-08-13 (142): Completed the post-scaffold account security review. Fixed the Account Worker SMTP adapter to the verified QQ 465 implicit-TLS route only, removed the unverified STARTTLS runtime branch, made verification-code consumption atomic in D1, added a consumed-code regression test, and minimized `pnpm-lock.yaml` to the single required `apps/account` importer. Account typecheck, six tests and Worker dry-run passed; full workspace typecheck, 87 tests and builds passed. The P0 baseline remains committed as `e577b23`; the account skeleton and documentation remain intentionally uncommitted, `videos/` remains excluded, and no push or deployment occurred. Real SMTP AUTH/delivery still awaits a dedicated QQ sender mailbox and authorization code.

- 2026-08-13 (143): Continued Alpha 10 by implementing the Android account client slice without waiting for QQ SMTP credentials. Added a configurable HTTPS `AccountClient`, JSON account models, Android Keystore AES-GCM `SessionStore`, two-stage email-code AuthScreen, session restore/refresh/logout, logged-in Home/Us states, and explicit anonymous fallback. Incremented the development candidate to `1.0.0-alpha10.0-p0.2` / versionCode 20. Clean Android tests, Lint and APK assembly passed with 17 tests, 0 errors and 10 warnings; full workspace typecheck, 87 tests and builds passed. Generated `release/tongkan-android-1.0.0-alpha10.0-p0.2.apk` (SHA-256 `C4E977D9CC24A6824DC1E991D753348B95178890FA0C88B28BFD0B87FE01870C`). The artifact intentionally has no account origin and therefore tests UI/anonymous fallback only. Account Worker code, Android changes and docs remain uncommitted; no push or deployment occurred; `videos/` remains excluded.

- 2026-08-13 (144): User confirmed the `1.0.0-alpha10.0-p0.3` preview account APK passed real-device testing, including login, displayed test code, secure session recovery, logout and anonymous/player regression. Promoted the preview login loop to the physically verified Alpha 10.0 account baseline.

- 2026-08-13 (145): Started Alpha 10.1 immediately after the confirmed account baseline. Added the unique-friend D1 schema, invite hashing and 24-hour expiry, replacement-code invalidation, atomic active-pair uniqueness, create/accept/query endpoints and Android Us-page integration. Account tests reached 12, Android tests reached 18, Lint had 0 errors, and full workspace reached 93 passing tests. Applied preview migration `0002_pairing.sql`, deployed preview Worker version `66c764f9-eb74-4935-849a-41cc7fde123f`, verified reciprocal pair data for two fresh online accounts, and confirmed a replaced invite is rejected while the new code succeeds. Built `release/tongkan-android-1.0.0-alpha10.1-p0.1.apk` with SHA-256 `2ECCEDFE6187C31B61B4B9D2952963C6BF1832CAEE4C3477D5F0638DAAFFB079`; code remains uncommitted and `videos/` remains excluded.
- 2026-08-13 (146): User reported not receiving the email verification code. Confirmed the released `1.0.0-alpha10.1-p0.1` APK is configured for the isolated Pages `/account-api` preview Worker with a test access token. Confirmed online `POST /api/auth/send-code` returns `debugCode` and `AUTH_TEST_MODE=true` uses `NoopMailer`, so no email is sent by design. No code or deployment changed; real QQ SMTP remains the next release-blocking step.
- 2026-08-13 (147): User agreed to complete real email delivery. Confirmed production `tongkan-account` did not exist, created it through production secret setup, generated and stored `EMAIL_HMAC_SECRET`, `AUTH_SECRET` and `SESSION_SECRET` without printing values, and applied production D1 migration `0002_pairing.sql`. Production SMTP credentials, Pages binding switch, real delivery verification and a clean APK remain pending; no SMTP secret was requested or exposed in chat.

---

Maintenance rules:
- Mandatory: update `CONTEXT.md` before ending every conversation, regardless of whether code changed
- Mark completed with [x], new with [ ]
- Critical decisions in Known Issues or Architecture Decisions
- Build artifacts (APK path, SHA-256) in corresponding Completed entries
- Update the follow-up PRD whenever a product decision is agreed with the user


- 2026-08-13 (148): User supplied QQ SMTP credentials for the temporary production verification. Deployed production `tongkan-account` version `2a2aa2d2-f8c2-4f30-8ac2-7ce212ce59bf`, switched Pages `/account-api` to the production Worker, and verified health reports `testMode: false`. After the 60-second resend limit, a real send-code request to `28***@qq.com` returned HTTP 202 with no `debugCode`, confirming the Worker accepted the SMTP delivery path; inbox arrival remains user-confirmed. Built and opened `release/tongkan-android-1.0.0-alpha10.1-p0.2.apk` with production account origin, empty test token, passed Android tests/Lint/assemble, SHA-256 `521EAFA140FD7A20DC65B2561220FA43F8E40262472D33C66D5756D4A9319168`. Because the SMTP authorization code was exposed in chat, it must be rotated after this verification and replaced in Cloudflare Secret. No commit or push was made.
- 2026-08-13 (149): User confirmed the production Android candidate can receive the real QQ verification email and complete login. This closes the real email-login blocker for Alpha 10.1 P0.2. No code or deployment changed; the next validation is two-account unique-friend pairing and session recovery. The exposed SMTP authorization code still must be rotated after testing. No commit or push was made.
- 2026-08-13 (150): User reported that reopening the app stayed on the login screen for a long time while restoring the account. Root cause was startup showing `AuthScreen` and waiting for network `me/refresh` before rendering the authenticated home. Changed `MainActivity.restoreAccountSession()` to render the cached authenticated entry screen immediately, keep network validation in the background, silently ignore non-authentication network failures, and still clear the session and require login on explicit authentication failure. Built and opened `release/tongkan-android-1.0.0-alpha10.1-p0.3.apk` (versionCode 24), SHA-256 `7182155CF75B7BD3214EC5574143D667BE5EF9D4F1D66EE462BED3E2835A1FB4`; Android unit tests, Lint and assemble passed. No commit or push was made.
- 2026-08-13 (151): User confirmed two-person binding works and requested a one-tap invitation flow similar to Douyin一起看. Added `邀请一起看` to the bound-friend Us page; clicking it reuses the existing room creation path, then `pendingAutoShare` opens the Android system share sheet after the host connects. The friend can open the shared `/room/{roomId}#join={inviteKey}` deep link to enter the room. Built and opened `release/tongkan-android-1.0.0-alpha10.1-p0.4.apk` (versionCode 25), SHA-256 `31EAA3F867BE4BF3C1706B60C5F435965610EADDF1B17489884F9FA2AA992F1F`; Android unit tests, Lint and assemble passed. No commit or push was made.

- 2026-08-13 (152): User requested device notification tokens and push service for bound-friend one-tap invitations. Added `0003_device_tokens.sql`, `DeviceTokenRecord`, encrypted token storage with HMAC lookup, registration/unregistration endpoints, logout revocation, provider abstraction with optional webhook adapter, and `/api/pair/watch-invites` with pair authorization, Tongkan room URL validation, expiry and fallback reporting. Added Android `PushTokenProvider`/`NoopPushTokenProvider`, AccountClient models and calls, and notification-first/system-share-fallback orchestration. Account Worker typecheck, 15 tests and dry-run build passed; Android unit tests, Lint and assembleDebug passed in `C:\tmp\android-build\project`. No remote migration, deployment, commit, push or release APK was created. Real notifications remain blocked on choosing/configuring FCM, Huawei Push or a trusted provider; the current No-op provider intentionally generates no fake token or notification.
- 2026-08-13 (153): Continued the device-notification rollout. Applied production D1 migration `0003_device_tokens.sql` to `tongkan-account`; deployed Worker version `fa0d8a5a-dced-442d-8dfc-952bcef6cfed`; verified Pages `/account-api/health` returns HTTP 200 with `testMode: false`; verified unauthenticated device registration, unregister and watch-invite requests return HTTP 401; confirmed remote D1 has no migrations pending and Account Worker tests pass 15/15. No APK, commit or push was created. The production Worker still uses the intentional no-op Provider because real Android push credentials/SDK are not configured.

- 2026-08-13 (154): Selected FCM as the first real push provider. Added configurable Firebase Messaging client integration to Android, Android 13 notification permission/channel handling, token refresh/register/unregister lifecycle, and notification click validation into the existing room deep-link flow. Added Account Worker FCM HTTP v1 JWT/OAuth provider and deployed Worker version 338bbe45-a3f5-4c2a-965a-8f1f3487ad3e; production health returned HTTP 200 and D1 has no pending migrations. Built and opened `release/tongkan-android-1.0.0-alpha10.1-p0.5.apk` (versionCode 26, SHA-256 AED925A5B5AEFAAF4BBBD925C6419BE4E4ACF81FB4C406028888CCA3689D4C6C). Android tests, Lint and assemble passed. Firebase project values and service-account Secrets were intentionally not configured, so real notification delivery remains pending and system sharing remains the fallback. No commit or push was created.

- 2026-08-14 (162): User accepted the proposed multi-session development model: one reviewer/controller task, up to three isolated worker tasks, Spec Kit for specification/plan/tasks/checklists, GitHub Issues and Draft PRs for durable communication, and one `codex/TK-xxx-*` branch/worktree per worker. Recorded D-079. Independent reviewers requested changes to the dirty Alpha 10.1 baseline; repaired the disconnected pair-page/invite wiring and cached-login rendering, added security hardening for ignored credentials, explicit test-token opt-in and FCM log redaction, and reconstructed corrupted account/decision/PRD documentation. `pnpm typecheck`, 97 tests, production builds and Android checks passed; credential scanning was clean. Production D1 was current and preview D1 received `0003_device_tokens.sql`. The reviewed baseline is committed before any Spec Kit installation or worker worktree creation.

- 2026-08-14 (163): Committed the reviewed Alpha 10.1 baseline as `42248e1`. Installed uv 0.12.4, official Spec Kit 0.8.15 and GitHub CLI 2.97.0, initialized Codex skills and `.specify/`, disabled all automatic Git hooks, and preserved the existing context system. Added a Tongkan constitution, reviewer/worker workflow, Worker/Review Issue templates, Draft PR gates, handoff/review/task-contract templates, and full `TK-001-unilateral-unbind` spec, research, data model, OpenAPI contract, plan, tasks, requirements checklist and three non-overlapping worker contracts. YAML/JSON parsing, Spec Kit tool checks, placeholder checks, diff checks and credential scanning passed. The first governance review returned `CHANGES_REQUESTED` because worker authority over global docs and commit ownership was ambiguous; repaired AGENTS, constitution, contract, PR and Issue templates so workers may only commit assigned branches and can never modify global context or production state. Re-review and the independent TK-001 technical verdict remain pending; no implementation worktree or remote Issue/PR was created.

- 2026-08-14 (164): Completed the two-review acceptance loop for the multi-task development system. Governance re-review returned `APPROVED` after making reviewer ownership and worker prohibitions absolute. TK-001 technical review required and received: exact `pairId` targeting to prevent delayed old requests from unbinding a new friend, explicit same/different retry behavior and non-disclosing 404 after physical deletion, both-user invite invalidation, stable archive ordering and profile snapshots, complete mutation/error OpenAPI responses, D1 CAS/rollback design, local real-D1 20-round concurrency and cascade tests, preview checks limited to real tables, and environment/stdin-only test tokens. Final technical verdict is `APPROVED`. Spec Kit checks, YAML/JSON parsing, task numbering, placeholder checks, `git diff --check` and credential scanning pass. The approved setup is committed before any worker worktree is created. GitHub CLI installation reported success but the executable requires a fresh shell before authentication and Issue creation.

- 2026-08-14 (165): User accepted proceeding with the recommended reviewer/worker workflow. Cleaned the last generated-file trailing whitespace and re-staged the full setup. Validation passed for staged whitespace, 15 YAML files, 5 JSON files, 9 PowerShell scripts, the 19/19 TK-001 requirements checklist, official Spec Kit availability and added-line credential patterns. Committed the approved workflow and TK-001 package as `3bd9ed3 chore(workflow): add spec-kit review workflow`; the repository was clean immediately afterward. The earlier GitHub CLI installation was not present on disk, so downloaded the official portable `gh` 2.97.0 package to `C:\tmp\gh-cli-2.97.0`; `gh auth status` remains unauthenticated. A visible PowerShell window now runs the official browser login flow. No Worker Issue, branch, worktree, Draft PR, migration or implementation has started; Issue/worktree creation resumes only after the user completes GitHub authorization.

- 2026-08-14 (166): User requested reopening the GitHub authorization window. Re-launched a visible PowerShell terminal running portable GitHub CLI 2.97.0 with the official browser/device authorization flow and a follow-up `gh auth status` check. No repository code, Worker Issue, branch, worktree, PR, migration or deployment changed; waiting for the user to complete authorization and confirm login.

- 2026-08-14 (167): User reported being logged in, but reviewer verification still returned `You are not logged into any GitHub hosts`, no `GitHub CLI\hosts.yml` existed anywhere under `C:\Users`, and no `gh` authorization process remained running. This indicates the browser account login completed without finishing the CLI device authorization. Reopened a visible authorization window with explicit `GH_CONFIG_DIR=C:\Users\dengbingmei\AppData\Roaming\GitHub CLI` and clearer instructions to enter the one-time code and click Authorize GitHub. Remote Issue creation, push and worktree setup remain paused until `gh auth status` succeeds.

- 2026-08-14 (168): User requested reopening the GitHub CLI authorization flow again. Re-launched the visible PowerShell window with the fixed GitHub CLI config directory and explicit three-step device-code instructions. No repository code, remote Issue, branch, worktree, PR, migration or deployment changed; waiting for the window to show `Logged in to github.com`.

- 2026-08-14 (169): User reached the official GitHub CLI authorization confirmation page for account `dengbingmei24-web`. The page shows the expected GitHub CLI application and requested repository/workflow scopes. Instructed the user to click the green `授权 github` button only because they initiated this device flow, then return to PowerShell and confirm `Logged in to github.com`. No repository or remote project state changed yet.

- 2026-08-14 (170): User completed the GitHub browser device-authorization page and received the success screen. Reviewer verification still found no CLI auth file because the visible `gh` process runs under the Codex sandbox identity, which can read but not write the user's protected AppData GitHub CLI directory. Attempting to move a repository-scoped credential into broadly accessible `C:\tmp` was rejected as unsafe and was not performed. The orchestration plan now uses normal Git authentication for the baseline push and the user's already logged-in GitHub browser session for creating the three Worker Issues; local branches/worktrees remain reviewer-owned. No credential was copied, printed or stored in the repository.

- 2026-08-14 (171): Completed TK-001 reviewer setup. Committed the latest handoff as `3f76c5b`, pushed master successfully, and used the already verified Git credential only in process memory to create GitHub Issues #9 W1 Account Worker, #10 W2 Android and #11 W3 QA without printing or storing the token. Added the `worker-task` label and a `WORKTREE_READY` comment to each Issue. Created branches `codex/TK-001-W1-account`, `codex/TK-001-W2-android` and `codex/TK-001-W3-qa` in three physical worktrees under `C:\Users\dengbingmei\Documents\tongkan-worktrees`; all point to full baseline `3f76c5b8a1f684a49209d0945230b049cb78d409` and were clean. Marked T001-T002 complete and started three independent execution tasks for T003-T020 with strict non-overlapping write scopes, no global context changes, no push/merge/migration/deployment authority and required branch commits/test evidence.

- 2026-08-14 (172): User accepted all three urgent Android proposals: landscape brightness/volume gestures, portrait real-time chat, and landscape non-blocking chat overlay with incoming bubbles. Reviewed incomplete parallel artifacts, completed `RoomClient`/`RoomProtocol` chat support, rewrote the gesture and chat View classes, integrated them into `MainActivity`, added keyboard overlay behavior and version `1.0.0-alpha10.1-p0.7` (versionCode 28). Server `chat.message` was reused unchanged; no Cloudflare deployment or database action occurred. `git diff --check`, 27/27 Android tests, Lint (0 errors, 19 warnings) and a production-configured APK build passed. Generated and opened `release/tongkan-android-1.0.0-alpha10.1-p0.7.apk`, 3,934,009 bytes, SHA-256 `E36B1B2C53715A19B5247C6B8E3F749E339C6ECAA5370C56EE5DEAD7C7C34E22`. Physical two-device verification is next.

- 2026-08-14 (173): User physically confirmed brightness/volume gestures work and supplied screenshots for three regressions. Root cause review found the Android viewing page was shown before WebSocket authentication, `RoomClient.handleMessage(auth.ok)` omitted `authenticated = true` (so MainActivity looked connected while RoomClient rejected every chat send), and the landscape IME used Android full-screen extract editing. Fixed all three, added a single-member post-auth chat regression test, updated D-081/D-082 and the Android follow-up PRD, and passed 28/28 Android unit tests, Lint and production-configured assembleDebug. Replaced and opened `release/tongkan-android-1.0.0-alpha10.1-p0.7.apk`, 3,934,009 bytes, SHA-256 `E36B1B2C53715A19B5247C6B8E3F749E339C6ECAA5370C56EE5DEAD7C7C34E22`. No server deployment or database change occurred.

- 2026-08-14 (174): User physically accepted single-member chat and the landscape IME fix (about one-third of the video remains visible), then requested that the portrait chat card occupy the unused lower screen area. Changed the portrait viewing footer and chat card to nested weighted layouts, so the message list expands through the remaining height and the composer stays at the bottom; landscape overlay sizing remains unchanged. Updated D-081 and the Android follow-up PRD, passed 28/28 Android tests, Lint and production-configured assembleDebug, then replaced and opened `release/tongkan-android-1.0.0-alpha10.1-p0.7.apk`, 3,934,009 bytes, SHA-256 `E36B1B2C53715A19B5247C6B8E3F749E339C6ECAA5370C56EE5DEAD7C7C34E22`.

- 2026-08-14 (175): Completed a read-only governance audit of the root documentation, context, PRDs, QA, design, Spec Kit and archive responsibilities. User accepted the strict minimal-root model with only `README.md`, `AGENTS.md`, `PROJECT_CONTEXT.md` and a short `CONTEXT.md` as root Markdown entry points; historical documents will be archived before any deletion. Execution was deferred until Monday, 2026-08-17. Created and verified the interactive-only Windows scheduled task `Tongkan-Docs-Governance-Reminder` for 11:00 Asia/Shanghai on that date. No project files other than this mandatory context handoff were changed, and no code, build, commit, push, deployment or database action occurred.

- 2026-08-14 (176): User supplied new physical screenshots showing the portrait composer remained behind the keyboard and deletion appeared unavailable. Root cause was insufficient handling of modern IME/edge-to-edge Insets, not a custom delete restriction. Added an IME-aware composer translation to the keyboard top edge, explicit text input/cursor configuration, and kept portrait `adjustResize` versus immersive landscape `adjustNothing`. Built and opened Alpha 10.1 P0.9 FCM APK, deployed the account profile endpoint already introduced in the previous turn, and verified the production route returns 401 for an invalid token rather than 404. No D1 migration, commit, push or Pages deployment occurred.

- 2026-08-14 (177): User shared a screenshot of the toast “账号服务尚未配置，已进入本地房间模式” and requested a two-person-watchable build before ending work. Confirmed that the toast means the APK lacked `ACCOUNT_API_BASE_URL`; anonymous room creation and WebSocket synchronization were still available, while account/pair features were disabled. Bumped to Alpha 10.1 P0.11 (versionCode 32), injected `https://tongkan-personal.pages.dev/account-api`, passed 28/28 Android unit tests, Lint and assembleDebug, and opened `release/tongkan-android-1.0.0-alpha10.1-p0.11-pair.apk` (3,888,940 bytes), SHA-256 `AD05BE953B2191F2DFFBC2CC33B065D6FF518A70A121DB5D8F6DBCB1F4782CB8`. No commit, push, deployment or database action occurred.

- 2026-08-17 (178): User confirmed the portrait chat input still could not visibly delete entered text and remained behind the keyboard. Created and restored safety stash `safety-before-p012-ime-fix-2026-08-17`, then removed the competing child-level IME translation, separated root system-bar Insets from IME Insets, calculated exact composer/keyboard screen overlap with a visible-frame fallback, added focus-driven Insets refresh and explicit native keyboard display, and replaced the custom 120-code-point filter with Android `LengthFilter(120)` to avoid interfering with Chinese IME composing/deletion. Bumped to Alpha 10.1 P0.12 (versionCode 33), injected the production Account Worker base URL, passed 28/28 Android unit tests, Lint and assembleDebug, and opened `release/tongkan-android-1.0.0-alpha10.1-p0.12-pair.apk` (3,888,940 bytes), SHA-256 `3617EB46A088E4996931DE5CEEAEE1B408BAA0ED0EE057BA486A3E8D530EAF10`. No commit, push, deployment or database action occurred.

- 2026-08-17 (179): User requested reopening the current APK. Verified `release/tongkan-android-1.0.0-alpha10.1-p0.12-pair.apk` exists and reopened Explorer with that exact file selected. No code, build, commit, push, deployment or database action occurred.

- 2026-08-17 (180): User reported that Explorer did not visibly open because the previous `Start-Process` used a hidden window style. Re-ran visible `C:\Windows\explorer.exe /select` for the same P0.12 APK without hidden-window flags. No code, build, commit, push, deployment or database action occurred.

- 2026-08-17 (181): User supplied an 18.04-second P0.12 physical recording and requested an independent review of the message-sending flow. Frame review confirmed that opening the OEM keyboard still fully hides the portrait composer and App send button; dismissing the keyboard reveals the entered text, and the later empty field indicates deletion likely worked but remained invisible while editing. The keyboard exposes its own “发送” action while the hidden App button also exists, creating ambiguous duplicate submission entry points. No sent message bubble appears, but the recording does not clearly show a send action, so submission failure is not yet proven. Recommended replacing further Insets arithmetic with an independent top-level composer or separately resized input window, then unifying both send actions. No code, build, commit, push, deployment or database action occurred.

- 2026-08-17 (182): User approved replacing the portrait input bar with an independent top-level layer and unifying keyboard/App send behavior. Created and restored safety stash `safety-before-p013-top-level-composer-2026-08-17`. Implemented P0.13 by detaching the portrait composer from `RoomChatView`, mounting it on the Activity root `FrameLayout`, reserving message-list space, and positioning the overlay from root-screen coordinates plus visible-frame/IME candidates. Removed the prior whole-card offset path. IME action send, physical Enter and App send now call the same `submit()` method; success keeps native editing behavior, adds the local bubble through the existing callback and clears the input. Added `PortraitComposerPositioner` and four unit tests, synchronized D-084, Android PRD, Alpha 10 design and QA, and bumped versionCode 34 / `1.0.0-alpha10.1-p0.13`. `git diff --check`, 32/32 unit tests, Lint 0 errors/19 warnings and production-account assembleDebug passed. Built `release/tongkan-android-1.0.0-alpha10.1-p0.13-pair.apk` (3,888,936 bytes), SHA-256 `429B43859D8633C07C9A7A443B2E80F0227545117C6E50B915E8B8F0CE10EC6A`. No commit, push, deployment or database migration occurred; physical acceptance is next.

- 2026-08-17 (183): User physically confirmed P0.13 can type and continuously delete text. Recorded this as acceptance of the core top-level composer fix; send deduplication/clearing and transition cleanup remain to test. Re-audited the prior-week backlog and ranked it: finish and commit TK-002 first; rotate the exposed QQ SMTP authorization code; review and integrate TK-001 unilateral-unbind worker commits; then resume FCM/two-device Beta regression and documentation governance. Verified W1 `6024a39`, W2 `1fa8341` and W3 `a6170de` exist, but each includes contract-forbidden global `CONTEXT.md`/task-file changes requiring reviewer cleanup before integration. No code, build, commit, push, deployment or database action occurred.

- 2026-08-17 (184): User confirmed all remaining P0.13 physical checks pass: keyboard/App send, one local bubble, successful input clearing and no composer residue across keyboard, landscape, fullscreen and room exit. User also generated and entered a replacement QQ SMTP authorization code through the visible local Wrangler prompt without exposing it in chat. Production secret listing confirms `SMTP_AUTHORIZATION_CODE`; a live send-code request returned HTTP 202. Account Worker typecheck, 17/17 tests and Wrangler dry-run passed; Android P0.13 already passed 32/32 tests, Lint and assembleDebug. GitHub remote access and Cloudflare OAuth are valid. User explicitly authorized committing and pushing the accepted TK-002 baseline.

- 2026-08-17 (185): Created commit `ce442c9 feat(android): complete alpha 10.1 room interaction baseline` with 28 files covering account nickname support, Android room chat, brightness/volume gestures, top-level composer, protocol/tests and synchronized product/design/QA documents. Pushed the new branch to `origin/codex/TK-002-player-chat`; GitHub reported the branch is available for a pull request. No merge to master, production code deployment or database migration occurred. This final context handoff is committed separately after the code push.

- 2026-08-17 (186): User approved running TK-001 integration, real FCM preparation and Beta regression in parallel using the reviewer/worker-agent model. The reviewer spawned three agents to audit W1 `6024a39`, W2 `1fa8341` and W3 `a6170de`. All three returned CHANGES_REQUESTED; Account fixed concurrent same-value idempotency and mutation attribution in `ef92e01`, Android fixed immediate authority reconciliation and tab/resume refresh in `641f3ed`, and QA fixed exact preview allowlisting, third-account authorization, dependency expansion and minimal secure input in `8776c33`. Reviewer revalidation passed Account 41/41 with real local D1, QA 13-case ValidateOnly, Android test/Lint/assemble, full workspace typecheck/test/integration/build and diff checks. Integrated Account → Android → QA into `codex/TK-002-player-chat`, manually preserving the accepted P0.13 nickname/chat/composer/red-dot/brightness/volume code. Applied migration 0004 and deployed Worker version `4eaaf9e9-0152-46cc-bd6a-c49d58b22999` only to the isolated preview environment; the expected public preview Pages route returns 404, so live token-based black-box tests remain blocked. Production Account D1/Worker, Pages production, master and remote branch were not changed. Froze versionCode 35 / `1.0.0-alpha10.1-p1.0` and built `release/tongkan-android-1.0.0-alpha10.1-p1.0-dual-device.apk` (3,905,324 bytes), SHA-256 `50C2AC0656592E5B402303558DAB19C26AEF55B47FF251EB5B001DD2F6932001`. Real two-device FCM and Beta acceptance are next.

- 2026-08-17 (187): User asked how to test the frozen P1.0 build. Clarified that the current production-configured APK can immediately test two-device FCM invitation delivery/click/cold-start recovery and the full room/playback/reconnect/landscape-chat Beta matrix, but TK-001 unbind/archive actions must not be judged yet because production Account migration 0004 and Worker endpoints are intentionally not deployed. Provided an ordered two-phone checklist and requested concise pass/fail evidence without sharing tokens, full room links or private account data. No code, build, push, production deployment or database migration occurred.

- 2026-08-17 (188): User postponed physical P1.0 testing until after work and asked to continue other tasks. Selected the previously accepted documentation-governance work because it does not change the frozen APK or production services. A fresh read-only audit confirmed 19 root Markdown files, two ignored root postmortems and a 150 KB dynamic CONTEXT. Restored the accepted strict minimal-root target: only README.md, AGENTS.md, PROJECT_CONTEXT.md and a shortened CONTEXT.md remain at root; DECISIONS, PRDs, QA, operations, architecture, design and postmortems move under purpose-specific docs/design/archive directories, and historical CONTEXT conversation logs are archived before trimming. The planned execution remains two reversible commits: path moves first, then link/content cleanup and validation. Attempting the required pre-change Git safety stash was rejected because the current environment exhausted automatic approval usage; no files were moved, deleted or committed, and no code/APK/deployment/database state changed. Explicit Git write approval or restored approval capacity is required before execution.
