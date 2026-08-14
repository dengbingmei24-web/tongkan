# Quickstart: TK-001 审查与执行

## Reviewer setup

1. 确认工作区干净，记录 `git rev-parse HEAD` 为任务基线。
2. 为 W1-W3 建立 GitHub Worker Issue，填写精确基线和合同路径。
3. 在仓库同级目录创建 worktree：

```powershell
git worktree add ..\tongkan-worktrees\TK-001-W1-account -b codex/TK-001-W1-account <BASELINE>
git worktree add ..\tongkan-worktrees\TK-001-W2-android -b codex/TK-001-W2-android <BASELINE>
git worktree add ..\tongkan-worktrees\TK-001-W3-qa -b codex/TK-001-W3-qa <BASELINE>
```

4. 每个执行任务只收到对应 task contract、spec/plan/contract 路径和 worktree 路径。

## Worker handoff

1. 执行合同内的测试。
2. 在自己的分支提交，不 rebase、不部署。
3. 创建 Draft PR，填写 `.github/pull_request_template.md`；无法创建 PR 时复制 `.specify/templates/handoff-template.md` 到功能目录并填写。
4. 等待审查结论；`CHANGES_REQUESTED` 时只修列出的事项。

## Reviewer acceptance smoke test

```powershell
pnpm --filter @tongkan/account typecheck
pnpm --filter @tongkan/account test
pnpm --filter @tongkan/account build

$env:JAVA_HOME = "C:\tmp\android-build\jdk17\jdk-17.0.14+7"
$env:ANDROID_HOME = "C:\tmp\android-build\android-sdk"
pnpm android:check

git diff --check
```

预览迁移和线上测试只能由审查任务执行。生产迁移、Worker 部署和 APK 发布不属于执行任务。
