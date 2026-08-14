# 同看多任务协作与审查流程

> 状态：已采用
> 决策来源：D-079
> 适用范围：跨 Android、Account Worker、信令、Web、协议或数据库的复杂任务

## 1. 角色

### 审查/控制任务

- 读取并维护 `CONTEXT.md`、`PROJECT_CONTEXT.md`、`DECISIONS.md` 和对应 PRD。
- 创建 Spec Kit 工件、任务合同、分支与 worktree。
- 管理依赖、解决冲突、执行集成测试、合并、部署和发布。
- 对执行结果给出 `APPROVED`、`CHANGES_REQUESTED` 或 `BLOCKED`。

### 执行任务

- 只处理一个有边界的工作包。
- 只在合同指定的分支、worktree 和写入范围内修改。
- 不更新全局上下文、不部署生产、不修改其他执行任务的文件。
- 完成后提交代码，并通过 Draft PR 或交接报告返回结果。

## 2. 持久通信

不同任务之间不依赖聊天记忆，统一使用：

1. `specs/TK-xxx-name/`：需求、计划、API/数据合同、任务和验收清单。
2. GitHub Issue：任务合同、进度、阻塞和审查结论。
3. Draft PR：可审查的提交、测试证据和变更讨论。
4. `handoff.md`：离线或暂时无法创建 PR 时的标准交接。

紧急阻塞也必须写入 Issue/PR 或 `handoff.md`，不能只发在某个任务的聊天里。

## 3. 开始门槛

- 基线必须已经提交，主工作区没有未说明的改动。
- spec、plan、contracts、tasks 和 requirements checklist 已通过审查。
- 每个执行任务有唯一编号、独立写入范围和明确依赖。
- 写入范围没有重叠；确实需要修改同一文件时必须改为串行任务。
- 不创建超过三个并行执行任务。

## 4. 分支与 worktree

- 任务编号：`TK-001`、`TK-002`……
- 分支：`codex/TK-001-account-unbind`。
- worktree 建议目录：仓库同级的 `tongkan-worktrees/TK-001-account-unbind`。
- 审查任务记录每个 worktree 的基线提交；执行任务不得自行 rebase、force push 或改写其他分支。

## 5. 任务合同

每个合同必须包含：

- 目标与非目标。
- 基线提交、分支、worktree。
- 允许写入和禁止写入路径。
- 前置依赖和冻结的 API/数据合同。
- 必须运行的测试。
- 完成定义、回滚方式和交接格式。

模板位于 `.specify/templates/task-contract-template.md`。

## 6. 交接与审查

执行任务的交接至少包含：

- 提交哈希和修改文件。
- 已完成的任务编号。
- 测试命令与结果。
- 数据迁移、兼容性、安全和回滚影响。
- 未完成项、阻塞和需要审查的风险。

审查任务按 `.specify/templates/review-verdict-template.md` 输出结论。`CHANGES_REQUESTED` 必须列出可执行问题和复验命令；执行任务只修退回范围，再次提交同一 PR。

## 7. 合并与发布门槛

- 所有合同任务和 checklist 项已完成或明确延期。
- 执行任务自身测试通过，审查任务集成测试通过。
- `git diff --check` 与凭据扫描干净。
- 数据库生产/预览迁移状态一致。
- 真机依赖项有物理验收记录；暂缓项明确写入 Known Issues。
- 只有审查任务可以合并、部署、构建发布 APK 和更新全局上下文。

## 8. 首个试点

首个试点为 `TK-001-unilateral-unbind`：单方面解绑、双方独立选择保留或删除旧双人空间。试点分为 Account Worker、Android 和 QA 合同三块，先验证完整的分配、提交、退回、修改和接受闭环，再扩大并行范围。
