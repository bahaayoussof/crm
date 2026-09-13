# SLA Settings / Categories — Tasks

Status: `IMPLEMENTED + VERIFIED (committed on chore/sdd-foundation)` —
brownfield discovery complete; one confirmed gap fixed with regression
coverage; all other behavior documented as-is with no code change.

Task IDs use the `SC-` prefix (SLA Settings / Categories).

---

[x] SC-001 — Discover and document SLA rule semantics (unique key, upsert/no-delete, active/inactive, validation, audit)
Affected: `server/src/modules/settings/*.ts` (read-only inspection)
Verification: source-inspection verified; documented in `spec.md` "SLA Policy Semantics"
Notes/Risk: none — no defect found

[x] SC-002 — Discover and document category lifecycle (create/update/deactivate, no hard delete, active enforcement, uniqueness)
Affected: `server/src/modules/settings/*.ts`, `server/src/modules/categories/category.routes.ts` (read-only inspection)
Verification: source-inspection verified; documented in `spec.md` "Category Lifecycle"
Notes/Risk: uniqueness gap found → see SC-FOLLOWUP-001

[x] SC-003 — Verify existing-ticket impact of editing an SLA rule (no retroactive recalculation)
Affected: `server/src/modules/settings/settings.service.ts`, `server/src/modules/tickets/ticket.service.ts` (read-only inspection)
Verification: source-inspection verified — `upsertSlaRule` touches only the `SlaRule` table; ticket deadlines are snapshotted only at ticket creation and at priority-change (`ticket.service.ts:347-359`, `447-450`). Documented in `spec.md` "Existing-Ticket Impact"
Notes/Risk: none — matches Tickets spec, no docs/runtime drift found

[x] SC-004 — Build and verify Role/Permission matrix for SLA + category admin vs. internal list vs. portal list
Affected: `server/src/modules/settings/settings.routes.ts`, `server/src/modules/categories/category.routes.ts`, `server/src/modules/portal/portal.routes.ts`, `client/src/app/router/settings-route.tsx`, `client/src/app/layouts/sidebar/sidebar.test.tsx`
Verification: source-inspection verified (route-level `requireRole` gates) + existing automated tests: `settings.test.ts` (`requires authentication`, `rejects %s` for MANAGER/AGENT/CUSTOMER), `portal.test.ts` (`returns active safe categories only`), `sidebar.test.tsx` (Settings link shown for ADMIN, hidden otherwise)
Notes/Risk: none — frontend visibility matches server authorization, no leak found

[x] SC-005 — Verify ticket-integration enforcement of active category on create/update (internal + portal)
Affected: `server/src/modules/tickets/ticket.service.ts:721-722`, `server/src/modules/portal/portal.service.ts:89-91` (read-only inspection)
Verification: source-inspection verified — both paths require `{ id, isActive: true }` and throw `404 CATEGORY_NOT_FOUND` otherwise; confirmed by existing `ticket.test.ts`/`portal.test.ts` coverage
Notes/Risk: none

[x] SC-006 — Verify audit coverage for all four config-mutation paths (category create/update, SLA create/update)
Affected: `server/src/modules/settings/settings.service.ts` (read-only inspection)
Verification: source-inspection verified — each path writes a change-gated `AuditLog` row in the same transaction (`CATEGORY_CREATED/UPDATED`, `SLA_RULE_CREATED/UPDATED`)
Notes/Risk: `CATEGORY_DELETED`/`SLA_RULE_DELETED` constants are unreachable dead code (no delete route exists) — documented as architecture debt, not fixed (out of fast-track scope)

