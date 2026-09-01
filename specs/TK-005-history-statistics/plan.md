# Implementation Plan: TK-005 Alpha 10.4 共同观看历史与统计

## Summary

在现有 Account Worker/D1、Signaling Durable Object、共享播放协议和原生 Java Android 四 tab 架构上，增加账号房间短期授权、服务端双人有效播放重叠计时、幂等历史 ingest、历史列表、月度摘要、日历实看标记和 keep 归档只读。历史能力必须 fail-open，不得改变匿名房间、核心同步播放、聊天、邀请、片库或日历计划语义。

用户于 2026-09-01 授权继续开发并允许使用智能体。当前授权覆盖规划基线提交、隔离 worktree 和本地代码实现/测试；不覆盖 Preview/生产 migration、Worker deployment、APK build/publish、push 或公开发布。

## Technical Context

- **Account backend**: Cloudflare Worker TypeScript strict mode + D1
- **Signaling**: Cloudflare Worker + SQLite Durable Object
- **Protocol**: `@tongkan/protocol` TypeScript contracts + Android Java mirror
- **Android**: Java + View + WebView, minSdk 26
- **Existing dependencies**: OkHttp 4.12.0；不新增大型依赖
- **Storage candidate**: `apps/account/migrations/0008_watch_history.sql`
- **Cross-service auth**: versioned HMAC room grant + Account Service Binding signed ingest
- **Timing**: Android 5s report cadence；Signaling 12s stale threshold；服务端墙钟
- **Idempotency**: per-source monotonic revision + immutable interval IDs
- **Timezone**: UTC storage + request `tzOffsetMinutes`
- **Archive**: existing pair keep/pending/delete authorization and pair cascade

## Constitution Check

- 用户价值明确：补齐双方“真正一起看过什么、多久”的共同记忆，不扩展多人社交。
- 服务端只保存房间状态、媒体身份和时间区间，不代理或保存视频流。
- 账号 token、邮箱、room key、invite URL 和 B站 Cookie 不跨服务写入历史。
- Android 保持 Java/View/WebView，不引入 Kotlin、Compose 或统计 SDK。
- 复杂任务由审查任务控制，最多三个隔离执行任务，写入范围互不重叠。
- 执行任务不得修改全局 Context/Decision/PRD、生产配置、migration 状态或部署状态。
- Alpha 10.3 物理矩阵继续 deferred/not passed，不被 TK-005 覆盖。
- Production/Preview migration、Worker deployment、APK build/publish 和 push 均需单独授权。

## Current Baseline and Gates

- 当前审查分支：`codex/TK-005-history-statistics`
- 当前代码基线 HEAD：`8aee2c1 chore: close Alpha 10.3 production baseline`
- 未提交规划文件与无关 `合作方-透明.png` 共存；图片不得纳入 TK-005。
- 安全备份：`safety-before-alpha10.4-planning-20260901-104911`
- 合同中的 baseline 使用 `TBD_TK005_PLANNING_BASELINE`，待本轮规划提交后替换为真实 commit hash。
- 当前没有 TK-005 实现分支或 worktree。

### Implementation Gate

以下条件全部完成后，审查任务才能创建实现 worktree：

1. PD-001..PD-005 被用户接受或明确后置。**已完成**。
2. spec、research、data model、OpenAPI、tasks、quickstart、checklist 与任务合同一致。
3. 文档校验通过且全局 Context/PRD/Decision 已同步。
4. 用户明确批准提交 TK-005 规划基线。**已由“继续开发”授权**。
5. 工作区干净，合同 baseline 替换为真实 commit hash。
6. 用户另行授权开始实现。**已由“继续开发”授权**。

## Architecture

### 1. Account Grant and Source Registry

- `POST /api/history/grants` 复用现有 bearer session。
- host 首次申请时验证 active pair room，并创建 `watch_room_sources`。
- guest 申请时验证同一 pair/source/room。
- grant 绑定 source/pair/user/room/slot/iat/exp，Android 只把 opaque token 发送给 Signaling。
- source 允许短 grant 刷新，但有绝对寿命；解绑事务撤销活动 source。

### 2. Signaling History Tracker

- 新增可独立单元测试的 history tracker，输入连接、grant、anchor、report 和时钟事件。
- `history.bind` 是 auth 后的可选消息；未绑定仍可正常观看。
- `playback.report` 增加 ended/durationSeconds；旧客户端缺失字段按不具备 TK-005 计时能力处理，不破坏协议兼容。
- tracker 只在严格交集条件下打开区间，并在状态失效时关闭。
- 连续有效播放周期 checkpoint 成有限长度 interval；pause/buffer/stale 等可产生多个 interval，但共享 sessionId。
- Durable Object 持久化 sourceRevision、授权摘要、最新报告、活动 interval 和未确认队列。

### 3. Signed Ingest and Retry

- Signaling 通过可注入 `ACCOUNT_HISTORY` Fetcher 调用 Account internal route。
- 请求包含原始 body HMAC 和 timestamp；Account 验证 source、pair、participants、revision 和 interval。
- 2xx/幂等 stale response 可确认队列；可恢复 5xx/network error 指数退避；授权/合同 4xx 为终止错误。
- alarm 统一调度 stale、grant expiry、retry 与空房清理。
- 历史失败不改变 WebSocket response、playback command、chat 或 room lifecycle。

