# Customers — Task Breakdown

Decomposition of [`plan.md`](./plan.md) (`READY FOR TASKS`) into small,
independently verifiable tasks. Source of truth for scope is
[`spec.md`](./spec.md) `## Discovered Gaps` (DG-1, DG-2) and `plan.md`. This
file adds **no new decisions** — every task is anchored to an
already-resolved plan decision.

Creating this file changes no production code, no schema, no dependency,
and no test. No task below is started or complete.

Status: `IMPLEMENTED + VERIFIED ON SDD BRANCH`

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

### Goal
Stop a manual `POST /customers` or `PATCH /customers/:id` from silently
creating a second `Customer` row that differs from an existing row only by
email casing (e.g. an inbound-email-created `Ahmed@Example.com` vs. a
manually entered `ahmed@example.com`).

### Depends On
None

### Expected Files
- `server/src/modules/customers/customer.service.ts`

### Requirements
- `createCustomer`: replace the pre-check
  `prisma.customer.findUnique({ where: { email: input.email }, select: { id: true } })`
  with
  `prisma.customer.findFirst({ where: { email: { equals: input.email, mode: "insensitive" } }, select: { id: true } })`.
  Same `if (existing) throw duplicateEmailError()` behaviour; same
  `409 CUSTOMER_EMAIL_EXISTS` error.
- `updateCustomer`: when `input.email !== undefined`, add a pre-check of
  the same shape **before** the transaction's `tx.customer.update`:
  `prisma.customer.findFirst({ where: { email: { equals: input.email, mode: "insensitive" }, NOT: { id: customerId } }, select: { id: true } })`
  → `if (existing) throw duplicateEmailError()`. `updateCustomer` today has
  **no** pre-check for email conflicts at all (only the `P2002` catch) —
  this is new, not a modification of an existing check.
- Keep the existing `P2002` catch block in both functions **unchanged** as
  the defensive fallback for a genuine race.
- No change to `createCustomerSchema` / `updateCustomerSchema` (input-side
  lowercasing via `emailSchema` already works).
- No change to response shape, status codes, or the `404`/`P2025` path.
- Reuse the exact `mode: "insensitive"` convention already used by
  `email.service.ts matchOrCreateCustomer` — do not invent a different
  case-folding mechanism (no `.toLowerCase()` comparison in JS, no new
  helper function).

### Out of Scope
- Any DB/migration change.
- Deduplicating existing rows.
- DG-1 / inbound-channel files.
- Tests (CUST-002).

### Verification
- `cd server && npx tsc --noEmit` — clean.
- `cd server && npm run lint` — clean.
- `cd server && npx vitest run src/modules/customers` — existing suite
  still green (exact-case duplicate test, normalization test, update
  tests all unchanged in behaviour).
- Manual code read: `createCustomer` and `updateCustomer` each use
  `findFirst` with `mode: "insensitive"`; `updateCustomer`'s check excludes
  the current row via `NOT: { id: customerId }`; both still throw
  `duplicateEmailError()`; `P2002` catch blocks untouched.
- `git diff` — change confined to the two pre-check blocks in
  `customer.service.ts`; no schema/migration/dependency/client change.

### Definition of Done
- A manual create whose (already-lowercased) email matches an existing
  row differing only in case → `409 CUSTOMER_EMAIL_EXISTS`, no new row
  created.
- A manual update whose new email matches a *different* existing row
  differing only in case → `409 CUSTOMER_EMAIL_EXISTS`.
- A manual update that re-submits a customer's *own* email (same or
  different case) does **not** conflict with itself.
