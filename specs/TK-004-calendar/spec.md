# Feature Specification: Alpha 10.3 双人观看日历

**Feature Branch**: `codex/TK-004-calendar`

**Created**: 2026-08-19

**Status**: Ready for implementation after clean-baseline gate

**Input**: 用户当前不方便执行 Alpha 10.2.4 双设备 P0 物理验收，允许先继续其他功能开发。依据已确认的 D-061、D-070、账号与双人空间 PRD 和产品路线图，下一项功能为共享观看日历与首页“今天想看”。

## User Scenarios & Testing

### User Story 1 - 为共同片库视频安排观看日期 (Priority: P1)

已登录且已绑定好友的任意一方，可以从共同片库选择一个视频，安排必填日期，并可选填写开始时间和备注。另一方刷新后看到相同计划。

**Why this priority**: 共同片库已经解决“看什么”，日期计划是解决“什么时候一起看”的最小闭环。

**Independent Test**: 账号 A 为片库视频安排明天、20:00 和备注；账号 B 查询对应月份后看到相同媒体、日期、时间、备注和 revision。

**Acceptance Scenarios**:

1. **Given** 用户已登录并处于活动好友绑定，**When** 从当前 pair 的片库选择视频并提交合法日期，**Then** 计划保存到该 `pairId`，双方读取一致。
2. **Given** 用户不填写开始时间或备注，**When** 创建计划，**Then** 计划仍成功保存，UI 将时间显示为“当天”。
3. **Given** 用户未登录、未绑定或尝试引用其他 pair 的片库条目，**When** 创建计划，**Then** 服务端拒绝且不增加 calendar revision。

---

### User Story 2 - 从月历和首页看到近期计划 (Priority: P1)

用户打开“日历”页可以浏览当前月份，看到有计划的日期标记；点击日期后看到按时间排序的计划。首页展示今天的“今天想看”，可直接进入计划详情或开始同看。

**Why this priority**: 计划必须在双方日常打开 App 时可见，不能成为只能进入专页才能发现的隐藏数据。

**Independent Test**: 同一天创建 20:00、有全天项和 18:30 三个计划；月历标记该日期，日期详情按 18:30、20:00、当天排序，首页今天列表顺序相同。

**Acceptance Scenarios**:

1. **Given** 某月存在计划，**When** 查询月份，**Then** 返回该月范围内的计划和稳定排序，不复制其他月份数据。
2. **Given** 今天存在未完成计划，**When** 打开账号首页，**Then** 显示“今天想看”卡片；无计划时不显示空卡片。
3. **Given** 计划无开始时间，**When** 与有时间计划共同展示，**Then** 有时间计划按 `HH:mm` 升序排列，无时间计划排在其后。

---

### User Story 3 - 改期、取消、完成和直接开始同看 (Priority: P2)

绑定双方拥有相同编辑权限，可以修改日期/时间/备注、取消计划、手动标记完成，并从计划复用现有房间创建与好友邀请流程。

**Why this priority**: 现实安排会变化；如果不能改期或取消，日历很快失去可信度。

**Independent Test**: A 与 B 从同一 revision 开始，A 改期成功；B 用旧 revision 取消得到冲突并刷新；刷新后 B 标记完成并从另一个计划创建房间。

**Acceptance Scenarios**:

1. **Given** 两端持有相同 revision，**When** 一方先修改成功，另一方使用旧 revision 写入，**Then** 返回 `CALENDAR_VERSION_CONFLICT` 和当前 revision，不静默覆盖。
2. **Given** 活动计划存在，**When** 任一方取消，**Then** 计划从双方活动日历消失且 revision 增加一次。
3. **Given** 用户点击“开始同看”，**When** 媒体身份有效，**Then** Android 复用现有创建房间、发布活跃好友房间和可选 FCM 提醒链路，不新增第二套房间协议。
4. **Given** 计划被标记完成，**When** 首页读取今天计划，**Then** 默认不把已完成计划作为待观看项；月历日期详情仍可显示其完成状态。

---

### User Story 4 - 解绑后只读查看旧日历 (Priority: P3)

解绑时选择保留归档的用户，可以查看旧双人空间的日历计划；pending、delete、第三方以及新绑定好友均不能访问或修改旧计划。

**Why this priority**: 日历属于已确认的双人空间归档范围，必须与片库保持相同的数据所有权规则。

**Independent Test**: 解绑后 A 选择 keep、B 选择 delete；A 可以读取旧月份但写入被拒绝，B 和第三方读取被拒绝；双方 delete 后日历数据随 pair 物理删除。

**Acceptance Scenarios**:

1. **Given** 当前用户对旧 pair 的 retention 为 keep，**When** 查询归档日历，**Then** 返回 `readOnly=true` 的快照。
2. **Given** retention 为 pending/delete 或用户不属于旧 pair，**When** 查询归档，**Then** 返回权限错误。
3. **Given** 双方都选择 delete，**When** pair 被删除，**Then** calendar state 和 plans 通过外键级联删除。

