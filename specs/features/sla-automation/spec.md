# SLA / Automation — Brownfield Specification

Status: **discovery complete, gaps resolved, fast-tracked to implementation** (see `plan.md` / `tasks.md`).

Branch: `chore/sdd-foundation`. Reuses the existing `SlaRule`, `Ticket` SLA columns, and the bounded `sla-monitor` cron infra approved in prior SDD passes (Tickets, Conversations/Channels, Realtime). No schema, migration, dependency, or queue introduced.

## 1. Current SLA data model

`server/prisma/schema.prisma`:

- `SlaRule { priority @unique, firstResponseMinutes, resolutionMinutes, isActive, createdAt, updatedAt }` — one row per `TicketPriority` (LOW/MEDIUM/HIGH/URGENT), `ADMIN`-only CRUD via `PUT /settings/sla-rules/:priority` (`settings.service.ts` `upsertSlaRule`, audited `SLA_RULE_CREATED` / `SLA_RULE_UPDATED`). Rules are deactivated, never deleted.
- `Ticket` carries five SLA timestamp columns: `firstResponseDueAt`, `firstRespondedAt`, `resolutionDueAt`, `resolvedAt`, `closedAt`. No `isBreached`/`slaStatus`/derived column is persisted anywhere — every "current state" is computed at request time.

## 2. SLA defaults / policy source

Default targets (LOW 8h/72h, MEDIUM 4h/48h, HIGH 1h/24h, URGENT 15m/4h — see `specs/features/sla-settings-categories/spec.md`) are seeded as `SlaRule` rows; the live values are whatever is currently active in the `SlaRule` table (ADMIN-editable, prospective only — never rewrites existing ticket snapshots).

## 3. Deadline calculation (snapshot semantics)

- **Creation** (`ticket.service.ts createTicket`, `portal.service.ts createTicket`, `live-chat.service.ts startLiveChat`, and the Email/SMS/WhatsApp inbound-create paths): look up `SlaRule` by the new ticket's priority (Portal/Email/SMS/WhatsApp/unrouted paths always create at `MEDIUM`); if an active rule exists, `firstResponseDueAt = now + firstResponseMinutes`, `resolutionDueAt = now + resolutionMinutes`; otherwise both stay `null` and creation still succeeds.
- **Priority change** on an unresolved, non-terminal ticket (`updateTicket`): recalculates from the change time using the *new* priority's active rule — `firstResponseDueAt` only while `firstRespondedAt` is still `null`; `resolutionDueAt` whenever the ticket is not `RESOLVED`/`CLOSED` (see §9 for the one open observation on this rule and `ESCALATED`). No rule found ⇒ the relevant deadline is cleared to `null`.
- Deadlines are **snapshots**, not recurring recalculations — nothing walks existing tickets when an `SlaRule` row changes.

## 4. First-response semantics (approved rule, preserved verbatim)

> First response is satisfied only by the first customer-visible human staff reply from ADMIN, MANAGER, or AGENT. Internal notes, system/provider events, inbound customer messages, and AI-generated content (unless a staff member explicitly sends it as their public reply) do **not** count.

Verified against the actual implementation:

