# Customers — Implementation Plan

## Status

`READY FOR HUMAN REVIEW` — implemented per `tasks.md` (`CUST-001`…`CUST-008`).

This plan implements the two confirmed gaps from [`spec.md`](./spec.md)
`## Discovered Gaps` and closes them **without** redesigning the Customers
module:

- **DG-1** — inbound Email/SMS/WhatsApp customer *creation* bypasses the
  `AuditLog` trail.
- **DG-2** — manual customer create/update duplicate-email detection is
  case-sensitive against rows already in the database, while inbound/auth
  flows match case-insensitively.

Both are brownfield, low-risk, additive changes anchored to real existing
seams. No product behaviour is redesigned; Customers stays global (no
`teamId`), OD-6 team-scoping stays confined to the `/tickets` sub-resource,
`CustomerNote` stays append-only, and `Customer.userId` linkage keeps its
existing three code paths unchanged.

## Scope

### In scope

| Gap | Fix |
| --- | --- |
| DG-1 | Add exactly one `CUSTOMER_CREATED` `AuditLog` row (actor `null` → `SYSTEM`) at each of the three inbound customer-creation call sites: `email.service.ts matchOrCreateCustomer`, `sms.service.ts processInboundSms`, `whatsapp.service.ts matchOrCreateCustomer`. |
| DG-2 | Make the manual create/update duplicate-email pre-check case-insensitive, matching the convention `email.service.ts matchOrCreateCustomer` already uses (`mode: "insensitive"`). |

### Explicitly NOT in scope (non-regression baseline)

- Any change to Customers RBAC, routes, request/response shapes, status
  codes, or error codes.
- Customers becoming team-scoped in any way (global visibility stays as-is;
  OD-6 stays confined to `GET /:id/tickets`).
- Any change to `CustomerNote` (still append-only, no edit/delete route).
- Any change to how `Customer.userId` is created or linked (self-registration,
  portal profile edit, manual-create-forces-`null` — all three paths
  unchanged).
- Inbound-channel **updates** to an existing `Customer` — inspection
  (below) confirms none of the three inbound handlers ever update an
  existing `Customer` row, only match-or-create. DG-1's audited surface is
  therefore creation only; "and/or update" in the gap's shorthand name does
  not correspond to any code path that currently exists.
