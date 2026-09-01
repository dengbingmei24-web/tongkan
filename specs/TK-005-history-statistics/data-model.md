# Data Model: TK-005 共同观看历史与统计

## watch_room_sources

每个获得账号历史授权的房间一行，连接 Account 的 pair 身份与 Signaling 的临时 room。

| 字段 | 类型 | 约束 |
|---|---|---|
| `id` | TEXT | 32 位小写 hex PK，sourceId |
| `pair_id` | TEXT | FK → `pairs(id)` ON DELETE CASCADE |
| `room_id` | TEXT | 32 位小写 hex，UNIQUE |
| `host_user_id` | TEXT nullable | FK → `users(id)` ON DELETE SET NULL |
| `guest_user_id` | TEXT nullable | FK → `users(id)` ON DELETE SET NULL |
| `status` | TEXT | `active` / `closed` / `revoked` |
| `last_ingested_revision` | INTEGER | 非负，默认 0 |
| `absolute_expires_at` | INTEGER | source 最长可刷新时间，Unix ms |
| `created_at` | INTEGER | Unix ms |
| `updated_at` | INTEGER | Unix ms |
| `closed_at` | INTEGER nullable | 正常结束时间 |
| `revoked_at` | INTEGER nullable | 解绑或授权撤销时间 |

### Source Rules

- host 首次申请 grant 时，Account 必须同时验证当前 `active_pair_rooms` 的 `pair_id`、`host_user_id`、`room_id` 和有效期，再创建 source。
- guest 申请时，必须是同一活动 pair 的另一位用户，并写入 `guest_user_id`；host/guest 不得为同一 user。
- 同一 `room_id` 不得绑定到第二个 pair；冲突返回 `HISTORY_SOURCE_CONFLICT`。
- grant 过期不关闭 source；活动 pair 成员可在 `absolute_expires_at` 前刷新。
- 解绑事务将该 pair 的所有 active source 更新为 `revoked`；新 ingest 必须被拒绝。
- 正常房间关闭后可标记 `closed`，但已写入历史继续保留。

## watch_intervals

Signaling 生成的不可变有效墙钟区间，是统计的审计真源。

| 字段 | 类型 | 约束 |
|---|---|---|
| `id` | TEXT | 32 位小写 hex PK，intervalId |
| `source_id` | TEXT | FK → `watch_room_sources(id)` ON DELETE CASCADE |
| `session_id` | TEXT | 32 位小写 hex，同一次 room/media watch session |
| `pair_id` | TEXT | FK → `pairs(id)` ON DELETE CASCADE |
| `source_revision` | INTEGER | >0，首次包含该 interval 的 revision |
| `bvid` | TEXT | 与共享片库 BVID 规则一致 |
| `page` | INTEGER | >=1 |
| `canonical_url` | TEXT | 受信 B站规范 URL，<=1000 |
| `title_hint` | TEXT nullable | Signaling 可提供的非权威展示提示，<=160 |
| `duration_seconds_hint` | REAL nullable | >0，播放器报告提示，不作为累计值 |
| `started_at` | INTEGER | 服务端 Unix ms |
| `ended_at` | INTEGER | 服务端 Unix ms，> started_at |
| `watched_ms` | INTEGER | `ended_at - started_at`，>0 |
| `end_reason` | TEXT | 见下方枚举 |
| `created_at` | INTEGER | Account 接收时间，Unix ms |

`end_reason` 允许：

- `pause`
- `buffering`
- `stale-report`
- `disconnect`
- `media-change`
- `ended`
- `grant-expired`
- `history-unbind`
- `room-expired`
- `checkpoint`

### Interval Rules

- 相同 `id` 与完全相同 canonical fields 重放为幂等成功。
- 相同 `id` 但 source/session/media/time 不同返回 `HISTORY_INTERVAL_CONFLICT`，不得覆盖。
- `watched_ms` 由 Account 再计算并校验，不信任请求中的任意累计秒数。
- 单区间设置合理上限，建议 <=60 秒；长时间连续播放由 Signaling checkpoint 切片。
- 索引：`(pair_id, started_at, ended_at)`、`(session_id, started_at, id)`、`(source_id, source_revision, id)`。

## watch_sessions

面向用户的聚合记录。同一 `session_id` 下 pause、buffer、短断线等产生的多个 interval 聚合为一条历史。

| 字段 | 类型 | 约束 |
|---|---|---|
| `id` | TEXT | 32 位小写 hex PK，sessionId |
| `source_id` | TEXT | FK → `watch_room_sources(id)` ON DELETE CASCADE |
| `pair_id` | TEXT | FK → `pairs(id)` ON DELETE CASCADE |
| `room_id` | TEXT | 32 位小写 hex |
| `bvid` | TEXT | 媒体身份 |
| `page` | INTEGER | >=1 |
| `canonical_url` | TEXT | <=1000 |
| `title_snapshot` | TEXT | 1–160；无法补全时使用 BVID fallback |
| `cover_url_snapshot` | TEXT nullable | 受信 HTTPS URL，<=1000 |
| `metadata_source` | TEXT | `library` / `bilibili` / `fallback` |
| `started_at` | INTEGER | min(interval.started_at) |
| `ended_at` | INTEGER | max(interval.ended_at) |
| `watched_ms` | INTEGER | sum(interval.watched_ms) |
| `interval_count` | INTEGER | >0 |
| `completion_state` | TEXT | 首切片固定 `unknown`；预留 `completed` / `incomplete` |
| `created_at` | INTEGER | Unix ms |
| `updated_at` | INTEGER | Unix ms |

