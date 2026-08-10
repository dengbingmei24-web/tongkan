# Tongkan - Development Context Snapshot

> Purpose: Cross-conversation state transfer. Read at start, update at end.
> Format: `last_updated` required, others as needed.

---
last_updated: 2026-08-10T12:40:38.4349874+08:00
current_version: 1.0.0-alpha.9.2 (versionCode 11; physical-device test passed; published as GitHub prerelease v1.0.0-alpha.9.2)
target_version: Collect normal-use feedback, then choose Alpha 9.3 stabilization or Alpha 10 playlist work
status: Alpha 9.2 remains the published stable prerelease. The approved README product showcase and Web home/join/room redesign are committed and pushed to `origin/master`. Typecheck, 80 tests and the full workspace build pass. Cloudflare Pages deployment remains pending, and the immutable Alpha 9.2 release tag remains unchanged.
---

## Mandatory Conversation Lifecycle

- Start: read `AGENTS.md`, then `CONTEXT.md`, then `PROJECT_CONTEXT.md`; consult relevant entries in `DECISIONS.md` before product, architecture, protocol, UI, or release changes.
- Locate task-specific documents through the mapping in `PROJECT_CONTEXT.md` instead of guessing from filenames.
- End: update `CONTEXT.md` even when no code changed, including `last_updated`, current status, active work, completed work, known issues, next steps, and the conversation log as applicable.
- Record any newly confirmed long-term product, design, protocol, architecture, storage, or release choice in `DECISIONS.md`.
- Update `PROJECT_CONTEXT.md` only when stable project structure, product boundaries, architecture, or document ownership changes.
- Never leave a conversation without synchronizing the latest development state into this system.

## Completed

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
- [x] Replaced the oversized reaction picker concept with a compact 5×2 popup above the “互动” button and exported `design/alpha9-ui/preview-reaction-compact-v2.png`
- [x] Confirmed black-and-white outlined dumpling art direction and generated `design/alpha9-ui/reaction-sticker-art-direction-a-v2.png` with light and dark visibility tests

- [x] Completed isolated Bilibili playback verification across mobile direct, desktop direct, mobile Embed, and desktop Embed routes using av170001 and BV1Qxuc62E1y
- [x] Accepted D-049: desktop User-Agent plus top-level player.bilibili.com Embed is the Alpha 9 Android player route
- [x] Implemented Alpha 9 first usable native flow: room entry -> video preparation -> viewing, with local validation before media-change broadcast
- [x] Implemented default light and selectable neutral black/charcoal dark themes with 12dp controls and pressed-state color feedback
- [x] Implemented B站 danmaku preference, six synchronized playback rates, manual landscape, App immersive fullscreen, and HTML player fullscreen handling
- [x] Implemented 8-second slow loading hint, 20-second preparation timeout, cancel preparation, and automatic system share after room creation
- [x] Passed 15 Android unit tests, Android Lint, and Debug APK build for Alpha 9
- [x] Built `release/tongkan-android-1.0-alpha9.apk` (1,383,668 bytes, SHA-256 `B530C274A5B11F1C6D3CB9635957FE9B2BC35194907C5F3C9FDBED42926956D9`)

- [x] Processed first Alpha 9 physical-device screenshots and identified safe-area overlap, default button elevation, full-height WebView, hidden native controls, Bilibili click-through navigation, and inaccessible landscape control
- [x] Implemented D-050: centered 16:9 watch stage, system inset handling, zero-elevation buttons, blocked Bilibili internal navigation, and explicit landscape immersive viewing
- [x] Real Embed control probe passed: URL remained on player.html, top click-through overlay hidden, danmaku toggled true -> false, and playback rate changed to 1.5×
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

## In Progress

- [x] User approved the redesigned Web and README for a local Git commit
- [x] Push the approved redesign commit to GitHub `origin/master`
- [ ] Deploy the redesigned Web to Cloudflare Pages only after explicit user confirmation

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

1. Commit the accumulated Alpha 9.2 Android source, design and project-context documents.
2. Push local master, including the four existing local commits, to GitHub.
3. Create and push the immutable tag `v1.0.0-alpha.9.2`.
4. Verify GitHub Actions creates the prerelease with APK and SHA-256 assets.
5. Update repository description/topics and record the final release URL.

