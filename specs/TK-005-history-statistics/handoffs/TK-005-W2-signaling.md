# TK-005-W2 Signaling/Protocol Handoff

**Date**: 2026-09-01
**Branch**: `codex/TK-005-W2-signaling`
**Baseline**: `9473dcdba18341169ad3e7e0ac976f9140cf65b5`
**Implementation Commit**: `189d11b2aa96731f51772102fbb2669104c57bb0`
**Verdict Requested**: Reviewer approval for W2 integration

## Completed Tasks

- T201: added optional `history.bind`, `history.bound`, three non-closing history error codes, and history-capable playback reports with `ended`/`durationSeconds` while retaining legacy report compatibility.
- T202: added exact-key, grant-size, duration, media and numeric validation plus TypeScript/Android JSON contract tests.
- T203–T205: added signed grant verification, strict two-party overlap, server-wall-clock intervals, stable 32hex IDs, session rotation, 60-second checkpoints, persistent reports/bindings/active interval/pending snapshots/source revision, and reload recovery.
- T206: added injectable `ACCOUNT_HISTORY` Fetcher seam, timestamp/body HMAC client, ack validation, terminal 4xx classification and recoverable 5xx/network classification.
- T207: multiplexed stale, grant expiry, checkpoint, retry, room TTL and bounded flush grace onto the existing Durable Object alarm.
- T208: kept history optional and fail-open; history bind/ingest failures do not close sockets or block playback, chat, screen share or room lifecycle.
- T209: added deterministic fake-clock, retry, reload, alarm and security tests.

## Changed Files

- `packages/protocol/src/types.ts`
- `packages/protocol/src/protocol.test.ts`
- `packages/protocol/src/android-contract.test.ts`
- `apps/signaling/src/env.ts`
- `apps/signaling/src/message-validation.ts`
- `apps/signaling/src/message-validation.test.ts`
- `apps/signaling/src/history-tracker.ts`
- `apps/signaling/src/history-tracker.test.ts`
- `apps/signaling/src/history-ingest-client.ts`
- `apps/signaling/src/history-ingest-client.test.ts`
- `apps/signaling/src/worker.ts`
- `apps/signaling/src/room-lifecycle.test.ts`
- `apps/signaling/src/android-contract.test.ts`

## Protocol Compatibility

- `history.bind` is optional and only handled after existing room `auth.ok` semantics; it is not required for anonymous, Web, extension or legacy Android clients.
- Legacy `playback.report` bodies without `ended` and `durationSeconds` remain valid for core synchronization but are excluded from TK-005 timing.
- New reports must provide both fields together; `durationSeconds` is nullable or positive and bounded.
- `history.bound` contains only `type` and `expiresAt`; pair, user and source identifiers are not echoed.
- Invalid, expired and conflicting history grants return their dedicated error codes without closing the WebSocket.

## Timing Matrix Evidence

- Strict valid overlap requires both connected slots, two matching grants with different users, resolved B站 media, playing anchor, fresh reports, `readyState >= 3`, no pause/buffering/ended, matching BVID/page and current sequence.
- Invalid-state matrix verifies zero timing for one-sided grant, disconnect, paused anchor, screen-share mode, not-ready, buffering, ended, stale sequence and media mismatch.
- Report freshness ends exactly at `receivedAtMs + 12_000`; late alarm execution still records the stale deadline rather than alarm wall time.
- Continuous valid playback checkpoints at 60 seconds; seek/rate close and reopen within the same session without counting skipped media positions or scaling by playback rate.
- Pause, buffering, stale, disconnect, media change, ended, grant expiry, history unbind and room expiry close the active interval with server timestamps.
- Pause/buffer/stale/disconnect preserve the current room/media session; explicit media change creates a new session even when returning later to the same media.
- Durable Object reload restores active interval ID, reports, bindings, pending queue and retry state before applying stale/retry boundaries.

## Retry and Alarm Evidence

- Pending snapshots carry all unconfirmed intervals, monotonic `sourceRevision`, stable interval/session IDs and a `closed` marker; a fully bound room also emits an empty closed snapshot.
- Recoverable failures use exponential retry from 1 second, capped at 60 seconds, with an 8-attempt ceiling.
- HTTP 4xx is terminal; HTTP 5xx, network failures and malformed success acknowledgements are recoverable.
- Room cleanup grants at most 2 minutes for pending flush and cannot keep an expired room alive indefinitely.
- Tests verify the alarm selects stale deadline first, then retry deadline, while existing empty-room TTL behavior remains intact.

## Security

- Grant verification checks version, HMAC signature, exact payload keys, `iat`/`exp`, source, pair, user, room and slot; host and guest must be different users.
- Full grant strings and HMAC secrets are never written to Durable Object storage, logs, errors or handoff evidence; tests assert token and secret absence from persisted state.
- Stored state contains only signed grant summaries needed for timing and retry recovery.
- Internal ingest signs `timestamp + "\n" + rawBody` with HMAC-SHA256 and sends lowercase hex in `X-Tongkan-History-Signature`.
- No Account session token, email, room key, invite URL, Cookie or production secret/configuration was added.

## Validation

- `pnpm --filter @tongkan/protocol typecheck` — PASS.
- `pnpm --filter @tongkan/protocol test` — PASS, 2 files / 13 tests.
- `pnpm --filter @tongkan/signaling typecheck` — PASS.
- `pnpm --filter @tongkan/signaling test` — PASS, 8 files / 66 tests.
- `pnpm --filter @tongkan/protocol build` — PASS; generated local protocol `dist` required by workspace package exports.
- `pnpm --filter @tongkan/signaling build` — PASS, Wrangler dry-run only; no deployment.
- `git diff --check -- packages/protocol apps/signaling specs/TK-005-history-statistics/handoffs/TK-005-W2-signaling.md` — PASS before handoff creation and must be rerun after this file is staged.

## Integration Notes

- Reviewer must configure the real `ACCOUNT_HISTORY` Service Binding and the two history secret values outside this branch; production configuration was intentionally untouched.
- W1 and reviewer should confirm the frozen internal signature encoding is lowercase hex HMAC-SHA256 over `timestamp + "\n" + rawBody`; if W1 selected a different encoding, align the shared fixture during reviewer integration before Preview.
- The Worker dry-run correctly shows no `ACCOUNT_HISTORY` binding because this task was forbidden from changing `wrangler.toml`.

## Rollback

- Revert implementation commit `189d11b2aa96731f51772102fbb2669104c57bb0` and the later handoff-only commit.
- No migration, remote state, deployment, APK, production configuration or public contract endpoint was changed, so rollback is code-only.

## Blockers

- None for local W2 completion.
- Preview integration remains gated on W1 Account implementation, reviewer-provided binding/secrets and cross-worker signature fixture confirmation.
