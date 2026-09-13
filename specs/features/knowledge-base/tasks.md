# Knowledge Base Audit Logging — Task Breakdown

Decomposition of [`plan.md`](./plan.md) into small, independently verifiable
tasks. Source of truth for scope is [`spec.md`](./spec.md) and `plan.md`.
This file adds **no new decisions** — every task is anchored to an
already-resolved plan decision.

Status: all 11 tasks below (`KB-AUDIT-001`…`011`) are implemented and
verified — see [Task Breakdown Status](#task-breakdown-status) for the
final report.

---

## Scope Guard

Implementation of this task set is a **brownfield audit-logging enhancement
only**. It must **not** introduce, and any PR that does must be rejected in
review, unless `spec.md` **and** `plan.md` are first explicitly revised and
re-approved:

- frontend feature changes (no KB audit panel, no `AuditLog` viewer on KB
  pages, no new API call, no new column/toast) — `client/**` stays untouched
- Knowledge Base redesign or refactor of existing KB behavior
- Prisma schema changes (`server/prisma/**`)
- database migrations
- new runtime or dev dependencies / lockfile changes
- public / anonymous Knowledge Base, SEO surface, public article URLs
- bilingual / per-language content schema, translation tables
- `ARCHIVED` lifecycle state, soft delete, restore flows
- structured KB categories / `KnowledgeCategory` model
- team-scoped KB ownership or filtering for `MANAGER`
- `AGENT` authoring (create/edit/publish/unpublish/delete)
- realtime / SSE events for KB
- any new audit-read endpoint, filter, or UI beyond the existing
  `ADMIN`-only audit views
- semantic / vector / embedding search, RAG, AI article generation
- rich-text / Markdown authoring or rendering

The **only** production behavior change allowed by this task set:

- audit article **create**
- audit article **edit** (meaningful change to `title` / `content` /
  `category`)
- audit article **publish** (`DRAFT → PUBLISHED`)
- audit article **unpublish** (`PUBLISHED → DRAFT`)
- audit article **delete** (hard delete)

API request/response contracts, status codes, error codes, RBAC,
pagination, search, ordering, portal visibility, and AI grounding behavior
all stay exactly as they are today.

---

## Implementation Discipline (for later agents)

Implement **one task at a time**. Do not chain tasks.

For each task:

1. Read `AGENTS.md` (preflight + Git Safety Rules).
2. Read `specs/features/knowledge-base/spec.md`.
3. Read `specs/features/knowledge-base/plan.md`.
4. Read this `tasks.md`.
5. Inspect the actual target files in the repo (do not implement from the
   plan text alone).
6. Implement only the selected task.
7. Run that task's **Verification** commands/checks.
8. Report files changed, commands run, and results. Show a suggested commit
   message; do **not** commit, stage, push, merge, rebase, or amend.
9. Do **not** proceed to the next task unless explicitly instructed.

Keep the SDD chain honest: if inspection contradicts the plan (e.g.
`AuditLog.entityType` turns out to be a DB enum, or another module imports
`knowledge-article.service`), **stop and report** — do not expand scope to
absorb the contradiction.

---

## Task List

- [x] KB-AUDIT-001 — Add Knowledge Base audit constants
- [x] KB-AUDIT-002 — Wire server-derived audit request context into the KB mutation path
- [x] KB-AUDIT-003 — Audit article creation (transactional)
- [x] KB-AUDIT-004 — Audit meaningful article edits (title / content / category)
- [x] KB-AUDIT-005 — Audit publish and unpublish lifecycle transitions
- [x] KB-AUDIT-006 — Audit hard delete
- [x] KB-AUDIT-007 — Add mutation audit tests (+ one-time test-infra mock port)
- [x] KB-AUDIT-008 — Add negative / no-audit tests
- [x] KB-AUDIT-009 — Add transaction atomicity / audit-failure test
- [x] KB-AUDIT-010 — Documentation reconciliation
- [x] KB-AUDIT-011 — Final verification and implementation-readiness report

---

## Dependency Model

```
KB-AUDIT-001
   │
   ▼
KB-AUDIT-002
   │
   ├────────────► KB-AUDIT-003 ──► KB-AUDIT-004 ──► KB-AUDIT-005
   │                                                     │
   └────────────► KB-AUDIT-006                           │
                       │                                 │
                       └───────────────┬─────────────────┘
                                       ▼
                              KB-AUDIT-007  (needs 003, 004, 005, 006)
                                       │
                       ┌───────────────┼───────────────┐
                       ▼               ▼               ▼
                 KB-AUDIT-008    KB-AUDIT-009    (both need 007)
                       │               │
                       └───────┬───────┘
                               ▼
                        KB-AUDIT-010   (needs implemented behavior: 003–006)
                               │
                               ▼
                        KB-AUDIT-011   (needs all of 001–010)
```

Real (not forced-linear) dependencies:

- **KB-AUDIT-003 / 004 / 005 are serialized** because they all edit the same
  region of `updateKnowledgeArticle` / `createKnowledgeArticle` and the
  action-selection branch; 005 extends the branch 004 introduces.
- **KB-AUDIT-006 (delete) is independent** of 003/004/005 — it touches a
  different service function (`deleteKnowledgeArticle`). It only needs
  KB-AUDIT-001 (constants) and KB-AUDIT-002 (context wiring). It may be done
  in parallel with 003–005.
- **KB-AUDIT-007** depends on all four implementation tasks (003–006)
  because it asserts their behavior. It also performs the one-time
  `$transaction` / `auditLog` mock port that 008 and 009 reuse.
- **KB-AUDIT-008 and KB-AUDIT-009** each depend on 007 (shared test infra)
  but not on each other; they can be done in either order or in parallel.
- **KB-AUDIT-010** needs the implemented behavior (003–006) to exist so the
  docs describe reality; it does not strictly need the tests, but running it
  after 009 is recommended.
- **KB-AUDIT-011** is the gate — it depends on everything.

---

## KB-AUDIT-001 — Add Knowledge Base audit constants

### ID
`KB-AUDIT-001`

### Title
Add Knowledge Base audit constants

### Goal
Extend the existing audit vocabulary so Knowledge Base mutations can be
recorded with standard entity-type / action string constants. Application
level only — no schema, no migration.

### Depends On
None

### Expected Files
- `server/src/modules/audit-logs/audit-log.constants.ts`

### Requirements
- Add one entity type to `AUDIT_ENTITY_TYPES`: `KNOWLEDGE_ARTICLE`
  (value `"KNOWLEDGE_ARTICLE"`), matching the existing
  `SCREAMING_SNAKE_CASE` model-name convention (`USER`, `TICKET`,
  `SLA_RULE`, `DEPARTMENT`, `BRANCH`, `TEAM`).
- Add five actions to `AUDIT_ACTIONS`:
  - `KNOWLEDGE_ARTICLE_CREATED`
  - `KNOWLEDGE_ARTICLE_UPDATED`
  - `KNOWLEDGE_ARTICLE_PUBLISHED`
  - `KNOWLEDGE_ARTICLE_UNPUBLISHED`
  - `KNOWLEDGE_ARTICLE_DELETED`
- Follow the exact key/value shape and ordering style already used in the
  file (e.g. the `DEPARTMENT_*` / `USER_ACTIVATED` / `USER_DEACTIVATED`
  entries).
- No change to any existing constant, type, or export.
- No change to `AuditChanges` or any other type.

### Out of Scope
- Any change to `knowledge-article.service.ts`, the controller, routes, or
  tests.
- Any Prisma schema / enum change, any migration.
- Any use of the new constants yet.

### Verification
- `cd server && npx tsc --noEmit` (or the project's server typecheck script)
  — compiles clean.
- `cd server && npm run lint` — clean for the changed file.
- `git diff server/src/modules/audit-logs/audit-log.constants.ts` — shows
  **only** the six additions (one entity type, five actions), nothing
  reordered or reformatted.
- `git status` — only `audit-log.constants.ts` modified; no
  `server/prisma/**` change, no migration file.

### Definition of Done
- `AUDIT_ENTITY_TYPES.KNOWLEDGE_ARTICLE` and the five
  `AUDIT_ACTIONS.KNOWLEDGE_ARTICLE_*` constants exist and are exported the
  same way as their neighbours.
- Server typecheck and lint pass.
- No other file changed; no schema/migration/dependency change.
- No consumer references the new constants yet.

---

## KB-AUDIT-002 — Wire server-derived audit request context into the KB mutation path

### ID
`KB-AUDIT-002`

### Title
Wire server-derived audit request context into the KB mutation path

### Goal
Prepare the internal Knowledge Base mutation path to pass a server-derived
actor id and request context (IP / User-Agent) from the controller into the
service layer, without changing route contracts, response shapes, or
behavior yet.

### Depends On
`KB-AUDIT-001`

### Expected Files
- `server/src/modules/knowledge-base/knowledge-article.controller.ts`
- `server/src/modules/knowledge-base/knowledge-article.service.ts`
  (signature definitions only, where required for compilation)

### Requirements
- In the controller `create` / `update` / `remove` handlers, derive:
  - the **actor id** from the authenticated server request context using the
    existing `actor(request)` helper (`request.auth.userId`) — never from
    request body, query, params, or headers.
  - **IP / User-Agent** from the existing `getAuditRequestContext(request)`
    helper (`server/src/modules/audit-logs/audit-request-context.ts`) — do
    not read headers directly, do not add a second context reader.
- Extend the service function signatures per the plan's "Request Context"
  section:
  - `createKnowledgeArticle(input, actor, requestContext?)` — `actor`
    already exists; add optional `requestContext`.
  - `updateKnowledgeArticle(id, input, actorId, requestContext?)` — add
    `actorId` and optional `requestContext`.
  - `deleteKnowledgeArticle(id, actorId, requestContext?)` — add `actorId`
    and optional `requestContext`.
- Route definitions in `knowledge-article.routes.ts` stay **unchanged**
  (RBAC + validation already correct).
- Request Zod schemas stay `.strict()` and unchanged — no new accepted
  field.
- Response bodies, status codes, and error codes unchanged.
- No frontend change.
- Do **not** add `createAuditLog(...)` calls in this task. If keeping the
  code compilable during the signature transition requires threading the new
  parameters through now, do so with **no behavior change** (parameters
  accepted but unused, or only forwarded). Note in the PR if this was
  necessary.
- Confirm by inspection that no module other than
  `knowledge-article.controller.ts` imports `knowledge-article.service`; if
  another importer exists, stop and report (plan assumed only the
  controller).

### Out of Scope
- Writing any `AuditLog` row.
- Wrapping mutations in `prisma.$transaction` (done per-mutation in
  003 / 004 / 005 / 006).
- Widening any `findUnique` `select` (done in the mutation tasks).
- Any route / schema / response change.

### Verification
- `cd server && npx tsc --noEmit` — compiles clean with the new signatures.
- `cd server && npm run lint` — clean.
- `cd server && npx vitest run src/modules/knowledge-base` — existing KB
  suites still green (no behavior change).
- `git diff` — only the controller and service signature lines changed; no
  `createAuditLog` import used yet (or imported but only wired, per note);
  routes file untouched.
- `git status` — no `client/**`, no `server/prisma/**`, no migration,
  no manifest/lockfile change.

### Definition of Done
- Controller passes server-derived actor id + `getAuditRequestContext(request)`
  result into all three mutating service calls.
- Service signatures accept `actorId` / `actor` and optional
  `requestContext`.
- Actor identity provably cannot come from client input (schemas strict,
  value sourced from `request.auth`).
- Existing KB tests pass unchanged; route contracts and response shapes
  identical.
- Sole importer of the service confirmed to be the controller (or
  discrepancy reported).

---

## KB-AUDIT-003 — Audit article creation (transactional)

### ID
`KB-AUDIT-003`

### Title
Audit article creation (transactional)

### Goal
Record exactly one `AuditLog` row for every successful internal Knowledge
Base article creation, atomically with the create.

### Depends On
`KB-AUDIT-001`, `KB-AUDIT-002`

### Expected Files
- `server/src/modules/knowledge-base/knowledge-article.service.ts`
  (`createKnowledgeArticle`)

### Requirements
- Wrap the current bare `prisma.knowledgeArticle.create(...)` in a new
  `prisma.$transaction(async (tx) => { ... })` callback.
- Inside the transaction, after the `create`, call
  `createAuditLog({ ... }, tx)` (pass the transaction client as the `db`
  parameter) with:
  - `action: AUDIT_ACTIONS.KNOWLEDGE_ARTICLE_CREATED` (always emitted for a
    create)
  - `entityType: AUDIT_ENTITY_TYPES.KNOWLEDGE_ARTICLE`
  - `entityId`: the created article's `id`
  - `actorId`: from the authenticated server context (the `actor` argument
    wired in KB-AUDIT-002)
  - `changes: { title: { to }, category: { to }, status: { to } }`
    (`to`-only on create, mirroring `createDepartment`)
  - `requestContext` (IP / UA) forwarded through
  - `metadata.contentChanged` is **not** set on create (no "before")
- The full article **body (`content`) must never appear** in `changes`,
  `metadata`, or anywhere in the audit record — not as text, excerpt,
  length, hash, or `from`/`to`.
- A failed create (validation / DB error) must roll back and produce **no**
  audit row.
- The service still returns the existing `detailSelect` projection — the
  `201 { data: <detailSelect> }` response shape is unchanged; no audit data
  is added to the response.
- Reuse `createAuditLog` and the existing `prisma.$transaction` pattern from
  `department.service.ts` (`createDepartment`). Do not add a KB-specific
  audit wrapper.

### Out of Scope
- Update / publish / unpublish / delete auditing.
- Any change to the create request schema or route.
- Tests (KB-AUDIT-007).

### Verification
- `cd server && npx tsc --noEmit` — clean.
- `cd server && npm run lint` — clean.
- `cd server && npx vitest run src/modules/knowledge-base` — existing suites
  still green (create response-shape assertions unchanged).
- Manual code read: exactly **one** `createAuditLog` call site in
  `createKnowledgeArticle`, inside the `$transaction` callback, with `tx`
  passed.
- `git diff` — change confined to `createKnowledgeArticle`; no schema /
  migration / dependency / client change.

### Definition of Done
- Successful create writes exactly one `KNOWLEDGE_ARTICLE_CREATED` audit row
  with correct entity type, entity id, server-derived actor, safe `changes`,
  and forwarded request context — inside the same transaction as the
  create.
- No `content` value in the audit record.
- Failed create ⇒ no article, no audit row (atomic).
- `POST` response body / status code unchanged.
- Server typecheck, lint, and existing KB tests pass.

---

## KB-AUDIT-004 — Audit meaningful article edits (title / content / category)

### ID
`KB-AUDIT-004`

### Title
Audit meaningful article edits (title / content / category)

### Goal
Record exactly one `AuditLog` row for a successful `PATCH` that meaningfully
changes `title`, `content`, or `category`, while never storing article body
text. No audit row for a no-op edit.

### Depends On
`KB-AUDIT-003`

### Expected Files
- `server/src/modules/knowledge-base/knowledge-article.service.ts`
  (`updateKnowledgeArticle`)

### Requirements
- Widen the existing pre-check
  `findUnique({ where: { id }, select: { id: true } })` to
  `select: { id: true, title: true, content: true, category: true, status: true }`.
  Keep this read **outside** the transaction (mirrors `updateDepartment`).
- Wrap the `update` in a new `prisma.$transaction(async (tx) => { ... })`.
- Build `changes = changedFields(before, after, ["title", "category", "status"])`
  using the existing `changedFields(...)` helper (strict `!==` diff, real
  `from`/`to` for these bounded scalars — all safe per plan's Metadata
  Strategy table).
- Represent a **content** change only as a flat marker:
  `metadata.contentChanged = true` when `before.content !== after.content`.
  Never store the content text, an excerpt, a diff, its length, a hash, or a
  `from`/`to` pair. `content` must never be passed to `changedFields`.
- **No-op suppression:** if `changes` is empty **and** `contentChanged` is
  false, write **no** audit row. (The empty-`PATCH` case is already a `400`
  from the schema `.refine`; this covers a `PATCH` whose values equal the
  current row.)
- On a meaningful edit that does **not** change `status`, use
  `action: AUDIT_ACTIONS.KNOWLEDGE_ARTICLE_UPDATED`. (Status-derived action
  selection is added in KB-AUDIT-005 — this task may leave a clearly-marked
  seam for it, or implement the `UPDATED` branch only.)
- `entityType: KNOWLEDGE_ARTICLE`, `entityId`: the article id,
  `actorId`: server-derived, `requestContext` forwarded, all inside the
  transaction with `tx` passed to `createAuditLog`.
- The article `update` + the conditional `createAuditLog` are atomic.
- `PATCH` still returns `200 { data: <detailSelect> }` unchanged, including
  for the suppressed-no-audit case.

### Out of Scope
- Publish / unpublish action selection and `status` transition semantics
  (KB-AUDIT-005) beyond including `status` in the safe `changedFields` list.
- Delete auditing.
- Tests (KB-AUDIT-007).

### Verification
- `cd server && npx tsc --noEmit` — clean.
- `cd server && npm run lint` — clean.
- `cd server && npx vitest run src/modules/knowledge-base` — existing suites
  green (update response-shape assertions unchanged).
- Manual code read: `content` never referenced in any `changedFields` call
  or `changes` object; only `metadata.contentChanged` boolean.
- `git diff` — change confined to `updateKnowledgeArticle` (pre-check select
  widening + `$transaction` wrap + conditional audit call).

### Definition of Done
- Title-only / category-only / combined title+category edit ⇒ exactly one
  `KNOWLEDGE_ARTICLE_UPDATED` row with real `from`/`to` for the changed
  scalar fields.
- Content-only edit ⇒ exactly one `KNOWLEDGE_ARTICLE_UPDATED` row with
  `metadata.contentChanged === true` and **no** body text anywhere in the
  serialized audit call.
- No-op `PATCH` (values equal current) ⇒ no audit row; `200` response
  unchanged.
- `update` + audit write are atomic.
- Server typecheck, lint, and existing KB tests pass.

---

## KB-AUDIT-005 — Audit publish and unpublish lifecycle transitions

### ID
`KB-AUDIT-005`

### Title
Audit publish and unpublish lifecycle transitions

### Goal
Make `DRAFT → PUBLISHED` and `PUBLISHED → DRAFT` distinguishable in
`AuditLog` by `action` alone, using dedicated constants, with a single
`PATCH` that also edits fields still producing exactly one row.

### Depends On
`KB-AUDIT-004`

### Expected Files
- `server/src/modules/knowledge-base/knowledge-article.service.ts`
  (`updateKnowledgeArticle` — action-selection branch)

### Requirements
- Add status-derived action selection inside `updateKnowledgeArticle`,
  mirroring `updateDepartment`'s
  `changes.isActive !== undefined ? ACTIVATED/DEACTIVATED : UPDATED`
  branch:
  - if `changes.status` is present and the resulting status is `PUBLISHED`
    ⇒ `action = AUDIT_ACTIONS.KNOWLEDGE_ARTICLE_PUBLISHED`,
    `changes.status = { from: "DRAFT", to: "PUBLISHED" }`
  - if `changes.status` is present and the resulting status is `DRAFT`
    ⇒ `action = AUDIT_ACTIONS.KNOWLEDGE_ARTICLE_UNPUBLISHED`,
    `changes.status = { from: "PUBLISHED", to: "DRAFT" }`
  - otherwise ⇒ `action = AUDIT_ACTIONS.KNOWLEDGE_ARTICLE_UPDATED`
    (KB-AUDIT-004 behavior)
- A `PATCH` that sets `status` to its current value produces no `status`
  change ⇒ falls through to the `UPDATED` / no-op rules from KB-AUDIT-004.
- When `status` changes **together with** `title` / `category` / `content`
  in one `PATCH`:
  - exactly **one** audit row
  - the **lifecycle action wins** over generic `UPDATED`
  - `metadata.changes` still includes every safe changed field
    (`title` / `category` / `status`)
  - a co-occurring content change is still represented only by
    `metadata.contentChanged = true`
- Publish / unpublish are **not** new endpoints or new service functions —
  they remain `updateKnowledgeArticle` calls with body `{ status: ... }`.
  One `createAuditLog` call site only.
- Preserve unchanged: the two-state `DRAFT ⇄ PUBLISHED` lifecycle, the
  `PATCH` API contract, current portal visibility (unpublish immediately
  removes the article from portal list/detail), and current
  published-only AI grounding.
- Audit write stays inside the `updateKnowledgeArticle` transaction.

### Out of Scope
- New endpoints, new service functions, new request fields.
- `publishedAt` or any lifecycle field.
- Delete auditing.
- Tests (KB-AUDIT-007).

### Verification
- `cd server && npx tsc --noEmit` — clean.
- `cd server && npm run lint` — clean.
- `cd server && npx vitest run src/modules/knowledge-base` — existing suites
  green (lifecycle behavior + response shapes unchanged).
- Manual code read: still exactly **one** `createAuditLog` call site in
  `updateKnowledgeArticle`; action chosen by a single branch on
  `changes.status`.
- `git diff` — change confined to the action-selection branch inside
  `updateKnowledgeArticle`; no route / schema / portal / AI-grounding file
  touched.

### Definition of Done
- `DRAFT → PUBLISHED` ⇒ one `KNOWLEDGE_ARTICLE_PUBLISHED` row with
  `changes.status = { from: "DRAFT", to: "PUBLISHED" }`.
- `PUBLISHED → DRAFT` ⇒ one `KNOWLEDGE_ARTICLE_UNPUBLISHED` row with
  `changes.status = { from: "PUBLISHED", to: "DRAFT" }`, distinguishable
  from publish by `action` alone.
- Combined field-edit + status change in one `PATCH` ⇒ exactly one row,
  lifecycle action, all safe changed fields in `metadata.changes`, content
  as marker only.
- `status` set to current value ⇒ no lifecycle row.
- Two-state lifecycle, `PATCH` contract, portal visibility, and AI grounding
  behavior all unchanged.
- Server typecheck, lint, and existing KB tests pass.

---

## KB-AUDIT-006 — Audit hard delete

### ID
`KB-AUDIT-006`

### Title
Audit hard delete

### Goal
Record exactly one `AuditLog` row for a successful hard delete, atomically
with the delete, retaining minimal safe identifying context after the row is
gone. Delete stays a hard, permanent delete.

### Depends On
`KB-AUDIT-001`, `KB-AUDIT-002`
(independent of KB-AUDIT-003 / 004 / 005 — different service function)

### Expected Files
- `server/src/modules/knowledge-base/knowledge-article.service.ts`
  (`deleteKnowledgeArticle`)

### Requirements
- Widen the existing pre-check `findUnique` `select` to
  `{ id: true, title: true, category: true, status: true }`. Keep it
  **outside** the transaction (mirrors `deleteDepartment`).
- Wrap the delete in a new `prisma.$transaction(async (tx) => { ... })`:
  call `tx.knowledgeArticle.delete(...)` **then** `createAuditLog({ ... }, tx)`
  (same ordering as `deleteDepartment`). A throw from either rolls back both.
- Audit payload:
  - `action: AUDIT_ACTIONS.KNOWLEDGE_ARTICLE_DELETED`
  - `entityType: AUDIT_ENTITY_TYPES.KNOWLEDGE_ARTICLE`
  - `entityId`: the deleted article's id (retained even though the row is
    gone)
  - `actorId`: server-derived
  - `changes: { title: { from }, category: { from }, status: { from } }`
    (safe short scalars — minimal forensic context; extends the
    `department` delete "keep a human-readable label" convention)
  - `requestContext` forwarded
- Article **content must not be stored** in the audit record in any form.
- A failed delete — not-found (`404 KNOWLEDGE_ARTICLE_NOT_FOUND`),
  unauthorized (`403`), or DB error — must produce **no** success audit
  row. The `404` pre-check throws before the transaction.
- `DELETE` still returns `204` empty — response unchanged.
- Do **not** replace hard delete with archive / soft delete / restore.

### Out of Scope
- Create / update / publish / unpublish auditing.
- Any dependency check or cascade change on delete.
- Tests (KB-AUDIT-007).

### Verification
- `cd server && npx tsc --noEmit` — clean.
- `cd server && npm run lint` — clean.
- `cd server && npx vitest run src/modules/knowledge-base` — existing suites
  green (`204` behavior unchanged).
- Manual code read: `delete` and `createAuditLog(..., tx)` in the same
  `$transaction` callback; no `content` in the payload; pre-check `404`
  throws before the transaction opens.
- `git diff` — change confined to `deleteKnowledgeArticle`; delete is still
  `tx.knowledgeArticle.delete` (hard delete), not an update to a status
  field.

### Definition of Done
- Successful delete ⇒ exactly one `KNOWLEDGE_ARTICLE_DELETED` row with the
  deleted id as `entityId`, server-derived actor, `title` / `category` /
  `status` `from` values in `changes`, and no body — inside the same
  transaction as the delete.
- Missing / unauthorized / failed delete ⇒ no success audit row.
- `DELETE` still hard-deletes and returns `204`.
- Server typecheck, lint, and existing KB tests pass.

---

## KB-AUDIT-007 — Add mutation audit tests (+ one-time test-infra mock port)

### ID
`KB-AUDIT-007`

### Title
Add mutation audit tests (+ one-time test-infra mock port)

### Goal
Prove the five audited mutations each write exactly one correct audit row,
with no article body leakage, reusing existing audit-test patterns.

### Depends On
`KB-AUDIT-003`, `KB-AUDIT-004`, `KB-AUDIT-005`, `KB-AUDIT-006`

### Expected Files
- `server/src/modules/knowledge-base/knowledge-article.test.ts`

### Requirements
- **One-time test-infra port** (mirror `department.test.ts` lines ~18–42):
  - add `auditCreate: vi.fn()` (or the file's existing hoisted-mock style)
  - expose `auditLog: { create: mocks.auditCreate }` on the mocked
    `prisma`
  - give `prisma.$transaction` a **function-form** implementation that
    invokes the callback with a `tx` exposing `knowledgeArticle` +
    `auditLog`; **keep the array-form branch** for the existing list tests
  - reset `auditCreate` in `beforeEach`
- **Create:** successful create ⇒ `auditCreate` called **exactly once** with
  `action: KNOWLEDGE_ARTICLE_CREATED`, `entityType: KNOWLEDGE_ARTICLE`,
  `entityId` = new id, `actorId` = authenticated user, `changes` carrying
  `title` / `category` / `status` `to` values; assert **no `content`** key
  and no body substring anywhere in the serialized call; assert
  `requestContext` (ip / user-agent) forwarded. Keep the existing
  "`status` defaults to `DRAFT`, `createdById` server-set" assertions.
- **Edit:**
  - title-only ⇒ one row, `KNOWLEDGE_ARTICLE_UPDATED`, `changes.title`
    real `from`/`to`, `metadata.contentChanged` absent
  - category-only ⇒ one row, `KNOWLEDGE_ARTICLE_UPDATED`, `changes.category`
    real `from`/`to`
  - content-only ⇒ one row, `KNOWLEDGE_ARTICLE_UPDATED`,
    `metadata.contentChanged === true`, **no `content`** key, no body
    substring in the whole serialized call
  - combined `title` + `status: PUBLISHED` ⇒ **exactly one** row,
    `action: KNOWLEDGE_ARTICLE_PUBLISHED`, `changes` contains both `title`
    and `status`
  - no-op `PATCH` (values equal current) ⇒ `auditCreate` **not** called
- **Publish:** `DRAFT → PUBLISHED` ⇒ one row,
  `action: KNOWLEDGE_ARTICLE_PUBLISHED`,
  `changes.status = { from: "DRAFT", to: "PUBLISHED" }`.
- **Unpublish:** `PUBLISHED → DRAFT` ⇒ one row,
  `action: KNOWLEDGE_ARTICLE_UNPUBLISHED`,
  `changes.status = { from: "PUBLISHED", to: "DRAFT" }` — asserted
  **distinct** from the publish action constant.
- **Delete:** successful delete ⇒ `knowledgeArticle.delete` called; one row,
  `action: KNOWLEDGE_ARTICLE_DELETED`, `entityId` = id,
  `changes.title.from` present, **no body**; assert the audit `create` fires
  within the same `$transaction` callback as the delete.
- Do **not** duplicate existing KB behavior tests (response shape, RBAC
  happy-path, pagination, search) — add audit assertions to the minimum
  set of cases, extending existing tests where natural.

### Out of Scope
- Negative / no-audit tests (KB-AUDIT-008).
- Atomicity / audit-failure test (KB-AUDIT-009).
- Portal / AI-grounding test files.
- Any production-code change (if a test reveals a bug, log it per the
  bug-logging rule and fix under the relevant KB-AUDIT-00x task, not here).

### Verification
- `cd server && npx vitest run src/modules/knowledge-base/knowledge-article.test.ts`
  — all new and existing cases green.
- `cd server && npx tsc --noEmit` — test file typechecks (type fixtures with
  real domain types, not narrowed literals).
- `cd server && npm run lint` — clean.
- `git status` — only `knowledge-article.test.ts` changed; no production
  file, no schema, no dependency.

### Definition of Done
- The `$transaction` fn-form + `auditLog.create` mock is in place and the
  existing list tests (array-form `$transaction`) still pass.
- Create / edit (title / category / content / combined / no-op) / publish /
  unpublish / delete each have an "exactly one row, correct action, correct
  entity type + id, correct actor, no body leakage" assertion.
- Publish and unpublish are asserted to use distinct action constants.
- Full KB test file passes; typecheck and lint clean.
- No production code changed by this task.

---

## KB-AUDIT-008 — Add negative / no-audit tests

### ID
`KB-AUDIT-008`

### Title
Add negative / no-audit tests

### Goal
Prove `AuditLog` produces no noise and no security leak: rejected mutations
and all read paths create no audit row.

### Depends On
`KB-AUDIT-007`

### Expected Files
- `server/src/modules/knowledge-base/knowledge-article.test.ts`
- `server/src/modules/knowledge-base/knowledge-article.portal.test.ts`
  (portal reads — minimal assertion only)

### Requirements
- Extend existing rejection tests with `auditCreate` **not called**
  assertions:
  - `AGENT` create / edit / publish / unpublish / delete ⇒ `403`, no audit
  - `CUSTOMER` on an internal KB route ⇒ `401`/`403`, no audit
  - anonymous on an internal KB route (where applicable) ⇒ rejected, no
    audit
  - invalid payload (empty `PATCH` / unknown field / length-bound
    violation) ⇒ `400 VALIDATION_ERROR`, no audit
  - `PATCH` / `DELETE` on a missing id ⇒
    `404 KNOWLEDGE_ARTICLE_NOT_FOUND`, no audit (pre-check throws before
    the transaction)
- Read paths create no audit row:
  - internal `GET` list / `GET` detail / internal search ⇒ `auditCreate`
    not called
  - portal list / detail / search (`knowledge-article.portal.test.ts`) ⇒
    no audit
  - AI grounding / read path: assert no `auditLog.create` on the KB
    retrieval path where practical (these modules —
    `ai-kb-candidates` / `customer-ai-context` — do not import
    `createAuditLog`; a light assertion or an explicit "does not import"
    note is sufficient)
- Where a behavior is already fully covered by an existing test, add only
  the **minimum** extra assertion (`expect(auditCreate).not.toHaveBeenCalled()`)
  rather than a new duplicate test.

### Out of Scope
- New behavior tests for RBAC / validation / not-found already covered
  elsewhere (only add the no-audit assertion).
- Atomicity test (KB-AUDIT-009).
- Any production-code change.

### Verification
- `cd server && npx vitest run src/modules/knowledge-base` — all cases
  (internal + portal) green.
- `cd server && npx tsc --noEmit` — clean.
- `cd server && npm run lint` — clean.
- `git status` — only KB test files changed.

### Definition of Done
- Every rejection path (`403` AGENT, `401`/`403` CUSTOMER/anon, `400`
  validation, `404` missing) asserts no success audit row.
- Internal reads, portal reads, and the AI grounding retrieval path assert
  no audit row (or documented "does not import `createAuditLog`").
- No duplicated behavior tests; assertions added in place where possible.
- KB test suites pass; typecheck and lint clean; no production code
  changed.

---

## KB-AUDIT-009 — Add transaction atomicity / audit-failure test

### ID
`KB-AUDIT-009`

### Title
Add transaction atomicity / audit-failure test

### Goal
Verify the core transactional guarantee: if the audit write fails inside the
transaction, the Knowledge Base mutation does not remain committed.

### Depends On
`KB-AUDIT-007`

### Expected Files
- `server/src/modules/knowledge-base/knowledge-article.test.ts`

### Requirements
- Using the repo's established transaction-mocking strategy (the fn-form
  `$transaction` mock from KB-AUDIT-007), make `auditCreate` **reject**
  inside the `$transaction` callback and assert:
  - the service call **rejects** (error surfaced, no resolved response)
  - the article mutation is treated as rolled back (via the mock: the
    mutation's committed effect is not observable / the transaction promise
    rejects)
- Cover at least one representative mutation. If the create / update / delete
  paths share one reusable `$transaction` + `createAuditLog(tx)` shape (they
  do, per the plan), one parameterized/representative test is acceptable —
  **document in the test** that the same pattern covers all three, rather
  than writing three near-identical brittle tests.
- Do not assert Prisma-internal rollback mechanics or other
  implementation-detail behavior beyond what proves "mutation + audit
  succeed or fail together".

### Out of Scope
- Non-transactional best-effort audit paths — there are none in this
  design; do not add one to test it.
- Any production-code change.

### Verification
- `cd server && npx vitest run src/modules/knowledge-base/knowledge-article.test.ts`
  — atomicity case(s) green, rest of the file still green.
- `cd server && npx tsc --noEmit` — clean.
- `cd server && npm run lint` — clean.
- `git status` — only `knowledge-article.test.ts` changed.

### Definition of Done
- At least one mutation has a test where `createAuditLog` fails and the
  assertion proves the article change is not persisted (transaction
  rejects).
- If one pattern covers create/update/delete, the test says so explicitly
  instead of duplicating.
- No brittle implementation-detail assertions beyond the rollback guarantee.
- KB test file passes; typecheck and lint clean; no production code changed.

---

## KB-AUDIT-010 — Documentation reconciliation

### ID
`KB-AUDIT-010`

### Title
Documentation reconciliation

### Goal
Record the implemented `AuditLog` behavior in the docs and specs accurately,
after the behavior exists — without creating a new ADR or expanding into
unrelated cleanup.

### Depends On
`KB-AUDIT-003`, `KB-AUDIT-004`, `KB-AUDIT-005`, `KB-AUDIT-006`
(run after `KB-AUDIT-009` recommended)

### Expected Files
- `docs/06-auth-rbac.md`
- `docs/05-api-contract.md` (only if it documents audit side effects for
  other entities)
- `docs/17-decisions-log.md` (only a progress note under the existing
  ADR-039 audit lineage — **no new ADR**)
- `specs/features/knowledge-base/spec.md`
- `specs/features/knowledge-base/plan.md` (only if implementation revealed a
  necessary factual correction)
- `docs/19-progress-tracking.md` (per `AGENTS.md` synchronization rule, if
  project status materially changed)

### Requirements
- `docs/06-auth-rbac.md`: one-line note under the audit-logging section /
  "Internal Knowledge Base Permissions" that KB management mutations
  (create / edit / publish / unpublish / delete) now write `AuditLog` rows
  with `entityType: KNOWLEDGE_ARTICLE`. **No permission-table change** (no
  RBAC change in this pilot).
- `docs/05-api-contract.md`: if it documents "writes an `AuditLog` entry"
  side effects for other audited entities, add the equivalent note for the
  internal KB mutation endpoints. Otherwise no change.
- `docs/17-decisions-log.md`: a short progress note under the ADR-039
  lineage, matching how the `departments` / `branches` audit additions were
  recorded (e.g. "New audit actions: `KNOWLEDGE_ARTICLE_CREATED` / …").
  **Do not create a new ADR** unless implementation genuinely revealed a
  new architectural decision (not expected — this applies ADR-039's
  established pattern to one more module).
- `spec.md`: update Acceptance Criteria or add a short "Implemented as" note
  only where actual behavior intentionally diverged from the spec; preserve
  the distinction between current behavior and the listed Future
  Enhancements.
- `plan.md`: change only if task decomposition / implementation revealed a
  contradiction — and if so, report it in the final report, do not change it
  silently.
- Do **not** expand into unrelated documentation cleanup or reformatting.

### Out of Scope
- Any new ADR (unless a genuinely new decision emerged).
- Editing docs for features listed under Out of Scope / Future Enhancements.
- Rewriting whole doc sections; formatting-only churn.

### Verification
- `git diff docs/ specs/` — changes are additive, minimal, and confined to
  the audit behavior; no unrelated edits.
- Markdown renders (no broken tables / links).
- Re-read `spec.md` "Acceptance Criteria (Enhancement)" — every implemented
  behavior is now reflected either in a criterion or an "Implemented as"
  note.
- `git status` — no `client/**`, `server/src/**`, `server/prisma/**`, or
  dependency file changed by this task.

### Definition of Done
- `docs/06-auth-rbac.md` has the audit note; no permission-table change.
- `docs/05-api-contract.md` and `docs/17-decisions-log.md` updated only as
  conditionally required above; no new ADR.
- `spec.md` reflects implemented behavior; current-vs-future distinction
  preserved.
- `plan.md` untouched, or its correction reported (not silent).
- Progress tracker updated per `AGENTS.md` if status materially changed;
  which sections changed is stated.
- No production / schema / dependency file changed.

---

## KB-AUDIT-011 — Final verification and implementation-readiness report

### ID
`KB-AUDIT-011`

### Title
Final verification and implementation-readiness report

### Goal
Verify the completed pilot against `spec.md` and `plan.md` and produce the
final implementation-readiness report. No merge, no push.

### Depends On
`KB-AUDIT-001` … `KB-AUDIT-010` (all)

### Expected Files
- None (verification + report only). No code, schema, or doc change beyond
  what earlier tasks produced.

### Requirements
- Run backend checks:
  - typecheck: `cd server && npx tsc --noEmit`
  - lint: `cd server && npm run lint`
  - Knowledge Base tests: `cd server && npx vitest run src/modules/knowledge-base`
  - AuditLog tests: `cd server && npx vitest run src/modules/audit-logs`
  - build, if project convention requires it: `cd server && npm run build`
- Confirm, by `git diff` / `git status` inspection:
  - no `client/**` production change
  - no `server/prisma/**` change, no migration file
  - no `package.json` / lockfile change
  - no new SSE / realtime code for KB
  - internal + portal KB API contracts unchanged (routes, request/response
    shapes, status codes, error codes)
  - no article body (`content`) in any `AuditLog` metadata / changes
  - all five mutation types (create / edit / publish / unpublish / delete)
    audited **exactly once** on success
  - reads (internal list/detail/search, portal list/detail/search, AI
    grounding) produce **no** audit rows
  - failed mutations (`403` / `400` / `404`) produce **no** success audit
    row
  - audit `actorId` is server-derived only
  - transaction atomicity is covered by a test
- Compare the implementation against **every** applicable Acceptance
  Criterion in `spec.md` (both the "Regression — existing behavior must not
  change" block and the "Enhancement — audit-log behavior to implement"
  block) and record pass/fail per criterion.
- Produce the final implementation-readiness report: files changed across
  the whole pilot, exact Git state (unstaged / staged / committed —
  expected: unstaged, uncommitted), verification results, known
  limitations, suggested commit message.

### Out of Scope
- `git commit`, `git push`, `git merge`, `git rebase`, `git amend`,
  staging.
- Any code / schema / dependency change (if a criterion fails, report it and
  route the fix back to the owning KB-AUDIT-00x task).

### Verification
- All backend checks above run and their real output captured (no inferred
  results).
- `git diff --check` — clean (no whitespace errors / conflict markers).
- `git status` — working tree contains only the pilot's intended changes,
  unstaged and uncommitted.

### Definition of Done
- Typecheck, lint, KB tests, and AuditLog tests all run and pass (or
  failures reported precisely, with the pilot **not** declared ready).
- Every applicable `spec.md` Acceptance Criterion is checked and its status
  recorded.
- The "no frontend / no schema / no migration / no dependency / no SSE /
  contracts unchanged / no body in audit / exactly-once / reads silent /
  failures silent / server-derived actor / atomicity tested" checklist is
  all confirmed.
- Final implementation-readiness report produced.
- No stage / commit / push / merge / rebase / amend performed.

---

---

# KB-RICH — Rich Text Content (task breakdown)

Decomposition of [`plan.md` → Rich Text Content — Implementation
Plan](./plan.md#rich-text-content--implementation-plan) against
[`spec.md` → Knowledge Base Rich Text Content](./spec.md#knowledge-base-rich-text-content)
(`RT-1`…`RT-9`, `BC-*`, `SEC-*`).

**This is a separate task series from `KB-AUDIT-*`.** `KB-AUDIT-001` …
`KB-AUDIT-011` stay exactly as above — completed historical work.
`KB-RICH-015` is the true final gate for the Knowledge Base feature, not
`KB-AUDIT-011`. Status: all 15 tasks below
(`KB-RICH-001`…`015`) are implemented, with every code/test-level check
passing; one non-code verification step (migration apply/rollback against a
disposable Postgres) remains explicitly pending — see the "Known
Limitation" note under `KB-RICH-015` and
[Task Breakdown Status](#task-breakdown-status).

## KB-RICH Scope Guard

Allowed by this series **only**:

- a bounded Rich Text editor for the internal article body (V1 set:
  paragraphs, H2, H3, bold, italic, underline, ordered list, unordered
  list, link, undo/redo — `RT-1.3`);
- storing the body as **server-sanitized HTML** in the existing `content`
  field;
- one **additive, nullable** `KnowledgeArticle.contentText String?`
  column + an additive non-destructive backfill (`SET contentText =
  content`);
- deriving human-readable plain text from the body for search, excerpts,
  and AI grounding via one shared helper;
- safe re-sanitizing render of the body in the internal and portal
  detail views;
- doc/spec reconciliation.

**Rejected in review unless `spec.md` + `plan.md` are revised first:**

- any new rich-text dependency (client or server); Markdown;
- images / media / uploads / tables / code blocks / raw HTML / templates
  / revision history / collaborative editing / inline comments
  (`RT-1.4`);
- any change to KB routes, methods, status/error codes, the
  `{ data, meta }` envelope, RBAC, lifecycle, or portal visibility;
- any change to `server/src/modules/audit-logs/**` or to the KB
  `createAuditLog` call sites' behavior; any article-body value (rich,
  plain, excerpt, diff, length, hash) in `AuditLog` (`RT-9`);
- any change to `client/src/features/tickets/**`;
- rewriting existing `content` rows / any destructive migration
  (`BC-4`);
- narrowing or weakening AI-grounding safety (`RT-6.5`);
- semantic/vector search.

## KB-RICH Implementation Discipline

Same as the KB-AUDIT discipline above: one task at a time, read
`AGENTS.md` + `spec.md` + `plan.md` + this file, **inspect the real
target files**, implement only the selected task, run its Verification,
report + suggested commit message, **do not** stage/commit/push/merge.
If inspection contradicts the plan (an out-of-repo `content` consumer, a
DB enum where a string was assumed, the ticket link popover not cleanly
importable, etc.) — **stop and report**, do not expand scope.

## KB-RICH Task List

- [x] KB-RICH-001 — Shared server article HTML sanitizer + plain-text flattener
- [x] KB-RICH-002 — Additive `contentText` column + non-destructive backfill migration
- [x] KB-RICH-003 — Server write path: sanitize `content`, derive/store `contentText`
- [x] KB-RICH-004 — Server read path: search + excerpt over `contentText`
- [x] KB-RICH-005 — AI grounding: ground on derived plain text, PUBLISHED-only preserved
- [x] KB-RICH-006 — Client shared `<ArticleContent>` safe render component (+ legacy fallback)
- [x] KB-RICH-007 — Client Lexical article editor + V1 toolbar
- [x] KB-RICH-008 — Wire editor into the create/edit form (hydrate rich + legacy, serialize on save)
- [x] KB-RICH-009 — Internal article detail renders via `<ArticleContent>`
- [x] KB-RICH-010 — Portal article detail renders via `<ArticleContent>`
- [x] KB-RICH-011 — i18n (EN/AR) for the editor toolbar / aria / validation copy
- [x] KB-RICH-012 — Backend tests (sanitizer, write/read, search, AI, audit-body privacy, backward compat)
- [x] KB-RICH-013 — Frontend tests (editor, form hydrate/serialize, detail + portal render, XSS, legacy)
- [x] KB-RICH-014 — Documentation & SDD reconciliation (new ADR + doc/spec updates)
- [x] KB-RICH-015 — Final Rich Text verification & Knowledge Base readiness gate

## KB-RICH Dependency Model

```
KB-RICH-001 ─┐
KB-RICH-002 ─┼─► KB-RICH-003 ─► KB-RICH-004 ─┐
             │        └────────► KB-RICH-005 ─┤
             │                                │
KB-RICH-006 ─┼─► KB-RICH-009                  │
             │   KB-RICH-010                  │
KB-RICH-007 ─┴─► KB-RICH-008 ─► KB-RICH-011   │
                                              │
        ┌───────────── KB-RICH-012 ◄──────────┘   (needs 003,004,005)
        │              KB-RICH-013 ◄─ 006,007,008,009,010,011
        │              KB-RICH-014 ◄─ 003–010
        ▼
   KB-RICH-015  (needs 001–014)
```

Notes:

- **001 and 002 are independent** and may be done in either order / in
  parallel. Both are prerequisites for 003.
- **003 → 004 → 005 are serialized** on the same service file; 004 and
  005 both consume the `contentText` that 003 writes.
- **006 and 007 are independent** client-only tasks and can run in
  parallel with the backend chain. 009 and 010 each need only 006. 008
  needs 007.
- **011** needs the editor + form (007, 008) to exist so the strings map
  to real UI.
- **012** needs the backend behavior (003–005). **013** needs the client
  behavior (006–011). **014** needs behavior to describe (003–010).
- **015** is the gate — depends on everything, and replaces
  `KB-AUDIT-011` as the true final Knowledge Base readiness check.

---

## KB-RICH-001 — Shared server article HTML sanitizer + plain-text flattener

### Goal
Provide the one server-side trusted transform for article bodies: a
sanitizer that accepts the V1 tag set and a deterministic HTML→plain-text
flattener, reusing the existing `sanitize-html` module. (`SEC-1`,
`SEC-2`, `SEC-3`, `SEC-7`, `RT-6.2`.)

### Depends On
None.

### Surface
- `server/src/shared/rich-text/reply-html.ts` — **extend in place**
  (shared module, not ticket-owned).
- `server/src/shared/rich-text/reply-html.test.ts` (or new
  `article-html.test.ts`).

### Requirements
- Export `ARTICLE_HTML_SANITIZE_OPTIONS` = `REPLY_HTML_SANITIZE_OPTIONS`
  **plus `h2`, `h3`** in `allowedTags`; identical `a` handling (schemes
  `http`/`https`/`mailto`, forced `rel="noopener noreferrer nofollow"
  target="_blank"`), identical discard mode, no `class`/`id`/`style`/
  `data-*`/event handlers/media/`iframe`/`script`.
- Export `sanitizeArticleHtml(input: string): string` mirroring
  `sanitizeReplyHtml` (returns `""` when the sanitized value has no
  visible text, so the caller can reject it).
- Provide the article flattener: reuse `replyHtmlToPlainText`, extending
  its block-boundary regex to also break on `</h1>`…`</h6>`. Export
  `articleHtmlToPlainText` (may alias `replyHtmlToPlainText`).
- **Reply behavior must not change**: `sanitizeReplyHtml` /
  `replyHtmlToPlainText` outputs identical for all existing inputs
  (headings never occur in reply HTML).

### Out of Scope
Any KB module, schema, or client change. New tags beyond `h2`/`h3`.

### Acceptance Criteria
- `sanitizeArticleHtml` keeps `<h2>`/`<h3>` and the reply set; strips
  `<script>`, `onclick=`, `<img>`, `<iframe>`, `style=`, `class=`,
  `javascript:`/`data:` hrefs; preserves visible text.
- `sanitizeArticleHtml("  <p></p> ")` → `""`.
- `articleHtmlToPlainText("<h2>A</h2><p>b</p><ul><li>c</li></ul>")` →
  readable multi-line text with no tags/entities.
- All pre-existing `reply-html` tests pass unchanged.

### Verification
`cd server && npx vitest run src/shared/rich-text && npx tsc --noEmit && npm run lint`.
`git diff` limited to the two files; no `client/**`, no `prisma/**`.

---

## KB-RICH-002 — Additive `contentText` column + non-destructive backfill migration

### Goal
Add the nullable plain-text projection column and seed it from existing
plain-text bodies, with zero data loss and full reversibility. (`plan.md`
Storage Decision; `BC-1`, `BC-4`, `RT-5`.)

### Depends On
None.

### Surface
- `server/prisma/schema.prisma` — `KnowledgeArticle` model.
- `server/prisma/migrations/<timestamp>_kb_article_content_text/migration.sql`.

### Requirements
- Add `contentText String?` to `KnowledgeArticle` (no default, no
  `@unique`, no index).
- Migration body: `ALTER TABLE "KnowledgeArticle" ADD COLUMN
  "contentText" TEXT;` then `UPDATE "KnowledgeArticle" SET "contentText"
  = "content";` (valid because at launch every row is plain text —
  `BC-1`).
- No change to `content`, `status`, `KnowledgeArticleStatus`, relations,
  or any other model.
- `prisma generate` runs; type surfaces the new optional field.
- No service/controller/route/test logic change in this task (a
  `select` that must compile may reference the field but no behavior
  change).

### Out of Scope
Reading or writing `contentText` from application code (that is
KB-RICH-003/004/005). Any non-additive DDL. Backfill via a script.

### Acceptance Criteria
- Migration applies cleanly on a scratch DB and is reversible by
  dropping the column.
- `npx prisma migrate status` clean; `npx prisma validate` passes.
- Existing rows have `contentText === content` after apply.
- One migration folder added; no edit to prior migrations.

### Verification
`cd server && npx prisma validate && npx prisma migrate diff` (or the
project's migrate workflow) on a disposable DB; `npx tsc --noEmit`.
`git status` shows only `schema.prisma` + the new migration dir.

---

## KB-RICH-003 — Server write path: sanitize `content`, derive/store `contentText`

### Goal
On create and update, store `content` as sanitized article HTML and
`contentText` as its flattened plain text, inside the existing
transaction, without changing audit behavior. (`RT-1.6`, `RT-2.2`,
`RT-2.3`, `RT-7.2`, `RT-7.5`, `RT-9`, `SEC-1`.)

### Depends On
`KB-RICH-001`, `KB-RICH-002`.

### Surface
- `server/src/modules/knowledge-base/knowledge-article.schema.ts`
- `server/src/modules/knowledge-base/knowledge-article.service.ts`
  (`createKnowledgeArticle`, `updateKnowledgeArticle`)

### Requirements
- Schema: raise `content` `.max()` to a markup-headroom value
  (`plan.md`: ~`200_000`); keep `.trim().min(1)` and `.strict()`; **no
  new field**.
- Service, both mutations: compute `html = sanitizeArticleHtml(input.content)`
  before the `tx` write; if `articleHtmlToPlainText(html)` is empty or
  exceeds 50 000 chars → throw the existing `AppError(400,
  "VALIDATION_ERROR", …)` shape (no new code).
- Persist `content: html` and `contentText: articleHtmlToPlainText(html)`.
- **Audit call sites unchanged**: `changedFields(existing, article,
  ["title","category","status"])` only; `contentChanged` still the sole
  body signal, computed on the (now sanitized) `content`; **never** put
  `content`/`contentText`/excerpt/diff/length/hash in `changes` or
  `metadata`. No new action, no extra `createAuditLog` call, same
  transaction, same no-op suppression.
- `detailSelect` / `portalDetailSelect` still return `content` (now
  HTML); `contentText` is **not** added to any projection.
- Response envelope, status codes, error codes unchanged.

### Out of Scope
Search / excerpt / AI (004, 005). Any controller/route signature change.
Any client change.

### Acceptance Criteria
- Create/update with a formatted body persist allowlisted HTML in
  `content` and matching plain text in `contentText`.
- A body of only disallowed markup → `400 VALIDATION_ERROR`, nothing
  persisted, no audit row.
- Content-only `PATCH` on a rich article → exactly one
  `KNOWLEDGE_ARTICLE_UPDATED` row, `metadata.contentChanged === true`,
  **no** body substring anywhere in the serialized `createAuditLog`
  args.
- No-op `PATCH` (same title/category/status, content sanitizes to the
  stored value) → no audit row.
- Legacy row edited → `content` becomes HTML, `contentText` refreshed,
  one `KNOWLEDGE_ARTICLE_UPDATED`.

### Verification
`cd server && npx vitest run src/modules/knowledge-base && npx tsc --noEmit && npm run lint`.
Manual read: one `createAuditLog` call site per mutation, unchanged
payload keys.

---

## KB-RICH-004 — Server read path: search + excerpt over `contentText`

### Goal
Make Knowledge Base search and the portal excerpt operate on
human-readable text, not HTML markup, without changing the search API.
(`RT-5.1`, `RT-5.2`, `RT-5.3`, `RT-7.4`.)

### Depends On
`KB-RICH-003`.

### Surface
- `server/src/modules/knowledge-base/knowledge-article.service.ts`
  (`searchWhere`, `listPublishedKnowledgeArticles`, and any internal
  list use)

### Requirements
- `searchWhere` matches `title` + `contentText` + `category` (replace the
  `content` clause with `contentText`), same `contains` +
  `mode:"insensitive"`.
- `listPublishedKnowledgeArticles` derives `excerpt` from
  `deriveExcerpt(record.contentText)` (select `contentText` instead of
  `content` for the list).
- Internal list projection: unchanged (it already omits the body); if it
  selected `content` for search only, switch to `contentText`.
- **No change** to query params, status scoping (internal = all
  statuses, portal = PUBLISHED), pagination, ordering (`updatedAt DESC,
  id ASC`), empty-state semantics, or the `{ data, meta }` shape.

### Out of Scope
AI retrieval paths (005). Detail projections (still return `content`).

### Acceptance Criteria
- A search term present in the readable body matches; a search for
  `"nofollow"`, a tag name (`li`, `strong`), or an `href` URL does
  **not** match a rich article on account of markup.
- A query that matched a legacy plain-text article before still matches
  (its `contentText` was backfilled `= content`).
- Portal list `excerpt` is plain, markup-free, ≤ 200 chars.
- Search response shape byte-identical to before for equivalent data.

### Verification
`cd server && npx vitest run src/modules/knowledge-base && npx tsc --noEmit && npm run lint`.

---

## KB-RICH-005 — AI grounding: ground on derived plain text, PUBLISHED-only preserved

### Goal
Feed models clean plain text derived from published rich bodies, keeping
every existing AI-grounding boundary. (`RT-6.1`…`RT-6.5`, `RT-8.2`.)

### Depends On
`KB-RICH-003`.

### Surface
- `server/src/modules/ai/ai-kb-candidates.ts`
- `server/src/modules/customer-ai/customer-ai-context.ts`
- `server/src/modules/customer-ai/customer-ai.service.ts`

### Requirements
- Both retrieval helpers: `select` `contentText` instead of `content`;
  keyword `OR` matches `title` + `contentText` (+ `category` where it
  already does); `deriveExcerpt(row.contentText)`.
- `customer-ai.service` `SOURCES` `CONTENT:` line uses the plain-text
  value (never raw HTML). Keep the exact per-article and overall
  truncation/limits.
- `where` stays `status = PUBLISHED`; `take` / ordering unchanged;
  projections still exclude drafts, authors, internal metadata.
- No `AuditLog` interaction on any of these paths (they don't import
  `createAuditLog` — keep it that way).
- Prompt-injection neutralization and "use only supplied sources"
  wording unchanged.

### Out of Scope
Ranking-prompt structure, model config, rate limiting, non-KB context.

### Acceptance Criteria
- Candidate excerpts and `SOURCES` contain no `<`/tag/`&nbsp;`/attribute
  noise.
- Only `PUBLISHED` articles appear; a `DRAFT` never does.
- Truncation lengths equal the pre-change values.
- No `auditLog.create` on the retrieval path (asserted or "does not
  import" noted).

### Verification
`cd server && npx vitest run src/modules/ai src/modules/customer-ai && npx tsc --noEmit && npm run lint`.

---

## KB-RICH-006 — Client shared `<ArticleContent>` safe render component

### Goal
One re-sanitizing renderer for article bodies, used by internal and
portal detail, with a byte-for-byte-unchanged legacy plain-text path.
(`RT-3.1`…`RT-3.4`, `RT-4.1`, `RT-4.3`, `SEC-5`, `BC-3`.)

### Depends On
None (client-only).

### Surface
- `client/src/features/knowledge-base/knowledge-article-content.tsx` (new)
- `client/src/lib/rich-text/article-html.ts` (new; final path confirmed
  at task time) — DOMPurify config + `LOOKS_LIKE_HTML`-style sniff.

### Requirements
- `<ArticleContent content={string} />`: if the sniff matches → DOMPurify
  sanitize (`ALLOWED_TAGS = p br h2 h3 ul ol li b strong i em u a`,
  `ALLOWED_ATTR = href target rel`, `ALLOWED_URI_REGEXP =
  ^(?:https?:|mailto:)`, `afterSanitizeAttributes` forces `target`/`rel`
  on `<a>`) → `dangerouslySetInnerHTML`; else render the existing
  `whitespace-pre-wrap break-words … dir="auto"` text node.
- Do **not** import from or edit `ticket-conversation-ui.tsx`; replicate
  the minimal config locally (scope).
- Formatting CSS for headings/lists/links scoped to the component.
- No network, no state, no query cache.

### Out of Scope
Wiring into pages (009, 010). The editor (007).

### Acceptance Criteria
- Rich input renders formatted (headings, lists, emphasis, links);
  `<script>`, `onclick`, `javascript:` href, `<img>` are gone; visible
  text kept.
- Plain-text input renders identically to the current
  `knowledge-base-detail-page` article block (same classes, `dir="auto"`).
- Renders in JSDOM without `window` errors.

### Verification
`cd client && npx vitest run src/features/knowledge-base && npx tsc -b && npm run lint`.

---

## KB-RICH-007 — Client Lexical article editor + V1 toolbar

### Goal
A bounded rich editor for the article body on the existing Lexical
stack, no new dependency. (`RT-1.1`, `RT-1.3`, `RT-1.4`, `RT-1.5`.)

### Depends On
None (client-only). Pairs with 008.

### Surface
- `client/src/features/knowledge-base/knowledge-article-editor.tsx` (new)
- `client/src/features/knowledge-base/knowledge-article-editor-toolbar.tsx` (new)
- possibly `client/src/features/knowledge-base/knowledge-article-link-popover.*`
  (copy of the ticket popover) — only if the ticket component cannot be
  imported cleanly; decide by import-graph inspection and report.

### Requirements
- `LexicalComposer` (namespace `"knowledge-article"`) + `RichTextPlugin`
  + `HistoryPlugin` + `ListPlugin` + `LinkPlugin`; nodes `HeadingNode,
  ListNode, ListItemNode, LinkNode`.
- `forwardRef` handle: `getHtml()` (via `$generateHtmlFromNodes`),
  `getPlainText()`, `hasText()`, `setHtml(value)` (hydrate from rich HTML
  or, for legacy plain text, build paragraph nodes by splitting on blank
  lines/newlines), `focus()`.
- Toolbar buttons **exactly**: paragraph, H2, H3, bold, italic,
  underline, unordered list, ordered list, link, undo, redo. Icon-only,
  `aria-pressed` on toggles, `disabled` support. **No** other control.
- Link popover keeps the ADR-041 protocol rejection
  (`javascript:`/`data:`/`vbscript:`/`file:`).
- Content element `dir="auto"`; theme uses logical properties (`ms-*`) so
  RTL works.
- No `MAX_PUBLIC_REPLY_LENGTH`, no ticket i18n keys, no AI/Quick-Reply
  bridge.

### Out of Scope
Form wiring, validation messages, i18n strings (008, 011). Any ticket
file edit.

### Acceptance Criteria
- Each V1 button applies its format; `getHtml()` returns only
  allowlisted tags; H2/H3 produced as `<h2>`/`<h3>`.
- No heading level 1, no disallowed node reachable from the toolbar.
- `setHtml` round-trips rich HTML and converts a `\n\n`-separated plain
  string into multiple `<p>`.
- Mounts/unmounts cleanly in JSDOM.

### Verification
`cd client && npx vitest run src/features/knowledge-base && npx tsc -b && npm run lint`.
Report whether the ticket link popover was imported or copied.

---

## KB-RICH-008 — Wire the editor into the create/edit form

### Goal
The article form uses the rich editor for the body, hydrating rich and
legacy content and serializing to HTML on submit, with RBAC and existing
form behavior unchanged. (`RT-1.1`, `RT-1.6`, `RT-2.1`, `RT-2.4`,
`BC-3`.)

### Depends On
`KB-RICH-007`.

### Surface
- `client/src/features/knowledge-base/knowledge-article-form-page.tsx`
- `client/src/features/knowledge-base/knowledge-article.schemas.ts`

### Requirements
- Replace the `<textarea id="kb-content">` with a `<Controller
  name="content">` wrapping `<KnowledgeArticleEditor>`; `field.value`
  holds serialized HTML; `field.onChange` on editor change.
- On `values` seeding (edit): hydrate the editor from
  `article.data.content` (rich or legacy plain — the editor's `setHtml`
  handles both).
- Zod `content` rule validates the **plain-text length** of the editor
  value: non-empty, ≤ 50 000 readable chars; keep the existing error
  message keys so copy/tests still resolve.
- Keep: RHF + `zodResolver`, the title/category inputs, the status
  `AppSelectField`, `apiError` handling, the RBAC route guard, cancel
  link, submit/redirect flow.
- No change to hooks, api client, or mutation payload **shape** (still
  `{ title, content, category, status }` — `content` is now HTML).

### Out of Scope
Detail rendering (009). i18n additions (011). Server behavior.

### Acceptance Criteria
- Creating an article with formatting sends HTML `content`; server
  round-trip renders formatted on the detail page.
- Editing an existing rich article pre-fills formatted; editing a legacy
  plain-text article pre-fills readable paragraphs.
- Empty body (after strip) blocks submit with the existing error key.
- `AGENT` still cannot reach the route (guard unchanged).

### Verification
`cd client && npx vitest run src/features/knowledge-base && npx tsc -b && npm run lint`.

---

## KB-RICH-009 — Internal article detail renders via `<ArticleContent>`

### Goal
Swap the internal detail body block to the shared safe renderer.
(`RT-3.1`, `RT-3.2`, `RT-4.1`, `RT-4.3`.)

### Depends On
`KB-RICH-006`.

### Surface
- `client/src/features/knowledge-base/knowledge-base-detail-page.tsx`

### Requirements
- Replace `<article … whitespace-pre-wrap …>{data.content}</article>`
  body with `<ArticleContent content={data.content} />` inside the same
  container (keep the card `<article>`/wrapper, `dir="auto"`, spacing,
  `max-w-3xl`).
- No change to the header, status badge, metadata row, edit/delete
  actions, or delete-confirm region.

### Out of Scope
Portal (010). Any data-fetch/hook change.

### Acceptance Criteria
- A rich article shows formatted; a legacy plain-text article shows
  exactly as before.
- No new `dangerouslySetInnerHTML` outside `<ArticleContent>`.
- Existing detail-page tests updated for the new element; behavior
  assertions (title, actions, RBAC) still pass.

### Verification
`cd client && npx vitest run src/features/knowledge-base && npx tsc -b && npm run lint`.

---

## KB-RICH-010 — Portal article detail renders via `<ArticleContent>`

### Goal
Same safe render swap for the customer portal detail view; portal list
untouched. (`RT-3.1`, `RT-3.2`, `RT-7.4`, `RT-8.2`.)

### Depends On
`KB-RICH-006`.

### Surface
- `client/src/features/portal/portal-knowledge-pages.tsx`

### Requirements
- Replace the portal detail `{article.content}` block with
  `<ArticleContent content={article.content} />` in the same `<article>`
  container (`dir="auto"`, spacing preserved).
- Portal **list** card + `excerpt` rendering unchanged (server sends
  plain text).
- Update any pinned CSS-selector assertions in
  `portal-knowledge.test.tsx` / `portal-pages.test.tsx` in **this** task
  (cerebrum note: portal tests pin layout via `.closest()` selectors).

### Out of Scope
Portal list, portal nav, portal routing, portal RBAC.

### Acceptance Criteria
- Published rich article renders formatted in the portal; legacy plain
  text unchanged.
- `DRAFT` id still yields the standard not-found outcome.
- Portal list/excerpt visually unchanged.
- Portal layout tests pass (selectors updated in the same commit).

### Verification
`cd client && npx vitest run src/features/portal && npx tsc -b && npm run lint`.

---

## KB-RICH-011 — i18n (EN/AR) for the editor toolbar / aria / validation

### Goal
Localized strings for every new UI affordance, EN + AR at parity.
(`RT-1.5`.)

### Depends On
`KB-RICH-007`, `KB-RICH-008`.

### Surface
- `client/src/locales/en/*.json`, `client/src/locales/ar/*.json`

### Requirements
- Keys for: editor `aria-label`, toolbar buttons (heading 2, heading 3,
  bold, italic, underline, bullet list, numbered list, link, undo,
  redo), link-popover fields/actions if a KB copy was made, any new
  validation copy.
- No key present in one locale and missing in the other.
- Reuse existing shared keys where an identical string already exists
  (don't duplicate `common.*`).

### Out of Scope
Non-KB locale changes. New languages.

### Acceptance Criteria
- The EN/AR parity test passes.
- Editor + toolbar render with no missing-key warning in either locale.
- RTL: toolbar and content read correctly.

### Verification
`cd client && npx vitest run && npx tsc -b && npm run lint` (or the
scoped i18n-parity + KB suites).

---

## KB-RICH-012 — Backend tests

### Goal
Prove the server behavior: sanitize, store, search, ground, and **do not
leak the body into `AuditLog`** — including backward compatibility.

### Depends On
`KB-RICH-003`, `KB-RICH-004`, `KB-RICH-005`.

### Surface
- `server/src/shared/rich-text/*.test.ts`
- `server/src/modules/knowledge-base/knowledge-article.test.ts`
- `server/src/modules/knowledge-base/knowledge-article.portal.test.ts`
- `server/src/modules/ai/ai.test.ts`
- `server/src/modules/customer-ai/customer-ai.test.ts`

### Requirements
- Sanitizer: keeps `h2`/`h3` + reply set, drops
  script/handlers/`img`/`iframe`/`style`/unsafe hrefs; reply tests
  unchanged.
- Write: `content` stored as allowlisted HTML; `contentText` = its plain
  text; XSS payload neutralized; empty-after-sanitize → `400`.
- **Audit privacy regression**: content-only `PATCH` → one
  `KNOWLEDGE_ARTICLE_UPDATED`, `metadata.contentChanged === true`, and an
  assertion that neither the HTML nor its text appears anywhere in the
  serialized `createAuditLog` call; no-op `PATCH` → no row; combined
  status+content → one lifecycle row.
- Search: readable-word match works; markup-token match does not; legacy
  (backfilled) article still matches.
- Portal: detail returns rich `content`; list `excerpt` plain, ≤ 200.
- AI: candidates + `SOURCES` markup-free; PUBLISHED-only; truncation
  limits; no `auditLog.create` on retrieval.
- Backward compat: a seeded legacy plain-text row renders through the
  read paths unchanged and grounds as plain text before any edit.

### Out of Scope
Frontend tests (013). Production-code changes (route back to 001–005 and
log a bug if a test reveals one).

### Acceptance Criteria
All the above assertions present and green; full
`src/modules/knowledge-base`, `src/modules/ai`, `src/modules/customer-ai`,
`src/shared/rich-text` suites pass; `tsc --noEmit` + lint clean.

### Verification
`cd server && npx vitest run src/modules/knowledge-base src/modules/ai src/modules/customer-ai src/shared/rich-text && npx tsc --noEmit && npm run lint`.

---

## KB-RICH-013 — Frontend tests

### Goal
Prove the client behavior: editor V1 set, form hydrate/serialize (rich +
legacy), safe render internal + portal, XSS dropped.

### Depends On
`KB-RICH-006`…`KB-RICH-011`.

### Surface
- `client/src/features/knowledge-base/knowledge-article-editor.test.tsx` (new)
- `client/src/features/knowledge-base/knowledge-base.test.tsx`
- `client/src/features/portal/portal-knowledge.test.tsx`
- (+ any `knowledge-article-content` test file)

### Requirements
- Editor: each toolbar button; `getHtml()` allowlist-only; no H1 / no
  disallowed node.
- Form: submit sends serialized HTML; hydrate from rich HTML; hydrate
  from legacy plain text (paragraphs preserved); empty body blocked with
  the existing key; RBAC guard unchanged.
- `<ArticleContent>`: rich → formatted; `<script>`/`onclick`/
  `javascript:` payload stripped; legacy plain text → unchanged
  `whitespace-pre-wrap` path; `dir="auto"`.
- Portal detail uses `<ArticleContent>`; pinned layout selectors
  updated; `DRAFT` → not-found.
- EN/AR parity green.

### Out of Scope
Backend tests (012). Ticket test files.

### Acceptance Criteria
All above green; `src/features/knowledge-base` + `src/features/portal`
suites pass; `tsc -b` + lint clean; `vite build` green.

### Verification
`cd client && npx vitest run src/features/knowledge-base src/features/portal && npx tsc -b && npm run lint && npm run build`.

---

## KB-RICH-014 — Documentation & SDD reconciliation

### Goal
Record the implemented Rich Text model accurately: a **new ADR** plus
minimal factual updates to the contract/UI/spec docs. (`RT-7.2`;
`plan.md` Documentation Impact.)

### Depends On
`KB-RICH-003`…`KB-RICH-010` (behavior must exist to describe).

### Surface
- `docs/17-decisions-log.md` (new ADR)
- `docs/05-api-contract.md`
- `docs/18-ui-pages-spec.md` (§11–13)
- `docs/06-auth-rbac.md` (at most a one-liner; no permission change)
- `docs/19-progress-tracking.md`
- `specs/constitution.md`, `specs/architecture.md`
- `specs/features/knowledge-base/spec.md` / `plan.md` (only if
  implementation revealed a needed correction)

### Requirements
- **New ADR**: KB Rich Text on the existing Lexical + `sanitize-html`
  infra — editor reuse, sanitized HTML in `content`, additive
  `contentText`, backward-compat sniff + normalize-on-write, security
  boundary, search/AI derivation. Note it supersedes ADR-020's
  "no rich-text" consequence. This **is** a new architectural decision
  (contrast KB-AUDIT-010, which was a progress note).
- `docs/05`: KB `content` is now server-sanitized rich HTML
  (representation change, same field/type); portal list `excerpt` stays
  plain.
- `docs/18` §11–13: article editor is a bounded rich editor (list the V1
  set), not a `<textarea>`.
- `specs/constitution.md` (~line 22) and `specs/architecture.md`
  (~lines 86–91): correct the "KB bodies are plain text / no rich-text
  migration" statements to point at this capability. (Minimal pointers
  may already be present from the planning task — confirm/expand.)
- `docs/19`: KB Rich Text status + exact test/lint/build/migration
  results.
- No unrelated doc cleanup or reformatting.

### Out of Scope
New ADRs for anything else. Editing docs for out-of-scope items.

### Acceptance Criteria
- `git diff docs/ specs/` is additive and minimal; markdown renders;
  no broken tables/links.
- Every `RT-*` requirement that shipped is reflected in `docs/05` /
  `docs/18` or the ADR.
- `docs/19` uses precise status terms (`Implemented on branch`,
  `Verified`, `Unstaged`).

### Verification
`git diff --check`; manual render check; `git status` shows only
docs/specs changed by this task.

---

## KB-RICH-015 — Final Rich Text verification & Knowledge Base readiness gate

### Goal
Verify the whole Rich Text enhancement against `spec.md` and `plan.md`,
confirm no `KB-AUDIT` / RBAC / route / portal / AI regression, and
produce the readiness report. **This is the true final gate for the
Knowledge Base feature** — not `KB-AUDIT-011`.

### Depends On
`KB-RICH-001` … `KB-RICH-014` (all).

### Surface
None (verification + report only).

### Requirements
- Run and capture (no inferred results):
  - `cd server && npx tsc --noEmit && npm run lint && npx vitest run` (or
    at least `src/modules/knowledge-base`, `src/modules/ai`,
    `src/modules/customer-ai`, `src/modules/audit-logs`,
    `src/shared/rich-text`) `&& npm run build`
  - `cd client && npx tsc -b && npm run lint && npx vitest run && npm run build`
  - migration apply + rollback on a disposable DB; `npx prisma migrate status`
- Confirm by `git diff` / `git status`:
  - no `client/src/features/tickets/**` change
  - no `server/src/modules/audit-logs/**` change; KB `createAuditLog`
    call sites unchanged in behavior
  - **no article body (rich, plain, excerpt, diff, length, hash) in any
    `AuditLog` path** — grep the KB service + tests
  - KB routes, methods, status/error codes, `{ data, meta }` envelope
    unchanged (internal + portal)
  - RBAC unchanged (`ADMIN`/`MANAGER` manage, `AGENT` read-only,
    `CUSTOMER` portal-only, anon rejected)
  - portal visibility rules unchanged (`DRAFT` invisible; unpublish
    removes immediately)
  - AI grounding PUBLISHED-only, plain-text, no `AuditLog` interaction
  - only **one** new column (`contentText`, nullable) + **one** additive
    migration; no other schema change; no dependency/lockfile change
- Check every `RT-1`…`RT-9`, `BC-*`, `SEC-*` acceptance criterion in
  `spec.md` and record pass/fail per criterion.
- Cross-check: every `RT-*` requirement maps to ≥ 1 `KB-RICH` task, and
  every `KB-RICH` task maps back to a requirement; no spec/plan/tasks
  contradiction remains.
- Produce the readiness report: all files changed across the enhancement,
  exact Git state (expected: unstaged, uncommitted), verification
  results, known limitations, suggested commit message.
- Update the Knowledge Base status: **KB Audit = complete; KB Rich Text =
  implemented, all code/test checks pass, migration apply/rollback
  verification still pending (see below); overall KB SDD enhancement =
  ready for human review, merge gated on that one step.**

### Known Limitation — migration apply/rollback not exercised

The "migration apply + rollback on a disposable DB" requirement above was
**not executable in this environment** (no scratch Postgres available) —
confirmed in `.wolf/memory.md` (2026-09-09 KB-RICH entry). The migration
file (`20260909120000_kb_article_content_text`) is additive/non-destructive
by inspection, but that has not been confirmed by an actual apply. This is
the one item keeping the feature from being declared fully verified.

**Remaining step (concise, actionable, do before merge):**
```
cd server && npx prisma migrate deploy   # against a disposable/staging Postgres
npx prisma migrate status                # expect: clean
# spot-check: every pre-existing row's contentText === content post-apply
```
No code, spec, or plan change is implied by this step — it is a one-time
environment verification. Do not mark this task's status as fully
DB-verified until it has been run and its result recorded here.

### Out of Scope
`git commit` / `push` / `merge` / `rebase` / `amend` / staging. Any
code/schema/doc change (a failed criterion routes back to its owning
`KB-RICH-0xx` task).

### Acceptance Criteria
- All server + client checks run and pass (or failures reported
  precisely, feature **not** declared ready).
- Every applicable `spec.md` criterion checked and recorded.
- The regression checklist above fully confirmed.
- Readiness report produced; no Git history altered.

### Verification
`git diff --check` clean; `git status` shows only the enhancement's
intended changes, unstaged and uncommitted.

---

## Task Breakdown Status

### KB Audit Logging — `IMPLEMENTATION COMPLETE`

All 11 tasks (`KB-AUDIT-001` … `KB-AUDIT-011`) implemented and verified
on branch `chore/sdd-foundation`; changes are committed. See `KB-AUDIT-011`
for that pilot's readiness report.

### KB Rich Text Content — `IMPLEMENTED; MIGRATION VERIFICATION PENDING`

All 15 tasks (`KB-RICH-001` … `KB-RICH-015`) implemented, with all code and
test checks passing, on branch `chore/sdd-foundation` (2026-09-09); changes
are committed. ADR-057 records the decision. Every `RT-*` / `BC-*` / `SEC-*`
requirement maps to at least one completed task.

Verification run for `KB-RICH-015`: server `tsc` + `eslint` clean, full
server vitest **926 pass** (52 files), `npm run build` green; client
`tsc -b` + `eslint` clean (2 pre-existing warnings only), full client
vitest **800 pass** (67 files), `vite build` green; `prisma validate` +
`prisma migrate diff --from-url` confirm the migration equals the schema
delta (`ADD COLUMN "contentText" TEXT`); `prisma migrate status` shows the
14-migration history consistent with the new migration pending;
`git diff --check` clean. **Not executable in this environment:** migration
apply + rollback on a disposable Postgres (no local Postgres / shadow DB) —
deferred to the human review step; the additive DDL is otherwise verified
against the live schema.

### Overall Knowledge Base SDD enhancement — `READY FOR HUMAN REVIEW; MERGE GATED ON MIGRATION VERIFICATION`

`KB-RICH-015` has run and every check other than the disposable-DB migration
apply/rollback passed. Merge (and the migration apply against a
disposable/staging Postgres, per the "Known Limitation" note above) are
performed manually by the developer.

Next step: run the migration-apply verification, then human review / merge
of `chore/sdd-foundation`. No further implementation tasks remain in this
pilot.