[x] SC-FOLLOWUP-001 — Fix confirmed data-integrity gap: case-insensitive `Category.name` uniqueness not enforced at DB level
Affected: `server/prisma/schema.prisma` (comment only), `server/prisma/migrations/20260913172511_category_name_lower_unique/migration.sql` (new), `server/src/modules/settings/settings.test.ts` (new regression test)
Goal: close the case-variant duplicate-category-name gap the same way `CUST-FOLLOWUP-001` closed it for `Customer.email` — a hand-authored functional unique index on `LOWER(name)`, with no service-code change since the existing `P2002` catch (`translateUnique`) already maps any unique violation on `Category` to `409 CATEGORY_NAME_ALREADY_EXISTS`.
Verification:
- Automated-test verified: new test `"maps a case-insensitive name conflict (DB functional unique index on LOWER(name)) to 409"` in `settings.test.ts` — simulates the exact Postgres `P2002`/`meta.target: ["lower(name)"]` shape and asserts `409 CATEGORY_NAME_ALREADY_EXISTS`. Ran `npx vitest run src/modules/settings/settings.test.ts` → **17/17 passed**.
- Automated-test verified (no regression): `npx vitest run src/modules/tickets/ticket.test.ts src/modules/portal/portal.test.ts src/modules/live-chat/live-chat.test.ts` → **227/227 passed**.
- Automated-test verified: server `npx tsc --noEmit` → clean (no errors). Server `npx eslint src/modules/settings src/modules/categories` → clean.
- Automated-test verified: client `npx vitest run src/features/settings/` → **19/19 passed**. Client `npx tsc --noEmit` → clean. Client `npx eslint src/features/settings` → clean.
- Automated-test verified: `git diff --check` → clean (no whitespace errors).
- **Not performed / explicitly not claimed:** live-database verification. The migration SQL was written and reviewed but not applied against a real PostgreSQL instance in this environment (none was available), so the actual `CREATE UNIQUE INDEX ... (LOWER(name))` statement and a real conflicting insert have not been executed end-to-end here. This is a pending step, consistent with how `CUST-FOLLOWUP-001` required (and got) a real dev-database pass before being marked fully closed.
Notes/Risk: additive index only (no column/type change, no data migration); mirrors an already-shipped, already-verified pattern (`Customer_email_lower_key`) in the same schema — low risk. Recommend applying `npx prisma migrate deploy` (or `migrate dev`) against a disposable Postgres before merge, exactly as `CUST-FOLLOWUP-001`'s tasks entry did, to move this from "automated-test verified" to "live-DB verified."

[x] SC-007 — Update Feature Coverage Matrix in `specs/features/README.md`
Affected: `specs/features/README.md`
Goal: add "SLA Settings / Categories" row with truthful status; remove "SLA policy configuration" from the "implemented in code, no dedicated SDD package" list (Categories was never separately listed there — only SLA was — so only that one line item needed removal)
Verification: source-inspection verified (file diff reviewed manually); no other feature's status line altered

---

## Final Verification Summary

| Check | Command | Result |
|---|---|---|
| Server settings tests | `cd server && npx vitest run src/modules/settings/settings.test.ts` | 17/17 passed |
| Server ticket/portal/live-chat integration tests | `cd server && npx vitest run src/modules/tickets/ticket.test.ts src/modules/portal/portal.test.ts src/modules/live-chat/live-chat.test.ts` | 227/227 passed |
| Server typecheck | `cd server && npx tsc --noEmit` | clean |
| Server lint (settings + categories) | `cd server && npx eslint src/modules/settings src/modules/categories` | clean |
| Client settings tests | `cd client && npx vitest run src/features/settings/` | 19/19 passed |
| Client typecheck | `cd client && npx tsc --noEmit` | clean |
| Client lint (settings) | `cd client && npx eslint src/features/settings` | clean |
| Whitespace/diff check | `git diff --check` | clean |
| Live PostgreSQL migration apply | — | **not performed** (no DB instance available in this environment) |

No broader full-suite run was performed beyond the targeted files above (out
of fast-track scope; targeted coverage is sufficient given zero production
service-code changes were made — only a new migration, a schema comment, and
one new test).
