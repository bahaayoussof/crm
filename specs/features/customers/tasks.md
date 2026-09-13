# Customers — Task Breakdown

Decomposition of [`plan.md`](./plan.md) into small,
independently verifiable tasks. Source of truth for scope is
[`spec.md`](./spec.md) `## Discovered Gaps` (DG-1, DG-2) and `plan.md`. This
file adds **no new decisions** — every task is anchored to an
already-resolved plan decision.

Status: `IMPLEMENTED + VERIFIED ON SDD BRANCH` — all tasks below are complete; see each task's entry and the `Human Verification` / `CUST-FOLLOWUP-001` sections for evidence.

---

## Scope Guard

Implementation of this task set is a **brownfield fix for exactly two
confirmed gaps.** It must **not** introduce, and any PR that does must be
rejected in review, unless `spec.md` **and** `plan.md` are first explicitly
revised and re-approved:

- any redesign of the Customers module, its routes, RBAC, or response
  shapes
- `Customer` becoming team-scoped in any way (it stays global; OD-6 stays
  confined to `GET /:id/tickets`)
- any edit or delete capability for `CustomerNote` (stays append-only)
- any change to how `Customer.userId` is created/linked (self-registration,
  portal profile edit, manual-create-forces-`null`)
- any inbound-channel **update** path for an existing `Customer` (none
  exists today — do not add one as part of "DG-1 covers update too")
- any Prisma schema change, `server/prisma/**` edit, or migration (no
  `citext`, no functional unique index, no collation change)
- any deduplication/merge/backfill of existing case-variant `Customer` rows
  already in the database
- any new runtime or dev dependency / lockfile change
- any frontend (`client/**`) change
- any new `AUDIT_ACTIONS`/`AUDIT_ENTITY_TYPES` constant (DG-1 reuses the
  existing `CUSTOMER_CREATED` / `CUSTOMER` constants verbatim)

The **only** production behaviour change allowed by this task set:

- write one `CUSTOMER_CREATED` `AuditLog` row (`actorId: null`) when the
  Email, SMS, or WhatsApp inbound handler **creates** a new `Customer` (DG-1)
- make the manual create/update duplicate-email pre-check
  case-insensitive, reusing the existing `mode: "insensitive"` convention
  (DG-2)

---

## Implementation Discipline (for later agents)

Implement **one task at a time**. Do not chain tasks.

For each task:

1. Read `specs/features/customers/spec.md`.
2. Read `specs/features/customers/plan.md`.
3. Read this `tasks.md`.
4. Inspect the actual target files in the repo (do not implement from the
   plan text alone — line numbers/quotes in the plan are a pointer, not a
   guarantee against drift).
5. Implement only the selected task.
6. Run that task's **Verification** commands/checks.
7. Report files changed, commands run, and results. Show a suggested
   commit message; do **not** commit, stage, push, merge, rebase, or amend.
8. Do **not** proceed to the next task unless explicitly instructed.

If inspection contradicts the plan (e.g. an inbound handler turns out to
also update an existing customer, or `AuditLog.actorId` turns out to be
non-nullable) — **stop and report**, do not expand scope to absorb the
contradiction.

---

## Task List

- [x] CUST-001 — Case-insensitive duplicate-email pre-check for manual create/update (DG-2)
- [x] CUST-002 — DG-2 regression tests
- [x] CUST-003 — Audit inbound email customer creation (DG-1)
- [x] CUST-004 — Audit inbound SMS customer creation (DG-1) + minimal test infra
- [x] CUST-005 — Audit inbound WhatsApp customer creation (DG-1)
- [x] CUST-006 — DG-1 regression tests (email, SMS, WhatsApp audit + no-audit-on-match)
- [x] CUST-007 — Documentation reconciliation
- [x] CUST-008 — Final verification and implementation-readiness report

---

## Dependency Model

```
CUST-001 ──► CUST-002

CUST-003 ─┐
CUST-004 ─┼──► CUST-006
CUST-005 ─┘

(CUST-001..006) ──► CUST-007 ──► CUST-008
```

- **CUST-001 → CUST-002**: tests are written against the implemented
  pre-check behaviour.
