# Tasks / Reminders — Tasks

Status: **DONE — brownfield SDD pass complete.** 1/1 fast-track task
implemented (`TASKS-001`). All other findings are documented-and-deferred
in `spec.md` (Discovered Gaps DG-2…DG-6) — no other fast-track-eligible
defect found.

---

## TASKS-001 — Redact linked-ticket metadata when the actor loses ticket visibility

**Goal:** close a confirmed security/RBAC leak — `Task.ticket`
(`{id, subject}`) was returned unconditionally on every read, checked
against ticket visibility only at link-creation time, never re-verified
afterward. A task's creator/assignee who later loses visibility into the
linked ticket (team re-route, agent reassignment, or pre-existing
unvalidated data — confirmed reachable via `seed-test-data.ts`, which
links ~50% of seeded tasks to a random ticket with no visibility check at
all) kept seeing that ticket's `subject` on every `GET /api/tasks` and
`GET /api/tasks/:id`.

**Affected files:**
- `server/src/modules/tasks/task.service.ts` — new
  `redactUnauthorizedTicketLinks` helper; wired into `listTasks`,
  `getTask`, `createTask`, `updateTask`.
- `server/src/modules/tasks/task.test.ts` — added `mocks.ticketFindMany`
  to the test harness; 3 new regression cases.
- `docs/05-api-contract.md` — corrected two stale claims in §Tasks
  (integration status; MANAGER visibility scope) discovered while
  documenting this fix.

**Verification:**
- `npx vitest run src/modules/tasks` (server) → **44/44** (was 41; +3 new).
- `npx vitest run src/modules/tickets src/modules/notifications
  src/modules/realtime src/shared/team` (server, adjacent) → **273/273**,
  unaffected.
- `npx vitest run` (server, full) → **1102/1102 (58 files)**, was 1096.
- `npx tsc --noEmit` (server) → clean.
- `npx eslint src/modules/tasks` (server) → clean.
- `npx vitest run src/features/tasks` (client) → **17/17**, unaffected
  (no client code changed — existing `{data.ticket && ...}` guard already
  degrades correctly for a `null` ticket).
- `npx tsc -b` (client) → clean.
- `npx eslint src/features/tasks` (client) → clean.
- `git diff --check` → clean.
- **Not performed:** live-Postgres/real-runtime verification — no local
  Postgres or browser session was exercised this pass. All verification
  above is automated-test-verified (mocked-Prisma Vitest/Supertest) or
  source-inspection-verified (schema `onDelete` check, seed-data
  reachability trace, absence of any task-specific realtime event). Stated
  explicitly per the verification-gate requirement — not claimed as
  live-DB-verified.

**Status:** `[x]` DONE.

---

## Discovery-only findings (no task ID — documented in `spec.md`, not fast-tracked)

These were investigated as part of the brownfield discovery but did not
meet the fast-track bar (confirmed correctness/security/data-integrity
defect). Recorded here for traceability; full detail in `spec.md`
"Discovered Gaps":

- **DG-2** — MANAGER team-scope degrades differently for a teamless
  MANAGER in Tasks (`OR` clause omitted → falls back to own/unlinked)
  vs. Tickets (`MATCH_NOTHING` for the team-scoped branch). Not a leak —
  Tasks' version is a strict subset, never broader. Architecture-debt
  note only.
- **DG-3** — no client UI ever sends `Task.ticketId`; the backend
  capability is fully built and tested but unreachable from the app.
  Product decision, not a defect — deferred.
- **DG-4** — `TaskDetailPage`/`TaskFormPage` lack a client-side
  `canUseTasks` guard for CUSTOMER (unlike `TaskListPage`); server `403`
  is still authoritative and no data leaks. Cosmetic, deferred.
- **DG-5** — an inactive assignee's existing tasks are not retroactively
  reassigned or hidden; consistent with the rest of the app's handling of
  deactivated-user-owned records. Documented, not a bug.
- **DG-6** — `docs/05-api-contract.md` §Tasks header said "not yet
  integrated" (false — `taskRouter` is mounted in `app.ts`) and claimed
  MANAGER sees "every task" (false — team-scoped). Both corrected in the
  same edit as TASKS-001 (see above); not a separate task since it was a
  docs-only fix directly tied to code this pass already inspected.

## Final Gate

- [x] Targeted Tasks server tests pass.
- [x] Adjacent (tickets/notifications/realtime/team-scope) server tests
      pass — no regression in shared helpers Tasks depends on.
- [x] Full server suite passes.
- [x] Server typecheck + lint clean.
- [x] Targeted client Tasks tests pass.
- [x] Client typecheck + lint clean.
- [x] `git diff --check` clean.
- [x] Feature Coverage Matrix (`specs/features/README.md`) updated —
      Tasks/Reminders added, removed from the "no dedicated SDD package"
      list.
- [x] No commit made — working tree left uncommitted per instruction,
      branch `chore/sdd-foundation` unchanged.
