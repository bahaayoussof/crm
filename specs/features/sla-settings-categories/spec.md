# SLA Settings / Categories — Spec

## Status

**Implemented + verified (uncommitted on `chore/sdd-foundation`)** — brownfield
discovery of `server/src/modules/settings` (SLA rules + category admin CRUD),
`server/src/modules/categories` (non-admin category list), and
`server/src/modules/portal` (customer-facing category list), plus the
`client/src/features/settings` admin UI. One confirmed data-integrity gap was
found and fixed (case-insensitive category name uniqueness, `SC-FOLLOWUP-001`).
No RBAC, correctness, or audit defect found. Server settings tests
17/17 pass (including the new regression test); ticket/portal/live-chat
integration tests 227/227 pass; client settings tests 19/19 pass. See
`tasks.md` for task-by-task verification.

## Purpose

Give SLA policy configuration (per-priority first-response/resolution
targets) and Category administration (the reference list used to classify
tickets) dedicated SDD ownership. Both live under the ADMIN-only `Settings`
surface (`server/src/modules/settings`, `client/src/features/settings`) and
were previously undocumented — implemented in code with no owning package
(see `specs/features/README.md`, "Remaining CRM capability areas").

## Scope

- SLA rule configuration: one rule per `TicketPriority`, upsert semantics,
  active/inactive state, validation, audit logging, ADMIN-only access.
- Category administration: create, update (rename/re-describe),
  activate/deactivate, list/search, uniqueness, ADMIN-only access.
- The read-only category list surfaces consumed by ticket forms
  (`GET /api/categories`, internal ADMIN/MANAGER/AGENT) and by the customer
  portal (`GET /api/portal/categories`, CUSTOMER), to the extent needed to
  document how they read the same `Category` table under different
  authorization boundaries.
- Frontend admin UI: `client/src/features/settings` (`CategoriesSection`,
  `SlaSection`) and its route guard (`SettingsRoute`).

## Out of Scope

- SLA deadline **snapshot semantics on tickets** (how/when
  `firstResponseDueAt`/`resolutionDueAt` are computed and stored on a
  `Ticket` row) → owned by `specs/features/tickets/` (Ticket's SLA
  Integration section).