- `POST /tickets/:id/messages` (`addTicketMessage`, `ticket.service.ts`) is the **only** write path that ever sets `firstRespondedAt`, via a single guarded statement inside the same transaction as the message insert: `tx.ticket.updateMany({ where: { id, firstRespondedAt: null }, data: { firstRespondedAt: createdAt } })`. The route is mounted behind `requireRole(ADMIN, MANAGER, AGENT)` only — a CUSTOMER can never reach it. This is true for every channel including `LIVE_CHAT` (a live chat is a `Ticket`; staff replies through this same endpoint).
- The `where: { firstRespondedAt: null }` guard makes the stamp write idempotent and race-safe: a second, third, … staff reply always affects zero rows and never overwrites the first timestamp. If the surrounding transaction fails, nothing is stamped (`addTicketMessage`'s reply insert and the stamp share one `$transaction`).
- `addTicketNote` (internal notes) never touches `firstRespondedAt` — confirmed by reading the function body; no code path exists.
- `portal.service.ts reply()` (customer portal reply) never touches `firstRespondedAt`, `firstResponseDueAt`, or `resolutionDueAt`.
- Inbound Email/SMS/WhatsApp (`email.service.ts`, `sms.service.ts`, `whatsapp.service.ts`) never reference `firstRespondedAt`/`firstResponseDueAt` anywhere — confirmed by full-module grep returning zero matches. New-ticket creation on these channels sets `firstResponseDueAt`/`resolutionDueAt` (the deadline, not the "responded" stamp); the WAITING_CUSTOMER→IN_PROGRESS reopen-on-reply transition (`email.service.ts`) writes only `{ status: "IN_PROGRESS" }`, nothing SLA-related.
- AI-generated content: there is no path that lets AI output touch `TicketMessage`/`firstRespondedAt` directly — an AI draft only becomes a first response if a staff member sends it through the normal `addTicketMessage` endpoint as their own reply (author = the sending staff user).

**Conclusion: the first-response rule is already correctly and exclusively implemented at the single canonical seam.** No change made.

## 5. Resolution SLA

- `resolutionDueAt` is set at creation (§3) and persists **across every status change** — it is never cleared, only conditionally recalculated on a priority change (§3) while the ticket is not `RESOLVED`/`CLOSED`.
- `RESOLVED`: `updateTicket` sets `resolvedAt = now` on a genuine transition into `RESOLVED`. `resolutionDueAt` is left untouched (kept for outcome reporting — see `sla-outcomes.ts` `resolutionOutcome`, which compares `resolvedAt` against the retained `resolutionDueAt`).
- **Reopen out of `RESOLVED`** — three paths, one shared rule: manual `RESOLVED → IN_PROGRESS` (`updateTicket`), a customer Portal reply (`portal.service.ts reply`), inbound Email correlated to a `RESOLVED` ticket. All three clear `resolvedAt` to `null` and **retain** the original `resolutionDueAt` — no fresh deadline is snapshotted (this is the already-approved OD-1/TK-001 Tickets-SDD behavior; preserved verbatim here, not re-implemented).
- `CLOSED`: `closedAt = now` is set on a genuine transition into `CLOSED`. `CLOSED` is **fully immutable** (MS-03/MS-04, Tickets SDD) — `assertTicketOpenForMutation` rejects every metadata/workflow/conversation mutation with `409 TICKET_CLOSED` before any other check, and the SLA-monitor escalation query explicitly excludes `closedAt: { not: null }` tickets via `closedAt: null` in its `where`. **Automation never touches a CLOSED ticket** — verified both by the query filter and by `CLOSED` never appearing in `ASSIGNMENT_ACTIVE_STATUSES`/the escalation candidate set.
- **Breach** = `resolutionDueAt` has passed and the ticket has not reached a completion timestamp (`resolvedAt` or `closedAt`) by or before that deadline (`sla-outcomes.ts resolutionOutcome`, used identically by request-time `deriveSla` for the live "SLA state" label).
- `WAITING_CUSTOMER` does **not** pause either clock — confirmed no code path special-cases this status for SLA purposes (OD-5, already an accepted, documented limitation from the Tickets SDD). **Not redesigned here** per the fast-track directive; documented as-is.

## 6. Escalation flow

`escalateBreachedTickets` (`sla-automation.service.ts`, invoked only from the cron-gated `runSlaMonitor`):

- **Candidates**: `status ∈ {OPEN, IN_PROGRESS, WAITING_CUSTOMER}` (`ESCALATABLE_STATUSES` = `ASSIGNMENT_ACTIVE_STATUSES` minus `ESCALATED` — so `RESOLVED`/`CLOSED`/`ESCALATED` are all structurally excluded from the query), `resolutionDueAt` not null and `<= now`, `resolvedAt: null`, `closedAt: null`. Ordered `resolutionDueAt asc, id asc`, bounded to `SLA_MONITOR_BATCH_SIZE` (100).
- **Mutation**: a conditional `updateMany` re-asserting the exact same predicate (`id`, `status` unchanged since the read, `resolutionDueAt <= now`, `resolvedAt: null`, `closedAt: null`) → `status: ESCALATED`. `count !== 1` is treated as "lost the race" (a concurrent manual change or a repeated/overlapping run) and the candidate is skipped with **zero** side effects.
- On a real 1-row update: writes one actorless `TicketHistory` row (`action: "SLA_AUTO_ESCALATED"`), one `AuditLog` row (`TICKET_ESCALATED`, `metadata.reason: "sla_breach"`), notifies recipients (see §8), and emits one `ticket.updated` realtime event with the ticket's own `teamId` (already fixed by the Realtime SDD pass, RT-GAP-1 — preserved, regression-tested again here).
- **Idempotency**: an already-`ESCALATED` ticket is structurally excluded from the next run's candidate query (not merely guarded at write time) — it can never be re-escalated by a repeated or overlapping sweep.
- Manual **de-escalation**: `ESCALATED → IN_PROGRESS` is the only transition out of `ESCALATED` (staff-only, AGENT forbidden — `validateTransition`). This does **not** reset `resolutionDueAt`. If the underlying deadline is still in the past, the ticket is a legitimate escalation candidate again on the next cron run — this is correct SLA-breach semantics (the breach is still real), not a bug, and is not changed here (would require inventing a "manually acknowledged, don't re-escalate" concept that does not exist today — out of scope, see §11).

## 7. Cron / automation

- `GET /api/internal/sla-monitor`, gated by `requireCronSecret` (`sla-automation.auth.ts`): requires `env.CRON_SECRET` to be configured (else `503 CRON_NOT_CONFIGURED`) and a `Bearer <CRON_SECRET>` header compared with `crypto.timingSafeEqual` after an equal-length check (`401 CRON_AUTHENTICATION_REQUIRED` otherwise). Not a product JWT route — no product role can call it.
- One execution runs `assignUnassignedTickets()` then `escalateBreachedTickets(now)`, each bounded to 100 candidates, each candidate processed in its **own** `prisma.$transaction` (assignment delegates to the single canonical `autoAssignTicket` engine — ADR-051 — shared with synchronous ticket create/update; escalation is local to this module).
- The whole run is wrapped once in `withRealtimeOutbox`, which buffers every `emit*` call made during the run and flushes them only if the wrapped function resolves without throwing.
- Response is `{ data: { assigned, escalated, inspected: { unassigned, breached }, generatedAt } }` — counts only, no ticket subjects/customer PII/internal metadata exposed to the caller (Vercel Cron; not customer- or agent-facing).

## 8. Notifications

- **Auto-assignment**: one `TICKET_AUTO_ASSIGNED` notification to the newly assigned agent only (mirrors the synchronous engine — same vocabulary, same history/audit action names, ADR-051).
- **Auto-escalation**: `SLA_BREACH_ESCALATION` to the ticket's operational recipients.
- **SLA warning (pre-breach)**: **not implemented**. `derive-sla.ts` computes an `AT_RISK` display label (within `SLA_WARNING_MINUTES` = 60 minutes of the deadline) for request-time UI presentation only — there is no proactive notification, no warning ladder, no second threshold. This matches the fast-track DEFER list ("advanced warning ladders") and is documented here as an intentional, pre-existing scope boundary, not a gap.

## 9. Realtime

- Every automation-triggered mutation (`assignUnassignedTickets`, `escalateBreachedTickets`) emits `ticket.updated` with the ticket's own `teamId` explicitly set (`null` for an unrouted ticket, never merely omitted) — the RT-GAP-1 fix from the Realtime SDD pass, reverified here with fresh regression tests (§13/`tasks.md`).
- Events are buffered by the outer `withRealtimeOutbox` and only published after the *outer* function resolves — see §11 for the sweep-failure interaction this created, now fixed.

## 10. RBAC / security

- Cron endpoint: `CRON_SECRET`-only, timing-safe compare, no product auth accepted. Confirmed no other route in `sla-automation.routes.ts`.
- Escalation notification recipients are computed via the shared `ticketOperationalRecipientIds` helper (after the fix in §11): every active ADMIN, the manager of the ticket's own team only (never every manager — an unrouted ticket reaches ADMIN only), and the ticket's own assigned agent when it has one. No cross-team leakage; no customer-facing exposure of escalation metadata (Portal never surfaces `firstResponseDueAt`/`resolutionDueAt`/escalation history — confirmed, `portal.service.ts` selects never include these fields).
- Reports/Dashboard SLA aggregates (`reports.service.ts`, `dashboard.service.ts`, `manager.service.ts`) all import and use the same `shared/sla/sla-outcomes.ts` (`firstResponseOutcome`/`resolutionOutcome`) and/or `shared/sla/derive-sla.ts` — spot-checked via `grep`, confirmed no parallel/divergent SLA math exists outside these two shared modules. No Reports redesign performed or required.

## 11. Gaps found and resolved this pass

| # | Gap | Class | Resolution |
|---|---|---|---|
| DG-1 | `escalateBreachedTickets` hand-rolled its own `ADMIN + own-team-manager` recipient query instead of the shared `ticketOperationalRecipientIds` helper that the **manual** `ESCALATED` transition (`ticket.service.ts updateTicket`) already uses for the identical event type. This silently excluded the ticket's own assigned agent from their own ticket's SLA-breach notification. | Implementation bug (wrong recipient) | Fixed — `escalateBreachedTickets` now calls `ticketOperationalRecipientIds(tx, { teamId, assignedAgentId })`, matching the manual escalation path exactly. `docs/08-sla-automation.md` corrected (it had documented the narrower, inconsistent behavior as if intentional). |
| DG-2 | The whole cron run (`assignUnassignedTickets` + `escalateBreachedTickets`, both loops) executed inside one outer `withRealtimeOutbox`, but each candidate's DB work committed in its **own** `$transaction`. If any single candidate's transaction threw (a real, evidenced risk in this codebase — Neon interactive-transaction timeouts, P2028, already logged against the same assignment engine in a prior session), the exception propagated out of `runSlaMonitor`, and `withRealtimeOutbox` **discarded the entire buffered event queue** — silently dropping realtime notifications for every candidate that had already committed earlier in the same run, and the run stopped processing the remaining candidates in that batch. | Implementation bug (broken failure isolation / correctness under partial failure) | Fixed — each candidate's transaction + emit is now wrapped in its own `try/catch`; a failure is logged (`console.error`, candidate id included) and the loop continues with the next candidate. DB state was already correct (each candidate's own transaction had already committed or rolled back on its own); this only stops the *realtime event loss* and the *batch abort*. |
| DG-3 (observation, not fixed) | A priority change on an `ESCALATED` ticket recalculates `resolutionDueAt` to a fresh `now + resolutionMinutes` (same clause that handles `OPEN`/`IN_PROGRESS`/`WAITING_CUSTOMER` — it is guarded only against `RESOLVED`/`CLOSED`, not `ESCALATED`). This lets a priority edit "cure" an escalated breach without an explicit resolution. This is pre-existing Tickets-SDD behavior (priority-change recalculation is an approved, already-implemented rule; it was never scoped to exclude `ESCALATED`), not new to this pass, and changing it would be a genuine product-policy decision ("should escalation be sticky against priority edits?") outside the fast-track's "confirmed defect" bar. Documented as a known limitation; **not changed**. | Architecture debt / potential future product decision | Deferred — flagged for a human product call, not fast-tracked. |
| DG-4 (observation, not fixed) | `ESCALATED → IN_PROGRESS` does not reset `resolutionDueAt`; if the deadline is still in the past, the very next cron run re-escalates the ticket. This is correct SLA-breach semantics as implemented (see §6), not a defect — recorded here only so it is not rediscovered as a "duplicate escalation" false positive in a future audit. | Documentation | No change — documented in §6. |

