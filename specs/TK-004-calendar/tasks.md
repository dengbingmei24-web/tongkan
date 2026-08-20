# Tasks: TK-004 Alpha 10.3 双人观看日历

## Phase 0: Reviewer Specification and Baseline Gate

- [x] T001 [REVIEW] 读取 Constitution、D-061/D-070/D-079、协作流程、PRD 和路线图，确认日期必填、时间/备注可选，提醒/重复计划后置。
- [x] T002 [REVIEW] 冻结 spec、data model、OpenAPI、research、plan、requirements checklist 和三个任务合同。
- [x] T003 [REVIEW] 为当前包含未跟踪文件的工作区创建并恢复 `safety-before-alpha10.3-calendar-20260819-143040` 安全 stash。
- [x] T004 [REVIEW] 经用户明确授权，将 Alpha 10.2.4/TK-003 工作区提交为干净基线 `a5324c5e5b15eb4798e0e3af159175477fd15647`；未丢弃或覆盖现有改动。
- [x] T005 [REVIEW] 用 T004 提交哈希替换合同中的 `TBD_CLEAN_BASELINE`，创建 `codex/TK-004-calendar` 与 W1/W2/W3 worktree。

## Phase 1: W1 Account Worker and D1

- [x] T101 [W1] 新增 `0007_calendar_plans.sql`，创建 state/plans、索引和现有 pair 回填。
- [x] T102 [W1] 新增 calendar models/repository/service，完成日期时间校验、媒体快照、月份/日期/今日读取和归档读取。
- [x] T103 [W1] 实现 create/update/complete/delete 及 `CALENDAR_VERSION_CONFLICT`，保证失败不增加 revision。
- [x] T104 [W1] 修改 pair 接受事务，为新 pair 初始化 calendar state。
- [x] T105 [W1] 接入 Worker routes 和错误合同，不改变已有 API 行为。
- [x] T106 [W1] 增加 service 与真实本地 D1 integration tests，包括 20 轮 revision race、archive 和 cascade。

## Phase 2: W2 Android

- [x] T201 [W2] 在 `AccountModels` 和 `AccountClient` 增加 CalendarSnapshot/Plan/Media 解析和 CRUD 请求校验。
- [x] T202 [W2] 新建原生 `CalendarScreen`：月份切换、七列月格、日期标记、日期详情和加载/空/错误状态。
- [x] T203 [W2] 增加计划新增/编辑/完成/取消交互，日期必填，时间/备注可选。
- [x] T204 [W2] 在共同片库增加“安排日期”，复用相同计划编辑流程。
- [x] T205 [W2] 首页增加“今天想看”，从计划直接复用房间创建与好友邀请流程。
- [x] T206 [W2] 处理 revision 冲突刷新、退出/解绑/模式切换状态清理和 archive 只读展示。
- [x] T207 [W2] 增加 JVM tests：JSON、日期、排序、today 过滤、空时间、请求校验和状态恢复。

## Phase 3: W3 QA Contracts

- [x] T301 [W3] 建立 `qa/calendar/contract-cases.json`，覆盖 A/B 一致、第三方拒绝、无 pair、日期/时间/备注验证。
- [x] T302 [W3] 覆盖 create/update/complete/delete、同日重复、20 轮 revision race 和失败无 revision 增长。
- [x] T303 [W3] 覆盖 keep 归档只读、pending/delete 拒绝、双方 delete D1 级联清理。
- [x] T304 [W3] 提供 ValidateOnly 与 Preview runner；不得保存 session token 或执行生产请求。

> Review status on 2026-08-19: W1 tip `51f6791`, W2 tip `89c213a` and W3 tip `46ea3c3` are all **APPROVED** and locally integrated into review-branch HEAD `1780acc`. Preview/production actions remain separately gated.

## Phase 4: Reviewer Integration

- [x] T401 [REVIEW] 审查并集成 W1；Account typecheck、68/68 tests、本地 migration/D1 integration 通过，当前树与已通过 Wrangler dry-run 的批准 tip 一致。
- [x] T402 [REVIEW] 审查并集成 W2；当前 Android 树与已通过 55/55 JVM、Lint 和 Debug assemble 的批准 tip 一致。
- [x] T403 [REVIEW] 审查并集成 W3，离线 ValidateOnly 通过；Preview A/B/C 黑盒仍等待 migration/Worker 的独立授权。
- [x] T404 [REVIEW] 全仓 typecheck、149 tests、integration、build、deps、Android 55/55/Lint/assemble、diff check、110-file 链接检查和 413-path 凭据扫描通过；Windows Account 测试文件串行化以规避 Wrangler registry `EBUSY`。
- [x] T405 [REVIEW] 已同步 PRD、路线图、设计、QA、CHANGELOG、D-090 和 CONTEXT；Alpha 10.3 仅本地集成，Alpha 10.2.4 物理 P0 仍暂缓。
- [ ] T406 [REVIEW] 如用户另行批准，应用生产 migration 0007、部署 Account Worker并构建 Alpha 10.3 APK；否则保持生产不变。

## Dependencies

- T004/T005 已完成；所有执行分支均以同一基线提交创建。
- T005 完成且 OpenAPI 冻结后，W1/W2/W3 可并行。
- W2 使用冻结 JSON fixtures，不依赖 W1 worktree 实时编译。
- Preview/Production migration、Worker 部署与 APK 发布只由审查任务执行，并需要对应授权。
- Alpha 10.2.4 双设备物理 P0 可以暂缓，但不得被自动标记通过或从最终发布门槛移除。

## Done When

- 两个绑定账号可共同创建、查看、改期、完成和取消计划。
- 月历、日期详情与首页“今天想看”使用相同权威数据和稳定排序。
- 旧 revision 不覆盖新状态，失败不产生部分写入。
- keep 归档只读，双方 delete 后 D1 无日历残留。
- 从计划开始同看复用现有房间/邀请链路。
- Account、Android、QA 和全仓门槛全部通过；生产动作有独立授权。
