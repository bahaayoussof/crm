# Domain Model

Business domain, derived from `server/prisma/schema.prisma`, server
services, and cross-checked against `docs/04`, `docs/06`, `docs/07`,
`docs/08`. See `## Review Notes` for discrepancies found.

## Actors / Roles

Four roles (`Role` enum): `ADMIN`, `MANAGER`, `AGENT`, `CUSTOMER`. A
`CUSTOMER` is a normal `User` whose `Customer` record is optionally linked
via `Customer.userId` — one authenticated-identity model for every role
(ADR-003).

| Role | Scope | Can do |
| --- | --- | --- |
| `ADMIN` | Global | Everything: all tickets, users, org structure (teams/departments/branches), settings, SLA rules, audit logs, reports, quick replies. Only role that can create non-customer users and enter/exit `ESCALATED` alongside MANAGER. |
| `MANAGER` | Own `Team` | Tickets owned by their team (`Ticket.teamId`), team's agents, team-scoped reports/dashboard, quick replies (where permitted), knowledge base, tasks. Can transition tickets into/out of `ESCALATED`. Registered as escalation-alert recipient for their own team's breaches. |
| `AGENT` | Self + team's unassigned queue | Tickets assigned to self, or unassigned tickets within their team (to self-claim). Cannot view another agent's assigned ticket. Can only PATCH `status`/`priority` on self-assigned tickets, and only when already assigned — never `ESCALATED` in or out. Self-assignment is an atomic conditional update (race-safe; `409` on lost race, idempotent `200` if already theirs). |
| `CUSTOMER` | Own data only | Own tickets (via linked `Customer`), reply on them (subject to status), knowledge-base browsing, own profile, post-resolution feedback, AI/Live Chat support widget. Never sees internal notes, other customers, staff assignment detail, or internal SLA metrics. |

Server-side enforcement is authoritative (`requireRole`, per-role Prisma
`where` scoping in `ticket-visibility.ts`, `team-scope.ts`). Frontend route
guards (`ManagerRoute`, `UserManageRoute`, etc.) exist for UX only and are
explicitly commented in code as non-authoritative.

**Known, documented limitation** (not a bug): role/active-status changes
take effect immediately only on the customer-portal router
(`requireFreshToken`) and the User Management admin router
(`requireActiveUser`). Everywhere else, a demoted or deactivated user keeps
their JWT-embedded role until the 8-hour token expires.

## Core Entities

| Entity | Business role |
| --- | --- |
| `User` | The one authenticated identity for every role (staff or customer login). |
| `Customer` | CRM-side profile for an external customer — contact info, notes, ticket history; optionally linked to a `User` for portal login. |
| `Ticket` | The central unit of support work: status, priority, channel, `teamId` (authoritative ownership), assignee, SLA deadline snapshots. |
| `TicketMessage` | Customer-visible conversation entry; carries provider ids (`externalId`, `externalMessageId`) for channel dedup/threading. |
| `TicketNote` | Internal-only note on a ticket; supports `@mentions`, never customer-visible. |
| `TicketWatcher` | A user following a ticket for notification fan-out. |
| `TicketMention` | One row per (note, mentioned user) — drives @mention notifications. |
| `CustomerNote` | Internal note on a customer *profile* (not ticket-specific). |
| `Attachment` | Uploaded file metadata (Vercel Blob-backed); polymorphic parent — ticket, message, or customer. |
| `TicketHistory` | Append-only per-ticket lifecycle audit trail (status/assignment/priority/category changes); `actorUserId` nullable for system-driven changes (e.g. SLA auto-escalation). |
| `AuditLog` | A separate, general-purpose cross-entity audit trail (actor, action, entity, metadata, IP/UA) — **not** the same thing as `TicketHistory`; both exist and are actively written. |
| `Team` | The real management/ownership unit: one manager (`Team.managerId`, unique), N agents, owns tickets via `Ticket.teamId`. |
| `Department` / `Branch` | Organizational structure — a `Branch` groups `Department`s, which group `Team`s. |
| `Task` | Operational follow-up, optionally ticket-linked, with due-date reminders. |
| `Notification` | In-app event surface for a user (assignment, reply, escalation, mention, reminder); optionally linked to a ticket/task. No external delivery (email/push/SMS) — in-app + realtime only. |
| `KnowledgeArticle` | Help-center content, `DRAFT`/`PUBLISHED`; published articles ground the customer-facing AI assistant. |
| `SlaRule` | Configurable per-priority SLA target (first response + resolution minutes), one active rule per `TicketPriority`. |
| `Feedback` | One-per-ticket post-resolution CSAT rating + comment from the customer. |
| `QuickReply` | Reusable canned response template for agents. |
| `Category` | Ticket categorization taxonomy. |
| `PasswordResetToken` | Single-use, hashed, expiring token for the password-reset flow. |

