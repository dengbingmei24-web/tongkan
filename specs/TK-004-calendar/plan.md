# Implementation Plan: TK-004 Alpha 10.3 双人观看日历

## Summary

在现有 Account Worker/D1、共享片库和原生 Java Android 主导航上增加共享观看日历。实现独立 calendar revision、月/日/今日读取、计划新增/修改/完成/取消、keep 归档只读，以及 Android 月历、日期详情和首页“今天想看”。不引入提醒、重复计划、外部日历或观看统计。

## Technical Context

- **Backend**: Cloudflare Worker TypeScript strict mode + D1
- **Android**: Java + View + WebView, minSdk 26
- **Existing dependencies**: `@tongkan/protocol`, OkHttp 4.12.0
- **Storage**: 新增 D1 migration `0007_calendar_plans.sql`
- **Concurrency**: 独立 `pair_calendar_state.revision`，语义与共享片库一致
- **Authentication**: 复用现有 session 与 `active_pair_members`
- **Archive authorization**: 复用 `pair_archive_members.retention_status`
- **Room launch**: 复用现有创建房间、活跃好友房间与 FCM 可选提醒流程

## Constitution Check

- 用户价值明确：解决“什么时候看”，不是扩展社交功能。
- 服务端不代理视频流，不保存 B站账号、密码或 Cookie。
- 房间仍最多两人，匿名模式继续保留。
- Android 不引入 Kotlin、Compose 或大型依赖。
- 复杂任务使用审查任务 + 最多三个隔离执行任务。
- 生产 migration、部署和发布 APK 不属于执行任务授权。
- Alpha 10.2.4 物理验收暂缓但继续作为发布门槛。

## Baseline Gate

当前主工作区包含已上线但未提交的 TK-003/Alpha 10.2.4 改动。依据 D-079，开始实现前必须：

1. 审查任务确认并提交 Alpha 10.2.4 当前基线，或由用户明确批准该提交。
2. 工作区变为可说明的干净状态。
3. 用该提交哈希替换三个任务合同中的 `TBD_CLEAN_BASELINE`。
4. 创建 `codex/TK-004-calendar` 审查分支以及 W1/W2/W3 独立 worktree。

不得从当前未提交基线直接启动并行实现，也不得通过 checkout/reset 丢弃现有改动。

## Architecture

### Account/D1

- `pair_calendar_state` 为每个 pair 保存独立 revision。
- `calendar_plans` 保存日历字段、媒体快照、actor 快照和时间戳。
- `library_item_id` 使用 `ON DELETE SET NULL`；计划继续使用媒体快照。
- 活动读写通过 `active_pair_members` 授权。
- 归档读取通过 retention=`keep` 授权，并返回 `readOnly=true`。
- pair 双方 delete 时依靠 `pairs` 外键级联清理。

### API

- `GET /api/calendar?month=YYYY-MM`
- `GET /api/calendar?date=YYYY-MM-DD`
- `GET /api/calendar/today?date=YYYY-MM-DD`
- `GET /api/pair/archives/{pairId}/calendar?month=YYYY-MM`
- `POST /api/calendar/plans`
- `PATCH /api/calendar/plans/{planId}`
- `DELETE /api/calendar/plans/{planId}?expectedRevision=N`

### Android

- 新建 `CalendarScreen`，使用原生 View 构建月份导航、七列月格、日期详情和编辑对话框。
- `AccountModels`/`AccountClient` 增加日历合同解析与请求。
- `MainActivity` 管理 calendar snapshot、加载、revision 冲突刷新、计划操作和从计划开始同看。
- `HomeScreen` 增加今天计划状态；只在账号已绑定且存在未完成计划时显示。
- `LibraryScreen` 的“安排日期”入口复用同一编辑流程；直接粘贴陌生视频不在本实现合同。

## Work Packages

### W1 Account + D1

写入 `apps/account/`：migration、calendar models/repository/service、Worker routes 和相关 tests。允许最小修改 `repository.ts` 以在新 pair 创建时初始化 calendar state。

### W2 Android

写入 `apps/android/`：models/client、CalendarScreen、HomeScreen/LibraryScreen/MainActivity 集成和 JVM tests。不修改 Account 或全局文档。

### W3 QA Contracts

写入 `qa/calendar/`：ValidateOnly/Preview 合同、A/B/C 权限、revision race、archive/cascade 和排序验收。不得部署。

### Reviewer Integration

审查任务冻结 OpenAPI、依序集成 W1/W2/W3、运行 Preview 与构建门槛、更新 PRD/设计/QA/Decision/CONTEXT，并在获得独立授权后才执行生产 migration、Worker 部署或 APK 发布。

## Dependency Order

1. 规格、数据模型、OpenAPI 和 checklist 通过。
2. 干净基线提交完成。
3. W1/W2/W3 在冻结合同后并行。
4. W1 → 本地 D1/Account 审查。
5. W2 → Android JVM/Lint/build 审查。
6. W3 → ValidateOnly 后使用 Preview 做黑盒验收。
7. 全仓门槛和文档闭环。
8. 生产动作另行授权。

## Rollback

- 应用 migration 前：删除 TK-004 代码和规格分支即可。
- Preview migration 后：Worker 可回退旧版本；新表保持闲置，不影响旧客户端。
- 生产 migration 后：优先回退 Worker/Android 功能入口，不执行破坏性 down migration；`pair_calendar_state` 和 `calendar_plans` 可保留为空或未使用。
- Android 功能异常时：首页和日历页降级为明确错误/重试，不得影响匿名房间、片库和播放器。
