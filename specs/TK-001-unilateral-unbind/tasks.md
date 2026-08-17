# Tasks: TK-001 单方面解绑与独立归档选择

## Phase 1: Reviewer Setup

- [x] T001 [REVIEW] 提交全部 Spec Kit、workflow 和 TK-001 工件，确认工作区干净并记录该提交为唯一 Worker 基线。
- [x] T002 [REVIEW] 用精确基线创建 W1-W3 Worker Issues、三个分支和 worktree，确认写入范围无重叠。

## Phase 2: W1 Account Worker

- [ ] T003 [W1] 新增 `apps/account/migrations/0004_pair_archives.sql`。
- [ ] T004 [W1] 在 `apps/account/src/models.ts` 增加归档记录、资料快照和公开响应类型。
- [ ] T005 [W1] 在 `apps/account/src/repository.ts` 实现 CAS 解绑、个人决定、归档查询、旧邀请码失效和双方删除清理。
- [ ] T006 [W1] 在 `apps/account/src/pair-service.ts` 实现目标 `pairId` 授权/CAS、状态校验、同值/异值重试和公开响应。
- [ ] T007 [W1] 在 `apps/account/src/worker.ts` 接入两个 POST 路由并扩展 GET 响应。
- [ ] T008 [W1] 在 `apps/account/src/pair-service.test.ts` 覆盖保留/删除组合、旧邀请码失效、越权、重试和物理删除。
- [ ] T009 [W1] 新增真实本地 D1 repository 集成测试，至少执行 20 轮并发解绑，覆盖旧 pair 请求晚到不影响新 pair，并用测试临时级联子表验证条件更新、回滚和物理删除。
- [ ] T010 [W1] 运行 account typecheck/test/build 和本地 D1 集成测试，提交并交接 Draft PR；不得应用远程 migration。

## Phase 3: W2 Android

- [ ] T011 [W2] 在 `AccountModels.java` 解析活动 pair、待选择和归档摘要，兼容旧响应。
- [ ] T012 [W2] 在 `AccountClient.java` 增加携带当前 `pairId` 的解绑请求和归档决定请求。
- [ ] T013 [W2] 在 `MainNavigationView.java` 增加解除绑定入口、确认/选择层、全部待选择卡和只读归档摘要。
- [ ] T014 [W2] 在 `MainActivity.java` 编排加载、重复点击保护、404 后权威刷新、成功和错误恢复。
- [ ] T015 [W2] 在 `AccountModelsTest.java` 覆盖新旧 JSON、稳定排序、pending/keep、pairDeleted 和非法响应。
- [ ] T016 [W2] 运行 Android 单测、Lint、assembleDebug，提交并交接 Draft PR。

## Phase 4: W3 QA

- [ ] T017 [W3] 创建 `qa/account-unbind/contract-cases.json`，覆盖 OpenAPI 成功、稳定错误码、旧 pair 请求晚到、旧邀请码和删除后重试。
- [ ] T018 [W3] 创建 `qa/account-unbind/run-preview.ps1`，token 只从环境变量或安全 stdin 读取，不接受命令行 token，不写入文件或日志。
- [ ] T019 [W3] 创建 `qa/account-unbind/acceptance.md`，覆盖双账号、多个 pending 排序、重启、重新绑定、20 轮并发和双方删除后的 D1 行检查。
- [ ] T020 [W3] 运行脚本静态检查并提交交接 Draft PR。

## Phase 5: Reviewer Integration

- [x] T021 [REVIEW] 审查 W1-W3 写入范围、提交和证据，退回所有合同外改动。
- [ ] T022 [REVIEW] 合并 W1，由审查窗口应用预览 migration 并运行在线双账号 API 用例。（已完成合并和 preview migration；稳定 preview Pages 路由与在线双账号用例待完成。）
- [x] T023 [REVIEW] 合并 W2，运行 `pnpm android:check` 并构建测试 APK。
- [ ] T024 [REVIEW] 合并 W3，执行预览黑盒矩阵、20 轮并发和真机验收。（已完成合并、20 轮本地 D1 并发与自动校验；在线 preview 与真机待完成。）
- [ ] T025 [REVIEW] 直接查询预览 D1，验证双方删除后当前真实存在的 `pairs` 与 `pair_archive_members` 行均不存在；未来子表级联只在 T009 的本地临时表验证。
- [x] T026 [REVIEW] 运行全仓 typecheck/test/build、diff check 和凭据扫描。
- [ ] T027 [REVIEW] 更新 PRD、QA、CONTEXT 和长期决策；生产 migration/部署另行确认。（本轮已更新 tasks/CONTEXT；生产 rollout 与最终验收后再关闭。）

## Dependencies

- T001-T002 阻塞所有执行任务；W1 只编写 migration，T022 由审查窗口应用。
- W1、W2、W3 可在冻结合同后并行。
- T022-T025 串行集成；T026-T027 在全部执行任务通过后进行。

## Done When

- 单方解绑立即释放唯一好友约束并使双方旧邀请码失效。
- 双方独立决定不会互相覆盖，同值重试、异值冲突和删除后刷新行为稳定。
- 保留者只读、删除者不可访问、双方删除触发 D1 行级物理清理。
- Android 重启可恢复权威状态并稳定展示多个待选择归档。
- 三个执行任务经历完整交接和审查结论流程。