## Ticket Lifecycle

**Statuses** (`TicketStatus` enum — all currently valid, no legacy values
found in the schema): `OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`,
`RESOLVED`, `CLOSED`, `ESCALATED`.

**Valid transitions** (enforced in `ticket.service.ts`'s `transitions`
table; an invalid move returns `409 INVALID_STATUS_TRANSITION`):

```text
OPEN             -> IN_PROGRESS, RESOLVED, ESCALATED
IN_PROGRESS      -> WAITING_CUSTOMER, RESOLVED, ESCALATED
WAITING_CUSTOMER -> IN_PROGRESS, RESOLVED, ESCALATED
RESOLVED         -> CLOSED, IN_PROGRESS
CLOSED           -> (terminal, no outgoing transitions)
ESCALATED        -> IN_PROGRESS
```

- A ticket is created in `OPEN`.
- `OPEN` cannot jump directly to `WAITING_CUSTOMER` or `CLOSED`.
- `RESOLVED` stamps `resolvedAt`; `CLOSED` stamps `closedAt`; `CLOSED` is
  the only truly terminal state.
- `RESOLVED` can reopen to `IN_PROGRESS`; `CLOSED` cannot reopen manually.
- **Role restriction**: only `ADMIN`/`MANAGER` may transition a ticket
  into or out of `ESCALATED`; `AGENT` cannot, even on a self-assigned
  ticket.
- **Customer/channel-driven reopening** (portal reply, inbound
  email/WhatsApp/SMS reply) is separate from the manual-transition matrix
  above: `WAITING_CUSTOMER → IN_PROGRESS`, `RESOLVED → OPEN` (clears
  `resolvedAt`); replying to a `CLOSED` ticket returns `409 TICKET_CLOSED`
  instead of reopening it.
- `AGENT` may only mutate `status`/`priority` on a ticket assigned to
  themselves.

## Ticket Priorities

`TicketPriority` enum: `LOW`, `MEDIUM`, `HIGH`, `URGENT`. Each has one
active `SlaRule` governing its response/resolution targets.

## Channels

`Channel` enum: `WEB`, `EMAIL`, `WHATSAPP`, `SMS`, `LIVE_CHAT` — all five
are real, currently-implemented channels (not stubs; see
`specs/architecture.md`). `LIVE_CHAT` is not a separate messaging
subsystem — it is a normal `Ticket` with `channel = LIVE_CHAT`, reusing the
same `TicketMessage` model as every other channel, plus department-based
team routing at start and a cron-triggered inactivity auto-close.

## SLA

- Configuration: one active `SlaRule` per `TicketPriority`, holding a first
  response target and a resolution target (minutes). Admin-managed via
  `/api/settings/sla-rules`; rules are deactivated, never deleted, and
  changes are prospective (never rewrite existing ticket snapshots).
- Deadline snapshots live on `Ticket`: `firstResponseDueAt`,
  `firstRespondedAt`, `resolutionDueAt`, `resolvedAt`, `closedAt`. Computed
  once at ticket creation from the active rule for that priority; if no
  active rule exists, both deadline fields stay `null`.
