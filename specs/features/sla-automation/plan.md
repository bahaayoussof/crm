# SLA / Automation — Implementation Plan

Status: **IMPLEMENTED** — see `tasks.md` (`SLA-001`…`SLA-004`) for execution and verification status.

Scope: fix the two confirmed defects from `spec.md` §11 (DG-1 wrong recipient, DG-2 sweep failure isolation), close the identified test gaps, reconcile `docs/08-sla-automation.md`, no other behavior change.

## Approach

Smallest brownfield-safe change for each defect, entirely inside the existing `sla-automation.service.ts` module:

- **DG-1**: replace the hand-rolled `tx.user.findMany({ OR: [{role:ADMIN}, ...] })` recipient query in `escalateBreachedTickets` with the already-shared `ticketOperationalRecipientIds(tx, { teamId, assignedAgentId })` (`shared/team/team-scope.ts`) — the exact helper the manual `ESCALATED` transition in `ticket.service.ts` already uses for the same notification type. Zero new code, one import, one query swap.
- **DG-2**: wrap the per-candidate work (the `prisma.$transaction(...)` call plus its dependent `emitTicketUpdated`) in `try/catch` inside both `assignUnassignedTickets`'s and `escalateBreachedTickets`'s `for` loops. A caught error is logged with the candidate's ticket id via `console.error` and the loop continues. No change to the outer `withRealtimeOutbox` wrapping, no change to `SlaMonitorResult`'s shape (`assigned`/`escalated` simply reflect actual successes).

No schema change, no migration, no new dependency, no new endpoint, no new notification type, no queue/worker infrastructure.

## Files touched

- `server/src/modules/sla-automation/sla-automation.service.ts` — DG-1 + DG-2 fixes.
- `server/src/modules/sla-automation/sla-automation.test.ts` — new regression tests (assignee-included-in-recipients; sweep-failure-isolation ×2).
- `server/src/modules/integrations/{email,sms,whatsapp}/{email,sms,whatsapp}.test.ts` — one assertion each closing the "inbound customer/provider message never stamps firstRespondedAt" test gap (data-shape assertion on the existing ticket-creation test; no new test, no production change).
- `docs/08-sla-automation.md` — correct the escalation-recipient description (was narrower than the fixed behavior); document sweep failure isolation.
- `specs/features/sla-automation/{spec,plan,tasks}.md` — this initiative's own artifacts.

## Explicitly not touched

- `server/prisma/schema.prisma` — no new column, no migration.
- `ticket.service.ts`, `portal.service.ts`, `email.service.ts`, `sms.service.ts`, `whatsapp.service.ts`, `live-chat.service.ts` — first-response/resolution semantics already correct (spec §4/§5); no change.
- `shared/sla/derive-sla.ts`, `shared/sla/sla-filter.ts`, `shared/sla/sla-outcomes.ts` — already correct and already shared consistently by Reports/Dashboard/Manager; no change.
- `assignment/assignment.service.ts` / `assignment.types.ts` — the canonical auto-assignment engine is unrelated to either defect; no change.
- Client (`client/src/**`) — no UI/contract change; the fix is server-internal (notification recipients + cron robustness), and the cron response shape is unchanged.
- Reports/Dashboard — verified consistent, no redesign.

## Risk / rollback

Both fixes are additive/corrective inside a single module with existing, comprehensive test coverage (23 pre-existing tests, all passing before this change). DG-1 strictly *widens* a notification audience by one already-known-safe recipient (the ticket's own assignee, who already has ticket visibility) — cannot introduce a cross-team leak. DG-2 strictly *narrows* the blast radius of a failure (one candidate instead of the whole batch) and cannot make a successful run behave differently. Both are trivially revertible via `git diff` on one file.

## Verification gate (see `tasks.md` for the itemized checklist)

- `vitest run src/modules/sla-automation` (focused)
- `vitest run src/modules/tickets src/modules/notifications src/modules/realtime src/modules/integrations` (adjacent, unaffected — proves no regression)
- server `npm run typecheck`, `npm run lint`
- `git diff --check`
- No client suite run required (no client file touched).
