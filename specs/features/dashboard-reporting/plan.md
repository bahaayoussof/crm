# Dashboard / Reporting — Plan

Brownfield: this plan documents the implementation already in place. No new
architecture was introduced by this SDD pass; see `tasks.md` for the one
narrow docs correction made.

## Existing Implementation To Reuse

Backend:
- `server/src/modules/dashboard/{dashboard.routes,dashboard.controller,dashboard.service}.ts`
- `server/src/modules/reports/{reports.routes,reports.controller,reports.schema,reports.service}.ts`
- `server/src/modules/manager/{manager.routes,manager.controller,manager.schema,manager.service}.ts`
- Shared: `server/src/modules/tickets/ticket-visibility.ts` (`ticketVisibilityWhere`),
  `server/src/shared/team/team-scope.ts` (`resolveActorTeamId`,
  `teamScopedTicketWhere`, `teamScopedAgentWhere`),
  `server/src/shared/sla/{derive-sla,sla-outcomes,sla-filter}.ts`

Frontend:
- `client/src/features/dashboard/` (`dashboard-api.ts`, `dashboard-hooks.ts`,
  `dashboard-page.tsx`, `dashboard.types.ts`, `components/`)
- `client/src/features/reports/` (`reports-api.ts`, `reports-hooks.ts`,
  `reports-layout.tsx`, `reports-permissions.ts`, `pages/`, `components/`,
  `hooks/use-reports-range-params.ts`)
- Routing/gating: `client/src/app/router/{app-router,reports-route,
  manager-route}.tsx`, `nav-config.ts`

## Backend Architecture (request flow)

```
Frontend page (dashboard-page.tsx / reports/pages/*)
  → API adapter (dashboard-api.ts / reports-api.ts) — fetch wrapper
  → HTTP endpoint (GET /api/dashboard/overview, /api/reports/*, /api/manager/*)
  → route (dashboard.routes.ts / reports.routes.ts / manager.routes.ts)
      — requireAuth, requireRole(...) applied at router level
  → controller (dashboard.controller.ts / reports.controller.ts / manager.controller.ts)
      — thin: parses/validates query (reports.schema.ts, manager.schema.ts),
        resolves actor + team scope (withTeamScope in reports.controller.ts),
        calls service, returns JSON
  → service (dashboard.service.ts / reports.service.ts / manager.service.ts)
      — business queries: builds Prisma where clauses, calls shared
        visibility/SLA helpers, aggregates/derives metrics
  → shared domain helpers
      — ticket-visibility.ts (ticketVisibilityWhere) — dashboard only
      — team-scope.ts (teamScopedTicketWhere/teamScopedAgentWhere) — manager/reports
      — sla/{derive-sla,sla-outcomes,sla-filter}.ts — all three
  → Prisma (prisma.ticket.findMany/groupBy, prisma.user.findMany, etc.)
  → PostgreSQL
```

Responsibility split:
- **Route**: authn/authz gate only (`requireAuth`, `requireRole`).
- **Controller**: request parsing/validation (Zod schemas), actor/team-scope
  resolution, response shaping — no business/query logic.
- **Service**: all business queries and metric derivation; the only layer
  that talks to Prisma or the shared visibility/SLA helpers.
- **Shared helpers**: single authoritative implementation of "what can this
  actor see" (`ticketVisibilityWhere`, `teamScopedTicketWhere`) and "what is
  this ticket's/cohort's SLA outcome" (`deriveSla`, `sla-outcomes.ts`,
  `sla-filter.ts`) — consumed, not reimplemented, by each service (with the
  two documented, currently-harmless duplications in `spec.md` Gaps 2–3).
- **Prisma/DB**: no dashboard/reporting-specific database logic beyond the
  `Ticket`/`User`/`Team` models already owned by Tickets/Team-management.

## Frontend Architecture

- TanStack Query hooks (`useDashboardOverview`, reports hooks) fetch from
  the API adapters; `staleTime: 60_000`, no window-refocus refetch on
  Dashboard.
