# Research: TK-003 双人共享片库

## R-001 任务编号与协作方式

**Decision**: 使用 TK-003。当前仓库已有 TK-001 解绑规格，TK-002 已被播放器/聊天分支占用。一个审查任务维护规格和集成，W1 Account/D1、W2 Android、W3 QA 三个隔离任务并行。

**Rationale**: 与 D-079 一致，写入范围天然按应用分离，避免多个任务同时修改 MainActivity、worker.ts 或全局文档。

## R-002 媒体身份复用共享协议

**Decision**: Account Worker 添加内部 workspace 依赖 `@tongkan/protocol`，复用 `parseBilibiliUrl` 规范化直接 BV/av/分P；`parseBilibiliUrl` 返回的 unresolved B23 只作为短链识别信号，服务端必须通过受限 HTTPS 重定向解析最终 B站 URL，再次调用共享解析器得到真实 BV/av 身份，不持久化 `b23:*`。

**Rationale**: Android、Web 和服务端必须对同一链接得到相同媒体身份，防止同一视频以 B23/BV 两条记录重复，也防止恶意相似域名或任意重定向被服务端请求。

## R-003 元数据 best-effort

**Decision**: 通过独立 `BilibiliMetadataResolver` 封装服务端 fetch；生产端点作为实现细节，测试必须注入 mock。身份规范化成功即允许保存；标题/封面/UP 主/时长失败时状态为 partial。

**Rationale**: B站公开页面/API 会变化，不能让外部元数据可用性阻塞用户保存视频，也不能把整段响应持久化或记录日志。

## R-004 每个 pair 使用单一 revision

**Decision**: `pair_library_state.revision` 为乐观锁。所有分类/条目修改、删除和重排携带 expectedRevision，在同一 D1 batch/transaction 中校验；请求实际改变状态时只递增一次。批量添加可以逐项部分成功，但 added 行和单次 revision 递增必须原子提交；零 added/零变化不递增。

**Rationale**: 这是双人低并发场景下最简单的冲突模型；比每行版本更易让 Android 刷新恢复，也满足 D-067 的排序冲突要求。

## R-005 排序与分类

**Decision**: 自定义分类持久化；全部、未观看、已看完为派生筛选。分类和条目保存整数 position，重排提交完整有序 ID 列表；服务端校验集合完整且无重复后批量重写。

**Rationale**: 片库最多 1000 条且仅两人，完整重排比复杂 fractional indexing 更可靠。删除分类时条目 category_id 置空。

## R-006 归档只读

**Decision**: 活动片库 endpoint 不接受 pairId；服务端从 active_pair_members 推导。旧空间仅通过 `/api/pair/archives/{pairId}/library` 读取，并要求当前用户 retention_status=keep。

**Rationale**: 防止客户端指定任意 pair；与 TK-001 的个人归档授权一致。pair 最终删除时依赖外键级联清理片库。

## R-007 Android UI 不引入新框架

**Decision**: 新建 `LibraryScreen.java`，继续使用 Java View、现有 BreathComponents 和 OkHttp。排序模式使用原生 View 拖放/明确移动操作，不引入 RecyclerView/Compose/Material 新依赖。

**Rationale**: 遵守项目最小依赖和已验证 UI 架构，减少播放器回归风险。

## R-008 Alpha 10.2 边界

**Decision**: 包含批量添加、元数据、分类、搜索/筛选、排序、看完状态、删除、立即同看和归档只读；不包含日历计划、提醒、旧本机数据迁移、私密片库、B站登录和自动连播。

**Rationale**: 形成完整可用片库，同时保持 Alpha 10.3/10.4 的独立交付与验收。
