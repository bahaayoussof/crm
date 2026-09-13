# Dashboard / Reporting

## Status

Implemented + verified (brownfield SDD pass, committed on `chore/sdd-foundation`).
No correctness or security defect found. One stale-docs correction applied
(`docs/06-auth-rbac.md`). Server 4/4 targeted test files pass (see
`tasks.md`); no new product code changes were required.

## Purpose

Give internal users (ADMIN, MANAGER, AGENT) a live operational snapshot
(Dashboard) and ADMIN/MANAGER a live analytical breakdown (Reports) of ticket
volume, SLA health, and agent performance — without exposing ticket data a
role could not otherwise open via Ticket Management.

## Scope

- `GET /api/dashboard/overview` and its frontend page
  (`client/src/features/dashboard/`)
- `GET /api/reports/{overview,tickets,agents,sla}` and their frontend pages
  (`client/src/features/reports/`)
- `GET /api/manager/{overview,team,team/:agentId}` and
  `client/src/features/manager/` (the Manager Work Console), documented here
  only insofar as it shares scoping/SLA logic with Dashboard/Reports —
  detailed console UX is out of scope for this package.

## Out of Scope

- Report-builder / custom-report redesign, new chart types, export redesign,
  new analytics warehouse, new caching layer (deferred — see below).
- SLA policy configuration (`server/src/modules/settings`) — owned
  elsewhere.
- Ticket detail/list authorization itself — owned by
  `specs/features/tickets/spec.md`; this package only verifies Dashboard/
  Reports scope is consistent with it.
- Manager Work Console UX beyond its scoping/SLA reuse (candidate for its
  own future package).

## Actors

| Role | Dashboard | Reports | Manager Console |
|---|---|---|---|
| ADMIN | yes, org-wide | yes, org-wide | yes, org-wide |
| MANAGER | yes, own-team (redirected to Manager Console as home) | yes, own-team | yes, own-team |
| AGENT | yes, self-assigned (+ team-unassigned counter) | no (403) | no (403) |
| CUSTOMER | no (403); no route exists client-side either | no (403) | no (403) |

## Dashboard Role/Visibility Matrix

Source: `server/src/modules/dashboard/dashboard.service.ts`, confirmed by
`dashboard.test.ts`.

| Field | ADMIN | MANAGER | AGENT |
|---|---|---|---|
| `metrics.openTickets`, `assignedToMe`, `slaAtRisk`, `slaBreached`, `resolvedToday`, `waitingCustomer` | org-wide | own-team (`teamId` filter, no `OR`) | `assignedAgentId = self` only |
| `metrics.unassignedTickets` | org-wide unassigned | own-team unassigned | **team-visible unassigned** (same rule as Ticket Management's "unassigned" scope for that agent) |
| `statusDistribution`, `recentTickets` | org-wide | own-team | `assignedAgentId = self` only |
| `primaryQueueType` / `primaryTickets` | "Needs Attention" (system-wide, priority-ranked) | "Needs Attention" (team-scoped) | "My Assigned Tickets" (self-assigned, active, priority-ranked) |
| `agentPerformance` | absent | absent | present (self, trailing 30 days) |
| `ticketActivity` (30-day series) | org-wide | own-team | self-assigned |

MANAGER-with-no-team resolves to a sentinel that matches nothing
(`id: { in: [] }`), never falling back to org-wide. ADMIN never receives a
`teamId` predicate at all — code path is a distinct branch, not
"MANAGER with an empty team-list."

## Assigned-Ticket Behavior (P0 finding)

**Conclusion: no leak. Dashboard/Reports never surface a count or row a role
could not open via Ticket Management.**

- The dashboard's general-purpose scope predicate (`dashboard.service.ts`,
  the `visible`/`scoped` values feeding `metrics`, `statusDistribution`,
  `recentTickets`) is produced by calling the **same shared helper** Ticket
  Management uses for list/detail authorization:
  `ticketVisibilityWhere()` in `server/src/modules/tickets/ticket-visibility.ts`.
  Dashboard does not reimplement this predicate.
- For AGENT, dashboard additionally narrows every metric/list field (except
  `unassignedTickets`) to strictly `assignedAgentId = self` — a **subset**
  of what `ticketVisibilityWhere` would allow (self-assigned OR
  team-unassigned). This is a deliberate "personal work console" narrowing,
  not a scope violation: it can only under-report, never over-report,
  relative to what the agent could individually open.
- The one AGENT field with a broader scope, `unassignedTickets`, uses
  exactly the "team-visible unassigned" branch of `ticketVisibilityWhere` —
  identical to the `scope=unassigned` rule an AGENT already gets from
  `GET /tickets`. It is not a new, wider disclosure.
- MANAGER/ADMIN dashboard, reports, and manager-console queries are all
  bounded by `teamId` (MANAGER) or unbounded (ADMIN) — verified against
  `ticketVisibilityWhere`'s own MANAGER/ADMIN branches, which produce the
  same predicate.
- Aggregate counts (`groupBy`, KPI sums) are always computed from a
  `where` clause equal to or narrower than the row-level visibility
  predicate — there is no separate, broader "just for counting" query path
  anywhere in `dashboard.service.ts`, `reports.service.ts`, or
  `manager.service.ts`.

