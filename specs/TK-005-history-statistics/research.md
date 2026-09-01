# Research: TK-005 共同观看历史与统计

## R-001 可信计时由 Signaling Durable Object 负责

**Decision**: 最终共同观看时间由房间 Durable Object 根据双方连接、账号授权、权威播放锚点和最新播放器报告计算；Android 不提交累计秒数，Account 不从单端事件推断重叠。

**Rationale**: Durable Object 已拥有 host/guest slot、连接状态、权威媒体和播放 sequence，是唯一能同时观察双方状态并防止单端重复累计的位置。

**Rejected**:

- Android 本地计时后上传：任一端后台、重连、时钟漂移或重复提交都会造成不一致。
- Account 根据房间创建/关闭时间估算：无法排除暂停、缓冲、媒体不一致和单方在线。

## R-002 使用 Account 签发的独立短期 room grant

**Decision**: Account 为当前活动 pair 签发 opaque HMAC grant，payload 绑定 source、pair、user、room、slot、grantId、iat 和 exp；Signaling 只接收 grant，不接收账号 session token。

**Rationale**: 当前房间 key 只证明 host/guest 权限，不能证明账号 pair。独立 grant 可以最小化跨服务暴露，并保持匿名房间完全兼容。

**Lifecycle**:

1. host 创建房间并通过现有 `/api/pair/active-room` 发布。
2. host 在 `auth.ok` 后申请首个 grant；Account 验证 active-room 并创建 history source。
3. guest 从 App active-room 进入并在 `auth.ok` 后申请同一 source 的 guest grant。
4. Android 在过期前刷新；刷新要求当前 pair 仍活动、source 未撤销且未超过绝对寿命。
5. 解绑事务撤销 source；短 grant 到期与 Account ingest 授权共同限制晚到计时。

**Technical defaults**: 单次 grant 10 分钟、`refreshAfter` 5 分钟、source 绝对寿命 8 小时；这些是安全/生命周期常量，不改变 active-room 对好友的可发现时长。

## R-003 播放报告采用 5 秒心跳与 12 秒 stale 边界

**Decision**: Android 播放中约每 5 秒发送一次 `playback.report`，并在状态变化时立即发送；服务端接收后 12 秒未更新即视为 stale。

**Rationale**: 5 秒足以在手机网络下控制流量，12 秒允许一次抖动或调度延迟，又不会在 App 休眠后长期虚增时长。

**Notes**:

- `sentAtClientMs` 仅诊断，不作为计时边界。
- stale alarm 使用服务端 `receivedAtMs + 12s`。
- 实现测试使用可注入时钟，不等待真实 5/12 秒。

## R-004 有效播放条件采用严格交集

**Decision**: 同时满足以下条件才打开区间：

- host 与 guest 均 connected、已完成房间 auth。
- 两份有效 grant 属于相同 pair/room、不同 user，并与 socket slot 一致。
- room mode 为 `bilibili`，权威 anchor 有已解析 B站媒体且 `paused=false`。
- 两端报告 fresh、`readyState >= 3`、`paused=false`、`buffering=false`、`ended=false`。
- 两端报告 BVID/page 与 anchor 一致，`sequenceApplied` 等于当前 sequence。

**Rationale**: 条件宁可少记也不多记；历史是回顾数据，错误增加比短暂漏记更难解释。

## R-005 时长按服务端墙钟，不按媒体位置差

**Decision**: 区间时长为服务端有效开始和结束的墙钟差；Seek 不增加时间，倍速不改变时间倍率。

**Rationale**: 用户问的是“两个人一起看了多久”，不是播放头跨过了多少内容。媒体 position 可作为一致性证据，但不作为累计值。

## R-006 使用 sourceRevision + intervalId 幂等快照

**Decision**: 每个 history source 维护单调 `sourceRevision`；每个关闭的有效区间拥有稳定 `intervalId` 和 `sessionId`。Signaling 持久化未确认快照，Account 在一个事务中幂等插入区间并更新 session 聚合。

