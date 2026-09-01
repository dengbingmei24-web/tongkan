# Feature Specification: Alpha 10.4 共同观看历史与统计

**Candidate Feature Branch**: `codex/TK-005-history-statistics`

**Created**: 2026-09-01

**Status**: Ready for isolated implementation under D-092; deployment remains unauthorized

**Input**: 用户选择暂不执行 Alpha 10.3 剩余双设备验收，并要求继续规划开发。依据 D-069、D-079、D-091、账号与双人空间 PRD 和 Now/Next/Later 路线图，本阶段规划可信共同观看记录、历史列表、月度摘要、日历实看标记和 keep 归档只读。

## User Scenarios & Testing

### User Story 1 - 只记录双方真实共同播放时间 (Priority: P0)

已登录且仍处于同一活动好友绑定的双方，通过 App 内好友房间进入同一 B站视频。只有两端都完成账号房间授权、在线、媒体一致、播放器就绪、未暂停、未缓冲、未结束且应用到同一权威播放序列时，服务端才累计共同观看自然时间。

**Why this priority**: 如果统计由任一手机自行累加，或把匿名、单方在线、暂停和缓冲时间计入，后续所有历史与统计都会失去可信度。

**Independent Test**: A 创建并发布好友房间，A/B 分别完成房间认证和历史授权；模拟播放、暂停、缓冲、Seek、倍速、断线、媒体切换和授权过期，验证只有满足全部条件的墙钟重叠区间进入 Account D1。

**Acceptance Scenarios**:

1. **Given** A/B 为当前 pair 的 host/guest，双方授权有效且报告同一 BVID/page 与当前 sequence，**When** 权威锚点处于播放且两端报告 fresh、ready、not paused、not buffering、not ended，**Then** Signaling 按服务端墙钟累计重叠时间。
2. **Given** 任一方暂停、缓冲、报告过期、断线、结束、切换媒体、授权失效或解绑，**When** 状态变化被服务端观察到，**Then** 当前区间在对应服务端边界停止，不继续累计。
3. **Given** 用户执行 Seek 或使用非 1.0 倍速，**When** 播放继续有效，**Then** Seek 跳过的媒体位置不增加时长，倍速仍按实际共同经过的墙钟时间累计。
4. **Given** 匿名房间、direct-video、屏幕共享、只有一方授权或手工分享给第三方，**When** 正常观看，**Then** 房间能力不受影响，但不写入账号共同历史。

---

### User Story 2 - 查看共同观看历史与月度摘要 (Priority: P0)

绑定双方可以在“我们”页查看最近共同看过的视频、共同观看时长、本月观看次数和最近同看日期。数据读取失败只影响历史模块，不影响登录、好友、房间、播放、聊天、邀请、片库或日历计划。

**Why this priority**: 可信记账必须转化为可见价值，并且不能为了统计牺牲核心同看链路的可用性。

**Independent Test**: 向测试 pair 幂等写入跨暂停、多区间、跨日和重复重试数据，验证列表聚合、分页、月度总时长、次数、最近日期和重复请求不重复计数。

**Acceptance Scenarios**:

1. **Given** 同一 room/media session 包含多个有效区间，**When** 查询历史，**Then** 用户看到一个聚合条目及区间总和，不看到内部重试或碎片。
2. **Given** Signaling 重复提交相同 intervalId 或较旧 sourceRevision，**When** Account 接收，**Then** 返回幂等结果且总时长不增加第二次。
3. **Given** 某条记录缺少标题或封面元数据，**When** 查询历史，**Then** 仍返回 BVID/page、规范链接和占位展示，不丢弃可信时长。
4. **Given** Account 历史 API 或内部 ingest 暂时失败，**When** 用户继续观看，**Then** 房间与播放继续；Signaling 仅在后台重试可恢复的历史写入。

---

### User Story 3 - 在日历区分计划与实际观看 (Priority: P1)

用户打开日历时，可以区分“计划过”和“真正一起看过”的日期；日期详情把计划列表与实际共同观看分区展示。实际记录不会自动把计划标为完成。

**Why this priority**: Alpha 10.3 已解决“准备什么时候看”，Alpha 10.4 需要补上“那天实际看了什么”，但不能用不可靠匹配修改计划状态。

**Independent Test**: 同一天分别准备仅计划、仅实看、两者都有三组数据，验证月格标记与日期详情分区；任何实看写入都不改变 calendar revision 或 plan status。

**Acceptance Scenarios**:

1. **Given** 某日只有计划，**When** 查看月历，**Then** 保持 Alpha 10.3 计划标记。
2. **Given** 某日只有有效共同历史，**When** 查看月历，**Then** 显示独立实看标记并可打开“一起看过”。
3. **Given** 某日同时存在计划与实看，**When** 查看月历和详情，**Then** 两种状态可区分，且实际记录不自动完成、删除或改写计划。

---

### User Story 4 - 解绑后按既有保留选择查看旧历史 (Priority: P1)

