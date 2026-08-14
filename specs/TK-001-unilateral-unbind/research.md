# Research: TK-001 单方面解绑

## Decision 1: 使用 pair 级冻结 + 用户级保留记录

**Decision**: 保留现有 `pairs.status='unbound'` 作为冻结标记，新增每用户一条 `pair_archive_members` 记录保存 `pending/keep/delete`。

**Rationale**: 关系状态和个人数据决定是两个维度；拆开后任意一方都不能覆盖另一方决定，也能在双方删除前保留共同底层数据。

**Alternatives rejected**:

- 在 `pairs` 上保存一个全局 `retention`：无法表达双方不同选择。
- 解绑时复制两份完整空间：增加存储和一致性成本，未来片库/日历表也会重复。

## Decision 2: 解绑事务立即释放活动成员表

**Decision**: 同一 D1 batch 中通过 `status='active'` 条件更新/CAS 变更 pair；后续语句绑定本次发起人和解绑时间，再删除两条 `active_pair_members`、插入双方资料快照与归档成员记录，并使双方未使用邀请码失效。任一语句失败整批回滚。

**Rationale**: 唯一好友约束必须立即释放；部分成功会导致用户无法重新绑定或归档缺失。

解绑请求必须携带界面当前显示的 `pairId`。即使旧请求超时后晚到，服务端也只 CAS 该历史 pair，不会操作用户后来绑定的新关系。

## Decision 3: 扩展现有好友查询响应

**Decision**: 保留 `GET /api/pair` 的 `pair` 字段，并新增 `pendingArchives` 与 `archives`，避免破坏已发布 Android 解析。

**Rationale**: 老客户端忽略新增 JSON 字段；新客户端一次请求即可渲染活动关系、待选择和归档。

## Decision 4: 首次决定不可逆，keep 后续删除延期

**Decision**: 本试点只允许 `pending -> keep/delete`。`delete` 永久不可恢复；从 `keep` 主动删除归档作为后续独立功能。

**Rationale**: 防止删除后又恢复已经物理清理的数据，同时控制首版范围。

同值重试在归档记录存在时返回当前结果，异值重试返回冲突。双方删除后不保留关系 tombstone；后续请求返回与未知归档相同的 404，客户端刷新列表后视为状态已收敛。

## Decision 5: 不依赖推送完成解绑

**Decision**: 另一方通过登录恢复、前台刷新或进入“我们”页获得待选择状态；推送只可作为后续提示。

**Rationale**: FCM 真机送达仍暂缓，解绑的数据正确性不能依赖通知渠道。

## Decision 6: 归档使用解绑时资料快照

**Decision**: 每条归档成员记录保存对方解绑时的昵称、头像 ID 和脱敏邮箱快照；查询按解绑时间倒序和 pairId 升序稳定返回，且不返回 `delete` 记录。

**Rationale**: 历史摘要不应因对方后续改名或换头像而变化，稳定排序也让 Android 重启后的页面一致。
