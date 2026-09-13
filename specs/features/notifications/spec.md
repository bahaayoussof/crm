# Notifications

## Feature Status

**Brownfield feature — discovery complete, no open product decisions, fast-tracked straight to implementation.**

| Aspect | State |
| --- | --- |
| Implementation | **Exists and is mature.** Backend `server/src/modules/notifications/` + producer call sites across `tickets`, `assignment`, `collaboration`, `tasks`, `sla-automation`, `integrations/{email,sms,whatsapp}`, `portal`. Frontend `client/src/features/notifications/`. Prisma `Notification` model already carries structured `ticketId`/`taskId` targeting (migration `20260827161500_add_notification_ticket_id`). |
| Brownfield discovery | **Completed** (2026-09-13). |
| Gaps requiring work | **Small.** Backend recipient/persistence/realtime/authorization behaviour is already correct. The only genuine defects are client-side: dead click on Task notifications, and no explicit per-row "mark as read" affordance. See [Discovered Gaps](#discovered-gaps). |
| Human product decisions | **None required.** Target behaviour in the task brief is already the codebase's existing invariant (ticket → Ticket Details, deterministic destination, DB as source of truth, SSE as invalidation signal only). No ambiguity needed a human call. |
| Ready for `plan.md`? | **Done** — see `plan.md` / `tasks.md`. |
| Final status | **IMPLEMENTED + VERIFIED ON SDD BRANCH** (2026-09-13). See `tasks.md` "Honest status at end of implementation". |

---

## Purpose

The Notification centre gives internal users (ADMIN / MANAGER / AGENT) a durable, permission-safe activity feed: ticket assignment, customer replies, escalations, SLA breaches, mentions, watcher activity, and task assignment/reminders. The Customer Portal has no notification centre (customers are never `Notification.userId` — out of scope by design, ADR-029).

## Scope

### In scope (Notifications owns)

- The `Notification` Prisma model and its persistence (create, list, unread count, mark-read, mark-all-read).
- Recipient-targeting rules for every existing producer call site.
- The realtime signal (`notification.created` / `notification.read`) that tells a connected client to refetch — the DB row is always the source of truth, SSE never carries the payload.
- The bell/dropdown UI: unread badge, list, click-to-navigate, explicit mark-as-read, mark-all-as-read.
- Deterministic navigation target resolution from `ticketId` / `taskId`.

### Out of scope / deferred (unchanged by this feature)

- The Realtime transport itself (SSE framing/reconnect) — `specs/features/realtime/spec.md`, ADR-045. Notifications is a consumer.
- Ticket/Task/SLA business rules that *decide when* to notify (owned by their own features) — this feature only audits and, where a targeting/navigation/read-state defect exists, fixes it.
- A dedicated "all notifications" page — none exists today; not justified by this pass (fast-track rule: don't build UI beyond current architecture).
- Notification preferences, delivery channels (push/email/mobile), advanced grouping ("7 new replies on Ticket #123"), filters.
- Replacing the realtime transport.

---

## Existing Implementation Summary

### Data model

```prisma
model Notification {
  id        String    @id @default(cuid())
  userId    String
  type      String    // free-text: TICKET_ASSIGNED, CUSTOMER_REPLY, TICKET_ESCALATED,
                       // SLA_BREACH_ESCALATION, TICKET_MENTION, TICKET_WATCH_ACTIVITY,
                       // TICKET_AUTO_ASSIGNED, TASK_ASSIGNED, TASK_REMINDER
  title     String
  message   String
  readAt    DateTime?
  createdAt DateTime  @default(now())
  ticketId  String?
  taskId    String?
  task      Task?     @relation(fields: [taskId], references: [id])
  ticket    Ticket?   @relation(fields: [ticketId], references: [id])
  user      User      @relation(fields: [userId], references: [id])

  @@index([userId, readAt, createdAt])
  @@index([ticketId])
  @@index([taskId])
}
```

Structured targeting already exists — no frontend route string is persisted as the canonical relationship. `ticketId` and `taskId` are mutually exclusive per call site (every existing producer passes exactly one).

### Backend

```
server/src/modules/notifications/
├── notification.routes.ts      requireAuth + requireRole(ADMIN,MANAGER,AGENT) — CUSTOMER gets 403 on every route
├── notification.controller.ts  Thin: derives userId from request.auth, calls service
├── notification.schema.ts      Zod: list query (page/limit/read filter), params (id)
├── notification.service.ts     listNotifications, getUnreadCount, markRead, markAllRead, createNotifications
└── notification.test.ts        Unit coverage of the above
```

`createNotifications(tx, recipients, type, title, message, ticketId, taskId?)`:
- Always takes the caller's `Prisma.TransactionClient` — every notification is written atomically with the domain event that caused it (assignment, escalation, reply persistence, task assignment, SLA breach). Nothing writes a `Notification` outside a transaction.
- Deduplicates recipient ids before `createMany`.
- Fires `emitNotificationCreated(recipientIds)` — one targeted SSE frame per unique recipient, buffered by `withRealtimeOutbox` when the caller opened an outbox scope (so it only reaches the wire after the transaction actually commits).
- The frame carries no notification content, only a "something changed for you" signal (`notificationId` is often `null`) — the client always refetches via REST. This satisfies the target invariant "DB is the source of truth; SSE is an invalidation signal, not a data channel."

### Producer call sites (recipient rules audited 2026-09-13)

| Producer | Type | Recipients | Self-notify guard | Notes |
| --- | --- | --- | --- | --- |
| `ticket.service.createTicket` (explicit assignee) | `TICKET_ASSIGNED` | the assignee | `assignedAgentId !== actor.userId` | |
| `ticket.service.updateTicket` (assignment change) | `TICKET_ASSIGNED` | the new assignee | `input.assignedAgentId !== actor.userId` | |
| `assignment.service.autoAssignTicket` | `TICKET_AUTO_ASSIGNED` | the auto-picked agent | actor is `null` (system) | in-team only by construction |
| `ticket.service.updateTicket` (status → ESCALATED) | `TICKET_ESCALATED` | every active ADMIN + **only** the ticket's own team manager (`ticketOperationalRecipientIds`) | excludes actor | unrouted ticket → ADMINs only, never every manager |
| `ticket.service.updateTicket` (status/assignment change) | `TICKET_WATCH_ACTIVITY` | ticket watchers | excludes actor **and** anyone already notified by the assignment/escalation branch above (`excludeUserIds`) — prevents double notification | |
| `sla-automation.service` (cron, resolution breach) | `SLA_BREACH_ESCALATION` | every active ADMIN + only the breached ticket's team manager | actor is `null` | same team-scoping rule as manual escalation |
| `persist-inbound-message.ts` / `portal.service.reply` / `email.service` / `sms.service` / `whatsapp.service` (customer reply, every channel) | `CUSTOMER_REPLY` | shared `customerReplyNotificationRecipientIds`: assigned agent + **only** the ticket's team manager + explicit watchers; falls back to every active ADMIN **only** when the ticket is unrouted AND unassigned AND unwatched (a brand-new inbound ticket with no owner yet) | actor excluded on the portal path (customer's own portal user id) | deliberately narrower than escalation — a routine reply is not an operational alert, so it does **not** fan out to every ADMIN by role |
| `collaboration.service.applyNoteMentions` | `TICKET_MENTION` | parsed `@[Name](userId)` targets, filtered to active internal users, minus the note author | mention parser already excludes the author's own id | mentioned users are also auto-watched so they don't miss subsequent activity |
| `task.service.createTask` / `updateTask` (assignment) | `TASK_ASSIGNED` | the assignee | `assigneeId !== actor.userId` | reassignment is ADMIN/MANAGER-only, matching task RBAC |
| `task-reminder.service.runTaskReminders` (cron) | `TASK_REMINDER` | the task assignee | actor is `null` (system) | idempotent: guarded by `remindedAt IS NULL` + a conditional `updateMany` (`count !== 1` → skip), so a re-run of an already-reminded sweep cannot double-notify |

All of the above already satisfy the brief's recipient guidelines (ticket-assignee targeting, team-scoped escalation, mention-only, no broad creation fan-out, self-notification suppression) with **no code change required**.

### Deduplication

- **DB-level**: every `createNotifications` call sits inside the same transaction as the domain write it accompanies. Inbound-message producers (email/SMS/WhatsApp/portal) additionally guard on a unique inbound-message key (`isInboundKeyConflict` / `isDuplicateSmsMessageConflict`) — a provider retry that re-delivers the same inbound event is caught *before* `createNotifications` ever runs, so no duplicate row is possible.
- **Realtime-level**: the SSE frame carries no payload the client trusts as data (`handleRealtimeEvent` only ever calls `invalidateQueries`). A duplicate/replayed SSE frame triggers a redundant (harmless, idempotent) refetch, never a duplicate DB write. This satisfies "repeated SSE delivery must not create duplicate DB notifications" structurally, not by a de-dup check.

### Persistence + realtime (client)

- `client/src/features/realtime/realtime-provider.tsx` opens one SSE connection per authenticated session (any role) and routes every frame through `handleRealtimeEvent`.
- `realtime-event-handler.ts` already maps `notification.created` / `notification.read` → `invalidateQueries(notificationKeys.lists())` + `invalidateQueries(notificationKeys.unreadCount())`, for internal roles only (`isCustomer` guard short-circuits — the Portal has no notification centre).
- `notification-hooks.ts` additionally polls `unread-count` every 30s as a resilience fallback (covers a dropped/reconnecting SSE connection) — this is *not* the primary mechanism; SSE invalidation is.
- Offline users: since the DB is authoritative and the client always refetches via REST on mount/focus/interval, a user who was offline when a notification was created sees it (unread, correct count) as soon as they load the app — no SSE delivery is required for correctness, only for immediacy.

### Read/unread lifecycle (current, verified correct)

- Opening the bell/dropdown does **not** mark anything read (`NotificationPanel` only fetches; no mutation fires on open).
- `PATCH /notifications/:id/read` is idempotent — re-marking an already-read notification returns the current row unchanged, no duplicate write, no duplicate `notification.read` emission.
- `PATCH /notifications/read-all` marks every currently-unread row for the user read in one `updateMany`.
- `markRead` emits `notification.read` so a second connected tab/device for the same user drops the unread badge too (multi-session correctness).
- Unread count is always `prisma.notification.count({ userId, readAt: null })` — server-computed, never client-derived.

### Authorization / navigation safety (current, verified correct)

- `notificationSelect` never returns another user's data; `markRead` scopes its lookup to `{ id, userId }` — a stale/foreign notification id is a clean 404, not a leak.
- Clicking a notification navigates to `/tickets/:ticketId` or `/tasks/:taskId`. Both detail pages independently re-check authorization server-side on load (`ticketVisibilityWhere` / task visibility) and already render a graceful "not found" state (`tickets.notFound` / `tasks.notFound`) rather than crashing or leaking content — this is unconditional, pre-existing behaviour, exercised whenever a ticket moves team, is deleted, or the viewer's access changes. No notification-specific code needs to duplicate this check; the destination page is authoritative, per the brief's own invariant ("backend authorization remains authoritative").
- CLOSED tickets: per Tickets SDD (MS-03/MS-04), a CLOSED ticket is still visible (only mutation is blocked). A notification whose target ticket is later closed still navigates there successfully and read-only, matching the required "notification may still navigate to it."

---

## Discovered Gaps

| ID | Severity | Description | Disposition |
| --- | --- | --- | --- |
| NOTIF-GAP-1 | **Correctness bug (dead click)** | The client `Notification` type omits `taskId`, and `NotificationRow`'s click handler only ever checks `n.ticketId`. A `TASK_ASSIGNED`/`TASK_REMINDER` notification (which always carries `taskId`, never `ticketId`) navigates nowhere on click — violates the core invariant ("every actionable notification must have one deterministic destination"). | **Fix now** (NOTIF-001, NOTIF-002). |
| NOTIF-GAP-2 | **Missing required UX affordance** | The brief requires an explicit "Mark as read" action distinct from click-to-navigate (e.g. a user wants to clear the unread state without leaving the list). Today the only way to mark a single notification read is to click the whole row, which also navigates away. There is no per-row "mark as read only" control. | **Fix now** (NOTIF-003). |
| NOTIF-GAP-3 | **Defensive gap, not currently reachable** | Every existing producer passes a non-null `ticketId` or `taskId`, so a "system/global notification with no destination" never actually occurs today. `NotificationRow` still renders every row as a full-width `<button>` (implying it's always actionable) regardless. Not a live bug, but the UI doesn't express the invariant, and a future producer with neither id would silently render as a dead clickable row (repeating NOTIF-GAP-1's class of bug). | **Fix now, cheaply** (NOTIF-002) — render non-actionable rows as non-interactive while adding the taskId fix, since both touch the same branch. |
| NOTIF-GAP-4 | **Architecture debt, not a behaviour defect** | Notification `message` strings embed the ticket subject as plain text at creation time (e.g. "Customer replied to ticket #…: {subject}"), captured once and never re-checked against the recipient's *current* access. If a recipient later loses access to that ticket (team move, reassignment), the already-delivered notification still shows the old subject text, even though clicking through is safely re-authorized. This is the one area where the brief's "do not leak sensitive entity content if the recipient may later lose access" is not fully met — subject lines are not typically sensitive, but the mechanism has no re-check. | **Document, defer.** Reworking every notification to look up entity state at *read* time instead of *write* time is a real architecture change (denormalized snapshot → live lookup), well beyond a fast-track pass, and no current producer embeds anything more sensitive than a ticket subject / customer-reply label. No customer PII, message bodies, or note contents are ever embedded. |
| NOTIF-GAP-5 | **UX polish, deferred by brief** | No type/icon differentiation per notification type in the dropdown (all rows look identical besides text). Brief lists this as a "minimum desired" item but fast-track rules explicitly deprioritize broad UI redesign in favor of correctness/dedup. | **Deferred** — out of scope for this pass. |
| NOTIF-GAP-6 | **Not applicable** | "View all notifications" page — brief says build only if already justified/present. No such page exists; building one is new UI surface, not a fix. | **Deferred**, per fast-track rule. |

No schema change, no migration, and no RBAC/route/response-shape change is required to close NOTIF-GAP-1/2/3 — both are pure client-side fixes against data the API already returns (`taskId` is already selected server-side; `notificationSelect` just isn't mirrored in the client type).

---

## Navigation Target Resolution (target behaviour, now made explicit)

1. `ticketId` present → navigate to `/tickets/:ticketId`. (Every `TICKET_*`, `CUSTOMER_REPLY`, `SLA_BREACH_ESCALATION` type.)
2. Else `taskId` present → navigate to `/tasks/:taskId`. (`TASK_ASSIGNED`, `TASK_REMINDER`.) The Task Detail page itself links to the task's linked ticket (`Task.ticketId`) when one exists, satisfying "Task/Reminder → Task or related Ticket" without a second notification-level target field.
3. Neither present → non-clickable row (no navigation, no button semantics); the notification can still be marked read explicitly.

This is a strict application of the existing `ticketId`/`taskId` columns — no new metadata field, no new route string persisted as canonical state.

## Read/unread — target behaviour (already met, restated for the record)

1. Opening the dropdown: never marks anything read.
2. Clicking an actionable (ticketId or taskId) row: mark read (if unread) **then** navigate.
3. Clicking the row's explicit mark-as-read control: mark read, no navigation, dropdown stays open.
4. Mark all as read: available, bulk.
5. Re-clicking an already-read row: still navigates (idempotent read + normal navigation).
6. Unread badge count: always server-computed from `readAt IS NULL`.

## Acceptance Criteria

1. Clicking a Task notification (`taskId` set, `ticketId` null) marks it read and navigates to `/tasks/:taskId`.
2. Clicking a Ticket notification (`ticketId` set) marks it read and navigates to `/tickets/:ticketId`.
3. A notification with neither id renders without button/link semantics and does not navigate on click.
4. Each unread row exposes an explicit "mark as read" control that marks it read without navigating and without closing the dropdown.
5. Opening the bell dropdown does not change any row's read state.
6. "Mark all as read" clears every unread row for the user.
7. Re-clicking an already-read Ticket/Task notification still navigates.
8. Unread badge reflects server state and updates on SSE `notification.created`/`notification.read` and on the 30s poll fallback.
9. No duplicate `Notification` row is ever created for one logical event (verified structurally: all producers write inside the triggering transaction; inbound-channel producers dedupe on a unique inbound key before notifying).
10. No behaviour change to any recipient-targeting rule, RBAC, route, or the `Notification`/`Task`/`Ticket` schema.
