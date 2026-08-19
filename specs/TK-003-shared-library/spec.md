# Feature Specification: Alpha 10.2 双人共享片库

**Feature Branch**: `codex/TK-003-shared-library`

**Created**: 2026-08-17

**Status**: Implemented and deployed to production; physical dual-device acceptance deferred

**Input**: 用户确认现在完成 Alpha 10.2 共享片库，并采用一个审查任务加三个隔离执行智能体并行开发。

## User Scenarios & Testing

### User Story 1 - 两个人看到同一份待看片库 (Priority: P1)

已登录且已绑定好友的任意一方可以一次粘贴一个或多个 B站链接。系统保存规范化媒体身份和尽可能完整的标题、封面、UP 主、时长快照；另一方刷新后看到完全相同的条目。元数据暂时获取失败时，条目仍以 BVID 占位保存并可后续刷新。

**Why this priority**: 共享保存和双端一致性是片库的最小用户价值，没有它就只是单机列表。

**Independent Test**: 两个测试账号绑定后，账号 A 批量添加三个有效链接和一个重复链接；账号 B 查询时看到相同三个唯一条目、相同顺序和元数据状态。

**Acceptance Scenarios**:

1. **Given** 两个账号处于活动绑定，**When** 任一方批量提交不超过 20 个 B站链接，**Then** 所有有效且不重复的媒体进入当前 `pairId` 的共享片库，并返回逐项 added/duplicate/rejected 结果；同一视频的 B23 与最终 BV/av 链接必须识别为重复。
2. **Given** B站元数据服务暂时失败，**When** 媒体身份可以规范化，**Then** 条目以 partial 元数据状态保存，标题至少回退为 BVID/分P，不因封面失败丢失用户输入。
3. **Given** 用户未登录或未绑定好友，**When** 请求活动片库或修改条目，**Then** 服务端拒绝且不会创建孤立数据。

---

### User Story 2 - 分类、搜索和排序共同维护 (Priority: P2)

绑定双方可以创建自定义分类、搜索视频、筛选未观看/已看完、修改分类、标记状态、删除条目，并在显式排序模式中调整分类和视频顺序。双方同时修改时，旧版本写入不得静默覆盖新版本。

**Why this priority**: 多个视频放入后必须能快速找到并共同整理，否则长期片库很快失去可用性。

**Independent Test**: 账号 A 与 B 从同一 revision 开始；A 先重排成功，B 使用旧 revision 重排得到版本冲突，刷新后按新 revision 重试成功。

**Acceptance Scenarios**:

1. **Given** 活动片库已有条目，**When** 任一方创建/重命名/删除分类，**Then** 双方读取到相同分类；删除分类只使条目变为未分类，不删除视频。
2. **Given** 双方持有不同 revision，**When** 较旧客户端提交排序或修改，**Then** 返回 `LIBRARY_VERSION_CONFLICT` 和当前 revision，客户端刷新而不是覆盖。
3. **Given** 用户输入搜索词或状态/分类筛选，**When** 查询片库，**Then** 返回匹配条目并保持服务端稳定排序。

---

### User Story 3 - 从片库开始同看与查看旧空间 (Priority: P3)

用户可以从片库选择视频立即创建房间；已在房间时可以切换当前视频并看到明确加载反馈。新视频准备完成后停在 0 秒等待手动播放。解绑后选择保留的用户仍可查看旧空间片库，但不能编辑或发起旧空间写操作。

**Why this priority**: 片库最终要服务于同看，同时必须遵守已确认的解绑归档数据所有权。

**Independent Test**: 从活动片库选择一个分 P 视频进入现有房间流程并停在 0 秒；解绑并保留后通过归档入口看到相同条目，任何修改请求均被拒绝。

**Acceptance Scenarios**:

1. **Given** 活动片库条目有效，**When** 用户点击立即同看，**Then** Android 复用现有房间/播放器流程并传入规范化 B站媒体身份。
2. **Given** 用户已在房间，**When** 从片库选择另一视频，**Then** 显示正在更换，准备成功后广播切换并保持 0 秒暂停。
3. **Given** 用户对旧 pair 的归档状态为 keep，**When** 打开旧片库，**Then** 返回只读快照；pending/delete/无权限用户不得读取。

### Edge Cases

