# Worker Task Contract: TK-004-W2 Android Calendar

**Feature**: TK-004
**Baseline Commit**: `a5324c5e5b15eb4798e0e3af159175477fd15647`
**Branch**: `codex/TK-004-W2-android`
**Worktree**: `C:\Users\dengbingmei\Documents\tongkan-worktrees\TK-004-W2-android`
**Owner**: Android execution task
**Depends On**: T004 clean baseline + frozen OpenAPI/JSON fixtures

## Goal

实现原生 Java 观看日历、日期详情、计划 CRUD/完成、共同片库“安排日期”、首页“今天想看”及从计划开始同看，并处理加载、空、错误、冲突和解绑状态清理。

## Non-Goals

- Account Worker、D1 migration 或 QA runner。
- Kotlin、Compose、第三方日历库或大型依赖。
- 自动提醒、重复计划、外部日历和实际观看统计。
- 直接粘贴陌生视频创建计划。
- 生产 APK 发布或真机验收结论。

## Write Scope

- `apps/android/app/src/main/java/com/tongkan/mobile/account/AccountModels.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/account/AccountClient.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/MainActivity.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/ui/CalendarScreen.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/ui/HomeScreen.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/ui/LibraryScreen.java`
- `apps/android/app/src/main/java/com/tongkan/mobile/ui/MainNavigationView.java` 仅在现有 calendar tab 接入确有需要时修改
- `apps/android/app/src/test/java/com/tongkan/mobile/account/AccountModelsTest.java`
- `apps/android/app/src/test/java/com/tongkan/mobile/account/AccountClientTest.java` 如已存在则扩展，否则可新增
- `apps/android/app/src/test/java/com/tongkan/mobile/ui/CalendarScreenStateTest.java`
- `apps/android/app/src/test/java/com/tongkan/mobile/ui/HomeScreenStateTest.java` 如已存在则扩展，否则可新增
- `specs/TK-004-calendar/handoffs/TK-004-W2-android.md`

## Forbidden Scope

- `CONTEXT.md`, `docs/decisions/DECISIONS.md`, `PROJECT_CONTEXT.md`, global PRDs, production configuration and deployment state.
- `apps/account/`, `qa/`, other specs and other worker branches/worktrees.
- Secrets, APKs, Firebase JSON, service-account JSON and build outputs.
- Worker-initiated push, merge, rebase, force push, migration or deployment.

## Frozen Contracts

- 解析模型与 `contracts/openapi.yaml` 一致。
- 日历使用现有四栏导航的 calendar tab 和 Breath Tech 主题。
- 月格为原生 View，不增加依赖。
- 首页只显示目标日期的 `planned` 项；无计划不显示空卡片。
- 有时间按升序、全天项在后；空时间显示“当天”。
- stale revision 必须刷新权威快照并显示中文恢复信息。
- 从计划开始同看复用已有 `createRoom`/媒体切换/活跃好友房间/FCM 可选提醒，不复制协议。
- 退出、切换账号、匿名模式、解绑或 pair 变化时清理 calendar 状态。
- archive calendar 只读，不显示写操作。

## Required Validation

```powershell
pnpm android:test
pnpm android:lint
pnpm android:build
git diff --check -- apps/android specs/TK-004-calendar/handoffs/TK-004-W2-android.md
```

JVM tests 至少覆盖 JSON、无效日期/时间、排序、today 过滤、全天显示、请求体和 revision conflict。

## Done When

- [ ] Contract goal is implemented.
- [ ] Required validation passes.
- [ ] Changes are committed on the assigned branch.
- [ ] Handoff includes commit hash, changed files, tests, UI risks, lifecycle/state cleanup and rollback notes.
