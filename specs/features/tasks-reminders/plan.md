# Tasks / Reminders — Plan

Implemented. This plan documents the existing brownfield implementation and
the one confirmed-gap fix made this pass (TASKS-001) — see `tasks.md` for
execution/verification status.

## Existing Implementation to Reuse

Nothing new was built from scratch; this pass is a discovery + narrow fix.

- **Backend module:** `server/src/modules/tasks/` — `task.routes.ts`,
  `task.controller.ts`, `task.service.ts`, `task.schema.ts`,
  `task-reminder.routes.ts`, `task-reminder.controller.ts`,
  `task-reminder.service.ts`.
- **Prisma model:** `Task` (`schema.prisma:428-449`), `enum TaskStatus`
  (`schema.prisma:510-513`), nullable `Notification.taskId`.
- **Shared helpers reused (not duplicated):**
  - `ticketVisibilityWhere` (`modules/tickets/ticket-visibility.ts`) — same
    predicate Tickets uses for its own list/detail authorization, reused
    for both the create/update-time link check and (new, TASKS-001) the
    read-time redaction check.
  - `resolveActorTeamId` / `resolveActorTeamScope`
    (`shared/team/team-scope.ts`) — same team-resolution helper Tickets
    uses.
  - `createNotifications` (`modules/notifications/notification.service.ts`)
    — reused verbatim for `TASK_ASSIGNED`/`TASK_REMINDER`.
  - `withRealtimeOutbox` (`modules/realtime/realtime.publisher.ts`) —
    reused to make notification delivery transactionally safe; Tasks does
    not define its own realtime event.
  - `requireAuth`/`requireRole` (`middleware/auth.js`) — standard route
    gate, no Tasks-specific auth logic.
  - `requireCronSecret` (`modules/sla-automation/sla-automation.auth.js`)
    — reused as-is for the reminder-sweep cron endpoint (same policy as
    SLA monitoring).
- **Frontend feature:** `client/src/features/tasks/` — list/detail/form
  pages, `task-table.tsx`, `task-hooks.ts` (React Query), `task-api.ts`
  (Axios adapter), `task-permissions.ts` (client mirror of the server
  matrix), `task-format.ts` (overdue derivation, date formatting),
  `task.schemas.ts` (RHF/Zod form validation).
- **Frontend reuse:** `useAgents` (from `features/tickets/ticket-hooks`)
  for the assignee picker — no duplicate agent-fetching hook was written.
  Shared `DataTable*`, `AppSelect`, `DatePicker`, `ActionMenu` components.

## Backend Architecture

Standard layered flow, matching every other feature in this repo:

```
Route (auth + role gate, Zod validate)
  → Controller (thin: extract actor/params, call service, shape response)
    → Service (visibility predicate, business rules, Prisma calls,
               notification side-effect inside the same transaction)
      → Prisma → PostgreSQL
```

No new architectural pattern introduced. `taskVisibilityWhere` (private to
`task.service.ts`) is the single visibility predicate for list/get/update/
delete — computed fresh per request from `actor` + resolved team, never
cached.

### TASKS-001 change (this pass)

Added `redactUnauthorizedTicketLinks(actor, records)` in `task.service.ts`:
batches the distinct linked-ticket IDs from a result set into one
`prisma.ticket.findMany({ where: { id: { in }, ...ticketVisibilityWhere }
})` call, then nulls the `ticket` field on any record whose ticket didn't
come back. Applied to `listTasks`, `getTask`, and the returned record from
`createTask`/`updateTask`. One extra query per list/get/create/update call
**only when at least one returned record has a non-null `ticket`** — for
the common case (no linked tickets, or ADMIN whose predicate is always
`{}` but who still legitimately sees everything) the cost is either zero
extra rows filtered or one cheap indexed `IN` lookup against
`Ticket.id` (primary key). No N+1 — batched per response, not per row.

## Frontend Architecture

Standard React Query + Axios + Zod stack, matching Tickets/Customers:

```
Page component (react-router params/search) 
  → task-hooks.ts (useQuery/useMutation, taskKeys cache namespace)
    → task-api.ts (Axios calls, typed payloads)
      → server /api/tasks*
```

`task-permissions.ts` mirrors the server's field-level matrix for
disabling controls; it is explicitly documented (in-code and in
`spec.md`) as defense-in-depth only — the server is authoritative. No
frontend change was needed for TASKS-001: `TaskDetailPage` already
conditionally renders the linked-ticket `Detail` block only `{data.ticket
&& (...)}`, so a `null` ticket after redaction already degrades correctly
with zero client code change.

## Persistence Strategy

No schema change. `Task` already has every column this pass needed
(`ticketId`, `remindedAt`, etc.). No migration.

## Authorization / Visibility Strategy

Two independent, composable predicates, both server-side:

1. **Task visibility** (`taskVisibilityWhere`) — who may see the task row
   at all (creator/assignee/team-linked-ticket for MANAGER).