### Session Rules

- media-change 后再回到相同 BVID/page 必须使用新 sessionId，不与之前跨媒体合并。
- pause/buffer/stale 后在同一 room/media 恢复，可以继续使用原 sessionId。
- Account 在同一 ingest 事务中插入 interval，并只对受影响 session 重算 min/max/sum/count。
- 用户查询默认只返回达到 PD-001 最短阈值的 session；阈值未确认前不得写成长期承诺。
- `completion_state` 首切片保持 `unknown`，Android 对 unknown 隐藏完成标签和完成数量。
- 索引：`(pair_id, started_at DESC, id DESC)`、`(pair_id, bvid, page, started_at)`。

## Grant Envelope

grant 对 Android 是 opaque string。签名前的版本化 payload：

```json
{
  "v": 1,
  "grantId": "32hex",
  "sourceId": "32hex",
  "pairId": "32hex",
  "userId": "32hex",
  "roomId": "32hex",
  "slot": "host",
  "iat": 1788228000000,
  "exp": 1788228600000
}
```

- 编码建议：base64url(payload JSON) + `.` + base64url(HMAC-SHA256(payload segment))。
- grant 日志只允许记录 grantId/sourceId 后 6 位或哈希，不得输出完整 token。
- Signaling 使用独立 `HISTORY_GRANT_SECRET` 验证；不复用 Session Token 密钥。

## Ingest Snapshot

Signaling 通过 Account Service Binding 提交当前未确认的累计快照：

```json
{
  "sourceId": "32hex",
  "pairId": "32hex",
  "roomId": "32hex",
  "sourceRevision": 7,
  "observedAt": 1788228660000,
  "closed": false,
  "participants": {
    "hostUserId": "32hex",
    "guestUserId": "32hex"
  },
  "intervals": [
    {
      "intervalId": "32hex",
      "sessionId": "32hex",
      "media": {
        "bvid": "BV1xx411c7mD",
        "page": 1,
        "canonicalUrl": "https://www.bilibili.com/video/BV1xx411c7mD"
      },
      "startedAt": 1788228620000,
      "endedAt": 1788228650000,
      "endReason": "checkpoint",
      "durationSecondsHint": 1320
    }
  ]
}
```

### Ingest Transaction

1. 验证 Service Binding 请求签名、timestamp 和 body 大小。
2. 读取 source，要求 pair/room/participants 匹配且 source 未 revoked、未超过绝对寿命。
3. 若 `sourceRevision < last_ingested_revision`，返回当前 revision，不写入。
4. 对 interval 做格式、媒体、时间范围和 ID 冲突校验。
5. 幂等插入新 interval，重算受影响 session。
6. 更新 `last_ingested_revision`、source 状态与时间戳。
7. 返回 `acceptedRevision` 和已确认 interval IDs；整个流程单事务提交。

## Public History Snapshot

```json
{
  "pairId": "32hex",
  "readOnly": false,
  "nextCursor": null,
  "items": [
    {
      "id": "32hex",
      "roomId": "32hex",
      "startedAt": 1788228620000,
      "endedAt": 1788231020000,
      "watchedSeconds": 2280,
      "completionState": "unknown",
      "media": {
        "bvid": "BV1xx411c7mD",
        "page": 1,
        "canonicalUrl": "https://www.bilibili.com/video/BV1xx411c7mD",
        "title": "标题或 BV fallback",
        "coverUrl": null
      }
    }
  ]
}
```

## Monthly Summary

```json
{
  "pairId": "32hex",
  "readOnly": false,
  "month": "2026-09",
  "tzOffsetMinutes": 480,
  "totalWatchedSeconds": 7200,
  "sessionCount": 3,
  "distinctVideoCount": 2,
  "completedCount": null,
  "lastWatchedDate": "2026-09-01",
  "days": [
    {
      "date": "2026-09-01",
      "watchedSeconds": 3600,
      "sessionCount": 1
    }
  ]
}
```

## Timezone and Day Allocation

- D1 只保存 UTC Unix ms。
- 请求的 `tzOffsetMinutes` 范围建议为 `-840..840`。
- Account 将请求月份转换为 UTC 查询窗口，读取重叠 interval，再按 offset 的本地午夜切分 watched ms。
- 一条 interval 跨午夜时，两天分别获得真实重叠秒数；sessionCount 建议按 session 在该日存在可见秒数计 1。
- 当前固定 offset 不表达历史 DST；若未来需要跨时区精确回放，再引入用户时区设置或 IANA zone。

## Retention and Deletion

- keep archive 读取 `watch_sessions` 与 interval 聚合，返回 `readOnly=true`。
- pending/delete/第三方无读取权。
- source/session/interval 不提供首切片单条 mutation。
- pair 物理删除通过 FK cascade 清除全部 TK-005 数据。
- 用户、邮箱、token、room key、invite URL 和 Cookie 不进入任何历史表。
