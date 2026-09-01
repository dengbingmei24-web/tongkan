# Quickstart: TK-005 History/Statistics Validation

## Planning Prerequisites

- PD-001..PD-005 已被用户接受或明确后置。
- 用户已批准提交 TK-005 规划 baseline，并另行授权开始实现。
- W1/W2/W3 合同 baseline 已固定为 `9473dcdba18341169ad3e7e0ac976f9140cf65b5`。
- W1/W2/W3 worktree 从同一 clean baseline 创建。
- `合作方-透明.png` 保持排除。
- 未获得单独授权时，不运行 Preview/Production migration、部署或 APK 发布。

## W1 Account Worker

```powershell
pnpm --filter @tongkan/account typecheck
pnpm --filter @tongkan/account test
pnpm --filter @tongkan/account build
```

本地 D1 必须验证：

- migration 0008 可从空库和现有 0001–0007 升级。
- host first grant、guest grant、refresh、expiry、wrong pair/room/slot。
- internal HMAC timestamp、body tamper、过期签名和缺失 binding。
- 20 轮重复/乱序 ingest 不重复计数，interval conflict 全事务回滚。
- UTC interval 在 `-840/0/480/840` offset 下正确跨日与跨月。
- keep archive 只读，pending/delete/第三方拒绝。
- unbind 与 ingest race 不产生晚到可见历史。
- 双方 delete 后 source/interval/session 均为 0 行。

## W2 Protocol and Signaling

```powershell
pnpm --filter @tongkan/protocol typecheck
pnpm --filter @tongkan/protocol test
pnpm --filter @tongkan/signaling typecheck
pnpm --filter @tongkan/signaling test
pnpm --filter @tongkan/signaling build
```

确定性时钟测试必须覆盖：

- 双方授权/在线/ready/同媒体/同 sequence/播放时累计。
- 单方授权、pause、buffer、stale、disconnect、ended、media mismatch、sequence lag 时为 0。
- Seek 不增加时长，倍速按墙钟计时。
- 5 秒 report 与 12 秒 stale 边界。
- checkpoint、DO reload、pending interval replay 和 alarm multiplex。
- Account 网络失败、5xx、4xx、签名失败时房间仍可播放和聊天。

## W3 Android

```powershell
pnpm android:test
pnpm android:lint
pnpm android:build
```

JVM/UI state tests 必须覆盖：

- 仅账号好友 active-room 在 `auth.ok` 后申请 grant。
- grant refresh、expiry、logout、unbind、anonymous/account switch、disconnect 清理。
- 周期 report 启停和 play/pause/buffer/ended/media-change 即时报送。
- history 分页、fallback metadata、monthly summary、timezone 和 marker merge。
- 计划 marker 与实际 marker 同时存在，且 plan status/revision 不改变。
- keep archive 只读，loading/empty/error 可恢复。

## QA Contract

```powershell
powershell -NoProfile -File qa/watch-history/run-preview.ps1 -ValidateOnly
node -e "JSON.parse(require('fs').readFileSync('qa/watch-history/contract-cases.json','utf8')); console.log('ok')"
```

Preview Live QA 只有在用户批准后执行，必须：

- 使用一次性 A/B/C 账号和新 room。
- 不打印 bearer token、完整邮箱、room key、invite URL、grant 或 internal signature。
- 覆盖匿名排除、双 grant、overlap matrix、幂等重试、archive 和 cascade。
- 完成后清理 session、device token、pair、source 和测试数据。

## Reviewer Integration Gates

```powershell
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
git diff --check
```

审查任务还需检查：

- OpenAPI YAML 可解析，Markdown 本地链接有效。
- migration SQL 无 destructive down 操作。
- Account/Signaling Secrets 仅出现在示例名称，不包含值。
- Signaling `wrangler.toml` 的 Service Binding 由审查任务单独修改和评审。
- Alpha 10.3 双设备物理矩阵仍记录为 deferred/not passed。

## Release Gates

以下动作互不授权，必须分别获得用户批准：

1. Preview migration 0008。
2. Preview Account/Signaling deployment 与 Live QA。
3. Production D1 backup + migration 0008。
4. Production Account Worker deployment。
5. Production Signaling Worker deployment。
6. Alpha 10.4 APK build。
7. APK publication、push 或更广发布。

即使 TK-005 自动化和 Preview 全部通过，也不能自动宣称 Alpha 10.3 物理矩阵通过。