- **CUST-003 / 004 / 005 are independent** of each other and of the
  DG-2 pair — three different files, three different modules. May be done
  in any order or in parallel.
- **CUST-006** depends on all three DG-1 implementation tasks (it asserts
  their combined behaviour, one file per channel).
- **CUST-007** needs all implementation tasks done so docs describe
  reality.
- **CUST-008** is the gate — depends on everything.

---

## CUST-001 — Case-insensitive duplicate-email pre-check for manual create/update (DG-2)

**Files:** `server/src/modules/customers/customer.service.ts`

[x] Done — `createCustomer`'s pre-check changed from exact-match `findUnique` to `findFirst` with `mode: "insensitive"` (reusing the exact convention `email.service.ts matchOrCreateCustomer` already used). `updateCustomer` gained a new case-insensitive `findFirst` pre-check (it previously had none), excluding the current row via `NOT: { id: customerId }`. Both still throw the existing `duplicateEmailError()` → `409 CUSTOMER_EMAIL_EXISTS`; the existing `P2002` catch in both functions is unchanged as the defensive race fallback. No schema/`createCustomerSchema`/response-shape change.

Verification: `npx tsc --noEmit`, `npm run lint`, `npx vitest run src/modules/customers` all clean (see CUST-008 for aggregate run). `git diff` confined to the two pre-check blocks.

Notes/Risk: None — DG-1/inbound-channel files untouched.

---

## CUST-002 — DG-2 regression tests

**Files:** `server/src/modules/customers/customer.test.ts` · **Depends on:** CUST-001