- Role branching lives in the page component (`dashboard-page.tsx` branches
  on `user.role === "AGENT"`), not duplicated per-widget.
- Reports IA: one layout (`reports-layout.tsx`) with four routed sub-pages
  matching the four backend endpoints 1:1; `use-reports-range-params.ts`
  centralizes the shared `from/to/departmentId/branchId` query-param state
  across tabs.
- Route/nav gating (`reports-permissions.ts`, `manager-route.tsx`,
  `nav-config.ts`) mirrors server `requireRole` sets exactly — kept as
  defense-in-depth/UX only, never the authorization boundary.

## Security Strategy

Already correctly implemented; this pass verified rather than changed it:
- Router-level `requireAuth` + `requireRole` on every endpoint (no
  per-handler ad hoc checks).
- All scoped queries reuse (dashboard) or parallel-implement identically
  (manager/reports) the same MANAGER/ADMIN access rule as Ticket
  Management, so aggregates can't leak beyond what row-level access allows
  (see `spec.md` Assigned-Ticket Behavior).
- No new security work required. Gap 2 (duplicated scope-rule encoding) is
  tracked as deferred architecture debt, not a fix-now item, because the
  two implementations are currently provably equivalent for the only two
  roles that reach them (MANAGER, ADMIN).

## Testing Strategy

Existing coverage (see `tasks.md` DR-004–DR-006 for exact run results) is
sufficient to prove the acceptance criteria in `spec.md`:
- `dashboard.test.ts`, `reports.test.ts`, `manager.test.ts` — supertest
  against the real Express app/middleware/controller/service chain, Prisma
  mocked. These already assert 401/403 role gating, MANAGER team-scope
  (including no-team sentinel), ADMIN org-wide, AGENT self-assigned-only
  scoping with no `OR`, and metric/SLA correctness against fixtures.
- `dashboard-page.test.tsx`, `reports.test.tsx` (client) — role-aware
  rendering, loading/error/empty states, i18n/RTL.

No new tests were added in this pass — the fast-track gap policy only
requires adding tests for confirmed meaningful gaps, and the existing suite
already proves every acceptance criterion in `spec.md`. Gap 4
(no row-level cross-team test against a real database) is repo-wide
(Prisma is mocked in every module's tests, not just this one) and is
explicitly deferred rather than treated as a dashboard/reporting-specific
hole.

## Runtime Verification Strategy

No real-Postgres integration/e2e test exists for these modules anywhere in
the repo (verified by search). Verification in this pass is:
- **Verified by automated test**: route wiring, role gating, query-shape
  (`where` clause) correctness, metric/SLA arithmetic — via the existing
  supertest+mocked-Prisma suites, re-run in this pass (`tasks.md`).
- **Verified by source inspection**: that the mocked `where` clauses match
  what Prisma would receive from `ticketVisibilityWhere`/
  `teamScopedTicketWhere` in production, and that no separate broader
  "counting" query path exists.
- **Not runtime-manually-verified**: actual SQL execution against a live
  database was not performed in this pass (no disposable/dev Postgres
  session was exercised for this task). This matches every other feature
  package's test-evidence level in this repo and is stated honestly rather
  than claimed.

## Changes Required (confirmed gaps only)

- Corrected `docs/06-auth-rbac.md` line 146 (stale AGENT-dashboard-scope
  claim) — documentation-only, no code change. See `spec.md` Gap 1.
- No code changes required — no correctness or security defect found.

## Risks / Trade-offs

- Deferring Gaps 2–3 (duplicated scope/SLA-window logic) accepts a small
  ongoing risk that a future edit to one copy silently diverges from the
  other. Mitigation: both are called out explicitly in `spec.md` so future
  changes to `ticketVisibilityWhere`, `teamScopedTicketWhere`, or
  `sla-filter.ts` should grep for and cross-check the paired
  implementation.
- Deferring Gap 4 (no real-DB row-level test) accepts the same
  mocked-Prisma-only verification level already accepted repo-wide;
  raising the bar for this one feature package alone would be
  inconsistent with the rest of the codebase's test strategy and is out of
  fast-track scope.