- A `citext` column, functional unique index, or any other DB-level
  case-insensitive uniqueness mechanism — see [Database Impact](#database-impact).
- Deduplicating/merging existing case-variant `Customer` rows already in the
  database (no backfill; out of scope, no data migration requested).
- Any frontend change — both gaps are server-side only; no response shape
  or client-visible behaviour changes.
- Realtime/notification behaviour for customer creation (still silent, by
  design, per `spec.md` "Realtime / Notifications").

## Existing Implementation to Reuse

Verified by inspection on branch `chore/sdd-foundation`:

| Seam | Location | Reuse |
| --- | --- | --- |
| `createAuditLog(input, db = prisma)` | `server/src/modules/audit-logs/audit-log.service.ts` | Sole audit-write entry point. Accepts `actorId: string \| null` — `null` is already a first-class case (`metadata.actorType = "SYSTEM"`), exactly the shape needed for an unauthenticated inbound webhook. Accepts a `Prisma.TransactionClient` as `db` — pass `tx`. |
| `AUDIT_ACTIONS.CUSTOMER_CREATED`, `AUDIT_ENTITY_TYPES.CUSTOMER` | `server/src/modules/audit-logs/audit-log.constants.ts` | Already exist (used today by `customer.service.ts createCustomer`). **No new constant needed for DG-1.** |
| Case-insensitive email match | `server/src/modules/integrations/email/email.service.ts` `matchOrCreateCustomer` (`findFirst({ where: { email: { equals, mode: "insensitive" } } })`) | The exact convention DG-2 needs to reuse in `customer.service.ts`'s pre-checks — not a new pattern. |
| Shared `emailSchema` (`.trim().max(254).email().transform(toLowerCase)`) | `server/src/shared/validation/common.schema.ts` | Already used by `createCustomerSchema`/`updateCustomerSchema` — **input casing is already normalized before the service runs** (confirmed by `customer.test.ts` "creates a normalized customer" case). DG-2 is not about input normalization; see [Architecture Decision — DG-2](#dg-2--case-insensitive-duplicate-detection). |
| `prisma.$transaction(async (tx) => {...})` wrapper already present at each inbound create site | `email.service.ts` (`processInboundEmail`), `sms.service.ts` (`processInboundSms`), `whatsapp.service.ts` (`processInboundTextMessage`) | The audit write is added **inside the existing transaction**, right after the `tx.customer.create(...)` call — no new transaction is opened. |
| `withRealtimeOutbox` wrapper | Same three files | Unchanged — the audit write happens inside the inner `prisma.$transaction`, upstream of the outbox flush; no interaction. |

Do **not** introduce a parallel audit helper, a Customers-specific webhook
audit wrapper, or a second email-normalization utility.

## Architecture Decision

### DG-1 — Audit inbound customer creation

**What is actually audited.** Inspection of all three inbound handlers
confirms each one only ever **matches an existing customer or creates a new
one** — none contains an `update`/`upsert` call against `Customer`:

- `email.service.ts:96-103` `matchOrCreateCustomer` — `findFirst` (case-insensitive
  email) → `create({ name, email })` on no match.
- `sms.service.ts:83-88` (inline, no helper function) — `findMany` (phone
  variants) → `create({ name: phone, phone, email: "sms-<digits>@no-email.invalid" })`
  on no match.
- `whatsapp.service.ts:92-117` `matchOrCreateCustomer` — `findMany` (phone
  variants) → `findUnique` (placeholder email) → `create({ name, email, phone })`
  on no match.

So the audited event is **`CUSTOMER_CREATED` only**, at the three `create`
call sites above. This is deliberately the minimum fix for the gap as it
actually exists in code, not a broader "audit everything inbound" change.

**Actor.** `actorId: null`. This is not a new convention —
`createAuditLog` already special-cases `actorId === null` as
`metadata.actorType: "SYSTEM"`. An inbound webhook has no authenticated
`User`; `null` is the correct, existing representation, not an invented
system-user row. (Note: `sms.service.ts` and `whatsapp.service.ts` already
create/reuse a system **author** `User` for the `TicketMessage` — that
system user is for ticket-message authorship, a separate concern, and is
**not** reused as the audit actor. Using it as `actorId` would misrepresent
the audit row as an authenticated action.)

**Changes payload.** Mirrors `customer.service.ts createCustomer`'s
create-time shape (`to`-only, no `from`):

```ts
changes: {
  name:  { to: <name used in the create call> },
  email: { to: <email used in the create call> },
  phone: { to: <phone used in the create call, or omitted/null if not set> },
}
```

Built from the same local values already passed into `tx.customer.create`
— no extra read, no widened `select`.

**Request context.** `requestContext` is **omitted** (→ `ipAddress: null,
userAgent: null`). `getAuditRequestContext` reads an authenticated-app
`Request`; threading it from three separate raw-webhook controllers (each
already framed around its own signature-verification/parsing concerns) is
unrelated scope to "the row exists at all," which is what DG-1 asks for.
This can be revisited later without touching the audit constants or shape.

**Placement.** One `createAuditLog({...}, tx)` call, immediately after the
`tx.customer.create(...)` that creates the new row, still inside the
existing `prisma.$transaction` callback (not a new transaction) — same
atomicity guarantee the internal `customer.service.ts createCustomer`
already has: if the audit write throws, the whole inbound message
processing rolls back.

**Idempotency interaction.** All three handlers already de-duplicate
webhook redelivery via an `externalId`/`messageId` uniqueness check before
any customer/ticket work runs. A duplicate delivery short-circuits before
`matchOrCreateCustomer`/the inline create runs, so it never re-enters the
create branch and never double-audits. No new idempotency logic needed.

### DG-2 — Case-insensitive duplicate detection

**Root cause, confirmed by inspection (not as stated at face value in
`spec.md`).** `createCustomerSchema`/`updateCustomerSchema` already use the
shared `emailSchema`, which **lowercases the input** via `.transform()`
before the service ever runs (`customer.test.ts` "creates a normalized
customer" proves `" AHMED@Example.com "` → `"ahmed@example.com"`). So a
*single* manual create/update call is already casing-safe on its own input.

The real gap is that **existing rows can already carry non-lowercased
email** — specifically, `email.service.ts matchOrCreateCustomer` matches
case-insensitively but **creates** with the raw sender address as received
(not lowercased), e.g. a `Customer` row could exist with
`email: "Ahmed@Example.com"`. `createCustomer`'s pre-check
(`prisma.customer.findUnique({ where: { email: input.email } })`, exact
match) and the Prisma `@unique` constraint are both case-sensitive, so a
staff member later creating `ahmed@example.com` manually does **not** find
that existing row — a second, functionally-duplicate `Customer` is created
instead of a `409 CUSTOMER_EMAIL_EXISTS`. The same applies to `updateCustomer`
when the input includes a changed `email`.

**Fix.** Change the pre-check query shape only — reuse the exact
`email.service.ts` convention:

- `createCustomer`: `prisma.customer.findUnique({ where: { email } })` →
  `prisma.customer.findFirst({ where: { email: { equals: input.email, mode: "insensitive" } } })`.
- `updateCustomer`: when `input.email !== undefined`, add the same
  case-insensitive `findFirst` pre-check (excluding the current row via
  `NOT: { id: customerId }`) before the `tx.customer.update`. Today
  `updateCustomer` has **no** pre-check at all for email conflicts — it
  relies solely on the Prisma `P2002` fallback, which is exact-case only
  and therefore misses this class of conflict entirely. The `P2002` catch
  block stays as the defensive fallback for a genuine same-case race
  (unchanged behaviour, still correct).

Both functions keep their existing `409 CUSTOMER_EMAIL_EXISTS` error shape
and the existing `P2002` raced-write fallback verbatim — only the
pre-check's match mode changes, from exact to case-insensitive equals. No
change to `createCustomerSchema`/`updateCustomerSchema` (the input-side
lowercasing already works and is untouched).

**Residual risk (accepted, documented, not fixed here).** The Postgres
`@unique` constraint on `Customer.email` itself stays case-sensitive (no
migration — see [Database Impact](#database-impact)), so a true
simultaneous race between two case-variant inserts that both pass the
application-level pre-check is still theoretically possible, exactly as the
existing `P2002` fallback already assumes for the exact-case race today.
This is the same class of residual risk the module already accepts and is
consistent with DG-2's "architecture debt (low impact)" classification —
not a new gap introduced by this fix.

## Database Impact

**None.** No `server/prisma/schema.prisma` edit, no migration.

- `Customer.email` stays a plain Postgres `@unique String` column — no
  `citext`, no functional/expression unique index, no collation change.
- Per the task instructions, a migration is added only if inspection
  proves one is actually required; it is not required here because the
  fix is a query-shape change (`findUnique` exact → `findFirst`
  case-insensitive) at the **application** level, identical in kind to the
  pre-existing `email.service.ts` convention this plan reuses.
- If a future decision is made to also de-duplicate/normalize *existing*
  case-variant rows or to enforce case-insensitive uniqueness at the DB
  level, that is a separate, larger change (data backfill + migration) and
  is explicitly out of scope here.

## API Compatibility

No intentional contract change for either gap.

- **DG-1**: purely additive server-side bookkeeping. Inbound webhook
  request/response shapes, status codes, ticket-creation behaviour, and
  timing are unchanged. No new response field anywhere. The new rows
  surface only through the existing `ADMIN`-only `/api/audit-logs`
  workspace via the existing `entityType: CUSTOMER` / `action:
  CUSTOMER_CREATED` filters — indistinguishable in shape from a manually
  created customer's audit row except for `actorId: null` /
  `metadata.actorType: "SYSTEM"`.
- **DG-2**: `POST /customers` and `PATCH /customers/:id` keep the exact
  same `409 CUSTOMER_EMAIL_EXISTS` error code/shape; they now correctly
  return it in a case-insensitive-duplicate scenario that previously
  silently created a second row. No new error code. No schema change (no
  new/removed field, `.strict()` unchanged).

## Frontend Impact

**None.** Both gaps are entirely server-side. `client/src/features/customers/*`
and every inbound-channel client surface are untouched.

## Testing Strategy

Backend only, extending existing suites — no new test files unless a
target file's existing test infrastructure cannot express the assertion
(see CUST-004 in `tasks.md` for the one case, SMS, where prisma isn't
mocked at all today).

### DG-1

- `server/src/modules/integrations/email/email.test.ts` — extend the
  existing "creates a new customer" case (already asserts
  `mocks.customerCreate` shape) with an assertion that
  `auditLog.create`/`createAuditLog` fires exactly once with
  `action: CUSTOMER_CREATED`, `entityType: CUSTOMER`, `actorId: null`,
  `changes` carrying the created `name`/`email` `to` values. Extend the
  existing "matches an existing customer by email" case with an assertion
  that no such audit row is written on a match (only on create).
- `server/src/modules/integrations/whatsapp/whatsapp.test.ts` — same
  pattern against the existing `auditLog`/`customerCreate` mock scaffolding
  already in the file (`mocks.customerCreate`, function-form `$transaction`
  mock already present).
- `server/src/modules/integrations/sms/sms.test.ts` — currently has **no**
  prisma mock and does not exercise `processInboundSms` at all (only
  provider/signature-level tests exist). Add the minimal prisma-mock
  scaffolding (mirroring the `whatsapp.test.ts` shape: `customer`, `user`,
  `ticket`, `ticketMessage`, `slaRule`, `notification`, `auditLog`,
  function-form `$transaction`) needed to exercise the create branch of
  `processInboundSms` and assert the same audit shape. This is new test
  *infrastructure* for an existing, currently-untested function — not new
  production scope.
- Idempotency case (duplicate webhook delivery) asserted to **not**
  double-audit, for at least one of the three channels.

### DG-2

- `server/src/modules/customers/customer.test.ts` — add:
  - Create: existing customer row has a different-case email
    (`findFirst` mock returns a match) → `409 CUSTOMER_EMAIL_EXISTS`,
    `createCustomer` (the Prisma call) never reached. Assert the pre-check
    call uses `mode: "insensitive"`.
  - Update: same scenario via `PATCH`, plus the existing-row-excluded-by-id
    case (updating a customer's *own* record to the same email, differently
    cased, must **not** conflict with itself).
  - Regression: the existing "creates a normalized customer" and "returns a
    conflict for a duplicate customer email" (exact-case) tests keep
    passing unchanged.

## Documentation Updates

Per the task instructions, reconcile docs **only if the implementation
change makes it necessary**.

- `specs/features/customers/spec.md` — the "Discovered Gaps" section's
  DG-1/DG-2 entries describe the *pre-fix* state; once implemented, update
  those two entries (and the "Create"/"Duplicate/parallel Customer-mutation
  paths" prose that currently states these paths are unaudited/case-sensitive)
  to reflect the new behaviour, or add a short "Implemented as" note. This
  is the one doc that **will** need a follow-up edit — tracked as a task,
  not done by this planning pass.
- `docs/06-auth-rbac.md`, `docs/05-api-contract.md`,
  `docs/18-ui-pages-spec.md` — inspection during discovery found these
  already describe current behaviour; neither DG-1 nor DG-2 changes any
  RBAC, route, request/response shape, or page behaviour they document, so
  **no edit expected**. Confirm at implementation time before skipping.
- `docs/17-decisions-log.md` — a short progress note only if the
  implementation reveals this is more than "apply an existing pattern
  (SYSTEM actor, case-insensitive match) to two more call sites." No new
  ADR is expected.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| DG-1 audit write throws and rolls back an otherwise-valid inbound message (webhook retries could then double-process if the provider doesn't get a clean ack). | `createAuditLog` is a simple, already-proven `INSERT` (same call the internal `customer.service.ts` already makes on every manual create); no new failure mode introduced. Idempotency (`externalId` check) already protects a provider retry. |
| DG-1 accidentally also fires on the *match* branch (existing customer found), producing a misleading "created" row. | Audit call is placed only in the `create(...)` branch, never the `findFirst`/`findMany`/`findUnique` match branches. Tests assert "no audit row on match" for each channel. |
| DG-2 case-insensitive `findFirst` changes conflict behaviour for a customer updating their *own* record without changing case. | `updateCustomer`'s pre-check excludes the current row (`NOT: { id: customerId }`), mirroring `auth.service.ts`'s existing `NOT: { id: userId }` pattern for the analogous self-update case. Test covers it explicitly. |
| DG-2 fix silently changes which of two *already-existing* case-variant duplicates a future update/delete affects. | Out of scope — this plan does not touch existing rows. Behaviour for pre-existing duplicates is unchanged; the fix only prevents a **new** manual duplicate from being created going forward. |
| SMS test-infra addition (CUST-004) scope-creeps into testing unrelated `processInboundSms` behaviour. | Task is scoped to the minimum mock needed for the create + audit assertion; not a full behavioural test suite for SMS ticket creation (that gap, if any, is separate from DG-1/DG-2 and not in this plan). |

## Rollback

- No migration → no schema rollback for either gap.
- DG-1: reverting the implementation commit removes the three
  `createAuditLog(...)` call sites; inbound customer creation returns to
  unaudited (today's behaviour). Historical `CUSTOMER_CREATED` rows with
  `actorId: null` already written stay as valid history and are not
  deleted on rollback.
- DG-2: reverting restores the exact-match pre-check; no data is touched
  either way (the fix only changes a read-side query, not a write).

## Proposed File Impact

Exact paths. Nothing is modified by this planning task.

### Backend

- `server/src/modules/integrations/email/email.service.ts` — one
  `createAuditLog(..., tx)` call in `matchOrCreateCustomer`'s create
  branch.
- `server/src/modules/integrations/sms/sms.service.ts` — one
  `createAuditLog(..., tx)` call in `processInboundSms`'s inline create
  branch.
- `server/src/modules/integrations/whatsapp/whatsapp.service.ts` — one
  `createAuditLog(..., tx)` call in `matchOrCreateCustomer`'s create
  branch.
- `server/src/modules/customers/customer.service.ts` — `createCustomer`'s
  pre-check becomes case-insensitive `findFirst`; `updateCustomer` gains a
  new case-insensitive `findFirst` pre-check when `input.email` is present.
- `server/src/modules/integrations/email/email.test.ts` — audit assertions
  added to existing create/match cases.
- `server/src/modules/integrations/whatsapp/whatsapp.test.ts` — audit
  assertions added to existing create/match cases.
- `server/src/modules/integrations/sms/sms.test.ts` — new prisma-mock
  scaffolding + create/audit/idempotency assertions for
  `processInboundSms` (currently untested).
- `server/src/modules/customers/customer.test.ts` — new case-insensitive
  duplicate-detection tests for create and update.

### Frontend

`None.`

### Database

`None.` (no `server/prisma/**` change, no migration)

### Dependencies

`None.` (no `package.json` / lockfile change)

### Documentation

- `specs/features/customers/spec.md` (DG-1/DG-2 entries + affected prose —
  required)
- `docs/06-auth-rbac.md`, `docs/05-api-contract.md`,
  `docs/18-ui-pages-spec.md` (confirm-no-change at implementation time)
- `docs/17-decisions-log.md` (progress note only if warranted)
