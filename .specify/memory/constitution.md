# 同看（Tongkan）开发宪章

## 核心原则

### I. 用户体验与真实验收优先

- 功能必须解决已确认的双人同看需求，不以技术炫技扩大产品边界。
- Android 播放器、横屏、通知、账号恢复等依赖真实设备的行为，静态检查不能替代真机验收。
- 新体验先给出可独立验收的用户故事、失败状态和回滚路径；未经用户确认的视觉或交互方向不得进入生产实现。

### II. 房间控制与视频内容严格分离

- 服务端只同步房间成员、媒体标识和播放控制状态，不代理、下载、转码或中继 B站视频流。
- 房间固定最多两人；唯一好友是长期关系，匿名临时房间继续作为无需登录的兼容能力。
- 协议、播放器桥接和跨端行为变化必须同步共享契约、Android/Web 实现和回归测试。

### III. 凭据、身份与共享数据安全

- SMTP 授权码、Cloudflare Secret、Firebase 服务账号、房间密钥、Session Token 和设备 token 不得进入 Git、APK、日志、截图或上下文文档。
- 验证码、邮箱索引、会话和设备 token 使用既有 HMAC、哈希或加密边界；测试访问令牌必须显式选择且不能进入生产构建。
- 唯一好友和双人空间的数据操作必须验证当前账号关系；任何一方不得替另一方决定归档保留或删除。

### IV. 审查窗口拥有全局控制权

- 复杂任务由一个审查/控制任务维护规格、依赖、任务合同、验收、合并、部署和全局文档。
- 最多三个执行任务在独立 `codex/TK-xxx-*` 分支与 Git worktree 中工作；写入范围必须互不重叠。
- 执行任务在任何合同下都不得修改 `CONTEXT.md`、`DECISIONS.md`、`PROJECT_CONTEXT.md`、全局 PRD、生产配置或部署状态；这些改动只能由审查任务完成。
- Spec Kit 管理 constitution、specification、plan、contracts、tasks 和 checklist，不自动创建分支、自动提交、合并或部署。

### V. 最小改动、可验证和可回退

- Android 保持原生 Java + View + WebView、minSdk 26，不引入 Kotlin、Compose 或大型架构依赖。
- Account Worker、信令、Web、扩展和共享协议保持现有边界；新增依赖必须说明必要性。
- 每个任务修根因、不修无关问题；先运行最相关测试，再运行受影响模块和发布门槛。
- 未提交基线、测试失败、密钥扫描失败、迁移状态不一致或交接不完整时禁止并行、合并和部署。

## 项目约束

- 真源优先级：当前用户要求 > `AGENTS.md` > 已接受的 `DECISIONS.md` > `CONTEXT.md` > 对应 PRD/设计/部署/QA 文档。
- 动态状态只写 `CONTEXT.md`；长期决定写 `DECISIONS.md`；Spec Kit 工件不得替代这两份文件。
- Android 构建使用 JDK 17、Android SDK 35；中文路径失败时使用已约定的 ASCII 临时构建目录。
- 发布前至少通过 `pnpm typecheck`、`pnpm test`、`pnpm build`、适用的 Android 检查、`git diff --check` 和凭据扫描。
- 数据库迁移必须先审查 SQL，再验证生产与预览 D1 状态；执行任务不得自行部署生产迁移。

## 开发与审查流程

1. 审查任务读取四份上下文文件，确认干净且已提交的基线。
2. 在 `specs/TK-xxx-name/` 创建 spec、plan、contracts、tasks 和 requirements checklist。
3. 为每个执行任务填写任务合同：基线提交、分支、worktree、允许写入、禁止写入、依赖、测试和交接格式。
4. 执行任务只在合同范围内提交小而完整的变更，使用 Draft PR 或标准交接报告返回结果。
5. 审查任务给出 `APPROVED`、`CHANGES_REQUESTED` 或 `BLOCKED`，并把问题精确指向文件、测试或验收项。
6. 只有 `APPROVED` 的任务才能合并；审查任务负责集成测试、迁移、部署、版本产物和上下文更新。

## 治理

- 本宪章服从用户当前明确要求，但优先于普通 Spec Kit 模板和自动化默认值。
- 宪章修改必须同步检查 `.specify/templates/`、`docs/development/MULTI_SESSION_WORKFLOW.md` 和 `AGENTS.md`。
- 原则删除、审查权转移或安全边界弱化属于 MAJOR；新增原则或流程属于 MINOR；措辞与说明修正属于 PATCH。
- 每个复杂任务的 spec、plan、tasks 和 checklist 必须在实施前通过审查窗口的宪章检查。

**Version**: 1.0.0 | **Ratified**: 2026-08-14 | **Last Amended**: 2026-08-14
