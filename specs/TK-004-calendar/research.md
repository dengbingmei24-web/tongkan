# Research: TK-004 双人观看日历

## R-001 独立 calendar revision

**Decision**: 使用 `pair_calendar_state.revision`，不复用 `pair_library_state.revision`。

**Rationale**: 日历和片库会分别加载、分别修改。共享一个 revision 会让无关的片库重命名导致日历编辑冲突，也会让首页今日读取依赖完整片库版本。

**Alternatives rejected**:

- 无 revision：双端并发会静默覆盖。
- 每条计划独立 revision：无法保证稳定列表排序和删除/改期冲突的统一恢复。
- 复用片库 revision：耦合两个功能，产生不必要冲突。

## R-002 保存媒体快照并允许 library item 置空

**Decision**: 计划保存 BVID、分P、规范 URL、标题和封面快照；`library_item_id` 使用 `ON DELETE SET NULL`。

**Rationale**: 计划是双方共同约定的记录，不能因片库条目重命名、刷新或删除而无法读取。快照也允许旧归档稳定展示。

## R-003 日期时间作为共享墙上时间

**Decision**: 存储 `YYYY-MM-DD` 和可选 `HH:mm` 字符串，不把第一版计划转换为 UTC 时间点。

**Rationale**: 第一版没有提醒调度，用户需要的是共同看到同一个日期和时间标签。提前引入时区会增加 DST、跨时区和显示复杂度，却没有当前用户证据。

**Deferred**: 跨时区语义和通知调度在提醒功能确认后重新设计。

## R-004 原生轻量月历

**Decision**: Android 使用现有 Java View 构建七列月格，不增加第三方日历库。

**Rationale**: 当前仅需月份切换、日期标记和日期选择；第三方库会增加体积、主题适配和维护成本，不符合最小依赖约束。

## R-005 首页使用独立 today 查询

**Decision**: 提供按日期读取的轻量 API；首页不加载整月快照。

**Rationale**: 首页频繁刷新好友房间状态，日历卡片应只读取当天未完成计划，降低流量和状态耦合。

## R-006 第一切片只安排现有片库条目

**Decision**: TK-004 首个合同要求选择现有共同片库视频。

**Rationale**: 当前路线图将“非片库视频计划”标为待确认；先复用已经验证的 B站解析、元数据和去重链路，避免在日历 API 中复制添加逻辑。

**Deferred**: 若后续确认，Android 可先调用片库 batch add，再用返回条目创建计划；是否需要原子组合 API另行评估。
