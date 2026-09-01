# TK-005-W1 Account/D1 Handoff

**Date**: 2026-09-01
**Status**: READY_FOR_REVIEW
**Baseline**: `9473dcdba18341169ad3e7e0ac976f9140cf65b5`
**Implementation Commit**: `091dc564e48d4ca471bfdb916d4e83edea03a76e`
**Branch**: `codex/TK-005-W1-account`

## Delivered

- Added additive migration `0008_watch_history.sql` with pair-cascading source, immutable interval and derived session tables plus required indexes.
- Added versioned HMAC grants for host/guest source creation, guest attachment and refresh, with 10-minute grants, 5-minute refresh guidance and 8-hour absolute source lifetime.
- Added signed internal ingest at `/internal/history/sources/{roomId}/snapshot` with `account.internal` service-binding hostname, timestamp window and raw-body HMAC validation.
- Added immutable `intervalId` replay handling, monotonic `sourceRevision`, stale acknowledgements, session aggregation and conflict-before-write behavior.
- Added active-pair and kept-archive history, monthly summary and calendar-marker APIs. Sessions become visible at 60 seconds, completion stays `unknown`, and completed count remains `null`.
- Added UTC interval splitting for caller offsets `-840..840`; history reads do not modify library or calendar revisions.
- Added library-first, Bilibili best-effort and fallback metadata snapshots. Metadata lookup failure never rolls back trusted interval writes.
- Added source revocation to the existing unbind batch and verified late higher-revision ingest cannot restore unbound history.

## Changed Files

- `apps/account/migrations/0008_watch_history.sql`
- `apps/account/src/history-models.ts`
- `apps/account/src/history-grant.ts`
- `apps/account/src/history-repository.ts`
- `apps/account/src/history-service.ts`
- `apps/account/src/history-grant.test.ts`
- `apps/account/src/history-service.test.ts`
- `apps/account/src/history-repository.integration.test.ts`
- `apps/account/src/worker.ts`
- `apps/account/src/env.ts`
- `apps/account/src/config.ts`
- `apps/account/src/repository.ts`
- `apps/account/.dev.vars.example`

## Migration Compatibility

- Verified a fresh local D1 applying migrations `0001` through `0008`.
- Verified the `0001` through `0007` schema has no history tables before applying `0008`, then gains all three tables and cascade foreign keys.
- Migration is additive and contains no destructive down operation or existing-row rewrite.
- Pair physical deletion cascades `watch_room_sources`, `watch_intervals` and `watch_sessions` to zero rows.
- `AccountRepository.unbindPair` checks whether migration `0008` exists before adding the revoke statement, so existing pre-0008 local tests remain compatible; release order must still apply migration before deploying this Worker code.

## Security

- Uses separate `HISTORY_GRANT_SECRET` and `HISTORY_INGEST_SECRET`; example file contains names only and no values.
- Grant payload binds version, grant/source/pair/user/room/slot and `iat`/`exp`; full grants are neither persisted nor logged.
- Internal ingest requires the service-binding URL host `account.internal`, `X-Tongkan-History-Timestamp`, and `X-Tongkan-History-Signature` over `timestamp + "\n" + rawBody`.
- Timestamp tolerance is exactly plus or minus 5 minutes; body tamper, wrong host, malformed signature and expired timestamp are rejected before D1 writes.
- No account session token, complete email, room key, invite URL, Cookie, Firebase credential or real Secret was added to source, fixtures, logs or this handoff.

## Idempotency and Fail-Open Notes

- Same immutable interval content replays successfully; changed content returns `HISTORY_INTERVAL_CONFLICT` before any new interval is committed.
- Older/equal revisions return the stored accepted revision without rollback. Closed, revoked or expired sources only acknowledge already accepted stale revisions; higher revisions are rejected.
- D1 `batch()` contains interval inserts, affected-session recomputation and source revision/status update. Every write statement repeats the active-source identity guard.
- History metadata failure degrades to title hint/BVID fallback and does not roll back interval storage.
- W1 does not modify Signaling room behavior. Reviewer/W2 must keep Account ingest failure optional and retryable so playback, chat and invitation remain fail-open.

## Validation

- `pnpm --filter @tongkan/account typecheck` — passed.
- `pnpm --filter @tongkan/account test` — passed, 13 files and 93 tests.
- `pnpm --filter @tongkan/account build` — passed as Wrangler dry-run after locally building `@tongkan/protocol` with `pnpm --filter @tongkan/protocol build`; no deployment occurred.
- `git diff --check -- apps/account specs/TK-005-history-statistics/handoffs/TK-005-W1-account.md` — passed for the implementation commit; rerun after this handoff commit.
- Real local D1 evidence includes 20 duplicate/reordered rounds, immutable conflict zero-partial-write checks, all four required offsets, local midnight/month boundary splitting, keep/pending/delete/third-party authorization, unbind race and pair cascade.

## Rollback and Reviewer Dependencies

- Before any remote migration, rollback is a normal revert of the W1 commits.
- After additive migration, disable grant/history routes or revert Worker code and leave the new tables idle; do not delete trusted history data.
- Reviewer must configure matching local/Preview Account and Signaling Secret values plus the `ACCOUNT_HISTORY` Service Binding. This task did not modify `wrangler.toml`.
- No Preview/production migration, deployment, production access, APK build/publication, push, merge or rebase was performed.

## Blockers

- None for code review and local integration.
- Cross-service fixture alignment still depends on W2 using `https://account.internal` and the frozen OpenAPI header names.
