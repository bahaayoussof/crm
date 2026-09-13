# Customers

## Feature Status

**Status: `IMPLEMENTED + VERIFIED ON SDD BRANCH`.** DG-1 and DG-2 (see [Discovered Gaps](#discovered-gaps)) are implemented per `plan.md`/`tasks.md` (`CUST-001`…`CUST-008`), verified by typecheck, lint, and the full Customers/Integrations/AuditLog test suites (83/83), plus a manual smoke against the real dev database (8/8 PASS — see `tasks.md` § Human Verification, 2026-09-12) covering both DG-2 case-insensitive-duplicate paths and all three DG-1 inbound channels' exactly-once `CUSTOMER_CREATED` audit behavior. No commit/push/merge performed — see the task-set completion report for file-by-file changes, exact test results, and residual risk.

| Aspect | State |
| --- | --- |
| Implementation | **Exists and is mature.** Backend `server/src/modules/customers/` (routes/controller/service/schema); frontend `client/src/features/customers/`. `Customer` + `CustomerNote` Prisma models are stable, no pending migration. |
| Brownfield discovery | **Completed** (2026-09-12), on branch `chore/sdd-foundation`. Conclusions drawn from `server/src/modules/customers/*`, `server/prisma/schema.prisma`, `server/src/shared/team/team-scope.ts`, `client/src/features/customers/*`, `customer.test.ts`, `customer-pages.test.tsx`, and `docs/04-06-09-18`. |
| Specification vs implementation | **Reconciled.** Docs (`docs/04-database-design.md`, `docs/05-api-contract.md`, `docs/06-auth-rbac.md`, `docs/18-ui-pages-spec.md`) match the current code on every point checked, including the OD-6 team-scoped ticket-history behaviour carried over from `specs/features/tickets/spec.md`. **No documentation drift found.** |
| Human product decisions | **None outstanding.** No behaviour required a developer decision during this pass — see [Discovered Gaps](#discovered-gaps). |
| Plan/tasks | **Produced and completed.** See `plan.md` (implementation approach for DG-1/DG-2) and `tasks.md` (`CUST-001`…`CUST-008`, plus `CUST-FOLLOWUP-001`) for execution and verification status. |

No production code, schema, migration, dependency, or `docs/` behaviour was changed during this discovery. This spec states current behaviour as fact, matching the brownfield precedent set by `specs/features/tickets/spec.md` and `specs/features/knowledge-base/spec.md`.

---

## Purpose

The **Customer** is the CRM-side profile for an external contact — the person or organization every `Ticket` belongs to. It exists so that:

- support work is attributable to one durable contact record across every channel (Web, Email, WhatsApp, SMS, Live Chat, Portal) rather than being scattered by transient contact details;
- staff have one place to see a contact's identity, notes, and support history without re-deriving it from ticket search;
- a `CUSTOMER`-role login (`User.role = CUSTOMER`) can optionally be linked to a `Customer` profile (`Customer.userId`) to grant Portal self-service, while an unlinked `Customer` (no login) remains fully manageable by staff.

Customers are **global, not team-owned** — unlike `Ticket.teamId`, there is no `Customer.teamId`. Every ADMIN/MANAGER/AGENT can see and search every customer profile org-wide; only the customer's **ticket history sub-resource** is team-scoped, reusing the exact same canonical scoping helper Tickets uses (see [Customer-Ticket Visibility](#customer-ticket-visibility-the-od-6-boundary)).

---

## Scope

### In scope (Customers owns)

- The `Customer` record: identity fields, CRUD, uniqueness, deletion-safety rules.
- `CustomerNote`: internal-only notes on a customer profile (distinct from `TicketNote`).
- The customer list (search/pagination) and customer detail read shape (contact info, support summary, notes, attachments).
- The customer-ticket-history sub-resource (`GET /api/customers/:id/tickets`) and its team-scoped + per-row access rules.
- RBAC for all of the above.
- Audit trail for customer create/update/delete/note-add.

### Out of scope (Customers depends on — specified elsewhere)

- Ticket visibility, mutation, and lifecycle rules (`specs/features/tickets/spec.md`) — Customers only reuses the team-scoping primitive for its history sub-resource; it does not own ticket rules.
- `User`/authentication, including customer self-registration and login (`specs/features/auth-rbac/spec.md`, `auth.service.ts`) — Customers only consumes the resulting `Customer.userId` link.
- Customer Portal profile self-edit (`portal-profile.service.ts`, `/api/portal/profile`) — a separate boundary from the internal `/api/customers/*` routes documented here.
- Customer-profile attachments (`attachments` module) — Customers mounts the routes but does not own attachment storage/validation logic.
- `AuditLog` as a system (shared with every other module).
- Team/Department/Branch org structure.

---

## Existing Implementation Summary

### Backend

```
server/src/modules/customers/
├── customer.routes.ts     Router: requireAuth + requireRole per route (read: ADMIN/MANAGER/AGENT,
│                           write: ADMIN/MANAGER); GET/POST /, GET /:id, GET /:id/tickets, PATCH /:id,
│                           DELETE /:id, GET/POST /:id/notes; mounts attachments sub-routes
│                           (GET /:customerId/attachments read-all, POST write-only)
├── customer.controller.ts Thin: validated body/params/query -> service call -> { data } envelope
├── customer.schema.ts     Zod, all .strict(): list query (search ≤100 + pagination), params (id),
│                           ticket-list query (pagination only), create (name 2-100, email, phone),
│                           update = create.partial().refine(hasAtLeastOneField), note (body 1-5000)
└── customer.service.ts    listCustomers, getCustomer, listCustomerTickets, createCustomer,
                            updateCustomer, deleteCustomer, listCustomerNotes, addCustomerNote
```

Reused, not duplicated:

- `server/src/shared/team/team-scope.ts` — `resolveActorTeamId` / `teamScopedTicketWhere`, the exact same team-scoping primitive Ticket visibility uses, applied inside `listCustomerTickets`.
- `server/src/modules/audit-logs/audit-log.service.ts` — `createAuditLog(input, tx)`, `changedFields(before, after, fields)`.
- `server/src/shared/validation/{common,pagination,phone}.schema.ts` — shared Zod fragments (`emailSchema`, `optionalPhoneSchema`, `databaseIdSchema`, `paginationFields`, `hasAtLeastOneField`).
- `server/src/modules/attachments/` — customer-profile attachment list/upload handlers, mounted on this router but implemented in the attachments module.

Request flow (verified, `customer.routes.ts:14-26`): **Router `requireAuth` → per-route `requireRole` → Zod `validateQuery`/`validateParams`/`validateBody` → thin controller → `customer.service` → Prisma (transaction for every write) → in-transaction `AuditLog` row**. No `TicketHistory`-equivalent history model exists for Customers; `AuditLog` is the only trail.

### Frontend

```
client/src/features/customers/
├── customer-api.ts            Axios wrappers: list/get/tickets/create/update/delete/notes-list/notes-create
├── customer-hooks.ts           TanStack Query hooks; customerKeys factory (all -> lists()/list(filters) ->
│                                details()/detail(id) -> notes(id)/tickets(id, pagination)); mutations
│                                invalidate lists() (create), detail(id)+lists() (update), all (delete),
│                                notes(id) (note create)
├── customer.schemas.ts         RHF/Zod client mirrors of the server schemas, both .strict()
├── customer.types.ts           Response/DTO interfaces
├── customer-permissions.ts     canManageCustomers(role) = role === ADMIN || role === MANAGER
├── customer-list-page.tsx      URL-driven search (debounced) + page state, server pagination (limit 20),
│                                "Add Customer" gated by canManageCustomers, list itself visible to AGENT
├── customer-detail-page.tsx    Tabs: overview | tickets | activity | notes | attachments
├── customer-form-page.tsx      Create/edit form (name, email, phone) — RHF + Zod
├── customer-create-modal.tsx   Modal create entry point
├── customer-table.tsx          TanStack Table integration for the list
├── customer-tickets.tsx        Renders /customers/:id/tickets; per-row `access` field drives FULL
│                                (linked to /tickets/:id) vs SUMMARY_ONLY (non-interactive, labelled) rows
├── customer-ui.tsx             Shared layout primitives for the feature
├── customer-error.ts / customer-format.ts   Error mapping + display formatting helpers
└── use-debounced-value.ts      Search debounce hook
```

Consistent with the repo-wide `api.ts → hooks.ts` layering and TanStack Query cache-invalidation pattern (`specs/architecture.md`). Delete uses a confirm prompt and navigates back to `/customers` on success. Notes tab hides the add-form for non-`canManageCustomers` users (AGENT) and renders a read-only list instead.

### Data model (Prisma)

`server/prisma/schema.prisma:50-63` (`Customer`) and `:171-182` (`CustomerNote`):

```prisma
model Customer {
  id          String         @id @default(cuid())
  name        String
  email       String         @unique
  phone       String?
  userId      String?        @unique
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  attachments Attachment[]
  user        User?          @relation(fields: [userId], references: [id])
  notes       CustomerNote[]
  feedback    Feedback[]
  tickets     Ticket[]
}

model CustomerNote {
  id           String   @id @default(cuid())
  customerId   String
  authorUserId String
  body         String
  createdAt    DateTime @default(now())
  author       User     @relation(fields: [authorUserId], references: [id])
  customer     Customer @relation(fields: [customerId], references: [id])

  @@index([customerId, createdAt])
  @@index([authorUserId])
}
```

- `Customer.email` also carries a hand-authored functional unique index, `Customer_email_lower_key` on `LOWER(email)` (migration `20260912163955_customer_email_lower_unique`, CUST-FOLLOWUP-001) — not representable in Prisma schema DSL, so it exists only in the migration SQL, alongside the schema-declared `@unique` above. This is what makes the DB the final authority for case-insensitive uniqueness (see DG-2).
- No `Customer.teamId` — confirms customers are global, not team-owned (see [Purpose](#purpose)).
- `Customer.user` relation has no explicit `onDelete` (Prisma default `Restrict`-equivalent via FK) — a linked `User` cannot be hard-deleted out from under a `Customer` silently.
- `CustomerNote` has no `updatedAt` and no update/delete service function — notes are **append-only, create/list only**, by design (no edit/delete route exists for any role).
- `Ticket.customerId` is a required, non-nullable FK (`onDelete: Restrict`) — every ticket pins its customer; a `Customer` cannot be deleted while any ticket references it (enforced doubly: application-level count check + FK `P2003` fallback — see [Delete](#delete)).
- `Attachment` is polymorphic (`ticketId? / messageId? / customerId?`, each `onDelete: Restrict`) — customer-profile attachments are one of its three parent kinds, not a separate model.

---

## Actors and Permissions

Four roles (`Role` enum): `ADMIN`, `MANAGER`, `AGENT`, `CUSTOMER`.

### Capability matrix (current behaviour, `customer.routes.ts:11-26`, verified against `specs/features/auth-rbac/spec.md`)

| Capability | ADMIN | MANAGER | AGENT | CUSTOMER |
| --- | --- | --- | --- | --- |
| List/search customers (`GET /customers`) | Yes, org-wide | Yes, org-wide | Yes, org-wide | ✗ (`403`) |
| View customer detail (`GET /customers/:id`) | Yes, any | Yes, any | Yes, any | ✗ (`403`) |
| View customer ticket history (`GET /customers/:id/tickets`) | Yes, all tickets | **Own managed team's tickets only** (empty page if teamless) | Yes, all tickets (with per-row `access` downgrade — see below) | ✗ (`403`) |
| Create customer (`POST /customers`) | Yes | Yes | ✗ (`403`) | ✗ |
| Update customer (`PATCH /customers/:id`) | Yes | Yes | ✗ (`403`) | ✗ |
| Delete customer (`DELETE /customers/:id`) | Yes, if no support history | Yes, if no support history | ✗ (`403`) | ✗ |
| View customer notes (`GET /customers/:id/notes`) | Yes | Yes | Yes | ✗ |
| Add customer note (`POST /customers/:id/notes`) | Yes | Yes | ✗ (`403`) | ✗ |
| Edit/delete a customer note | **Nobody** — no such route exists | — | — | — |
| List/download customer-profile attachments | Yes | Yes | Yes (read-only) | ✗ |
| Upload customer-profile attachment | Yes | Yes | ✗ (`403`) | ✗ |
| Read/edit own linked profile | — | — | — | Only via `/api/portal/profile` (separate boundary) |

**Non-obvious contextual rules:**

- **Customer entities themselves carry no team boundary.** Any ADMIN/MANAGER/AGENT reads/searches every customer org-wide; only the `/tickets` sub-resource is team-scoped, and only for MANAGER (see next section). This is intentional and matches `specs/features/auth-rbac/spec.md` — not a gap.
- Middleware is per-route (`requireRole(...customerReadRoles)` vs `requireRole(...customerWriteRoles)`), not a single router-level gate — matches `customer.routes.ts:15-26` exactly.
- Frontend hides mutation controls and read-guards direct create/edit URL visits for AGENT (`customer-permissions.ts`, `customer-form-page.tsx`), but **the server-side `requireRole` check is the sole real boundary** — this is UX convenience only, consistent with `specs/constitution.md`.
- `CUSTOMER`-role users are always rejected by `/api/customers/*` (`customerReadRoles`/`customerWriteRoles` never include `CUSTOMER`); own-profile access is exclusively through `/api/portal/profile`, a structurally separate boundary (`requireRole(CUSTOMER)` + `requireFreshToken`).

### Customer-Ticket Visibility (the OD-6 boundary)

`customer.service.ts:94-120` `listCustomerTickets`:

```ts
const teamId = await resolveActorTeamId(actor);
const where: Prisma.TicketWhereInput = { customerId, ...teamScopedTicketWhere(actor, teamId) };
```

This calls the **exact same canonical team-scoping helper** (`server/src/shared/team/team-scope.ts`) that Ticket-list/detail visibility uses:

- `ADMIN` → `{}` (org-wide, no team predicate).
- `MANAGER` with a managed team → `{ teamId: <their team> }`. A teamless `MANAGER` → match-nothing (`{ id: { in: [] } }`) — **empty page, no org-wide fallback**.
- `AGENT` / any other role → `{}` (their reach is not team-narrowed at this endpoint — instead, per-row `access` downgrades what they can act on; see below).

Per-row `access` (`customer.service.ts:116`):

```ts
access: actor.role !== Role.AGENT || assignedAgentId === null || assignedAgentId === actor.userId
  ? "FULL" : "SUMMARY_ONLY"
```

An `AGENT` sees **every** ticket in the customer's full history (not team- or assignment-filtered at the row-selection level), but a ticket assigned to a *different* agent is downgraded to `"SUMMARY_ONLY"` — the frontend (`customer-tickets.tsx`) renders `SUMMARY_ONLY` rows as non-interactive with a labelled badge, never linking into `/tickets/:id` (which would 404 anyway per Ticket visibility rules). This is the ADR-014 cross-agent-summary design, reused intentionally rather than re-implemented — this endpoint never widens what Ticket detail/conversation/mutation APIs already forbid.

This behaviour is **fully implemented and tested** (`customer.test.ts`, nested `describe("MANAGER customer-ticket visibility (OD-6)")`: scoped-to-managed-team, empty-page-for-teamless-manager, no-cross-team-metadata-leak, team-scope-composes-with-pagination), and matches `specs/features/tickets/spec.md` and `specs/features/auth-rbac/spec.md` word-for-word. **No gap found here** — this is the resolved OD-6 decision from the Tickets feature, correctly reused rather than duplicated.

---

## Domain Behaviour

### List (`GET /customers`)

- `search` (trimmed, ≤100, default `""`) matches `name` OR `email` OR `phone`, all case-insensitive `contains`. No `id`-exact-match branch (unlike Ticket search, which also matches ticket id exactly).
- Standard pagination (`page`, `limit`), `meta: { page, limit, total, totalPages }`.
- Each row is enriched with `openTicketCount` (a `groupBy` over non-closed statuses), `totalTicketCount` (`_count.tickets`), and `lastInteractionAt` (latest `Ticket.updatedAt`, falling back to `Customer.updatedAt` when the customer has no tickets).
- Ordered `createdAt desc`. No team scoping (see [Actors and Permissions](#actors-and-permissions)).

### Detail (`GET /customers/:id`)

- 404 `CUSTOMER_NOT_FOUND` if missing.
- Returns profile fields + linked `user` (id/name/role/email, `null` if unlinked) + `attachments` (id/fileName/mimeType/createdAt, newest first) + a computed `supportSummary` (`openTicketCount`, `totalTicketCount`, `lastInteractionAt`) — same shape family as the list row's summary fields, computed independently (a second `openTicketCount` query).
- No password hash or other `User` sensitive field is ever included.

### Create (`POST /customers`)

- `name` (trimmed, 2–100), `email` (shared `emailSchema`), `phone` (optional, shared `optionalPhoneSchema`) — `.strict()` schema, unknown fields → `400 VALIDATION_ERROR`.
- Pre-checks unique `email` (case-sensitive DB unique constraint, no explicit case-normalization on this path — see [Discovered Gaps](#discovered-gaps)) → `409 CUSTOMER_EMAIL_EXISTS`; also catches a raced Prisma `P2002` with the same error.
- `userId` is **always forced to `null`** — manual/internal customer creation never provisions or links a login. A `Customer` gets a `User` link only through self-registration or (indirectly) inbound-channel matching (see [CUSTOMER Linkage](#customer-role-linkage)).
- Writes `AuditLog CUSTOMER_CREATED` (`changes`: name/email/phone `{to: ...}`) in the same transaction.

### Update (`PATCH /customers/:id`)

- `updateCustomerSchema = createCustomerSchema.partial().refine(hasAtLeastOneField)` — at least one of `name`/`email`/`phone` required, unknown fields rejected.
- 404 `CUSTOMER_NOT_FOUND` (Prisma `P2025`) if missing; 409 `CUSTOMER_EMAIL_EXISTS` (Prisma `P2002`) on a duplicate email.
- `AuditLog CUSTOMER_UPDATED` is written **only if `changedFields` is non-empty** — a submitted-but-identical PATCH (e.g. same email resubmitted) writes no audit row and produces no observable change, but still returns `200` with the current record.

### Delete (`DELETE /customers/:id`)

- Blocked with `409 CUSTOMER_HAS_SUPPORT_HISTORY` whenever **any** of the following is true: `userId !== null` (has a login), or `tickets`/`feedback`/`notes`/`attachments` count > 0. There is no partial/cascading delete path and no override for any role, including ADMIN.
- On success: `tx.customer.delete` + `AuditLog CUSTOMER_DELETED`, `204 No Content`.
- A raced FK violation (`P2003`) is caught and mapped to the same `409 CUSTOMER_HAS_SUPPORT_HISTORY` as a defensive fallback to the application-level check.
- In practice, a `Customer` created only through `POST /customers` and never engaged (no ticket/note/attachment/login) is the only deletable case — any customer with real support history is permanently retained.

### Notes

- `listCustomerNotes` — no role/team narrowing beyond route RBAC (already-read-gated); ordered `createdAt desc`; returns `author` (id/name/role).
- `addCustomerNote` — author is **always** the authenticated actor (`request.auth.userId`), never client-supplied; `body` 1–5000 trimmed chars; writes `AuditLog CUSTOMER_NOTE_ADDED` with `metadata.noteId`.
- **No edit or delete route exists for a `CustomerNote`**, for any role — notes are permanent once added. This mirrors `TicketNote`'s general append-only posture but is stricter (Tickets has no note-edit route either, so this is consistent, not a Customers-specific gap).

### CUSTOMER-role Linkage

`Customer.userId` is set through exactly three code paths, **none of which live in `customer.service.ts`**:

1. **Self-registration** (`auth.service.ts` `registerCustomer`) — creates `User(role=CUSTOMER)` + `Customer` in one transaction, `userId: createdUser.id`. This is the only path that *creates* the link.
2. **Portal profile edit** (`portal-profile.service.ts` `updateProfile`) — updates the already-linked `Customer`'s name/email/phone transactionally with the `User` record; does not create a new link.
3. Manual creation via `customer.service.ts createCustomer` **always forces `userId: null`** — there is no internal-CRM flow that creates a `User`+`Customer` pair together, or that retroactively links an existing unlinked `Customer` to a `User`.

A `CUSTOMER`-role user can never reach `/api/customers/*` (rejected by role allowlist); their only self-view/self-edit surface is `/api/portal/profile`.

### Duplicate/parallel Customer-mutation paths outside this module

The Customers module (`customer.service.ts`) does **not** own every `Customer` row mutation in the system — channel-driven ticket ingestion creates or matches customers inline, bypassing this module's audit trail entirely:

| Path | Behaviour |
| --- | --- |
| `auth.service.ts` `registerCustomer` | Creates `Customer` on self-signup (see above). |
| `auth.service.ts` (profile-adjacent update, ~line 281) | `tx.customer.update` synced with an auth-side `User` change. |
| `portal-profile.service.ts updateProfile` | `tx.customer.update` on Portal self-edit. |
| `email.service.ts matchOrCreateCustomer` | Inbound email: matches by email (case-insensitive) or creates `{ name, email }`. |
| `sms.service.ts` inbound handler | Matches by phone or creates `{ name: phone, phone, email: "sms-<digits>@no-email.invalid" }` (synthetic placeholder email). |
| `whatsapp.service.ts` inbound handler | Matches by phone/E.164 or creates `{ name: profileName \|\| e164, email: "wa-<digits>@no-email.invalid", phone: e164 }`. |

Of these five non-Portal, non-self-registration paths, the three inbound-channel rows (email/SMS/WhatsApp) now write a `CUSTOMER_CREATED` `AuditLog` row (`actorId: null`) on customer creation, reusing `createAuditLog` inside their existing transaction — see [Discovered Gaps](#discovered-gaps) DG-1. `auth.service.ts registerCustomer`/its profile-adjacent update and `portal-profile.service.ts updateProfile` remain unaudited, unchanged by this fix.

`ticket.service.ts` itself never creates a `Customer` — `validateRelations` only validates a pre-existing `customerId`, 404ing if absent; internal `POST /api/tickets` requires the customer to already exist.

---

## Realtime / Notifications

- **No `Customer`-specific realtime event type exists.** `Customer.id` / `Ticket.customerId` appear in `realtime.types.ts` only as a routing/filter key for a `CUSTOMER`-role subscriber's own ticket events — realtime is entirely ticket-event-driven (`ticket.message.created`, `ticket.updated`, `notification.created`, `notification.read`, per `specs/architecture.md`).
- **No in-app `Notification` type is generated for customer create/update/delete/note-add.** Customer CRUD is silent from a notification standpoint; only the `AuditLog` trail records it.
- This is a consistent, intentional design choice (customer profile edits are not time-sensitive operational events the way ticket assignment/escalation are) rather than an oversight — no doc claims otherwise.

---

## Validation and Error Semantics

All customer Zod schemas are `.strict()` — an unknown field in any request body/query → `400 VALIDATION_ERROR` before the controller runs (`specs/constitution.md` "Validation").

| Error | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Zod `.strict()`/field-constraint failure on any customer route. |
| `CUSTOMER_NOT_FOUND` | 404 | Detail/update/delete/tickets/notes against a missing `id`. |
| `CUSTOMER_EMAIL_EXISTS` | 409 | Create/update to an email already used by another `Customer` (pre-check + Prisma `P2002` fallback). |
| `CUSTOMER_HAS_SUPPORT_HISTORY` | 409 | Delete blocked by a login link or ticket/feedback/note/attachment history (application check + Prisma `P2003` fallback). |
| `AUTHENTICATION_REQUIRED` | 401 | Missing `request.auth` reaching `actorId()` / note/ticket-history handlers (defence-in-depth; `requireAuth` already gates the router). |
| `FORBIDDEN` (implicit, via `requireRole`) | 403 | Wrong role for the route (e.g. AGENT on a write route, CUSTOMER anywhere). |

No customer-specific error is thrown for the OD-6 team-scoping outcome — a teamless MANAGER simply receives an empty paginated `data: []` for `GET /:id/tickets`, not an error.

---

## Privacy / Security Boundaries

- Server-side `requireRole` is the sole authorization boundary; `customer-permissions.ts` and route guards on the frontend are UX convenience only (`specs/constitution.md`).
- Customer detail/list never exposes `User.passwordHash` or any other sensitive `User` field — only `id`/`name`/`email`/`role` of a linked user.
- A `CUSTOMER`-role identity cannot reach any `/api/customers/*` endpoint under any circumstance — the only self-service surface is `/api/portal/profile`, a structurally distinct router.
- Customer profiles are **not** team-isolated — any AGENT/MANAGER/ADMIN can see any customer's contact info and notes org-wide. Only the ticket-history sub-resource applies team scoping (MANAGER only). This is documented, intentional behaviour, not a boundary gap — see [Purpose](#purpose) and the OD-6 section.
- Deletion safety (`CUSTOMER_HAS_SUPPORT_HISTORY`) prevents silently losing support history or orphaning a linked login via a customer delete.

---

## Frontend Pages and Query/Cache Architecture

Matches the repo-wide pattern (`specs/architecture.md` "Frontend Architecture"): one `customer-api.ts` (thin axios wrappers, `{ data: T }` envelope unwrapping) + one `customer-hooks.ts` (TanStack Query hooks with a `customerKeys` factory) per feature, RHF + Zod forms mirroring server schemas, TanStack Table for the list, no local component-state duplication of server state. `customer-permissions.ts`'s `canManageCustomers` gates mutation UI only; the list/detail pages themselves are reachable by AGENT per the backend `customerReadRoles`.

---

## Current Tests

**Server** (`server/src/modules/customers/customer.test.ts`): unauthenticated/CUSTOMER rejection on every route; AGENT read access + notes read; ADMIN org-wide ticket-history with `FULL` access; a nested `describe("MANAGER customer-ticket visibility (OD-6)")` block with 4 cases (scoped to managed team, empty page for teamless manager, no cross-team metadata leak, team-scope composes with pagination); AGENT gets complete history with server-derived `access` + pagination; list pagination/search/counts; create (normalization, duplicate-email conflict); get (no sensitive fields, 404); update (only normalized fields change); note creation (author is always the authenticated actor); delete refusal when history exists, delete success when fully unlinked.

**Client** (`customer-pages.test.tsx`, `customer-update-flow.test.tsx`, `customer.schemas.test.ts`): loading/empty states, debounced search, table + pagination, create-form validation, detail + note submission, AGENT read-only enforcement (list/detail, notes-add hidden), AGENT sees the full ticket set with `FULL`-vs-`SUMMARY_ONLY` link/non-link rendering, isolated pagination-hook behaviour, ticket-load-failure vs empty-state distinction, Arabic/RTL rendering for list/detail/restricted summaries, refetch-before-navigate after a partial `PATCH`, form-value retention on failure, `.strict()` schema rejection of unknown fields.

**Coverage assessment:** the OD-6 team-scoping boundary — the one genuinely subtle cross-role rule this feature has — is explicitly and directly tested server-side, including the negative case (no cross-team leak) and the teamless-manager edge case. No test gap was found for the behaviour actually implemented.

**DG-1/DG-2 regression coverage (added):** `customer.test.ts` covers case-insensitive duplicate-email detection on create and update, and self-update exclusion (`NOT: { id: customerId }`), alongside the unchanged exact-case regression cases. `email.test.ts`, `sms.test.ts`, and `whatsapp.test.ts` each assert exactly one `CUSTOMER_CREATED` audit row on a new-customer create and no audit row on a matched/existing customer; `sms.test.ts` additionally gained the prisma-mock scaffolding needed to exercise `processInboundSms` directly (previously untested beyond provider/signature checks) and asserts a duplicate webhook redelivery produces no customer/ticket/audit work.

**CUST-FOLLOWUP-001 regression coverage (added):** `customer.test.ts` gained two race-simulation tests (create and update) that stub the app-level `findFirst` pre-check to miss (as it would in the real race window) and stub the underlying Prisma call to reject with the exact `P2002`/`meta.target: ["lower(email)"]` shape confirmed against the real dev database's functional index, asserting the existing catch still returns `409 CUSTOMER_EMAIL_EXISTS`. This proves the code's reaction to a genuine DB-level conflict, independent of and in addition to the real-database verification performed directly against Postgres (duplicate scan + a live P2002 reproduction) during implementation.

---

## Documentation Drift

**None found.** Every doc section checked (`docs/04-database-design.md` Customer/CustomerNote field lists, `docs/05-api-contract.md` customer routes incl. the OD-6-scoped `/tickets` endpoint, `docs/06-auth-rbac.md` capability matrix + OD-6 writeup, `docs/09-frontend-guidelines.md` Customer List/Detail UX, `docs/18-ui-pages-spec.md` §8–10 page specs) matches the current implementation. This is a materially different outcome than the Tickets feature's discovery pass, which found several drifted docs — Customers' docs were kept in lockstep, likely because the OD-6 work (done as part of the Tickets SDD cycle) touched both `customer.service.ts` and `docs/05`/`docs/06` together.

---

## Discovered Gaps

Two minor items, both below the bar for a product decision — neither changes documented behaviour, both are safe to leave as-is or fold into a future `plan.md` at the developer's discretion.

### DG-1 — Inbound-channel customer creation is now audited (implemented)
**Classification: closed.** Originally architecture debt (consistent with an existing precedent, not a bug).
Email/SMS/WhatsApp inbound handlers create or match `Customer` rows directly via Prisma, bypassing `customer.service.ts`. As implemented, each handler's create-only branch (`email.service.ts matchOrCreateCustomer`, `sms.service.ts processInboundSms`, `whatsapp.service.ts matchOrCreateCustomer`) now writes one `CUSTOMER_CREATED` `AuditLog` row (`actorId: null`, `metadata.actorType: "SYSTEM"`) inside the same transaction as the create, mirroring `customer.service.ts createCustomer`'s shape (`changes: { name, email, phone } { to: ... }`). The match branches (existing customer reused) write no audit row. No inbound path performs a customer *update* — that was already true pre-fix and stays true; "and/or update" in the gap's original shorthand name never corresponded to an actual code path. `requestContext` (IP/UA) is intentionally omitted, as originally planned — that remains a possible future follow-up, not part of this fix.

### DG-2 — Email uniqueness is now case-insensitive for manual create/update (implemented)
**Classification: closed.** Originally architecture debt (low impact).
`createCustomer`'s pre-check and `updateCustomer`'s new pre-check now match case-insensitively (`prisma.customer.findFirst({ where: { email: { equals, mode: "insensitive" } } })`), reusing the exact convention `email.service.ts matchOrCreateCustomer` already used. `updateCustomer` previously had no pre-check at all for email conflicts (only the `P2002` fallback); it now excludes the current row (`NOT: { id: customerId }`) so a customer re-submitting its own email never self-conflicts. In practice this means a manual create/update whose email matches an existing row differing only in case now returns `409 CUSTOMER_EMAIL_EXISTS` instead of silently creating a functional duplicate.

**CUST-FOLLOWUP-001 (implemented, closes the residual race noted below):** a PostgreSQL functional unique index on `LOWER(email)` now makes the database the final authority for case-insensitive uniqueness, coexisting with the plain exact-case `@unique` on `Customer.email`. A violation of either constraint still surfaces as Prisma `P2002`, so `createCustomer`/`updateCustomer`'s existing `P2002` catch blocks require no code change — they already map any `P2002` on this model to `409 CUSTOMER_EMAIL_EXISTS`. The residual risk below is now closed; see `tasks.md` `CUST-FOLLOWUP-001` for the migration name, dev-database verification steps, and regression-test detail, and `plan.md` "Database Impact" for the original no-DB-change rationale this follow-up superseded.

~~The Postgres `@unique` constraint on `Customer.email` itself stays case-sensitive (no migration, no `citext`) — the existing `P2002` catch blocks remain as the defensive fallback for a genuine same-case race, and a theoretical simultaneous-insert race between two case-variant emails both passing the application-level pre-check is an accepted residual risk, unchanged in kind from the exact-case race the module already tolerated.~~ **(Closed by CUST-FOLLOWUP-001 above.)**

No other implementation bugs, test gaps, or product decisions were found during this pass.

---

## Open Decisions

**None.** Every ambiguity encountered during discovery resolved cleanly against existing code, docs, or the Tickets feature's precedent (OD-3, OD-6, ADR-014) without inventing new behaviour.

---

## Recommendation

DG-1 and DG-2 are implemented and manually verified against the real dev database (see [Feature Status](#feature-status)); the task set is `IMPLEMENTED + VERIFIED ON SDD BRANCH`. CUST-FOLLOWUP-001 closed the one residual risk this spec previously accepted (the case-insensitive concurrent-write race) with a DB-level functional unique index — see the DG-2 entry above and `tasks.md`. No further Customers work is queued; any additional inbound-audit `requestContext` (IP/UA) plumbing remains a deliberately deferred, separate follow-up, not a blocking gap.
