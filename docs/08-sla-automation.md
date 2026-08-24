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

Useful derived states:
- ON_TRACK
- AT_RISK
- BREACHED
- MET

## First Response

The first public agent response satisfies the first-response target and sets `firstRespondedAt` once.

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
