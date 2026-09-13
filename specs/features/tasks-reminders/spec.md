# Tasks / Reminders — Spec

## Status

**Implemented + verified on SDD branch** (`chore/sdd-foundation`, 2026-09-13,
uncommitted). Brownfield discovery of an already-shipped feature
(`server/src/modules/tasks/*`, `client/src/features/tasks/*`) that had no
dedicated SDD package. One confirmed security/RBAC defect found and fixed
(ticket-link metadata redaction, TASKS-001). No other correctness,
security, or data-integrity defect found. See `tasks.md` for the task
checklist and exact verification evidence.

## Purpose

A lightweight personal/team to-do list for internal staff (ADMIN, MANAGER,
AGENT), optionally cross-referencing a single Ticket. Distinct from Ticket
workflow: a Task is a follow-up reminder an actor owns, not a ticket state.

## Scope

- CRUD for `Task` records: create, list (filter/search/paginate), read one,
  field-scoped update, delete.
- Two-state lifecycle: `OPEN` / `DONE`.
- Optional `dueAt`; automatic overdue derivation (client-side, `OPEN` +
  `dueAt` in the past).
- Optional single-ticket linkage (`Task.ticketId`), visibility-checked at
  link time and re-checked at every read.
- Assignment: self-assign (any internal role) or ADMIN/MANAGER assigning to
  an active AGENT.
- One-shot due-date reminder notification via a cron-invoked sweep
  (`GET /api/internal/task-reminders`), reusing the existing Notifications
  infrastructure.

## Out of Scope

- Recurring/repeating tasks, calendar views, drag-and-drop boards,
  subtasks/dependency graphs — not implemented, not planned by this pass.
- Priority field — does not exist on `Task` (no schema column, no API
  field, no UI). Not invented here.
- Email/SMS/push reminder delivery — reminders are in-app `Notification`
  rows only (see Notifications).
- Task-level attachments, comments, or `@mentions` — not implemented.
- A UI control to link a task to a ticket at create/edit time — the backend
  fully supports `ticketId` (schema, validation, tests) but no client form
  field ever sends it (see "Discovered Gaps").
- Customer/Portal access to tasks — no route, no capability, by design.

## Actors

| Actor | Access |
|---|---|
| ADMIN | Full access to every task; assign to any active AGENT or self. |
| MANAGER | Team-scoped: own tasks + unlinked tasks + tasks whose linked ticket belongs to their managed team; assign to any active AGENT or self. |
| AGENT | Own tasks only (creator or assignee); may only self-assign. |
| CUSTOMER | No access anywhere — `403 FORBIDDEN` on every `/api/tasks*` route, no Portal route exists. |

## Role / Permission Matrix

Server-authoritative (`server/src/modules/tasks/task.service.ts`,
`task.routes.ts`). Frontend hiding (`task-permissions.ts`) mirrors this but
is defense-in-depth only.

| Action | ADMIN | MANAGER | AGENT (creator) | AGENT (assignee, not creator) | AGENT (unrelated) | CUSTOMER |
|---|---|---|---|---|---|---|
| List / search tasks | all | own + unlinked + own-team ticket-linked | own (creator or assignee) | own (creator or assignee) | not visible | 403 |
| Create task | ✓ | ✓ | ✓ (self-assign or assign active AGENT) | — | — | 403 |
| Read one task | any | scoped as above | own | own | 404 | 403 |
| Edit title/description/dueAt/ticketId | any | scoped | ✓ | ✗ (403) | 404 | 403 |
| Edit status | any | scoped | ✓ | ✓ (status only) | 404 | 403 |
| Reassign (`assigneeId`) | any (to active AGENT or self) | scoped (to active AGENT or self) | ✗ (403 `FORBIDDEN`) | ✗ (403, and every other field too) | 404 | 403 |
| Delete task | any | scoped | ✓ (creator) | ✗ (403) | 404 | 403 |
| See a task's linked-ticket `subject` | if actor can currently view that ticket | if actor can currently view that ticket | if actor can currently view that ticket | if actor can currently view that ticket | n/a | 403 |

Route-level gate: `taskRouter.use(requireAuth, requireRole(ADMIN, MANAGER,
AGENT))` (`task.routes.ts:11`) — CUSTOMER and unauthenticated callers are
rejected before any handler runs, on every verb.

### Manager team scope

