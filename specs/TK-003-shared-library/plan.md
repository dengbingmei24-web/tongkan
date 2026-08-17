# Implementation Plan: TK-003 双人共享片库

**Branch**: `codex/TK-003-shared-library` | **Date**: 2026-08-17 | **Spec**: `specs/TK-003-shared-library/spec.md`

## Summary

在既有 Account Worker/D1、唯一好友和 TK-001 归档基础上增加 pair 级共享片库。服务端提供完整快照、批量添加、分类/状态/删除/重排和 keep 归档只读 API；Android 用原生 Java View 接入 Breath Tech 片库页面并复用现有房间播放器；独立 QA 包执行双账号黑盒、并发和数据库清理验收。

## Technical Context

- Backend: Cloudflare Worker TypeScript strict mode + D1。
- Android: Java 17、minSdk 26、compileSdk 35、OkHttp 4.12.0、动态 View。
- Shared parsing: `@tongkan/protocol` 的 `parseBilibiliUrl`。
- Concurrency: pair 级单 revision 乐观锁。
- Storage: 新 migration `0005_shared_library.sql`，所有表通过 pair FK 级联删除。
- External metadata: 独立 resolver、mock 测试、失败降级 partial。
- No new external dependency; Account 只新增内部 workspace protocol dependency。

## Constitution Check

- [x] 用户价值和独立验收已定义。
- [x] 服务端不代理或保存视频流，只保存媒体身份与元数据快照。
- [x] 活动 pair、keep 归档和双方 delete 的数据所有权明确。
- [x] Reviewer/W1/W2/W3 写入范围不重叠。
- [x] 保持 Java View、现有 Worker/D1 和 OkHttp 架构。
- [x] 模块、Preview migration、黑盒、Android 与双机验收门槛已列出。
- [x] 不修改生产配置或部署，除非用户后续明确批准。

## Project Structure

```text
specs/TK-003-shared-library/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/openapi.yaml
├── checklists/requirements.md
├── task-contracts/
│   ├── TK-003-W1-account.md
│   ├── TK-003-W2-android.md
│   └── TK-003-W3-qa.md
└── tasks.md

apps/account/
├── migrations/0005_shared_library.sql
└── src/library-*.ts + worker/repository integration

apps/android/app/src/main/java/com/tongkan/mobile/
├── account/AccountClient.java
├── account/AccountModels.java
├── ui/LibraryScreen.java
├── ui/MainNavigationView.java
└── MainActivity.java

qa/shared-library/
├── contract-cases.json
├── run-preview.ps1
└── acceptance.md
```

**Structure Decision**: W1 owns all Account/D1 changes including worker route wiring; W2 owns all Android changes; W3 owns QA only. Reviewer owns specs, global docs, migration application, integration, APK and deployment decisions.

## Phase 0: Contract Freeze

1. Freeze user stories, exclusions and revision semantics.
2. Freeze OpenAPI payloads/error codes and data invariants.
3. Commit specification package as the unique Worker baseline.

## Phase 1: Parallel Workers

### W1 Account/D1

Implement migration, repository/service/routes, protocol parser dependency, metadata resolver and tests. Must not apply remote migration.

### W2 Android

Implement models/client/UI/orchestration/tests from frozen OpenAPI using fixtures. Must not change Account backend or room protocol.

### W3 QA

Implement contract cases, secure Preview runner and acceptance matrix. Must not change application code.

## Phase 2: Reviewer Integration

1. Review W1/W2/W3 with APPROVED or CHANGES_REQUESTED.
2. Integrate W1, run Account/local D1 tests.
3. Apply Preview migration and deploy Preview Worker only.
4. Run W3 black-box and direct Preview D1 checks.
5. Integrate W2, run Android tests/Lint/build.
6. Run full workspace verification and credential scan.
7. Build frozen Alpha 10.2 test APK and open release folder for user.
8. Production migration/deployment requires separate explicit approval.

## Complexity Tracking

No constitution violations. Full-snapshot API and pair-level revision are intentionally selected for a two-person, <=1000-item library to avoid pagination and per-row merge complexity.
