# Tickets

## Feature Status

**Brownfield feature — discovery complete, human decisions resolved, implemented on branch `chore/sdd-foundation`, awaiting human review (not merged).**

| Aspect | State |
| --- | --- |
| Implementation | **Exists and is mature.** Backend `server/src/modules/tickets/` + neighbouring modules (`assignment`, `sla-automation`, `collaboration`, `realtime`, `portal`, `live-chat`, `integrations/{email,whatsapp,sms}`); frontend `client/src/features/tickets/` + `features/portal/`. Prisma `Ticket` + related models are stable. |
| Brownfield discovery | **Completed** (2026-09-10). Conclusions are drawn from source, tests, Prisma schema, routes, Zod schemas, ADRs, and `docs/`. |
| Specification vs implementation | **Reconciled.** This document describes the system that exists today. Differences from `docs/` are recorded under [Known Gaps / Drift](#known-gaps--drift), not silently "fixed". |
| Human product decisions | **Resolved** (2026-09-10). OD-1…OD-6 answered — see [Resolved Decisions](#resolved-decisions). Six approved changes are now **intended behaviour** and feed [`plan.md`](./plan.md). |
| Gaps requiring work | **Implemented** (2026-09-10, branch `chore/sdd-foundation`) — DG-4/DG-5/DG-6/DG-7/DG-11 delivered via `tasks.md` `TK-001…TK-009`; DG-1/DG-2/DG-3 doc drift reconciled (TK-010). DG-8 test gap closed for the reopen path. DG-9/DG-10/DG-12 remain accepted boundaries / future scope. |
| Ready for `plan.md`? | **Done.** `plan.md` + `tasks.md` executed; `tasks.md` tracks `11/11`. Awaiting human review of the Tickets slice (no merge to `master`). |

No production code, schema, migration, dependency, or `docs/` behaviour was changed in the discovery or the decision-finalisation phase. `plan.md` describes *how* the approved changes will be built; it does not implement them.

This spec follows the brownfield precedent set by `specs/features/knowledge-base/spec.md`: current behaviour is stated as fact and preserved; approved changes are stated as intended behaviour and marked; anything still genuinely undecided would live under [Open Decisions](#open-decisions) (currently: none).

---

## Purpose

The **Ticket** is the central operational aggregate of the CRM. Every support interaction — internal agent work, customer portal requests, inbound email / WhatsApp / SMS, live chat — is modelled as a `Ticket` with a lifecycle, an owning team, an assignee, a priority, SLA deadline snapshots, a public conversation, internal notes, a history trail, and a set of realtime / notification side effects.

Tickets exist so that:

- support work has one authoritative record with an auditable lifecycle;
- role-scoped visibility (ADMIN / MANAGER / AGENT / CUSTOMER) is enforced server-side over one shared data model;
- every channel reuses the same workflow, SLA model, assignment engine, and history model rather than each channel inventing its own;
- SLA compliance and reporting derive from stored ticket timestamps.

Nearly every other feature (Dashboard, Reports, SLA automation, Notifications, Realtime, Tasks, Feedback, Customer Portal, AI assistance, Audit Logs) reads from or reacts to tickets. This spec defines what Tickets **own** versus what they **depend on** so the domain does not absorb its neighbours.

---

## Scope

### In scope (Ticket owns)

- The `Ticket` record and its lifecycle (statuses, transition matrix, transition permissions, automatic transitions).
- Ticket creation across every currently implemented entry path.
- Assignment and ownership: `Ticket.teamId` as the authoritative ownership boundary, manual assignment, agent self-claim, and automatic assignment policy.
- Ticket querying: list / search / filter / pagination and role-scoped visibility.
- The internal Ticket Detail read shape (core fields + merged conversation + history + derived SLA + collaboration state).
- The Ticket-side contract for public messages (`TicketMessage`) and internal notes (`TicketNote`): trust boundary, first-response stamping, reopen-on-customer-reply semantics, delivery-failure markers.
- `TicketHistory` (append-only per-ticket lifecycle trail) content and rules.
- Ticket-side SLA behaviour: deadline snapshots on the `Ticket`, priority-change recalculation, derived display state, cron-driven auto-escalation of resolution breaches.
- Ticket-side realtime events (`ticket.message.created`, `ticket.updated`) and ticket-triggered in-app notifications.
- Customer Portal ticket behaviour and its data boundary.

### Out of scope (Ticket depends on — specified elsewhere or later)

- Channel provider implementations: Email, WhatsApp, SMS (`specs/features/conversations-channels/spec.md`), Live Chat routing/inactivity. This spec fixes only the contract Tickets rely on.
- The SLA configuration surface (`SlaRule` CRUD in Settings, `specs/features/sla-settings-categories/spec.md`). Tickets consume active rules; they do not manage them.
- **SLA pause / resume policy (e.g. stopping the resolution clock while `WAITING_CUSTOMER`)** — explicitly out of scope (OD-5, deferred to the future SLA SDD feature). Current countdown semantics are frozen; no Tickets task may change them.
- The Realtime transport (SSE framing / reconnect / heartbeat, `specs/features/realtime/spec.md`, ADR-045). Tickets emit domain events; the transport is a dependency.
- The Notification centre UI and the `Notification` model lifecycle (ADR-029). Tickets are one producer.
- `AuditLog` as a system (ADR-039). Tickets write rows into it.
- Tasks/Reminders, Reports, Dashboard, Knowledge Base, AI assistants, Attachments — each is its own feature; only the ticket-facing contract is stated here.
- Team / Department / Branch / Customer CRUD (org-structure and customer-management features).

---

## Existing Implementation Summary

### Backend

```
server/src/modules/tickets/
├── ticket.routes.ts        Router: requireAuth + requireRole(ADMIN,MANAGER,AGENT); GET/POST /, GET/PATCH /:id,
│                           POST /:id/messages, POST /:id/notes; plus sub-routes mounted from other modules
│                           (/:id/ai, /:id/watchers, /:id/attachments, /:id/messages/:mid/attachments)
├── ticket.controller.ts    Thin: derives actor {userId, role} from request.auth, calls the service, wraps { data }
├── ticket.schema.ts        Zod: list query, params, create, update, conversation body — all .strict()
├── ticket.service.ts       All ticket business rules: listTickets, getTicket, createTicket, updateTicket,
│                           selfAssignTicket, addTicketMessage, addTicketNote; the `transitions` state table;
│                           validateRelations, enforceMutationPermissions, validateTransition,
│                           assertCustomerReachableForChannel
└── ticket-visibility.ts    Pure Prisma `where`-builders: ticketVisibilityWhere (single ticket),
                            ticketListVisibilityWhere (list), role + optional team scope
```

Reused, not duplicated:

- `server/src/shared/team/team-scope.ts` — `resolveActorTeamId` / `resolveActorTeamScope` (one query per request), `assertAgentAssignableToTicket`, `ticketOperationalRecipientIds`, `customerReplyNotificationRecipientIds`.
- `server/src/modules/assignment/` — the single canonical automatic-assignment engine (`autoAssignTicket`) and its vocabulary (`ASSIGNMENT_ACTIVE_STATUSES`, `AUTO_ASSIGNMENT_*`).
- `server/src/shared/sla/` — `deriveSla` (per-ticket display state), `slaFilterWhere` (list `where` fragment), `sla-outcomes.ts` (report/dashboard cohort math).
- `server/src/modules/realtime/realtime.publisher.ts` — `withRealtimeOutbox` + `emitTicketMessageCreated` / `emitTicketUpdated`.
- `server/src/modules/collaboration/collaboration.service.ts` — `@mention` resolution, watcher fan-out.
- `server/src/shared/rich-text/reply-html.ts` — `sanitizeReplyHtml` (write-side trust boundary), `replyHtmlToPlainText` (for providers + AI context).
- `server/src/modules/audit-logs/audit-log.service.ts` — `createAuditLog(input, tx)`.

Request flow (verified): **Route → `requireAuth` → `requireRole` → Zod validate → thin controller → `ticket.service` → Prisma (transaction) → in-transaction side effects (`TicketHistory`, `AuditLog`, `Notification`) → post-commit realtime flush**.

### Frontend

```
client/src/features/tickets/
├── ticket-api.ts / ticket-hooks.ts   Axios wrappers + TanStack Query hooks; ticketKeys factory;
│                                      mutations invalidate detail + lists (+ dashboard, customers)
├── ticket-list-page.tsx              Canonical list: TanStack Table, URL-search-param filters, pagination,
│                                      AGENT scope tabs (mine | unassigned), claim action
├── ticket-filters-popover.tsx        status / priority / category / department / branch / assignee filters
├── ticket-detail-page.tsx            2-column workspace (main + right rail), AI panel, upload modal
├── ticket-sidebar.tsx                Right rail: Properties (status/priority/category/assignee selects,
│                                      close-confirm, self-assign) + SLA section; client transition map
├── ticket-conversation.tsx / ticket-conversation-ui.tsx  Merged chronological thread; MessageBody sanitises
│                                      HTML on render (DOMPurify); notes always plain text
├── ticket-workspace-tabs.tsx         Reply / Note / Quick-reply / Attachments / History / Description tabs;
│                                      composes the shared `RichTextEditor` (client/src/components/shared/
│                                      rich-text/) with the ticket-owned mention plugin/node for notes
├── ticket-mention-plugin.tsx / ticket-mention-node.ts   Note-only `@mention` typeahead (Ticket-specific,
│                                      passed into `RichTextEditor` via `extraPlugins`/`extraNodes`)
├── ticket-badges.tsx / ticket-status-theme.ts               Status/priority/SLA presentation, canonical order
└── ticket-permissions.ts            Client-only UX gates (canManageTicketDefinition, canOperateAssignedTicket,
                                     canCloseTicket, canSelfAssignTicket) — never a security boundary
```

Portal ticket UI: `client/src/features/portal/portal-pages.tsx` (Home / My Requests / New Request / Ticket Detail), `portal-tickets-table.tsx`, `portal.schemas.ts`, `portal-api.ts` / `portal-hooks.ts`.

### Data model (Prisma)

`Ticket` and directly-related models: `TicketMessage`, `TicketNote`, `TicketWatcher`, `TicketMention`, `TicketHistory`, `Attachment` (polymorphic), `Feedback` (1:1), `Notification` (optional `ticketId`), `Task` (optional `ticketId`), `Category`, `SlaRule` (per-priority), `Team` / `Department` / `Branch`, `Customer`, `User`. Enums: `TicketStatus`, `TicketPriority`, `Channel`. Full field list under [Domain Model](#domain-model).

---

## Actors and Permissions

Four roles (`Role` enum): `ADMIN`, `MANAGER`, `AGENT`, `CUSTOMER`. A `CUSTOMER` is a `User` optionally linked to a `Customer` via `Customer.userId`.

Authoritative enforcement lives in: `requireRole` (coarse per-router allowlist), `ticket-visibility.ts` (role + team `where` predicates), `enforceMutationPermissions` / `validateTransition` (AGENT field + escalation limits), `shared/team/team-scope.ts` (team isolation, assignment invariants), and the portal router (`requireRole(CUSTOMER)` + `requireFreshToken` + `User → Customer.userId` ownership). Frontend `ticket-permissions.ts` and route guards are UX only.

### Scope model

| Role | Ticket scope |
| --- | --- |
| `ADMIN` | Organisation-wide. No team predicate anywhere. |
| `MANAGER` | Their own team only (`Team.managerId === userId`, resolved via `resolveActorTeamId`). A MANAGER with **no team matches nothing** — there is no org-wide fallback. Another team's ticket by id → `404` (no existence leak). |
| `AGENT` | `mine` = tickets assigned to self (any team). `unassigned` = unassigned tickets **within the agent's own team** only. No "all" scope. Single-ticket reach (`GET/PATCH /:id`, conversation, watchers) = assigned-to-self **or** unassigned-in-own-team; anything else → `404`. |
| `CUSTOMER` | Only tickets tied to their linked `Customer`, via `/api/portal/*` only. Internal ticket routes → `403`. |

### Capability matrix (current behaviour)

| Capability | ADMIN | MANAGER | AGENT | CUSTOMER |
| --- | --- | --- | --- | --- |
| List tickets (`GET /tickets`) | All | Own team | `mine` / `unassigned(own team)` scope only | ✗ (`403`) — uses `GET /portal/tickets` (own only) |
| View ticket detail (`GET /tickets/:id`) | Any | Own team (else `404`) | Assigned-to-self or unassigned-own-team (else `404`) | ✗ — `GET /portal/tickets/:id` (own only, else `404`) |
| Create ticket | Yes (assigned or unassigned; any team) | Yes, **own team only**; assignee optional | Yes; `assignedAgentId` **must be omitted** — server forces creator as assignee; sending it (incl. `null`) → `403` | Yes via `POST /portal/tickets` (server owns status/priority/channel/team) |
| Edit subject / description | Yes | Yes (own team) | ✗ (`403` — not in field allowlist) | ✗ |
| Change priority | Yes | Yes (own team) | Only on a ticket **assigned to self** | ✗ |
| Status transition (non-escalation) | Yes (matrix) | Yes (own team, matrix) | Only on **self-assigned** ticket, matrix, never in/out of `ESCALATED` | ✗ (portal reply may trigger an automatic transition — see below) |
| Enter / leave `ESCALATED` | Yes | Yes (own team) | ✗ (`403 FORBIDDEN`) | ✗ |
| Close a `RESOLVED` ticket | Any resolved ticket | Any resolved ticket (own team) | Only a **self-assigned** resolved ticket | ✗ |
| Assign / reassign to an agent | Yes (same-team invariant) | Yes (own team; same-team invariant) | ✗ — may only **self-claim** an unassigned in-team ticket | ✗ |
| Unassign (`assignedAgentId: null`) | Yes | Yes (own team) | ✗ (`403`) | ✗ |
| Change category / department / branch / team | Yes | Yes (own team) | ✗ (`403`) | ✗ |
| Add public reply (`POST /tickets/:id/messages`) | Any visible ticket | Any own-team ticket | Only on a **self-assigned** ticket | ✗ — `POST /portal/tickets/:id/messages` on own non-`CLOSED` ticket |
| Add internal note (`POST /tickets/:id/notes`) | Any visible ticket | Any own-team ticket | Only on a **self-assigned** ticket | ✗ (never — no portal route, never in a portal response) |
| View internal notes | Yes (in `conversation`) | Yes (own team) | Yes (visible ticket) | **Never** |
| View history / timeline | Yes | Yes (own team) | Yes (visible ticket) | ✗ (not in portal shape) |
| View derived SLA (`slaState`, `effectiveSlaDueAt`) | Yes | Yes (own team) | Yes (visible ticket) | **Never** (raw or derived) |
| Watch / unwatch a ticket | Self only (visible ticket) | Self only (own team) | Self only (visible ticket) | ✗ |
| `@mention` in a note / be mentionable | Yes | Yes | Yes | **Never** |
| Delete a ticket | **Nobody** — no delete route exists | — | — | — |
| Run AI ticket actions (`POST /tickets/:id/ai`) | Yes (visible ticket) | Yes (own team) | Yes (visible ticket) | ✗ (portal AI is a separate `customer-ai` boundary) |
| Submit feedback | ✗ | ✗ | ✗ | Own `RESOLVED`/`CLOSED` ticket, once |

**Non-obvious contextual rules (implementation, not just a role table):**

- AGENT mutation body is an **explicit allowlist** of `status` + `priority`. A mixed allowed/forbidden body → `403 FORBIDDEN` with **no partial update and no history write**.
- AGENT self-claim is a **dedicated request**: body must be exactly `{ "assignedAgentId": "<self>" }`. Bundling any other field, targeting another agent, or `null` → `403`.
- MANAGER access is IDOR-safe: another team's ticket id returns `404 TICKET_NOT_FOUND` (never `403`).
- `GET /api/customers/:id/tickets` (Customer Management history) returns non-actionable **summaries** and never grants detail/conversation/mutation. Current implementation (`customer.service.ts:93` `listCustomerTickets`) scopes the query by `customerId` **only** — no ticket-visibility predicate — so before OD-6 a `MANAGER` received `FULL`-access summaries for every one of the customer's tickets regardless of team. **OD-6 (implemented):** this endpoint now obeys the canonical team-scoped ticket-visibility model — `ADMIN` org-wide, **`MANAGER` restricted to their managed team** (teamless → empty page), `AGENT` unchanged (still receives the full history with `access = SUMMARY_ONLY` for another agent's ticket, matching the ADR-014 cross-agent-history design). See [`plan.md` §10](./plan.md) and [DG-11](#known-gaps--drift).
- The customer-portal router additionally runs `requireFreshToken` — a demoted / password-changed / deactivated customer is rejected `401 SESSION_EXPIRED` immediately, not after JWT expiry.
- Internal routers verify the signed JWT, then `requireRole` reloads current account activity, password freshness, and role before coarse authorization. Demotion, deactivation, and password changes take effect on the next role-protected request; downstream ticket visibility receives the refreshed role.

---

## Domain Model

### `Ticket`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(cuid())` | Public reference in email is `id.slice(-8).toUpperCase()` (`[CRM-XXXXXXXX]`). |
| `subject` | `String` | Create: trimmed 3–200. |
| `description` | `String` | Create: trimmed 1–20 000. First inbound message body for channel tickets. |
| `status` | `TicketStatus @default(OPEN)` | See [Lifecycle](#lifecycle). |
| `priority` | `TicketPriority @default(MEDIUM)` | Drives SLA snapshot. |
| `channel` | `Channel @default(WEB)` | `WEB` \| `EMAIL` \| `WHATSAPP` \| `SMS` \| `LIVE_CHAT`. Set at creation; never mutated afterwards. |
| `customerId` | `String` (required) | FK `onDelete: Restrict` — a ticket pins its customer. |
| `assignedAgentId` | `String?` | FK `User` `onDelete: SetNull`. Must reference a `role = AGENT` user. |
| `categoryId` | `String?` | FK `Category` `onDelete: SetNull`. Must be an **active** category on write. |
| `departmentId` | `String?` | FK `onDelete: SetNull`. Organisational tag. |
| `branchId` | `String?` | FK `onDelete: SetNull`. |
| `teamId` | `String?` | FK `Team` `onDelete: SetNull`. **Authoritative owning team.** Never inferred from `assignedAgent.teamId`. `null` = "not yet routed" — ADMIN-only until routed. |
| `firstResponseDueAt` | `DateTime?` | SLA snapshot at creation / eligible priority change. |
| `firstRespondedAt` | `DateTime?` | Stamped **once**, on the first public **agent** reply. Never overwritten. |
| `resolutionDueAt` | `DateTime?` | SLA snapshot. |
| `resolvedAt` | `DateTime?` | Set when entering `RESOLVED`. **Cleared on every reopen out of `RESOLVED`** — channel-driven and manual `RESOLVED → IN_PROGRESS` (OD-1 fix implemented, `ticket.service.updateTicket`; see [Resolved Decisions](#resolved-decisions) OD-1 / [DG-4](#known-gaps--drift)). `resolutionDueAt` is **retained** across a reopen — no fresh SLA deadline is created. |
| `closedAt` | `DateTime?` | Set when entering `CLOSED`. |
| `emailThreadToken` | `String? @unique` | Random per-ticket token used for EMAIL reply-address threading; lazily created on first EMAIL reply. |
| `createdAt` / `updatedAt` | `DateTime` | `updatedAt` drives default list ordering (desc). |

Indexes: `customerId`, `assignedAgentId`, `status`, `priority`, `categoryId`, `departmentId`, `branchId`, `teamId`, `createdAt`.

Relations: `customer` (Restrict), `assignedAgent` / `category` / `department` / `branch` / `team` (SetNull), `messages` `TicketMessage[]`, `notes` `TicketNote[]`, `attachments` `Attachment[]`, `history` `TicketHistory[]`, `feedback` `Feedback?`, `notifications` `Notification[]`, `tasks` `Task[]`, `watchers` `TicketWatcher[]`, `mentions` `TicketMention[]`.

### Enums

- `TicketStatus`: `OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `RESOLVED`, `CLOSED`, `ESCALATED`. **No legacy values** — `NEW` was removed system-wide (ADR-046) with a data migration converting `NEW → OPEN`; the API now rejects `NEW` as an invalid value.
- `TicketPriority`: `LOW`, `MEDIUM`, `HIGH`, `URGENT`. One active `SlaRule` per priority.
- `Channel`: `WEB`, `EMAIL`, `WHATSAPP`, `SMS`, `LIVE_CHAT`. All five are real. Proactive creation (`POST /api/tickets`) accepts only `WEB` / `EMAIL` / `WHATSAPP` / `SMS`; `LIVE_CHAT` (and any unknown value) → `400 VALIDATION_ERROR`.

### `TicketMessage` (public conversation — Ticket owns the shape, channels populate it)

`id`, `ticketId` (Restrict), `authorUserId` (required, Restrict), `body` (stored **sanitised HTML** since ADR-035; historical plain-text rows unaffected), `externalId?` `@unique` (provider message id — inbound webhook idempotency anchor; outbound provider id for traceability), `externalMessageId?` `@unique` (RFC Message-ID for EMAIL threading), `createdAt`. Inbound channel messages are authored by login-less system users (`whatsapp-inbound@system.invalid`, `email-inbound@system.invalid`, `sms-inbound@system.invalid` — all `role = CUSTOMER`, `isActive = false`).

### `TicketNote` (internal-only — never customer-visible)

`id`, `ticketId` (Restrict), `authorUserId` (required, Restrict), `body` (sanitised HTML, same allowlist as replies; `@[Name](userId)` mention tokens are plain text and survive), `createdAt`, `mentions` `TicketMention[]`.

### `TicketHistory` vs `AuditLog`

See [History and Audit](#history-and-audit). Both exist, both are written, neither replaces the other.

### Collaboration primitives

- `TicketWatcher` — `@@unique([ticketId, userId])`, `onDelete: Cascade` both sides. A live subscription list, not a historical record.
- `TicketMention` — one row per `(noteId, mentionedUserId)`, `ticketId` denormalised, `@@unique([noteId, mentionedUserId])`.

---

## Lifecycle

### Statuses

`OPEN` (creation default, all channels) · `IN_PROGRESS` · `WAITING_CUSTOMER` · `RESOLVED` (stamps `resolvedAt`) · `CLOSED` (stamps `closedAt`, terminal) · `ESCALATED`.

### Manual transition matrix — authoritative

Source: the single `transitions` table in `ticket.service.ts`. An unlisted move → **`409 INVALID_STATUS_TRANSITION`** — **except** any PATCH against a `CLOSED` source ticket, which is rejected earlier with **`409 TICKET_CLOSED`** (MS-04, the immutability guard runs before the transition check).

| From \ To | OPEN | IN_PROGRESS | WAITING_CUSTOMER | RESOLVED | CLOSED | ESCALATED |
| --- | :--: | :--: | :--: | :--: | :--: | :--: |
| **OPEN** | — | ✅ | ❌ | ✅ | ❌ | ✅ (ADMIN/MANAGER) |
| **IN_PROGRESS** | ❌ | — | ✅ | ✅ | ❌ | ✅ (ADMIN/MANAGER) |
| **WAITING_CUSTOMER** | ❌ | ✅ | — | ✅ | ❌ | ✅ (ADMIN/MANAGER) |
| **RESOLVED** | ❌ | ✅ (reopen) | ❌ | — | ✅ | ❌ |
| **CLOSED** | ❌ | ❌ | ❌ | ❌ | — | ❌ (terminal — no outgoing) |
| **ESCALATED** | ❌ | ✅ (ADMIN/MANAGER — de-escalate) | ❌ | ❌ | ❌ | — |

### Transition rules

- **Creation default** is always `OPEN`, on every channel (ADR-046). Clients cannot set an initial status other than the default.
- **`OPEN` cannot jump** directly to `WAITING_CUSTOMER` or `CLOSED`.
- **Only `CLOSED` is truly terminal.** `RESOLVED` may reopen to `IN_PROGRESS` manually, or to `OPEN` via a channel-driven customer reply.
- **`CLOSED` = viewable + immutable (MS-03 + MS-04, implemented).** A `CLOSED` ticket stays fully readable for anyone who could already see it — detail, conversation, internal notes, history, SLA snapshots, metadata, attachment list/download are all unaffected. It accepts **no mutation of any kind**:
  - **Metadata / workflow / routing** — `PATCH /tickets/:id` changing `status`, `priority`, `categoryId`, `assignedAgentId`, `subject`, `description`, `departmentId`, `branchId`, `teamId`, and an `AGENT` self-claim, all return **`409 TICKET_CLOSED`** (MS-04). The guard runs in `updateTicket` / `selfAssignTicket` before any permission, relation, or transition check, so a `CLOSED` source never surfaces `INVALID_STATUS_TRANSITION`.
  - **Conversation** — a staff public reply (`POST /tickets/:id/messages`), a staff internal note (`POST /tickets/:id/notes`), and a customer portal reply all return **`409 TICKET_CLOSED`** (MS-03).
  - **Attachments** — any new attachment on those staff or portal paths returns **`409 TICKET_CLOSED`** (MS-03); the attachment list/download paths are untouched.

  `CLOSED` remains terminal (no reopen for `CLOSED`, no Admin-only override); the reopen path stays `RESOLVED`-only. The frontend hides/disables every edit, save, and workflow control for a `CLOSED` ticket (`ticket-permissions.ts`), but the backend guard is the source of truth.
- **`ESCALATED` is role-gated:** entering or leaving `ESCALATED` requires `ADMIN` or `MANAGER`. `AGENT` attempting either → `403 FORBIDDEN`, even on a self-assigned ticket. No prior-status field is stored; the pre-escalation status is recoverable from `TicketHistory`.
- **AGENT** may only mutate `status` / `priority`, and only on a ticket **assigned to themselves**.
- **Close permission:** `ADMIN` / `MANAGER` may close any `RESOLVED` ticket; `AGENT` may close only a `RESOLVED` ticket assigned to them. Closing is `PATCH /tickets/:id` with `{ "status": "CLOSED" }` — there is no dedicated endpoint.
- **Workflow timestamps are service-owned.** Entering `RESOLVED` sets `resolvedAt`; entering `CLOSED` sets `closedAt` and preserves `resolvedAt`. Clients cannot set `resolvedAt` / `closedAt` / SLA snapshots directly.
- **Reopen out of `RESOLVED` clears `resolvedAt` and retains `resolutionDueAt`** (OD-1, **implemented**). This holds for a manual `RESOLVED → IN_PROGRESS` (`updateTicket` clears `resolvedAt` when `input.status === IN_PROGRESS && current.status === RESOLVED`) and for the channel-driven `RESOLVED → OPEN` paths. A reopened ticket re-enters normal unresolved SLA evaluation against its **existing** `resolutionDueAt`; no new resolution deadline is created. `firstResponseDueAt` / `firstRespondedAt` are untouched by a reopen.

### Automatic / channel-driven transitions (outside the manual matrix)

These are applied by service code around a customer reply and are **not** validated against the matrix above:

| Trigger | Current status → new status | Side effects |
| --- | --- | --- |
| Customer portal reply (`POST /portal/tickets/:id/messages`) | `WAITING_CUSTOMER → IN_PROGRESS` | `STATUS_CHANGED` history (actor = customer). |
| Customer portal reply | `RESOLVED → OPEN` (**clears `resolvedAt`**) | `STATUS_CHANGED` history. |
| Customer portal reply | `CLOSED` → **rejected `409 TICKET_CLOSED`** (no reopen) | — |
| Inbound EMAIL correlated to an existing ticket | `WAITING_CUSTOMER → IN_PROGRESS`; `RESOLVED → OPEN` (clears `resolvedAt`) | `STATUS_CHANGED` history (actor = null). A `CLOSED` correlated ticket is discarded → a **new** EMAIL ticket is opened. |
| Inbound WhatsApp / SMS on the customer's newest **active** channel ticket | `WAITING_CUSTOMER → IN_PROGRESS` only | `STATUS_CHANGED` history (actor = null). |
| Inbound WhatsApp / SMS when no active channel ticket (incl. last one `RESOLVED` or `CLOSED`) | new ticket `OPEN` | WhatsApp/SMS **never reopen** a `RESOLVED` ticket — they always start fresh. |
| SLA-monitor cron: `resolutionDueAt` passed, ticket unresolved & not already `ESCALATED` | `{OPEN\|IN_PROGRESS\|WAITING_CUSTOMER} → ESCALATED` | `SLA_AUTO_ESCALATED` history (actor null), `AuditLog TICKET_ESCALATED` (`metadata.reason = "sla_breach"`), `SLA_BREACH_ESCALATION` notifications, `ticket.updated` event. Never re-escalates. First-response breach is **not** an escalation trigger. |
| Live chat "end" by customer (`POST /portal/live-chat/:id/end`) | active `LIVE_CHAT → RESOLVED` (idempotent; `CLOSED → 409`) | `STATUS_CHANGED` history (actor = customer), `AuditLog` (`metadata.reason = "live_chat_ended_by_customer"`), `ticket.updated`. |
| Live chat inactivity sweep (`GET /api/internal/live-chat-inactivity`, cron) | inactive `LIVE_CHAT` → auto-close (see live-chat feature) | Ticket-side: same history/timestamp mechanics as a normal transition. |

Public replies and internal notes on **internal** routes never trigger an automatic status transition on `RESOLVED` (a staff reply to a `RESOLVED` ticket is allowed and does not reopen it). On a `CLOSED` ticket they are rejected outright with `409 TICKET_CLOSED` (MS-03) — see the `CLOSED` = viewable + immutable rule above.

---

## Creation Flows

Every implemented entry path, with its current behaviour. Paths not listed here are **not** implemented and must not be documented as such.

### 1. Internal CRM — `POST /api/tickets`

- **Actor:** `ADMIN` / `MANAGER` / `AGENT` (`CUSTOMER` → `403` at router).
- **Body (`createTicketSchema`, `.strict()`):** `subject` (3–200), `description` (1–20 000), `customerId` (required, must exist → else `404 CUSTOMER_NOT_FOUND`), `priority` (default `MEDIUM`), `channel` (`WEB` default; `EMAIL`/`WHATSAPP`/`SMS` allowed; `LIVE_CHAT`/unknown → `400`), `categoryId?` (must be active → `404 CATEGORY_NOT_FOUND` / `400`-style), `assignedAgentId?`, `departmentId?`, `branchId?`, `teamId?`.
- **Status / priority:** always `OPEN`; priority as given (default `MEDIUM`).
- **Assignee:** `AGENT` **must omit** `assignedAgentId` — sending it (including `null`) → `403`; the service forces the creator as assignee. `ADMIN`/`MANAGER` may pass an assignee (must be `role = AGENT` → else `400 INVALID_ASSIGNED_AGENT`) or leave it empty.
- **Team resolution (effective owning team):** explicit `teamId` → else the assignee's `teamId` → else the creator's team (`MANAGER` / `AGENT`; `ADMIN` = `null`) → else `null` (unrouted). A `MANAGER` supplying a `teamId ≠ their own` → `403`. Team must exist, be active, and (when a department is set) belong to that department (`400 INVALID_TEAM` / `400 TEAM_DEPARTMENT_MISMATCH`). Department must belong to branch when both set (`400 DEPARTMENT_BRANCH_MISMATCH`).
- **Same-team assignment invariant:** an explicit assignee must be on the ticket's (effective) team — `409 CROSS_TEAM_ASSIGNMENT`; an agent with no team → `409 AGENT_HAS_NO_TEAM`.
- **Channel contact guard (`assertCustomerReachableForChannel`):** `SMS`/`WHATSAPP` require a customer phone that normalises to E.164 → else `422 CUSTOMER_PHONE_REQUIRED`; `EMAIL` requires a customer email → else `422 CUSTOMER_EMAIL_REQUIRED`. Rejected before any row is written.
- **SLA init:** snapshot `firstResponseDueAt` / `resolutionDueAt` from the active `SlaRule` for the priority; both stay `null` if no active rule.
- **Automatic assignment:** if an effective `teamId` is set **and** no explicit assignee was chosen, `autoAssignTicket` fills the assignee with the least-loaded eligible active in-team agent (see [Assignment](#assignment-and-ownership)). No eligible agent → the ticket is created successfully and stays unassigned.
- **Side effects (all in one transaction):** `TicketHistory TICKET_CREATED` (+ `ASSIGNMENT_CHANGED` if assigned, + `CATEGORY_CHANGED` if categorised, + `AUTO_ASSIGNMENT` if auto-assigned); `AuditLog TICKET_CREATED` (`changes`: status/priority/categoryId/assignedAgentId); `Notification TICKET_ASSIGNED` to the assignee when the assignee ≠ the actor (or `TICKET_AUTO_ASSIGNED` for auto-assignment); post-commit `ticket.updated` realtime event.
- **Response:** `201 { data: <ticket summary> }`.
- **No creation deduplication** — every call creates a ticket.

### 2. Customer Portal — `POST /api/portal/tickets`

- **Actor:** `CUSTOMER` (with a linked `Customer` — else `403 CUSTOMER_PROFILE_REQUIRED`).
- **Body (`portalCreateTicketSchema`):** `subject` (3–200), `description` (1–20 000), `categoryId?` (must be active).
- **Server-owned:** `status = OPEN`, `priority = MEDIUM`, `channel = WEB`, `assignedAgentId = null`, `departmentId = null`, `branchId = null`, `teamId = null`.
- **SLA init:** snapshot from the active `MEDIUM` rule.
- **Side effects:** `TicketHistory TICKET_CREATED` (actor = the customer's `userId`). **No `AuditLog` row** — inbound-channel and portal ticket creation remain unaudited by design in this scope (OD-3; a future "audit inbound creation" decision covers all four channels together). **No automatic assignment** (no team). **OD-3 (implemented):** `portal.service.createTicket` is wrapped in `withRealtimeOutbox` and emits one post-commit **`ticket.updated`** event (`teamId: null`, `assignedAgentId: null` → `ADMIN` audience) so connected staff see new portal work without a refresh. No `AuditLog` row.
- **Routing:** stays unrouted until an `ADMIN` sets `teamId` via `PATCH /tickets/:id`, at which point automatic assignment runs.

### 3. Customer Portal — AI assistant handoff (`POST /api/portal/ai/handoff`)

Creates a normal Portal ticket through the canonical Portal creation path (see §2 above). Customer identity, status, priority, channel, assignment, SLA defaults, and history remain server-owned. The bounded AI chat/history is attached as the ticket content; the `customer-ai` context boundary (ADR-054) means no internal ticket data is ever fed to the customer assistant.

### 4. Live Chat — `POST /api/portal/live-chat`

- **Actor:** `CUSTOMER`. Resume-or-create: an existing **resumable** `LIVE_CHAT` ticket (non-terminal, newest) short-circuits and is returned; otherwise a new one is created.
- **Body:** `departmentId` required for a new chat (the customer's current intent is the only routing signal; their history is never consulted).
- **Routing:** the owning `Team` is resolved inside the transaction from the chosen department — the **oldest active team** in that department (`createdAt` asc, `id` asc), with the department's `branchId`. A department with no active team → `503 LIVE_CHAT_DEPARTMENT_UNAVAILABLE`; the chat is not created.
- **Server-owned:** `channel = LIVE_CHAT`, `status = OPEN`, `priority = MEDIUM`, `departmentId` + resolved `teamId` + `branchId` set on the **first** persisted row (never `null`-then-patched).
- **SLA init:** active `MEDIUM` rule.
- **Automatic assignment** runs immediately (the ticket already has a team). No eligible agent → stays unassigned.
- **Side effects:** `TicketHistory TICKET_CREATED` (actor = the customer), post-commit `ticket.updated`.

### 5. Inbound EMAIL — `POST /api/integrations/email/webhook`

- **Auth:** Resend `svix-*` signature over the raw body (mounted before the JSON parser). No product JWT. Unset config → structured error, not a crash.
- **Idempotency:** de-dupes on `TicketMessage.externalId = resend:<emailId>` (checked before and inside the transaction; `P2002` also treated as duplicate).
- **Customer resolution:** match `Customer` by sender email (case-insensitive) → else create `{ name (from header / local part), email }`.
- **Ticket correlation (`correlateTicket`), in order:** same-customer `In-Reply-To` / `References` → `Ticket.emailThreadToken` carried in the reply-to local part → `[CRM-XXXXXXXX]` subject reference (single match only) → exactly one active EMAIL ticket for the customer. A correlated **`CLOSED`** ticket is discarded → a new ticket is opened.
- **New ticket:** `channel = EMAIL`, `status = OPEN`, `priority = MEDIUM`, `teamId = null`, fresh random `emailThreadToken`, `MEDIUM` SLA snapshot, `TicketHistory TICKET_CREATED` (actor = null). No automatic assignment (no team).
- **Appended message:** authored by the email system user; `externalId`/`externalMessageId` stored; inbound attachments are content-signature-validated, size-capped (4 MiB), stored, and de-duplicated by `Attachment.externalId`.
- **Reopen:** `WAITING_CUSTOMER → IN_PROGRESS`; `RESOLVED → OPEN` (clears `resolvedAt`).
- **Notification:** `CUSTOMER_REPLY` via `customerReplyNotificationRecipientIds` (assignee + own-team manager + watchers; ADMIN fallback only when nobody else resolves).
- **Realtime:** post-commit `ticket.message.created` (`visibility: "public"`). No `ticket.message.created` is published if the transaction throws (regression-tested).

### 6. Inbound WhatsApp — `POST /api/integrations/whatsapp/webhook`

- **Auth:** `GET` verify-token check; `POST` Meta `X-Hub-Signature-256` HMAC over the raw body. Unset secrets → `503 WHATSAPP_NOT_CONFIGURED`; bad signature → `401`.
- **Idempotency:** de-dupes on `TicketMessage.externalId` (the WhatsApp `wamid`).
- **Customer resolution:** match by phone (`+E164`, digits-only, raw); multiple matches → most recently updated (never merged, warning logged); no match → create `{ name (profile name or E164), email: wa-<digits>@no-email.invalid (placeholder, not contact data — ADR-030), phone: E164 }`.
- **Ticket target:** the customer's newest `WHATSAPP` ticket in an **active** status (`OPEN`/`IN_PROGRESS`/`WAITING_CUSTOMER`/`ESCALATED`); otherwise a **new** ticket (subject `WhatsApp: <first ~57 chars>`, `status = OPEN`, `priority = MEDIUM`, `teamId = null`, `MEDIUM` SLA, `TICKET_CREATED` actor null).
- **Reopen:** `WAITING_CUSTOMER → IN_PROGRESS` bump only. A `RESOLVED` / `CLOSED` last ticket is **never reopened** — a fresh ticket is opened.
- **Notification / realtime:** `CUSTOMER_REPLY`; post-commit `ticket.message.created` (`public`).

### 7. Inbound SMS — `POST /api/integrations/sms/webhook`

Structurally identical to WhatsApp: TextBee `X-Signature` HMAC over raw body; de-dupe on `TicketMessage.externalId`; match/create `Customer` by phone; append to newest active `SMS` ticket or open a new one (`SMS: <first 60 chars>`, `OPEN`, `MEDIUM`, `MEDIUM` SLA, `TICKET_CREATED` actor null); `WAITING_CUSTOMER → IN_PROGRESS` bump only; never reopens `RESOLVED`/`CLOSED`; `CUSTOMER_REPLY` notification; post-commit `ticket.message.created`. Text-only (no attachments).

### Not implemented (do not treat as live)

- Any "new ticket from a web widget form", "phone call log", or generic "channel = X, please create" REST endpoint beyond `POST /api/tickets`.
- Dedicated `POST /tickets/:id/assign` and `POST /tickets/:id/status` action endpoints — documented as **PLANNED (superseded)**; `PATCH /tickets/:id` is the single mutation path and these were never registered.

---

## Assignment and Ownership

### Ownership (`Ticket.teamId`)

- **Authoritative** ownership boundary for MANAGER scope and automatic assignment. Set when the ticket is routed to a team; **never** inferred from `assignedAgent.teamId`.
- `teamId = null` (unrouted) → ADMIN-only visibility; automatic assignment does not act on it.
- An unrouted ticket **adopts the assignee's team** on the first assignment. A ticket that already has a team is **never** silently moved by an assignment.
- `Team.managerId` (`@unique`) and `User.teamId` model exactly one team per manager / agent (V1 simplification).

### Manual assignment (ADMIN / MANAGER)

`PATCH /tickets/:id` with `assignedAgentId`.

- Target must be an existing `role = AGENT` user → else `400 INVALID_ASSIGNED_AGENT`.
- Same-team invariant (`assertAgentAssignableToTicket`): agent must have a team (`409 AGENT_HAS_NO_TEAM`); ticket's current team must equal the agent's team (`409 CROSS_TEAM_ASSIGNMENT`); an unrouted ticket adopts the agent's team.
- MANAGER is team-scoped (another team's ticket id → `404`).
- Unassignment (`assignedAgentId: null`) is allowed for ADMIN / MANAGER.
- **Side effects:** `TicketHistory ASSIGNMENT_CHANGED` (`oldValue`/`newValue` = agent **names**, not ids); `AuditLog TICKET_ASSIGNED` (`changes.assignedAgentId {from,to}` = ids); `Notification TICKET_ASSIGNED` to the new assignee when ≠ the actor and active; watcher fan-out ("Assignment changed on a ticket you follow"), excluding the new assignee; post-commit `ticket.updated`.

### Reclassification clears the assignee (client-UX invariant)

- Changing a ticket's **Category** — in the Ticket Detail sidebar and in the create/edit ticket form — resets the pending **Assigned Agent** selection to *Unassigned*. A stale assignee is never carried silently past a reclassification (a category can imply a different owning team / skill set).
- This is a **frontend** invariant only. The backend still enforces the same-team invariant above; when an already-assigned ticket is reclassified and saved, the client submits `assignedAgentId: null` (explicit unassignment), which ADMIN / MANAGER are allowed to do.
- Consistent with the existing Department / Team change behaviour, which already clears the pending assignee in the form.
- Re-selecting the **same** Category is a no-op — it must not clear a manually chosen assignee.

### Agent self-claim

`PATCH /tickets/:id` with a body of **exactly** `{ "assignedAgentId": "<self>" }` → dedicated atomic path (`selfAssignTicket`).

- Race-safe: conditional `updateMany` guarded by `assignedAgentId: null`. Lost race → `409 TICKET_ALREADY_ASSIGNED`. Already the caller's → **idempotent `200`**, no history/audit/event.
- Any other `assignedAgentId`, a `null` (release), or bundling any other field → `403 FORBIDDEN` (no DB write).
- A ticket not visible to the agent (assigned to another agent, or not in their team's unassigned queue) → `404 TICKET_NOT_FOUND`.
- **Side effects on a real claim:** `TicketHistory ASSIGNMENT_CHANGED` (`oldValue: null`, `newValue`: actor name); `AuditLog TICKET_ASSIGNED`; post-commit `ticket.updated`.

### Automatic assignment (ADR-051 — one canonical engine)

`server/src/modules/assignment/autoAssignTicket(tx, input)` is the single source of truth. **Strategy (V1): least active-workload eligible active AGENT within the ticket's existing team**, tie-broken by `id` ascending (fully deterministic — no randomness).

- **Eligible agent** = `role = AGENT` **and** `isActive` **and** `User.teamId === Ticket.teamId`.
- **Active workload** = the agent's tickets in `OPEN` / `IN_PROGRESS` / `WAITING_CUSTOMER` / `ESCALATED`. `RESOLVED` / `CLOSED` never count.
- **Hard no-ops:** `teamId = null` (never infers a team); an existing `assignedAgentId` (never reassigns / rebalances); a terminal status; no eligible agent (the create/update still succeeds — the ticket just stays unassigned); a lost race on the guarded `updateMany`.
- **Where it runs:** internal `POST /api/tickets` (team resolved, no explicit assignee); `PATCH /tickets/:id` when an ADMIN routes a previously unrouted ticket (`teamId: null → <team>`) and leaves the assignee empty; Live Chat creation; the SLA-monitor cron as a **candidate finder** (unassigned + active status + `teamId` not null, oldest first, batch ≤ 100 — the decision is delegated to the same engine).
- **Side effects:** `TicketHistory` `action = "AUTO_ASSIGNMENT"` (`actorUserId = null`, `newValue` = agent name); `AuditLog TICKET_ASSIGNED` (`metadata.reason = "automatic_assignment"`, cron path: `"sla_breach"`-adjacent `actorType SYSTEM`); one `TICKET_AUTO_ASSIGNED` notification to the selected agent; `ticket.updated` realtime event.
- **Known V1 limitation:** two ticket creations racing in separate transactions can both read workload `0` for the same agent and both pick them (bounded skew ≤ concurrency width). The guarded update still prevents double-assignment and duplicate side effects. Full serialisation is out of scope (no scheduler / queue / lock).
- **Automatic team routing is NOT implemented.** Only agent selection within an already-routed team is automated.

### Ownership-adjacent guards (dependencies, enforced outside `ticket.service`)

- Moving an `AGENT` who still has active tickets on their current team → `409 AGENT_HAS_ACTIVE_TICKETS` (user-management). Tickets are never migrated automatically on a team change.
- Team delete is refused while it has tickets (`409 TEAM_HAS_TICKETS`).

---

## Ticket Queries

### `GET /api/tickets` (internal)

`ticketListQuerySchema` (`.strict()` — unknown query keys → `400 VALIDATION_ERROR`):

| Param | Behaviour |
| --- | --- |
| `page`, `limit` | Standard pagination (`shared/validation/pagination.schema.ts`). Response `meta: { page, limit, total, totalPages }`. |
| `search` | Trimmed, ≤ 100. Matches: exact `id` **OR** `subject` contains **OR** `description` contains **OR** `customer.name` contains **OR** `customer.email` contains — all case-insensitive. Always intersected with the caller's authoritative scope. |
| `scope` | AGENT only: `mine` (default) \| `unassigned`. Any other value → `400`. Ignored for ADMIN / MANAGER. |
| `status` | `TicketStatus` exact. |
| `priority` | `TicketPriority` exact. |
| `categoryId` | Exact. |
| `channel` | **OD-4 (implemented).** `z.nativeEnum(Channel)` exact match — all five values valid for the *list* filter (`WEB` \| `EMAIL` \| `WHATSAPP` \| `SMS` \| `LIVE_CHAT`), unlike the *create* schema which excludes `LIVE_CHAT`. Applies for every role, ANDed with the caller's authoritative scope (never widens an AGENT list). Invalid value → `400 VALIDATION_ERROR`. No DB index. |
| `assignedAgentId` | Exact. **Ignored for AGENT callers** (cannot widen scope). |
| `assignee` | `unassigned` only — `assignedAgentId IS NULL`. **ADMIN / MANAGER only** (Manager Work Console deep-links). |
| `sla` | `breached` \| `at_risk` — derived SLA-state `where` fragment (`shared/sla/sla-filter.ts`, mirrors `derive-sla.ts`). **ADMIN / MANAGER only.** |
| `customerId` | Exact. Never widens AGENT scope (intersected). |
| `departmentId`, `branchId` | Exact. |

- **Ordering:** `updatedAt` desc, fixed.
- **Row projection (`ticketSummarySelect`):** `id`, `subject`, `status`, `priority`, `channel`, `teamId`, `firstResponseDueAt`, `firstRespondedAt`, `resolutionDueAt`, `createdAt`, `updatedAt`, `customer {id,name,email}`, `assignedAgent {id,name,email}`, `category {id,name}`. **No derived SLA, no `description`, no conversation, no history** in the list.
- **`createdAt` date-range filtering is not provided** on this endpoint and stays out of scope (Reports covers time-bucketed analysis). A `channel` filter is approved and planned (OD-4 / [DG-7](#known-gaps--drift)).
- Visibility: `ticketListVisibilityWhere(actor, scope, team)` — ADMIN `{}`; MANAGER `{ teamId }` or match-nothing; AGENT `mine` = `{ assignedAgentId: self }`, `unassigned` = `{ assignedAgentId: null, teamId: <own> }` or match-nothing.

### `GET /api/portal/tickets` (customer)

`portalTicketListSchema`: `page`, `limit`, `search` (≤ 100 — `id` / `subject` / `description` contains), `status` (portal enum `OPEN` \| `IN_PROGRESS` \| `WAITING_FOR_YOU` \| `RESOLVED` \| `CLOSED`), `priority`, `categoryId`. Every branch is ANDed with the caller's own `customerId`. Ordering `updatedAt` desc, `id` asc. Row projection: `id`, `subject`, mapped portal `status`, `priority`, `category {id,name}`, `createdAt`, `updatedAt`. Portal status mapping is applied on the way out (`ESCALATED` is shown as `IN_PROGRESS`).

### `GET /api/customers/:id/tickets` (Customer Management — summary only)

Paginated safe summaries for the opened customer; `SUMMARY_ONLY` never authorises detail / conversation / mutation. Response `access` = `FULL` unless the caller is an `AGENT` viewing another agent's ticket (`SUMMARY_ONLY`).

**Intended scope (OD-6):**

- `ADMIN` → every ticket of the customer, `FULL`.
- `MANAGER` → **only tickets owned by their managed team** (`Ticket.teamId === resolveActorTeamId(actor)`; a MANAGER with no team → empty page). No cross-team summaries. This endpoint must not be a visibility bypass.
- `AGENT` → the customer's full ticket history is retained (the ADR-014 cross-agent support-history design), with `access = SUMMARY_ONLY` for another agent's ticket.
- `CUSTOMER` → rejected (`403`); customers use `/api/portal/*` only.

*OD-6 (implemented):* `listCustomerTickets` builds `where` as `{ customerId, ...teamScopedTicketWhere(actor, await resolveActorTeamId(actor)) }` — the canonical helper — so `MANAGER` is team-bounded (teamless → empty page), `ADMIN`/`AGENT` unchanged. See [DG-11](#known-gaps--drift).

---

## Ticket Detail

### `GET /api/tickets/:id` (internal) — response shape

- **Core:** all `ticketSummarySelect` fields **plus** `description`, `resolvedAt`, `closedAt`, `department {id,name}`, `branch {id,name}`, `team {id,name,departmentId}`, `customer {id,name,email,phone,createdAt}`.
- **`conversation`:** a single discriminated, chronological array merging public messages and internal notes — `{ kind: "PUBLIC_MESSAGE" | "INTERNAL_NOTE", id, body, createdAt, author {id,name,role} }`. Ordered by `createdAt` asc, then `kind`, then `id`. Only these fields. This shape is **internal-only** (ADR-010) — a portal response must never select `TicketNote`.
- **Derived SLA (`deriveSla`, request-time):** `slaState` (`ON_TRACK` \| `AT_RISK` \| `BREACHED` \| `MET` \| `NOT_CONFIGURED`), `effectiveSlaDueAt` (ISO or `null`), `effectiveSlaTarget` (`FIRST_RESPONSE` \| `RESOLUTION` \| `null`). Never accepted from the client; never added to list or portal contracts.
- **History:** `history[]` ordered `createdAt` desc — `{ id, action, oldValue, newValue, createdAt, actor {id,name,role} | null }`.
- **Collaboration state (ADR-032):** `watcherCount` (number of internal followers), `viewerIsWatching` (boolean for the caller).
- The pre-merge `messages` / `notes` arrays are **not** returned (destructured out server-side).

### UI (internal Ticket Detail, ADR-035 / ADR-036 / ADR-037 / ADR-055)

2-column workspace (`ticket-detail-page.tsx`):

- **Main column:** back link + reference + subject + status badge + created date; `TicketContextSummary` (Customer / Priority / Category / Channel / Followers strip); bounded auto-scrolling `TicketConversation` card (viewer-relative bubbles, internal notes styled distinctly, `@mention` rendering); `TicketWorkspaceTabs` (Reply · Note · Quick reply picker · Attachments · History · Description) with the shared Lexical composer (`RichTextEditor` — bold/italic/underline/lists/link/undo-redo; `@mention` typeahead on the Note tab only, never in the Portal import graph).
- **Right rail:** Properties card (status / priority / category / assignee `<select>`s; close-confirm; "Assign to me" for an eligible AGENT) + SLA card (derived state + effective deadline). The client transition map mirrors the server matrix; ADMIN/MANAGER additionally get an "Escalate" option from `OPEN`/`IN_PROGRESS`/`WAITING_CUSTOMER` and a "De-escalate → IN_PROGRESS" option from `ESCALATED`.
- **AI Assistant** panel (`Sheet`): 4 read-only actions (summary, suggested reply, classification, KB suggestions). Never mutates the ticket; "Apply category" / "Insert reply" route through the normal ticket-update / composer paths with their own RBAC.
- Attachments card (ticket-level + per-message); watch toggle; `FileUploadModal`.
- Loading → `TicketDetailSkeleton`; `404` → "not found"; `403` → "unauthorized"; other → retry.
- TanStack Query: `useTicket(id)` (`retry: false`), mutations invalidate `ticketKeys.detail(id)` + `ticketKeys.lists()` (+ `["dashboard"]`, `["customers"]` for updates). Realtime `ticket.*` events invalidate the same keys in place — the open conversation refetches without disturbing composer draft, scroll, selected tab, or note mode.

### Portal Ticket Detail (`GET /api/portal/tickets/:id`)

Own ticket only (`{ id, customerId }` — else `404`). Returns: `id`, `subject`, mapped portal `status`, `category {id,name}`, `createdAt`, `updatedAt`, `description`, `messages[]` (`{ id, body, createdAt, author {id, name, kind: "CUSTOMER" | "SUPPORT"} }` — staff identity flattened to `SUPPORT`), `feedbackEligible` (status is `RESOLVED`/`CLOSED`), `feedback | null`. **No notes, no assignee identity, no SLA (raw or derived), no history, no watchers, no priority (list only), no team/department/branch.** UI reuses the internal design system (`PortalShell`, shared conversation primitives, `ConversationSection`) but a reply-only composer.

---

## Communication Integration

### Ticket owns

- **`TicketMessage`** (public) and **`TicketNote`** (internal) as models and read shapes.
- **Write-side trust boundary:** every reply / note body is passed through `sanitizeReplyHtml` on write regardless of source (internal composer, portal composer, inbound email HTML). Allowlist: `b/strong/i/em/u/p/br/ul/ol/li/a[href]`; `http`/`https`/`mailto` only; links forced `rel="noopener noreferrer nofollow" target="_blank"`; scripts, styles, classes, ids, event handlers, media, iframes, data URIs discarded. A body empty once sanitised → `422 EMPTY_MESSAGE`.
- **First-response stamping:** `firstRespondedAt` is set — once, in the same transaction as the message — on the first **public agent** reply only, via `updateMany` guarded on `firstRespondedAt: null`. Internal notes never affect it. Later replies never overwrite it. A rolled-back reply leaves it unchanged.
- **Reopen-on-customer-reply semantics** (see [Lifecycle](#lifecycle) automatic transitions) — Ticket owns which status changes a customer reply causes on each channel.
- **Delivery-failure markers:** a failed outbound provider send writes a `<CHANNEL>_DELIVERY_FAILED` `TicketHistory` row (`actorUserId = null`, `newValue` = reason). A successful send writes no extra history.
- **Conversation mutation access:** `requireConversationMutationAccess` — ticket must be visible to the actor; an `AGENT` must be the assignee (else `403`).

### Ticket depends on

- **Outbound delivery is commit-first for every provider-backed channel (ADR-052):** the `TicketMessage`, first-response stamp, and watcher notifications commit and the `ticket.message.created` event is published **before** the provider call. A provider / configuration failure never rolls back the reply — the response carries `delivery: { channel, status: "FAILED", reason }` (`reason ∈ INTEGRATION_NOT_CONFIGURED | NO_RECIPIENT_PHONE | NO_RECIPIENT_EMAIL | RECIPIENT_INVALID | PROVIDER_REJECTED | PROVIDER_UNREACHABLE`), HTTP `201` either way. `WEB` / `LIVE_CHAT` have no `delivery` field. Internal notes never send. Providers receive **plain text only** (`replyHtmlToPlainText`), never markup.
  - **EMAIL threading** is local bookkeeping done inside the transaction (persist `emailThreadToken`, gather `References`); the Resend call is outside it.
- **Inbound webhooks** (email / whatsapp / sms) resolve or create the `Customer`, choose or open the ticket, and de-duplicate on `TicketMessage.externalId` / `Attachment.externalId`. The Ticket domain trusts the provider-verified webhook signature but **not** the sender identity inside the payload (see [Security](#security-and-privacy) and [Known Gaps](#known-gaps--drift) DG-10).
- **Attachments** module: polymorphic `Attachment` (ticket-level / message-level / customer-level), signature-validated types, 4 MiB cap, private blob store. Portal upload is blocked on `CLOSED` and never creates a message or reopens the ticket.
- **Collaboration** module: `@mention` resolution (active internal users only; author dropped; auto-watch author + mentioned), watcher fan-out (bounded `findMany` + `createMany` inside the triggering transaction — a failure rolls the mutation back, per ADR-029/ADR-032).
- **Rich-text** shared module: `sanitizeReplyHtml` / `replyHtmlToPlainText`; client `MessageBody` re-sanitises on render (DOMPurify) as defence in depth.

### Not owned here

The channel provider adapters, their configuration, retry/timeout policy, webhook signature schemes, and channel-specific edge cases belong to `specs/features/conversations-channels/spec.md`.

---

## SLA Integration

### Ticket-side contract

- **Snapshot fields on `Ticket`:** `firstResponseDueAt`, `firstRespondedAt`, `resolutionDueAt`, `resolvedAt`, `closedAt`.
- **At creation:** compute `firstResponseDueAt` / `resolutionDueAt` from the active `SlaRule` for the ticket's priority, measured from the persisted creation time. No active rule → both stay `null`; creation still succeeds. Every channel uses the same rule; portal / email / whatsapp / sms / live-chat tickets always snapshot the **`MEDIUM`** rule (priority is `MEDIUM` at creation).
- **On priority change** of a non-terminal ticket (`updateTicket`): recompute `resolutionDueAt` from the new priority's active rule; recompute `firstResponseDueAt` **only while `firstRespondedAt` is null**. No active rule → set the relevant unresolved deadline to `null`. `RESOLVED` / `CLOSED` tickets are not recalculated.
- **First response:** `firstRespondedAt` = the first public agent reply's `createdAt`, set once (see [Communication Integration](#communication-integration)).
- **On reopen out of `RESOLVED`** (manual `→ IN_PROGRESS` after the OD-1 fix, or channel-driven `→ OPEN`): `resolvedAt` is cleared, `resolutionDueAt` is **retained unchanged**, `firstResponseDueAt` / `firstRespondedAt` are untouched. The ticket re-enters live SLA evaluation against its original `resolutionDueAt` — a ticket reopened past that deadline is therefore `BREACHED` (honest), not `MET`. No new deadline is snapshotted. Historical first-response / resolution accountability is preserved.
- **Derived display state (`deriveSla`, not persisted):**
  - `MET` if status is `RESOLVED`/`CLOSED` **or** `resolvedAt`/`closedAt` is set. *(After the OD-1 fix a manually reopened ticket no longer has `resolvedAt` set, so it correctly stops reading `MET`.)*
  - otherwise the **effective** deadline is the earliest of: `firstResponseDueAt` (only while `firstRespondedAt` is null) and `resolutionDueAt`; a tie selects `FIRST_RESPONSE`.
  - `BREACHED` if effective deadline ≤ now; `AT_RISK` if ≤ 60 minutes away; `ON_TRACK` otherwise; `NOT_CONFIGURED` if no applicable deadline.
  - The 60-minute warning window is fixed.
- **List filter parity:** `slaFilterWhere` (`sla=breached|at_risk` on `GET /tickets`) mirrors `deriveSla` as a Prisma `where` fragment over unresolved tickets (`status NOT IN (RESOLVED, CLOSED)`, `resolvedAt: null`, `closedAt: null`).
- **Automated escalation** (cron `GET /api/internal/sla-monitor`, `CRON_SECRET`, every ~5 min, batch ≤ 100): any unresolved, non-closed, active, **non-`ESCALATED`** ticket whose `resolutionDueAt` has passed → `ESCALATED`, via a guarded `updateMany`. Writes `SLA_AUTO_ESCALATED` history (actor null), `AuditLog TICKET_ESCALATED` (`metadata.reason = "sla_breach"`, `actorType SYSTEM`), `SLA_BREACH_ESCALATION` notifications (every active `ADMIN` + **only** the owning team's manager; unrouted → ADMIN only), and a `ticket.updated` event. Never re-escalates. **First-response breach is not an escalation trigger.**
- The same cron run also auto-assigns unassigned + active + team-routed candidates through `autoAssignTicket`.

### Explicitly not part of the Ticket-side contract

- SLA rule CRUD (Settings). Rules are deactivated, never deleted; changes are prospective and never rewrite existing ticket snapshots.
- **No SLA pause / resume** while `WAITING_CUSTOMER` — the resolution clock keeps running. **Deferred (OD-5):** pause/resume SLA policy is explicitly **out of scope for Tickets feature work** and belongs to the future dedicated SLA SDD feature; any such future policy must preserve the Ticket lifecycle integration contracts in this spec. The OD-1 reopen fix must **not** introduce any pause behaviour — current `WAITING_CUSTOMER` countdown semantics are frozen and regression-tested.
- No persisted `isBreached` / `slaStatus` column; no per-ticket SLA override; no in-process timer / worker.

---

## Realtime and Notifications

### Realtime events (ticket-side)

Contract (`specs/features/realtime/spec.md`, ADR-045): tiny invalidation signals only — **no records on the wire**.

| Event | Wire payload | Emitted from |
| --- | --- | --- |
| `ticket.message.created` | `{ type, ticketId, messageId, visibility: "public" \| "internal" }` | `addTicketMessage`, `addTicketNote` (`internal`), `portal.service.reply`, inbound EMAIL, inbound WhatsApp, inbound SMS |
| `ticket.updated` | `{ type, ticketId }` | `createTicket`, `updateTicket`, `selfAssignTicket`, `sla-automation` (auto-assign + auto-escalate), `live-chat` start + end, **`portal.service.createTicket`** (OD-3 implemented — a portal ticket is created unrouted, so its audience is `ADMIN` only) |

- All ticket events are buffered by `withRealtimeOutbox` and flushed **only after the producing transaction commits**. A rolled-back transaction publishes nothing.
- `ticket.updated` is **not** emitted for a no-op `PATCH` (every provided field equals its current value).
- **Audience routing (`canReceive`)** — server-side, mirrors ticket visibility incl. team scope:
  - `ADMIN` — all ticket events.
  - `MANAGER` — only events for their **own team** (unrouted ticket → not delivered).
  - `AGENT` — events where `assignedAgentId === self`, **or** unassigned events within the agent's own team.
  - `CUSTOMER` — only their **own** ticket (`subscriber.customerId === audience.customerId`, resolved once at connect) and only `visibility: "public"`; never internal notes, never `notification.*`.
- Audience metadata (`customerId`, `teamId`, `assignedAgentId`, `visibility`) is server-side context only — never added to the wire frame.
- Transport limitation (`specs/features/realtime/spec.md`): on a serverless host a long-lived SSE connection is force-closed at `maxDuration`; client backoff-reconnect is the mitigation. Not a Ticket concern.

### In-app notifications (ticket-triggered)

In-app `Notification` rows only — **no email / push / SMS delivery** (ADR-029). `CUSTOMER` never receives notifications.

| Type | Trigger | Recipients |
| --- | --- | --- |
| `TICKET_ASSIGNED` | Manual assignment / reassignment; assigned at creation | The new assignee, when ≠ the actor and active |
| `TICKET_AUTO_ASSIGNED` | Automatic assignment (sync or cron) | The selected in-team agent |
| `TICKET_ESCALATED` | Manual transition into `ESCALATED` | Every active `ADMIN` + **only** the owning team's manager (unrouted → ADMIN only), minus the actor |
| `SLA_BREACH_ESCALATION` | Cron auto-escalation | Same team-scoped rule as `TICKET_ESCALATED` |
| `CUSTOMER_REPLY` | Portal / inbound EMAIL / WhatsApp / SMS customer message | `customerReplyNotificationRecipientIds`: assignee + own-team manager + watchers; **ADMIN only as a fallback** when nobody else resolves (a brand-new unrouted, unassigned, unwatched inbound ticket) |
| `TICKET_MENTION` | `@[Name](userId)` in a new note | Each mentioned active internal user (author excluded) |
| `TICKET_WATCH_ACTIVITY` | Reply / note / status change / assignment change on a watched ticket | Watchers, minus the actor and anyone already notified by the specific event above |

- Notification rows are written **inside** the triggering transaction (ADR-029) — a failure rolls the mutation back.
- Each `Notification` create also emits a per-recipient `notification.created` realtime event (post-commit).

---

## History and Audit

Two distinct trails. **Both exist, both are written, neither replaces the other.**

### `TicketHistory` — per-ticket lifecycle trail

- Append-only, one row per lifecycle event. Fields: `ticketId`, `actorUserId?` (`null` for system-driven events — SLA auto-escalation, automatic assignment, inbound-channel changes), `action` (plain string), `oldValue?` / `newValue?` (human-readable strings — agent/category **names**, status values — not ids), `createdAt`.
- **Actions currently written:** `TICKET_CREATED`, `STATUS_CHANGED`, `PRIORITY_CHANGED`, `ASSIGNMENT_CHANGED`, `CATEGORY_CHANGED`, `AUTO_ASSIGNMENT`, `SLA_AUTO_ESCALATED`, `WHATSAPP_DELIVERY_FAILED`, `EMAIL_DELIVERY_FAILED`, `SMS_DELIVERY_FAILED`.
- **Not tracked (intentional):** `subject` / `description` edits, and `departmentId` / `branchId` / `teamId` routing changes. Routing changes are handled by `AuditLog` (OD-2), not `TicketHistory` — no new `TicketHistory` action is added for routing unless a later product need for a per-ticket routing timeline arises.
- **Read access:** wherever the caller may view the ticket — it is part of `GET /tickets/:id` and follows the ticket-visibility predicate, not a separate permission. Shown in the Ticket Detail History tab. Not exposed in the portal.

### `AuditLog` — cross-entity administrative / security trail

- One row per significant mutation across `USER`, `CUSTOMER`, `TICKET`, `CATEGORY`, `SLA_RULE`, `DEPARTMENT`, `BRANCH`, `TEAM`, `KNOWLEDGE_ARTICLE`. Fields: `actorId?` (`null` + `metadata.actorType = "SYSTEM"` for cron), `action`, `entityType`, `entityId`, `metadata` (`actorType`; for updates a `changes` map of `{ from, to }` per **safe field** — never bodies, hashes, tokens), `ipAddress?` / `userAgent?` (best-effort), `createdAt`.
- **Ticket actions written:** `TICKET_CREATED`, `TICKET_STATUS_CHANGED`, `TICKET_ESCALATED`, `TICKET_CLOSED`, `TICKET_PRIORITY_CHANGED`, `TICKET_ASSIGNED`, `TICKET_CATEGORY_CHANGED`, and — **OD-2 (implemented)** — `TICKET_ROUTING_CHANGED` for a change to `departmentId` / `branchId` / `teamId` (one row per mutation that changes ≥1 routing field, incl. implicit team adoption; `metadata.changes` = `{ departmentId?: {from,to}, branchId?: {from,to}, teamId?: {from,to} }` with **id values only**, no names/bodies; no row on a no-op or a rejected update; written in the `updateTicket` transaction). See [`plan.md` §6](./plan.md).
- Written in the **same transaction** as the ticket mutation (`createAuditLog(input, tx)`).
- **Read access:** `GET /api/audit-logs` — **`ADMIN` only** (`MANAGER`/`AGENT`/`CUSTOMER` → `403`). Filters: `actorId`, `action`, `entityType`, `entityId`, `from`/`to`. No portal surface.

### Which mutation writes what

| Ticket mutation | `TicketHistory` | `AuditLog` |
| --- | --- | --- |
| Internal create | `TICKET_CREATED` (+ `ASSIGNMENT_CHANGED` / `CATEGORY_CHANGED` / `AUTO_ASSIGNMENT`) | `TICKET_CREATED` |
| Portal create | `TICKET_CREATED` | **none** by design (OD-3 keeps portal/inbound creation unaudited); emits `ticket.updated` after the OD-3 fix |
| Live-chat create | `TICKET_CREATED` (+ `AUTO_ASSIGNMENT`) | **none** at create; the customer "end" writes a `TICKET_STATUS_CHANGED` row |
| Inbound channel create | `TICKET_CREATED` (actor null) | **none** |
| Status change | `STATUS_CHANGED` | `TICKET_STATUS_CHANGED` / `TICKET_ESCALATED` / `TICKET_CLOSED` |
| Priority change | `PRIORITY_CHANGED` | `TICKET_PRIORITY_CHANGED` |
| Assignment / reassignment / self-claim | `ASSIGNMENT_CHANGED` | `TICKET_ASSIGNED` |
| Category change | `CATEGORY_CHANGED` | `TICKET_CATEGORY_CHANGED` |
| Department / branch / team (routing) change | **none** | `TICKET_ROUTING_CHANGED` (OD-2 — implemented) |
| Subject / description change | **none** | **none** |
| Public reply / internal note | **none** (except first-response stamp; delivery-failed marker) | **none** |
| SLA auto-escalation | `SLA_AUTO_ESCALATED` (actor null) | `TICKET_ESCALATED` (`reason: "sla_breach"`) |

---

## Customer Portal Behavior

- **Boundary:** `/api/portal/*` accepts `CUSTOMER` only (`requireRole(CUSTOMER)` + `requireFreshToken`). Internal roles → `403`. Ownership always resolves `User → Customer.userId`; a client-supplied customer id or email never participates. Every ticket query is `{ ticketId, customerId }` — a non-owned or missing id returns `404 TICKET_NOT_FOUND` (IDOR-safe).
- **Visible tickets:** only those tied to the caller's linked `Customer`. No linked profile → `403 CUSTOMER_PROFILE_REQUIRED`.
- **Create:** `POST /portal/tickets` — subject + description + optional active category. Server owns status (`OPEN`), priority (`MEDIUM`), channel (`WEB`), team/department/branch (`null`).
- **Detail:** public messages only; staff identity flattened to `SUPPORT`; **no notes, no assignee, no SLA (raw or derived), no history, no watchers, no team/department/branch, no priority** (priority appears only as a column in "My Requests").
- **Reply:** `POST /portal/tickets/:id/messages` — sanitised HTML body (1–20 000). A `CLOSED` ticket → `409 TICKET_CLOSED` (no reopen). `WAITING_CUSTOMER → IN_PROGRESS`; `RESOLVED → OPEN` (clears `resolvedAt`), atomic with the message. `CUSTOMER_REPLY` notification; post-commit `ticket.message.created` (public).
- **Attachments:** upload one file at a time to an owned non-`CLOSED` ticket; never creates a message, never reopens. Portal serializer omits `ticketId` / `customerId` / `storageKey` / staff identity.
- **Status visibility:** portal status mapping — `OPEN→OPEN`, `IN_PROGRESS→IN_PROGRESS`, **`ESCALATED→IN_PROGRESS`** (customers never see escalation), `WAITING_CUSTOMER→WAITING_FOR_YOU`, `RESOLVED→RESOLVED`, `CLOSED→CLOSED`.
- **Closed / resolved:** read-only in the portal (reply to `CLOSED` rejected; a resolved ticket can be reopened only by a customer reply). Feedback (one immutable 1–5 rating + optional comment) is allowed once on an owned `RESOLVED`/`CLOSED` ticket.
- **Realtime:** the customer opens the same single app-level SSE connection; receives only their own ticket's **public** `ticket.message.created` and `ticket.updated` (→ REST refetch), never internal notes, never notifications. Query invalidation hits `portalKeys.ticket(id)` + `portalKeys.tickets()` (+ `portalKeys.overview` on update).
- **Live chat** is a `LIVE_CHAT` ticket surfaced through the floating support widget; the customer picks a department to start, may "end" it (→ `RESOLVED`), and starts a fresh chat afterwards.

### Customer data boundaries (must hold)

- A `CUSTOMER` can never read another customer's ticket, message, attachment, or feedback.
- `TicketNote`, `TicketWatcher`, `TicketMention`, staff assignment detail, and SLA metrics are never selected into a portal response or a customer realtime event.
- Portal responses never expose `teamId` / `departmentId` / `branchId` / internal staff identities.

---

## Validation and Errors

### Request schemas (all `.strict()` — unknown fields → `400 VALIDATION_ERROR`)

- `createTicketSchema`: `subject` 3–200, `description` 1–20 000, `customerId` required, `priority` enum (default `MEDIUM`), `channel` enum `{WEB,EMAIL,WHATSAPP,SMS}` (default `WEB`), `categoryId?`/`assignedAgentId?`/`departmentId?`/`branchId?`/`teamId?` nullable id.
- `updateTicketSchema`: all fields optional; `.refine(hasAtLeastOneField)` → empty body rejected. `subject` 3–200, `description` 1–20 000, `priority`/`status` enums, nullable ids for category/assignee/department/branch/team.
- `ticketConversationBodySchema`: `body` trimmed 1–50 000 (internal — markup headroom). Portal reply: 1–20 000.
- `ticketListQuerySchema`: see [Ticket Queries](#ticket-queries). `scope` a 2-value enum (no clamping).

### Error semantics (canonical codes)

| Condition | Code | HTTP |
| --- | --- | --- |
| Body/query/params fail Zod | `VALIDATION_ERROR` | 400 |
| Ticket not visible / missing (incl. MANAGER cross-team, AGENT foreign, portal non-owned) | `TICKET_NOT_FOUND` | 404 |
| `customerId` does not exist | `CUSTOMER_NOT_FOUND` | 404 |
| `categoryId` missing / inactive | `CATEGORY_NOT_FOUND` | 404 |
| `departmentId` / `branchId` missing | `DEPARTMENT_NOT_FOUND` / `BRANCH_NOT_FOUND` | 404 |
| `assignedAgentId` is not an `AGENT` | `INVALID_ASSIGNED_AGENT` | 400 |
| Team missing / inactive | `INVALID_TEAM` | 400 |
| Team not in the ticket's department | `TEAM_DEPARTMENT_MISMATCH` | 400 |
| Department not in the selected branch | `DEPARTMENT_BRANCH_MISMATCH` | 400 |
| Move not allowed by the transition matrix | `INVALID_STATUS_TRANSITION` | 409 |
| AGENT touches a forbidden field / mixed body / escalation / non-self ticket / non-self assignee | `FORBIDDEN` | 403 |
| AGENT self-claim lost the race | `TICKET_ALREADY_ASSIGNED` | 409 |
| Assign an agent from another team | `CROSS_TEAM_ASSIGNMENT` | 409 |
| Assign an agent with no team | `AGENT_HAS_NO_TEAM` | 409 |
| Reply / note body empty once sanitised | `EMPTY_MESSAGE` | 422 |
| Create SMS/WhatsApp ticket, customer has no valid phone | `CUSTOMER_PHONE_REQUIRED` | 422 |
| Create EMAIL ticket, customer has no email | `CUSTOMER_EMAIL_REQUIRED` | 422 |
| Any mutation on a `CLOSED` ticket — staff/portal reply, internal note, new attachment (MS-03), **or** `PATCH /tickets/:id` metadata / workflow / routing / self-claim (MS-04) | `TICKET_CLOSED` | 409 |
| Portal caller has no linked `Customer` | `CUSTOMER_PROFILE_REQUIRED` | 403 |
| Unauthenticated | `AUTHENTICATION_REQUIRED` | 401 |

### Invariants enforced

- No partial write on a rejected AGENT mutation (`enforceMutationPermissions` runs before any DB write; a mixed body throws first).
- Workflow timestamps and SLA snapshots are never client-settable.
- `firstRespondedAt` is monotonic (set once).
- Self-claim never bundles other fields; automatic assignment never overwrites an existing assignee.
- Realtime events never precede commit.
- Notification writes are transactional with the mutation.
- `CLOSED` = viewable + immutable (MS-03 + MS-04): a `CLOSED` ticket is always readable but takes **no** mutation — staff reply, staff internal note, customer portal reply, new attachments (MS-03), and every `PATCH /tickets/:id` metadata / workflow / routing change or `AGENT` self-claim (MS-04) all reject with `409 TICKET_CLOSED` before any write. `CLOSED` stays terminal.

---

## Security and Privacy

- **RBAC is server-side and authoritative.** `requireRole` + `ticket-visibility.ts` + `enforceMutationPermissions` + `shared/team/team-scope.ts`. Frontend `ticket-permissions.ts` and route guards are UX conveniences, explicitly commented as non-authoritative.
- **Customer isolation.** Every portal query ANDs the caller's server-resolved `customerId`; a client-supplied id/email is never trusted; IDOR attempts return `404`, never `403` (no existence leak). MANAGER cross-team reads also return `404`.
- **Internal-note privacy.** `TicketNote` is only ever selected into the internal `conversation` array. It is never in a portal response, never in a customer realtime event; `canReceive` returns `false` for a `CUSTOMER` on any `visibility: "internal"` event, and the client handler drops it as defence in depth.
- **Server-derived identity.** `authorUserId` / `actorUserId` / `createdById` / portal `customerId` are derived from the JWT (`request.auth`), never accepted from the client. An AGENT-created ticket is force-assigned to its creator.
- **Assignment boundaries.** Same-team invariant on every assignment path; AGENT may only self-claim an unassigned in-team ticket.
- **HTML / rich content.** Sanitised server-side on write to a fixed allowlist (the trust boundary, not the client); markup-only bodies rejected `422`; client re-sanitises on render (DOMPurify). Providers and AI context receive plain text only.
- **External-channel trust boundary.** Webhooks are authenticated by provider signature over the **raw** body (mounted before the JSON parser): Resend `svix-*`, Meta `X-Hub-Signature-256` HMAC, TextBee `X-Signature` HMAC. Product JWTs grant no webhook access. Unset provider credentials return a structured `503`, never a crash. Inbound bodies are length-clipped (20 000) and HTML-sanitised; inbound attachments are content-signature-validated and size-capped. The webhook signature is trusted; the **sender identity inside a validly-signed payload is provider-asserted, not CRM-verified** (see [Known Gaps](#known-gaps--drift) DG-10).
- **Sensitive data exposure prevention.** Password hashes never leave the server. Realtime frames carry ids only — ticket/message/notification ids, assignment changes, and customer activity never reach an unauthorised connection. `AuditLog.metadata` never stores message/note bodies, hashes, tokens, or whole request bodies. Sanitised server errors only.
- **Cron endpoints** (`/api/internal/sla-monitor`, task-reminder, live-chat-inactivity) authenticate with a static `CRON_SECRET` bearer, not a product JWT; automated mutations carry `actorUserId = null` / `actorType = "SYSTEM"`.

---

## Localization / RTL

- Two languages: English (default/fallback) and Arabic, via i18next; `client/src/locales/{en,ar}`. New user-facing ticket strings require both entries.
- Document `lang` / `dir` is set at the root off the persisted language choice; Tailwind logical utilities flip automatically.
- Ticket status / priority / channel / SLA-state labels and history-action labels are localised. Canonical status order is centralised in `ticket-status-theme.ts` and reused across tables, filters, detail, and charts.
- Technical / directional values inside ticket UI — ticket id / reference, customer email, phone, timestamps — are forced LTR (`dir="ltr"` / `<bdi dir="ltr">`) even in Arabic layouts.
- Validation messages are i18n **keys** resolved at render time (React Hook Form + Zod), not literal strings.
- RTL and dark-mode browser QA for ticket pages is called out as outstanding in several ADRs (no running browser in the authoring environment).

---

## Backward Compatibility

- **`TicketStatus` has no `NEW`** (ADR-046). The API rejects `NEW` as an invalid enum value; a data migration converted historical `NEW → OPEN`. Any future retired status must be recorded here explicitly.
- **`TicketMessage.body` / `TicketNote.body` are stored HTML** (ADR-035). Historical plain-text rows render unchanged via a content-shape sniff; the change was representation-only (field name and JSON type unchanged).
- **Additive nullable unique columns** must stay additive: `Ticket.emailThreadToken`, `TicketMessage.externalId` / `externalMessageId`, `Attachment.externalId`.
- **`Ticket.teamId` is nullable** — pre-team tickets, portal tickets, and inbound-channel tickets legitimately exist unrouted and are ADMIN-only until routed. Code must not assume a non-null `teamId`.
- **`PATCH /tickets/:id` is the single mutation surface.** Dedicated `POST /tickets/:id/assign` and `/status` are documented as PLANNED (superseded) and were never registered — do not add them without a decision.
- **The internal `conversation` read shape is internal-only** (ADR-010). A portal ticket response must never select or serialise `TicketNote`.
- **No ticket deletion** — ever. Tickets are retained as support history; related models use `Restrict` / `SetNull`, never cascade, for historical rows.
- **Portal response shape is a compatibility surface** — adding assignee/SLA/notes/history/team fields to it would be a customer-facing data-exposure regression.
- **Channel webhooks** must keep verifying the provider signature over the raw body before the JSON parser; changing mount order silently breaks verification.
- **Realtime wire payloads** must stay record-free (`{ type, ticketId, messageId?, visibility? }`). Adding records is an authorization-leak and coupling regression.

---

## Testing / Verification Expectations

`server/src/modules/tickets/ticket.test.ts` (large, Supertest + Vitest) is the primary evidence of intended current behaviour. Any future ticket change must keep the following verified:

- **RBAC / visibility:** unauthenticated + CUSTOMER rejected; AGENT `mine` default, `unassigned` scope, invalid scope → 400, ignored AGENT `assignedAgentId`, foreign-ticket `GET /:id` → 404; MANAGER list/detail scoped to own team, MANAGER-with-no-team matches nothing, ADMIN unscoped.
- **Lifecycle:** valid transition + resolution timestamp ownership; rejected invalid transitions; rejected direct close; AGENT workflow change blocked on unassigned; AGENT blocked in/out of `ESCALATED`; MANAGER escalate allowed; `RESOLVED → IN_PROGRESS` reopen; `NEW` rejected as an invalid value.
- **Creation:** SLA snapshot + `TICKET_CREATED` history; agent-created ticket force-assigned + `ASSIGNMENT_CHANGED`; invalid customer / assignee rejected; per-channel create + channel persistence; channel contact guards (`CUSTOMER_PHONE_REQUIRED` / `CUSTOMER_EMAIL_REQUIRED`); `LIVE_CHAT` / unknown channel → 400.
- **Assignment:** atomic self-claim success / 409 lost race / idempotent 200 / 403 non-self / 403 bundled / 404 foreign; automatic assignment (least-loaded, deterministic tie-break, no-op when explicit assignee, no-op when no team, still 201 when no eligible agent, runs when ADMIN routes an unrouted ticket, never overwrites an explicit assignee, no-op on terminal); team isolation (`CROSS_TEAM_ASSIGNMENT`, same-team allowed, unrouted adopts assignee's team, AGENT unassigned queue narrowed to team).
- **Conversation:** deterministic discriminated `conversation`; public reply records first response (once); spoofed author / empty reply rejected; notes stored separately without first response; `@mention` rows + auto-watch + one mention notification, no double-notify; per-channel outbound delivery is commit-first (WhatsApp / EMAIL / SMS: reply persists even when provider is unconfigured / rejects / times out; `PROVIDER_UNREACHABLE` vs `PROVIDER_REJECTED`; plain text to providers; internal note never sends); RBAC ahead of transport; `ticket.message.created` emitted after persist, not emitted on failure.
- **SLA:** priority-change recalculation of unresolved deadlines; `no-op PATCH` emits no `ticket.updated`; SLA filter ANDed for ADMIN/MANAGER; cron escalation only on resolution breach, never re-escalating.
- **Portal:** own-only list/detail; reply reopen semantics + `409 TICKET_CLOSED`; notes never exposed; SLA never exposed; feedback eligibility.
- **HTML sanitisation:** support formatting kept, scripts/handlers/unsafe hrefs dropped, markup-only → 422, `@mention` tokens survive.

Cross-module tests to keep green when a ticket change touches them: `portal-pages.test.tsx` ("shares the internal ticket design"), realtime `canReceive` tests, `sla-automation` cron tests, `assignment` engine tests, `collaboration` mention/watcher tests, inbound `email` / `whatsapp` / `sms` service tests.

Standard verification per `specs/constitution.md`: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (client typecheck via `tsc -b` catches test-fixture type errors that Vitest misses).

---

## Known Gaps / Drift

Every discovered issue, classified. Classifications updated after the human resolved OD-1…OD-6 (2026-09-10). Items marked **Approved for implementation** are scoped in [`plan.md`](./plan.md); nothing is silently fixed in the spec.

| ID | Classification | Finding | Evidence |
| --- | --- | --- | --- |
| **DG-1** | **Reconciled** (TK-010) — was Documentation Drift | `docs/07-ticket-workflow.md` "Valid Manual Transitions" now lists the full union incl. every `→ ESCALATED` transition and `ESCALATED → IN_PROGRESS`, plus the reopen SLA rule. This spec's [transition matrix](#manual-transition-matrix--authoritative) is authoritative. | `ticket.service.ts:43-50`; `docs/07`. |
| **DG-2** | **Reconciled** (TK-010) — was Documentation Drift | `docs/22-realtime-events.md` §3 emission table + §4 `withRealtimeOutbox` entrypoint list now include SMS inbound, `portal.service.reply`, `portal.service.createTicket` (OD-3), `selfAssignTicket`, and live-chat start/end; §5 authorization table now states team-scoped `canReceive` (MANAGER own-team, AGENT own-team unassigned, CUSTOMER own ticket). | `realtime.service.canReceive`; `docs/22`. |
| **DG-3** | **Partially reconciled** (TK-010) — was Documentation Drift | `docs/05` "Later Ticket Actions" attachment status corrected to LIVE; `GET /tickets` section now documents the `channel` filter (OD-4) and the customer-ticket MANAGER team-scope (OD-6). The dated "Registered routers as of master 12a0c12" snapshot line is left as a point-in-time note. | `docs/05`. |
| **DG-4** | **Implemented** (OD-1 / TK-001) | Manual `RESOLVED → IN_PROGRESS` via `PATCH /tickets/:id` now clears `resolvedAt` and retains `resolutionDueAt`; the reopened ticket re-enters `deriveSla`, `slaFilterWhere`, and SLA-monitor escalation. Regression coverage in `ticket.test.ts` + `sla-automation.test.ts` (TK-002). | `ticket.service.ts` `updateTicket` data builder (clause added next to the `resolvedAt`/`closedAt` set lines). → [Resolved OD-1](#resolved-decisions), [`plan.md` §5](./plan.md). |
| **DG-5** | **Implemented** (OD-2 / TK-003) | `updateTicket` writes one `AuditLog TICKET_ROUTING_CHANGED` row per `PATCH` that changes ≥1 of `departmentId`/`branchId`/`teamId` (incl. implicit team adoption), ids only, in the update transaction; none on a no-op or rejected update; no `TicketHistory` row. A pure re-route now also feeds `changed` → `ticket.updated`. Tests in `ticket.test.ts` (TK-004). | `ticket.service.ts` `updateTicket` (after the `auditEvents` loop); `audit-log.constants.ts` `AUDIT_ACTIONS`. → [Resolved OD-2](#resolved-decisions), [`plan.md` §6](./plan.md). |
| **DG-6** | **Implemented — realtime portion** (OD-3 / TK-005) | `portal.service.createTicket` wrapped in `withRealtimeOutbox`; emits one post-commit `ticket.updated` (unrouted → `ADMIN` audience). No `AuditLog` row (intentional). Tests in `portal.test.ts` + `realtime.test.ts`. | `portal.service.ts` `createTicket`. → [Resolved OD-3](#resolved-decisions), [`plan.md` §7](./plan.md). |
| **DG-7** | **Implemented** (OD-4 / TK-006 + TK-007) | `GET /tickets?channel=<Channel>` — `z.nativeEnum(Channel)` in `ticketListQuerySchema`, `where` in `listTickets` (ANDed after visibility), client `TicketFilters.channel` + canonical `TicketFiltersPopover` `<select>` + EN/AR strings. No DB index. `createdAt` date-range filtering stays out of scope. | `ticket.schema.ts`, `ticket.service.ts`, `ticket-list-page.tsx`, `ticket-filters-popover.tsx`. → [Resolved OD-4](#resolved-decisions), [`plan.md` §8](./plan.md). |
| **DG-8** | Test Gap | Inbound-**SMS** ticket creation / reopen semantics, live-chat creation auto-assignment, and the DG-4 manual-reopen `resolvedAt` behaviour are not covered by `ticket.test.ts` (they live in separate module test files or are unverified). The Tickets plan adds explicit coverage for the DG-4 path; SMS/live-chat coverage stays in their own suites. | `ticket.test.ts` describe list; `sms.service` has its own test file. → [`plan.md` §16](./plan.md). |
| **DG-9** | Architecture Debt | `resolveActorTeamScope` runs an extra `user.findUnique` per ticket request for every MANAGER / AGENT call (team resolution is not memoised on the request object). Documented as acceptable V1. | `team-scope.ts:38-67`; called from `listTickets`, `getTicket`, `updateTicket`, `selfAssignTicket`, `requireConversationMutationAccess`. |
| **DG-10** | Security Concern — **accepted trust boundary** (unchanged) | Inbound EMAIL / WhatsApp / SMS match/create a `Customer` on the **provider-asserted sender identity** inside a validly-signed webhook; the sender inside the signed payload is not independently CRM-verified. Matches ADR-030 / ADR-044 design. **Not in scope to "fix"** — documented boundary; no independent sender-verification system is planned. | `email.service.ts:96-103,254`; `whatsapp.service.ts:92-117`; `sms.service.ts`. |
| **DG-11** | **Implemented — security / visibility fix** (OD-6 / TK-008 + TK-009) | `listCustomerTickets` now ANDs the canonical team-scope fragment (`{ customerId, ...teamScopedTicketWhere(actor, await resolveActorTeamId(actor)) }`), so a `MANAGER` sees only their managed team's tickets (teamless → empty page); `ADMIN` org-wide and `AGENT` full-history + `SUMMARY_ONLY` are unchanged. `customer.test.ts` split: ADMIN org-wide test + a `MANAGER customer-ticket visibility (OD-6)` describe (team-scoped where, teamless empty page, cross-team predicate, pagination). | `customer.service.ts` `listCustomerTickets`. → [Resolved OD-6](#resolved-decisions), [`plan.md` §10](./plan.md). |
| **DG-12** | Future Enhancement | Not implemented: bulk ticket actions; ticket CSV/PDF export; saved views / shareable filter presets; SLA pause on `WAITING_CUSTOMER` (deferred, OD-5); per-ticket SLA override; automatic **team** routing; first-response-breach escalation; ticket merge/split; `channel` change after creation; `createdAt` date-range list filter. | Absent from routes/schema/services. → [Future Enhancements](#future-enhancements). |

---

## Resolved Decisions

All six discovery-phase Open Decisions were answered by the human on **2026-09-10**. They are now intended behaviour and feed [`plan.md`](./plan.md). Original evidence and analysis are in the discovery history (`.wolf/memory.md` / git history of this file).

| ID | Decision (approved) | Effect on this spec | Plan section |
| --- | --- | --- | --- |
| **OD-1** | On manual `RESOLVED → IN_PROGRESS`: **clear `resolvedAt`, retain `resolutionDueAt`**, create no fresh resolution deadline, let the ticket re-enter normal unresolved SLA evaluation, preserve historical SLA/accountability semantics. | [Lifecycle](#transition-rules) + [SLA Integration](#ticket-side-contract) updated; [DG-4](#known-gaps--drift) → approved implementation fix. | [`plan.md` §5](./plan.md) |
| **OD-2** | Changes to `departmentId` / `branchId` / `teamId` **MUST write one `AuditLog` row** (`TICKET_ROUTING_CHANGED`, `entityType: TICKET`, `metadata.changes` = safe `{from,to}` **ids only**, no bodies). No `TicketHistory` row required. No log on a no-op or a rejected update. Same transaction as the mutation. Reuse existing `AuditLog` patterns — no parallel mechanism. | [History and Audit](#auditlog--cross-entity-administrative--security-trail) updated; [DG-5](#known-gaps--drift) → approved audit implementation gap. | [`plan.md` §6](./plan.md) |
| **OD-3** | Portal (`CUSTOMER`) ticket creation **keeps** its `TicketHistory` behaviour, **adds** the canonical post-commit realtime ticket event so staff see new portal work without refreshing, and **adds no new `AuditLog` requirement**. Use the existing canonical event (`ticket.updated`) — verified during planning — not a new event type. | [Creation Flows §2](#2-customer-portal--post-apiportaltickets) + [Realtime](#realtime-events-ticket-side) updated; [DG-6](#known-gaps--drift) realtime portion → approved implementation gap (audit portion → not in scope). | [`plan.md` §7](./plan.md) |
| **OD-4** | Add a **`channel` query filter to `GET /tickets`** — server Zod validation against the existing `Channel` enum, Prisma `where`, compatible with pagination and all existing filters, RBAC/visibility rules still applied, no new channel concept. Frontend support in the canonical ticket table/filter system (it is server-backed and extensible). No customer-portal listing change. | [Ticket Queries](#get-apitickets-internal) updated; [DG-7](#known-gaps--drift) → approved enhancement. | [`plan.md` §8](./plan.md) |
| **OD-5** | **DEFER.** No change to `WAITING_CUSTOMER` SLA countdown semantics as part of Tickets work — this belongs to the future dedicated SLA SDD feature. Current behaviour stays documented and explicitly out of scope; not a blocker. Any OD-1 work must not introduce pause behaviour. | [Scope](#out-of-scope-ticket-depends-on--specified-elsewhere-or-later) + [SLA Integration](#explicitly-not-part-of-the-ticket-side-contract) updated. **No implementation tasks.** | [`plan.md` §9](./plan.md) |
| **OD-6** | `GET /api/customers/:id/tickets` **MUST obey the canonical team-scoped ticket-visibility model**: `ADMIN` org-wide, **`MANAGER` constrained to their managed team**, `AGENT` unchanged (full history, `SUMMARY_ONLY` for another agent), `CUSTOMER` portal-only. The endpoint must not be a visibility bypass. Current code **bypasses team scope** (evidence: `customer.service.ts:93`) → **Case B: fix required** + cross-team regression tests. | [Actors and Permissions](#capability-matrix-current-behaviour) + [Ticket Queries](#get-apicustomersidtickets-customer-management--summary-only) updated; [DG-11](#known-gaps--drift) → approved security/visibility fix. | [`plan.md` §10](./plan.md) |

## Open Decisions

**None.** All discovery-phase decisions are resolved (see [Resolved Decisions](#resolved-decisions)). If implementation surfaces a genuine new product choice, it will be recorded here and escalated rather than decided silently.

---

## Acceptance Criteria for the Existing Feature

Observable, testable statements describing the **currently intended** Tickets system. These become the regression baseline for future planning.

### Lifecycle

1. A ticket created through any path starts in `status = OPEN`.
2. `PATCH /tickets/:id` with a `status` not reachable from the current status per the [transition matrix](#manual-transition-matrix--authoritative) returns `409 INVALID_STATUS_TRANSITION` and writes nothing.
3. Given an `AGENT`, when they `PATCH` a self-assigned ticket to or from `ESCALATED`, then the response is `403 FORBIDDEN`.
4. Given an `ADMIN` or `MANAGER`, when they transition an own-team ticket `OPEN`/`IN_PROGRESS`/`WAITING_CUSTOMER → ESCALATED`, then it succeeds and a `TICKET_ESCALATED` `AuditLog` row + `TICKET_ESCALATED` notifications (active ADMINs + own-team manager) are written.
5. Entering `RESOLVED` sets `resolvedAt`; entering `CLOSED` sets `closedAt` and preserves `resolvedAt`; `CLOSED` has no outgoing transition.
6. An `AGENT` may close only a `RESOLVED` ticket assigned to them; `ADMIN`/`MANAGER` may close any `RESOLVED` ticket.
7. A customer portal reply to a `WAITING_CUSTOMER` ticket moves it to `IN_PROGRESS`; to a `RESOLVED` ticket moves it to `OPEN` and clears `resolvedAt`; to a `CLOSED` ticket returns `409 TICKET_CLOSED` and does not reopen it — each atomically with the message.
8. An inbound WhatsApp or SMS message never reopens a `RESOLVED` or `CLOSED` ticket — it opens a new channel ticket.
8b. **(MS-04)** A `CLOSED` ticket is fully immutable: `PATCH /tickets/:id` changing `status`, `priority`, `categoryId`, `assignedAgentId`, `subject`, `description`, `departmentId`, `branchId`, or `teamId`, and an `AGENT` self-claim, each return `409 TICKET_CLOSED` with no `Ticket` / `TicketHistory` / `AuditLog` write and no realtime event; every read (`GET /tickets/:id`, conversation, history, SLA, attachment list/download) still succeeds.
9. The API rejects `status = NEW` (and any unknown value) as `400 VALIDATION_ERROR`.

### Creation

10. `POST /api/tickets` as an `AGENT` with `assignedAgentId` present (any value, including `null`) returns `403`; without it, the created ticket is assigned to the calling agent and has `TICKET_CREATED` + `ASSIGNMENT_CHANGED` history.
11. `POST /api/tickets` for `channel = SMS`/`WHATSAPP` when the customer has no phone that normalises to E.164 → `422 CUSTOMER_PHONE_REQUIRED`; for `channel = EMAIL` with no customer email → `422 CUSTOMER_EMAIL_REQUIRED`; no row is written.
12. `POST /api/tickets` with `channel = LIVE_CHAT` → `400 VALIDATION_ERROR`.
13. A ticket created with an effective `teamId` and no explicit assignee is auto-assigned to the least-loaded eligible active in-team agent; with no eligible agent the create still returns `201` and the ticket is unassigned.
14. `POST /api/portal/tickets` produces a ticket with `status = OPEN`, `priority = MEDIUM`, `channel = WEB`, `teamId = null`, a `MEDIUM` SLA snapshot, and a `TICKET_CREATED` history row authored by the customer.
15. `POST /api/portal/live-chat` for a department with at least one active team creates a `LIVE_CHAT` ticket already carrying `departmentId` + resolved `teamId` + `branchId` on the first persisted row; a department with no active team → `503 LIVE_CHAT_DEPARTMENT_UNAVAILABLE` and no ticket.
16. An inbound EMAIL / WhatsApp / SMS webhook with a valid provider signature and a new sender creates a `Customer` (if none matches) and an `OPEN`, `MEDIUM`, `teamId = null` channel ticket with a `TICKET_CREATED` history row (`actorUserId = null`); a repeated delivery of the same provider message id makes no further writes.

### Assignment

17. `PATCH /tickets/:id` assigning an agent whose `teamId` differs from the ticket's team → `409 CROSS_TEAM_ASSIGNMENT`; an agent with no team → `409 AGENT_HAS_NO_TEAM`; an unrouted ticket adopts the assignee's team.
18. `PATCH /tickets/:id` with exactly `{ "assignedAgentId": "<self>" }` by an `AGENT` claims an unassigned visible ticket atomically; a concurrent loser gets `409 TICKET_ALREADY_ASSIGNED`; an already-owned ticket returns an idempotent `200` with no new history/audit/event; any other body shape → `403`; a ticket not visible to the agent → `404`.
19. Automatic assignment never overwrites an existing `assignedAgentId` and never acts on a `teamId = null` or terminal ticket.
20. Every assignment (manual, self-claim, automatic) writes an `ASSIGNMENT_CHANGED` `TicketHistory` row and a `TICKET_ASSIGNED` `AuditLog` row; automatic assignment additionally sends exactly one `TICKET_AUTO_ASSIGNED` notification to the chosen agent.

### Visibility & querying

21. An unauthenticated caller or a `CUSTOMER` gets `401` / `403` from every `/api/tickets*` route.
22. An `AGENT` list defaults to `scope=mine` (assigned-to-self); `scope=unassigned` returns only unassigned tickets within the agent's own team; any other `scope` value → `400`; a client `assignedAgentId` filter is ignored for an agent.
23. A `MANAGER` list and detail are restricted to `Ticket.teamId === their team`; another team's ticket id → `404`; a `MANAGER` with no team matches nothing.
24. `GET /tickets` search matches on exact id, or substring of subject / description / customer name / customer email (case-insensitive), always intersected with the caller's scope.
25. `sla=breached|at_risk` and `assignee=unassigned` are honoured for `ADMIN`/`MANAGER` and ignored for `AGENT`.

### Detail, conversation, SLA

26. `GET /tickets/:id` returns the merged discriminated `conversation` (public messages + internal notes, `createdAt` then `kind` then `id` order), `history` (desc), derived SLA (`slaState` / `effectiveSlaDueAt` / `effectiveSlaTarget`), `watcherCount`, and `viewerIsWatching`; it never returns separate `messages` / `notes` arrays.
27. The first public **agent** reply sets `firstRespondedAt` once, in the same transaction as the message; internal notes never set it; later replies never change it; a failed reply transaction leaves it unchanged.
28. Reply and note bodies are sanitised server-side to the support allowlist on write; a body empty once sanitised → `422 EMPTY_MESSAGE`; `@[Name](userId)` tokens survive sanitisation.
29. For `WHATSAPP`/`EMAIL`/`SMS` tickets, a reply persists and returns `201` even when the provider is unconfigured, rejects, or times out; the response carries `delivery.status = "FAILED"` with a `reason`, and a `<CHANNEL>_DELIVERY_FAILED` history row is written; providers receive plain text, never markup; internal notes never trigger a send.
30. Priority change on a non-terminal ticket recomputes `resolutionDueAt` (and `firstResponseDueAt` only while `firstRespondedAt` is null) from the new priority's active rule, or nulls them if no active rule exists.
31. The SLA-monitor cron escalates only unresolved, non-closed, active, non-`ESCALATED` tickets whose `resolutionDueAt` has passed, never re-escalates, and never escalates on a first-response breach.

### Realtime & notifications

32. `ticket.message.created` and `ticket.updated` are published only after their transaction commits; a rolled-back transaction publishes nothing; a no-op `PATCH` publishes no `ticket.updated`.
33. `canReceive` routes ticket events by role + team: ADMIN all; MANAGER own team only; AGENT own-assigned or own-team-unassigned; CUSTOMER own ticket + public visibility only, never internal notes, never `notification.*`.
34. Realtime frames contain only `{ type, ticketId, messageId?, visibility? }` — no ticket / message / customer / user records.

### History & audit

35. Ticket status / priority / assignment / category changes each write both a `TicketHistory` row and the corresponding `AuditLog` row in the same transaction; system-driven changes carry `actorUserId = null` / `actorType = "SYSTEM"`.
36. `GET /api/audit-logs` is `ADMIN` only; `TicketHistory` is readable by anyone who can view the ticket and is not exposed in the portal.

### Portal boundary

37. A `CUSTOMER` can only read tickets tied to their linked `Customer`; a non-owned or missing id → `404 TICKET_NOT_FOUND`.
38. A portal ticket response never contains `TicketNote`, assignee identity, SLA fields (raw or derived), history, watchers, team/department/branch, or (in detail) priority; `ESCALATED` is shown to the customer as `IN_PROGRESS`.
39. A portal attachment upload never creates a `TicketMessage` and never reopens the ticket; upload to a `CLOSED` ticket → `409 TICKET_CLOSED`.

### Compatibility & safety

40. There is no ticket-deletion route for any role.
41. `PATCH /tickets/:id` is the only ticket mutation endpoint; no `POST /tickets/:id/assign` or `/status` route is registered.
42. Historical plain-text message/note bodies continue to render unchanged alongside sanitised-HTML bodies.

### Approved changes (OD-1 … OD-6) — target behaviour to implement and verify

**OD-1 — manual reopen SLA:**

43. Given a `RESOLVED` ticket with `resolvedAt` set, when an `ADMIN`/`MANAGER` (or self-assigned `AGENT`) `PATCH`es it to `IN_PROGRESS`, then `resolvedAt` becomes `null` and `resolutionDueAt` is unchanged, atomically with the status change and its `STATUS_CHANGED` history / `TICKET_STATUS_CHANGED` audit rows.
44. After such a reopen, `GET /tickets/:id` no longer reports `slaState = MET` — it reports `ON_TRACK` / `AT_RISK` / `BREACHED` derived from the retained `resolutionDueAt` (a ticket reopened after that deadline reports `BREACHED`).
45. After such a reopen the ticket is again eligible for `GET /tickets?sla=breached|at_risk` and for cron auto-escalation on a passed `resolutionDueAt`.
46. `firstResponseDueAt` and `firstRespondedAt` are unchanged by a manual reopen. A no-op `PATCH` (status already `IN_PROGRESS`, or any non-`RESOLVED→IN_PROGRESS` move) does not touch `resolvedAt`.
47. Channel-driven reopen (`portal reply`, inbound EMAIL) behaviour is unchanged and still clears `resolvedAt`.

**OD-2 — routing audit:**

48. A `PATCH /tickets/:id` that changes `departmentId`, `branchId`, and/or `teamId` writes exactly **one** `AuditLog` row, `action = TICKET_ROUTING_CHANGED`, `entityType = TICKET`, `entityId = <ticketId>`, `metadata.changes` containing only the changed routing fields as `{ from, to }` **id values** (or `null`), in the same transaction as the update.
49. No `AuditLog` routing row is written when the routing fields are submitted unchanged (no-op) or when the update is rejected by validation / RBAC / transition rules.
50. The routing audit row contains no ticket subject/description/body, no names, no secrets; `TicketHistory` gains no routing row.
51. A single `PATCH` that changes a routing field **and** e.g. `status` writes the routing row **and** the existing `TICKET_STATUS_CHANGED` row, both in one transaction.

**OD-3 — portal-create realtime:**

52. `POST /api/portal/tickets` publishes exactly one post-commit `ticket.updated` event for the new ticket id; a rolled-back creation publishes nothing.
53. The event reaches a connected `ADMIN` (unrouted-ticket audience) and does not reach `MANAGER` / `AGENT` (no team) or any other customer; no customer-isolation regression.
54. Portal ticket creation still writes its `TICKET_CREATED` `TicketHistory` row and still writes no `AuditLog` row.

**OD-4 — channel filter:**

55. `GET /tickets?channel=<value>` returns only tickets whose `channel` matches, intersected with the caller's authoritative scope; an `AGENT` request cannot see a wider set via `channel`.
56. `channel` accepts every `Channel` enum value (`WEB`/`EMAIL`/`WHATSAPP`/`SMS`/`LIVE_CHAT`); an unknown value → `400 VALIDATION_ERROR`; `channel` composes with `search`, `status`, `priority`, `categoryId`, `assignedAgentId`, `sla`, `assignee`, `departmentId`, `branchId`, pagination.
57. The canonical internal ticket list UI exposes a `channel` filter control with EN + AR labels, participates in the existing URL-search-param + clear-filters behaviour, and serialises `channel` into the list query. The customer portal listing is unchanged.

**OD-5 — SLA pause deferral:**

58. `WAITING_CUSTOMER` SLA countdown semantics are unchanged: the resolution clock keeps running, and a `WAITING_CUSTOMER` ticket past `resolutionDueAt` is still `BREACHED` / still auto-escalates. No task introduces pause/resume behaviour.

**OD-6 — customer-ticket MANAGER scope:**

59. `GET /api/customers/:id/tickets` as a `MANAGER` returns only tickets whose `Ticket.teamId` equals the manager's managed team; tickets owned by another team (or unrouted) are absent from `data` and excluded from `meta.total`.
60. A `MANAGER` with no managed team gets an empty page (`data: []`, `meta.total: 0`) from that endpoint.
61. `ADMIN` still receives every ticket of the customer with `access = FULL`; `AGENT` still receives the full history with `access = SUMMARY_ONLY` for another agent's ticket; `CUSTOMER` is still `403`.
62. Regression tests prove no cross-team ticket metadata (subject, status, priority, assigned-agent name, category) leaks to a `MANAGER` through this endpoint.

---

## Future Enhancements

Out of scope for the current system; recorded so they are not mistaken for gaps:

- Automatic **team** routing (only agent selection within an already-routed team is automated today).
- SLA pause / resume / business-hours calendars / per-ticket SLA overrides — **deferred to the dedicated SLA SDD feature** (OD-5); any such policy must preserve this spec's Ticket lifecycle integration contracts.
- First-response-breach escalation.
- Bulk actions, ticket merge / split, `channel` change after creation, `createdAt` date-range list filter.
- Ticket CSV / PDF export; saved / shareable list views.
- A dedicated durable event queue or in-process scheduler (explicitly rejected — `specs/features/realtime/spec.md`, ADR-030).
- Embeddings / semantic retrieval for AI ticket assistance (ADR-034 documents the upgrade path).
- Auditing inbound-channel and portal ticket **creation** (a future decision covering all four non-internal creation paths together — OD-3 deliberately left this out of the current scope).

---

## Cross-Feature Boundary Summary

| Neighbour | Ticket **owns** | Ticket **depends on** |
| --- | --- | --- |
| Customers | `Ticket.customerId` link; channel contact guards | `Customer` record + resolution/creation (webhooks, portal `User → Customer.userId`) |
| Departments / Teams / Branches | `Ticket.teamId` as authoritative owner; `departmentId` / `branchId` tags; adoption-on-assignment rule | Team/Dept/Branch CRUD, `Team.managerId`, `resolveActorTeamId`, `assertAgentAssignableToTicket` |
| Conversations / Channels | `TicketMessage` / `TicketNote` shape, first-response stamping, reopen semantics, delivery-failure markers | Provider adapters, webhook signature verification, threading, commit-first outbound delivery (ADR-052) |
| Email / SMS / WhatsApp / Live Chat | Ticket status/lifecycle/SLA/history for channel tickets | Provider config, inbound parsing, routing (`specs/features/conversations-channels/spec.md`, live-chat feature) |
| Realtime | Which ticket events fire and their audience metadata | SSE transport, `withRealtimeOutbox`, `canReceive` (`specs/features/realtime/spec.md`) |
| Notifications | Which ticket actions notify whom (recipient rules) | `Notification` model, notification centre UI (ADR-029) |
| SLA | Snapshot fields on `Ticket`, priority-change recalculation, auto-escalation trigger | `SlaRule` config, `deriveSla` / `sla-filter` / `sla-outcomes` shared math, cron infra |
| Tasks / Reminders | Nothing (optional `Task.ticketId` back-reference) | Task-linkage visibility check against ticket visibility |
| Reports / Dashboard | Nothing — read-only consumers | Stored ticket timestamps; shared cohort SLA math |
| Audit Logs | Which ticket mutations write which `AuditLog` action | `AuditLog` model + `createAuditLog(tx)` + ADMIN-only read (ADR-039) |
| Knowledge Base / AI | Nothing — AI ticket actions are read-only suggestions | `POST /tickets/:id/ai` (visibility-checked), KB retrieval, `customer-ai` boundary (ADR-054) |
| Attachments | Polymorphic attach points on ticket + message | Attachments module (signature validation, blob store, portal rules) |

---

## Specification Status

`BROWNFIELD DISCOVERY COMPLETE · SPECIFICATION RECONCILED WITH IMPLEMENTATION · HUMAN DECISIONS RESOLVED · OD-1…OD-4/OD-6 IMPLEMENTED (2026-09-10)`

**`IMPLEMENTED — READY FOR HUMAN REVIEW`** on branch `chore/sdd-foundation` (not merged to `master`).

- The spec is an accurate source of truth for the Tickets system as implemented on branch `chore/sdd-foundation`, now including the OD-1…OD-4/OD-6 changes.
- All six discovery-phase Open Decisions are resolved (see [Resolved Decisions](#resolved-decisions)); OD-5 is deferred to the future SLA SDD feature.
- The five approved production changes (OD-1/OD-2/OD-3/OD-4/OD-6) are implemented and covered by focused tests; DG-1/DG-2/DG-3 documentation drift is reconciled. See [`tasks.md`](./tasks.md) for per-task verification evidence.
- No Prisma schema change, no migration, no new dependency.
