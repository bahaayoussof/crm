# SLA / Automation — Tasks

Status: **IMPLEMENTED + VERIFIED ON SDD BRANCH** (all tasks below complete)

## SLA-001 — Fix DG-1: escalation notification recipients must include the ticket's own assignee

- **Goal:** `escalateBreachedTickets` uses the same operational-recipient policy as the manual `ESCALATED` transition.
- **Files:** `server/src/modules/sla-automation/sla-automation.service.ts`
- **Change:** import `ticketOperationalRecipientIds` from `../../shared/team/team-scope.js`; replace the inline `tx.user.findMany({ OR: [{role:ADMIN}, ...team manager] })` with `ticketOperationalRecipientIds(tx, { teamId: ticket.teamId, assignedAgentId: ticket.assignedAgentId })`. Remove the now-unused `Role` import.
- **Verification:** existing test "escalates only resolution-breached unresolved tickets and notifies the team manager and admins" still passes unmodified (the test's `userFindMany` mock branches on `where.role === Role.AGENT`, and the new query has no top-level `role` field, so it falls through to the same stub path). New test SLA-002 proves the assignee is actually included.
- Status: `[x]`

## SLA-002 — Regression test: assignee receives the SLA-breach notification

- **Files:** `server/src/modules/sla-automation/sla-automation.test.ts`
- **Test:** `"SLA-001: the escalated ticket's own assigned agent is included in the breach notification recipients"` — candidate ticket has `assignedAgentId: "agent-9"`; asserts `userFindMany` was called with `OR` containing `{ id: "agent-9" }`, and `notificationCreateMany` includes a `SLA_BREACH_ESCALATION` row for `agent-9`.
- **Verification:** `vitest run src/modules/sla-automation` → 20/20 baseline → 23/23 with this + SLA-004's 2 new tests added.
- Status: `[x]`

## SLA-003 — Fix DG-2: isolate one candidate's transaction failure from the rest of the sweep batch

- **Goal:** a single candidate's `prisma.$transaction` throwing does not abort `runSlaMonitor`, does not discard already-buffered realtime events from earlier-committed candidates in the same run, and does not stop the remaining candidates in the batch from being processed.
- **Files:** `server/src/modules/sla-automation/sla-automation.service.ts`
- **Change:** wrap the per-candidate `$transaction` + `emitTicketUpdated` block in `try/catch` inside both `assignUnassignedTickets`'s and `escalateBreachedTickets`'s `for` loops; `catch` logs `console.error("sla-automation: {assignment|escalation} failed for ticket <id>", error)` and the loop continues.
- **Verification:** SLA-004 below; no change to `SlaMonitorResult`'s shape or to any passing test.
- Status: `[x]`

## SLA-004 — Regression tests: sweep failure isolation

- **Files:** `server/src/modules/sla-automation/sla-automation.test.ts`, new `describe("sweep failure isolation")`
- **Tests:**
  - `"a failing escalation transaction for one candidate does not abort the rest of the batch"` — two escalation candidates, the first candidate's `$transaction` call rejects (`mockImplementationOnce` → reject); asserts the second candidate still escalates, still emits its realtime event, the first candidate never emits, and the error was logged with the failing ticket's id.
  - `"a failing assignment transaction for one candidate does not abort the rest of the batch"` — same shape for the assignment loop.
- **Verification:** `vitest run src/modules/sla-automation` → 23/23 (20 baseline + 1 SLA-002 + 2 SLA-004).
- Status: `[x]`

## SLA-005 — Test gap: inbound customer/provider message never stamps `firstRespondedAt` (WhatsApp)

- **Files:** `server/src/modules/integrations/whatsapp/whatsapp.test.ts`
- **Change:** added one assertion to the existing "creates a new customer and a new WhatsApp ticket" test — `data` passed to `ticket.create` must not have a `firstRespondedAt` key. Encodes the spec §4 invariant at the data-shape level (source already never sets it — confirmed by full-module grep before this task).
- Status: `[x]`

## SLA-006 — Test gap: inbound customer/provider message never stamps `firstRespondedAt` (SMS, Email)

- **Files:** `server/src/modules/integrations/sms/sms.test.ts`, `server/src/modules/integrations/email/email.test.ts`
- **Change:** same assertion pattern added to SMS's "always creates a NEW ticket" test and Email's "creates a customer, EMAIL ticket, customer message, history, and notification" test. Email's separate WAITING_CUSTOMER→IN_PROGRESS reopen test already asserted the update `data` object by exact equality (`{ status: "IN_PROGRESS" }`), which already implicitly proved no SLA field is touched on reopen — no change needed there.
- Status: `[x]`

## SLA-007 — Documentation reconciliation

- **Files:** `docs/08-sla-automation.md`
- **Change:** corrected the escalation-recipient paragraph (was documenting the pre-fix ADMIN+manager-only behavior as if intentional; now states the shared `ticketOperationalRecipientIds` policy including the assignee) and added a paragraph documenting per-candidate sweep failure isolation.
- Status: `[x]`

## SLA-008 — Final verification gate

Run at completion, not after every task (per fast-track instruction):

- `vitest run src/modules/sla-automation` → **23/23** (20 baseline + 3 new: SLA-002, and 2 in SLA-004)
- `vitest run src/modules/integrations/email src/modules/integrations/sms src/modules/integrations/whatsapp src/modules/sla-automation src/modules/tickets` → **287/287** (10 files)
- `vitest run src/shared/team src/modules/notifications src/modules/realtime` → **84/84** (3 files, adjacent/unaffected — confirms no regression in the shared recipient helper's other callers or the realtime transport)
- server `npm run typecheck` → clean
- server `npm run lint` → clean
- `git diff --check` → clean (one pre-existing unrelated CRLF advisory on `.wolf/memory.md`, not from this feature's files)
- No client file changed — client suite not run (per fast-track instruction: only run broader suites if shared primitives changed broadly or focused verification exposes risk; neither applies here).
- Status: `[x]`

## Honest status at end of this session

- **DG-1 and DG-2 (spec §11) are the only confirmed defects found** across the full brownfield audit (data model, deadline calculation, first-response, resolution, escalation, cron, notifications, realtime, RBAC/security, reporting consistency). Both are fixed, tested, and documented.
- **DG-3 and DG-4** (spec §11) are documented observations, not fixed — DG-3 in particular is a genuine "should escalation be sticky against a priority edit?" product question, deliberately left to a human product decision rather than fast-tracked, per the task's own instruction to resolve *only* necessary decisions and avoid inventing new SLA semantics.
- First-response and resolution semantics (spec §4/§5) required **zero code changes** — they were already correctly and exclusively implemented at the single canonical seam (`addTicketMessage`), already matched the approved rule verbatim, and were already covered by comprehensive existing tests from the prior Tickets SDD pass. This pass closed a real but narrow test-coverage gap (SLA-005/006: explicit negative-space assertions for the three inbound channels) rather than fixing a behavior bug.
- No schema, migration, dependency, route, RBAC, notification-type, or client change was required or made.
- Not committed — uncommitted per instruction, same as every other artifact on `chore/sdd-foundation` this session.