[x] Done — Added: case-insensitive conflict on create (existing row differs only by case → `409`, `prisma.customer.create` never called, pre-check asserted to use `mode: "insensitive"`); same conflict via `PATCH`; self-update exclusion (submitting the same customer's own email, same or different case, succeeds — pre-check asserted to include `NOT: { id }`). Existing exact-case "creates a normalized customer" / duplicate-email tests kept passing unchanged.

Verification: `npx vitest run src/modules/customers/customer.test.ts` green. `git status` showed only `customer.test.ts` changed.

Notes/Risk: No production code changed by this task.

---

## CUST-003 — Audit inbound email customer creation (DG-1)

**Files:** `server/src/modules/integrations/email/email.service.ts`

[x] Done — `matchOrCreateCustomer`'s create branch (no-match only) now calls `createAuditLog({ actorId: null, action: CUSTOMER_CREATED, entityType: CUSTOMER, entityId, changes: { name: {to}, email: {to} } }, tx)` inside the existing transaction. The `findFirst` match branch (existing customer reused) writes no audit row. `actorId: null` (SYSTEM) — deliberately not `ensureSystemUser`'s ticket-message-author `User` id. `requestContext` (IP/UA) intentionally omitted, per `plan.md` — a deferred follow-up, not part of this fix.

Verification: `npx vitest run src/modules/integrations/email` green (response shape/ticket-creation unaffected); code read confirmed exactly one `createAuditLog` call site, inside the `create` branch and existing `tx`.

Notes/Risk: None.

---

## CUST-004 — Audit inbound SMS customer creation (DG-1) + minimal test infra

**Files:** `server/src/modules/integrations/sms/sms.service.ts`, `server/src/modules/integrations/sms/sms.test.ts`

[x] Done — Same audit-write shape as CUST-003, added inside `processInboundSms`'s inline `if (!customer)` create branch (`changes`: name/phone/the `sms-<digits>@no-email.invalid` placeholder email). No audit on a matched customer. `sms.test.ts` previously had no prisma mock and did not exercise `processInboundSms` at all; added minimal `vi.mock` scaffolding (mirroring `whatsapp.test.ts`: customer/user/ticket/ticketMessage/slaRule/notification/auditLog mocks + function-form `$transaction`) so the create+audit path is now testable.

Verification: `npx vitest run src/modules/integrations/sms` green (new + existing provider/signature tests); code read confirmed exactly one `createAuditLog` call site in the create branch.

Notes/Risk: Test-infra addition was scoped to what CUST-006 needed to assert, not a full behavioural suite for SMS ticket creation.

---

## CUST-005 — Audit inbound WhatsApp customer creation (DG-1)

**Files:** `server/src/modules/integrations/whatsapp/whatsapp.service.ts`

[x] Done — Same audit-write shape as CUST-003/004, added only after the final no-match `create` return of `matchOrCreateCustomer` (the two earlier match-return points — phone match, placeholder-email match — are untouched and write no audit row).

Verification: `npx vitest run src/modules/integrations/whatsapp` green; code read confirmed exactly one `createAuditLog` call site at the final `create` return.

Notes/Risk: None.

---

## CUST-006 — DG-1 regression tests (email, SMS, WhatsApp audit + no-audit-on-match)

**Files:** `email.test.ts`, `sms.test.ts`, `whatsapp.test.ts` (integrations) · **Depends on:** CUST-003, CUST-004, CUST-005

[x] Done — Each channel: extended the existing customer-creation test with an assertion that the audit mock fired exactly once with `action: CUSTOMER_CREATED`, `entityType: CUSTOMER`, `actorId: null`, and correct `changes`; extended the existing match-branch test(s) with a "no audit row" assertion. SMS additionally asserts a duplicate `externalId` redelivery does no ticket/customer/audit work at all (existing idempotency short-circuit still holds).

Verification: `npx vitest run src/modules/integrations` — all three suites green. `git status` showed only the three test files changed.

Notes/Risk: No production code changed by this task.

---

## CUST-007 — Documentation reconciliation

**Files:** `specs/features/customers/spec.md`

[x] Done — Updated spec.md's DG-1/DG-2 entries, the "Duplicate/parallel Customer-mutation paths outside this module" table's prose, and "Current Tests" to describe the implemented (audited, case-insensitive) behaviour. `docs/06-auth-rbac.md`, `docs/05-api-contract.md`, and `docs/18-ui-pages-spec.md` were re-checked at implementation time and confirmed to need no change — neither gap touches RBAC, routes, or response shapes they document. No new ADR added to `docs/17-decisions-log.md` — neither fix rose to that bar.

Verification: `git diff specs/ docs/` confined to `spec.md`; no `server/src/**`, `server/prisma/**`, `client/**`, or dependency file touched.

Notes/Risk: None.

---

## CUST-008 — Final verification and implementation-readiness report

[x] Done — Confirmed by diff/status inspection: no `client/**` change, no `server/prisma/**`/migration, no dependency/lockfile change, no new `AUDIT_ACTIONS`/`AUDIT_ENTITY_TYPES` constant, Customers routes/RBAC/response shapes unchanged, Customers still global (no `teamId`; OD-6 still confined to `GET /:id/tickets`), `CustomerNote` still has no edit/delete route. All three inbound channels confirmed create → one audit row, match → none; manual create/update case-insensitive duplicate detection confirmed both directions with self-update exclusion; existing exact-case detection still works. DG-1 and DG-2 both confirmed fixed against `spec.md`.

Verification: `npx tsc --noEmit`, `npm run lint`, `npx vitest run src/modules/customers` (29 passed), `npx vitest run src/modules/integrations` (54 passed: email 16, sms 11, whatsapp 27), `npx vitest run src/modules/audit-logs`, `npm run build` — all clean. `git diff --check` clean; working tree left unstaged/uncommitted as required (no commit/push/merge/rebase performed).

Notes/Risk: Residual risk carried forward at this point — same-case-insensitive concurrent-write race (see `Human Verification` below), later closed by `CUST-FOLLOWUP-001`.

---

## Human Verification (2026-09-12, same branch, uncommitted)

**Status: `IMPLEMENTED + VERIFIED ON SDD BRANCH`.**

- **Prisma:** stale dev-server processes holding the Windows Prisma engine file lock were killed; `npx prisma generate` then succeeded cleanly. Schema unchanged (no migration).
- **Automated regression:** `customer.test.ts` + `email.test.ts` + `sms.test.ts` + `whatsapp.test.ts` → **83/83 passed** (customer 29, email 16, sms 11, whatsapp 27).
- **Manual smoke (real dev Postgres, no browser available):** a throwaway `tsx` script (not committed, deleted after the run) called the real service functions (`createCustomer`, `updateCustomer`, `processInboundEmail`, `processInboundSms`, `processInboundTextMessage`) directly against the dev database with unique per-run emails/phone numbers; all rows created were deleted afterward — DB left as found.
  - DG-2 create (case-variant email vs. an existing row) → `409 CUSTOMER_EMAIL_EXISTS`. PASS.
  - DG-2 update (case-variant email vs. a different existing row) → `409 CUSTOMER_EMAIL_EXISTS`. PASS.
  - DG-1 email/SMS/WhatsApp, new customer → exactly one `CUSTOMER_CREATED` row each. PASS x3.
  - DG-1 email/SMS/WhatsApp, matched (repeat) sender → no new row each. PASS x3.
  - **Result: 8/8 PASS.** No production code changed by this pass — the smoke revealed no bug.
- **Residual risks (carried forward into `CUST-FOLLOWUP-001`):**
  - Same-case-insensitive concurrent-write race (e.g. `A@x.com` and `a@x.com` inserted in the same window) was not DB-constrained and not exercised by this smoke (requires real concurrency) — accepted at the time, closed below.
  - Smoke exercised service functions directly, not the HTTP/webhook layer or a browser (none available) — route-level auth/validation/provider payload parsing are unchanged and already covered by the existing controller/webhook suites.
  - No new automated test added for this manual pass by design; permanent coverage is the existing suites above.
- No stage/commit/push/merge/rebase/amend performed.

---

## CUST-FOLLOWUP-001 — DB-enforced case-insensitive customer email uniqueness (implemented, closes the residual race above)

**Files:** `server/prisma/migrations/20260912163955_customer_email_lower_unique/migration.sql` (new, hand-authored — Prisma schema DSL cannot express a functional/expression index); `server/src/modules/customers/customer.test.ts` (new regression tests); `specs/features/customers/spec.md` (DG-2 + data-model + tests updated).

[x] Done — Makes PostgreSQL the final authority for case-insensitive `Customer.email` uniqueness, closing the residual risk accepted above (two concurrent manual creates/updates differing only by email casing could both pass the application-level pre-check before either committed, since the DB constraint was case-sensitive). Added a PostgreSQL functional unique index, `CREATE UNIQUE INDEX "Customer_email_lower_key" ON "Customer" ((LOWER(email)))`, alongside the unchanged schema-declared `@unique` on `Customer.email` (the two constraints coexist; the functional one is a stricter superset). No `customer.service.ts` change was needed — the existing `P2002` catch blocks already map any unique-constraint violation on `Customer` to `409 CUSTOMER_EMAIL_EXISTS` regardless of which index fired (confirmed live against the real dev DB: a functional-index violation still raises `P2002` with `meta.target: ["lower(email)"]`). No routes/RBAC/response-shape/constant/client change.

Verification (real dev database, `chore/sdd-foundation`):
- Duplicate scan (`SELECT LOWER(email), COUNT(*) ... HAVING COUNT(*) > 1`) → 0 duplicate groups — safe to add the index with no data cleanup.
- `prisma migrate dev --create-only` → hand-edited with the `CREATE UNIQUE INDEX` statement → `prisma migrate deploy` applied cleanly → `prisma migrate status` confirms up to date → `prisma generate` succeeded.
- Live P2002 reproduction: second create with the same email upper-cased → rejected with `P2002`, `meta.target: ["lower(email)"]` — confirms no code change needed.
- `npx vitest run src/modules/customers` → **31/31 passed**, including two new race-simulation tests (create + update) that stub the app-level pre-check to miss and the underlying Prisma call to reject with the same `P2002`/`lower(email)` shape, proving the DB constraint — not just the app pre-check — prevents two case-variant rows from coexisting.
- `npx vitest run src/modules/integrations src/modules/audit-logs` → 79/79 passed (regression, unaffected).
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, `git diff --check` — all clean.

Notes/Risk: No residual risk for this specific race. A real-Postgres concurrency test was not added to the permanent suite — this project's `src/test/setup.ts` pins `DATABASE_URL` to a local placeholder during `vitest run`, so the suite never touches the real dev database; the real-database proof (duplicate scan + live P2002 reproduction) was performed directly during implementation instead, and the permanent regression test simulates the exact failure shape that proof captured. Same manual-plus-mocked verification split already used for DG-1/DG-2.
