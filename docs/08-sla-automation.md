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

`feature/settings` adds ADMIN-only management of the existing per-priority `SlaRule` rows. Rules are activated or deactivated, never deleted; targets are positive bounded integers and resolution cannot be lower than first response. Settings changes are prospective: they affect later ticket creation and the existing eligible priority-change recalculation only. They never rewrite deadline snapshots on existing tickets. Background monitoring and automated actions remain deferred to `feature/sla-automation`.

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

## Portal SLA interpretation

Portal-created requests snapshot the active MEDIUM rule. Customer replies never set `firstRespondedAt`. Reopening preserves `resolutionDueAt` and does not recalculate deadlines. Portal responses never expose raw or derived SLA fields.

## Basic Tracking Versus Deferred Automation

Basic SLA tracking consists of deadline snapshots, eligible priority-change recalculation, one-time first-response recording, shared request-time derivation, Dashboard presentation, and internal Ticket Details presentation. Background workers, scheduled monitoring, persisted SLA state or breach events, notifications, automatic escalation/assignment, SLA reports, and SLA administration remain deferred.