## Known Issues

1. The exact bottom interaction area is undecided: reaction-only, collapsible text chat, or both.
2. A repeatable two-device regression matrix for create/join, media switching, speed, seek and reconnect should be completed before Beta.
3. The accepted 2-second buffering debounce and one-report-per-buffering-episode guard remain unimplemented.
4. Full four-category error cards, playback-completion overlay and hard-sync notice remain stabilization work.
5. Android Release signing is not configured; Alpha artifacts use Debug signing.
6. Alpha 10 persistent local playlist remains deferred until post-Alpha 9.2 usage feedback.
7. GitHub Actions reports non-blocking Node.js 20 runtime deprecation warnings for several third-party actions; migrate action majors in a separate maintenance change.
8. The redesigned README is published on GitHub after the `master` push; the public Cloudflare Pages Web site remains unchanged until an explicit deployment step.

## Architecture Decisions

- Room fixed at 2 people (host + guest), no multi-group
- No registration/login, temporary keys
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

## Active Alpha 9.2 Build Artifact

- APK: `release\tongkan-android-1.0-alpha9.2.apk`
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

1. Deploy the approved Web redesign to Cloudflare Pages only after explicit user confirmation, without changing the immutable Alpha 9.2 release tag.
2. Keep `v1.0.0-alpha.9.2` and its APK immutable; future fixes use a new versionName, versionCode and tag.
3. Collect normal-use feedback and decide whether the next milestone is Alpha 9.3 stabilization or Alpha 10 interaction/playlist work.
4. Configure a long-term Android Release signing key before the first Beta or stable release.
5. Upgrade deprecated GitHub Action majors in a separate maintenance change after confirming compatibility.

## Key Files