**Residual note (not a defect):** the Manager module encodes its own
`teamScopedTicketWhere()` (`server/src/shared/team/team-scope.ts`) rather
than calling `ticketVisibilityWhere` directly. For MANAGER/ADMIN the two
functions currently produce byte-identical predicates (MANAGER has no
self-assignment branch to diverge on), so there is no present
authorization gap — but it is a duplicated encoding of the same access
rule. See Gaps below.

## Capability/Visibility Matrix (ticket-level)

| Scenario | AGENT sees? | MANAGER sees? | ADMIN sees? |
|---|---|---|---|
| Self-assigned ticket | yes (all fields) | yes if own team | yes |
| Unassigned, own team | yes (counter only, not in metrics/list/recent) | yes | yes |
| Other-agent ticket, own team | **no** | yes | yes |
| Cross-team ticket (assigned or not) | **no** | **no** | yes |

## Reporting Capability

Four ADMIN/MANAGER-only endpoints, each a live (non-cached, non-snapshot)
Prisma query per request, team-scoped for MANAGER via the same
`from`/`to`/`departmentId`/`branchId` + injected `teamId` query shape:

- `GET /reports/overview` — KPIs (created, resolved, SLA compliance %, avg
  first-response minutes, satisfaction), daily ticket-volume series, status
  distribution, satisfaction (1–5) histogram.
- `GET /reports/tickets` (Ticket Breakdown) — totals, volume, breakdowns by
  status / priority / category / channel.
- `GET /reports/agents` (Agent Performance) — per-agent assigned / resolved
  / open / SLA-met / SLA-breached / SLA-met % / avg first-response minutes;
  paginated, searchable, sortable.
- `GET /reports/sla` (SLA Performance) — first-response and resolution
  tallies (met/breached/pending, compliance %), by-priority breakdown,
  average minutes.

All four correspond to the frontend's Overview / Ticket Breakdown / Agent
Performance / SLA Performance pages
(`client/src/features/reports/pages/`) — no report section exists in the
UI without a backing endpoint, and no endpoint is unused by the UI.

## Metric Definitions

See the research inventory embedded in `plan.md` for the full per-metric
source-query table (kept in `plan.md` to avoid duplicating source-of-truth
detail across two files). Summary:

- **Dashboard metrics** are a live snapshot of the caller's own
  scope at request time — not historical/point-in-time; a resolved ticket's
  numbers can change on the next reload if underlying data changes.
- **Reports metrics** are live aggregates over an explicit `[from, to]`
  window (default trailing 30 days, max 366-day span) — not
  materialized/cached.
- **SLA compliance %**, **average first-response minutes**, and **average
  resolution minutes** are computed via the shared
  `server/src/shared/sla/sla-outcomes.ts` helpers
  (`firstResponseOutcome`, `resolutionOutcome`, `compliancePct`, `average`)
  everywhere they appear (Dashboard's `agentPerformance`, Manager's
  `summarizePerformance`, and all four Reports endpoints) — one
  authoritative implementation, not per-module reimplementation.
- Per-ticket "current SLA state" (`ON_TRACK`/`AT_RISK`/`BREACHED`/`MET`/
  `NOT_CONFIGURED`) is computed via the shared `deriveSla()`
  (`server/src/shared/sla/derive-sla.ts`), reused by Dashboard and Manager.

## Priority Behavior

`TicketPriority` is actively surfaced by this feature (not a Tickets-only
concern):

- Dashboard: drives "Needs Attention"/"My Assigned Tickets" queue ranking
  (`URGENT` > `HIGH` > `MEDIUM` > `LOW`) and chart coloring
  (`chart-theme.ts`).
- Manager: `unassignedUrgent` KPI and `priorityWork` queue both filter on
  `TicketPriority.URGENT`.
- Reports: `byPriority` grouping in both Ticket Breakdown and SLA
  Performance.

