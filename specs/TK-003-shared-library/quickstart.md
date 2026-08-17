# Quickstart: TK-003 双人共享片库

## Reviewer Setup

1. 以冻结规格提交为三个 Worker 的共同 baseline。
2. 创建 W1 Account、W2 Android、W3 QA 独立分支和 worktree。
3. Worker 不得修改全局 Context、PRD、Decision、Spec 或生产配置。

## Local Validation

```powershell
pnpm --filter @tongkan/protocol build
pnpm --filter @tongkan/account typecheck
pnpm --filter @tongkan/account test
pnpm --filter @tongkan/account build
pnpm android:check
pnpm typecheck
pnpm test
pnpm build
```

## Preview Acceptance

1. 审查并应用 `0005_shared_library.sql` 到 `tongkan-account-preview`。
2. 部署 Preview Account Worker，不修改生产环境。
3. 使用两个测试账号绑定后运行 `qa/shared-library/run-preview.ps1`。
4. 验证批量添加、重复、分类、筛选、revision 冲突、解绑只读和双方删除清理。
5. Preview 通过后构建 Android 测试 APK并执行双机验收。

## Rollback

- 代码：回退 TK-003 集成提交。
- Preview Worker：回退到前一版本。
- D1 migration 为前向迁移；生产部署前必须完成 Preview 验收和数据备份。未获用户明确批准不得应用生产 migration。