| Purpose | File |
|---|---|
| Android follow-up PRD | ANDROID_FOLLOWUP_PRD.md |
| Alpha 9 interactive UI preview | design/alpha9-ui/preview.html |
| Local playlist interactive preview | design/alpha9-ui/playlist-preview.html |
| Alpha 9 design direction notes | design/alpha9-ui/DESIGN_DIRECTIONS.md |
| Selected Alpha 9 design specification | design/alpha9-ui/SELECTED_DESIGN.md |
| Installed UI/UX skill | C:\Users\dengbingmei\.codex\skills\ui-ux-pro-max\SKILL.md |
| Main product PRD | PRD.md |
| Android Bilibili URL parsing/embed URL | apps/android/.../BilibiliMedia.java |
| Android WebView/player bridge and UI | apps/android/.../MainActivity.java |
| Android WebSocket/API | apps/android/.../RoomClient.java (OkHttp 4.12.0) |
| Android build config | apps/android/app/build.gradle |
| Protocol messages | apps/android/.../RoomProtocol.java |
| Player bridge script | apps/android/app/src/main/assets/bilibili-player-bridge.js |
| Signaling Worker | apps/signaling/src/worker.ts |
| Room session logic | apps/signaling/src/room-session.ts |
| Shared types | packages/protocol/src/types.ts |
| QA checklist | QA_CHECKLIST.md |
| Active APK | release/tongkan-android-1.0-alpha7.apk |

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
- 2026-08-07 (38): User accepted danmaku as a default-on per-device persisted preference and accepted six room-synchronized speed options with new rooms starting at 1.0×
- 2026-08-07 (39): User requested preset non-text reactions visible to both viewers; feasibility review found that the existing chat broadcast and rate limit can support an ephemeral room reaction overlay without persistent room state
- 2026-08-07 (40): User accepted room reaction danmaku as an Alpha 9 P1 feature with 8–12 built-in non-text reactions, real-time broadcast, no history or offline replay, and no ability to block the core APK
- 2026-08-07 (41): User accepted independent local controls for Bilibili danmaku and room reactions; reactions remain visible with fullscreen controls hidden and use immediate local rendering plus server-message deduplication
- 2026-08-07 (42): Generated the first visual preview of the ten-expression clean-utility reaction pack, its light picker panel, and dark fullscreen overlay; awaiting user design feedback
- 2026-08-07 (43): User could not see the inline generation result; recovered its PNG from the Codex task record into the project and displayed it using an absolute local path
- 2026-08-07 (44): User said the large picker over the video obstructs viewing; changed it to a compact 5×2 popup directly above the “互动” control, updated PRD/design/decision documents, and exported a revised preview
- 2026-08-07 (45): User explicitly accepted the compact reaction picker preview; its placement, 5×2 layout, close behavior, and control-bar visibility rules are frozen for Alpha 9 P1 implementation
- 2026-08-07 (46): Began the next design discussion for reaction overlay motion; comparing full-screen danmaku traversal, a recommended short right-side glide, and a button-origin floating bubble, with exact size and timing awaiting user confirmation
- 2026-08-07 (47): User accepted the recommended short right-side glide: 48dp portrait / 56dp fullscreen, about 120dp travel with slight upward drift, 2.5-second lifetime, three upper/middle lanes, peer nickname labels, and button scale/color/haptic feedback
- 2026-08-07 (48): Began selecting the final art direction for the ten custom reaction assets; comparing minimal outlined dumplings, colorful flat emoji, and glossy 3D styles, with the minimal outlined system recommended
- 2026-08-07 (49): User accepted art direction A; recorded D-038 and generated `reaction-sticker-art-direction-a-v2.png`, showing the final ten black-and-white outlined dumpling expressions and dark-video visibility test
- 2026-08-07 (50): User accepted the new reaction concept and asked what remains; reorganized the roadmap so Alpha 9 core UI/player/lifecycle implementation and QA come before non-blocking P1 reaction asset production, followed by Alpha 10 playlist work
- 2026-08-07 (51): Began the final Alpha 9 loading/error-state discussion with a proposed safe media-change flow: load and verify the new video locally first, broadcast the room media change only after success, and leave the peer on the existing video if preparation fails
- 2026-08-07 (52): User accepted safe media switching; recorded D-039 so failed local preparation preserves the room’s current video and only successful local bridge readiness triggers the synchronized switch
- 2026-08-07 (53): Prepared the next loading-timing proposal for discussion: immediate spinner and “正在准备视频”, a slower-loading hint after 8 seconds, a 20-second failure threshold, no fake percentage, an optional cancel action, and a brief success check before synchronized switching
- 2026-08-07 (54): User accepted the loading timing; recorded D-040 with the 8-second slow hint, cancel action, 20-second recoverable failure, no percentage, and 0.4-second success feedback
- 2026-08-07 (55): Prepared the next discussion around four user-facing video errors: invalid link, network/timeout, player bridge failure, and unavailable or restricted video, each with a direct recovery action and collapsed technical details
- 2026-08-07 (56): User accepted the four-category error matrix; recorded D-041 and froze exact natural-language copy, recovery actions, room-disconnect separation, state preservation, and collapsed diagnostics
- 2026-08-07 (57): Prepared the next discussion for receiving a peer-initiated video switch: automatic switch overlay, independent local loading, no wait between devices, and local retry if the receiver fails to load the room’s new current media
- 2026-08-07 (58): User accepted peer-initiated automatic switching; recorded D-042 with immediate pause/overlay, independent loading, no confirmation, local-only retry, and room-anchor catch-up after readiness
- 2026-08-07 (59): Prepared the next discussion for playback buffering: ignore very short stalls, optionally pause both viewers after a sustained stall, show which viewer is loading, and require an explicit resume after recovery
- 2026-08-07 (60): User accepted synchronized buffering pauses; recorded D-043 with a 2-second debounce, one pause per buffering episode, manual resume after recovery, and 15-second recovery actions
- 2026-08-07 (61): Code review confirmed the existing bridge already ignores drift below 0.3 seconds, temporarily adjusts speed for 0.3–1.5-second drift, and hard-seeks above 1.5 seconds; prepared this behavior for user confirmation
- 2026-08-07 (62): User accepted the existing drift correction thresholds; recorded D-044 and added the brief “已重新同步” message only for hard seeks above 1.5 seconds
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

---

Maintenance rules:
- Mandatory: update `CONTEXT.md` before ending every conversation, regardless of whether code changed
- Mark completed with [x], new with [ ]
- Critical decisions in Known Issues or Architecture Decisions
- Build artifacts (APK path, SHA-256) in corresponding Completed entries
- Update the follow-up PRD whenever a product decision is agreed with the user