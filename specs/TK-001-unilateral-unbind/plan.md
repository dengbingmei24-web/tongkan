# Implementation Plan: 单方面解绑与独立归档选择

**Branch**: `codex/TK-001-unilateral-unbind` | **Date**: 2026-08-14 | **Spec**: `specs/TK-001-unilateral-unbind/spec.md`

## Summary

在现有唯一好友模型上增加原子单方解绑和每用户独立归档选择。Account Worker 使用 D1 保存 pair 冻结状态与两条用户级保留记录；Android “我们”页提供解绑、待选择和只读归档摘要。实施拆成 Account Worker、Android、QA 三个不重叠执行任务，由审查任务统一集成、迁移和验收。

## Technical Context

**Language/Version**: TypeScript 5.9；Java 17

**Primary Dependencies**: Cloudflare Worker/D1/Wrangler；Android Java View、OkHttp 4.12.0

**Storage**: Cloudflare D1，新增 `0004_pair_archives.sql`

**Testing**: Vitest；Android JVM JUnit；Wrangler remote migration inspection；两账号真机验收

**Target Platform**: Cloudflare Workers；Android 8.0+（API 26）

**Project Type**: Mobile + API monorepo

**Performance Goals**: 解绑和保留决定在正常网络下 3 秒内显示结果；好友查询保持一次请求返回完整页面状态

**Constraints**: 不依赖 FCM；不新增 Android 框架；不修改房间协议；不允许执行任务部署生产

**Scale/Scope**: 两用户关系、单个活动 pair、少量历史归档；首版只展示归档摘要

## Constitution Check

- [x] 用户故事可独立验收，包含失败和重启恢复场景。
- [x] 不代理或改变 B站视频流和房间同步协议。
- [x] 每个用户只能写自己的保留决定；没有新增 Secret 或敏感日志。
- [x] 三个执行任务写入范围互不重叠；全局文档、迁移和部署由审查任务控制。
- [x] Android 保持 Java View；服务边界和现有依赖不变。
- [x] 计划包含模块测试、集成检查、D1 迁移检查和真机门槛。

## Project Structure

```text
apps/account/
├── migrations/0004_pair_archives.sql
└── src/
    ├── models.ts
    ├── pair-service.ts
    ├── pair-service.test.ts
    ├── repository.ts
    └── worker.ts

apps/android/app/src/main/java/com/tongkan/mobile/
├── MainActivity.java
├── account/AccountClient.java
├── account/AccountModels.java
└── ui/MainNavigationView.java

apps/android/app/src/test/java/com/tongkan/mobile/account/
└── AccountModelsTest.java

qa/account-unbind/
├── contract-cases.json
├── acceptance.md
└── run-preview.ps1

specs/TK-001-unilateral-unbind/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
├── checklists/
└── task-contracts/
```

**Structure Decision**: 在现有 Account Worker 和 Android 页面内做最小增量；QA 执行任务只创建新的 `qa/account-unbind/` 文件，避免与后端和 Android 写入冲突。

## API and Compatibility

- 新增 `POST /api/pair/unbind`，请求必须携带当前 `pairId` 和 retention，避免旧请求误解绑后续新关系。
- 新增 `POST /api/pair/archives/{pairId}/retention`。
- `GET /api/pair` 保留现有 `pair` 字段，新增 `pendingArchives` 和 `archives`；旧 Android 客户端可忽略新增字段。
- 所有错误继续使用现有 `AuthError` JSON 结构，不返回另一方邮箱原文或内部数据库状态。
- 固定错误体为 `{ "error": "CODE", "message": "中文提示" }`，核心错误码见 OpenAPI；物理删除后不保留 tombstone，重试通过 404 加 GET 刷新收敛。

## Migration and Transaction Design

1. `0004_pair_archives.sql` 新增 `pair_archive_members` 和用户查询索引。
2. 解绑 batch：对请求中的精确 `pairId`、当前用户成员身份和 `pairs.status='active'` 做条件更新/CAS；后续语句绑定本次发起人和解绑时间，删除两条 `active_pair_members`、写入两条带资料快照的归档成员记录，并使双方未使用的邀请码失效。条件更新未命中时整个操作按并发冲突处理，绝不回退到用户当前的新 pair。
3. 另一方提交决定时只更新自己的 `pending` 记录。
4. 更新后若恰有两条成员记录且均为 `delete`，在同一事务中删除 pair；未来 pair 子表通过外键级联清理。事务任一语句失败必须整体回滚。
5. 迁移先应用预览并运行在线双账号用例，审查通过后才应用生产。

## Parallel Work Packages

| Worker | Scope | Can Start | Output |
|---|---|---|---|
| W1 Account | `apps/account/**` 中合同列出的文件 | 合同冻结后 | Migration、API、事务和 Vitest |
| W2 Android | Android account/UI 文件 | 合同冻结后，可用 JSON fixtures 并行 | Client models、解绑/待选择 UI、JUnit |
| W3 QA | `qa/account-unbind/**` | spec/contract 完成后 | 预览环境脚本、验收矩阵和证据模板 |

W1、W2、W3 不修改同一文件。W2 不等待 W1 提交，只依赖冻结的 OpenAPI 示例；集成由审查任务完成。

## Reviewer Integration

1. 审查三个 Draft PR 的写入范围和测试证据。
2. 先合并 W1，运行 account tests/typecheck/build 和预览迁移。
3. 合并 W2，运行 Android checks，并对预览 API 做两账号真机验证。
4. 合并 W3，运行黑盒脚本和完整 QA 清单。
5. 全仓测试、密钥扫描和 `git diff --check` 通过后，更新 PRD/DECISIONS/CONTEXT；生产迁移与部署需单独确认。

## Complexity Tracking

无宪章例外。新增归档成员表是表达双方独立决定的最小数据模型。
