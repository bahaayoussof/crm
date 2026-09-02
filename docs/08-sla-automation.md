# SLA and Automation

## Default SLA Targets

| Priority | First Response | Resolution |
|---|---:|---:|
| LOW | 8 hours | 72 hours |
| MEDIUM | 4 hours | 48 hours |
| HIGH | 1 hour | 24 hours |
| URGENT | 15 minutes | 4 hours |

## Ticket SLA Fields

At minimum:
- firstResponseDueAt
- firstRespondedAt
- resolutionDueAt

`firstResponseDueAt` is the SLA deadline calculated when the ticket is created or prioritized. `firstRespondedAt` is the actual timestamp of the first public agent response and remains null until that response occurs. Their comparison supports first-response compliance and reporting such as average first-response time.

## Ticket Management Snapshots

When a ticket is created, use the active `SlaRule` matching its priority, if one exists. Calculate `firstResponseDueAt` and `resolutionDueAt` from the persisted creation time. If no active matching rule exists, both deadlines remain null and creation succeeds.

When an unresolved ticket changes priority, recalculate from the priority-change time using the new priority's active rule:

- update `firstResponseDueAt` only while `firstRespondedAt` is null
- update `resolutionDueAt` only while the ticket is not `RESOLVED` or `CLOSED`
- set each relevant unresolved deadline to null when no active matching rule exists

This snapshot behavior does not include timers, workers, alerts, notifications, automatic escalation, or any other SLA automation.

`feature/settings` adds ADMIN-only management of the existing per-priority `SlaRule` rows. Rules are activated or deactivated, never deleted; targets are positive bounded integers and resolution cannot be lower than first response. Settings changes are prospective: they affect later ticket creation and the existing eligible priority-change recalculation only. They never rewrite deadline snapshots on existing tickets.

Useful derived states:
- ON_TRACK
- AT_RISK
- BREACHED
- MET

## Shared Request-Time SLA Derivation

The Agent Dashboard and authorized internal Ticket Details use one pure shared backend derivation with an explicitly injected request time. While `firstRespondedAt` is null, `firstResponseDueAt` applies. While the ticket is not terminal, `resolutionDueAt` applies. When both apply, the earlier deadline is effective; an exact tie selects `FIRST_RESPONSE` deterministically.

The result contains `slaState`, `effectiveSlaDueAt`, and `effectiveSlaTarget`. The target is `FIRST_RESPONSE`, `RESOLUTION`, or `null`. Terminal, met-with-no-active-target, and unconfigured results return null target and deadline. API timestamps are ISO strings derived from persisted UTC-safe values, without localized-string comparison or minute rounding.

- `BREACHED`: effective deadline is earlier than or equal to the request time
- `AT_RISK`: effective deadline is after the request time and no more than 60 minutes away
- `ON_TRACK`: effective deadline is more than 60 minutes away
- `MET`: status is `RESOLVED` or `CLOSED`, `resolvedAt` or `closedAt` is set, or the configured response target is complete and no unresolved resolution target applies
- `NOT_CONFIGURED`: no applicable configured deadline exists

Exactly zero remaining is `BREACHED`; exactly 60 minutes remaining is `AT_RISK`. The warning window is fixed at 60 minutes for this assessment. These states are display-time derivations only. They are not persisted and do not add timers, workers, polling, alerts, notifications, or automatic escalation.

## First Response

The first public agent response satisfies the first-response target and sets `firstRespondedAt` once.

Ticket Conversation records this timestamp in the same database transaction as the first successful internal public reply. The message creation timestamp is used, clients cannot control it, and later public replies do not overwrite it. Failed reply transactions leave it unchanged.

Ticket notes and customer notes are internal and do not count as a customer response.

## Resolution

The resolution target is satisfied when the ticket reaches RESOLVED.

## Escalation

For the assessment:
- show SLA breach clearly in the UI
- allow manual escalation
- automatic escalation may be implemented only if P0/P1 are stable

## Assignment

Preferred later automation:
- assign to eligible agent with the lowest number of active tickets

Manual assignment is acceptable for the core delivery.

### Synchronous Team-Scoped Automatic Assignment (ADR-051)

Implemented as real backend behavior, not a UI button. One canonical service —
`server/src/modules/assignment/` — is the single source of truth for automatic
assignment policy.

**Strategy (V1): least-loaded active AGENT within the ticket's existing Team.**

- Runs when a ticket is **not already assigned**, has a valid `teamId`, is not
  terminal, and the Team has at least one eligible active agent.
- Eligible agent = `role === AGENT` **and** active/enabled **and**
  `User.teamId === Ticket.teamId`. Cross-team assignment is impossible; the
  existing `CROSS_TEAM_ASSIGNMENT` / `AGENT_HAS_NO_TEAM` invariants remain
  authoritative.
