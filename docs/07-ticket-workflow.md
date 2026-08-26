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

Arbitrary skipping and undocumented backward transitions are invalid. In particular, `NEW -> RESOLVED` and `OPEN -> CLOSED` are rejected.

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