- Automated breach detection/escalation (the cron/runtime that reacts to a
  ticket's due dates) → owned by `specs/features/realtime/` (`RT-GAP-1`) and
  cross-referenced by `specs/features/tickets/`.
- SLA reporting/aggregate math → owned by `specs/features/dashboard-reporting/`.
- General ticket lifecycle, AI category suggestion logic, and reporting
  consumption of categories → owned by `specs/features/tickets/`,
  `specs/features/ai-assistance/`, and `specs/features/dashboard-reporting/`
  respectively.
- Business-hours/holiday calendars, per-customer SLA policies, SLA
  versioning/history, policy inheritance, category hierarchy/taxonomy, bulk
  category management — none of this exists in the codebase; deliberately
  deferred (see Deferred Scope).

## Actors

- **ADMIN** — full read/write on SLA rules and categories via
  `/api/settings/*`.
- **MANAGER** / **AGENT** — read-only category list via `/api/categories`
  (for ticket forms); no SLA or category-admin access.
- **CUSTOMER** — read-only category list via `/api/portal/categories` (own,
  separately authorized endpoint); no SLA or category-admin access.

## Role / Permission Matrix

| Action | ADMIN | MANAGER | AGENT | CUSTOMER |
|---|---|---|---|---|
| Read SLA rules (`GET /api/settings/sla-rules`) | ✅ | ❌ (403) | ❌ (403) | ❌ (403) |
| Upsert SLA rule (`PUT /api/settings/sla-rules/:priority`) | ✅ | ❌ | ❌ | ❌ |
| Read categories, admin view (`GET /api/settings/categories`) | ✅ | ❌ | ❌ | ❌ |
| Create category (`POST /api/settings/categories`) | ✅ | ❌ | ❌ | ❌ |
| Update/(de)activate category (`PATCH /api/settings/categories/:id`) | ✅ | ❌ | ❌ | ❌ |
| List active categories for ticket forms (`GET /api/categories`) | ✅ | ✅ | ✅ | ❌ (403 — uses portal endpoint instead) |
| List active categories for portal ticket form (`GET /api/portal/categories`) | ❌ (not a portal user) | ❌ | ❌ | ✅ |
| Use `categoryId`/`priority` on ticket create/update | per Tickets RBAC | per Tickets RBAC | per Tickets RBAC | per Portal RBAC |

Verified server-side: `settings.routes.ts:36`
(`requireAuth, requireActiveUser, requireRole(Role.ADMIN)`) gates the entire
`/api/settings` router — SLA and category admin routes have no separate,
weaker gate. `category.routes.ts:7`
(`requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT)`) gates the internal
read-only list; CUSTOMER is not in that role list and gets 403 there by
design — the customer path is `portal.routes.ts` (`GET /portal/categories`,
authenticated CUSTOMER only, via `requireAuth` on the portal router).

Frontend: `SettingsRoute` (`client/src/app/router/settings-route.tsx`)
redirects any non-ADMIN user away from `/settings` to `/dashboard`; the
sidebar hides the "Settings" nav link for non-ADMIN roles
(`sidebar.test.tsx` asserts both the ADMIN-visible and non-ADMIN-hidden
cases). Frontend visibility matches server authorization — no
over-permissive UI found.

## SLA Policy Semantics

- Table: `SlaRule` (`priority TicketPriority @unique`,
  `firstResponseMinutes Int`, `resolutionMinutes Int`, `isActive Boolean`,
  `createdAt`, `updatedAt`).
- **Unique key is `priority`.** The DB-level `@unique` constraint guarantees
  at most one rule per `TicketPriority` (`LOW`/`MEDIUM`/`HIGH`/`URGENT`) —
  duplicate rules for the same priority cannot exist.
- **Upsert-only, no delete.** `PUT /api/settings/sla-rules/:priority` is a
  Prisma `upsert` keyed on `priority` (`settings.service.ts:34`
  `upsertSlaRule`); there is no `DELETE` route and no service-level delete
  path. A rule is "removed" only by setting `isActive: false`, never by
  deleting the row.
- **Missing rule handling is safe.** If a priority has never been saved, no
  row exists; every consumer that looks it up
  (`tx.slaRule.findFirst({ where: { priority, isActive: true } })` in
  `ticket.service.ts`, `live-chat.service.ts`, `portal.service.ts`) treats
  "not found" the same as "inactive": `sla` is `null`, and the caller falls
  back to `firstResponseDueAt`/`resolutionDueAt: null` rather than throwing.
  The frontend `SlaSection` renders a "missing" state per priority
  (`settings.sla.missing`) distinct from "configured", so an admin can see
  the gap.
- **Inactive rule handling is deterministic.** Every runtime lookup filters
  `isActive: true`; an inactive rule is invisible to ticket
  creation/priority-change/live-chat/portal SLA snapshotting — it behaves
  identically to a missing rule (both produce a `null` deadline), which is
  the intended, consistent behavior.
- **Validation** (`upsertSlaRuleSchema`): `firstResponseMinutes` and
  `resolutionMinutes` are integers in `[1, 525_600]` (1 minute to 1 year);
  the schema's `.refine()` additionally rejects a resolution target lower
  than the first-response target. Verified by
  `settings.test.ts` (`rejects invalid SLA settings`, 4 cases).
- **Audit.** Every upsert produces exactly one `AuditLog` row inside the
  same transaction as the write: `SLA_RULE_CREATED` when no prior row
  existed, `SLA_RULE_UPDATED` otherwise, and — for updates — only if a
  tracked field (`firstResponseMinutes`, `resolutionMinutes`, `isActive`)
  actually changed (`changedFields` helper). A no-op `PUT` (identical
  values) writes no audit row, by design, mirroring the Category audit
  behavior below.
- **Concurrency.** A concurrent upsert on the same priority is a normal
  Prisma `upsert` (single statement); the DB `@unique` on `priority` is the
  final authority, consistent with this codebase's general reliance on
  DB constraints over app-level locking (see Customers spec precedent).

## Existing-Ticket Impact (critical boundary)

**Editing an SLA rule never touches existing tickets.** Confirmed by
source inspection: `upsertSlaRule` only writes to `SlaRule` — no code path
in `settings.service.ts` reads or writes `Ticket` rows. A ticket's
`firstResponseDueAt`/`resolutionDueAt` are **snapshotted at two points
only**, both owned by Tickets, not by this package:

1. **Ticket creation** (`ticket.service.ts:347-359`) — looks up the active
   rule for the ticket's initial priority and snapshots both deadlines from
   `now`.
2. **Priority change on an open ticket** (`ticket.service.ts:447-450`) —
   only when `input.priority !== current.priority` **and** the ticket is not
   `RESOLVED`/`CLOSED`, it re-looks-up the active rule for the **new**
   priority and recalculates both deadlines from `now`
   (`firstResponseDueAt` only if `firstRespondedAt` is still null).

There is no third mechanism. Changing `firstResponseMinutes`/
`resolutionMinutes`/`isActive` for a priority that already has open tickets
at that priority does **not** retroactively recalculate those tickets'
deadlines — they keep whatever was snapshotted at creation or last
priority-change time until the ticket's priority changes again. This matches
the only implemented behavior; no docs vs. runtime drift was found here (the
Tickets and Realtime specs already describe deadline-snapshot and
escalation behavior consistently with this).

## Category Lifecycle

- Table: `Category` (`name String @unique`, `description String?`,
  `isActive Boolean @default(true)`, `tickets Ticket[]`).
- **No hard delete.** There is no `DELETE` route for categories anywhere in
  the codebase (`category.routes.ts` is read-only; `settings.routes.ts` has
  only `POST`/`PATCH` for categories, unlike Departments/Branches/Teams
  which do have `DELETE`). Deactivation (`PATCH { isActive: false }`) is the
  only lifecycle removal path — a deliberate, safer design than Departments/
  Branches/Teams for a field directly referenced by historical tickets.
- **Referenced categories cannot be broken.** Because there is no delete
  path, a category referenced by existing tickets can never be removed out
  from under them — `Category.tickets Ticket[]` has no `onDelete` cascade
  concern because deletion is not possible at the API layer. Historical
  ticket integrity is preserved by construction, not by a runtime check.
- **Inactive categories remain visible on existing tickets.** Ticket read
  paths select `category: { select: { id, name } }` directly off the
  ticket's `categoryId` relation with no `isActive` filter — deactivating a
  category does not hide it from tickets that already reference it.
- **Inactive categories cannot be selected for new use.** Both ticket
  creation/priority-agnostic category assignment (`ticket.service.ts:721`)
  and portal ticket creation (`portal.service.ts:90`) look up the category
  with `{ id, isActive: true }` and throw `404 CATEGORY_NOT_FOUND` if it
  doesn't match — an inactive category is indistinguishable from a
  non-existent one for new assignment, which is the correct, safe default.
- **Uniqueness.** `Category.name` has a plain (case-sensitive) `@unique`
  constraint. **Gap found and fixed** (`SC-FOLLOWUP-001`): case-variant
  duplicates (`"Billing"` vs `"billing"`) were not blocked at the DB level,
  even though the search/list endpoint already treats names
  case-insensitively (`mode: "insensitive"` in `listCategories`). This is
  the same class of defect already fixed for `Customer.email`
  (`CUST-FOLLOWUP-001`); the same fix (a hand-authored functional unique
  index on `LOWER(name)`) was applied here. See Discovered Gaps below.
- **Empty/whitespace-only names are rejected.** `createSettingsCategorySchema`/
  `updateSettingsCategorySchema` trim the name before applying
  `min(2).max(100)` — a whitespace-only input becomes an empty string after
  trim and fails validation (400), verified by
  `settings.test.ts` (`rejects invalid category input`).
- **Role access** — see Role/Permission Matrix above; only ADMIN can
  create/update/deactivate.

## Ticket Integration

Traced in `ticket.service.ts` (`validateRelations`, ~line 715-722) and
`portal.service.ts` (~line 89-91):

- `categoryId`, when provided, must reference an **active** category or the
  request is rejected with `404 CATEGORY_NOT_FOUND` (not a generic 400) —
  identical enforcement on the internal and portal paths.
- `priority` drives the SLA rule lookup described above; there is no
  category-level SLA — SLA is priority-only.
- Category change on an existing ticket is tracked in `TicketHistory`
  (`"CATEGORY_CHANGED"`) and audited (`TICKET_CATEGORY_CHANGED`) — owned by
  `specs/features/tickets/` (attribution here only for context: this
  package does not duplicate ticket audit semantics).
- Priority change recalculates SLA deadlines as described above; a bare
  category change does not touch `firstResponseDueAt`/`resolutionDueAt`.

## Audit Behavior

All four config-mutation code paths produce an `AuditLog` row in the same
DB transaction as the write, each only when a tracked field actually
changed:

| Mutation | Action | Entity | Change-gated? |
|---|---|---|---|
| Category create | `CATEGORY_CREATED` | `CATEGORY` | always (new row) |
| Category update | `CATEGORY_UPDATED` | `CATEGORY` | yes (`changedFields` on name/description/isActive) |
| SLA rule create (first upsert for a priority) | `SLA_RULE_CREATED` | `SLA_RULE` | always (new row) |
| SLA rule update (subsequent upsert) | `SLA_RULE_UPDATED` | `SLA_RULE` | yes (`changedFields` on firstResponseMinutes/resolutionMinutes/isActive) |

No gap found here — this matches the audit rigor of other ADMIN-config
mutations in the codebase (Departments/Branches/Teams). Note:
`AUDIT_ACTIONS.CATEGORY_DELETED` and `SLA_RULE_DELETED` constants exist
(`audit-log.constants.ts:13-14`) but are unreachable dead code, since no
delete path exists for either entity — documented as docs/code drift, not a
defect (see Discovered Gaps).

## API Behavior

```
Frontend (settings-page.tsx / organization-sections.tsx: CategoriesSection, SlaSection)
  → settings-api.ts (getSettingCategories/createSettingCategory/updateSettingCategory/getSlaRules/putSlaRule)
  → apiClient (axios) → /api/settings/categories, /api/settings/sla-rules/:priority
  → settings.routes.ts (requireAuth, requireActiveUser, requireRole(ADMIN))
  → validateBody/validateParams/validateQuery (Zod, settings.schema.ts)
  → settings.controller.ts
  → settings.service.ts (createCategory/updateCategory/listCategories, listSlaRules/upsertSlaRule)
  → Prisma ($transaction wrapping the write + createAuditLog)
  → PostgreSQL (Category / SlaRule / AuditLog tables, unique constraints)
```

Downstream SLA consumption (owned elsewhere, shown for the boundary):

```
SlaRule row (isActive=true, keyed by priority)
  → ticket create / priority-change lookup (ticket.service.ts) — owned by Tickets
  → live-chat / portal ticket creation lookup — owned by Conversations/Channels, Tickets
  → firstResponseDueAt / resolutionDueAt snapshot on Ticket — owned by Tickets
  → breach detection/escalation — owned by Realtime (RT-GAP-1)
  → SLA reporting aggregates — owned by Dashboard/Reporting
```

## Frontend Behavior

- **Forms:** `CategoryEditorDialog` (create/edit) and inline `SlaCard`
  editors (one per priority, always rendered even when no rule exists yet).
- **Validation:** client-side mirrors server bounds for SLA
  (`first < 1 || resolution < first || first/resolution > 525600`) before
  submit, showing `settings.sla.validation` inline; category name/
  description length limits are enforced via `maxLength` on the inputs, with
  server-side 400s as the authoritative backstop.
- **Loading/error/empty states:** `CategoriesSection` renders distinct
  loading (`common.loading`), error-with-retry (`categories.loadError` +
  `refetch()`), no-search-results (`categories.noResults`), and true-empty
  (`categories.empty`) states — verified by
  `settings.test.tsx`/`organization-sections.test.tsx`.
- **Deactivate confirmation:** uses a portalled `role="alertdialog"`
  (`CategoryStatusDialog`), not `window.confirm` — verified by test
  (`"uses a portalled site dialog instead of window.confirm"`).
- **Submit/pending states:** both category and SLA mutations disable/show
  `isLoading` on their submit buttons while `mutation.isPending`.
- **Refetch/invalidation:** category mutations invalidate both
  `settingsKeys.all` and the separate `["categories"]` query key used by
  ticket-form category pickers, so a newly created/renamed/deactivated
  category is immediately reflected in ticket forms without a manual
  refresh — SLA mutations invalidate `settingsKeys.sla`.
- **i18n:** all strings observed are translation keys (`t("settings...")`);
  `en`/`ar` locale coverage was not exhaustively diffed key-by-key in this
  pass (see Deferred Scope) but no hardcoded user-facing string was found in
  the settings feature files inspected.
- No UI redesign performed; no broken frontend behavior found.

## Security / Edge Cases

**SLA:**
- Unauthorized role mutation → 403, enforced by `requireRole(ADMIN)` on the
  whole settings router (verified: MANAGER/AGENT/CUSTOMER all get 403 in
  `settings.test.ts`).
- Invalid priority (`INVALID`) → 400 via `slaPrioritySchema` (`z.nativeEnum`).
- Zero/negative/excessive durations → 400 via `.min(1).max(525_600)`.
- Resolution below first-response → 400 via cross-field `.refine()`.
- Deactivating a rule → tickets fall back to `null` deadlines on next
  lookup, not an error (see SLA semantics above).
- Missing rule → same safe `null`-deadline fallback, no 500/crash path.
- Concurrent upserts → single Prisma `upsert` statement, DB `@unique` on
  `priority` is authoritative; no read-modify-write race window in the
  service.
- Stale form submission → last-write-wins on `PUT`; no optimistic-concurrency
  token exists (not required — SLA rules are simple config, not
  collaboratively edited records like tickets).

**Categories:**
- Unauthorized mutation → 403 (same gate as SLA).
- Duplicate name (exact case) → 409 `CATEGORY_NAME_ALREADY_EXISTS`
  (`P2002` → `translateUnique`).
- Duplicate name (case-variant) → **was previously allowed** at the DB
  level (confirmed defect, now fixed — see Discovered Gaps /
  `SC-FOLLOWUP-001`); the service-level 409 mapping required no code change,
  identical to the `Customer.email` precedent.
- Whitespace-only name → 400 (trimmed to empty, fails `min(2)`).
- Invalid ID (`PATCH /categories/:bad-id`) → `databaseIdSchema` (`cuid`)
  rejects non-cuid IDs with 400 before the service layer runs.
- Inactive category selection on a ticket → 404
  `CATEGORY_NOT_FOUND`, not silently ignored (see Ticket Integration).
- Delete/deactivate while referenced → deactivate is safe (ticket keeps the
  link and displays the category); hard delete is impossible (no route
  exists), so "delete while referenced" cannot occur.
- Update race conditions → same last-write-wins `PATCH` model as SLA; no
  optimistic-concurrency token; acceptable for low-churn admin config.

## Discovered Gaps

- **`SC-FOLLOWUP-001` (data-integrity defect, fixed):** `Category.name`
  allowed case-variant duplicates (e.g., `"Billing"` and `"billing"` could
  both exist) despite the list/search endpoint treating names
  case-insensitively, creating confusing near-duplicate categories for
  ticket classification. Fixed with a hand-authored PostgreSQL functional
  unique index on `LOWER(name)` (migration
  `20260913172511_category_name_lower_unique`), mirroring the identical,
  already-shipped fix for `Customer.email`
  (`CUST-FOLLOWUP-001`/`20260912163955_customer_email_lower_unique`). No
  service code change was required — `createCategory`/`updateCategory`
  already map any `P2002` on `Category` to `409
  CATEGORY_NAME_ALREADY_EXISTS` via `translateUnique`. See `tasks.md`
  `SC-FOLLOWUP-001` for the regression test and verification detail.
- **Docs drift (corrected in this pass):** `specs/features/README.md`
  previously listed "SLA policy configuration" under "implemented in code,
  no dedicated SDD package" — updated to point at this package (see the
  Feature Coverage Matrix change in that file).
