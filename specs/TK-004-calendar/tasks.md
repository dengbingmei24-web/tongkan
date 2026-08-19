# Tasks: TK-004 Alpha 10.3 双人观看日历

## Phase 0: Reviewer Specification and Baseline Gate

- [x] T001 [REVIEW] 读取 Constitution、D-061/D-070/D-079、协作流程、PRD 和路线图，确认日期必填、时间/备注可选，提醒/重复计划后置。
- [x] T002 [REVIEW] 冻结 spec、data model、OpenAPI、research、plan、requirements checklist 和三个任务合同。
- [x] T003 [REVIEW] 为当前包含未跟踪文件的工作区创建并恢复 `safety-before-alpha10.3-calendar-20260819-143040` 安全 stash。
- [ ] T004 [BLOCKED] 将已上线的 Alpha 10.2.4/TK-003 当前工作区整理为一个经用户授权的干净基线提交；不得丢弃或覆盖现有改动。
- [ ] T005 [REVIEW] 用 T004 提交哈希替换合同中的 `TBD_CLEAN_BASELINE`，创建 `codex/TK-004-calendar` 与 W1/W2/W3 worktree。

## Phase 1: W1 Account Worker and D1

- [ ] T101 [W1] 新增 `0007_calendar_plans.sql`，创建 state/plans、索引和现有 pair 回填。
- [ ] T102 [W1] 新增 calendar models/repository/service，完成日期时间校验、媒体快照、月份/日期/今日读取和归档读取。
- [ ] T103 [W1] 实现 create/update/complete/delete 及 `CALENDAR_VERSION_CONFLICT`，保证失败不增加 revision。
- [ ] T104 [W1] 修改 pair 接受事务，为新 pair 初始化 calendar state。
- [ ] T105 [W1] 接入 Worker routes 和错误合同，不改变已有 API 行为。
- [ ] T106 [W1] 增加 service 与真实本地 D1 integration tests，包括 20 轮 revision race、archive 和 cascade。

## Phase 2: W2 Android

- [ ] T201 [W2] 在 `AccountModels` 和 `AccountClient` 增加 CalendarSnapshot/Plan/Media 解析和 CRUD 请求校验。
- [ ] T202 [W2] 新建原生 `CalendarScreen`：月份切换、七列月格、日期标记、日期详情和加载/空/错误状态。
- [ ] T203 [W2] 增加计划新增/编辑/完成/取消交互，日期必填，时间/备注可选。
- [ ] T204 [W2] 在共同片库增加“安排日期”，复用相同计划编辑流程。
- [ ] T205 [W2] 首页增加“今天想看”，从计划直接复用房间创建与好友邀请流程。
- [ ] T206 [W2] 处理 revision 冲突刷新、退出/解绑/模式切换状态清理和 archive 只读展示。
- [ ] T207 [W2] 增加 JVM tests：JSON、日期、排序、today 过滤、空时间、请求校验和状态恢复。

## Phase 3: W3 QA Contracts

- [ ] T301 [W3] 建立 `qa/calendar/contract-cases.json`，覆盖 A/B 一致、第三方拒绝、无 pair、日期/时间/备注验证。
- [ ] T302 [W3] 覆盖 create/update/complete/delete、同日重复、20 轮 revision race 和失败无 revision 增长。
- [ ] T303 [W3] 覆盖 keep 归档只读、pending/delete 拒绝、双方 delete D1 级联清理。
- [ ] T304 [W3] 提供 ValidateOnly 与 Preview runner；不得保存 session token 或执行生产请求。

## Phase 4: Reviewer Integration

- [ ] T401 [REVIEW] 审查并集成 W1，运行 Account typecheck/test/build 和本地 D1 migration/integration。
- [ ] T402 [REVIEW] 审查并集成 W2，运行 Android JVM tests、Lint 和 Debug build。
- [ ] T403 [REVIEW] 审查并集成 W3，先 ValidateOnly，再在 Preview migration/Worker 获得允许后执行 A/B/C 黑盒。
- [ ] T404 [REVIEW] 运行全仓 typecheck/test/integration/build、diff check、链接检查和凭据扫描。
- [ ] T405 [REVIEW] 更新 PRD、设计、QA、CHANGELOG、Decision 和 CONTEXT，记录 Alpha 10.2.4 物理 P0 仍暂缓。
- [ ] T406 [REVIEW] 如用户另行批准，应用生产 migration 0007、部署 Account Worker并构建 Alpha 10.3 APK；否则保持生产不变。

## Dependencies

- T004 阻塞所有代码实现和 worktree 创建。
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