A MANAGER sees: tasks they created, tasks assigned to them, tasks with no
linked ticket (`ticketId: null`), and tasks whose linked ticket's `teamId`
matches their own managed team (`resolveActorTeamId`, same team-resolution
helper Tickets uses — `managedTeam.id` authoritative over membership
`teamId`). A MANAGER **never** sees another team's ticket-linked task
purely by virtue of being a MANAGER — only via direct ownership
(creator/assignee). A teamless MANAGER's team-linked clause is simply
omitted (falls back to own/unlinked only), not "matches nothing" — see
Discovered Gaps DG-2 for the asymmetry this creates vs. Tickets' own
teamless-MANAGER rule.

### Agent scope

An AGENT sees only tasks where they are the creator or the assignee —
never broader team visibility, unlike Ticket unassigned-queue visibration.
An AGENT-supplied `assigneeId` list filter is **silently ignored** (not
rejected) for non-ADMIN/MANAGER roles — confirmed in
`task.service.ts:148-150` and covered by
`task.test.ts` → "ignores an assigneeId filter from an AGENT".

## Visibility / Ownership Rules

- Ownership is dual: `creatorId` (who made the task) and `assigneeId` (who
  it's for) — both are independent, non-nullable `User` FKs (`Task.creatorId`,
  `Task.assigneeId`, `schema.prisma:436-437`). A task is never
  "unowned" — `assigneeId` always resolves to a real user at create time
  (self by default).
- Unassignment is not supported — there is no way to set `assigneeId` to
  null; every task always has exactly one assignee.
- Inactive/deleted assignee: a task keeps its `assigneeId` FK even if that
  user is later deactivated (`isActive: false`). `resolveAssigneeId`
  prevents *creating or reassigning* a task **to** an inactive/non-AGENT
  user, but does not retroactively touch existing tasks whose assignee
  later became inactive — that assignee (if still able to authenticate,
  i.e. not itself the auth gate) would keep seeing the task. An
  **already-deactivated** user cannot authenticate at all (Auth/RBAC SDD:
  `requireRole` reloads `isActive` on every request), so in practice a
  deactivated assignee's orphaned tasks are simply invisible to everyone
  except ADMIN/the task's MANAGER-team-scope/creator until reassigned —
  consistent with how Tickets treats a deactivated assigned agent.
  Reassignment or deletion by the creator/ADMIN/MANAGER is the intended
  cleanup path; no automated cleanup exists (documented as accepted, not a
  gap — matches the reversible-repair pattern the rest of the app uses).
- **Ticket-linked visibility does not imply ticket-linked ownership.**
  `Task.ticketId` is a plain optional FK with no cascading semantics for
  Tickets. See "Ticket Relationship" below for the full boundary and the
  read-time redaction rule that keeps this safe.

## Task Lifecycle

- **Statuses:** `OPEN` (default) → `DONE`. Exactly two states
  (`schema.prisma` `enum TaskStatus { OPEN DONE }`) — no `CANCELLED`,
  `IN_PROGRESS`, etc.
- **Valid transitions:** `OPEN → DONE` and `DONE → OPEN` (reopen), both via
  `PATCH { status }`. No transition table/guard beyond the two-value enum —
  any actor permitted to edit status may toggle either direction.
- **Terminal state:** none — `DONE` is reopenable, not terminal. There is no
  archive/soft-delete state; the only "removal" is a hard `DELETE`.