- **Architecture debt (not fixed, documented only):** `AUDIT_ACTIONS
  .CATEGORY_DELETED` and `SLA_RULE_DELETED` are declared but unreachable —
  no delete route exists for either entity. Harmless dead code; not worth a
  fast-track removal since deleting unused exported constants is out of
  scope for a brownfield pass with no behavior to verify.
- **Missing-test gap (fixed):** no test previously exercised the
  case-insensitive-conflict → 409 mapping for categories (there was no
  reason to, since the DB constraint didn't exist yet). Added alongside the
  fix.

No RBAC leak, no correctness defect in SLA deadline semantics, and no
data-integrity defect in category referential integrity were found beyond
the one item above.

## Deferred Scope

Not implemented in this codebase and deliberately out of scope for this
fast-track pass (per task instructions, not new findings):

- Business-hours/holiday calendars for SLA targets.
- Per-customer SLA policies.
- SLA rule versioning/history (only the current row per priority is kept;
  past values are recoverable only via `AuditLog.metadata`, which is
  already the existing mechanism — no dedicated history table exists or is
  proposed).
- Advanced policy inheritance (e.g., per-department or per-team SLA
  overrides) — SLA is global-per-priority only.
- Category hierarchy/taxonomy (categories are a flat, single-level list).
- Bulk category management (bulk create/import/merge).
- Exhaustive `en`/`ar` locale key-parity audit for the settings feature
  (spot-checked only; no missing-key defect found in the files inspected).

## Acceptance Criteria

- Given an ADMIN, when they `PUT /api/settings/sla-rules/:priority` with
  valid targets, then the rule is created or updated, an audit row is
  written only if a tracked field changed, and no existing ticket's
  deadlines are touched.
- Given a non-ADMIN (MANAGER/AGENT/CUSTOMER), when they call any
  `/api/settings/*` route, then the request is rejected with 403.
- Given an ADMIN, when they create a category whose name matches an
  existing category's name in a different case, then the request is
  rejected with `409 CATEGORY_NAME_ALREADY_EXISTS` (was previously
  incorrectly allowed — now fixed).
- Given a ticket create/update with a `categoryId` pointing at an inactive
  or nonexistent category, then the request is rejected with `404
  CATEGORY_NOT_FOUND`.
- Given a ticket whose priority changes while open, then its SLA deadlines
  are recalculated from the active rule for the new priority; given the
  same ticket with no priority change, editing that priority's SLA rule in
  Settings does not alter the ticket's existing deadlines.
- Given a category is deactivated, then it disappears from
  `/api/categories`/`/api/portal/categories` and cannot be assigned to new
  tickets, but tickets that already reference it keep displaying it.

## Cross-Feature Ownership Boundaries

| Concern | Owned by |
|---|---|
| SLA rule CRUD, validation, active/inactive config state | **this package** |
| Category CRUD, validation, active/inactive lifecycle | **this package** |
| SLA deadline snapshot on ticket create/priority-change | `specs/features/tickets/` |
| Automated breach detection/escalation | `specs/features/realtime/` (`RT-GAP-1`) |
| SLA reporting/aggregate math | `specs/features/dashboard-reporting/` |
| General ticket lifecycle, category-change history/audit on a ticket | `specs/features/tickets/` |
| AI category suggestion | `specs/features/ai-assistance/` |
| Category usage in reports/filters | `specs/features/dashboard-reporting/` |
