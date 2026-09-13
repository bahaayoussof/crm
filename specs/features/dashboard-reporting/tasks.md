# Dashboard / Reporting — Tasks

Brownfield audit pass. No correctness/security defect found — no
implementation tasks were required beyond one documentation correction.

- [x] DR-001 — Audit backend request flow and visibility scope for
  Dashboard, Reports, Manager modules
  Files: `server/src/modules/dashboard/*`, `server/src/modules/reports/*`,
  `server/src/modules/manager/*`, `server/src/modules/tickets/ticket-visibility.ts`,
  `server/src/shared/team/team-scope.ts`, `server/src/shared/sla/*`
  Verification: source inspection, cross-checked against existing test
  assertions on `where`-clause shape (see DR-004).
  Status: done. Conclusion in `spec.md` Assigned-Ticket Behavior — no leak.

- [x] DR-002 — Audit frontend role gating and API-hook wiring
  Files: `client/src/features/dashboard/*`, `client/src/features/reports/*`,
  `client/src/app/router/{app-router,reports-route,manager-route}.tsx`,
  `nav-config.ts`
  Verification: source inspection; confirmed every gated route/nav item has
  a matching server `requireRole` (defense-in-depth only, not the
  authorization boundary).
  Status: done.

- [x] DR-003 — Correct stale RBAC doc claim about AGENT dashboard scope
  Files: `docs/06-auth-rbac.md` (line 146)
  Verification: manual diff review; new wording matches
  `dashboard.service.ts` behavior and `dashboard.test.ts` assertions
  (AGENT metrics/distribution/recent-tickets = self-assigned only; only
  `unassignedTickets` is team-visible).
  Status: done.

- [x] DR-004 — Run targeted server tests for Dashboard/Reports/Manager
  Command: `cd server && npx vitest run src/modules/dashboard src/modules/reports src/modules/manager`
  Result: 3 files, 49/49 tests passed.
  Verification level: verified by automated test (supertest against real
  Express route/middleware/controller/service chain; Prisma mocked).
  Status: done.

- [x] DR-005 — Run targeted client tests for Dashboard/Reports
  Command: `cd client && npx vitest run src/features/dashboard src/features/reports`
  Result: 2 files, 26/26 tests passed.
  Verification level: verified by automated test.
  Status: done.

- [x] DR-006 — Typecheck and lint (server + client)
  Commands:
  - `cd server && npx tsc --noEmit -p .` → clean
  - `cd client && npx tsc --noEmit -p .` → clean
  - `cd server && npx eslint src/modules/dashboard src/modules/reports src/modules/manager` → clean
  - `cd client && npx eslint src/features/dashboard src/features/reports` → 1 pre-existing warning
    (`react-refresh/only-export-components` in
    `client/src/features/reports/components/ticket-breakdown/breakdown-chart.tsx:70`,
    not introduced by this pass, no fix required)
  Status: done.

- [x] DR-007 — `git diff --check`
  Command: `git diff --check`
  Result: no output (no whitespace errors).
  Status: done.

- [x] DR-008 — Update `specs/features/README.md` coverage matrix
  Files: `specs/features/README.md`
  Verification: manual diff review — added row to Feature Coverage Matrix,
  removed Dashboard/Reporting from the "implemented but no dedicated SDD
  package" list.
  Status: done.

## Deferred (not implemented — see `spec.md` Discovered Gaps / Deferred Scope)

- DR-GAP-1: Unify `teamScopedTicketWhere` (manager) with
  `ticketVisibilityWhere` (tickets) to remove duplicated MANAGER/ADMIN
  scope-rule encoding. Currently provably equivalent; no correctness bug.
- DR-GAP-2: Replace Dashboard's hand-rolled `slaWindowWhere` with the
  shared `slaFilterWhere` from `shared/sla/sla-filter.ts`. Currently
  behaviorally equivalent.
- DR-GAP-3: Add a real-Postgres row-level integration test proving
  cross-team exclusion (all current tests mock Prisma). Repo-wide
  test-architecture characteristic, not unique to this feature; deferred
  consistent with fast-track policy.

## Runtime Verification Summary

- **Verified by automated test**: route auth/role gating, `where`-clause
  scope shape for ADMIN/MANAGER/AGENT (incl. MANAGER-no-team sentinel),
  metric/SLA arithmetic against fixtures, frontend role-aware rendering
  and loading/error/empty states (DR-004, DR-005).
- **Verified by source inspection**: that dashboard's scope predicate is
  produced by the same `ticketVisibilityWhere` helper Ticket Management
  uses (no separate/broader aggregate-only query path); SLA-helper reuse
  across dashboard/manager/reports (DR-001).
- **Not runtime-manually-verified**: no live-Postgres query execution was
  performed in this pass (no existing real-DB integration test exists for
  these modules to run, and none was added — see DR-GAP-3). Stated
  honestly rather than claimed.
