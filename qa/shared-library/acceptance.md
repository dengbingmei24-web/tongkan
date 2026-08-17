# TK-003 共享片库 Preview 验收

## 1. 范围

本包覆盖 T010、T019、T027、T033、T036：

- OpenAPI 成功/失败状态、固定错误码和 `currentRevision`。
- BV/B23 同媒体去重、批次部分成功、metadata `partial` 和零变化 revision。
- 分类、搜索、状态筛选、稳定排序、删除分类后条目置为未分类。
- 20 轮双方使用同一旧 revision 的并发写入。
- keep/pending/delete/第三方归档权限、重绑后的旧 pair 隔离。
- 双方 delete 后的 API 不可见性与 D1 级联清理证据。

不包含生产 migration、生产部署、Android 真机或真实用户数据。

## 2. 安全规则

- `run-preview.ps1` 只允许 `localhost`、`127.0.0.1` 或精确主机 `account-preview.tongkan-personal.pages.dev`。
- Token 和 Preview 测试密钥只从进程环境变量或 `-SecureStdin` 读取；不得放入命令参数、JSON、文件、截图或日志。
- runner 仅输出 case、请求名、HTTP 状态和错误码；失败时不输出请求体、响应体或夹具值。
- 所有账号、pair、分类和视频必须是可丢弃 Preview 数据；不得请求生产 API。

## 3. Live 前置

仅审查任务可以准备以下环境：

1. Preview D1 已审查并应用 `0005_shared_library.sql`，Preview Account Worker 已部署 W1 候选版本。
2. A 与 B 当前活动绑定，活动片库初始为空且没有自定义分类；C 无活动好友关系。
3. A 另有一个 `retention=keep` 的旧 pair，旧片库至少有一个条目；A 已与 B 重绑，旧条目 ID 供晚到写入隔离用例使用。
4. B 有一个仍为 `pending` 的旧 pair；A 有一个已选 `delete` 但 pair 尚未物理删除的旧 pair。
5. 另有一个双方均 delete 且已物理清理的 pair。
6. 准备两个指向同一 BVID+page 的公开 BV URL 与 B23 URL；准备一个无法安全解析的 B23 URL。
7. 准备两个不同于首个媒体的链接：一个由 Preview 夹具稳定触发 metadata `partial`，一个用于不存在分类逐项拒绝。
8. 搜索词必须只匹配首个成功添加条目；`TONGKAN_QA_RUN_ID` 每次运行唯一，建议使用日期时间短串。

需要的非 secret 进程环境变量：

| 变量 | 含义 |
| --- | --- |
| `TONGKAN_QA_RUN_ID` | 本轮唯一后缀 |
| `TONGKAN_QA_BV_URL` | 首个媒体的规范 BV URL |
| `TONGKAN_QA_B23_SAME_URL` | 与首个媒体相同的 B23 URL |
| `TONGKAN_QA_PARTIAL_URL` | 可规范化但 metadata 稳定失败的媒体 |
| `TONGKAN_QA_CATEGORY_MISS_URL` | 不同媒体，用于不存在分类拒绝 |
| `TONGKAN_QA_UNRESOLVED_B23_URL` | 无法安全解析的 B23 URL |
| `TONGKAN_QA_SEARCH_TERM` | 只匹配首个媒体的搜索词 |
| `TONGKAN_QA_KEEP_PAIR_ID` | A 可读的 keep 旧 pair |
| `TONGKAN_QA_PENDING_PAIR_ID` | B 的 pending 旧 pair |
| `TONGKAN_QA_DELETE_PAIR_ID` | A 已 delete、尚未物理删除的旧 pair |
| `TONGKAN_QA_BOTH_DELETED_PAIR_ID` | 双方 delete 后已物理删除的 pair |
| `TONGKAN_QA_OLD_ITEM_ID` | keep 旧 pair 中的条目 ID |

secret 输入为 A/B/C session token 和远程 Preview 的 `TONGKAN_QA_TEST_KEY`。

