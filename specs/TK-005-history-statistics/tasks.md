# Tasks: TK-005 Alpha 10.4 共同观看历史与统计

## Phase 0: Reviewer Planning and Gates

- [x] T001 [REVIEW] 核对 `codex/TK-004-calendar`、HEAD `8aee2c1` 和工作区；确认只有 TK-005 全局规划改动与无关 `合作方-透明.png`，不覆盖未提交内容。
- [x] T002 [REVIEW] 创建并恢复安全 stash `safety-before-alpha10.4-planning-20260901-104911`，保留无关未跟踪资产。
- [x] T003 [REVIEW] 完成 spec、research、data model、OpenAPI、plan、tasks、quickstart、requirements checklist 和 W1/W2/W3 合同，并通过文件清单、OpenAPI 结构、引用、空白与跨文档一致性校验。
- [x] T004 [REVIEW] 用户于 2026-09-01 以“继续开发”接受 PD-001..PD-005：60 秒、completion 后置、UTC+设备 offset、无自动计划关联、pair 级 keep/delete 且无单条管理。
- [ ] T005 [REVIEW] 获得用户明确授权，将 TK-005 规划包提交为干净 baseline；排除 `合作方-透明.png`，不 push、不部署、不构建 APK。
- [ ] T006 [REVIEW] 用 T005 commit hash 替换所有 `TBD_TK005_PLANNING_BASELINE`，并在用户授权开始实现后创建 TK-005 review branch 与三个独立 worktree。

## Phase 1: W1 Account Worker and D1

- [ ] T101 [W1] 新增 `0008_watch_history.sql`，创建 source/interval/session、索引、FK cascade 和从 0001–0007 的升级测试。
- [ ] T102 [W1] 实现 history models/repository，覆盖 source 创建/刷新/撤销、interval 幂等插入、session 聚合和分页 cursor。
- [ ] T103 [W1] 实现 versioned HMAC room grant，绑定 source/pair/user/room/slot/iat/exp，使用独立 Secret 且日志脱敏。
- [ ] T104 [W1] 实现 Service Binding internal ingest 的 timestamp/body signature、sourceRevision、interval conflict 和单事务 rollback。
- [ ] T105 [W1] 实现当前 pair history、monthly summary、calendar markers API，以及 keep archive 对应只读 API。
- [ ] T106 [W1] 实现 UTC interval 按 `tzOffsetMinutes` 跨日/月切分，覆盖负 offset、正 offset、月边界和无数据。
- [ ] T107 [W1] 在解绑事务撤销 active history source；保证晚到 ingest 不恢复已解绑 pair，双方 delete 后全表 cascade。
- [ ] T108 [W1] 实现片库优先、B站 best-effort、fallback 的元数据策略；外部元数据失败不回滚可信 interval。
- [ ] T109 [W1] 增加 Account unit/integration tests：grant、签名、20 轮重试/乱序、archive、unbind race、migration 和 D1 级联。

## Phase 2: W2 Signaling and Shared Protocol

- [ ] T201 [W2] 扩展共享协议：`history.bind`、`history.bound`、三个 history error code 与 report `ended`/`durationSeconds`，并保持旧客户端兼容。
- [ ] T202 [W2] 扩展消息校验与 Android/TypeScript contract fixtures，限制 grant/body/media/number 长度和无效值。
- [ ] T203 [W2] 新建确定性 history tracker，验证 pair/room/slot/user/grant 与严格 overlap 条件。
- [ ] T204 [W2] 实现服务端墙钟 interval/session、checkpoint、seek/rate、pause/buffer/stale/disconnect/media-change/ended 边界。
- [ ] T205 [W2] 持久化 grant 摘要、latest reports、active interval、sourceRevision 和 pending intervals，并验证 Durable Object reload。
- [ ] T206 [W2] 增加 Account History Fetcher seam、签名 client、幂等响应处理、指数退避和终止/可恢复错误分类。
- [ ] T207 [W2] 统一 alarm scheduler，覆盖 12s stale、grant expiry、ingest retry、empty TTL 与有限 flush grace。
- [ ] T208 [W2] 确保 history bind/ingest 失败不关闭 socket、不拒绝 playback/chat/invite，并保持现有 room lifecycle 测试通过。
- [ ] T209 [W2] 增加 fake-clock tests 和 reload/retry tests，验证无效状态计时为 0、有效重叠误差 <=1 秒。

