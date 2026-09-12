# Ticket Workflow

## Statuses

```text
OPEN
IN_PROGRESS
WAITING_CUSTOMER
RESOLVED
CLOSED
ESCALATED
```

## Valid Manual Transitions

```text
OPEN -> IN_PROGRESS
OPEN -> RESOLVED
OPEN -> ESCALATED               (ADMIN / MANAGER)
IN_PROGRESS -> WAITING_CUSTOMER
IN_PROGRESS -> RESOLVED
IN_PROGRESS -> ESCALATED        (ADMIN / MANAGER)
WAITING_CUSTOMER -> IN_PROGRESS
WAITING_CUSTOMER -> RESOLVED
WAITING_CUSTOMER -> ESCALATED   (ADMIN / MANAGER)
RESOLVED -> CLOSED
RESOLVED -> IN_PROGRESS
ESCALATED -> IN_PROGRESS        (ADMIN / MANAGER — de-escalate)
```

Arbitrary skipping and undocumented backward transitions are invalid. Direct closing from `OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`, or `ESCALATED` is rejected. `CLOSED` has no further manual transition. Entering or leaving `ESCALATED` requires `ADMIN` or `MANAGER`; an `AGENT` attempting either is rejected `403` even on a self-assigned ticket.

Closing uses the existing ticket update endpoint and sets `closedAt` server-side while preserving `resolvedAt`, conversation, SLA snapshots, and status history. `ADMIN` and `MANAGER` may close any resolved ticket; `AGENT` may close only a resolved ticket assigned to that agent.

## Reopen

A resolved ticket may return to OPEN/IN_PROGRESS if the customer replies and the ticket is still eligible for reopening, or via manual staff transition `RESOLVED -> IN_PROGRESS`.

Every reopen path — customer portal reply, inbound EMAIL, and the manual `RESOLVED -> IN_PROGRESS` transition — shares one rule: `resolvedAt` is cleared and `resolutionDueAt` is **retained unchanged**. No fresh SLA deadline is snapshotted on reopen; the ticket re-enters live SLA evaluation against its existing `resolutionDueAt` (so a ticket reopened past that deadline is honestly `BREACHED`, not `MET`). `firstResponseDueAt` / `firstRespondedAt` are untouched.

## Escalation

ESCALATED represents an attention state for tickets requiring manager intervention or SLA escalation.

`ESCALATED` is stored as the ticket status. `ADMIN` and `MANAGER` may enter escalation from `OPEN`, `IN_PROGRESS`, or `WAITING_CUSTOMER`. They remove escalation through `ESCALATED -> IN_PROGRESS`.

`AGENT` cannot enter or leave `ESCALATED`. No separate previous-status field is stored; the prior status remains available through `TicketHistory`.

When entering `RESOLVED`, the service sets `resolvedAt`. Every reopen out of `RESOLVED` (manual `RESOLVED -> IN_PROGRESS`, portal reply, inbound EMAIL) clears `resolvedAt` and retains `resolutionDueAt` (see [Reopen](#reopen)). Entering `CLOSED` sets `closedAt` and preserves `resolvedAt`. Clients cannot set workflow timestamps directly.

Routing changes (`departmentId` / `branchId` / `teamId`) are not recorded in `TicketHistory`; they write one `AuditLog` row with `action = TICKET_ROUTING_CHANGED` (id values only) in the same transaction as the update. See `docs/06-auth-rbac.md`.

## Priorities

- LOW
- MEDIUM
- HIGH
- URGENT

## Suggested Default Categories

- Technical
- Billing
- Account
- General
- Complaint
- Other

## History

Important actions should create ticket history records:
- ticket created
- assignment changed
- status changed
- priority changed
- category changed
- ticket resolved
- ticket closed

History stores the actor plus old and new values when useful. It is an operational lifecycle record, not event sourcing.

Automatic assignment (ADR-051) is recorded through this same mechanism: an
`AUTO_ASSIGNMENT` history row with `actorUserId = null` and `newValue` = the
assigned agent's name, so the trail shows an unassigned ticket became owned by an
agent without a human actor. The matching audit-log entry carries
`metadata.reason = "automatic_assignment"`.

## Customer replies

Customer replies create public `TicketMessage` records only. A reply changes `WAITING_CUSTOMER` to `IN_PROGRESS`; a reply to `RESOLVED` reopens as `OPEN` and clears `resolvedAt`. Both changes and their history records are atomic with the message. CLOSED returns `409 TICKET_CLOSED`; other statuses do not change automatically.

Portal mapping: OPEN to OPEN, IN_PROGRESS/ESCALATED to IN_PROGRESS, WAITING_CUSTOMER to WAITING_FOR_YOU, and RESOLVED/CLOSED unchanged.

## WhatsApp channel (`feature/whatsapp-integration`, ADR-030)

An inbound WhatsApp message is the equivalent of a customer reply. It appends to the customer's newest ticket with `channel = WHATSAPP` and a non-terminal status (`OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `ESCALATED`), applying the same `WAITING_CUSTOMER → IN_PROGRESS` bump. If no such ticket exists — including when the last one is `RESOLVED` or `CLOSED` — a new ticket is opened (`channel = WHATSAPP`, `status = OPEN`, `priority = MEDIUM`, standard MEDIUM SLA snapshot, `TICKET_CREATED` history with `actorUserId = null`). Unlike a Portal reply, an inbound WhatsApp message never reopens a `RESOLVED` ticket; it starts a fresh one. WhatsApp tickets otherwise use the identical workflow, transition matrix, SLA automation, assignment, and history model as every other channel — there is no separate WhatsApp workflow.

A failed outbound WhatsApp send (agent reply that Meta rejects or that cannot be delivered) writes a `WHATSAPP_DELIVERY_FAILED` history row (`actorUserId = null`, `newValue` = failure reason). A successful send writes no extra history.

## Email channel (`feature/email-channel`, ADR-044)

Inbound EMAIL is a normal customer public message. Reliable headers and a random reply-address token are preferred over the controlled public-reference subject fallback, and every match is constrained to the sender's Customer and `channel = EMAIL`. `WAITING_CUSTOMER -> IN_PROGRESS` and `RESOLVED -> OPEN` (clearing `resolvedAt`) reuse the Portal customer-reply semantics. A reply to CLOSED starts a new EMAIL ticket. An outbound public reply is committed only after Resend accepts it; internal notes never leave the CRM. Full detail is in `docs/21-email-integration.md`.
