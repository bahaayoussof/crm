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

An inbound WhatsApp message is the equivalent of a customer reply. **(Updated 2026-09-13, ADR-057 — supersedes the "appends to the customer's newest ticket" rule below.)** Meta's webhook exposes no reliable thread/message correlation beyond phone identity, so the old "customer's newest non-terminal WhatsApp ticket" fallback is removed: every inbound WhatsApp message without a stronger correlation signal opens a **new** ticket (`channel = WHATSAPP`, `status = OPEN`, `priority = MEDIUM`, standard MEDIUM SLA snapshot, `TICKET_CREATED` history + exactly one `AuditLog(TICKET_CREATED, actorId: null)`). A `RESOLVED` or `CLOSED` ticket is never targeted by identity and is never reopened. WhatsApp tickets otherwise use the identical workflow, transition matrix, SLA automation, assignment, and history model as every other channel.

A failed outbound WhatsApp send (agent reply that Meta rejects or that cannot be delivered) writes a `WHATSAPP_DELIVERY_FAILED` history row (`actorUserId = null`, `newValue` = failure reason) and a durable `MessageDelivery(FAILED)` row; a successful send updates the same `MessageDelivery` row to `SENT` (no extra history row). See ADR-057.

## Email channel (`feature/email-channel`, ADR-044)

Inbound EMAIL is a normal customer public message. Reliable headers and a random reply-address token are preferred over the controlled public-reference subject fallback, and every match is constrained to the sender's Customer and `channel = EMAIL`. **(Updated 2026-09-13, ADR-057.)** Absent one of those three reliable correlations, an inbound email always creates a new EMAIL ticket — the previous "customer's one active EMAIL ticket" identity-only fallback is removed, and `RESOLVED -> OPEN` reopening only ever happens via a reliable correlation, never via sender identity alone. `WAITING_CUSTOMER -> IN_PROGRESS` reuses the Portal customer-reply semantics. A reply to CLOSED starts a new EMAIL ticket. Per ADR-052, the local reply commits before Resend is called — a provider failure writes `EMAIL_DELIVERY_FAILED` history plus a durable `MessageDelivery(FAILED)` row (ADR-057) rather than rolling back the reply; internal notes never leave the CRM. Full detail is in `docs/21-email-integration.md`.