No unresolved product decision blocked continuation to `plan.md`/`tasks.md` — DG-1 and DG-2 are confirmed defects fixable inside the existing seams; DG-3/DG-4 are explicitly deferred, not blocking.

## 12. Known limitations (deferred, unchanged, consistent with the fast-track DEFER list)

- `WAITING_CUSTOMER` does not pause either SLA clock (no pause/resume semantics exist; not invented here).
- No business-hours/holiday calendars — deadlines are wall-clock minutes from a UTC timestamp.
- No per-customer/per-account SLA policy — one global `SlaRule` per priority.
- No generic job queue/distributed scheduler — the existing bounded, batched, cron-triggered sweep is preserved as-is (DG-2's fix adds per-candidate failure isolation, not a queue).
- No SLA warning ladder / pre-breach notification — only the request-time `AT_RISK` display label exists.
- No performance optimization attempted — no evidence of a performance problem at current scale (batch size 100, ADR-051's documented "up to ~200 additional indexed reads per 5-minute run" bound is unchanged and still accepted for V1).
- Reports/Dashboard SLA metrics were verified consistent (shared `sla-outcomes.ts`/`derive-sla.ts`), not redesigned.

## 13. Acceptance / invariants this spec commits to (verified by `tasks.md` tests)

1. `firstResponseDueAt`/`resolutionDueAt` are computed per-priority from the active `SlaRule` at creation; absent rule ⇒ both null, creation still succeeds.
2. Only a staff (ADMIN/MANAGER/AGENT) public reply via `addTicketMessage` ever sets `firstRespondedAt`; it is set exactly once, idempotently.
3. Internal notes, inbound customer/provider messages (Portal, Email, SMS, WhatsApp), and un-sent AI drafts never set `firstRespondedAt`.
4. `resolutionDueAt` persists across status changes; reopen from `RESOLVED` clears `resolvedAt`, retains `resolutionDueAt`.
5. `CLOSED` tickets are never mutated by automation (candidate queries exclude them structurally) — consistent with the CLOSED-immutability invariant from the Tickets SDD.
6. Escalation is idempotent: an already-`ESCALATED` ticket cannot be re-escalated by a repeated or concurrent sweep; a lost race writes no side effects.
7. Escalation notification recipients = every active ADMIN + the ticket's own-team manager (only) + the ticket's own assignee (when set) — no cross-team leakage, no unrouted-ticket manager fan-out.
8. The realtime `ticket.updated` event for both automatic assignment and automatic escalation always carries the ticket's own `teamId`, explicit `null` for unrouted.
9. The cron endpoint requires a valid `CRON_SECRET` bearer token; misconfiguration returns `503`, a bad/missing token returns `401`.
10. A single candidate's failure during a sweep does not abort the rest of the batch and does not drop already-committed candidates' realtime events.
