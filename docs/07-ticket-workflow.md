# Ticket Workflow

## Statuses

```text
NEW
OPEN
IN_PROGRESS
WAITING_CUSTOMER
RESOLVED
CLOSED
ESCALATED
```

## Valid Manual Transitions

```text
NEW -> OPEN
OPEN -> IN_PROGRESS
IN_PROGRESS -> WAITING_CUSTOMER
WAITING_CUSTOMER -> IN_PROGRESS
IN_PROGRESS -> RESOLVED
WAITING_CUSTOMER -> RESOLVED
RESOLVED -> CLOSED
```

Arbitrary skipping and undocumented backward transitions are invalid. Direct closing from `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`, or `ESCALATED` is rejected. `CLOSED` has no further manual transition.

Closing uses the existing ticket update endpoint and sets `closedAt` server-side while preserving `resolvedAt`, conversation, SLA snapshots, and status history. `ADMIN` and `MANAGER` may close any resolved ticket; `AGENT` may close only a resolved ticket assigned to that agent. The internal UI presents closing as a dedicated confirmed action rather than duplicating `CLOSED` in the generic status selector.

## Reopen

A resolved ticket may return to OPEN if the customer replies and the ticket is still eligible for reopening. `RESOLVED -> OPEN` is not exposed as a manual Ticket Management transition; the later conversation workflow owns it.

## Escalation

ESCALATED represents an attention state for tickets requiring manager intervention or SLA escalation.

`ESCALATED` is stored as the ticket status. `ADMIN` and `MANAGER` may enter escalation from `NEW`, `OPEN`, `IN_PROGRESS`, or `WAITING_CUSTOMER`. They remove escalation through `ESCALATED -> IN_PROGRESS`.

`AGENT` cannot enter or leave `ESCALATED`. No separate previous-status field is stored; the prior status remains available through `TicketHistory`.

When entering `RESOLVED`, the service sets `resolvedAt`. When leaving `RESOLVED` through a later approved conversation workflow, that workflow owns clearing or updating `resolvedAt`. Entering `CLOSED` sets `closedAt`. Clients cannot set workflow timestamps directly.

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

## Customer replies

Customer replies create public `TicketMessage` records only. A reply changes `WAITING_CUSTOMER` to `IN_PROGRESS`; a reply to `RESOLVED` reopens as `OPEN` and clears `resolvedAt`. Both changes and their history records are atomic with the message. CLOSED returns `409 TICKET_CLOSED`; other statuses do not change automatically.

Portal mapping: NEW/OPEN to OPEN, IN_PROGRESS/ESCALATED to IN_PROGRESS, WAITING_CUSTOMER to WAITING_FOR_YOU, and RESOLVED/CLOSED unchanged.

## WhatsApp channel (`feature/whatsapp-integration`, ADR-030)

An inbound WhatsApp message is the equivalent of a customer reply. It appends to the customer's newest ticket with `channel = WHATSAPP` and a non-terminal status (`NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `ESCALATED`), applying the same `WAITING_CUSTOMER → IN_PROGRESS` bump. If no such ticket exists — including when the last one is `RESOLVED` or `CLOSED` — a new ticket is opened (`channel = WHATSAPP`, `status = NEW`, `priority = MEDIUM`, standard MEDIUM SLA snapshot, `TICKET_CREATED` history with `actorUserId = null`). Unlike a Portal reply, an inbound WhatsApp message never reopens a `RESOLVED` ticket; it starts a fresh one. WhatsApp tickets otherwise use the identical workflow, transition matrix, SLA automation, assignment, and history model as every other channel — there is no separate WhatsApp workflow.

A failed outbound WhatsApp send (agent reply that Meta rejects or that cannot be delivered) writes a `WHATSAPP_DELIVERY_FAILED` history row (`actorUserId = null`, `newValue` = failure reason). A successful send writes no extra history.
