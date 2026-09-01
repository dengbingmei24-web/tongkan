# Worker Task Contract: TK-005-W3 Android History and QA

**Feature**: TK-005
**Baseline Commit**: `9473dcdba18341169ad3e7e0ac976f9140cf65b5`
**Branch**: `codex/TK-005-W3-android-qa`
**Worktree**: `C:\Users\dengbingmei\Documents\tongkan-worktrees\TK-005-W3-android-qa`
**Owner**: Android/QA execution task
**Depends On**: PD-001..PD-005 frozen + clean planning baseline + frozen OpenAPI/JSON/protocol fixtures

## Goal

实现 Android 账号房间 grant 生命周期、history.bind、5 秒与状态变化播放报告、“我们”历史/月度摘要、日历实看 markers、keep archive 只读和 `qa/watch-history` 可执行合同。

## Non-Goals

- Account Worker、D1 migration、Signaling TypeScript 或 Durable Object 实现。
- 新主 tab、Kotlin、Compose、第三方统计 SDK 或大型依赖。
- completion 推断、自动完成计划、单条历史编辑/删除、导出或排行榜。
- Preview/Production deployment、production request、APK publication 或真机验收结论。

## Write Scope

- `apps/android/app/src/main/java/com/tongkan/mobile/account/AccountModels.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/account/AccountClient.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/RoomProtocol.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/RoomClient.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/MainActivity.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/ui/MainNavigationView.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/ui/CalendarScreen.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/ui/LibraryCoverLoader.java` 仅复用 history 封面加载确有需要时
- `apps/android/app/src/main/java/com/tongkan/mobile/ui/HistorySectionView.java` 可新增
- `apps/android/app/src/test/java/com/tongkan/mobile/**/*.java` 中 TK-005 相关测试
- `qa/watch-history/contract-cases.json`
- `qa/watch-history/run-preview.ps1`
- `qa/watch-history/README.md`
- `specs/TK-005-history-statistics/handoffs/TK-005-W3-android-qa.md`

## Forbidden Scope

- 全局 Context/Decision/PRD/设计/路线图、生产配置和部署状态。
- `apps/account/`、`apps/signaling/`、`packages/protocol/` 和其他 worker worktree。
- Kotlin、Compose、新依赖、APK/release 输出、Firebase/service-account JSON 或 Secret。
- 保存或输出 session token、完整邮箱、room key、invite URL、grant 或 internal signature。
- push、merge、rebase、force push、Preview/Production request、migration 或 deployment。

## Frozen Contracts

- HTTP JSON：`contracts/openapi.yaml`；WebSocket fixtures 由 W2/reviewer 冻结。
- grant 只在账号模式、活动 pair、App active-room、room `auth.ok` 后申请；失败不离开房间。
- Android 不解析 opaque grant，不自行累计或上传 watch total。
- playback report 包含 sequence/position/paused/ready/buffering/media/ended/duration/sentAt。
- 播放房间约每 5 秒报告；关键状态变化立即报告；离开 room 后不得残留 Runnable。
- “我们”显示已冻结范围内的 summary/history；不新增第五 tab。
- Calendar 计划 marker 与实际 marker 可区分；实际数据不修改 calendar revision/status。
- completion、最短时长、时区、计划关联和 retention 遵守已冻结 PD-001..PD-005。
- keep archive 只读；pending/delete/第三方无入口。
- QA runner 默认 ValidateOnly，Preview Live 需 reviewer 与用户单独授权。

## Required Validation

```powershell
pnpm android:test
pnpm android:lint
pnpm android:build
powershell -NoProfile -Command "$null = [System.Management.Automation.Language.Parser]::ParseFile('qa/watch-history/run-preview.ps1',[ref]$null,[ref]$null)"
powershell -NoProfile -File qa/watch-history/run-preview.ps1 -ValidateOnly
node -e "JSON.parse(require('fs').readFileSync('qa/watch-history/contract-cases.json','utf8')); console.log('ok')"
git diff --check -- apps/android qa/watch-history specs/TK-005-history-statistics/handoffs/TK-005-W3-android-qa.md
```

JVM/QA 必须覆盖：

- grant request/refresh/expiry 和 stale callback generation guards。
- periodic/immediate report schedule 与全部清理入口。
- history pagination/fallback/monthly/offset/markers/archive JSON。
- current/archive loading/empty/error/read-only UI state。
- A/B/C、anonymous、wrong pair/slot、overlap matrix、retry、archive/cascade contract inventory。
- 所有输出脱敏，Preview runner 不允许生产 base URL。

## Done When

- [ ] Contract goal is implemented without adding a tab or changing core room behavior.
- [ ] Required validation passes without production access.
- [ ] QA runner is safe-by-default and contains no credentials.
- [ ] Changes are committed on the assigned branch.
- [ ] Handoff includes commit hash, changed files, UI state inventory, lifecycle evidence, QA cases, security and rollback notes.