### 4. Account D1 and Query APIs

- migration 0008 创建 source、interval 和 session 表及索引。
- internal ingest 在单事务内幂等插入 interval、聚合 session、更新 revision。
- 元数据优先匹配当前 pair 片库，再 best-effort 获取 B站信息；失败使用 fallback。
- public APIs 提供当前 pair 历史分页、月度摘要、日历 markers，以及 keep archive 对应读取。
- 月度和 markers 基于 UTC interval 按请求 offset 切日；不写 calendar revision。

### 5. Android Integration

- `AccountModels`/`AccountClient` 增加 grant、history、monthly、markers 与 archive 读取。
- `RoomProtocol`/`RoomClient` 增加 `history.bind` 和 report ended/duration。
- `MainActivity` 在账号房间 auth 后获取/刷新 grant，房间生命周期结束时停止刷新与周期报告。
- 播放中约 5 秒周期上报，并在关键状态变化立即上报；匿名或无 grant 时维持现状。
- “我们”展示月度摘要与最近历史；“日历”合并计划点/实看点并分区详情。
- archive 历史只读；账号退出、解绑、切匿名、切账号、room disconnect 时清理全部历史临时状态。

## Work Packages

### W1 Account/D1

负责 migration 0008、grant/source、signed ingest、幂等 repository/service、public history APIs、archive authorization、pair unbind revoke、单元与真实本地 D1 integration tests。

### W2 Signaling/Protocol

负责共享 TS 协议、消息校验、history tracker、Durable Object 持久化/alarms/重试、service binding client seam 和确定性时钟测试。不修改生产 `wrangler.toml`。

### W3 Android/QA

负责 Android grant 生命周期、periodic/immediate reports、历史/月度/markers UI、archive 只读、状态清理、JVM tests，以及 `qa/watch-history/` ValidateOnly/Preview 合同。不得访问生产。

### Reviewer Integration

审查任务负责冻结产品默认值和 OpenAPI、创建 worktree、审查/集成 W1/W2/W3、补 service binding 与环境配置、运行全仓与 Preview gate、同步全局文档，并在获得独立授权后才进行 migration、部署或 APK。

## Dependency Order

1. 完成并审查 TK-005 规划包。
2. 冻结或后置 PD-001..PD-005。
3. 用户批准规划基线提交与开始实现。
4. 用同一 clean baseline 创建 W1/W2/W3 worktree。
5. W1/W2/W3 按冻结合同并行。
6. 审查任务依次集成 W1 → W2 → W3。
7. 增加 Preview Service Binding，运行 migration 0008 与跨服务 Live QA（需授权）。
8. 修复集成问题并通过全仓/Android/安全门槛。
9. 生产 migration、Account/Signaling deploy、APK build/publish 逐项另行决定。
10. Alpha 10.3 延期物理矩阵仍需在更广发布前补回。

## Validation Strategy

### Account

- grant/source authorization、refresh、expiry、slot、pair/room conflict。
- signed ingest timestamp/signature/body tamper。
- migration from 0001–0007 and empty DB。
- interval replay/conflict、revision reorder、transaction rollback。
- cross-midnight/month aggregation with offsets。
- keep/pending/delete/third-party/cascade/unbind race。

### Signaling

- deterministic overlap matrix for every valid/invalid condition。
- 5s reports, 12s stale, checkpoint, seek/rate semantics。
- wrong/expired grant and slot mismatch do not close socket。
- DO reload preserves active interval and pending ingest。
- retry/backoff/alarm multiplex and bounded flush grace。
- history dependency failure leaves existing room tests unchanged。

### Android

- grant only in account-bound active room flow。
- refresh and state cleanup on logout/unbind/anonymous/account switch/disconnect。
- periodic report cancellation and immediate state reports。
- list pagination, fallback metadata, monthly/date formatting, marker merge。
- loading/empty/error/read-only states in both themes and large-font constraints。

### QA

- A/B/C authorization and anonymous exclusion。
- live play/pause/buffer/stale/disconnect/media-change/ended fixtures。
- duplicate/reordered ingest and D1 evidence。
- archive retention/cascade and no sensitive log output。

## Rollback

- 规划阶段：删除 TK-005 draft 文件即可；不影响运行代码或线上环境。
- implementation 未 migration：回退 TK-005 commits，不改变 Alpha 10.3。
- Preview migration 后：可回退 Worker/Android 入口，新表保持闲置；不执行破坏性 down migration。
- Production migration 后：优先关闭 grant/history UI 与 Signaling tracker，保留新表等待修复；不得删除可信历史数据。
- 所有历史故障均应可通过关闭可选绑定回到 Alpha 10.3 房间能力。

## Principal Risks

- **漏记**：后台调度或报告 stale 会停止累计；通过透明错误状态和 QA 矩阵评估，不放宽到多记。
- **跨服务重复**：依靠 intervalId + revision + transaction，不依赖网络恰好一次。
- **解绑晚到写入**：source revoke 与 ingest authorization 必须在 Account 事务中最终裁决。
- **alarm 冲突**：统一 scheduler，禁止历史重试覆盖现有 room expiry。
- **元数据网络失败**：展示降级，不丢失区间。
- **范围膨胀**：completion、计划自动关联、单条管理、导出和多端统计均保持明确后置，除非用户另行确认。