2. **Ticket visibility** (`ticketVisibilityWhere`, imported from Tickets)
   — re-applied at two points:
   - **Write time** (`assertTicketAccessible` / `ticketAccessibleBy`) —
     gates whether a link may be created/changed at all.
   - **Read time** (new, TASKS-001: `redactUnauthorizedTicketLinks`) —
     gates whether the linked ticket's metadata may still be shown,
     independent of whether the link itself is still "valid" (it always
     is — `ticketId` is never cleared by a visibility change).

This two-point design is deliberate, not redundant: write-time gating
prevents *creating* a boundary-crossing link; read-time gating prevents a
link that was valid at creation time from silently becoming a standing
leak as the org structure (team routing, reassignment) changes around it.

## Ticket Integration Strategy

Confirmed one-way, no new coupling introduced. Tasks depends on Tickets'
`ticketVisibilityWhere` (import, not reimplementation) and nothing else.
No `TicketHistory` writes, no ticket-status gating, no ticket-state
mutation from Tasks. This preserves the existing Cross-Feature Boundary
Summary in `specs/features/tickets/spec.md` verbatim — this pass updates
`specs/features/tasks-reminders/spec.md`'s own copy of that boundary row
only (mirrors, doesn't duplicate authority).

## Notification / Realtime Integration

No new Notification types, no new SSE event. `TASK_ASSIGNED`/
`TASK_REMINDER` already exist as plain string `type` values (no server
enum — `Notification.type` is a free-form `String` column) consumed by the
existing generic notification-bell UI, whose `resolveNotificationTarget`
already branches on `taskId` after `ticketId`. Reused as-is.

## Testing Strategy

- **Server:** `server/src/modules/tasks/task.test.ts` (38 → 41 cases after
  this pass) and `task-reminder.test.ts` (6 cases, unchanged) — Vitest +
  Supertest against a mocked Prisma client (standard pattern across the
  repo). New tests for TASKS-001 cover: single-record redaction on `GET
  /api/tasks/:id`, the pass-through (still-visible) case, and a
  multi-record list-level redaction case proving the fix works across
  pagination, not just single-record reads.
- **Client:** `client/src/features/tasks/tasks.test.tsx` (17 cases,
  unchanged this pass — no client behavior changed, since the existing
  `{data.ticket && ...}` guard already degrades correctly for a `null`
  ticket).
- No new integration/real-Postgres test — consistent with the rest of the
  repo's testing posture (mocked-Prisma unit/integration tests are the
  norm; no feature package in this repo has real-Postgres CI coverage).

## Verification Strategy

Automated-test-verified (server + client Vitest), source-inspection-
verified (schema, onDelete behavior, realtime event absence, seed-data
reachability of the TASKS-001 scenario), and typecheck/lint-verified.
**Not** live-runtime/real-database verified — no local Postgres/browser
session was exercised this pass; stated explicitly rather than implied.
See `tasks.md` for exact commands and counts.

## Confirmed-Gap Implementation Plan (TASKS-001 only)

1. Add `redactUnauthorizedTicketLinks` helper to `task.service.ts`.
2. Wire it into `listTasks` (map over the page), `getTask` (single
   record), and the responses of `createTask`/`updateTask` (defense for
   the unchanged-ticket-on-update case, where the linked ticket could
   already have been invisible before this edit).
3. Add three regression tests to `task.test.ts` (redacted single read,
   pass-through single read, redacted list read) plus wire a
   `prisma.ticket.findMany` mock into the existing test harness.
4. Run targeted + adjacent + full server suite, client suite, typecheck,
   lint, `git diff --check`.
5. Correct the two stale claims in `docs/05-api-contract.md` §Tasks
   (integration status, MANAGER visibility scope) directly tied to code
   this pass inspected.

No other confirmed gap met the fast-track bar (see `spec.md` Discovered
Gaps DG-2 through DG-6 — all documented-and-deferred or docs-only).

## Risks / Trade-offs

- **Extra query cost:** `redactUnauthorizedTicketLinks` adds one
  `ticket.findMany` per response that contains at least one linked ticket.
  Bounded by page size (≤50 rows), uses the existing `Ticket.id` primary
  key index — negligible relative to the `$transaction([findMany, count])`
  the list endpoint already runs. Accepted trade-off for closing a real
  metadata leak; not optimized further (no batching-across-requests
  needed at current scale).
- **Silent redaction, not an error:** a redacted task still returns `200`
  with `ticket: null` rather than surfacing any signal that a link
  existed but was hidden. This matches the existing "concealment, not
  refusal" pattern used elsewhere in the app (e.g. `404` instead of `403`
  for invisible resources) — deliberately consistent, not a new
  convention.
- **DG-3 (no ticket-link UI) left unresolved:** the fix makes the
  *existing* (currently unreachable from the UI, but real via direct API
  use, seed data, and future features) link-and-later-reassign scenario
  safe. It does not address the product question of whether/how to expose
  ticket-linking in the UI — intentionally out of fast-track scope.
