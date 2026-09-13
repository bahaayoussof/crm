# SLA Settings / Categories — Plan

Implemented — this was a brownfield discovery pass, not a greenfield build.
See `spec.md` for the authoritative behavior and `tasks.md` for
execution/verification status. This file records the implementation that
already existed and the plan for the one confirmed gap that was fixed.

## Existing implementation to reuse (all pre-existing, verified in place)

- **Backend:** `server/src/modules/settings/` (`settings.routes.ts`,
  `.controller.ts`, `.service.ts`, `.schema.ts`) owns SLA rule and category
  admin CRUD, mounted under `/api/settings` behind
  `requireAuth, requireActiveUser, requireRole(ADMIN)`.
- `server/src/modules/categories/category.routes.ts` — separate, read-only,
  internal (ADMIN/MANAGER/AGENT) category list for ticket forms.
- `server/src/modules/portal/portal.service.ts#categories` — separate
  CUSTOMER-only category list for the portal ticket form.
- Prisma `Category` and `SlaRule` models, both already correctly
  `@unique`-keyed (`name`, `priority`).
- `server/src/modules/audit-logs/audit-log.service.ts` (`createAuditLog`,
  `changedFields`) — reused as-is by settings.service.ts; no changes needed.
- **Frontend:** `client/src/features/settings/` (`settings-api.ts`,
  `settings-hooks.ts`, `organization-sections.tsx`'s `CategoriesSection`/
  `SlaSection`, `settings-page.tsx`), gated by
  `client/src/app/router/settings-route.tsx` (`SettingsRoute`).

No new abstraction was introduced; the existing service/controller/schema
split was already the correct shape for this domain.

## Backend architecture

No structural change. The one behavioral gap (case-sensitive category
uniqueness) was closed at the **database layer**, consistent with how the
identical `Customer.email` gap was closed
(`CUST-FOLLOWUP-001`/`20260912163955_customer_email_lower_unique`):

- Prisma's schema DSL cannot express a functional (expression) unique index,
  so `CREATE UNIQUE INDEX "Category_name_lower_key" ON "Category"
  ((LOWER(name)))` was hand-authored as migration
  `20260913172511_category_name_lower_unique`, coexisting with the existing
  plain `@unique` on `name`.
- `settings.service.ts#createCategory`/`updateCategory` already catch any
  Prisma `P2002` on `Category` and translate it to `409
  CATEGORY_NAME_ALREADY_EXISTS` (`translateUnique`) — this covers a
  violation of either index with zero code changes, exactly like the
  Customer precedent.
- A one-line comment was added above the `Category` model in
  `schema.prisma` pointing at the migration, so a future schema reader isn't
  surprised that `name` has two unique constraints.

## Frontend architecture

No change. Existing forms, loading/error/empty states, and role gating were
audited and found correct (see `spec.md` Frontend Behavior /
Role-Permission Matrix) — no UI defect was found, so no frontend code was
touched.

## Persistence constraints

- `SlaRule.priority @unique` — DB-guaranteed one-rule-per-priority; no
  application-level lock needed.
- `Category.name @unique` (exact-case) + new `Category_name_lower_key`
  functional index (case-insensitive) — DB is now the final authority for
  both uniqueness dimensions, same pattern as `Customer.email`.
- No delete path exists for either model; deactivation
  (`isActive: false`) is the only removal mechanism, which is what keeps
  `Ticket.categoryId` referential integrity trivially safe (nothing can ever
  null out a referenced category via this package).

## Authorization strategy

Already correct, verified, unchanged:
`/api/settings/*` → ADMIN only; `/api/categories` → ADMIN/MANAGER/AGENT
(ticket-form use); `/api/portal/categories` → CUSTOMER only, on the
separately-authorized portal router. Frontend `SettingsRoute` and sidebar
visibility both match. No authorization code was changed.

## SLA-consumer integration

Documented, not modified: `ticket.service.ts` (create + priority-change),
`live-chat.service.ts`, and `portal.service.ts` each independently do
`slaRule.findFirst({ where: { priority, isActive: true } })` and fall back
to `null` deadlines when no active rule exists. This is accepted, documented
duplication (three call sites doing the identical lookup) rather than
architecture debt requiring a fix — see `spec.md` Discovered Gaps for why it
wasn't centralized (out of scope for a fast-track pass; would require
touching Tickets/Realtime/Conversations-Channels code with no defect to
justify it).

## Category-consumer integration

Documented, not modified: ticket create/update and portal ticket create both
independently enforce `{ id, isActive: true }` before accepting a
`categoryId`, both returning `404 CATEGORY_NOT_FOUND` on failure. Same
accepted-duplication note as above.

## Audit strategy

No change — both mutation paths already write a change-gated `AuditLog` row
inside the same transaction as the data write (see `spec.md` Audit
Behavior table). Confirmed there's no bypass.

## Testing strategy

- Added one regression test (`SC-FOLLOWUP-001`) to
  `server/src/modules/settings/settings.test.ts` asserting that a simulated
  `P2002` with `meta.target: ["lower(name)"]` (the exact shape Postgres
  raises for the new functional index; confirmed by cross-referencing the
  identical Customer precedent's documented reproduction, not by a live
  Postgres run in this environment — see Verification Strategy) still
  produces `409 CATEGORY_NAME_ALREADY_EXISTS`.
- No other test gaps rose to the fast-track bar: existing coverage for
  RBAC (`rejects <role>` for every mutating route), validation (SLA bounds,
  category name bounds), audit-on-change, and activation-toggle-not-delete
  was already present and passing.

## Verification strategy

Automated-test verified (see `tasks.md` for exact commands/results):
server settings unit/integration tests, server ticket/portal/live-chat
integration tests (SLA + category consumers), server `tsc`/`eslint`, client
settings component tests, client `tsc`/`eslint`, `git diff --check`.

Source-inspection verified: RBAC gate placement, upsert/no-delete semantics,
existing-ticket deadline non-recalculation on config edit, category active-
enforcement on ticket assignment, audit change-gating, frontend
loading/error/empty states and role-gated route/sidebar visibility.

**Not performed:** no live PostgreSQL instance was available in this
environment to apply the new migration and reproduce a real `P2002` with
`lower(name)` in its `meta.target`. This mirrors the residual-verification
caveat the Customer precedent explicitly called out before its own
dev-database confirmation step — here, the migration is written and the
regression test proves the code's *reaction* to that exact conflict shape,
but the migration itself has not been applied/rolled back against a real
database in this pass. Flagged as a pending step in `tasks.md`.

## Confirmed-gap implementation plan (only work performed)

1. Add hand-authored migration for `Category_name_lower_key` (done).
2. Add a one-line schema comment pointing at it (done).
3. Add the regression test proving the existing `P2002` catch already
   covers the new constraint (done) — no service code change needed.
4. Update `specs/features/README.md`'s Feature Coverage Matrix and remove
   "SLA policy configuration" from the "no dedicated SDD package" list
   (done).

No other code was changed.

## Risks / trade-offs

- The new functional index has not been applied against a live database in
  this pass (see Verification Strategy) — low risk, since it is additive
  (a new index, no column/type change) and mirrors an already-shipped,
  already-verified pattern in this same schema.
- Duplicated SLA-lookup and category-active-check logic across
  Tickets/Live-Chat/Portal remains un-centralized — accepted architecture
  debt, not fixed, consistent with this pass's fast-track scope.
- `CATEGORY_DELETED`/`SLA_RULE_DELETED` audit-action constants are dead code
  — left in place; removing unused exports was judged out of scope for a
  brownfield pass with no behavior to verify.
