# TK-003-W3 QA 交接

## 完成范围

- T010：共享片库合同 JSON、固定 HTTP/错误码、revision 与归档权限用例。
- T019：安全 Preview runner、BV/B23 去重、批次部分成功、partial 和零变化 revision。
- T027：分类、组合筛选、状态、排序、删除分类置空和 20 轮旧 revision 冲突。
- T033：keep/pending/delete/第三方、重绑旧 pair 隔离和 D1 级联验收说明。
- T036：JSON、PowerShell AST、ValidateOnly 与 `git diff --check`。

## 安全与兼容性

- 只修改 `qa/shared-library/**`。
- 未写入 token、测试密钥、邮箱、邀请码、完整响应或个人数据。
- 未修改应用、spec、全局文档、生产配置或部署状态。
- 未执行网络 Live、migration、部署、push、merge 或 rebase。

## 已执行验证（2026-08-17）

- `contract-cases.json` 通过 `ConvertFrom-Json`。
- `run-preview.ps1` 通过 PowerShell Parser/AST，零语法错误。
- 全部 15 个 case 的 `-Mode ValidateOnly` 通过；单独选择 archive case 与 20 轮 race case 的依赖解析通过。
- 合同含 53 个请求定义、15 个唯一 case、零绝对请求 URL、零 secret placeholder。

## Live 前置与风险

精确前置、测试拓扑、环境变量和 D1 SQL 见 `acceptance.md`。当前隔离任务无法独立验证 W1 尚未集成的 Preview API；metadata partial 需要审查任务提供确定性 Preview 夹具。Live 结果必须由审查任务填写脱敏证据，不能把静态通过误报为远程通过。

## 回滚

回退本任务单一提交即可；本包不改变数据库或运行时代码。
