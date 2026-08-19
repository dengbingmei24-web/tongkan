# Worker Task Contract: TK-004-W3 Calendar QA

**Feature**: TK-004
**Baseline Commit**: `TBD_CLEAN_BASELINE`
**Branch**: `codex/TK-004-W3-qa`
**Worktree**: `C:\Users\dengbingmei\Documents\tongkan-worktrees\TK-004-W3-qa`
**Owner**: QA contract execution task
**Depends On**: T004 clean baseline + frozen OpenAPI

## Goal

建立可重复的 Calendar ValidateOnly/Preview 黑盒合同，覆盖双账号一致性、输入边界、并发 revision、归档权限和 D1 级联证据，不读取或部署生产环境。

## Non-Goals

- Account 或 Android 实现。
- Preview/Production migration 和 Worker deployment。
- 真机 UI 自动化。
- 保存长期测试账号、session token 或私有数据。

## Write Scope

- `qa/calendar/contract-cases.json`
- `qa/calendar/run-preview.ps1`
- `qa/calendar/acceptance.md`
- `specs/TK-004-calendar/handoffs/TK-004-W3-qa.md`

## Forbidden Scope

- `CONTEXT.md`, `docs/decisions/DECISIONS.md`, `PROJECT_CONTEXT.md`, global PRDs, production configuration and deployment state.
- `apps/account/`, `apps/android/`, other specs and other worker branches/worktrees.
- Secrets, APKs, Firebase JSON, service-account JSON and build outputs.
- Worker-initiated push, merge, rebase, force push, migration or deployment.
- Production hosts, production D1 or production tokens.

## Frozen Contracts

- Preview host 必须显式 allowlist；默认模式为 `-ValidateOnly`，不得发送网络请求。
- Live 模式仅接受审查任务提供的一次性 Preview A/B/C 凭据，不写入文件。
- 覆盖 month/date/today、create/update/complete/delete、重复计划和日期时间边界。
- 20 轮同 revision race 每轮恰好一个 2xx 和一个 409，失败方包含 currentRevision。
- 未登录、无 pair、第三账号、旧 pair late write、keep/pending/delete archive 必须覆盖。
- D1 级联证据由审查任务在隔离 Preview 数据库执行；runner 只定义查询与期望，不自行访问生产。
- 输出必须脱敏，不打印 bearer token、完整邮箱、邀请 URL 或 Secret。

## Required Validation

```powershell
powershell -NoProfile -Command "$null = [System.Management.Automation.Language.Parser]::ParseFile('qa/calendar/run-preview.ps1',[ref]$null,[ref]$null)"
powershell -NoProfile -File qa/calendar/run-preview.ps1 -ValidateOnly
node -e "JSON.parse(require('fs').readFileSync('qa/calendar/contract-cases.json','utf8')); console.log('ok')"
git diff --check -- qa/calendar specs/TK-004-calendar/handoffs/TK-004-W3-qa.md
```

## Done When

- [ ] Contract goal is implemented.
- [ ] Required validation passes without network access.
- [ ] Changes are committed on the assigned branch.
- [ ] Handoff includes commit hash, changed files, case inventory, cleanup requirements, security and rollback notes.
