# Requirements Quality Checklist: TK-001

- [x] CHK001 单方解绑是否明确不需要另一方在线或同意？ [Spec FR-001]
- [x] CHK002 是否明确解绑必须原子释放双方活动关系约束？ [Spec FR-002]
- [x] CHK003 发起方和另一方的保留决定是否分别定义？ [Spec FR-003, FR-004]
- [x] CHK004 `pending/keep/delete` 状态和不可逆边界是否清晰？ [Spec FR-005]
- [x] CHK005 只读、失去访问和物理删除三个结果是否可区分验证？ [Spec FR-006, FR-007, FR-008]
- [x] CHK006 是否定义解绑后立即重新绑定的要求？ [Spec FR-009]
- [x] CHK007 查询响应是否覆盖活动关系、待选择和归档？ [Spec FR-010]
- [x] CHK008 Android 是否包含确认、选择、加载、成功和失败要求？ [Spec FR-011, FR-012]
- [x] CHK009 重启和离线另一方的恢复行为是否明确？ [Spec FR-013, Edge Cases]
- [x] CHK010 权限和关系信息泄露边界是否明确？ [Spec FR-014]
- [x] CHK011 是否明确不影响账号、设备 token 和匿名房间？ [Spec FR-015]
- [x] CHK012 是否明确不依赖 FCM 完成正确性？ [Spec FR-016]
- [x] CHK013 并发、重复提交、网络不确定和已删除归档是否有边界场景？ [Edge Cases]
- [x] CHK014 成功标准是否可通过双账号 API、Android 重启和数据库查询测量？ [SC-001..SC-005]
- [x] CHK015 是否区分同值重试、异值重试和物理删除后的重试行为？ [Spec FR-005]
- [x] CHK016 是否要求解绑使双方旧邀请码失效？ [Spec FR-017, SC-006]
- [x] CHK017 是否明确多个待选择归档的排序、展示顺序和资料快照？ [Spec FR-018, FR-019]
- [x] CHK018 是否冻结错误体、稳定错误码和 delete 记录不可查询规则？ [OpenAPI]
- [x] CHK019 解绑是否必须携带目标 pairId，并明确旧请求不得影响新关系？ [Spec FR-003, Edge Cases]

**Result**: PASS — 无 `NEEDS CLARIFICATION`，可以创建执行任务合同。