- 批量输入包含分享文案、BV 链接、分 P、b23 短链、重复链接和非法域名；B23 只允许有限次 HTTPS 跳转到受信 B站域名，无法解析到真实 BV/av 身份时逐项拒绝。
- 同一 BVID 的不同分 P 视为不同媒体；相同 BVID+page 在同一 pair 内唯一。
- 一个批次部分成功时不得整体回滚已验证条目，但必须逐项返回结果。
- 元数据标题、封面或时长缺失时不得阻止保存。
- 分类重名忽略首尾空格并按大小写不敏感冲突处理。
- 删除分类时条目转为未分类；删除条目不可因网络重试产生错误的第二次删除。
- 解绑、重新绑定、旧请求晚到时，旧 pair 请求不得修改新 pair。
- 双方同时重排、编辑或删除时必须通过 revision/存在性返回确定结果。
- 双方均删除旧空间后，pair 级联删除片库状态、分类和条目。
- 列表为空、加载中、网络失败、未登录、未绑定和只读归档必须有独立 Android 状态。

## Requirements

### Functional Requirements

- **FR-001**: 活动片库、分类和条目 MUST 归属服务端当前活动 `pairId`，客户端不得指定任意活动 pair 写入。
- **FR-002**: 绑定双方 MUST 拥有相同的读取、添加、分类、排序、状态和删除权限。
- **FR-003**: 系统 MUST 支持单次最多 20 个输入的批量添加，并逐项返回 added、duplicate 或 rejected。
- **FR-004**: 系统 MUST 复用共享协议的 B站链接规范化规则；直接 BV/av 链接在本地解析，B23 必须由服务端安全跟随有限次 HTTPS 跳转并再次解析为真实 BV/av 身份。无法解析的 B23、直链视频和任意 URL MUST 被拒绝且不得以 `b23:*` 占位持久化。
- **FR-005**: 同一 pair 内 `BVID+page` MUST 唯一；重复添加 MUST 幂等返回已有条目。
- **FR-006**: 条目 MUST 保存规范化媒体身份、标题、封面、UP 主、时长、元数据状态、添加者和最后修改者快照。
- **FR-007**: 元数据获取 MUST 为 best effort；身份有效但元数据失败时保存 partial 条目，并允许后续刷新。
- **FR-008**: 用户 MUST 能创建、重命名、删除和排序自定义分类；分类名 1-24 字符且 pair 内唯一。
- **FR-009**: 删除分类 MUST 将其条目置为未分类，不得删除视频。
- **FR-010**: 用户 MUST 能按文本、分类和 unwatched/watched 状态查询；全部、未观看、已看完是派生筛选而非持久分类。
- **FR-011**: 用户 MUST 能修改条目分类、状态和排序，并删除条目。
- **FR-012**: 所有修改 MUST 携带 `expectedRevision`；服务端只在请求实际改变至少一行片库状态时原子增加 pair 片库 revision，且一次请求最多增加一次。批量添加部分成功时所有 added 条目与一次 revision 增量原子提交；仅 duplicate/rejected 或无字段变化时 revision 保持不变。
- **FR-013**: revision 不匹配 MUST 返回 HTTP 409、`LIBRARY_VERSION_CONFLICT` 和 `currentRevision`，不得应用任何部分写入。
- **FR-014**: 分类和条目排序 MUST 稳定；同位置时以创建时间和 ID 作为确定性次序。
- **FR-015**: 活动片库响应 MUST 同时返回 pairId、revision、readOnly=false、分类和条目。
- **FR-016**: keep 归档用户 MUST 能读取指定旧 pair 的 readOnly=true 快照；pending/delete/第三方 MUST 被拒绝。
- **FR-017**: 归档片库和已解绑 pair MUST 拒绝所有写操作。
- **FR-018**: 双方都删除归档并触发 pair 物理删除时，片库状态、分类和条目 MUST 级联删除。
- **FR-019**: Android MUST 提供 Loading、Empty、Content、Error、Unauthenticated、Unbound、Conflict 和 ArchiveReadOnly 状态。
- **FR-020**: Android MUST 支持批量粘贴、搜索/筛选、分类、标记看完、删除和显式排序模式。
- **FR-021**: Android MUST 使用 Breath Tech 黑白主题；默认片库按分类展示信息密度适中的封面媒体行，搜索、筛选或排序时使用单一结果流，封面不得占满页面。
- **FR-026**: Android 添加面板 MUST 在提交前逐条标记可识别直链、待服务端解析短链、无效输入和超过上限，并在提交后逐条展示 added/duplicate/rejected 的中文结果。
- **FR-027**: Android 房间竖屏 MUST 提供保留视频画面的底部片库抽屉，横屏/全屏 MUST 提供右侧片库抽屉，并保留手动粘贴链接入口。
- **FR-028**: 登录且已绑定好友的房主完成房间鉴权后 MUST 将严格校验的访客邀请 URL 加密发布为当前 pair 的短期活跃房间，默认 10 分钟且最长 30 分钟。
- **FR-029**: Android 首页 MUST 自动刷新并仅向非创建方展示好友活跃房间的一键进入卡片；创建者、第三方、旧 pair、过期或已解绑状态 MUST 不可见。
- **FR-030**: FCM MUST 仅作为可选提醒；通知失败不得阻塞 App 内发现，只有活跃房间发布失败时才要求链接兜底。
- **FR-022**: Android 从片库播放 MUST 复用现有 BilibiliMedia 和房间流程，不改变房间协议。
- **FR-023**: 房间内切换视频 MUST 显示更换状态，并遵守准备完成后 0 秒暂停、手动播放、无自动连播规则。
- **FR-024**: Alpha 10.2 MUST NOT 创建日历计划、提醒、重复计划、个人私密片库、B站账号登录或自动连播。
- **FR-025**: 是否迁移旧本机片单 MUST 保持后续独立决策，本功能不得自动扫描或上传本机历史数据。