Priority *definitions* (what each level means, how it's assigned/changed)
remain owned by `specs/features/tickets/spec.md` — this package only
documents how Dashboard/Reports *consume* the existing enum.

## SLA Behavior

See Metric Definitions above. One residual duplication is noted under
Gaps: Dashboard's SLA-window `where`-fragment
(`dashboard.service.ts` `slaWindowWhere`) is a hand-written equivalent of
`server/src/shared/sla/sla-filter.ts`'s `slaFilterWhere`, not a call to
that shared function. Behavior is currently equivalent (verified by
reading both implementations) because Dashboard always ANDs its own
active-status guard alongside it.

## Security / RBAC

- Every Dashboard/Reports/Manager route requires `requireAuth` plus
  `requireRole(...)` at the router level (`dashboard.routes.ts`,
  `reports.routes.ts`, `manager.routes.ts`) — confirmed by 401/403 test
  cases for unauthenticated and CUSTOMER/AGENT-on-Reports/Manager requests.
- CUSTOMER cannot reach any of these three feature areas even client-side —
  the portal route tree (`/portal/*`) has no dashboard/reports/manager
  routes.
- Frontend role gates (`reports-permissions.ts`, `manager-route.tsx`,
  `nav-config.ts`) are presentation-only; every gated route/nav item has a
  matching server `requireRole` check. No cross-team aggregate leakage was
  found — see Assigned-Ticket Behavior above.

## Runtime/Data-Flow Contract

Verified end-to-end (route → controller → service → shared helper →
Prisma) via existing supertest-against-mocked-Prisma tests — see
`tasks.md` for the exact commands/results and the honest
verified-by-source-inspection vs verified-by-automated-test distinction.
No real-database integration/e2e test exists for these modules in this
repository (none was found for any other feature package either); this is
a pre-existing repo-wide test-strategy characteristic, not a
dashboard/reporting-specific gap.

## Edge Cases

- MANAGER with no assigned team: matches nothing (`id: { in: [] }`), not
  org-wide — verified by test.
- Empty/zero-value metrics: dashboard/report cards render `0`/empty-state
  text rather than blank cells (`dashboard-page.test.tsx`).
- 30-day activity series is zero-filled per UTC day, not sparse.
- Reports date-range query rejects spans over 366 days and defaults to the
  trailing 30 days when omitted (`reports.schema.ts`).

## Discovered Gaps

1. **Docs drift (fixed in this pass):** `docs/06-auth-rbac.md` line 146
   claimed AGENT dashboard metrics/distribution/recent-tickets include
   unassigned tickets. Actual code scopes those to self-assigned only
   (only the separate `unassignedTickets` counter is team-visible).
   Corrected in this pass.
2. **Duplicated access-rule encoding (architecture debt, deferred):**
   `server/src/shared/team/team-scope.ts`'s `teamScopedTicketWhere` and
   `server/src/modules/tickets/ticket-visibility.ts`'s
   `ticketVisibilityWhere` independently encode "MANAGER → own team,
   ADMIN → unrestricted." Currently produce identical predicates for
   MANAGER/ADMIN; a future edit to one without the other could silently
   diverge. Deferred — no correctness bug today, and unifying them is a
   cross-cutting refactor of both Tickets and Manager modules, outside
   this package's fast-track scope.
3. **Duplicated SLA-window filter (architecture debt, deferred):**
   `dashboard.service.ts`'s `slaWindowWhere` reimplements the query-time
   "breached/at-risk" fragment instead of calling
   `shared/sla/sla-filter.ts`'s `slaFilterWhere`. Currently behaviorally
   equivalent (Dashboard ANDs its own active-status guard). Deferred —
   low risk, narrow surface, would require re-verifying Dashboard's exact
   SLA-window semantics against a shared function not designed with
   Dashboard's calling convention in mind.
4. **No row-level cross-team-exclusion test:** existing tests assert the
   `where` clause shape passed to (mocked) Prisma, not actual filtered
   rows against a real database, because Prisma is mocked in all
   dashboard/reports/manager tests. This is a repo-wide test-architecture
   characteristic, not unique to this feature.

## Deferred Scope

Report-builder redesign, new dashboard widgets, new chart types, export
redesign, speculative performance/caching refactors, unification of the
duplicated scope helpers (Gap 2), unification of the duplicated SLA-window
filter (Gap 3) — all explicitly out of fast-track scope per assessment
policy; none block the correctness/security conclusions above.

## Acceptance Criteria

- Given an AGENT, when they load `/dashboard`, then every metric except
  the unassigned-tickets counter reflects only tickets assigned to them.
- Given an AGENT, when they load `/dashboard`, then the unassigned-tickets
  counter reflects the same "team-visible unassigned" scope Ticket
  Management already grants them via `GET /tickets?scope=unassigned`.
- Given a MANAGER with an assigned team, when they load `/dashboard`,
  `/reports/*`, or `/manager/*`, then every result is confined to that
  team; results never include another team's tickets.
- Given a MANAGER with no assigned team, when they load any of the above,
  then results are empty, not organization-wide.
- Given an ADMIN, when they load any of the above, then results are
  organization-wide.
- Given a CUSTOMER or unauthenticated request, when they call any
  Dashboard/Reports/Manager endpoint, then the server returns 401/403 and
  no ticket data.
- Given any role's dashboard/report aggregate count, it never exceeds what
  that role could individually retrieve via `GET /tickets`/`GET /tickets/:id`.

## Cross-Feature Ownership Boundaries

- **Tickets** (`specs/features/tickets/spec.md`) owns ticket visibility
  authorization itself (`ticketVisibilityWhere`), priority definitions/
  transitions, and ticket detail/list/mutation behavior. Dashboard/
  Reporting is a read-only consumer.
- **SLA/Realtime** (`specs/features/sla-automation/`,
  `specs/features/realtime/`) owns SLA rule configuration and
  auto-escalation runtime behavior. Dashboard/Reporting only *reads*
  computed SLA outcomes via the shared helpers documented above.
- **Manager Work Console** UX/workflow (beyond scoping/SLA reuse
  documented here) is a candidate for its own future SDD package — this
  package documents only its shared scoping/metrics contract.
- **Settings** (`server/src/modules/settings`) owns SLA policy
  configuration; not duplicated here.
