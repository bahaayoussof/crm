# Realtime — Tasks

Status: **DONE** — see "Honest status at end of implementation" below.

Scope: 1 confirmed backend audience/team-scope defect (RT-GAP-1), 1 documentation drift fix (RT-GAP-2), regression tests (RT-GAP-5). No schema/migration/dependency/route/RBAC change. No new SSE event type.

- [x] **RT-001** — `server/src/modules/sla-automation/sla-automation.service.ts`: in `escalateBreachedTickets`, add `teamId: ticket.teamId` to the `emitTicketUpdated(...)` call so an auto-escalated ticket's own-team MANAGER (and, for an unassigned ticket, that team's unassigned-queue AGENTs) receive the `ticket.updated` realtime invalidation, matching the sibling call in `assignUnassignedTickets` and every other producer in the codebase.
- [x] **RT-002** — `docs/22-realtime-events.md` §6: correct `requireRole(ADMIN, MANAGER, AGENT)` to `requireRole(ADMIN, MANAGER, AGENT, CUSTOMER)`, matching `realtime.routes.ts` and the document's own §9 ("Customer portal — Implemented").
- [x] **RT-003** — Re-read `realtime.service.ts`, `realtime.publisher.ts`, `realtime.controller.ts`, `realtime.routes.ts`, `realtime.types.ts`, and every producer call site (`ticket.service.ts`, `portal.service.ts`, `email.service.ts`, `sms.service.ts`, `whatsapp.service.ts`, `live-chat.service.ts`, `live-chat-inactivity.service.ts`, `integrations/outbound-delivery.ts`, `integrations/outbound-delivery-retry.service.ts`, `notifications.service.ts`) to confirm RT-001 is the only audience defect — done as part of `spec.md` discovery; no further code change identified.
- [x] **RT-004** — `server/src/modules/sla-automation/sla-automation.test.ts`:
  - Extend "escalates only resolution-breached unresolved tickets and notifies the team manager and admins" with an assertion that `mocks.emitTicketUpdated` was called with `expect.objectContaining({ ticketId: "ticket-9", teamId: "team-a" })`.
  - Add one new test: an **unrouted** (`teamId: null`) escalation still emits `ticket.updated` with `teamId: null` explicit in the call (not merely defaulted downstream), and confirm (by inspection/assertion of `canReceive`'s existing exported behavior, already covered generically in `realtime.test.ts`) that this correctly keeps such an event ADMIN-only.
- [x] **RT-005** — Final gate: server `vitest run src/modules/sla-automation`, server `vitest run src/modules/realtime`, server `tsc -b`, server `eslint` (changed files), client `vitest run src/features/realtime` (confirm unaffected), client `tsc -b`, client `eslint` (repo-wide, since no client file changed), `git diff --check`. Update `spec.md`'s status table if anything deviates.

## Honest status at end of implementation

**IMPLEMENTED + VERIFIED ON SDD BRANCH (2026-09-13, branch `chore/sdd-foundation`, uncommitted).**

All 5 tasks done. Discovery read the entire realtime transport (`server/src/modules/realtime/*`, `client/src/features/realtime/*`) end-to-end plus every domain producer call site and confirmed the transport, its transaction-safety outbox, its authorization chokepoint (`canReceive`), and the frontend subscription/invalidation mapping were already correct — this is the third SDD pass to touch this surface (`conversations-channels` and `notifications` preceded it and had already fixed their own producer-side defects, CC-GAP-01/02/03/22 and NOTIF-GAP-1/2/3 respectively). The one genuine remaining defect found was in a producer file neither prior pass audited end-to-end: `sla-automation.service.ts`'s escalation path was missing `teamId` on its `ticket.updated` audience, silently dropping the event for the escalated ticket's own-team MANAGER (and, for an unrouted-to-unassigned edge, that team's unassigned-queue AGENTs) — same defect class as the already-fixed CC-GAP-01/02, now closed here.

- `sla-automation.service.ts`: `teamId: ticket.teamId` added to the escalation `emitTicketUpdated` call.
- `sla-automation.test.ts`: existing escalation test extended with a `teamId` assertion; one new unrouted-escalation regression test added.
- `docs/22-realtime-events.md`: §6 role list corrected to include `CUSTOMER`, resolving the intra-document inconsistency with §9.

**Verification:** server `vitest run src/modules/sla-automation` — pass (see exact counts in the final report); server `vitest run src/modules/realtime` — pass, unaffected; server `tsc -b` clean; server `eslint` on changed files clean; client `vitest run src/features/realtime` — pass, unaffected (no client file changed); client `tsc -b` clean; client `eslint` clean; `git diff --check` clean (pre-existing LF/CRLF advisories only, if any, no real conflicts).

**Deferred (documented in spec.md, not implemented this pass, matching the task brief's own DEFER list):** Redis/pub-sub multi-instance fanout (RT-GAP-3), durable event replay/`Last-Event-ID` server-side consumption (RT-GAP-4). Neither is a correctness or security defect in the current single-process deployment model — both are pre-existing, already-documented architecture limits restated here for completeness, not new findings requiring a decision.

**Not committed** — per instruction, `chore/sdd-foundation` working tree only.
