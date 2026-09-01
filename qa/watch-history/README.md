# TK-005 Watch History QA

`qa/watch-history` 是 Alpha 10.4 共同观看历史的可执行合同入口。它覆盖 Android grant/report 生命周期、A/B/C 与匿名授权、严格 overlap、重试幂等、历史分页、UTC offset 月度聚合、日历实看 marker、keep 归档、pending/delete/第三方拒绝、双方 delete 级联和敏感输出边界。

## 安全默认

- 默认模式是 `ValidateOnly`，不会发出网络请求。
- 远程请求只允许精确 Preview 主机 `tongkan-account-preview-gateway.pages.dev`；生产 `tongkan-personal.pages.dev` 会被拒绝。
- Live token 与 Preview test key 只接受 `SecureString`，不得写入 JSON、脚本、日志或命令历史。
- runner 不打印响应正文，也不允许合同占位符引用 token、grant、signature 或 test key。
- 本执行任务只运行 ValidateOnly；Preview Live 必须由审查任务在用户另行授权后执行。

## 本地验证

```powershell
powershell -NoProfile -Command "$null = [System.Management.Automation.Language.Parser]::ParseFile('qa/watch-history/run-preview.ps1',[ref]$null,[ref]$null)"
powershell -NoProfile -File qa/watch-history/run-preview.ps1 -ValidateOnly
node -e "JSON.parse(require('fs').readFileSync('qa/watch-history/contract-cases.json','utf8')); console.log('ok')"
```

脚本参数使用 `-ValidateOnly` 或 `-Live`；不传模式时也安全地执行 ValidateOnly。当前 W3 交付只运行 ValidateOnly，不访问 Preview。

## Live 前置变量

HTTP case 中的非敏感占位符从当前进程环境变量读取：

- `ACTIVE_ROOM_ID`
- `MONTH`
- `TZ_OFFSET_MINUTES`
- `KEEP_PAIR_ID`

Live 还需要通过参数传入 `TokenA`、`TokenB`；涉及 C 的 case 需要 `TokenC`。所有 Signaling overlap、D1 retry/cascade 和 Android lifecycle case 都保留为 reviewer 集成合同，不由此脚本伪造生产或 Preview 证据。

## 结果解释

- `ValidateOnly PASS`：合同 JSON、覆盖标签、Preview 白名单和敏感字段扫描通过。
- `Live PASS`：选中的 HTTP case 返回允许状态；非 HTTP 合同仍需 reviewer 的 W1/W2 集成与 Preview Live QA。
- 任何历史依赖失败都不得被解释为房间、播放、聊天或邀请失败。
