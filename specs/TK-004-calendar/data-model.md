# Data Model: TK-004 双人观看日历

## pair_calendar_state

每个 pair 一行，负责日历乐观并发版本。

| 字段 | 类型 | 约束 |
|---|---|---|
| `pair_id` | TEXT | PK，FK → `pairs(id)` ON DELETE CASCADE |
| `revision` | INTEGER | 非负，默认 0 |
| `created_at` | INTEGER | Unix ms |
| `updated_at` | INTEGER | Unix ms |

- migration 必须为所有现有 pair 回填 state。
- 接受新好友邀请创建 pair 时，必须与 `pair_library_state` 一样初始化 calendar state。

## calendar_plans

| 字段 | 类型 | 约束 |
|---|---|---|
| `id` | TEXT | 32 位小写 hex PK |
| `pair_id` | TEXT | FK → `pairs(id)` ON DELETE CASCADE |
| `library_item_id` | TEXT nullable | FK → `library_items(id)` ON DELETE SET NULL |
| `scheduled_date` | TEXT | `YYYY-MM-DD` |
| `start_time` | TEXT nullable | `HH:mm` |
| `note` | TEXT nullable | trim 后 1–200 字符 |
| `status` | TEXT | `planned` / `completed` |
| `bvid` | TEXT | 与片库媒体身份约束一致 |
| `page` | INTEGER | ≥1 |
| `canonical_url` | TEXT | 受信 B站规范 URL，≤1000 |
| `title_snapshot` | TEXT | 1–160 字符 |
| `cover_url_snapshot` | TEXT nullable | 受信 HTTPS URL，≤1000 |
| `created_by_user_id` | TEXT nullable | FK → users ON DELETE SET NULL |
| `created_by_nickname_snapshot` | TEXT | 1–40 字符 |
| `updated_by_user_id` | TEXT nullable | FK → users ON DELETE SET NULL |
| `updated_by_nickname_snapshot` | TEXT | 1–40 字符 |
| `created_at` | INTEGER | Unix ms |
| `updated_at` | INTEGER | Unix ms |
| `completed_at` | INTEGER nullable | 状态为 completed 时填写 |

## Constraints and Indexes

- `UNIQUE(pair_id, library_item_id, scheduled_date)`，仅在 `library_item_id` 非空时阻止同日误重复。
- 月份读取索引：`(pair_id, scheduled_date, start_time, created_at, id)`。
- 今日未完成索引：`(pair_id, status, scheduled_date, start_time, created_at, id)`。
- `scheduled_date` 必须通过服务层做真实日期验证；SQLite CHECK 只校验形状。
- `start_time` 必须通过服务层做 24 小时真实时间验证。

## Calendar Snapshot

```json
{
  "pairId": "32hex",
  "revision": 4,
  "readOnly": false,
  "range": { "from": "2026-08-01", "to": "2026-08-31" },
  "plans": [
    {
      "id": "32hex",
      "libraryItemId": "32hex-or-null",
      "date": "2026-08-19",
      "startTime": "20:00",
      "note": "吃完饭一起看",
      "status": "planned",
      "media": {
        "bvid": "BV1xx411c7mD",
        "page": 1,
        "canonicalUrl": "https://www.bilibili.com/video/BV1xx411c7mD?p=1",
        "title": "标题快照",
        "coverUrl": "https://...jpg"
      },
      "createdBy": { "id": "user-a", "nickname": "小同" },
      "updatedBy": { "id": "user-b", "nickname": "小看" },
      "createdAt": 1787100000000,
      "updatedAt": 1787100000000,
      "completedAt": null
    }
  ]
}
```

## Mutation Rules

- 创建：从当前 pair 的 `library_items` 读取并复制媒体快照。
- 更新：允许修改 `date`、`startTime`、`note`、`status`，至少提供一个字段。
- 完成：`planned → completed` 设置 `completed_at=now`；恢复 planned 时清空。
- 删除：物理删除计划，用于“取消计划”。
- 每次成功 mutation 只增加一次 `pair_calendar_state.revision`。
- 所有 mutation SQL 必须同时约束 active membership 与 expected revision，晚到请求不能写入归档。