## Edge Cases

- 日期严格使用 `YYYY-MM-DD`；月份严格使用 `YYYY-MM`；无效日期如 `2026-02-30` 必须拒绝。
- 开始时间只接受 `HH:mm` 24 小时格式；空字符串在客户端归一化为 `null`。
- 备注去除首尾空格后最多 200 个 Unicode 字符；空备注保存为 `null`。
- 日历日期和开始时间是双方共享的“墙上时间”标签，不转换为 UTC 时间点；第一版不做跨时区提醒。
- 计划创建时保存媒体快照；片库条目后续重命名、刷新或删除，不应让既有计划无法读取。
- 片库条目删除时 `libraryItemId` 可变为 `null`，计划继续使用 BVID/分P、标题和封面快照。
- 同一视频允许安排多个不同日期；同一天重复安排同一片库条目时服务端返回重复错误，避免误触产生双份计划。
- 月份边界、闰年、跨年切换和无计划月份必须可测试。
- 解绑后晚到写入不得修改归档；重新绑定后旧 pair 的 revision 不能影响新 pair。
- 自动提醒、重复计划、外部日历同步和实际共同观看记录不属于本功能。

## Functional Requirements

- **FR-001** 系统必须将计划归属 `pairId`，仅活动 pair 的双方可共同写入。
- **FR-002** 第一实现切片必须从当前共同片库选择视频；直接粘贴尚未入库的视频创建计划标记为后续候选，不在本合同内。
- **FR-003** 创建计划必须包含合法 `libraryItemId`、`date` 和 `expectedRevision`；`startTime`、`note` 可为空。
- **FR-004** 计划必须保存媒体身份与展示快照，至少包含 BVID、分P、规范 URL、标题和可选封面。
- **FR-005** 计划状态必须支持 `planned` 和 `completed`；取消使用删除语义。
- **FR-006** 月份查询必须只返回目标自然月；日期/今日查询必须只返回目标日期。
- **FR-007** 排序必须为有时间项按 `startTime` 升序，其后为无时间项，再以创建时间和 ID 保证稳定顺序。
- **FR-008** 首页“今天想看”默认只显示 `planned` 项；完成项保留在日期详情。
- **FR-009** 所有活动日历修改必须携带 `expectedRevision`；旧 revision 返回 `CALENDAR_VERSION_CONFLICT` 和服务端当前 revision。
- **FR-010** 创建、修改、完成和删除每次成功只增加一次 calendar revision；失败不得增加 revision。
- **FR-011** 双方必须具有完全相同的计划新增、修改、完成和取消权限。
- **FR-012** keep 归档必须只读；pending/delete/第三方必须被拒绝。
- **FR-013** 双方 delete 后 pair 删除必须级联清理 calendar state 和 plans。
- **FR-014** Android 必须使用现有 Breath Tech 黑白双主题、原生 Java View 和当前四栏主导航中的“日历”入口。
- **FR-015** Android 日历页必须提供月切换、日期选择、日期详情、添加、编辑、完成、取消和开始同看。
- **FR-016** Android 首页必须显示今天未完成计划，并在账号未绑定、加载失败和无计划时保持可恢复状态。
- **FR-017** 从计划开始同看必须复用现有房间、播放器、活跃好友房间和 FCM 可选提醒能力。
- **FR-018** 匿名模式不得读取或修改账号日历；匿名房间能力必须保持不变。
- **FR-019** 第一版不得引入自动提醒、重复计划、外部日历、实际观看统计、多人计划或私密计划。
- **FR-020** Account Worker、D1 和 Android 必须增加自动化覆盖；双设备物理验收仍保留为发布门槛，不能由自动化替代。

## Success Criteria

- **SC-001** 两个绑定账号在 API 黑盒测试中对同一月份、日期和 revision 看到一致计划。
- **SC-002** 二十轮双端旧 revision 竞争中，每轮恰好一个写入成功，失败方收到当前 revision，且无部分写入。
- **SC-003** 日期、时间、备注、跨月和排序契约均有确定性自动化测试。
- **SC-004** keep 归档只读、delete/第三方拒绝、双方 delete 级联清理可由真实本地 D1 查询证明。
- **SC-005** Android JVM 测试覆盖 JSON 解析、日期排序、今天过滤、空时间显示和请求校验。
- **SC-006** Android 相关单元测试、Lint、Debug 构建和 Account typecheck/test/build 通过。
- **SC-007** 不新增 Kotlin、Compose、大型依赖、视频中继或 B站凭据处理。

## Assumptions

- 双方把日期和时间理解为共同约定的本地日历标签；第一版不解决跨时区换算。
- “标记完成”是计划管理状态，不等同于 Alpha 10.4 的服务端共同观看事实。
- 计划可以在片库条目删除后继续显示媒体快照；从该计划开始同看仍使用保存的规范媒体身份。
- Alpha 10.2.4 P0 物理验收仅暂缓，不视为通过，也不从后续发布门槛中移除。