解绑时选择 keep 的用户可以只读查看旧 pair 历史和统计；pending、delete、第三方与新好友均不能读取。双方最终 delete 后，历史源、区间和聚合记录随 pair 物理删除。

**Why this priority**: 共同观看记录属于双人空间，必须与已确认的片库和日历归档所有权保持一致。

**Independent Test**: A keep、B delete 后，A 可读旧历史但不能写，B 和 C 被拒绝；双方 delete 后本地 D1 查询所有 TK-005 表均无该 pair 残留。

## Functional Requirements

- **FR-001** Account MUST 只为当前活动 pair 的已认证用户签发 opaque 历史授权，授权绑定 `pairId`、`userId`、`roomId`、`slot`、签发时间、过期时间和唯一 grant id。
- **FR-002** 首次 host 授权 MUST 验证现有 `active_pair_rooms` 中的 host、room 和有效期；guest 授权 MUST 验证同一 pair 与同一已登记 history source。后续刷新只允许活动 pair 成员和未撤销 source。
- **FR-003** Android MUST 在现有房间 `auth.ok` 成功且 active-room publish/get 完成后申请授权，再发送可选 `history.bind`；授权失败不得关闭房间。
- **FR-004** Signaling MUST 验证授权签名、过期时间、当前 room、socket slot、pair 一致性和 host/guest 不同 user；不得接受 session token、邮箱、host key 或 invite key 作为历史身份。
- **FR-005** `playback.report` MUST 增加 `ended` 与 `durationSeconds`，Android 在播放房间中约每 5 秒上报，并在 play/pause/buffering/ended/media-change/前后台或断开等状态变化后立即上报。
- **FR-006** 报告默认在服务端接收后 12 秒内视为 fresh；`readyState >= 3`、`buffering=false`、`paused=false`、`ended=false`、BVID/page 与权威锚点一致且 `sequenceApplied` 等于当前 sequence 时，才满足计时条件。
- **FR-007** Signaling MUST 以服务端墙钟生成有效重叠区间；Seek 不增加时长，playbackRate 不放大或缩小时长。
- **FR-008** pause、buffering、stale report、disconnect、media change、ended、grant expiry、unbind/revocation、room expiry 和 history unbind MUST 关闭当前区间。
- **FR-009** Signaling MUST 为 source 使用单调 `sourceRevision`，为每个区间使用稳定唯一 `intervalId`，把未确认快照持久化在 Durable Object 并对可恢复失败重试。
- **FR-010** Account internal ingest MUST 使用独立服务绑定与请求签名验证，按 sourceRevision 和 intervalId 幂等处理；重复、乱序和网络重试不得重复计数。
- **FR-011** Account MUST 保存 UTC 区间和媒体身份，并聚合为用户可见 watch session；元数据补全失败不得拒绝有效区间。
- **FR-012** 当前 pair 的历史列表 MUST 支持稳定倒序分页，返回媒体、开始/结束时间、共同观看秒数和 `completionState`。
- **FR-013** 月度摘要 MUST 使用调用方提供的 `tzOffsetMinutes` 计算本地月份/日期，返回总共同观看秒数、可见 session 次数、不同视频数、最近同看日期和每日摘要。
- **FR-014** 日历 marker API MUST 返回指定月份的实际观看日期摘要；Android 在本地与 Alpha 10.3 calendar snapshot 合并，不复用或增加 calendar revision。
- **FR-015** Android MUST 在现有四 tab 架构中把当前 pair 历史/月度摘要放在“我们”，把实际观看标记合并到“日历”，不新增第五个主 tab。
- **FR-016** keep archive MUST 只读；pending/delete/第三方 MUST 拒绝；pair 物理删除 MUST 级联删除 history source、interval 和 session。
- **FR-017** 解绑事务 MUST 撤销该 pair 的活动 history source；撤销后新 ingest 不得继续形成可见历史。
- **FR-018** 历史读写、元数据补全、授权或 Signaling→Account 连接失败 MUST fail-open，不得阻断现有房间认证、同步播放、聊天、邀请、匿名模式、片库或日历计划。
- **FR-019** 第一切片 MUST 排除匿名房间、非 App 活跃好友房间、direct-video、screen-share、单方授权和媒体不一致区间。
- **FR-020** 第一切片 MUST NOT 提供单条编辑/删除、纠错、导出、排行榜、公开主页、自动完成日历计划或自动生成计划。
- **FR-021** 日志、错误响应、D1 和 Spec/QA 证据 MUST NOT 包含完整 session token、邮箱、房间 key、邀请 URL、授权 token、内部签名 Secret 或视频 Cookie。
- **FR-022** Alpha 10.3 剩余双设备矩阵 MUST 继续记录为 deferred/not passed；TK-005 的规划、实现或自动化测试不得改变该结论。

## WebSocket Protocol Additions

Android 在现有 `auth.ok` 后可发送：

```json
{ "type": "history.bind", "grant": "opaque-account-grant" }
```