### Security & Data Ownership

- **SD-001**: 活动写操作只允许经 Session 鉴权且属于当前活动 pair 的用户；归档读取必须校验当前用户的 keep 记录。
- **SD-002**: Session Token、测试访问令牌和 B站响应正文不得写入日志、QA 证据或持久元数据。
- **SD-003**: 删除条目和分类只影响当前 pair 数据；删除归档访问权与 pair 物理清理继续遵循 TK-001 的独立决定规则。
- **SD-004**: 网络不确定、重复提交和 App 重启后以服务端 revision 和完整快照为权威恢复。
- **SD-005**: 服务端对批量数量、字符串长度、URL 域名、响应大小和元数据字段长度设置上限。
- **SD-006**: B23 与元数据网络请求 MUST 禁止客户端控制任意目标地址，只允许 HTTPS 受信 B站主机、限制重定向次数/响应大小/超时，并且不得记录响应正文。
- **SD-007**: 活跃房间只保存加密访客邀请 URL，不得保存或返回 host key；解绑事务、房主离开和 TTL 到期 MUST 使记录失效。

### Error Contract

- HTTP 401: `AUTH_REQUIRED`（沿用现有账号服务鉴权错误码）。
- HTTP 400/415: `INVALID_REQUEST`、`INVALID_JSON` 或 `JSON_REQUIRED`。
- HTTP 403: `ARCHIVE_FORBIDDEN`。
- HTTP 404: `NOT_FOUND`。
- HTTP 409: `PAIR_REQUIRED`、`LIBRARY_VERSION_CONFLICT`、`CATEGORY_NAME_CONFLICT` 或 `LIBRARY_LIMIT_REACHED`；仅版本冲突必须返回 `currentRevision`。
- 批量逐项拒绝码固定为 `INVALID_BILIBILI_URL`、`B23_RESOLUTION_FAILED`、`CATEGORY_NOT_FOUND` 或 `LIBRARY_LIMIT_REACHED`，不得把内部异常文本返回给客户端。

### Key Entities

- **Pair Library State**: 每个 pair 一条 revision 和更新时间，作为所有共享片库写操作的乐观并发边界。
- **Library Category**: pair 下的自定义分类、名称、位置、创建/修改者和时间。
- **Library Item**: pair 下唯一媒体身份、元数据快照、分类、状态、位置、添加/修改者和时间。
- **Library Snapshot**: 一次权威读取返回的 pair、revision、只读标识、分类和条目集合。
- **Batch Add Result**: 每个输入的 added/duplicate/rejected 结果与可选条目或错误码。
- **Active Pair Room**: 每个活动 pair 最多一条短期房间记录，包含 host、roomId、加密访客邀请 URL、有效期和时间戳。

## Success Criteria

### Measurable Outcomes

- **SC-001**: 两个绑定账号对同一 active pair 查询得到相同 revision、分类、条目和稳定顺序。
- **SC-002**: 一次 20 条批量添加在本地/Preview 测试中返回完整逐项结果，不产生重复媒体行。
- **SC-003**: 至少 20 轮双方并发重排中，每轮最多一个旧 revision 写入成功，另一方得到可恢复冲突。
- **SC-004**: 元数据模拟失败时有效媒体仍成功保存，Android 显示占位信息且可播放。
- **SC-005**: keep 归档可读但所有写操作失败；双方 delete 后 D1 查询无 library state/category/item 行。
- **SC-006**: Android 单测、Lint、Debug 构建和双机添加/刷新/排序/播放/归档只读验收通过。

## Assumptions

- Alpha 10.0 登录、Alpha 10.1 唯一好友和 TK-001 归档代码作为既有基础，不在本功能重写。
- B站元数据属于易变外部数据，只保存快照并允许 partial；视频内容仍由客户端直接加载。
- 首版数据量按双人自用设计，单个活动片库最多 1000 条；API 返回完整快照，暂不分页。
- Calendar 的 planned 状态在 Alpha 10.3 由 watch_plans 派生，本阶段只实现 unwatched/watched。
