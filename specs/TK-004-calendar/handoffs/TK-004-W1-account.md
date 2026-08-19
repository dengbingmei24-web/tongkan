# Handoff: TK-004-W1 Account Calendar

**Status**: READY_FOR_REVIEW
**Commit**: `9d1fe51453eae24c153ff1a227e63695dc665446`
**Branch**: `codex/TK-004-W1-account`
**Baseline**: `a5324c5e5b15eb4798e0e3af159175477fd15647`

## Completed

- Added `0007_calendar_plans.sql` with `pair_calendar_state`, `calendar_plans`, indexes and existing-pair backfill.
- Added independent calendar revision, month/date/today reads, create/reschedule/complete/cancel and media snapshots.
- Added active-pair authorization, keep-archive read-only access and pair-delete cascade behavior.
- Initialized calendar state in the existing atomic pair-accept batch.
- Added frozen OpenAPI routes and strict request parsing to Account Worker.
- Added service tests and real local D1 integration coverage, including 20 stale-revision races.

## Changed Files

- `apps/account/migrations/0007_calendar_plans.sql`
- `apps/account/src/calendar-models.ts`
- `apps/account/src/calendar-repository.ts`
- `apps/account/src/calendar-service.ts`
- `apps/account/src/calendar-service.test.ts`
- `apps/account/src/calendar-repository.integration.test.ts`
- `apps/account/src/repository.ts`
- `apps/account/src/worker.ts`

## Validation

- TypeScript: `tsc -p apps/account/tsconfig.json --noEmit` — PASS.
- Calendar tests: 9/9 — PASS.
- Account full test suite: 68/68 — PASS.
- Wrangler dry-run: PASS, no deployment performed.
- `git diff --check`: PASS before commit.

## Migration and Compatibility

- Migration 0007 is additive and backfills state for existing active and archived pairs.
- Old clients do not call calendar routes and remain compatible.
- Pair creation now requires migration 0007 to be applied before deploying this Worker version.
- `library_item_id` uses `ON DELETE SET NULL`; media snapshots preserve existing plans after a library deletion.

## Security

- All activity writes require current `active_pair_members` membership and expected calendar revision.
- Archive reads require the caller's own retention status to be `keep`.
- No B站 credentials, video stream, notification secrets or session tokens are added.

## Rollback

- Before migration: revert the W1 commit.
- After additive migration: roll back Worker code; leave empty/unused calendar tables in place rather than running a destructive down migration.

## Review Notes

- Production migration/deployment is intentionally not performed.
- Commit identity used the existing automatic local Git identity; no global Git configuration changed.