## 4. 静态校验

```powershell
Get-Content -Raw qa/shared-library/contract-cases.json | ConvertFrom-Json | Out-Null

$tokens = $null
$errors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile(
  (Resolve-Path qa/shared-library/run-preview.ps1),
  [ref]$tokens,
  [ref]$errors
)
if ($errors.Count) { $errors; exit 1 }

qa/shared-library/run-preview.ps1 -Mode ValidateOnly
git diff --check
```

`ValidateOnly` 不读取 secret、不要求夹具环境变量，也不发起网络请求。

## 5. Preview 执行

人工交互优先使用安全输入：

```powershell
qa/shared-library/run-preview.ps1 -Mode Live -SecureStdin
```

自动化只能把 secret 放在当前进程环境变量中，并在执行后清除。可用 `-CaseId` 选择单个用例；依赖用例会自动加入。对会写数据的用例重复运行前必须重置可丢弃活动片库或更换整套夹具。

### 必须通过

| 用例 | 关键结果 |
| --- | --- |
| `batch-b23-bv-dedupe` | added=1、duplicate=1、两个固定拒绝码、revision 仅 +1 |
| `zero-change-batches` | duplicate-only 与 rejected-only 均不改变 revision |
| `metadata-partial` | 条目保存且 `metadataStatus=partial` |
| `filter-status-sort-and-category-delete` | 组合筛选唯一命中；分类/条目顺序稳定；删分类后 `categoryId=null` |
| `request-validation-and-not-found` | 400/404 错误码精确且所有失败后 revision 不变 |
| `stale-revision-direct` | 409 `LIBRARY_VERSION_CONFLICT` 返回权威 `currentRevision` |
| `stale-revision-race-20` | 每轮恰好一个 200、一个 409，冲突 revision 等于成功 revision |
| `rebinding-old-item-isolation` | 旧条目写入 404，新活动 pairId/revision 不变 |
| `archive-keep-readable` | keep 快照 `readOnly=true` 且包含旧条目 |
| `archive-forbidden-states` | pending/delete/第三方均为 403 `ARCHIVE_FORBIDDEN` |
| `both-delete-not-found` | A/B/C 均为 404 `NOT_FOUND` |

## 6. D1 级联检查

仅审查任务在 Preview 上运行。命令、数据库 ID、完整 pairId 和完整输出不得提交；只保存脱敏计数证据。

```sql
SELECT COUNT(*) AS state_count
FROM pair_library_state
WHERE pair_id = '<BOTH_DELETED_PAIR_ID>';

SELECT COUNT(*) AS category_count
FROM library_categories
WHERE pair_id = '<BOTH_DELETED_PAIR_ID>';

SELECT COUNT(*) AS item_count
FROM library_items
WHERE pair_id = '<BOTH_DELETED_PAIR_ID>';
```

三个计数必须全部为 0。还需确认 `both-delete-not-found` 全部返回统一 404，避免只隐藏 API 但遗留 D1 行。

## 7. 证据记录

| 检查 | 结果 | 脱敏证据编号 |
| --- | --- | --- |
| JSON / AST / ValidateOnly / diff-check |  |  |
| BV/B23 去重与零变化 revision |  |  |
| partial、分类、筛选、状态和排序 |  |  |
| 20/20 revision race |  |  |
| keep/pending/delete/第三方权限 |  |  |
| 重绑后旧 pair 隔离 |  |  |
| 三张 D1 表计数均为 0 |  |  |

## 8. 阻断条件

- Preview 未应用 migration 或 Worker 未包含 TK-003 API。
- 无法提供稳定的 B23 同媒体、unresolved B23 或 metadata partial 夹具。
- A/B/C 拓扑与第 3 节不一致，或活动片库不是空夹具。
- 任一请求需要生产 URL、真实用户 token、真实邮箱或个人数据。
- 并发用例不是 20/20，或冲突响应缺失 `currentRevision`。
