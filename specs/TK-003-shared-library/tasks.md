# Tasks: TK-003 双人共享片库

## Phase 1: Reviewer Setup

- [x] T001 [REVIEW] 确认用户接受 Alpha 10.2 首版范围和三智能体分工，记录到 `CONTEXT.md`。
- [x] T002 [REVIEW] 创建 `spec.md`、`plan.md`、`research.md`、`data-model.md`、OpenAPI 和 requirements checklist。
- [x] T003 [REVIEW] 提交全部 TK-003 规格并记录唯一 Worker baseline commit。
- [x] T004 [REVIEW] 清理旧 worktree，创建 W1-W3 分支/worktree，确认工作区干净且写入范围无重叠。

## Phase 2: Foundational Backend and Client Contracts

- [x] T005 [W1] 在 `apps/account/migrations/0005_shared_library.sql` 创建 pair library state、categories、items、索引、检查约束和级联外键。
- [x] T006 [W1] 在 `apps/account/package.json` 与 `pnpm-lock.yaml` 增加内部 `@tongkan/protocol` workspace 依赖，不新增外部包。
- [x] T007 [W1] 在 `apps/account/src/library-models.ts` 定义记录、公开快照、批量结果和 revision 类型。
- [x] T008 [W1] 在 `apps/account/src/library-repository.ts` 实现 active/keep 授权查询、完整快照、CAS revision 和级联验证。
- [x] T009 [W2] 在 `apps/android/app/src/main/java/com/tongkan/mobile/account/AccountModels.java` 增加严格 LibrarySnapshot/Category/Item/BatchResult 解析和稳定排序。
- [x] T010 [W3] 在 `qa/shared-library/contract-cases.json` 固化 OpenAPI 成功/失败、错误码、revision 和归档权限用例。

## Phase 3: User Story 1 - 双端共享添加与浏览

- [x] T011 [W1] [US1] 在 `apps/account/src/bilibili-metadata.ts` 实现可注入 fetch 的受限 B23 最终地址解析与 best-effort 元数据解析，覆盖 HTTPS 主机、重定向、超时、响应/字段上限和 partial 降级。
- [x] T012 [W1] [US1] 在 `apps/account/src/library-service.ts` 实现最多 20 条批量规范化、pair 内真实 BV/av+page 幂等、1000 条上限、逐项结果和“有变化只递增一次”的原子 revision 语义。
- [x] T013 [W1] [US1] 在 `apps/account/src/worker.ts` 接入 `GET /api/library` 与 `POST /api/library/items/batch`。
- [x] T014 [W1] [US1] 在 `apps/account/src/library-service.test.ts` 覆盖有效、B23/BV 同媒体重复、部分失败、短链重定向限制、恶意域名、零变化 revision 和元数据失败。
- [x] T015 [W2] [US1] 在 `apps/android/app/src/main/java/com/tongkan/mobile/account/AccountClient.java` 实现读取快照和批量添加请求。
- [x] T016 [W2] [US1] 新建 `apps/android/app/src/main/java/com/tongkan/mobile/ui/LibraryScreen.java`，实现 Loading/Empty/Content/Error/未登录/未绑定状态与批量添加 Drawer。
- [x] T017 [W2] [US1] 在 `apps/android/app/src/main/java/com/tongkan/mobile/MainActivity.java` 将片库导航占位替换为真实加载、刷新、批量添加和会话恢复编排。
- [x] T018 [W2] [US1] 在 Android JVM 测试中覆盖快照、批量逐项结果、partial 元数据和非法 JSON。
- [x] T019 [W3] [US1] 在 `qa/shared-library/run-preview.ps1` 实现安全 token 输入、双账号读取、批量添加、B23/BV 去重、零变化 revision、重复和非法输入黑盒用例。

## Phase 4: User Story 2 - 分类、筛选、状态与排序