- Exact-case duplicate detection (today's behaviour) still works
  identically.
- Server typecheck, lint, and existing Customers tests pass.

---

## CUST-002 — DG-2 regression tests

### Goal
Prove the case-insensitive duplicate-email fix with explicit tests, and
prove the self-update exclusion works.

### Depends On
`CUST-001`

### Expected Files
- `server/src/modules/customers/customer.test.ts`

### Requirements
- **Create**: mock the `findFirst` pre-check to return an existing row
  (simulating a pre-existing case-variant email, e.g. as if created via
  the inbound email path) → assert `409 CUSTOMER_EMAIL_EXISTS` and that
  `prisma.customer.create` is **never** called. Assert the mock was called
  with a `mode: "insensitive"` where-clause.
- **Update**: same scenario via `PATCH /customers/:id` with a changed
  `email` → `409 CUSTOMER_EMAIL_EXISTS`.
- **Update, self-exclusion**: `PATCH` where the submitted email matches
  the *same* customer's current row (case-different or identical) →
  succeeds (`200`), no conflict. Assert the pre-check query included
  `NOT: { id: <that customer's id> }`.
- **Regression**: re-run/keep the existing "creates a normalized customer"
  and "returns a conflict for a duplicate customer email" (exact-case)
  tests — they must still pass unchanged.
- Do not duplicate unrelated existing Customers test coverage (OD-6,
  RBAC, notes, delete) — this task only touches email-conflict tests.

### Out of Scope
- Any production-code change (if a test reveals a further bug, log it per
  the bug-logging rule and route the fix back to CUST-001, not here).
- DG-1 tests.

### Verification
- `cd server && npx vitest run src/modules/customers/customer.test.ts` —
  all new and existing cases green.
- `cd server && npx tsc --noEmit` — clean.
- `cd server && npm run lint` — clean.
- `git status` — only `customer.test.ts` changed.

### Definition of Done
- Case-insensitive conflict on create and on update both covered and
  green.
- Self-update exclusion covered and green.
- Existing exact-case tests still pass.
- No production code changed by this task.

---

## CUST-003 — Audit inbound email customer creation (DG-1)

### Goal
Record exactly one `CUSTOMER_CREATED` `AuditLog` row when the inbound
email handler creates a new `Customer`, atomically with the create.

### Depends On
None

### Expected Files
- `server/src/modules/integrations/email/email.service.ts`

### Requirements
- In `matchOrCreateCustomer`, after `tx.customer.create({ data: { name, email }, ... })`
  succeeds (the no-match branch only), call
  `createAuditLog({ actorId: null, action: AUDIT_ACTIONS.CUSTOMER_CREATED, entityType: AUDIT_ENTITY_TYPES.CUSTOMER, entityId: <created customer id>, changes: { name: { to: name }, email: { to: email } } }, tx)`
  — reuse the constants already imported/used elsewhere for Customers; add
  the `createAuditLog`/`AUDIT_ACTIONS`/`AUDIT_ENTITY_TYPES` imports to this
  file if not already present.
- Do **not** add an audit call on the `findFirst` match branch (existing
  customer reused) — only on `create`.
- The call stays inside the existing `prisma.$transaction` callback that
  already wraps `matchOrCreateCustomer`'s caller (`processInboundEmail`) —
  do not open a second transaction.
- `actorId: null` (SYSTEM), exactly as `createAuditLog` already supports —
  do not reuse `ensureSystemUser`'s ticket-message-author `User` id as the
  actor.
- `requestContext` omitted (not threaded from the webhook controller in
  this task — see `plan.md` "Request context").
- No change to `email.service.ts`'s webhook response shape, status codes,
  ticket-creation logic, or any other function in the file.

### Out of Scope
- SMS / WhatsApp files (CUST-004 / CUST-005).
- Any request-context (IP/UA) plumbing from the webhook controller.
- Tests (CUST-006).

### Verification
- `cd server && npx tsc --noEmit` — clean.
- `cd server && npm run lint` — clean.
- `cd server && npx vitest run src/modules/integrations/email` — existing
  suite still green (response shape / ticket-creation assertions
  unchanged).
- Manual code read: exactly one `createAuditLog` call site, inside the
  `create` branch of `matchOrCreateCustomer`, inside the existing `tx`.
- `git diff` — change confined to `matchOrCreateCustomer` (+ imports); no
  schema/migration/dependency/client change.

### Definition of Done
- A new inbound-email customer creates exactly one `CUSTOMER_CREATED`
  audit row with `actorId: null`, correct `entityId`, and `name`/`email`
  `to`-only changes.
- A matched (pre-existing) customer produces **no** audit row.
- Audit write is atomic with the customer create (same transaction).
- Server typecheck, lint, and existing email-integration tests pass.

---

## CUST-004 — Audit inbound SMS customer creation (DG-1) + minimal test infra

### Goal
Record exactly one `CUSTOMER_CREATED` `AuditLog` row when the inbound SMS
handler creates a new `Customer`, and give `processInboundSms` the minimal
prisma-mock test infrastructure it currently lacks so this (and future)
behaviour is actually testable.

### Depends On
None

### Expected Files
- `server/src/modules/integrations/sms/sms.service.ts`
- `server/src/modules/integrations/sms/sms.test.ts`

### Requirements
- In `processInboundSms`, after the inline
  `customer = await tx.customer.create({ data: { name: phone, phone, email: \`sms-${digits}@no-email.invalid\` }, ... })`
  (the `if (!customer)` branch only), call `createAuditLog` with the same
  shape as CUST-003: `actorId: null`, `action: CUSTOMER_CREATED`,
  `entityType: CUSTOMER`, `entityId` = created id,
  `changes: { name: { to: phone }, phone: { to: phone }, email: { to: "sms-<digits>@no-email.invalid" } }`,
  inside the existing `tx`.
- No audit call when an existing customer is matched (`matches[0]` found).
- **Test infra**: `sms.test.ts` today does not mock
  `../../../config/prisma.js` and does not exercise `processInboundSms` at
  all. Add the minimal `vi.mock` scaffolding needed to call
  `processInboundSms` directly (not necessarily via the webhook route) and
  assert against it — mirror the shape already established in
  `whatsapp.test.ts` (hoisted `mocks` object; `customer`, `user`, `ticket`,
  `ticketMessage`, `slaRule`, `notification` mocked; `auditLog: { create: mocks.auditCreate }`
  added; function-form `$transaction` implementation). Keep this addition
  scoped to what CUST-006 needs to assert — do not build out a full
  SMS-ticket-creation behavioural suite here.
- No change to `sms.service.ts`'s webhook response shape, status codes, or
  any other function in the file.

### Out of Scope
- Email / WhatsApp files (CUST-003 / CUST-005).
- Any request-context (IP/UA) plumbing.
- Full behavioural test coverage of `processInboundSms` beyond what's
  needed to exercise the create + audit path (e.g. do not newly test
  ticket-priority/SLA logic that isn't part of this gap).
- The audit assertions themselves belong in CUST-006 — this task may add
  the mock scaffolding and, if natural, a first smoke assertion, but the
  full "audit + no-audit-on-match" coverage is CUST-006's job.

### Verification
- `cd server && npx tsc --noEmit` — clean.
- `cd server && npm run lint` — clean.
- `cd server && npx vitest run src/modules/integrations/sms` — new and
  existing (provider/signature) tests green.
- Manual code read: exactly one `createAuditLog` call site, inside the
  `if (!customer)` create branch, inside the existing `tx`.
- `git diff` — `sms.service.ts` change confined to the create branch;
  `sms.test.ts` change is additive mock scaffolding, no existing test
  logic altered.

### Definition of Done
- A new inbound-SMS customer creates exactly one `CUSTOMER_CREATED` audit
  row with `actorId: null` and correct `entityId`/`changes`.
- A matched (pre-existing) customer produces no audit row.
- `processInboundSms` is now callable/testable via a prisma mock in
  `sms.test.ts`.
- Audit write is atomic with the customer create.
- Server typecheck, lint, and full `integrations/sms` suite pass.

---

## CUST-005 — Audit inbound WhatsApp customer creation (DG-1)

### Goal
Record exactly one `CUSTOMER_CREATED` `AuditLog` row when the inbound
WhatsApp handler creates a new `Customer`, atomically with the create.

### Depends On
None

### Expected Files
- `server/src/modules/integrations/whatsapp/whatsapp.service.ts`

### Requirements
- In `matchOrCreateCustomer`, after
  `return tx.customer.create({ data: { name: profileName?.trim() || e164, email, phone: e164 }, ... })`
  succeeds (the final no-match branch only — not the two earlier `matches.length`
  / `existingByEmail` return points), call `createAuditLog` with the same
  shape as CUST-003/004: `actorId: null`, `action: CUSTOMER_CREATED`,
  `entityType: CUSTOMER`, `entityId` = created id,
  `changes: { name: { to: <name used> }, email: { to: email }, phone: { to: e164 } }`,
  inside the existing `tx`.
- No audit call on the phone-match branch or the
  placeholder-email-match branch — only on the final `create`.
- `whatsapp.test.ts` already mocks `auditLog`? — verify by inspection; if
  not present, add `auditLog: { create: mocks.auditCreate }` to the
  existing mock scaffolding in this task (production file) is not
  required here, but note in the report whether CUST-006 needs to add it.
- No change to `whatsapp.service.ts`'s webhook response shape, status
  codes, or any other function in the file.

### Out of Scope
- Email / SMS files (CUST-003 / CUST-004).
- Any request-context (IP/UA) plumbing.
- Tests (CUST-006).

### Verification
- `cd server && npx tsc --noEmit` — clean.
- `cd server && npm run lint` — clean.
- `cd server && npx vitest run src/modules/integrations/whatsapp` —
  existing suite still green (response shape / ticket-creation assertions
  unchanged).
- Manual code read: exactly one `createAuditLog` call site, in the final
  `create` return of `matchOrCreateCustomer`, inside the existing `tx`;
  the two earlier match-return points are untouched.
- `git diff` — change confined to `matchOrCreateCustomer` (+ imports); no
  schema/migration/dependency/client change.

### Definition of Done
- A new inbound-WhatsApp customer creates exactly one `CUSTOMER_CREATED`
  audit row with `actorId: null` and correct `entityId`/`changes`.
- Both match branches (phone match, placeholder-email match) produce no
  audit row.
- Audit write is atomic with the customer create.
- Server typecheck, lint, and existing WhatsApp-integration tests pass.

---

## CUST-006 — DG-1 regression tests (email, SMS, WhatsApp audit + no-audit-on-match)

### Goal
Prove all three inbound channels write exactly one correct
`CUSTOMER_CREATED` audit row on creation and none on a match, and that a
duplicate webhook delivery does not double-audit.

### Depends On
`CUST-003`, `CUST-004`, `CUST-005`

### Expected Files
- `server/src/modules/integrations/email/email.test.ts`
- `server/src/modules/integrations/sms/sms.test.ts`
- `server/src/modules/integrations/whatsapp/whatsapp.test.ts`

### Requirements
- For each of the three files, add/extend `auditLog: { create: mocks.auditCreate }`
  (or the file's already-hoisted-mock equivalent) to the mocked
  `../../../config/prisma.js` module and its function-form `$transaction`
  implementation, if not already present after CUST-003/004/005.
- **Email** (`email.test.ts`): extend the existing "creates a new
  customer" test with an assertion that `mocks.auditCreate` (or
  equivalent) was called exactly once with
  `action: "CUSTOMER_CREATED"`, `entityType: "CUSTOMER"`, `actorId: null`,
  and `changes` containing the created `name`/`email`. Extend the existing
  "matches an existing customer" test with an assertion that the audit
  mock was **not** called.
- **SMS** (`sms.test.ts`, using CUST-004's new scaffolding): a create case
  → one audit row, same shape (`name`/`phone`/`email` placeholder in
  `changes`); a matched-existing-customer case → no audit row; a duplicate
  `externalId` redelivery → no ticket/customer/audit work at all (existing
  idempotency short-circuit still holds).
- **WhatsApp** (`whatsapp.test.ts`): extend the existing customer-creation
  test (around the existing `mocks.customerCreate` assertion) with the
  same one-row audit assertion; extend the existing phone-match and
  placeholder-email-match tests with "no audit row" assertions.
- Do not duplicate or alter existing non-audit assertions in any of these
  three files (ticket creation, SLA, notifications, signature
  verification, etc.) beyond what's needed to add the audit assertion in
  the same test body.

### Out of Scope
- Any production-code change (route fixes belong back in CUST-003/004/005).
- DG-2 tests (CUST-002).
- Request-context (IP/UA) assertions — not implemented in this pass.

### Verification
- `cd server && npx vitest run src/modules/integrations` — all three
  suites green.
- `cd server && npx tsc --noEmit` — clean.
- `cd server && npm run lint` — clean.
- `git status` — only the three `*.test.ts` files changed.

### Definition of Done
- Each channel: create → exactly one `CUSTOMER_CREATED` row, correct
  `actorId`/`entityType`/`changes`; match → no row.
- At least one channel's duplicate-redelivery case asserts no double
  audit.
- All `integrations` suites pass; typecheck and lint clean.
- No production code changed by this task.

---

## CUST-007 — Documentation reconciliation

### Goal
Bring `spec.md` in line with the implemented behaviour. Touch other docs
only if implementation genuinely diverged from what they already state.

### Depends On
`CUST-001` … `CUST-006`

### Expected Files
- `specs/features/customers/spec.md`
- `docs/06-auth-rbac.md`, `docs/05-api-contract.md`,
  `docs/18-ui-pages-spec.md` (only if inspection shows a needed change)
- `docs/17-decisions-log.md` (only a short progress note, if warranted —
  no new ADR expected)

### Requirements
- `spec.md`:
  - Update the DG-1 entry to state inbound Email/SMS/WhatsApp customer
    **creation** now writes a `CUSTOMER_CREATED` `AuditLog` row
    (`actorId: null`); keep the "no `TicketHistory`-equivalent" framing
    accurate; note that no inbound path performs a customer *update* (that
    was already true pre-fix and stays true).
  - Update the DG-2 entry to state manual create/update duplicate-email
    detection is now case-insensitive, matching inbound-channel matching;
    note the residual same-case-race caveat stays (Prisma `@unique` is
    still case-sensitive at the DB level; `P2002` fallback unchanged).
  - Update the "Duplicate/parallel Customer-mutation paths outside this
    module" table's prose ("None of these five... paths write a
    `CUSTOMER_CREATED`/`CUSTOMER_UPDATED` `AuditLog` row") to reflect that
    three of the five (email/SMS/WhatsApp) now do, on creation.
  - Update "Current Tests" to mention the new DG-1/DG-2 regression
    coverage.
  - Do not touch any other section (RBAC matrix, OD-6, notes, delete,
    linkage) — none of it changed.
- Other docs: edit only if a targeted re-read at implementation time shows
  they assert the pre-fix behaviour as current fact. Expectation per
  `plan.md` is **no change** — confirm, don't assume.
- Do **not** expand into unrelated documentation cleanup or reformatting.

### Out of Scope
- Any new ADR (unless implementation genuinely revealed a new
  architectural decision — not expected).
- Any code change.

### Verification
- `git diff specs/ docs/` — changes are additive/corrective, minimal, and
  confined to the two gaps; no unrelated edits.
- Markdown renders (no broken tables/links).
- `git status` — no `server/src/**`, `server/prisma/**`, `client/**`, or
  dependency file changed by this task.

### Definition of Done
- `spec.md`'s DG-1/DG-2 entries and the affected prose accurately describe
  the implemented behaviour.
- Any other doc edits are reported as genuinely necessary, not assumed.
- No new ADR unless justified and reported.
- No production/schema/dependency file changed.

---

## CUST-008 — Final verification and implementation-readiness report

### Goal
Verify the completed fix against `spec.md` and `plan.md` and produce the
final implementation-readiness report. No merge, no push.

### Depends On
`CUST-001` … `CUST-007` (all)

### Expected Files
None (verification + report only).

### Requirements
- Run backend checks:
  - typecheck: `cd server && npx tsc --noEmit`
  - lint: `cd server && npm run lint`
  - Customers tests: `cd server && npx vitest run src/modules/customers`
  - Integrations tests: `cd server && npx vitest run src/modules/integrations`
  - AuditLog tests: `cd server && npx vitest run src/modules/audit-logs`
  - build, if project convention requires it: `cd server && npm run build`
- Confirm, by `git diff` / `git status` inspection:
  - no `client/**` change
  - no `server/prisma/**` change, no migration file
  - no `package.json` / lockfile change
  - no new `AUDIT_ACTIONS`/`AUDIT_ENTITY_TYPES` constant added
  - Customers routes/RBAC/response shapes unchanged
  - Customers stays global (no `teamId` introduced); OD-6 team-scoping
    still confined to `GET /:id/tickets`
  - `CustomerNote` still has no edit/delete route
  - all three inbound channels: create → exactly one `CUSTOMER_CREATED`
    row with `actorId: null`; match → no row
  - manual create/update: case-insensitive duplicate detection works both
    ways (create vs. existing, update vs. another existing), self-update
    excluded
  - existing exact-case duplicate detection still works
- Compare the implementation against `spec.md`'s DG-1 and DG-2 entries and
  record pass/fail.
- Produce the final implementation-readiness report: files changed across
  the whole task set, exact Git state (expected: unstaged, uncommitted),
  verification results, known limitations (e.g. the accepted same-case
  race residual risk), suggested commit message.

### Out of Scope
- `git commit`, `git push`, `git merge`, `git rebase`, `git amend`,
  staging.
- Any code/schema/dependency change (if a criterion fails, report it and
  route the fix back to the owning CUST-00x task).

### Verification
- All backend checks above run and their real output captured (no
  inferred results).
- `git diff --check` — clean (no whitespace errors/conflict markers).
- `git status` — working tree contains only this task set's intended
  changes, unstaged and uncommitted.

### Definition of Done
- Typecheck, lint, Customers/Integrations/AuditLog tests all run and pass
  (or failures reported precisely, with the work **not** declared ready).
- DG-1 and DG-2 both confirmed fixed against `spec.md`.
- The "no frontend / no schema / no migration / no dependency / no new
  constants / routes unchanged / global-not-team-scoped / OD-6 confined /
  notes append-only / exactly-once audit / no-audit-on-match / residual
  race documented" checklist all confirmed.
- Final implementation-readiness report produced.

---

## Human Verification (2026-09-12, same branch, uncommitted)

**Status: `IMPLEMENTED + VERIFIED ON SDD BRANCH`.**

- **Prisma:** dev-server `node`/`tsx` processes (PIDs holding
  `query_engine-windows.dll.node`) killed to clear the Windows file lock;
  `npx prisma generate` (from `server/`) then succeeded cleanly
  (`Generated Prisma Client (v6.19.3)` in 447ms). Schema unchanged — no
  migration, confirming the TK-011 "PENDING HUMAN" prisma-generate gap is
  now closed for this branch.
- **Automated regression (unchanged from prior session, re-run):**
  `npx vitest run src/modules/customers/customer.test.ts
  src/modules/integrations/email/email.test.ts
  src/modules/integrations/sms/sms.test.ts
  src/modules/integrations/whatsapp/whatsapp.test.ts` → **83/83 passed**
  (customer 29, email 16, sms 11, whatsapp 27).
- **Manual smoke (real dev Postgres, no browser available):** a one-off
  `tsx` script (`server/scratch-smoke.ts`, deleted after the run — not
  committed) called the actual exported service functions
  (`createCustomer`, `updateCustomer`, `processInboundEmail` with
  `emailClient.retrieveReceivedEmail` monkey-patched to avoid a real Resend
  network call, `processInboundSms`, `processInboundTextMessage`) directly
  against the real dev database, using a real `ADMIN` user id as actor and
  unique per-run emails/phone numbers. All rows created by the script were
  deleted at the end of the run (audit logs, ticket messages/history/
  attachments, tickets, customers) — DB left as found.
  - **DG-2 create:** creating a customer whose email differs only by
    casing from an existing customer → **409 `CUSTOMER_EMAIL_EXISTS`**. PASS.
  - **DG-2 update:** updating a different existing customer to an email
    differing only by casing from another existing customer → **409
    `CUSTOMER_EMAIL_EXISTS`**. PASS.
  - **DG-1 email, new customer:** inbound email from a brand-new address →
    customer created, **exactly one `CUSTOMER_CREATED` AuditLog row**
    (`entityType: CUSTOMER`, `actorId: null`). PASS.
  - **DG-1 email, matched customer:** second inbound email from the same
    address (new `emailId`, so not the dedup path) → matched the existing
    customer, **no new `CUSTOMER_CREATED` row** (count stayed at 1). PASS.
  - **DG-1 SMS, new customer:** inbound SMS from a brand-new valid E.164
    number → customer created, **exactly one `CUSTOMER_CREATED` row**. PASS.
  - **DG-1 SMS, matched customer:** second inbound SMS from the same
    number → matched, **no new row**. PASS.
  - **DG-1 WhatsApp, new customer:** inbound WhatsApp text from a
    brand-new sender → customer created, **exactly one `CUSTOMER_CREATED`
    row**. PASS.
  - **DG-1 WhatsApp, matched customer:** second inbound WhatsApp message
    from the same sender → matched, **no new row**. PASS.
  - **Result: 8/8 PASS.**
- **No production code changed** by this verification pass — the smoke
  revealed no bug.
- **Residual risks (unchanged from CUST-008 report):**
  - Same-case email race: two concurrent manual creates/updates with the
    identical exact-case email can still both pass the `findFirst`
    pre-check before either commits; the `@unique` DB constraint (exact
    case) plus the existing `P2002 → 409` fallback catches that, but a
    case-*insensitive* concurrent collision (e.g. `A@x.com` and `a@x.com`
    inserted in the same race window) is not DB-constrained and is not
    covered by this smoke pass (requires real concurrency, not exercised
    here). Accepted risk per `spec.md`/`plan.md` — no schema change in
    scope.
  - Manual smoke was run via direct service-function calls against the
    real DB, not through the HTTP/webhook layer or a browser (none
    available in this environment) — route-level auth/validation and the
    real Resend/TextBee/WhatsApp Cloud API payload parsing were not
    exercised by this pass (they are unchanged by DG-1/DG-2 and already
    covered by the existing controller/webhook test suites).
  - No new automated regression test was added for this human-verification
    pass (by design — it is a one-off manual smoke, not a permanent test;
    the permanent coverage is the existing `customer.test.ts` /
    `email.test.ts` / `sms.test.ts` / `whatsapp.test.ts` suites, already
    green).
- No stage/commit/push/merge/rebase/amend performed.

---

## CUST-FOLLOWUP-001 — DB-enforced case-insensitive customer email uniqueness (implemented, closes the residual race above)

### Goal
Make PostgreSQL the final authority for case-insensitive `Customer.email`
uniqueness, closing the residual risk accepted in the Human Verification
section above: two concurrent manual creates/updates differing only by
email casing could both pass the application-level pre-check before either
committed, because the DB-level `@unique` constraint was case-sensitive.

### Expected Files
- `server/prisma/migrations/20260912163955_customer_email_lower_unique/migration.sql`
  (new, hand-authored — Prisma schema DSL cannot express a functional/
  expression index)
- `server/src/modules/customers/customer.test.ts` (new regression tests)
- `specs/features/customers/spec.md` (DG-2 entry + data-model + tests
  sections updated)

### What changed
- Added a PostgreSQL functional unique index,
  `CREATE UNIQUE INDEX "Customer_email_lower_key" ON "Customer" ((LOWER(email)))`,
  alongside the existing schema-declared `@unique` on `Customer.email`
  (left unchanged — the two constraints coexist; the functional one is a
  stricter superset).
- No change to `customer.service.ts` — the existing `P2002` catch blocks
  in `createCustomer`/`updateCustomer` already map any unique-constraint
  violation on the `Customer` model to `409 CUSTOMER_EMAIL_EXISTS`
  regardless of which of the two indexes fired. Verified directly against
  the real dev database that a functional-index violation still raises
  Prisma `P2002` (`meta.target: ["lower(email)"]`), so no error-mapping
  change was needed.
- No change to routes, RBAC, response shapes, `AUDIT_ACTIONS`/
  `AUDIT_ENTITY_TYPES`, or any client code.

### Verification (run against the real dev database, `chore/sdd-foundation`)
- **Duplicate scan** (`SELECT LOWER(email), COUNT(*) ... HAVING COUNT(*) > 1`
  via a throwaway `tsx` script, deleted after the run): **0 duplicate
  groups found** — safe to add the index with no data cleanup.
- `npx prisma migrate dev --create-only --name customer_email_lower_unique`
  → empty migration scaffold, then hand-edited with the `CREATE UNIQUE
  INDEX` statement above.
- `npx prisma migrate deploy` → applied cleanly to the dev database.
- `npx prisma migrate status` → "Database schema is up to date!"
- `npx prisma generate` → succeeded.
- Live P2002 reproduction (throwaway `tsx` script, deleted after the run):
  created a customer, then attempted a second create with the same email
  upper-cased → rejected with `PrismaClientKnownRequestError` `code:
  "P2002"`, `meta: { modelName: "Customer", target: ["lower(email)"] }`.
  Confirms Prisma surfaces the functional-index violation as `P2002` with
  no code change required.
- `npx vitest run src/modules/customers` → **31/31 passed**, including two
  new race-simulation tests (create + update) proving a DB-level conflict
  that the app pre-check misses still returns `409 CUSTOMER_EMAIL_EXISTS`.
- `npx vitest run src/modules/integrations src/modules/audit-logs` →
  **79/79 passed** (unaffected, run for regression safety).
- `npx tsc --noEmit` → clean.
- `npm run lint` → clean.
- `npm run build` (`prisma generate && tsc`) → clean.
- `git diff --check` → clean.

### Residual risk
None outstanding for this specific race. A true concurrency test against
the real Postgres index was not added to the permanent `vitest` suite —
this project's test setup (`src/test/setup.ts`) deliberately pins
`DATABASE_URL` to a local placeholder during `vitest run` so the test
suite never touches the real dev database; forcing a real connection from
within a committed test would either require new test infrastructure (a
disposable Postgres instance, out of scope for a two-gap follow-up) or
would make ordinary `vitest run` invocations depend on real DB
connectivity. Instead, the real-database proof (duplicate scan +
live P2002 reproduction) was performed directly during implementation
(see Verification above) and the permanent regression test simulates the
exact failure shape that proof captured. This is the same manual-plus-
mocked verification split already established for DG-1/DG-2 in this
feature.