- **Completion timestamp:** there is **no** `completedAt` field on `Task` —
  completion is represented purely by `status = DONE`. Reopening therefore
  has nothing to clear (no stale-timestamp bug is possible for want of a
  field that doesn't exist).
- **Due date + reminder semantics:**
  - `dueAt` is optional (`nullable DateTime`).
  - `remindedAt` (nullable) marks that the one-shot due reminder has
    already fired; `null` means "not yet reminded" / "eligible again."
  - `remindedAt` is reset to `null` by `updateTask` whenever the edit
    changes the reminder's meaning: `dueAt` changes, the assignee changes,
    or the task is reopened (`DONE → OPEN`) — `task.service.ts:317-323`,
    covered by three dedicated regression tests.
  - Overdue is **derived, not stored**: `isTaskOverdue(dueAt, status) =
    status === "OPEN" && dueAt < now` (`client/src/features/tasks/task-format.ts:23-25`).
    A `DONE` task is never overdue, including one completed after its due
    date — checked directly in code, no bug found (the completed-but-still-
    "overdue" failure mode called out in the audit brief does not occur,
    because overdue is a pure function of current `status`, not a stored
    flag).
  - No server-side overdue field is ever persisted or returned — the API
    returns raw `dueAt`/`status`; overdue is a client-only presentational
    derivation. (The reminder cron does its own independent, correct
    `dueAt <= now && status = OPEN && remindedAt IS NULL` query — it does
    not depend on the client helper.)

## Ticket Relationship

Ownership boundary (mirrors `specs/features/tickets/spec.md` Cross-Feature
Boundary Summary verbatim): **Tickets own ticket workflow; Tasks own task
lifecycle.** `Task.ticketId` is a one-way, optional back-reference with no
reverse coupling:

- `ticketId` is optional on both create and update.
- Any internal role may link a task to a ticket **the actor can currently
  see** — `assertTicketAccessible` reuses the same `ticketVisibilityWhere`
  predicate Tickets itself uses for list/detail authorization (team-scoped
  for MANAGER, assigned-or-unassigned-own-team for AGENT), so a MANAGER
  cannot link another team's ticket and an AGENT cannot link a ticket
  outside their own visibility.
- Ticket existence **is** validated — a non-existent or invisible ticket
  ID returns `404 TICKET_NOT_FOUND` (same code Tickets itself uses for an
  invisible ticket, preserving existence-concealment semantics — no `403`
  leak of "exists but you can't see it").
- When assigning the task to someone else, the **assignee's** access to
  the linked ticket is independently validated (`422
  TICKET_NOT_ACCESSIBLE_BY_ASSIGNEE`) — an ADMIN/MANAGER cannot hand an
  AGENT a task pointing at a ticket that AGENT can't see.
- **CLOSED tickets:** linking to a CLOSED ticket is allowed (CLOSED tickets
  remain visible/read-only per Tickets' MS-03/MS-04 invariant — visibility
  ≠ mutability). Tasks does not read or gate on ticket status at all.
- **Ticket deletion:** production code never hard-deletes a `Ticket`
  (confirmed by repo-wide search — the only `ticket.delete` call anywhere
  is in a throwaway seed script, `seed-whatsapp-test-data.ts`, never
  invoked in a live path). The `Task.ticket` relation has no explicit
  `onDelete` action in `schema.prisma`, so this is a latent, currently
  unreachable edge case — documented, not fixed (nothing to fix: no code
  path can trigger it).
- **Task completion never affects ticket state**, and **ticket updates
  never affect task state** — the only interaction is the read-time
  visibility re-check described next. No `TicketHistory` row is ever
  written for a task link/unlink (confirmed: `task.service.ts` never
  imports the ticket-history helper).

### Ticket-link read-time redaction (TASKS-001 — confirmed & fixed)

Task visibility (creator/assignee/team-linked) and ticket visibility are
independent predicates evaluated at different times: ticket-link access is
checked **only** at create/update time, never re-verified afterward. Once
a linked ticket is re-routed to a different team, reassigned to a
different agent, or was pre-existing data that never passed through this
validation (confirmed reachable — seed data links ~50% of tasks to a
ticket chosen without any visibility check), an actor who still
legitimately owns the **task** would otherwise keep seeing the linked
ticket's `subject` in the task response, even after losing the ability to
open that ticket directly. This violates the explicit invariant that a
task must not leak ticket metadata to an actor who cannot view the ticket.

**Fix:** every read path (`listTasks`, `getTask`, and the record returned
from `createTask`/`updateTask`) now re-checks each linked ticket against
`ticketVisibilityWhere(actor, team)` at response time and nulls the
`ticket` projection (never the flat `ticketId` scalar, which is opaque and
independently re-checked by the Tickets endpoints themselves) when the
ticket no longer satisfies the actor's current visibility. See `tasks.md`
TASKS-001 for the exact diff and test evidence.

## Notifications

Tasks is a **producer** into the existing Notifications infrastructure
(`specs/features/notifications/`) — no new Notification plumbing was
built or needed; cross-reference that spec for read/mark-as-read/realtime
mechanics. Tasks owns only the trigger and payload:

| Trigger | Type | Recipient | Title/message | Linked fields |
|---|---|---|---|---|
| `createTask` with `assigneeId !== actor.userId` | `TASK_ASSIGNED` | the assignee | "New task assigned to you" | `taskId`, `ticketId: null` |
| `updateTask` reassigning (`ADMIN`/`MANAGER` only, assignee actually changes) | `TASK_ASSIGNED` | the new assignee | "Task assigned to you" | `taskId`, `ticketId: null` |
| Cron sweep, due + not yet reminded | `TASK_REMINDER` | the assignee | "Task due" | `taskId`, `ticketId: null` |

- Self-assignment (create or implicit default) never notifies — confirmed
  by test ("self-assigns and does not notify when no assignee is
  supplied").
- The reminder sweep (`runTaskReminders`, `task-reminder.service.ts`) is
  idempotent: a per-candidate `updateMany({ remindedAt: null }) → count
  === 1` guard inside its own transaction means a repeated/overlapping run
  sends at most one notification per due task per reminder "generation"
  (reset by the rules above).
- Navigation: `resolveNotificationTarget` in the shared notification bell
  (`client/src/features/notifications/notification-bell.tsx:218-222`)
  already resolves `taskId` → `/tasks/${taskId}` (checked after `ticketId`)
  — this was a previously-logged Notifications-SDD defect
  (dead click on a task notification) that is **already fixed** in the
  working tree; nothing further needed here. A stale/deleted-task
  notification would 404 via `TaskDetailPage`'s existing not-found state —
  same acceptable pattern Notifications already documents for ticket links.

## Realtime Behavior

Tasks module does **not** emit any dedicated business event (no
`task.created`/`task.updated`/`task.deleted`). It participates in realtime
only indirectly: `createNotifications` (shared helper) emits a targeted
`notification.created` SSE event per recipient, wrapped in the same
`withRealtimeOutbox` transaction-safety seam the rest of the app uses
(buffered until commit, best-effort delivery). Both `createTask` and
`updateTask` wrap their mutation in `withRealtimeOutbox` **solely** to make
that notification delivery transactionally safe — not to publish a
task-specific event. SSE transport itself remains owned by
`specs/features/realtime/`; this spec asserts only that Tasks has no
business event of its own to define.

## API Contract (behavior level)

See `docs/05-api-contract.md` §Tasks (updated this pass — one stale claim
corrected, see Discovered Gaps) for the literal route table. Contract
highlights not already covered above:

- `GET /api/tasks` — `?status&assigneeId&ticketId&search&page&limit`,
  strict schema (unknown query key → `400`). Default `limit=15`, max `50`.
  Ordering: `dueAt ASC NULLS LAST, createdAt DESC, id ASC` (deterministic
  pagination even with duplicate `createdAt`).
- `search` matches `title` OR `description`, case-insensitive `contains`.
- `POST /api/tasks` — `title` (2–200 chars, trimmed), optional
  `description` (≤2000), `dueAt` (ISO datetime), `assigneeId`, `ticketId`.
  Strict body — unknown field → `400`.
- `PATCH /api/tasks/:id` — same field set plus `status`, all optional but
  at least one required (`hasAtLeastOneField` refine → `400` on empty
  body). Field-level permission enforcement happens in the service, not
  the schema (see Role/Permission Matrix).
- `DELETE /api/tasks/:id` — `204`, no body.
- Every response wraps a single task as `{ data: <task> }`; list responses
  as `{ data: [...], meta: { page, limit, total, totalPages } }`.
- Error codes used: `401 AUTHENTICATION_REQUIRED`, `403 FORBIDDEN`, `404
  TASK_NOT_FOUND` / `TICKET_NOT_FOUND` / `ASSIGNEE_NOT_FOUND`, `422
  TICKET_NOT_ACCESSIBLE_BY_ASSIGNEE`, `400` (validation). Consistent with
  the rest of the app's 401/403/404 conventions — an out-of-visibility
  task is `404`, never `403` (no existence leak).

## Frontend Behavior

- **List page** (`task-list-page.tsx`): search (debounced), status filter,
  assignee filter (ADMIN/MANAGER only, hidden for AGENT — matches
  `canAssignTasks`), pagination, "clear filters." Loading → skeleton;
  error → retry panel; empty → distinct copy for "no matches under active
  filters" vs. "no tasks yet" (with a create CTA in the latter case).
  Non-permitted role (`!canUseTasks`) is client-redirected to `/dashboard`
  — defense-in-depth only, server 403 is authoritative.
- **Detail page** (`task-detail-page.tsx`): status toggle (mark
  done/reopen), edit link, delete — each gated by `taskEditScope` mirroring
  the server matrix exactly. Shows an overdue badge derived client-side.
  Linked ticket renders as a link to `/tickets/:id` **only when
  `data.ticket` is non-null** — after TASKS-001, this now correctly
  disappears once the actor loses ticket visibility, instead of rendering
  a subject the actor can no longer legitimately see.
- **Table** (`task-table.tsx`): desktop + mobile-card row variants, both
  mounted (responsive CSS, not conditional render) — delete-confirm dialog
  keyed by `{ id, variant }` so exactly one portal renders (documented
  project convention, `.wolf/cerebrum.md`).
- **Create/edit form** (`task-form-page.tsx`): title, description, due
  date/time (`DatePicker`), status (edit only), assignee (ADMIN/MANAGER
  only). Content fields disabled when `!scope.canEditContent` (assignee-
  only AGENT), with an explanatory hint. **No ticket-link field exists** —
  see Discovered Gaps.
- **RTL/i18n:** all user text fields render `dir="auto"`; dates/times
  render inside `<bdi dir="ltr">` (matches the rest of the app's numeral/
  date directionality convention); `en`/`ar` strings exist for every label
  referenced (`tasks.*` namespace) — not independently re-audited string-
  by-string this pass (no i18n defect reported or found in passing).

## Security / Edge Cases

| Case | Behavior | Verified by |
|---|---|---|
| Cross-team AGENT reading another team's task | `404 TASK_NOT_FOUND` (visibility predicate excludes it) | existing + new tests |
| Task ID enumeration | `404` uniformly for not-found and not-visible — no existence leak | existing tests |
| Editing another user's task (unrelated AGENT) | `404` (never reaches the field-permission branch) | existing test |
| Assigning to unauthorized/inactive/non-AGENT user | `404 ASSIGNEE_NOT_FOUND` | existing tests |
| Linking an unauthorized ticket | `404 TICKET_NOT_FOUND` (create/update) | existing tests |
| Assignee cannot see the linked ticket | `422 TICKET_NOT_ACCESSIBLE_BY_ASSIGNEE` | existing tests |
| Stale/reassigned ticket link leaking `subject` at read time | **Fixed this pass** — `ticket` projection nulled when not currently visible | new tests (TASKS-001) |
| Duplicate completion (`DONE → DONE`) | Idempotent — schema allows redundant status write, no error, `remindedAt` untouched (not a due-date/assignee/reopen change) | source inspection |
| Concurrent reminder sweep runs | Idempotent per-candidate `updateMany` guard prevents double-notify | existing test + source inspection |
| Deleted/stale task behind a notification link | `TaskDetailPage` renders its existing 404 not-found state | source inspection |
| Unknown query/body field | `400` (strict Zod schemas) | existing tests |

## Discovered Gaps

- **DG-1 / TASKS-001 (security/RBAC, fixed):** ticket-link `subject`
  leaked across a lost visibility boundary at read time. See "Ticket-link
  read-time redaction" above and `tasks.md`.
- **DG-2 (architecture-debt, documented, not fixed):** an unteamed
  MANAGER's team-linked ticket clause is simply omitted in Tasks
  (`if (teamId) ownership.push(...)`), so they still see own/unlinked
  tasks — whereas Tickets' own `ticketVisibilityWhere` treats a teamless
  MANAGER as matching **nothing** for the team-scoped branch
  (`MATCH_NOTHING`). Not a security leak (Tasks' behavior is a strict
  subset — no extra tickets become visible, since the team-linked OR
  clause is dropped entirely rather than widened), just an inconsistency
  in how "no team" degrades between the two features. Deferred — no
  observed incorrect access, purely a documentation/consistency note for
  a future pass.
- **DG-3 (missing UI, deferred — not a defect):** the backend fully
  supports linking a task to a ticket (`ticketId` in both create and
  update schemas, fully tested), but no client surface — neither the Task
  create/edit form nor the Ticket detail page — ever sends `ticketId`.
  This is "built but unwired," the same shape as a previously-logged
  Conversations/Channels gap. Deciding whether/where to add a link-to-
  ticket control (Task form field vs. a "Create Task" action from Ticket
  detail) is a product decision, not a confirmed defect — deferred per
  fast-track scope (no invented behavior).
- **DG-4 (UX polish, deferred):** `TaskDetailPage` and `TaskFormPage` (unlike
  `TaskListPage`) have no client-side `canUseTasks` guard for a CUSTOMER
  navigating directly to `/tasks/:id` or `/tasks/new` — they would render
  the page shell and surface the server's `403` through the existing error
  state instead of an immediate redirect. Not a security issue (server is
  authoritative, no data is exposed), purely a slightly less polished
  denial UX. Deferred as cosmetic.
- **DG-5 (documented, not a bug):** an inactive/deactivated assignee's
  existing tasks are not retroactively cleaned up or reassigned (see
  "Visibility / Ownership Rules" above) — consistent with how the rest of
  the app treats deactivated users on existing FK-owned records; no
  automated remediation exists anywhere in the codebase for this pattern,
  so Tasks is not an outlier.
- **DG-6 (docs drift, fixed):** `docs/05-api-contract.md` §Tasks was
  headed "LIVE (on `feature/tasks-reminders`, not yet integrated)" and
  claimed "`ADMIN`/`MANAGER` see every task" — both stale. `taskRouter` is
  in fact mounted in `server/src/app.ts` (confirmed), and MANAGER
  visibility is team-scoped, not global (`feature/team-based-manager-scope`,
  confirmed in `task.service.ts`). Corrected in place this pass (see
  Discovered Gaps DG-1's sibling redaction note added to the same
  section).

## Deferred Scope

Per the fast-track brief's explicit defer list — none of the following are
implemented, and none is invented or scaffolded here:

- Recurring-task engine, calendar redesign, advanced reminder schedules
  (multi-stage, configurable lead time).
- Email/SMS task reminders (in-app `Notification` only).
- Drag-and-drop boards, dependency graphs/subtasks.
- New notification infrastructure (reuses the existing one as-is).
- Priority field on tasks.
- Ticket-link creation UI (DG-3).

## Acceptance Criteria

1. Given an AGENT who is neither creator nor assignee of a task, `GET
   /api/tasks/:id` returns `404 TASK_NOT_FOUND`. ✓ (existing test)
2. Given a MANAGER whose managed team does not match a ticket-linked
   task's ticket team, and who is neither creator nor assignee, that task
   is excluded from `GET /api/tasks`. ✓ (existing test)
3. Given a task whose linked ticket the actor can currently see, `GET
   /api/tasks/:id` includes `ticket: { id, subject }`. ✓ (new test,
   TASKS-001)
4. Given a task the actor still owns (creator/assignee) but whose linked
   ticket the actor can no longer see, `GET /api/tasks/:id` and `GET
   /api/tasks` both return `ticket: null` for that record while
   `ticketId` remains populated. ✓ (new tests, TASKS-001)
5. Given an AGENT who is only a task's assignee, `PATCH` with any field
   other than `status` returns `403 FORBIDDEN` and writes nothing. ✓
   (existing test)
6. Given `DONE → OPEN` reopen, `remindedAt` is cleared so the cron sweep
   can notify again. ✓ (existing test)
7. Given the cron reminder sweep runs twice with no intervening change,
   the second run sends zero additional notifications for tasks already
   reminded. ✓ (existing test)
8. A CUSTOMER receives `403` on every `/api/tasks*` route, authenticated
   or not (unauthenticated → `401` first). ✓ (existing test)

## Cross-Feature Ownership Boundaries

| Neighbour | Tasks **owns** | Tasks **depends on** |
|---|---|---|
| Tickets | Nothing about ticket workflow; the optional `ticketId` back-reference and its read-time visibility redaction | `ticketVisibilityWhere`, `resolveActorTeamScope`/`resolveActorTeamId` (shared team-scope helpers) |
| Notifications | The `TASK_ASSIGNED`/`TASK_REMINDER` trigger points and payload (`taskId`, title/message) | `createNotifications`, the `Notification` model, notification-center UI, mark-as-read/realtime delivery |
| Realtime | Nothing — no task-specific SSE event exists | `withRealtimeOutbox` (used only to make notification delivery transactional) |
| Auth/RBAC | Field-level permission matrix for tasks | `requireAuth`/`requireRole` middleware, JWT-embedded actor identity |
