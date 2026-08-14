# Data Model: TK-001 单方面解绑

## Existing `pairs`

继续使用：

- `status`: `active | unbound`
- `unbound_at`: 解绑时间
- `unbound_by_user_id`: 发起解绑用户

解绑后 pair 不再可写，只为归档和未来 `pair_id` 子数据提供根记录。

## New `pair_archive_members`

| Column | Type | Rules |
|---|---|---|
| `pair_id` | TEXT | FK `pairs(id)` ON DELETE CASCADE |
| `user_id` | TEXT | FK `users(id)` ON DELETE CASCADE |
| `partner_user_id` | TEXT | FK `users(id)` ON DELETE RESTRICT |
| `partner_email_snapshot` | TEXT | 解绑时脱敏邮箱快照 |
| `partner_nickname_snapshot` | TEXT | 解绑时昵称快照 |
| `partner_avatar_snapshot` | TEXT | 解绑时头像 ID 快照 |
| `retention_status` | TEXT | `pending | keep | delete` |
| `decided_at` | INTEGER NULL | pending 时为空 |
| `created_at` | INTEGER | 解绑时间 |

Primary key: `(pair_id, user_id)`。

Index: `(user_id, retention_status, created_at DESC)`，用于查询待选择和归档列表。

## State Transitions

```text
active pair
  -> unbind transaction
  -> initiator: keep/delete
  -> partner: pending

pending -> keep
pending -> delete
keep/delete -> no transition in TK-001

both delete -> physical pair delete -> cascade archive members/future pair data
```

## Invariants

- `pair_archive_members` 只能引用已解绑 pair；对外摘要必须读取快照字段，不读取对方当前资料。
- 每个已解绑 pair 必须有两条成员记录，且用户与原 pair 成员完全一致。
- `active_pair_members` 中不得保留已解绑 pair 的成员。
- 只有 `keep` 记录可读取 Archive Summary；`pending` 只能读取决策提示；`delete` 不可读取旧空间。
- 物理删除条件只能由服务端在同一事务中判断双方均为 `delete`。

## Concurrency and Retry

- 解绑使用目标 `pairId` 条件更新：只有该精确 pair 为 `active` 且当前用户属于它时才能把状态改为 `unbound`；不得按“当前任意活动 pair”执行。
- 同一 D1 batch 的后续删除/插入语句必须绑定本次 `unbound_by_user_id` 和 `unbound_at`，条件更新未命中时不得产生归档记录。
- D1 batch 任一语句失败时整批回滚；调用方把条件更新未命中映射为并发冲突并刷新状态。
- 归档决定仅允许 `pending -> keep/delete`；同值重试返回现状，异值重试返回冲突。
- 第二个 `delete` 在同一事务中删除 pair 并级联清理。清理后不保留关系 tombstone；后续重试统一返回不泄露历史关系的 404，客户端刷新 GET 后视为状态已收敛。