## Phase 3: W3 Android and QA Contracts

- [ ] T301 [W3] 在 `AccountModels`/`AccountClient` 增加 grant、history page、monthly summary、calendar markers 和 archive JSON/API。
- [ ] T302 [W3] 在 Java `RoomProtocol`/`RoomClient` 增加 `history.bind`、ended/duration report 与兼容错误处理。
- [ ] T303 [W3] 在账号好友房间 `auth.ok` 后申请/刷新 grant；匿名、手工 room、失败或过期保持核心房间可用。
- [ ] T304 [W3] 实现约 5 秒周期报告和关键状态立即报告，正确取消 Handler/Runnable，避免 Activity/room 生命周期泄漏。
- [ ] T305 [W3] 在“我们”增加月度摘要、最近历史、分页、fallback 封面、加载/空/错误状态，不新增主 tab。
- [ ] T306 [W3] 在“日历”合并计划 marker 与实看 marker，日期详情分为“计划”和“一起看过”，不写 plan status/revision。
- [ ] T307 [W3] 为 keep archive 增加历史只读入口；pending/delete/第三方不显示；退出、解绑、匿名/账号切换清理状态。
- [ ] T308 [W3] 增加 Android JVM tests：grant 生命周期、report cadence/state change、JSON/pagination、timezone、marker merge、archive 和 stale callback guard。
- [ ] T309 [W3] 建立 `qa/watch-history/` ValidateOnly/Preview runner 与 contract cases，覆盖 A/B/C、anonymous、overlap matrix、重试、归档和敏感信息扫描。

## Phase 4: Reviewer Integration

- [ ] T401 [REVIEW] 审查 W1 的 migration、安全边界、D1 integration 和 API 合同，给出 APPROVED/CHANGES_REQUESTED/BLOCKED。
- [ ] T402 [REVIEW] 审查 W2 的协议兼容、计时状态机、alarm/retry 和 fail-open 证据。
- [ ] T403 [REVIEW] 审查 W3 的 Android 生命周期、四 tab UI、QA runner 和敏感日志边界。
- [ ] T404 [REVIEW] 按 W1 → W2 → W3 集成，解决仅由交叉合同产生的问题，不扩大功能范围。
- [ ] T405 [REVIEW] 配置本地/Preview Account Service Binding 与 Secrets 示例；生产配置仍保持不变。
- [ ] T406 [REVIEW] 运行全仓 typecheck/test/integration/build、Android test/lint/build、diff/link/credential checks 和本地 D1 migration。
- [ ] T407 [REVIEW] 获得授权后执行 Preview migration 0008、部署 Preview Account/Signaling 并运行 Calendar/History Live QA；不执行生产、不发布 APK。
- [ ] T408 [REVIEW] 同步 PRD、路线图、选定设计、QA、CHANGELOG、Decision 和 CONTEXT；Alpha 10.3 物理矩阵仍标记 deferred。
- [ ] T409 [REVIEW] 生产 migration、Account/Signaling deployment、APK build/publish、push 与更广发布分别请求用户授权。

## Dependencies

- T003 完成后才能评审 T004；T004/T005/T006 是全部实现任务的硬门槛。
- W1/W2/W3 必须从同一 T005 clean baseline 创建，合同写入范围不得重叠。
- W2 使用冻结 grant/ingest fixtures，不依赖 W1 worktree 实时构建。
- W3 使用冻结 OpenAPI/JSON/protocol fixtures，不直接修改 W1/W2 文件。
- Reviewer 只有在 W1/W2/W3 全部 APPROVED 后才进行 Preview 集成。
- Alpha 10.3 双设备物理验收可以继续延期，但不能从发布风险或最终门槛中删除。

## Done When

- 双方账号授权的 App B站房间只在严格有效重叠时形成服务端历史。
- pause/buffer/stale/disconnect/seek/rate/media-change/ended 和重复/乱序 ingest 均有确定性证据。
- 当前 pair 可查看历史、月度摘要和日历实看 marker；keep archive 只读且 pair delete 级联。
- completion、自动计划关联和单条管理遵守已冻结的产品决定，不静默扩范围。
- 所有历史故障 fail-open，现有房间、播放、聊天、邀请、匿名、片库和日历计划回归通过。
- 生产动作、APK、push 和发布均只在单独授权后执行。
