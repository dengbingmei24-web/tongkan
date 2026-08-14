# TK-001 预览与双账号验收

本清单定义单方面解绑与独立归档选择的预览环境验收方法。W3 只提供合同和证据模板；预览 migration、远程 D1 查询、真机操作、合并与部署均由审查任务执行。

## 1. 安全与环境门槛

- API 必须指向主机名含 `preview` 的 HTTPS 地址，或本机 `localhost/127.0.0.1`；脚本没有生产覆盖开关。
- Session Token 只通过进程环境变量 `TONGKAN_QA_TOKEN_A/B` 或 `-SecureStdin` 输入。
- 预览测试密钥只通过 `TONGKAN_QA_TEST_KEY` 或 `-SecureStdin` 输入。
- 禁止把 token、测试邮箱、邀请码、响应正文、数据库导出或私人资料写入仓库、Issue、PR、截图和日志。
- pairId 仅记录末 6 位用于证据关联；完整值只保存在当前验收进程环境变量中。
- 每个状态变更用例使用独立 pair；`same-decision-repeat` 与 `different-decision-conflict` 是唯一允许连续复用状态的一组。

静态校验不访问网络：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File qa/account-unbind/run-preview.ps1 `
  -Mode ValidateOnly
```

真实预览执行示例（token 在安全提示中输入，pairId 通过环境变量提供）：

```powershell
$env:TONGKAN_QA_PAIR_CONCURRENT = "<preview-pair-id>"
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File qa/account-unbind/run-preview.ps1 `
  -Mode Live `
  -CaseId concurrent-unbind `
  -SecureStdin
