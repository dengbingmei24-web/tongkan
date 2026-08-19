# Quickstart: TK-004 Calendar Validation

## Prerequisites

- 合同中的 `TBD_CLEAN_BASELINE` 已替换为真实提交哈希。
- W1/W2/W3 worktree 从同一干净基线创建。
- 不在生产环境运行 migration 或黑盒，除非用户单独批准。

## Account Worker

```powershell
pnpm --filter @tongkan/account typecheck
pnpm --filter @tongkan/account test
pnpm --filter @tongkan/account build
```

本地 D1 必须验证：

- migration 0007 可从空库和已有 0001–0006 数据升级。
- A/B 读取一致。
- 20 轮 revision race 每轮一个成功、一个冲突。
- 失败请求 revision 不变。
- keep archive 只读。
- 双方 delete 后 state/plans 均为 0 行。

## Android

```powershell
pnpm android:test
pnpm android:lint
pnpm android:build
```

JVM 测试必须覆盖：

- Calendar JSON 解析与无效响应拒绝。
- 月份/日期/时间格式。
- 18:30、20:00、当天的排序。
- today 只显示 planned。
- revision conflict 的 currentRevision。
- 创建/修改请求对空时间和空备注归一化。

## QA Contract

```powershell
powershell -NoProfile -File qa/calendar/run-preview.ps1 -ValidateOnly
```

Preview 实际请求必须使用一次性 A/B/C 账号，完成后删除 session、fixture 和测试数据。日志不得包含完整 token、邮箱、房间邀请密钥或 Secret。

## Reviewer Gates

```powershell
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
git diff --check
```

最终发布前仍需：

- Alpha 10.2.4 暂缓的双设备 P0 记录保持未通过。
- Alpha 10.3 日历双设备物理验收。
- 生产 migration/Worker/APK 的独立用户授权。