- Active workload = the agent's tickets in `OPEN`, `IN_PROGRESS`,
  `WAITING_CUSTOMER`, or `ESCALATED`. `RESOLVED` / `CLOSED` never count.
- Deterministic tie-break: lowest workload, then agent `id` ascending. No random
  ordering, no unstable DB ordering, no new schema column.
- **`teamId = null` → the ticket is left unassigned for ADMIN routing.** The
  engine never infers or invents a Team. Automatic Team routing is explicitly
  NOT part of this feature.
- **An existing `assignedAgentId` is never overwritten**, even if another agent
  is less loaded. Automatic assignment fills empty assignments only; it is not a
  continuous load balancer and never reassigns.
- No eligible agent **does not fail** ticket creation or update — the ticket is
  created/updated successfully and simply stays unassigned for the
  Admin/Manager workflow.

**Where it runs (one shared seam, not per-channel engines):**

- Internal CRM ticket creation, when a Team is resolved and no explicit assignee
  was chosen.
- The canonical ticket update flow, when an ADMIN routes a previously unrouted
  ticket (`teamId: null → <team>`) and leaves the assignee empty.
- Live Chat creation (a live chat is created already routed to a Team).
- Customer Portal / Email / WhatsApp / SMS tickets are created with
  `teamId = null` by design, so auto-assignment runs for them later, from the
  ticket update flow, once an ADMIN routes them to a Team.

**Pipelines reused:** canonical `TicketHistory`
(`action = "AUTO_ASSIGNMENT"`, actorless, `newValue` = agent name) and `AuditLog`
(`TICKET_ASSIGNED`, `metadata.reason = "automatic_assignment"`) — identical to the
SLA-monitor auto-assignment; one `TICKET_AUTO_ASSIGNED` notification to the
selected in-team agent; the existing `ticket.updated` realtime event. No new
event type, no schema change, no migration.

**Configuration:** enabled-by-default V1 product rule. There is no
`automaticAssignmentEnabled` flag — the project has no generic app-settings store
(only `Category` / `SlaRule` rows), so a toggle is deferred to a future ADR.

**Known V1 limitation:** two ticket creations racing in separate transactions can
both read workload `0` for the same agent and both pick them (bounded skew up to
the concurrency width). The conditional guarded update still guarantees no
double-assignment and no duplicate history/audit/notification. Full
serialization would require a distributed scheduler and is out of scope.

## Portal SLA interpretation

Portal-created requests snapshot the active MEDIUM rule. Customer replies never set `firstRespondedAt`. Reopening preserves `resolutionDueAt` and does not recalculate deadlines. Portal responses never expose raw or derived SLA fields.

## Bounded Monitoring Automation

Vercel Cron calls the internal `GET /api/internal/sla-monitor` endpoint every five minutes with the independent server-side `CRON_SECRET`. This is not a normal authenticated product endpoint and does not accept product JWT authorization. One execution processes bounded batches of at most 100 assignment candidates and 100 escalation candidates, ordered deterministically so later executions drain larger backlogs.

Automatic assignment:

- considers only active statuses and tickets whose `assignedAgentId` is null
- never changes an existing manual or automated assignment
- considers active `AGENT` users only
- requires equality for every non-null ticket `departmentId` and `branchId`; an unconstrained ticket may use any active agent
- chooses the eligible agent with the fewest tickets in active statuses, then `id ASC`
- increments the in-memory load after each successful assignment so one run distributes its batch consistently

Automatic escalation:

- uses only the persisted resolution deadline: `resolutionDueAt <= execution time`
- requires an unresolved, non-closed active status and null `resolvedAt` / `closedAt`
- changes the status to `ESCALATED`, but never re-escalates an already `ESCALATED` ticket
- does not use the first-response deadline as an escalation trigger

Both actions use conditional updates inside transactions. History and notifications are inserted only after the guarded update affects exactly one row. Repeated or overlapping executions therefore create no duplicate mutation, history, or notification for unchanged state. Automated history has `actorUserId: null`; assignment alerts target the selected agent and escalation alerts target active `ADMIN`/`MANAGER` users. No `isBreached`, `slaStatus`, or other derived state is stored.

## Basic Tracking Versus Bounded Automation

Basic SLA tracking consists of deadline snapshots, eligible priority-change recalculation, one-time first-response recording, shared request-time derivation, Dashboard presentation, and internal Ticket Details presentation. The bounded cron monitor adds scheduled automatic assignment, resolution-breach escalation, history, and in-app alerts. General worker infrastructure, job queues, configurable rule builders, round-robin history, persisted derived SLA state, and external notification delivery remain out of scope.