- [x] T020 [W1] [US2] 在 `apps/account/src/library-service.ts` 实现分类创建/重命名/删除/重排和名称冲突。
- [x] T021 [W1] [US2] 在 `apps/account/src/library-service.ts` 实现条目分类、unwatched/watched、删除、元数据刷新和完整重排。
- [x] T022 [W1] [US2] 在 `apps/account/src/worker.ts` 接入全部 category/item mutation 与 reorder 路由。
- [x] T023 [W1] [US2] 在 repository/integration tests 中至少运行 20 轮双方旧 revision 并发，验证零部分写入和稳定顺序。
- [x] T024 [W2] [US2] 在 `LibraryScreen.java` 实现搜索、全部/未观看/已看完筛选、自定义分类和条目操作 Drawer。
- [x] T025 [W2] [US2] 在 `LibraryScreen.java` 实现显式排序模式、原生长按拖放或等价明确移动操作，并在冲突时刷新提示。
- [x] T026 [W2] [US2] 在 `MainActivity.java` 编排分类、状态、删除、排序、冲突恢复和页面状态保持。
- [x] T027 [W3] [US2] 扩展 Preview runner 覆盖分类、搜索、筛选、删除分类置空、状态、排序和 version conflict。

## Phase 5: User Story 3 - 立即同看与归档只读

- [x] T028 [W1] [US3] 实现 `GET /api/pair/archives/{pairId}/library`，仅 keep 用户可读，pending/delete/第三方不可读。
- [x] T029 [W1] [US3] 增加解绑后写拒绝、旧 pair 请求晚到、keep 只读和双方 delete 级联清理 D1 测试。
- [x] T030 [W2] [US3] 在 `AccountClient.java` 与 `LibraryScreen.java` 支持归档只读快照和只读视觉状态。
- [x] T031 [W2] [US3] 在 `MainActivity.java` 复用现有 BilibiliMedia/房间流程实现立即同看与房间内换视频，保持 0 秒暂停和加载反馈。
- [x] T032 [W2] [US3] 增加播放入口、归档只读、未绑定和换视频状态 JVM 测试。
- [x] T033 [W3] [US3] 扩展 Preview runner 和 `qa/shared-library/acceptance.md`，覆盖 keep/pending/delete/第三方权限、重绑和 D1 清理。

## Phase 6: Worker Validation and Handoff

- [x] T034 [W1] 运行 Account typecheck/test/build、本地 D1 migration/integration，提交 W1 并按合同交接；不得应用远程 migration。
- [x] T035 [W2] 运行 Android 单测、Lint、assembleDebug，提交 W2 并按合同交接；不得修改版本号或生成 release APK。
- [x] T036 [W3] 运行 JSON 解析、PowerShell AST 和 ValidateOnly，提交 W3 并按合同交接；不得使用真实 token 作为参数或文件内容。

## Phase 7: Reviewer Integration

- [x] T037 [REVIEW] 独立审查 W1-W3 写入范围、提交和测试，对发现的问题给出 CHANGES_REQUESTED 并复验。
- [ ] T038 [REVIEW] 先集成 W1，运行 Account/local D1；审查后应用 Preview migration 0005 并部署 Preview Worker。
- [ ] T039 [REVIEW] 集成 W3，运行双账号 Preview 黑盒、20 轮 revision 冲突和直接 D1 级联查询。
- [ ] T040 [REVIEW] 集成 W2，运行 `pnpm android:check` 并构建 Alpha 10.2 测试 APK。
- [ ] T041 [REVIEW] 运行全仓 typecheck/test/integration/build、diff check、凭据扫描和文档链接检查。
- [ ] T042 [REVIEW] 更新 PRD、设计、QA、Decision、CONTEXT 和任务状态；生产 migration/部署另行获得用户批准。
- [ ] T043 [REVIEW] 打开 release 文件夹并交付双机片库验收清单。

## Dependencies

- T003-T004 阻塞所有 Worker。
- W1、W2、W3 在 OpenAPI 冻结后并行；W2 使用固定 JSON fixtures，不依赖 W1 worktree 编译。
- T038 → T039 → T040 串行集成；任何 Worker 未 APPROVED 不得进入集成。
- 生产 migration/Worker deploy 不属于 TK-003 默认授权。

## Done When

- 两个绑定账号看到同一完整片库、revision 和稳定顺序。
- 批量添加、partial 元数据、分类、筛选、状态、删除和排序可用。
- 并发旧 revision 不会静默覆盖。
- 从片库立即同看/换视频保持 0 秒暂停。
- keep 归档只读，双方 delete 后 D1 无片库残留。
- 三个 Worker、Preview、Android 和全仓门槛全部通过。