Signaling 验证成功后只确认过期时间，不回传 pair/user/source：

```json
{ "type": "history.bound", "expiresAt": 1788228600000 }
```

现有 `error` event 增加 `INVALID_HISTORY_GRANT`、`HISTORY_GRANT_EXPIRED` 和 `HISTORY_BIND_CONFLICT`。这些错误只禁用当前 socket 的历史计时，不关闭 WebSocket。`playback.report.report` 在现有字段后增加必填 `ended: boolean` 与 nullable `durationSeconds: number`；旧客户端缺失这两个字段时仍可同看，但不满足 TK-005 计时能力。

## Frozen Product Decisions

| ID | 需要决定 | 建议默认 | 当前状态 |
|---|---|---|---|
| PD-001 | 多短的共同播放是否进入可见历史与统计 | 同一 watch session 累计满 60 秒才公开；底层有效区间可先保存 | 已接受 |
| PD-002 | “看完”如何定义 | Alpha 10.4 首切片保持 `completionState=unknown`，UI 暂不显示完成数量 | 已接受后置 |
| PD-003 | 月份和日期按哪个时区 | D1 存 UTC；每次查询使用 Android 当前 `tzOffsetMinutes`，不保存永久时区 | 已接受 |
| PD-004 | 实看记录是否关联日历计划 | 首切片仅按日期展示，不建立计划关联，绝不自动完成计划 | 已接受后置 |
| PD-005 | 保留、删除、纠错和导出 | 跟随 pair keep/delete；首切片不做单条管理、纠错或导出 | 已接受 |

用户于 2026-09-01 以“继续开发”接受以上默认并授权使用隔离智能体推进实现。该授权不包含 Preview/生产 migration、Worker deployment、APK build/publish 或 push。

## Edge Cases

- 一方先进入房间或只有一方完成 `history.bind`：等待另一方，不计时。
- 两份授权属于不同 pair、相同 user、错误 slot、错误 room 或已过期：拒绝该绑定，不影响 socket。
- 两端报告同一 BVID 但 page 不同，或 sequence 落后：不计时，等待一致。
- 暂停后晚到的旧播放报告：以服务端权威 anchor 与 sequence 为准，不恢复计时。
- 报告在 12 秒边界变 stale：区间结束时间最多到该报告的 stale deadline，不计入更晚时间。
- 手机休眠、切后台、网络切换或 WebView 卡死：报告停止后自动停止累计；恢复后需 fresh 报告重新开始。
- 跨午夜或跨月：按 UTC 区间与查询 offset 切分每日统计，不简单归到开始日期。
- 同一视频在一个房间内暂停/恢复：多个区间聚合到同一 watch session；media-change 离开后再回来生成新 session。
- Account 暂时不可用：Signaling 保存有限待确认队列并退避重试；达到清理上限后可放弃历史，但房间继续。
- metadata 获取失败或封面 URL 失效：显示占位，不删除记录。
- 解绑与 ingest 并发：Account 事务必须以 source 未撤销和 pair 授权为最终条件，晚到写入不得恢复旧空间。

## Success Criteria

- **SC-001** 在覆盖 play/pause/buffer/stale/disconnect/seek/rate/media-change/ended 的确定性时钟测试中，Account 最终总时长与服务端有效重叠误差不超过 1 秒，任何无效状态计时为 0。
- **SC-002** 20 轮重复、乱序和重试 ingest 中，每个 intervalId 最多计数一次，sourceRevision 不回退。
- **SC-003** 历史列表、月度摘要和日历 markers 对 A/B 返回一致；第三方、无 pair、pending/delete archive 均被拒绝。
- **SC-004** keep 用户可读旧历史且所有写入被拒绝；双方 delete 后 TK-005 D1 表对该 pair 均为 0 行。
- **SC-005** Account/ingest 故障注入时，现有房间认证、播放命令、聊天和邀请测试仍通过。
- **SC-006** Android JVM 测试覆盖 grant 生命周期、5 秒周期报告、立即报告、状态清理、分页、月度摘要、双 marker 和 archive 只读。
- **SC-007** 实现前 requirements checklist 的 PD-001..PD-005 均被接受或明确后置，且规划基线已获用户单独批准提交。

## Assumptions

- 首切片只支持 Android App 的账号模式 B站房间；Web/扩展仍可正常同看但不参与账号历史授权。
- 房间最多两人，host/guest slot 与当前协议一致。
- 统计使用服务端接收时间，不信任客户端 `sentAtClientMs` 作为计费边界。
- 当前产品是个人双人自用工具，不需要高吞吐分析仓库或第三方统计平台。

## Non-Goals

- 不保存、代理、下载或转码 B站视频流，不保存 B站账号、密码或 Cookie。
- 不支持多人统计、好友排行榜、连续打卡、成就、推荐或公开分享历史。
- 不在本规划中执行 migration、部署 Account/Signaling、构建 APK、push 或公开发布。
- 不把 Alpha 10.3 延期验收视为已通过。
