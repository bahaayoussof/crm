# Realtime — Plan

Status: **READY FOR TASKS**

No schema change, no migration, no new dependency, no route/RBAC/response-shape change, no new SSE event type. Discovery (`spec.md`) found the transport itself, its authorization chokepoint, the transaction-safety outbox, and every producer call site except one already correct. This plan covers exactly one backend one-line fix (RT-GAP-1), one documentation correction (RT-GAP-2), and the regression test that would have caught RT-GAP-1 (RT-GAP-5).

## Smallest brownfield-safe shape

1. **`server/src/modules/sla-automation/sla-automation.service.ts`** — `escalateBreachedTickets`'s `emitTicketUpdated` call (currently `{ ticketId: ticket.id, assignedAgentId: ticket.assignedAgentId, customerId: ticket.customerId }`) gains `teamId: ticket.teamId`, matching the sibling call three lines away in `assignUnassignedTickets` (`{ ticketId: ticket.id, assignedAgentId: outcome.assignedAgentId, customerId: ticket.customerId, teamId: ticket.teamId }`) and every other producer's shape. `ticket.teamId` is already selected in the candidate query (`select: { id, subject, status, assignedAgentId, customerId, teamId }`) — no new query, no new field.
2. **`server/src/modules/sla-automation/sla-automation.test.ts`** — extend the existing escalation test ("escalates only resolution-breached unresolved tickets and notifies the team manager and admins") with an assertion on the `emitTicketUpdated` mock's call arguments (`expect.objectContaining({ ticketId: "ticket-9", teamId: "team-a" })`), and add one dedicated regression test for an **unrouted** escalation (`teamId: null`) asserting the event still fires with `teamId: null` explicitly (not merely omitted) — this is the exact shape that keeps `canReceive` behaving correctly for ADMIN-only routing on an unrouted ticket, and guards against a future accidental omission being masked by `?? null` defaulting.
3. **`docs/22-realtime-events.md`** §6 — correct the stale `requireRole(ADMIN, MANAGER, AGENT)` line to `requireRole(ADMIN, MANAGER, AGENT, CUSTOMER)`, matching `realtime.routes.ts` and the document's own §9. One-line text change, no code implication.

No change to:
- `realtime.service.ts`, `realtime.publisher.ts`, `realtime.controller.ts`, `realtime.routes.ts`, `realtime.types.ts` — transport, outbox, and authorization are already correct (verified by full read + existing `realtime.test.ts`).
- `client/src/features/realtime/*` — subscription/invalidation mapping is already correct for every event type and both audience roles (internal/customer).
- Any other producer (`ticket.service.ts`, `portal.service.ts`, `email.service.ts`, `sms.service.ts`, `whatsapp.service.ts`, `live-chat.service.ts`, `live-chat-inactivity.service.ts`, `integrations/outbound-delivery{,-retry}.ts`, `notifications.service.ts`) — all already pass `teamId`/scope correctly; re-verified directly against current code, not assumed from prior specs.
- Prisma schema / migrations — `Ticket.teamId` already exists and is already selected by the query in question.

## Sequencing

1. Backend fix first (RT-001) — a one-field addition, trivially reviewable in isolation.
2. Regression tests (RT-004) — extend the existing test plus one new unrouted-escalation case, in the same file, immediately after the fix so the diff is self-contained and provably closes the gap.
3. Documentation fix (RT-002) — independent, no ordering dependency on 1–2.
4. Final verification gate (RT-005) — focused tests only, per the fast-track brief; no full-suite rerun since only one file changed a shared primitive's *call site*, not the primitive itself.

## Risks / mitigations

- **Blast radius**: the fix only adds a field to an existing call; it cannot change *whether* an event fires, only *who receives it* — so no risk of a new duplicate/missing `ticket.updated` for any role that was already correctly receiving it (ADMIN, the assigned AGENT). Verified by re-running the existing escalation test unmodified in assertion shape (only adding, not changing, expectations) before adding the new one.
- **Test coupling**: the existing escalation test's `toHaveBeenCalledWith(expect.objectContaining(...))` pattern for `ticketUpdateMany` is reused for `emitTicketUpdated` — no new assertion style introduced.
- **Doc drift re-litigation**: RT-GAP-2 was already named as `CC-DG-05` in `conversations-channels/spec.md`; fixing the specific stale §6 line here does not conflict with that spec (which described the drift but, per its own scope, deferred the actual doc reconciliation for `docs/22` to whichever pass owns that file — this one).

## Verification strategy

Per the fast-track brief: focused tests only. Final gate: server `vitest run src/modules/sla-automation` (regression proof) + `vitest run src/modules/realtime` (confirm the untouched transport still passes, since the audit read every line of it) + server `tsc -b` + server `eslint` (changed file only, plus the touched test file) + `git diff --check`. Client is untouched by this feature (no client code changed), so client `vitest`/`tsc`/`eslint` are run once at the very end per the task brief's own "final verification" list, not after every step, to confirm the pre-existing client realtime suite is unaffected by the backend-only change (it cannot be, but the brief asks for it explicitly).
