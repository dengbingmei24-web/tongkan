# Requirements Quality Checklist: TK-005

## Product and Scope

- [x] CHK001 历史是否明确归属 pair，而不是单个用户或匿名 room？ [FR-001, FR-016]
- [x] CHK002 首切片是否只覆盖账号绑定双方的 App B站房间？ [FR-019, Assumptions]
- [x] CHK003 匿名、direct-video、screen-share、单方授权和第三方是否明确排除？ [FR-019]
- [x] CHK004 是否明确不保存或代理视频流、Cookie、账号密码？ [FR-021, Non-Goals]
- [x] CHK005 completion、自动计划关联、单条管理和导出是否没有被静默承诺？ [FR-020, PD-002, PD-004, PD-005]
- [x] CHK006 Alpha 10.3 延期验收是否继续保留为风险而非通过？ [FR-022]

## Trusted Timing

- [x] CHK007 计时权威是否明确在 Signaling Durable Object？ [FR-006..FR-009, R-001]
- [x] CHK008 grant 是否绑定 source/pair/user/room/slot/iat/exp？ [FR-001..FR-004]
- [x] CHK009 host 首发与 guest 加入/刷新授权条件是否明确？ [FR-002, R-002]
- [x] CHK010 双方在线、授权、同媒体、同 sequence、ready、播放、非缓冲条件是否完整？ [FR-006]
- [x] CHK011 5 秒上报、12 秒 stale 和客户端时间不计费是否明确？ [FR-005, FR-006, R-003]
- [x] CHK012 pause/buffer/stale/disconnect/media change/ended/grant/unbind/expiry 是否都关闭区间？ [FR-008]
- [x] CHK013 Seek 与倍速语义是否明确？ [FR-007, R-005]
- [x] CHK014 旧客户端缺失字段和可选 history.bind 是否不破坏核心房间？ [Plan Architecture]

## Idempotency and Storage

- [x] CHK015 sourceRevision 与 intervalId 的重复/乱序/冲突语义是否明确？ [FR-009, FR-010, R-006]
- [x] CHK016 Durable Object pending queue、retry 和有限清理边界是否明确？ [FR-009, R-008]
- [x] CHK017 Account ingest 是否单事务验证 source、interval、session 和 revision？ [Data Model]
- [x] CHK018 UTC storage、offset 查询与跨午夜切分是否明确？ [FR-013, Data Model]
- [x] CHK019 元数据失败是否降级而非丢失记录？ [FR-011, R-010]
- [x] CHK020 keep/pending/delete/third-party/cascade 和 unbind race 是否可验证？ [FR-016, FR-017]

## UI and Failure Boundaries

- [x] CHK021 历史/月度是否放在“我们”且不增加第五 tab？ [FR-015]
- [x] CHK022 日历是否区分计划与实看并且不写 calendar revision？ [FR-014, FR-015]
- [x] CHK023 loading/empty/error/fallback/read-only 是否有明确实现和测试入口？ [User Stories, Plan]
- [x] CHK024 历史依赖失败是否 fail-open，不影响房间、播放、聊天、邀请、片库和日历？ [FR-018]
- [x] CHK025 敏感信息是否在 grant、D1、日志、QA 和错误响应中有明确禁止项？ [FR-004, FR-021]

## Workflow and Delivery

- [x] CHK026 三个执行任务写入范围是否可保持互不重叠？ [Plan, Task Contracts]
- [x] CHK027 当前未提交规划与无关图片是否被基线 gate 明确保留？ [Plan, T001..T006]
- [x] CHK028 规划批准、实现授权、Preview、生产、APK、push 是否被拆成独立 gates？ [Plan, Quickstart]
- [x] CHK029 成功标准是否覆盖确定性时钟、幂等、archive、Android 和 fail-open？ [SC-001..SC-007]

## Open Product Decisions

- [x] CHK030 PD-001 最短可见时长已确认：60 秒。
- [x] CHK031 PD-002 完成状态/完成数量已明确后置：首切片 unknown/隐藏。
- [x] CHK032 PD-003 时区与日界线已确认：UTC 存储 + 当前设备 offset 查询。
- [x] CHK033 PD-004 日历计划关联已明确后置：只按日期展示，不自动完成。
- [x] CHK034 PD-005 已确认：pair keep/delete，首切片无单条管理、纠错或导出。

**Result**: PASS — 产品、技术、安全和交付 gate 已冻结，可在 clean baseline 上创建三个隔离实现 worktree。