**Rationale**: Durable Object 到 Account 的网络请求可能超时、重复或乱序。稳定 ID 防止重复计数，revision 防止旧快照覆盖新状态。

**Rules**:

- 相同 intervalId + 相同内容为成功重放。
- 相同 intervalId + 不同内容为不可恢复合同冲突。
- 较旧 revision 返回当前 acceptedRevision，不回滚。
- 较新 revision 可跨号接受，前提是请求携带全部未确认 interval。

## R-007 Signaling→Account 使用 Service Binding + HMAC 请求签名

**Decision**: 生产由审查任务为 Signaling 配置 Account Service Binding；内部 ingest 同时校验时间戳、原始 body HMAC 和有限时钟偏差。

**Rationale**: Service Binding 避免公开 DNS 依赖，HMAC 防止内部路径被意外暴露或重放。两者仍不得替代 interval 幂等。

**Rejected**:

- 把 Account bearer token 存进 Durable Object。
- 只依赖一个可复制的静态 Bearer Secret 且无 body/timestamp 绑定。

**Technical default**: 请求时间戳允许相对 Account 服务端时间最多 ±5 分钟；签名覆盖 `timestamp + "\n" + rawBody`。

## R-008 Durable Object alarm 统一管理 stale、grant、重试与空房清理

**Decision**: RoomDurableObject 计算最近的下一事件并只设置一个 alarm，包括报告 stale、grant 到期、ingest 重试和房间空置清理。待确认历史不能无限阻止房间销毁，必须有有限 flush grace。

**Rationale**: Cloudflare Durable Object 每个对象只有一条 alarm 时间线；为每类事件建立独立定时器不可行。

**Fail-open boundary**: 历史队列超过重试上限或清理期限可丢弃并记录脱敏诊断，核心房间不得因此延长到无限或拒绝连接。

## R-009 D1 保存 UTC 原始区间与派生 session

**Decision**: D1 保存 UTC ms、不可变 intervals 和可重建 watch sessions。月度/日历查询接收 `tzOffsetMinutes`，Account 在服务层把跨日区间切分到调用方本地日期。

**Rationale**: 只保存开始日期会错误处理跨午夜；把设备本地日期写入 D1 又会让双方或旅行后的视图不一致。当前范围不引入 IANA 时区数据库。

## R-010 历史元数据是 best-effort，不是记账前置条件

**Decision**: 可信身份只依赖 BVID/page/canonicalUrl。标题和封面优先从当前 pair 片库快照匹配，其次可使用现有 B站元数据解析；失败时返回 BVID fallback 和占位封面。

**Rationale**: 外部元数据网络波动不能造成观看时间丢失。封面是展示增强，不是授权或幂等键。

## R-011 UI 保持四 tab，不自动修改计划

**Decision**: 月度摘要与最近历史放在“我们”；实际观看 marker 与日期详情合并进现有“日历”。实际记录不增加第五个 tab，也不写 calendar revision 或自动完成 plan。

**Rationale**: 当前导航已经稳定，历史属于双人空间；自动完成需要尚未确认的计划匹配和完成规则。

## R-012 归档沿用 pair retention，首切片不做单条管理

**Decision**: keep 只读，pending/delete/第三方拒绝，双方 delete 依靠 pair FK 级联。单条删除、纠错、导出和自定义保留周期明确后置。

**Rationale**: 与片库/日历一致的所有权最容易解释，也避免首版引入双方删除冲突和审计问题。

## R-013 产品默认值已冻结

**Accepted on 2026-09-01**:

- 可见 session 最短 60 秒。
- `completionState=unknown`，首切片隐藏完成数。
- 查询使用当前设备 `tzOffsetMinutes`。
- 日历只按日期展示，不自动关联或完成计划。
- 历史跟随 pair keep/delete，无单条管理。

用户以“继续开发”接受上述首切片默认；长期改变仍需新的产品决策。
