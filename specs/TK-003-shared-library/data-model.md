# Data Model: TK-003 双人共享片库

## pair_library_state

| 字段 | 类型 | 约束 |
|---|---|---|
| pair_id | TEXT | PRIMARY KEY，FK pairs(id) ON DELETE CASCADE |
| revision | INTEGER | NOT NULL，初始 0，所有写操作原子 +1 |
| created_at | INTEGER | NOT NULL，Unix ms |
| updated_at | INTEGER | NOT NULL，Unix ms |

## library_categories

| 字段 | 类型 | 约束 |
|---|---|---|
| id | TEXT | PRIMARY KEY，32 位小写 hex |
| pair_id | TEXT | NOT NULL，FK pairs(id) ON DELETE CASCADE |
| name | TEXT | NOT NULL，trim 后 1-24 字符 |
| name_key | TEXT | NOT NULL，规范化后用于 pair 内唯一 |
| position | INTEGER | NOT NULL，>=0 |
| created_by_user_id | TEXT | 可空，FK users(id) ON DELETE SET NULL |
| updated_by_user_id | TEXT | 可空，FK users(id) ON DELETE SET NULL |
| created_at | INTEGER | NOT NULL |
| updated_at | INTEGER | NOT NULL |

唯一索引：`(pair_id, name_key)`。排序索引：`(pair_id, position, created_at, id)`。

## library_items

| 字段 | 类型 | 约束 |
|---|---|---|
| id | TEXT | PRIMARY KEY，32 位小写 hex |
| pair_id | TEXT | NOT NULL，FK pairs(id) ON DELETE CASCADE |
| media_key | TEXT | NOT NULL，例如 `bilibili:BV...:p1` |
| bvid | TEXT | NOT NULL |
| page | INTEGER | NOT NULL，>=1 |
| cid | INTEGER | 可空 |
| canonical_url | TEXT | NOT NULL，只允许规范 B站 HTTPS URL |
| title | TEXT | NOT NULL，最大 160 字符，失败时回退媒体标识 |
| cover_url | TEXT | 可空，只允许 HTTPS，最大 1000 字符 |
| owner_name | TEXT | 可空，最大 80 字符 |
| duration_seconds | INTEGER | 可空，>=0 |
| metadata_status | TEXT | `ready` 或 `partial` |
| category_id | TEXT | 可空，FK library_categories(id) ON DELETE SET NULL |
| watch_status | TEXT | `unwatched` 或 `watched` |
| position | INTEGER | NOT NULL，>=0 |
| added_by_user_id | TEXT | 可空，FK users(id) ON DELETE SET NULL |
| added_by_nickname_snapshot | TEXT | NOT NULL |
| updated_by_user_id | TEXT | 可空，FK users(id) ON DELETE SET NULL |
| updated_by_nickname_snapshot | TEXT | NOT NULL |
| created_at | INTEGER | NOT NULL |
| updated_at | INTEGER | NOT NULL |

唯一索引：`(pair_id, media_key)`。查询索引：pair+status、pair+category、pair+position。

## Invariants

1. 所有 category/item 的 pair_id 必须与 pair_library_state 一致。
2. 活动写操作从认证用户的 active pair 推导 pair_id。
3. expectedRevision 与当前 revision 不同则零写入。
4. 重排请求必须覆盖目标集合的全部 ID，不能包含其他 pair、缺失或重复 ID。
5. 删除分类只置空 item.category_id。
6. archive keep 只读现有 pair 数据；pending/delete 不可读。
7. pairs 行删除后，三个片库表均无残留。
8. 单个 pair 最多 1000 个 library_items；达到上限后不得产生部分越界写入。
9. `library_items.bvid` 只保存已解析的 `BV...` 或 `av...` 身份，不保存 unresolved `b23:*`。
10. 一个 mutation 请求发生一项或多项实际变化时 revision 只增加一次；零变化请求不增加。
