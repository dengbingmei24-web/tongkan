# TK-004 Calendar QA Acceptance

## 1. 目的与边界

本目录提供 Alpha 10.3 双人观看日历的离线合同校验和可选 Preview 黑盒 runner。它验证活动 pair 双方一致性、输入边界、计划 CRUD、稳定排序、today 过滤、乐观并发、旧 pair 隔离、归档权限和双方 delete 后的级联定义。

- 默认只运行 `ValidateOnly`，不读取凭据、不创建 HTTP client、不发送网络请求。
- Live 只允许精确 Preview gateway 或 localhost/127.0.0.1，禁止生产入口。
- runner 不创建账号、不绑定或解绑好友、不准备归档状态、不执行 migration/deployment/D1 查询。
- A/B/C token 与 Preview test key 只接受本次进程内的 `SecureString` 参数，不写入环境变量、文件或日志。

## 2. 合同文件

- 用例：`qa/calendar/contract-cases.json`
- Runner：`qa/calendar/run-preview.ps1`
- 冻结 API：`specs/TK-004-calendar/contracts/openapi.yaml`
- 合同 schemaVersion：`1`
- 用例总数：`16`

## 3. Preview 夹具拓扑

Live 前由审查任务准备可丢弃 Preview 数据：

- A/B：当前活动 pair 的双方。
- C：已登录但没有活动 pair，且不是被测归档 pair 成员。
- 三个不同的当前共同片库条目，以及一个属于其他 pair 的条目 ID。
- 五组互不重叠的空白活动日期：CRUD、改期、排序、重复和连续 20 天 race。
- keep/pending/delete/双方 delete 四类旧 pair；keep 月份包含已知计划。
- `RUN_ID` 只使用字母、数字、`-`、`_`，不得包含邮箱或个人信息。

## 4. Case Inventory

| Case | 关键验收 |
| --- | --- |
| `unauthorized-calendar` | 未登录 month/today/create 均为 401 `AUTH_REQUIRED` |
| `no-pair-account` | C 读取和创建均为 409 `PAIR_REQUIRED` |
| `active-calendar-a-b-baseline` | A/B 的 pairId、revision、range 一致，readOnly=false |
| `calendar-query-boundaries` | 非法月份/日期拒绝，闰年范围正确，读取不增 revision |
| `mutation-input-boundaries-no-revision` | 非法 ID、外部条目、日期、时间、201 字备注均失败且 revision 不变 |
| `create-plan-a-b-consistency` | A 创建，空白备注归一化为 null，B 读取相同媒体与 actor 快照 |
| `update-and-complete-plan` | B 改期、A 完成；today 排除 completed，普通 date 保留 |
| `delete-plan` | DELETE 后双方不可见，revision 仅 +1 |
| `same-day-sort-month-date-today` | 18:30 → 20:00 → 当天；A/B 与 month/date/today 一致 |
| `duplicate-plan-no-revision` | 同条目同日第二次创建为 409 `PLAN_ALREADY_EXISTS` 且不增 revision |
| `stale-revision-no-overwrite` | loser 为 409 `CALENDAR_VERSION_CONFLICT`，winner 不被覆盖 |
| `revision-race-20` | 20/20 每轮一个 200、一个 409，冲突 revision 等于成功 revision |
| `late-old-pair-write` | 旧计划 ID 不能写入新活动 pair，新 pairId/revision 不变 |
| `archive-keep-readonly` | keep 归档 200、readOnly=true、包含既有计划 |
| `archive-forbidden-states` | pending/delete/第三方均为 403 `ARCHIVE_FORBIDDEN` |
| `both-delete-api-and-d1-cascade` | A/B/C 均 404；D1 三类残留计数应为 0 |

## 5. 离线验证

在仓库根目录执行：

