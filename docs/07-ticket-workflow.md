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

## Primary Flow

```text
NEW
  |
  v
OPEN
  |
  v
IN_PROGRESS
  |
  v
WAITING_CUSTOMER
  |
  v
RESOLVED
  |
  v
CLOSED
```

## Reopen

A resolved ticket may return to OPEN if the customer replies and the ticket is still eligible for reopening.

## Escalation

ESCALATED represents an attention state for tickets requiring manager intervention or SLA escalation.

Implementation may either:
- use ESCALATED as a status, or
- preserve workflow status and store a separate escalation flag

Do not change this behavior silently. Pick one implementation and record it in `17-decisions-log.md`.

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