Remove-Item Env:TONGKAN_QA_PAIR_CONCURRENT
```

## 2. 基本信息与证据字段

| 字段 | 记录 |
| --- | --- |
| Reviewer 集成提交 |  |
| W1 / W2 / W3 提交 |  |
| 验收日期、时区 |  |
| 预览 API 主机名 | 仅主机名，不含密钥或查询参数 |
| 预览 D1 migration 状态 |  |
| Android APK 版本 / SHA-256 |  |
| 手机 A / Android 版本 |  |
| 手机 B / Android 版本 |  |
| 结论 | 通过 / 修复后复测 / 阻断 |

账号只写代号：A、B、C、D。截图必须遮蔽邮箱、token、邀请码和完整 pairId。

## 3. 用例数据准备

| 环境变量 | 独立状态 | 准备方法 |
| --- | --- | --- |
| `TONGKAN_QA_PAIR_SUCCESS` | A-B 活动 pair | 用于 A 选择 keep 成功解绑 |
| `TONGKAN_QA_PAIR_DELETE` | A-B 活动 pair | 用于 A 选择 delete 成功解绑 |
| `TONGKAN_QA_PAIR_MIXED` | A-B 活动 pair | A keep，B delete |
| `TONGKAN_QA_PAIR_BOTH_DELETE` | A-B 活动 pair | A delete，B delete |
| `TONGKAN_QA_PAIR_REPEAT` | A-B 活动 pair | 先执行同值重试，再执行异值冲突 |
| `TONGKAN_QA_PAIR_CONCURRENT` | A-B 活动 pair | 同时提交两次解绑 |
| `TONGKAN_QA_OLD_PAIR_ID` | A-B 已解绑 pair | A 随后与 C 绑定 |
| `TONGKAN_QA_NEW_PAIR_ID` | A-C 当前活动 pair | 验证旧请求晚到不影响它 |
| `TONGKAN_QA_DELETED_PAIR_ID` | 双方已 delete 的 pair | 用于删除后 404 与 D1 行检查 |
| `TONGKAN_QA_OLD_INVITE_CODE` | 解绑前创建、解绑后未使用的邀请码 | 验证事务使邀请码失效 |

每次重新准备活动 pair 后，先通过双方 `GET /api/pair` 确认相同 pairId 和 partner；不要把响应正文保存到磁盘。

## 4. API 合同验收矩阵

| # | 合同用例 | 操作 | 预期 | 结果 / 证据编号 |
| --- | --- | --- | --- | --- |
| 1 | `unbind-keep-success` | A 以 keep 解绑 | 200；A archive=keep；pairDeleted=false |  |
| 2 | `unbind-delete-success` | A 以 delete 解绑 | 200；A archive=null；B 仍 pending |  |
| 3 | `mixed-retention` | A keep，B delete | A 保留只读归档；B 不再看到旧空间；不物理删除 |  |
| 4 | `both-delete` | A delete，B delete | 第二次决定返回 pairDeleted=true |  |
| 5 | `same-decision-repeat` | B 连续提交 keep | 两次均 200，状态不重复写入 |  |
| 6 | `different-decision-conflict` | 已 keep 后改 delete | 409 `PAIR_RETENTION_FINAL` |  |
| 7 | `concurrent-unbind` | A/B 同时解绑同一 pair | 恰好一个 200、一个 409 `PAIR_UNBIND_CONFLICT` |  |
| 8 | `unauthorized-unbind` | 不带 Bearer Token | 401 `AUTH_REQUIRED` |  |
| 9 | `invalid-retention` | retention=`later` | 400 `PAIR_RETENTION_INVALID` |  |
| 10 | `late-old-pair-request` | A 已重绑 C 后发送旧 pair 请求 | 409 `PAIR_UNBIND_CONFLICT`；GET 仍返回 A-C 新 pair |  |
| 11 | `old-invite-invalidated` | B 接受解绑前旧邀请码 | 404 `PAIR_INVITE_NOT_FOUND` |  |
| 12 | `retry-after-physical-delete` | 对已清理 pair 重试决定 | 404 `PAIR_ARCHIVE_NOT_FOUND`，不泄露历史关系 |  |

错误响应只记录 HTTP 状态与 `error` 字段，不复制 `message` 或完整响应体。

## 5. 多个 pending 与稳定排序

使用 A、B、C、D 顺序创建并解绑至少三个关系，使一个测试账号拥有至少两个 `pendingArchives` 和一个 `archives`：

1. 每次解绑之间保留可区分的 `unboundAt`；同一时间戳测试需要测试夹具或审查任务批准的预览数据准备方式。
2. 关闭并重新打开 App，进入“我们”页；再调用一次 `GET /api/pair` 作为权威对照。
3. `pendingArchives` 与 `archives` 分别按 `unboundAt` 倒序、同时间按 `pairId` 升序。
4. `delete` 记录不得出现在任一列表；资料显示解绑时昵称、头像和脱敏邮箱快照。
5. 对任意一个 pending 作决定后，其余 pending 卡片保持原顺序和可操作状态。

| 检查 | 手机 A | 手机 B | API 对照 | 证据编号 |
| --- | --- | --- | --- | --- |
| 多个 pending 全部显示 |  |  |  |  |
| 倒序与 pairId 次排序 |  |  |  |  |
| delete 记录不返回 |  |  |  |  |
| 快照不随对方改名变化 |  |  |  |  |

## 6. Android 重启、解绑与重新绑定

1. A-B 活动绑定时，A 打开解绑确认层并连续点击提交；只允许一个请求处于加载态。
2. A 选择 keep，B 保持离线；A 成功后双方均应释放唯一好友约束。
3. 强制结束 A App 并重新打开；A 的只读归档仍存在，不恢复旧活动 pair。
4. B 重新打开 App；“我们”页显示 A 的解绑时资料、解绑日期和保留/删除选项。
5. A 与 C 新建绑定；A 同时看到 A-C 活动关系和 A-B 只读归档，旧归档不能写入邀请、片库或观看统计。
6. 发送 A-B 旧 pair 的延迟解绑请求；A-C 活动关系不变。
7. 再次强制结束并启动 A App；活动关系、pending、archives 与 API 权威状态一致。

| 证据 | 必填内容 |
| --- | --- |
| AND-01 | A 提交中的禁用/加载状态截图 |
| AND-02 | A 重启后只读归档截图 |
| AND-03 | B 重启后 pending 卡片截图 |
| AND-04 | A-C 新绑定与 A-B 旧归档同屏截图 |
| AND-05 | 延迟旧请求后 A-C 仍活动的 API 状态码与脱敏截图 |

## 7. 二十轮并发解绑

每轮必须创建新的活动 pair，设置 `TONGKAN_QA_PAIR_CONCURRENT` 后单独执行 `concurrent-unbind`。不得重放已解绑 pair 冒充新一轮。

每轮通过条件：

- 恰好一个请求返回 200。
- 恰好一个请求返回 409 `PAIR_UNBIND_CONFLICT`。
- 双方 `GET /api/pair` 均没有活动 A-B pair。
- 恰好两条用户级归档状态存在，不出现重复成员行。
- 双方均可立即创建新邀请码或重新绑定。

| 轮次 | pairId 后 6 位 | 200 发起方 | 冲突码 | 双方 GET | D1 行数 | 结果 |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |
| 6 |  |  |  |  |  |  |
| 7 |  |  |  |  |  |  |
| 8 |  |  |  |  |  |  |
| 9 |  |  |  |  |  |  |
| 10 |  |  |  |  |  |  |
| 11 |  |  |  |  |  |  |
| 12 |  |  |  |  |  |  |
| 13 |  |  |  |  |  |  |
| 14 |  |  |  |  |  |  |
| 15 |  |  |  |  |  |  |
| 16 |  |  |  |  |  |  |
| 17 |  |  |  |  |  |  |
| 18 |  |  |  |  |  |  |
| 19 |  |  |  |  |  |  |
| 20 |  |  |  |  |  |  |

## 8. 双方删除后的 D1 检查

仅审查任务在已应用预览 migration 后执行。查询工具、数据库 ID、账号凭据和完整输出不得写入本文件。

对 `TONGKAN_QA_DELETED_PAIR_ID` 验证：

```sql
SELECT COUNT(*) AS pair_count FROM pairs WHERE id = '<PAIR_ID>';
SELECT COUNT(*) AS archive_member_count FROM pair_archive_members WHERE pair_id = '<PAIR_ID>';
```

预期 `pair_count=0` 且 `archive_member_count=0`。未来级联子表只在 W1 本地 D1 临时表测试中验收；TK-001 预览库当前不存在的未来表不得伪造远程检查结果。

| 检查 | 结果 | 脱敏证据编号 |
| --- | --- | --- |
| `pairs` 行为 0 |  |  |
| `pair_archive_members` 行为 0 |  |  |
| 删除后 A 重试为统一 404 |  |  |
| 删除后 B 重试为统一 404 |  |  |

## 9. 最终判定

- [ ] 12 个 API 合同用例全部通过或有明确阻断 Issue。
- [ ] 多 pending、稳定排序、快照和 delete 隐藏通过。
- [ ] Android 双账号重启、重新绑定和延迟旧请求通过。
- [ ] 20/20 并发轮次通过，无重复归档或新 pair 被误解绑。
- [ ] 双方删除后 D1 当前真实行均为 0。
- [ ] 所有证据完成脱敏，未保存 token、测试密钥、邮箱、邀请码或响应正文。
- [ ] 未执行生产 migration、部署或生产 API 请求。