```powershell
powershell -NoProfile -Command "$null = [System.Management.Automation.Language.Parser]::ParseFile('qa/calendar/run-preview.ps1',[ref]$null,[ref]$null)"
powershell -NoProfile -ExecutionPolicy Bypass -File qa/calendar/run-preview.ps1 -ValidateOnly
node -e "JSON.parse(require('fs').readFileSync('qa/calendar/contract-cases.json','utf8')); console.log('ok')"
git diff --check -- qa/calendar specs/TK-004-calendar/handoffs/TK-004-W3-qa.md
```

若本机允许脚本执行，可省略 `-ExecutionPolicy Bypass`。

## 6. Live 调用方式

只在审查任务明确准备 Preview 夹具后执行。不要把 SecureString 或 fixture 值保存到脚本或命令历史。推荐先在当前 PowerShell 进程读取 SecureString，再用 call operator 调用：

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
$tokenA = Read-Host 'Token A' -AsSecureString
$tokenB = Read-Host 'Token B' -AsSecureString
$tokenC = Read-Host 'Token C' -AsSecureString
$testKey = Read-Host 'Preview test key' -AsSecureString

& .\qa\calendar\run-preview.ps1 -Live \
  -TokenA $tokenA -TokenB $tokenB -TokenC $tokenC -PreviewTestKey $testKey \
  -LibraryItem1 '<hex>' -LibraryItem2 '<hex>' -LibraryItem3 '<hex>' \
  -ForeignLibraryItemId '<hex>' \
  -CrudDate '<yyyy-MM-dd>' -CrudUpdatedDate '<yyyy-MM-dd>' \
  -SortDate '<yyyy-MM-dd>' -DuplicateDate '<yyyy-MM-dd>' -RaceStartDate '<yyyy-MM-dd>' \
  -KeepPairId '<hex>' -KeepMonth '<yyyy-MM>' -KeepPlanId '<hex>' \
  -PendingPairId '<hex>' -DeletePairId '<hex>' -DeletedPairId '<hex>' \
  -RunId '<safe-run-id>'

$tokenA = $tokenB = $tokenC = $testKey = $null
```

可用 `-CaseId` 选择用例；runner 会递归加入依赖。Live 日历日期必须为空白，重复运行前应更换整套日期或重置可丢弃 Preview 数据。

## 7. Reviewer-only D1 级联证据

Runner 只校验以下定义，不执行数据库命令。审查任务在隔离 Preview D1 上使用参数化查询并只保留脱敏计数：

```sql
SELECT COUNT(*) AS row_count FROM pairs WHERE id = ?1;
SELECT COUNT(*) AS row_count FROM pair_calendar_state WHERE pair_id = ?1;
SELECT COUNT(*) AS row_count FROM calendar_plans WHERE pair_id = ?1;
```

三项均应为 `row_count=0`。不得提交数据库 ID、完整 pairId、token 或原始命令输出。

## 8. 当前证据

| 检查 | 状态 | 说明 |
| --- | --- | --- |
| PowerShell AST | PASS | Runner 可解析 |
| JSON parse | PASS | 16 个唯一 case |
| ValidateOnly | PASS | 无 secret read、HTTP client 或网络请求 |
| Preview Live | NOT RUN | 需要审查任务准备一次性 Preview 夹具 |
| Preview D1 cascade | NOT RUN | 仅审查任务在隔离 Preview D1 执行 |
| Production | FORBIDDEN | 本合同不得访问生产 |

## 9. 阻断条件

- Preview 未应用 migration `0007_calendar_plans.sql` 或 Worker 未包含 TK-004 API。
- A/B/C、活动片库、空白日期或四类归档夹具不满足第 3 节。
- 任一 URI 解析到非 allowlist host，或发生重定向。
- 任一输出包含 token、完整邮箱、fixture 值、请求体或原始响应。
- 20 轮 race 任一轮不是严格一个成功和一个冲突。
- 双方 delete 后 API 仅隐藏数据但 D1 仍有残留。
