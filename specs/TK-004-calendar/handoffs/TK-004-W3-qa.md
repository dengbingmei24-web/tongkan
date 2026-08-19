# Handoff: TK-004-W3 Calendar QA

**Status**: READY_FOR_REVIEW
**Commit**: `7ebd5e5fd61198496042761cfee8f5616e802f51`
**Branch**: `codex/TK-004-W3-qa`
**Baseline**: `a5324c5e5b15eb4798e0e3af159175477fd15647`

## Completed

- Added a 16-case Calendar contract for authentication, no-pair, A/B consistency, query and mutation validation, CRUD, sorting, today filtering, duplicate handling, stale revisions, 20-round races, old-pair isolation, archive permissions and both-delete cascade evidence.
- Added a default-offline PowerShell runner. `-ValidateOnly` reads no secret, creates no HTTP client and sends no network request.
- Added explicit Preview/local allowlisting, redirect blocking, in-memory SecureString handling, dependency resolution, typed placeholder expansion, response assertions and 20-round parallel race verification.
- Added an acceptance guide with disposable Preview fixture topology, safe Live invocation, reviewer-only D1 evidence and blocking conditions.

## Changed Files

- `qa/calendar/contract-cases.json`
- `qa/calendar/run-preview.ps1`
- `qa/calendar/acceptance.md`

## Case Inventory

1. `unauthorized-calendar`
2. `no-pair-account`
3. `active-calendar-a-b-baseline`
4. `calendar-query-boundaries`
5. `mutation-input-boundaries-no-revision`
6. `create-plan-a-b-consistency`
7. `update-and-complete-plan`
8. `delete-plan`
9. `same-day-sort-month-date-today`
10. `duplicate-plan-no-revision`
11. `stale-revision-no-overwrite`
12. `revision-race-20`
13. `late-old-pair-write`
14. `archive-keep-readonly`
15. `archive-forbidden-states`
16. `both-delete-api-and-d1-cascade`

## Validation

- PowerShell AST parse — PASS.
- `contract-cases.json` JSON parse and 16-case count — PASS.
- `run-preview.ps1 -ValidateOnly` — PASS; no secret read, HTTP client or network request.
- Precise credential/production-host scan — PASS; the only generic credential strings are the runner's own rejection regexes.
- `git diff --cached --check -- qa/calendar` — PASS before the core commit.
- Preview Live and D1 cascade queries — NOT RUN; they require reviewer-prepared disposable Preview fixtures and separate execution.

## Cleanup Requirements

- Live uses non-overlapping disposable dates. Re-run with a fresh date set or reset the disposable Preview pair.
- Remove created Calendar plans and disposable accounts/pairs after Preview evidence is collected.
- Clear all SecureString variables and close the PowerShell process after Live execution.
- Reviewer-only D1 evidence must retain only zero/non-zero counts, never database IDs, full pair IDs or raw command output.

## Security

- Production host is not allowlisted. Remote Live requires HTTPS and exact `tongkan-account-preview-gateway.pages.dev`; local Live is limited to localhost/127.0.0.1.
- Redirects are disabled so bearer credentials cannot follow another host.
- Tokens and Preview test key are accepted only as one-time SecureString parameters and are never read from files or environment variables.
- Logs omit URL, query, body, response, token, email and fixture values.
- Runner does not run migration, deployment, D1, account creation, unbind or archive preparation commands.

## Rollback

- Revert commit `7ebd5e5fd61198496042761cfee8f5616e802f51`; no database, Worker, Android or production state was changed.

## Review Notes

- Windows PowerShell 5.1 may require `-ExecutionPolicy Bypass` for local script execution; the AST command remains policy-independent.
- The `empty-start-time` request intentionally expects `400 INVALID_REQUEST` because the frozen OpenAPI accepts only `HH:mm` or null; reviewer integration should reject an empty string rather than silently normalize it.
- Automatic local Git identity remained `unknown <dengbingmei@game.ntes>`; no global Git configuration changed.