- `firstRespondedAt` is stamped on the first **public agent reply** only —
  internal notes never affect it — and only once (never overwritten).
- Changing priority on an unresolved ticket recalculates
  `firstResponseDueAt` (only if `firstRespondedAt` is still null) and
  `resolutionDueAt` from the new priority's active rule.
- **Derived display state** (not persisted): `ON_TRACK`, `AT_RISK`,
  `BREACHED`, `MET`, `NOT_CONFIGURED` — computed from whichever deadline
  (first response or resolution) is earliest/"effective", with a 60-minute
  warning window before a deadline counts as `AT_RISK`.
- **Automated escalation**: a cron-triggered `GET /api/internal/sla-monitor`
  (protected by a static `CRON_SECRET`, not a product JWT) escalates any
  unresolved ticket whose `resolutionDueAt` has passed into `ESCALATED`
  (never re-escalates an already-`ESCALATED` ticket), and separately
  attempts to auto-assign unassigned, team-routed, active-status tickets
  through the same assignment engine used at ticket creation. There is no
  in-process scheduler — this endpoint must be invoked externally (e.g.
  Vercel Cron, every 5 minutes per current docs).
- Escalation notifies every active `ADMIN` plus **only the ticket-owning
  team's manager** (team-scoped) — not every manager org-wide.

## Ownership / Assignment Rules

- `Ticket.teamId` is the **authoritative** ownership boundary — set once
  when the ticket is routed to a team, and does not change as assignment
  changes over the ticket's life. It is never inferred from
  `assignedAgent.teamId`.
- A `teamId = null` ticket (unrouted) is left for `ADMIN` manual routing;
  automatic assignment does not act on it.
- Automatic assignment (creation-time and the SLA-monitor sweep) picks an
  active `AGENT` on the owning team with the fewest active assigned
  tickets, tie-broken by id — this is one canonical engine reused by both
  paths, not duplicated logic.
- Agents can self-claim an unassigned ticket within their team via an
  atomic conditional update; a lost race returns `409
  TICKET_ALREADY_ASSIGNED`, an already-mine claim is an idempotent `200`.
- `Team.managerId` and `User.teamId` currently model exactly one team per
  manager/agent (a documented V1 simplification, not a bug).

## Customer Visibility

Enforced server-side, not just hidden in the UI:

- A `CUSTOMER` can only see tickets tied to their own linked `Customer`
  record, and only public `TicketMessage` entries — never `TicketNote`,
  staff assignee identity beyond what's needed, internal SLA metrics,
  watchers, or @mentions.
- Realtime events are scoped the same way: a `CUSTOMER` never receives
  `notification.*` events, and only receives ticket events for their own
  tickets' public messages.
- The customer-facing AI assistant (`customer-ai` module) is an explicitly
  separate context boundary from the internal AI assistant — it only
  retrieves published knowledge-base content, never internal ticket
  context, prompts, or actions (ADR-054).

## Review Notes

- **`AuditLog` vs `TicketHistory`** (reconciled 2026-09-09): both models exist
  and are actively written; the distinction is stated in `## Core Entities`
  above and matches `docs/06-auth-rbac.md` ("Audit logging — `AuditLog` and
  `TicketHistory`") and `docs/04-database-design.md`'s `### AuditLog` model
  entry, neither of which frames a dedicated audit log as an open question.
- **Escalation-notification audience** (reconciled 2026-09-09): the team-scoped
  rule above (every active `ADMIN` + only the owning-team manager; unrouted →
  `ADMIN` only) is now stated the same way in `docs/06-auth-rbac.md` and
  `docs/08-sla-automation.md`.
- **No legacy ticket statuses were found** in `schema.prisma` — all six
  `TicketStatus` values are currently valid and in active use. If a future
  migration or historical data reveals a retired status value, it should be
  called out here explicitly rather than assumed absent.
