# Knowledge Base Audit Logging Implementation Plan

## Status

`READY FOR TASK BREAKDOWN`

This plan implements the single approved enhancement in
[`spec.md`](./spec.md): **add `AuditLog` coverage to the existing Knowledge
Base management mutations while preserving all current Knowledge Base product
behavior.** It is a brownfield enhancement, not a rebuild. Every architecture
decision below is anchored to a real existing seam in the repository
(primarily the `departments` / `branches` / `teams` audit integration, which
is the closest precedent).

## Scope

### In scope

Add exactly one `AuditLog` row per **successful** internal Knowledge Base
management mutation:

| Mutation | Route | Audited outcome |
| --- | --- | --- |
| Create article | `POST /api/knowledge-articles` | article created |
| Edit article | `PATCH /api/knowledge-articles/:id` | auditable field(s) changed |
| Publish | `PATCH /api/knowledge-articles/:id` (`status: PUBLISHED`) | `DRAFT → PUBLISHED` |
| Unpublish | `PATCH /api/knowledge-articles/:id` (`status: DRAFT`) | `PUBLISHED → DRAFT` |
| Delete | `DELETE /api/knowledge-articles/:id` | article hard-deleted |

### Explicitly NOT in scope (non-regression baseline — must not change)

Existing API contracts (routes, request/response shapes, status codes, error
semantics); all current frontend behavior; current RBAC
(`ADMIN`/`MANAGER` manage, `AGENT` read-only, `CUSTOMER` portal-only, anon
rejected); global `MANAGER` scope; authenticated-only customer portal;
`DRAFT ⇄ PUBLISHED` two-state lifecycle; hard delete; free-text nullable
`category`; current pagination / search / ordering (`updatedAt DESC, id ASC`);
published-only portal visibility; published-only AI grounding
(`ai-kb-candidates.ts`, `customer-ai-context.ts`); plain-text article bodies;
no KB SSE/realtime; no localization schema. No schema change, no migration,
no new dependency, no new audit-read surface or UI.

## Existing Implementation to Reuse

Verified by inspection on branch `chore/sdd-foundation`:

| Seam | Location | Reuse |
| --- | --- | --- |
| `createAuditLog(input, db = prisma)` | `server/src/modules/audit-logs/audit-log.service.ts` | Sole audit-write entry point. Accepts `Prisma.TransactionClient` as `db` — pass `tx`. |
| `changedFields(before, after, fields)` | same file | Build `AuditChanges` from before/after for safe scalar fields. Strict `!==` diff. |
| `AUDIT_ACTIONS`, `AUDIT_ENTITY_TYPES`, `AuditChanges` type | `server/src/modules/audit-logs/audit-log.constants.ts` | Add the new KB constants here. Values are plain string constants — **no DB enum**. |
| `getAuditRequestContext(request)` | `server/src/modules/audit-logs/audit-request-context.ts` | Returns `{ ipAddress, userAgent }` from headers/`request.ip`. Called in the controller. |
| Audit-in-transaction pattern | `server/src/modules/departments/department.service.ts` (`createDepartment`, `updateDepartment`, `deleteDepartment`) | Direct structural template: pre-check outside `prisma.$transaction`, mutate + `createAuditLog(..., tx)` inside it; status-derived action selection; suppress row when `changes` is empty; delete keeps a human-readable label in `changes`. |
| Controller → service context flow | `server/src/modules/departments/department.controller.ts` | `service(params, body, actorId(request), getAuditRequestContext(request))` — routes unchanged. |
| Test mock for tx + audit | `server/src/modules/departments/department.test.ts` (lines 18–42) | Template for extending the KB prisma mock with `auditLog.create` + a `$transaction` fn implementation. |
| KB service | `server/src/modules/knowledge-base/knowledge-article.service.ts` | `createKnowledgeArticle`, `updateKnowledgeArticle`, `deleteKnowledgeArticle` gain audit; reads untouched. |
| KB controller | `server/src/modules/knowledge-base/knowledge-article.controller.ts` | `create` / `update` / `remove` pass actor id + request context. `actor(request)` helper already exists. |
| KB routes | `server/src/modules/knowledge-base/knowledge-article.routes.ts` | **No change** — RBAC + validation already correct. |

Do **not** introduce a parallel audit helper, a KB-specific audit wrapper, or
a second request-context reader.

## Architecture Decision

### Audit Entity Type

- **New constant required:** yes — one entry.
- **Recommended name:** `KNOWLEDGE_ARTICLE`.
- **Why it matches:** every value in `AUDIT_ENTITY_TYPES` is the Prisma model
  name in `SCREAMING_SNAKE_CASE` (`USER`, `TICKET`, `SLA_RULE ← SlaRule`,
  `DEPARTMENT`, `BRANCH`, `TEAM`). The model here is `KnowledgeArticle`, so
  `KNOWLEDGE_ARTICLE` is the consistent form (`SLA_RULE` already establishes
  the multi-word underscore style).
- **Migration:** **none.** `AuditLog.entityType` is a `String` column
  (ADR-039: "extensible TypeScript string constants rather than database
  enums"). Adding a constant is application-level only.

```ts
// audit-log.constants.ts
export const AUDIT_ENTITY_TYPES = { /* …existing… */, KNOWLEDGE_ARTICLE: "KNOWLEDGE_ARTICLE" } as const;
```

### Audit Actions

**Decision: dedicated per-lifecycle actions (Option A).**

```
KNOWLEDGE_ARTICLE_CREATED
KNOWLEDGE_ARTICLE_UPDATED
KNOWLEDGE_ARTICLE_PUBLISHED
KNOWLEDGE_ARTICLE_UNPUBLISHED
KNOWLEDGE_ARTICLE_DELETED
```

**Why (matches existing project convention, not aesthetics):**

- The codebase consistently models a reversible lifecycle transition as a
  **pair of dedicated actions**, not a boolean in metadata:
  `USER_ACTIVATED` / `USER_DEACTIVATED`,
  `DEPARTMENT_ACTIVATED` / `DEPARTMENT_DEACTIVATED`,
  `BRANCH_ACTIVATED` / `BRANCH_DEACTIVATED`,
  `TEAM_ACTIVATED` / `TEAM_DEACTIVATED`. `publish` / `unpublish` is the same
  shape (`status` toggling `DRAFT ⇄ PUBLISHED`), so it gets
  `KNOWLEDGE_ARTICLE_PUBLISHED` / `KNOWLEDGE_ARTICLE_UNPUBLISHED`.
- `*_CREATED` / `*_UPDATED` / `*_DELETED` per entity is the universal pattern
  (`CATEGORY_*`, `SLA_RULE_*`, `CUSTOMER_*`, `DEPARTMENT_*`).
- Action selection mirrors `updateDepartment` exactly: if the update changed
  `status`, the action is `KNOWLEDGE_ARTICLE_PUBLISHED` or
  `KNOWLEDGE_ARTICLE_UNPUBLISHED` (by the resulting status); otherwise it is
  `KNOWLEDGE_ARTICLE_UPDATED`. A single `PATCH` that changes both content
  fields **and** status produces **one** row with the status-derived action
  and all changed fields in `metadata.changes` — identical to how
  `updateDepartment` handles a simultaneous rename + activate.
- Publish and unpublish are therefore trivially distinguishable in the
  existing `ADMIN`-only audit views by `action` alone, with no metadata
  parsing.

All five constants are added to `AUDIT_ACTIONS` in
`audit-log.constants.ts`. **Do not add them until task breakdown.**

### Metadata Strategy

All descriptive data rides `changes` (the `AuditChanges` map consumed by
`createAuditLog` → `metadata.changes`) plus, where needed, one flat
`metadata` boolean. Safe scalar fields carry real `from`/`to`; the article
**body is never placed in the audit record in any form**.

| Field | In audit? | Representation |
| --- | --- | --- |
| `title` | yes | `changes.title` real `from`/`to` (bounded 3–200 chars — safe). |
| `category` | yes | `changes.category` real `from`/`to` (nullable free-text, 1–100 chars — safe). |
| `status` | yes | `changes.status` real `from`/`to` (`DRAFT` / `PUBLISHED` enum string). |
| `content` (body) | **presence only** | flat `metadata.contentChanged = true` when `before.content !== after.content`. **Never** the text, length-only, diff, excerpt, or `from`/`to`. |
| article id | yes | `AuditLog.entityId` = article id (durable, survives hard delete). |
| actor | yes | `AuditLog.actorId` from server context (below). |

Per-mutation:

- **Create** — `changes: { title: { to }, category: { to }, status: { to } }`
  (mirrors `createDepartment`, which records `to`-only on create). Content is
  intrinsic to a create; its value is not logged. `metadata.contentChanged`
  is **not** set on create (there is no "before").
- **Edit** — `changes = changedFields(before, after, ["title", "category", "status"])`;
  additionally set `metadata.contentChanged = true` iff the body changed.
  Emit the row only if `changes` is non-empty **or** `contentChanged` is
  true (no misleading "edited" row for a no-op `PATCH`).
- **Publish / Unpublish** — `changes.status = { from, to }` from
  `changedFields`; any co-changed `title` / `category` also present;
  `metadata.contentChanged` if the body also changed.
- **Delete** — `changes: { title: { from }, category: { from }, status: { from } }`
  (extends the `department` delete convention of keeping the human-readable
  label; all three are safe short scalars and give minimal forensic context
  after the row is gone). `entityId` = the deleted id. Body not retained.

Explicitly excluded from metadata everywhere: full/partial `content`, any
secret/token/credential, raw request body, request headers, DTO/Prisma
record dumps. This matches ADR-039's per-domain safe-field allowlist rule.

### Request Context

- **Actor identity is server-derived only.** `actorId` comes from
  `request.auth.userId` via the existing `actor(request)` helper in
  `knowledge-article.controller.ts`. No client-supplied actor field is
  accepted (strict Zod schemas already `.strict()` and reject unknown keys).
- **IP / User-Agent** come from `getAuditRequestContext(request)` called in
  the controller (same call site style as `department.controller.ts`).
- **Signature changes (service layer only):**
  - `createKnowledgeArticle(input, actor, requestContext?)` — `actor`
    already passed; add optional `requestContext`.
  - `updateKnowledgeArticle(id, input, actorId, requestContext?)` — add
    `actorId` and `requestContext`.
  - `deleteKnowledgeArticle(id, actorId, requestContext?)` — add `actorId`
    and `requestContext`.
- **Route signatures unchanged.** Controllers derive both values from
  `request`; nothing new is read from the request body or query.
- Missing IP / UA never blocks a mutation (`getAuditRequestContext` already
  returns `null` fields; ADR-039 rule).

## Mutation Integration

Flow template (all three mutating service functions), mirroring
`department.service.ts`:

```
validate + RBAC            (unchanged middleware, before service)
  ↓
[pre-check outside tx]     findUnique for 404 + `before` snapshot (update/delete only)
  ↓
prisma.$transaction(tx =>
    mutate KnowledgeArticle via tx
    build changes / contentChanged
    if something changed:
        createAuditLog({ actorId, action, entityType: KNOWLEDGE_ARTICLE,
                         entityId, changes, metadata?, requestContext }, tx)
)
  ↓
return existing projection (detailSelect) — response shape unchanged
```

### Create

- **Where:** `createKnowledgeArticle` in `knowledge-article.service.ts`
  (currently a bare `prisma.knowledgeArticle.create`).
- **Actor:** `actor.userId` (already an argument).
- **When written:** inside a new `prisma.$transaction`, immediately after the
  `create`, using the created row's `id`.
- **Entity id:** `row.id`.
- **Metadata:** `changes: { title: {to}, category: {to}, status: {to} }`.
- **Action:** `KNOWLEDGE_ARTICLE_CREATED` (always emitted — a create always
  "changes" everything).
- **Transaction:** new — wrap `create` + `createAuditLog(..., tx)`.

### Update

- **Where:** `updateKnowledgeArticle` in `knowledge-article.service.ts`.
- **Before values:** widen the existing pre-check
  `findUnique({ where: { id }, select: { id: true } })` to
  `select: { id: true, title: true, content: true, category: true, status: true }`
  so `changedFields` and the `contentChanged` check have a `before`. Keep
  this read **outside** the transaction (matches `updateDepartment`).
- **Auditable fields:** `title`, `content`, `category`, `status`.
  - `title` / `category` / `status` → `changedFields(before, after, ["title","category","status"])`.
  - `content` → `metadata.contentChanged = true` if `before.content !== after.content` (no value stored).
- **Action:** if `changes.status` is present →
  `after.status === "PUBLISHED" ? KNOWLEDGE_ARTICLE_PUBLISHED : KNOWLEDGE_ARTICLE_UNPUBLISHED`;
  else → `KNOWLEDGE_ARTICLE_UPDATED`. (Exact mirror of the
  `changes.isActive !== undefined ? ACTIVATED/DEACTIVATED : UPDATED` branch
  in `updateDepartment`.)
- **No-op suppression:** if `changes` is empty and `contentChanged` is false,
  write no audit row (the `PATCH` still returns `200` with the unchanged
  row — response behavior unchanged; the empty-`PATCH` case is already a
  `400` from the schema `.refine`).
- **Transaction:** new — wrap `update` + conditional `createAuditLog(..., tx)`.

### Publish / Unpublish

- Not separate service functions — they are `updateKnowledgeArticle` calls
  whose body is `{ status: "PUBLISHED" }` / `{ status: "DRAFT" }`. Reflected
  in the plan as an action-selection branch inside `updateKnowledgeArticle`,
  **not** new endpoints or new service functions.
- `DRAFT → PUBLISHED` ⇒ `KNOWLEDGE_ARTICLE_PUBLISHED`,
  `changes.status = { from: "DRAFT", to: "PUBLISHED" }`.
- `PUBLISHED → DRAFT` ⇒ `KNOWLEDGE_ARTICLE_UNPUBLISHED`,
  `changes.status = { from: "PUBLISHED", to: "DRAFT" }`.
- A `PATCH` that sets `status` to its current value produces no `status`
  change → falls through to the `UPDATED` / no-op rules.

### Delete

- **Where:** `deleteKnowledgeArticle` in `knowledge-article.service.ts`.
- **Action:** `KNOWLEDGE_ARTICLE_DELETED`.
- **Entity id:** the article id (`entityId`), retained even though the row is
  gone.
- **Retained metadata:** widen the pre-check select to
  `{ id: true, title: true, category: true, status: true }`;
  `changes: { title: { from }, category: { from }, status: { from } }`. Body
  is not retained.
- **Transaction ordering:** inside a new `prisma.$transaction` —
  `tx.knowledgeArticle.delete(...)` **then** `createAuditLog(..., tx)` (same
  order as `deleteDepartment`). If the audit write throws, the delete rolls
  back.

## Transaction Strategy

**All three mutating operations become transactional; reads never are.**

| Operation | Transaction today | After | Rationale |
| --- | --- | --- | --- |
| `createKnowledgeArticle` | none (single `create`) | `prisma.$transaction(fn)` wrapping `create` + `createAuditLog(tx)` | State + audit must not diverge; ADR-039 requires security-sensitive mutations to write the domain change and audit row in one transaction. |
| `updateKnowledgeArticle` | none (`findUnique` then `update`) | pre-check stays outside; `prisma.$transaction(fn)` wraps `update` + conditional `createAuditLog(tx)` | Same. Matches `updateDepartment`. |
| `deleteKnowledgeArticle` | none (`findUnique` then `delete`) | pre-check stays outside; `prisma.$transaction(fn)` wraps `delete` + `createAuditLog(tx)` | Same. Matches `deleteDepartment`. |
| `listKnowledgeArticles` | `prisma.$transaction([...])` (array read) | unchanged | Read — never audited. |
| `getKnowledgeArticle` / portal reads / AI grounding | direct read | unchanged | Reads — never audited. |

`createAuditLog` already accepts the transaction client via its `db`
parameter, so **no change to `createAuditLog` itself.** The `$transaction`
callback form runs on the same connection; the KB mutations are small and
add one `INSERT`, so contention risk is negligible.

## API Compatibility

No intentional contract change.

- Same routes, same methods, same Zod request schemas (`.strict()` unchanged
  — no new accepted field).
- Same response bodies: `create` → `201 { data: <detailSelect> }`,
  `update` → `200 { data: <detailSelect> }`, `remove` → `204` empty.
  **No `AuditLog` data is added to any KB response.**
- Same status codes and error codes: `401` / `403` / `400`
  (`VALIDATION_ERROR`) / `404 KNOWLEDGE_ARTICLE_NOT_FOUND`. All of these
  occur **before** the transaction, so no success audit row is written for a
  rejected request.
- Portal endpoints (`/api/portal/knowledge-articles*`) are untouched.

## Frontend Impact

**No frontend production changes planned.**

Inspection of `client/src/features/knowledge-base/*` and
`client/src/features/portal/portal-knowledge-pages.tsx` confirms the audit
integration is server-side administrative bookkeeping with no response-shape
change, so nothing in the client needs to change. Specifically **out of
scope**: any KB audit-history panel, an `AuditLog` viewer on the KB detail
page, any new API call, any new column or toast. The existing `ADMIN`-only
`/audit-logs` workspace surfaces the new rows automatically via the standard
`entityType` / `action` filters.

## Database Impact

**None.**

- `KnowledgeArticle` schema unchanged.
- `AuditLog` schema unchanged.
- `KnowledgeArticleStatus` enum unchanged.
- New audit entity type / actions are application-level string constants
  (`AuditLog.entityType` and `AuditLog.action` are `String` columns —
  ADR-039).
- **No Prisma schema edit, no migration, no `prisma generate` change.**

If task-time inspection contradicts any of the above (e.g. `entityType`
turns out to be a DB enum), **stop and report** rather than adding migration
scope.

## Security and Privacy

- **Actor is server-derived** (`request.auth.userId`); never from the
  request body/query/header. Strict schemas reject unknown keys.
- **No body in the audit log.** `content` changes are recorded only as
  `metadata.contentChanged = true`. KB content can contain customer-support
  detail; the audit log must not become a second content store or a
  data-exfiltration path.
- **Safe-field allowlist** (`title`, `category`, `status`) only — the same
  discipline ADR-039 mandates for every audited domain. No
  `changedFields(before, after, [...])` call includes `content` or any
  unlisted field.
- **No secrets/tokens/credentials/headers/raw payloads** in `metadata`.
- **No new read exposure:** the new rows are only visible through the
  existing `ADMIN`-only audit API and workspace. No portal exposure.
- **Failure semantics:** the audit write is **blocking / transactional**
  (not best-effort). If `createAuditLog(tx)` throws, the whole mutation
  rolls back — a Knowledge Base management change is never silently
  unaudited. This matches ADR-039 and the `departments` precedent; there is
  no module in the repo that treats a security-sensitive management mutation
  as best-effort audit, so the transactional convention applies here without
  exception.

## Testing Strategy

Backend only. Extend the existing suites; do not duplicate coverage that
already exists.

### Test-infra change (one-time, in `knowledge-article.test.ts`)

Mirror `department.test.ts` lines 18–42: add `auditCreate: vi.fn()` to the
hoisted mocks, expose `auditLog: { create: mocks.auditCreate }` on the mocked
`prisma`, and give `prisma.$transaction` a function-form implementation that
invokes the callback with a `tx` exposing `knowledgeArticle` + `auditLog`
(keep the array-form branch for the existing list tests). `beforeEach`
resets `auditCreate`.

### Create — `knowledge-article.test.ts`

- Successful create: article persisted with server `createdById`, `status`
  defaults to `DRAFT` (existing assertion kept); **`auditCreate` called
  exactly once** with `action: KNOWLEDGE_ARTICLE_CREATED`,
  `entityType: KNOWLEDGE_ARTICLE`, `entityId` = new id,
  `actorId` = authenticated user, `changes` carrying `title` / `category` /
  `status` `to` values, and `metadata` containing **no `content`**.
- `requestContext` (ip / user-agent) forwarded to `createAuditLog`.

### Edit — `knowledge-article.test.ts`

- Title-only edit: one audit row, `action: KNOWLEDGE_ARTICLE_UPDATED`,
  `changes.title` has real `from`/`to`, **no `content` key anywhere**,
  `metadata.contentChanged` absent.
- Content-only edit: one audit row, `KNOWLEDGE_ARTICLE_UPDATED`,
  `metadata.contentChanged === true`, `changes` has **no `content`** and no
  body text in the entire serialized call.
- No-op `PATCH` (values equal current): article `update` may run but
  **`auditCreate` not called**.
- Combined title + `status: PUBLISHED` in one `PATCH`: exactly one audit row,
  `action: KNOWLEDGE_ARTICLE_PUBLISHED`, `changes` contains both `title` and
  `status`.

### Publish — `knowledge-article.test.ts`

- `DRAFT → PUBLISHED`: article status becomes `PUBLISHED`; one audit row,
  `action: KNOWLEDGE_ARTICLE_PUBLISHED`,
  `changes.status = { from: "DRAFT", to: "PUBLISHED" }`.

### Unpublish — `knowledge-article.test.ts`

- `PUBLISHED → DRAFT`: status becomes `DRAFT`; one audit row,
  `action: KNOWLEDGE_ARTICLE_UNPUBLISHED`,
  `changes.status = { from: "PUBLISHED", to: "DRAFT" }` — asserted distinct
  from the publish action constant.

### Delete — `knowledge-article.test.ts`

- Successful delete: `knowledgeArticle.delete` called; one audit row,
  `action: KNOWLEDGE_ARTICLE_DELETED`, `entityId` = id,
  `changes.title.from` present, **no body**. (Article "persists" only as the
  audit record — assert the audit `create` fired within the same
  `$transaction` callback as the delete.)

### Unauthorized mutation — `knowledge-article.test.ts` (extend existing)

- Existing `AGENT` create/update/delete → `403` tests gain an assertion that
  `auditCreate` was **not** called.
- `CUSTOMER` / unauthenticated on internal routes → `401`/`403`, no audit.

### Invalid mutation — `knowledge-article.test.ts` (extend existing)

- Empty `PATCH` / unknown field / length-bound violation → `400`,
  `auditCreate` not called.
- `PATCH` / `DELETE` on missing id → `404 KNOWLEDGE_ARTICLE_NOT_FOUND`,
  `auditCreate` not called (pre-check throws before the transaction).

### Reads create no audit

- Internal list / detail / search, portal list / detail / search
  (`knowledge-article.portal.test.ts`): assert `auditCreate` not called.
- AI grounding: `ai-kb-candidates` and `customer-ai-context` unit/integration
  tests assert no `auditLog.create` on the KB retrieval path (add a light
  assertion if not already implied; these modules do not import
  `createAuditLog`).

### Transaction atomicity

- Simulate `auditCreate` rejecting inside the `$transaction` callback for
  create / update / delete → assert the mutation result rejects and (via the
  mock) the article mutation is treated as rolled back (no resolved
  response, error surfaced).

## Documentation Updates

To accompany a successful implementation (tracked here, applied in the
implementation change, **not now**):

- `docs/06-auth-rbac.md` — add a one-line note under the audit-logging
  section / "Internal Knowledge Base Permissions" that KB management
  mutations (create / edit / publish / unpublish / delete) now write
  `AuditLog` rows with `entityType: KNOWLEDGE_ARTICLE`. No permission-table
  change (no RBAC change).
- `docs/05-api-contract.md` — if it documents mutation side effects for
  other audited entities, add the equivalent "writes an `AuditLog` entry"
  note for the KB internal mutation endpoints. Otherwise no change.
- `docs/17-decisions-log.md` — a short progress note under the existing
  audit lineage (ADR-039), matching how the `departments` / `branches`
  audit additions were recorded (see the "New audit actions:
  `DEPARTMENT_CREATED/…`" progress note). **No new ADR.** Rationale: this
  applies ADR-039's established pattern (dedicated string action constants,
  transactional audit, safe-field allowlist) to one more existing module; it
  is not a new architectural decision. Adding `AuditLog` coverage to an
  existing module is precedented as a progress note, not an ADR.
- `specs/features/knowledge-base/spec.md` — update only if implementation
  surfaces a genuine clarification (not expected).
- `specs/architecture.md` — already reconciled in this change (KB bodies
  documented as plain text); no further edit expected.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| **Duplicate audit rows** (e.g. publish path double-writing). | Publish/unpublish are not separate service functions — they flow through the single `updateKnowledgeArticle` action-selection branch. One `createAuditLog` call site per mutation function. Tests assert "exactly once". |
| **Full article body leaking into `metadata`.** | `content` is never passed to `changedFields` and never placed in `changes`/`metadata`; only `metadata.contentChanged: boolean`. Tests assert no body substring in the serialized `createAuditLog` call for content edits and deletes. |
| **Audit row written before the mutation actually commits.** | `createAuditLog(..., tx)` runs inside the same `prisma.$transaction` callback as the mutation; a throw from either rolls back both. Atomicity test simulates audit failure. |
| **Hard delete losing identifying context.** | Widen delete pre-check select; persist `title` / `category` / `status` (`from`) in `changes` and the id in `entityId`. Body intentionally not retained (privacy > forensics here). |
| **Status transitions misclassified as generic `UPDATED`.** | Action-selection branch keys on `changes.status` presence and the resulting `status`, mirroring `updateDepartment`'s `isActive` branch. Dedicated `PUBLISHED` / `UNPUBLISHED` constants. Combined edit+status test asserts the status-derived action wins. |
| **Service signature change breaking existing callers / tests.** | New params are appended and optional (`requestContext?`); `updateKnowledgeArticle` / `deleteKnowledgeArticle` gain a required `actorId` — only the KB controller calls them (verified: no other importer of `knowledge-article.service`). Update the controller + the KB test suite in the same change. |
| **Accidental API response change** (audit data bleeding into `data`). | Service still returns the existing `detailSelect` projection; audit result is discarded. Existing response-shape tests remain and must stay green. |
| **Frontend scope creep** (someone adds an audit panel). | This plan and `tasks.md` explicitly state "No frontend production changes"; any client diff in the implementation PR is out of scope and should be rejected in review. |
| **No-op `PATCH` producing a misleading "edited" row.** | Suppress the audit write when `changes` is empty and `contentChanged` is false (mirrors `updateDepartment`'s `if (Object.keys(changes).length)`). Test covers it. |
| **`$transaction` mock gap in the KB test file** causing false greens/reds. | Port the `department.test.ts` `$transaction` fn-form mock (keep the array-form branch for list tests). Called out as an explicit test-infra task. |

## Rollback

- **No migration → no schema rollback.** Reverting the implementation commit
  fully removes the behavior: the added constants, the `$transaction`
  wrappers, and the `createAuditLog` calls disappear; KB mutations return to
  direct Prisma calls.
- **Historical rows stay.** `AuditLog` rows already written with
  `entityType: KNOWLEDGE_ARTICLE` remain as valid historical records after a
  code revert (the audit API tolerates unknown/legacy action strings — they
  are plain strings). **Do not delete audit history as part of a rollback.**
- No data backfill is attempted on either apply or revert.

## Proposed File Impact

Exact paths. Nothing is modified by this planning task.

### Backend

- `server/src/modules/audit-logs/audit-log.constants.ts` — add
  `KNOWLEDGE_ARTICLE` to `AUDIT_ENTITY_TYPES`; add
  `KNOWLEDGE_ARTICLE_CREATED` / `_UPDATED` / `_PUBLISHED` / `_UNPUBLISHED` /
  `_DELETED` to `AUDIT_ACTIONS`.
- `server/src/modules/knowledge-base/knowledge-article.service.ts` — wrap
  create / update / delete in `prisma.$transaction`; widen the update &
  delete pre-check `select`; call `createAuditLog(..., tx)`; add
  `actorId` / `requestContext` params.
- `server/src/modules/knowledge-base/knowledge-article.controller.ts` —
  `create` / `update` / `remove` pass `actor(request).userId` and
  `getAuditRequestContext(request)` to the service.
- `server/src/modules/knowledge-base/knowledge-article.test.ts` — extend
  prisma mock (`auditLog.create`, `$transaction` fn form); add
  create/edit/publish/unpublish/delete audit assertions; extend existing
  `403` / `400` / `404` tests with "no audit row" assertions; atomicity
  tests.
- `server/src/modules/knowledge-base/knowledge-article.portal.test.ts` —
  add "reads create no audit" assertion(s).
- `server/src/modules/knowledge-base/knowledge-article.routes.ts` —
  **expected: no change** (RBAC + validation already correct). Listed only
  so review can confirm it stays untouched.

### Frontend

`None.`

### Database

`None.` (no `server/prisma/**` change, no migration)

### Dependencies

`None.` (no `package.json` / lockfile change)

### Documentation

- `docs/06-auth-rbac.md` (audit note — required)
- `docs/05-api-contract.md` (side-effect note — only if it documents audit
  side effects elsewhere)
- `docs/17-decisions-log.md` (progress note under ADR-039 lineage — no new
  ADR)
- `specs/features/knowledge-base/spec.md` (only if a clarification emerges)

---

# Rich Text Content — Implementation Plan

> **Separate plan for a separate capability.** Everything above is the
> completed KB Audit pilot and is unchanged. This section plans
> [`spec.md` → Knowledge Base Rich Text Content](./spec.md#knowledge-base-rich-text-content)
> (`RT-1`…`RT-9`, `BC-*`, `SEC-*`). **No production code is written by
> this planning task.** Status: `READY FOR TASK BREAKDOWN`.

## Current Implementation Summary (verified by inspection, `chore/sdd-foundation`)

| Concern | Today |
| --- | --- |
| Body model | `KnowledgeArticle.content` — Prisma `String` (Postgres `text`), Zod `z.string().trim().min(1).max(50_000)`; plain text. No `dangerouslySetInnerHTML` anywhere in KB. |
| Create screen | `client/src/features/knowledge-base/knowledge-article-form-page.tsx` — RHF + Zod, a plain `<textarea id="kb-content" … dir="auto">` bound with `register("content")`. |
| Edit screen | Same component (`isEditing`), `values:` seeded from `article.data.content`. |
| Internal detail render | `knowledge-base-detail-page.tsx` — `<article className="… whitespace-pre-wrap break-words …" dir="auto">{data.content}</article>`. |
| Portal detail render | `client/src/features/portal/portal-knowledge-pages.tsx` — identical `<article … whitespace-pre-wrap … dir="auto">{article.content}</article>`. |
| Portal list excerpt | Server-derived: `deriveExcerpt(content)` in `knowledge-article.service.ts` (`listPublishedKnowledgeArticles`) — `content.replace(/\s+/g," ").trim()` ≤ 200 chars. |
| Server schema | `knowledge-article.schema.ts` — `createKnowledgeArticleSchema` / `updateKnowledgeArticleSchema`, both `.strict()`. |
| Server write path | `knowledge-article.service.ts` `createKnowledgeArticle` / `updateKnowledgeArticle` — each already wrapped in `prisma.$transaction` with `createAuditLog(..., tx)` (KB-AUDIT). `content` compared only to set `metadata.contentChanged`. |
| Search | `searchWhere(search)` → `OR` of `title` / `content` / `category` `contains … mode:"insensitive"`; used by internal list, portal list, and (open-coded, keyword loop) by both AI retrieval paths. |
| AI grounding — internal | `server/src/modules/ai/ai-kb-candidates.ts` — `findMany({ where:{ status:PUBLISHED, OR:[title/content contains …] }, select:{ id,title,content } })`, then `excerpt: deriveExcerpt(row.content)`. Ranking prompt uses `title` + `excerpt` only. |
| AI grounding — customer | `server/src/modules/customer-ai/customer-ai-context.ts` — `findMany({ where:{ status:PUBLISHED, OR:[…] }, select:{ id,title,category,content } })`, returns `{ …row, excerpt }`. |
| AI grounding — prompt | `customer-ai.service.ts` builds `SOURCES` as `…CONTENT: ${a.content}` — **full body text goes into the model prompt** (this is the one place the whole body is consumed). Suggested-articles reply uses `excerpt`. |
| Existing rich-text infra (ticket) | Editor: `client/src/features/tickets/ticket-reply-editor.tsx` (Lexical, `forwardRef` handle) + `ticket-reply-toolbar.tsx` (B / I / U / ul / ol / link / undo / redo — **no headings**) + `ticket-reply-link-popover.tsx` / `ticket-reply-link.utils.ts` (ADR-041 anchored popover, protocol validation). Deps present: `lexical`, `@lexical/react`, `@lexical/rich-text` (⇒ `HeadingNode` available, unused today), `@lexical/list`, `@lexical/link`, `@lexical/history`, `@lexical/html`, `@lexical/utils`, `@lexical/selection`, `dompurify` — all `^0.49` / `^3`. |
| Existing sanitizer (server) | `server/src/shared/rich-text/reply-html.ts` (`sanitize-html`): `REPLY_HTML_SANITIZE_OPTIONS` (tags `b strong i em u p br ul ol li a`; `a[href,rel,target]`; schemes `http https mailto`; forces `rel="noopener noreferrer nofollow" target="_blank"`; discards everything else), `sanitizeReplyHtml()` (→ `""` when text-empty), `replyHtmlToPlainText()` (strips all tags, `br` + `</p|div|li|ul|ol>` → `\n`, decodes entities, collapses blank lines). Reused server-side by `ticket.service`, `portal.service`, `email.service`, `ai-context.service`. |
| Existing render guard (client) | `MessageBody` in `client/src/features/tickets/ticket-conversation-ui.tsx`: `LOOKS_LIKE_HTML` regex sniff → DOMPurify re-sanitize (`ALLOWED_TAGS` = same 10, `ALLOWED_ATTR` href/target/rel, `ALLOWED_URI_REGEXP` `^(?:https?:|mailto:)`) → `dangerouslySetInnerHTML`; else `whitespace-pre-wrap` plain-text path. `afterSanitizeAttributes` hook forces `target`/`rel` on `<a>`. Portal already imports from this file. |
| Precedent | ADR-035 did exactly this for `TicketMessage.body`: plain `<textarea>` → Lexical, `String` column reused (no migration), **sanitized HTML on write**, client re-sanitize on render, `replyHtmlToPlainText` for AI/WhatsApp, schema max raised for markup headroom. ADR-037 extended it to internal notes + portal reply. ADR-041 = the link popover. |

**Conflicts found (reported, see task KB-RICH-014):** `specs/constitution.md`
line ~22 and `specs/architecture.md` lines ~86–91 state Knowledge Base
bodies are plain text "and no rich-text migration is part of scope
(ADR-020)". `docs/17` ADR-020 says the same. These are true for the
shipped state but now contradicted by this approved capability. Minimal
factual pointers are added to the two `specs/*` files by this planning
task (they are SDD files and must stay self-consistent); `docs/17`
gets a **new ADR** at implementation time (KB-RICH-014), not now.

## Selected Editor Strategy

**Reuse the existing Lexical infrastructure. No new dependency.**

- **Why reuse:** every node type V1 needs already has a package installed
  and battle-tested in this repo — `RichTextPlugin`, `HeadingNode`
  (`@lexical/rich-text`, currently imported but unused), `ListNode` /
  `ListItemNode` (`@lexical/list`), `LinkNode` (`@lexical/link`),
  `HistoryPlugin`, `$generateHtmlFromNodes` / `$generateNodesFromDOM`
  (`@lexical/html`). The ticket editor is a working reference for the
  `forwardRef` handle, the toolbar, the link popover, and the
  serialize-to-HTML-on-read pattern.
- **Why a new component, not literal reuse of `TicketReplyEditor`:** that
  component hard-codes `namespace: "ticket-reply"`, the
  `MAX_PUBLIC_REPLY_LENGTH = 20_000` guard inside `insertText`/
  `replaceText`, ticket i18n keys, and an imperative surface shaped for
  the Quick-Reply / AI "insert into reply" bridges KB does not have.
  Bending it to two masters risks regressing the ticket composer, which
  is on a critical path and **out of scope** here. Instead: a sibling
  `knowledge-article-editor.tsx` in the KB feature folder that imports the
  **same Lexical packages** and mirrors the **same structure**, plus a
  `knowledge-article-editor-toolbar.tsx` that mirrors
  `ticket-reply-toolbar.tsx` **and adds the two heading buttons**.
- **Link popover:** import and reuse `ticket-reply-link-popover.tsx` +
  `ticket-reply-link.utils.ts` as-is if they are cleanly presentational
  (inspection at task time). If importing them would pull ticket-only
  deps into the KB/portal graph, copy the ~2 small files into the KB
  folder. Either way the protocol allowlist (ADR-041:
  `javascript:` / `data:` / `vbscript:` / `file:` rejected) is kept.
- **V1 toolbar:** paragraph, H2, H3, bold, italic, underline, unordered
  list, ordered list, link, undo, redo. Nothing else (`RT-1.3` /
  `RT-1.4`). Headings limited to two levels — the page renders the `<h1>`
  article title.
- **Namespace:** `"knowledge-article"`. Editor is RTL/LTR-safe (theme
  classes use logical `ms-*`; content element `dir="auto"`).

## Storage Decision

**Sanitized HTML in the existing `content` field. No change to the
`content` column. One additive, nullable companion column `contentText`
for the human-readable projection.**

### `content` — sanitized HTML, existing column

Evaluated against the `spec.md` alternatives:

| Option | Verdict |
| --- | --- |
| **(1) Lexical JSON in `content`** | **Rejected.** Search (`RT-5`) would run over serialized node markup; AI derivation (`RT-6`) and every render would need a Lexical runtime (incl. server-side for AI text); no precedent in the repo; the JSON is bulky and opaque in the DB. |
| **(2) Sanitized HTML in `content`** | **Selected.** Exact ADR-035 precedent (`TicketMessage.body`). `content` is already `String`/`text` — **no column change, no migration for the body itself**. Renders through the existing `MessageBody`-style guard. Sanitizer already exists server-side. Backward-compatible: legacy plain-text rows are still valid `content` and still render (see BC). Extensible: adding a V2 tag = one allowlist entry on each side. |
| **(3) Plain text + separate rich column** | **Rejected as the primary store.** Needs a new non-null rich column + a migration + dual-write with two sources of truth for "the body". More moving parts than (2) for no rendering or safety gain. |
| **(4) Other** | none stronger. A Postgres generated/stripped column or expression index for search was considered and rejected — fragile SQL HTML-stripping, still a migration, worse than an app-maintained value. |

Trade-offs for **(2)**:

- **Backward compatibility** — excellent. Legacy rows need no touch; a
  content-shape sniff + a normalize-on-write guarantee (below) tells old
  from new reliably.
- **Rendering** — reuse the proven client guard; low risk.
- **Search** — HTML in `content` is *not* safely searchable
  (`<p>` wraps every rich body, so `contains:"p"` matches everything;
  `contains:"a"` matches every article with a link; a word split by a tag
  boundary is missed). ⇒ the reason for `contentText` below.
- **AI grounding** — needs HTML→text before prompting; the flattener
  already exists.
- **Validation** — sanitize on write, then re-check non-empty; schema max
  raised for markup headroom (plain-text ceiling still enforced on the
  derived text).
- **Security** — server sanitizer is the trust boundary; client
  re-sanitizes; identical model to ticket replies.
- **Future extensibility** — allowlist-driven; add tags incrementally.
- **Migration complexity** — **none for `content`**.
- **Prisma/Postgres** — `String`→`text`, no length ceiling issue at the
  DB; Prisma model unchanged for this field.
- **Current API consumers** — representation of `content` changes
  (plain → HTML). In-repo consumers updated in lockstep; documented in
  `docs/05` (`RT-7.2`). Same class of change as ADR-035.

### `contentText` — additive nullable companion column (the one schema change)

**Decision: add `KnowledgeArticle.contentText String?`.** This is the
"clear architectural benefit" the spec's storage constraint allows,
because a single stored plain-text projection is required by **three**
requirements at once and there is no read-time alternative for one of
them:

- `RT-5` search must run in a SQL `WHERE` — it **cannot** strip HTML per
  row at query time; it needs a pre-derived text column.
- `RT-6` AI grounding needs clean text — could be derived on read, but
  deriving from the same stored column keeps **one** canonical path
  (`spec.md` "one deterministic way").
- Portal list `excerpt` (`RT-7.4`) — same.

Properties that keep it safe and cheap:

- **Additive + nullable.** Migration adds one column, no `NOT NULL`, no
  default computation risk.
- **Trivial, non-destructive backfill.** *At launch every existing row is
  plain text*, so the backfill is literally
  `UPDATE "KnowledgeArticle" SET "contentText" = "content"` — no HTML
  stripping, no data loss, fully reversible (drop column).
- **Maintained on every write** by the service:
  `contentText = articleHtmlToPlainText(sanitizedContent)`.
- **Never projected** in any API response, never in `AuditLog`.
- **Reversible:** dropping the column and reverting the code restores the
  prior behavior; `content` still holds everything renderable.

If a reviewer rejects the column, the fallback is: derive text on read
for AI + excerpt, and **narrow KB search to `title` + `category`** —
which is a regression against `RT-5.1`/`RT-5.3` and is called out as
[Open Question 1](#rich-text--open-decisions-for-human-review). The plan
**recommends the column.**

### Schema change summary

- `server/prisma/schema.prisma` — `KnowledgeArticle` gains
  `contentText String?`.
- One additive migration:
  `ALTER TABLE "KnowledgeArticle" ADD COLUMN "contentText" TEXT;`
  then `UPDATE … SET "contentText" = "content";`.
- No other model, enum, index, or relation change. `content`,
  `KnowledgeArticleStatus`, RBAC, routes — untouched.

## Backward-Compatibility Strategy (`BC-1`…`BC-4`)

**Mechanism = normalize-on-write + a content-shape sniff, mirroring
`MessageBody`.**

- **Detection rule (`BC-2`):** a body is treated as rich when it matches
  the existing `LOOKS_LIKE_HTML`-style tag sniff (a recognized block/inline
  tag from the allowlist). This is *reliable here* — not a fragile guess —
  because:
  1. the server **normalizes on write**: every create/update runs
     `content` through `sanitizeArticleHtml`, and the editor always emits
     at least a `<p>…</p>`, so **every article saved after the
     enhancement is well-formed sanitized HTML** that matches the sniff;
  2. **every article not yet re-saved is plain text** (`BC-1`) and
     reliably fails the sniff;
  3. a false positive (legacy text that happens to contain `<p>`-like
     substrings) still renders **safely** — it goes through the same
     sanitizer/DOMPurify path;
  4. a false negative just renders as preformatted text (current
     behavior).
  No version column, no format flag — avoids a second migration.
- **Legacy render (`BC-3`):** internal + portal detail use the shared
  `<ArticleContent>` component: sniff → (rich) DOMPurify-re-sanitize +
  `dangerouslySetInnerHTML`; (plain) existing `whitespace-pre-wrap
  break-words` + `dir="auto"`. A never-edited legacy article hits the
  plain branch → **pixel-identical to today** (`RT-4.1`, `RT-4.3`).
- **Legacy in the editor (`BC-3`):** the form page detects shape. Rich →
  `$generateNodesFromDOM`. Plain → build paragraph nodes by splitting on
  blank lines / newlines so structure is preserved (`RT-2.4`).
- **Legacy on save (`BC-3`, `RT-4.4`):** serialized to sanitized HTML
  like any article; `contentText` re-derived. Audited as one normal
  `KNOWLEDGE_ARTICLE_UPDATED` (`RT-2.3`).
- **Data migration (`BC-4`):** only the additive `contentText` column +
  the `SET contentText = content` backfill. **No content is rewritten.**
  Legacy `content` stays plain text until a human edits that article.
  Zero destructive migration.

## Frontend Architecture

| File | Change |
| --- | --- |
| `client/src/features/knowledge-base/knowledge-article-editor.tsx` | **New.** Lexical composer: `LexicalComposer` + `RichTextPlugin` + `HistoryPlugin` + `ListPlugin` + `LinkPlugin`; nodes `HeadingNode, ListNode, ListItemNode, LinkNode`; `forwardRef` handle exposing `getHtml()` / `getPlainText()` / `hasText()` / `setHtml(value)` / `focus()`. Namespace `"knowledge-article"`. `dir="auto"` content element; logical-property theme. |
| `client/src/features/knowledge-base/knowledge-article-editor-toolbar.tsx` | **New.** Mirrors `ticket-reply-toolbar.tsx`; adds **H2 / H3** toggle buttons (`$setBlocksType` + `$createHeadingNode`). Icon-only, `aria-pressed`, i18n labels. |
| `knowledge-article-link-popover` | **Reuse** the ticket popover + link utils by import, or copy the ~2 files into the KB folder if importing widens the graph. Protocol allowlist preserved. |
| `client/src/features/knowledge-base/knowledge-article-content.tsx` | **New.** `<ArticleContent content={string} />` — the shared render guard (sniff → DOMPurify allowlist `p br h2 h3 ul ol li b strong i em u a` + `href/target/rel` + `^(?:https?:|mailto:)` → `dangerouslySetInnerHTML`; else plain-text path). One place, used by internal **and** portal detail. |
| `client/src/lib/rich-text/article-html.ts` (or co-located) | **New (client).** DOMPurify config + sniff constant for `<ArticleContent>` and for the editor's legacy-hydration path. Do **not** edit `ticket-conversation-ui.tsx` to share its private helper (scope). |
| `client/src/features/knowledge-base/knowledge-article-form-page.tsx` | Replace the `<textarea>` with `<Controller name="content">` wrapping `<KnowledgeArticleEditor>`. On submit: `field` holds serialized HTML. On load/`values`: hydrate editor from `article.data.content` (rich or legacy plain). Keep RHF + Zod, labels, RBAC guard, error display. |
| `client/src/features/knowledge-base/knowledge-article.schemas.ts` | `content` validation works on the **plain-text length** of the editor value (non-empty, ≤ 50 000 readable chars) — not raw HTML length. Keep the existing error keys. |
| `client/src/features/knowledge-base/knowledge-base-detail-page.tsx` | Swap `{data.content}` block for `<ArticleContent content={data.content} />`. Keep the surrounding `<article>` container, `dir="auto"`, spacing. |
| `client/src/features/portal/portal-knowledge-pages.tsx` | Same swap for the portal detail `{article.content}` block. List/excerpt untouched (server-derived plain). |
| `client/src/features/knowledge-base/knowledge-article-format.ts` | Possibly add a small shared helper; or leave and put helpers in `knowledge-article-content.tsx`. |
| i18n `client/src/locales/{en,ar}/*.json` | New keys: toolbar labels (heading 2, heading 3, bold, italic, underline, bullet list, numbered list, link, undo, redo), editor `aria-label`, any new validation copy. EN + AR parity required. |

**Not changed (frontend):** any ticket editor/toolbar/conversation file;
KB list page + table; KB hooks / api / permissions / error map; portal
list; routing; nav; RBAC guards.

## Backend — Validation / Storage Implications

| File | Change |
| --- | --- |
| `server/src/shared/rich-text/reply-html.ts` | **Extend in place** (it is a shared `src/shared` module, not ticket-owned): export `ARTICLE_HTML_SANITIZE_OPTIONS` (= reply options **+ `h2`, `h3`**), `sanitizeArticleHtml(input)`, and reuse `replyHtmlToPlainText` for the flatten — add `h[1-6]` to its block-boundary regex (headings never appear in reply HTML, so **reply behavior is byte-identical**; covered by keeping the existing reply tests green). Optionally alias `articleHtmlToPlainText = replyHtmlToPlainText`. Rationale for not making a parallel module: one sanitizer module, one spec, mirrors how the client keeps one `MessageBody` guard. |
| `server/src/modules/knowledge-base/knowledge-article.schema.ts` | Raise `content` `.max()` for markup headroom (e.g. `50_000 → 200_000`); keep `.min(1)` and `.trim()`. The **real** ceiling (≤ 50 000 readable chars, non-empty after sanitize) is enforced in the service against the derived text. `.strict()` unchanged; no new field. |
| `server/src/modules/knowledge-base/knowledge-article.service.ts` | **Write:** in `createKnowledgeArticle` / `updateKnowledgeArticle`, before the `tx` write, `const html = sanitizeArticleHtml(input.content)`; reject (`AppError 400 VALIDATION_ERROR`, existing shape) if the flattened text is empty or > 50 000; persist `content: html` and `contentText: articleHtmlToPlainText(html)`. **Audit call sites unchanged** — `changedFields` still only `title/category/status`; `contentChanged` still compares (now sanitized) `content`; body/`contentText` never enter the audit payload. **Read:** `searchWhere` matches `contentText` instead of `content`; `deriveExcerpt(article.contentText)` in `listPublishedKnowledgeArticles`. `detailSelect` / `portalDetailSelect` still return `content` (now HTML) — `contentText` is **not** added to any projection. |
| `server/src/modules/ai/ai-kb-candidates.ts` | `select: { id, title, contentText }`; keyword `OR` matches `title` + `contentText`; `excerpt: deriveExcerpt(row.contentText)`. PUBLISHED-only + `take` unchanged. |
| `server/src/modules/customer-ai/customer-ai-context.ts` | `select: { id, title, category, contentText }`; `OR` over `title`/`contentText`/`category`; return shape swaps `content` → the plain text (rename field to keep callers honest, or map into `content`). |
| `server/src/modules/customer-ai/customer-ai.service.ts` | `SOURCES` `CONTENT:` uses the plain-text field, never raw HTML (`RT-6.2`). Truncation/limits unchanged (`RT-6.3`). |
| `server/src/modules/knowledge-base/knowledge-article.controller.ts` | **No signature change expected** — it already forwards actor + request context. Listed so review confirms it stays untouched. |
| `server/prisma/schema.prisma` + `server/prisma/migrations/**` | Additive `contentText String?` + backfill migration (above). |

**Not changed (backend):** `audit-log.constants.ts`,
`audit-log.service.ts`, `audit-request-context.ts` (KB-AUDIT frozen);
`knowledge-article.routes.ts`, `knowledge-article.portal.routes.ts`
(routes + RBAC); `KnowledgeArticleStatus` enum; portal `portal.service`
KB paths; ticket/notes/email sanitizer call sites (reply behavior
unchanged).

## Safe Rendering Strategy

- Internal + portal detail render **only** through `<ArticleContent>`:
  sniff → DOMPurify (small allowlist, safe-URI regexp, forced
  `rel`/`target` via `afterSanitizeAttributes`) → `dangerouslySetInnerHTML`;
  legacy/plain → `whitespace-pre-wrap` text node (no HTML path at all).
- The server value is already sanitized on write; the client sanitize is
  defense-in-depth against a pre-enhancement row or any unexpected markup
  — identical rationale to `MessageBody`'s comment.
- No other component gains `dangerouslySetInnerHTML`. The portal list and
  every excerpt render plain strings.

## Sanitization / Security Plan (`SEC-1`…`SEC-7`)

- **Trust boundary:** `sanitizeArticleHtml` on the server is the only
  trusted transform. Client editor output = untrusted. Client render =
  re-sanitized. Stated in code comments on both sides.
- **Server allowlist:** `p br h2 h3 ul ol li b strong i em u a`;
  `a` keeps only `href` (schemes `http`/`https`/`mailto`) and gets
  `rel="noopener noreferrer nofollow" target="_blank"`; everything else
  (`script`, `style`, `class`, `id`, `data-*`, event handlers, `img`,
  `iframe`, `object`, `form`, media, `data:`/`javascript:` URIs) is
  dropped, text preserved. Empty-after-sanitize ⇒ validation error.
- **Client allowlist:** same tag set + `href/target/rel` +
  `ALLOWED_URI_REGEXP = ^(?:https?:|mailto:)`.
- **Links:** protocol allowlist on both sides; editor link popover keeps
  the ADR-041 `javascript:`/`data:`/`vbscript:`/`file:` rejection.
- **Paste:** Lexical reduces pasted content to registered nodes; server
  sanitizer is the authority.
- **AI:** `articleHtmlToPlainText` strips all tags ⇒ no markup can reach
  a model even if a malformed row exists.
- **Reused utilities:** `sanitize-html` (server, already a dep),
  `dompurify` (client, already a dep). **No new security dependency.**

## Search Handling (`RT-5`)

- Add `contentText` (above); point `searchWhere` and both AI keyword
  loops at `contentText`.
- `contentText` is derived from sanitized HTML via
  `articleHtmlToPlainText` on every write; for legacy rows it equals
  `content` (backfill) until first edit. ⇒ `RT-5.3` (legacy matches
  preserved) holds by construction.
- Search API surface (params, envelope, status scoping, pagination,
  ordering, empty-state) unchanged (`RT-5.2`).
- Markup tokens (`nofollow`, `href` URLs, tag names) are absent from
  `contentText` ⇒ no spurious matches (`RT-5.1`).

## AI Plain-Text Extraction (`RT-6`)

- One helper: `articleHtmlToPlainText` (= extended `replyHtmlToPlainText`).
  Deterministic, dependency-free, pure.
- `ai-kb-candidates` and `customer-ai-context` select `contentText`
  (already plain) — no per-request HTML parsing needed on the hot path.
- `customer-ai.service` `SOURCES` uses that plain text; existing per-
  article and total truncation preserved.
- PUBLISHED-only `where`, existing projections, existing access
  boundaries, prompt-injection neutralization — all unchanged (`RT-6.1`,
  `RT-6.5`). No `AuditLog` interaction on any read path (`RT-6.4`).

## Audit Compatibility (`RT-9`)

- No change to `audit-log.constants.ts` / `audit-log.service.ts`.
- `createAuditLog` call sites in the KB service are **not touched** by
  this work beyond the fact that `content` is now sanitized HTML before
  the comparison — `contentChanged` is still a boolean marker, still the
  only body signal, still no body text in `metadata`.
- `contentText` is never passed to `changedFields`, never in `metadata`,
  never in a projection.
- Exactly-once, transactional atomicity, no-op suppression, action
  selection — all inherited unchanged from KB-AUDIT.
- Regression test: a content-only `PATCH` on a rich article ⇒ exactly one
  `KNOWLEDGE_ARTICLE_UPDATED` row, `metadata.contentChanged === true`, no
  HTML/text substring of the body anywhere in the serialized audit call.

## Testing Strategy

**Backend**

- `server/src/shared/rich-text/*.test.ts` (new or extended):
  `sanitizeArticleHtml` keeps `h2/h3` + the reply set, drops
  `script`/handlers/`img`/`iframe`/`style`/unsafe hrefs; existing
  `sanitizeReplyHtml` / `replyHtmlToPlainText` assertions still pass
  (reply behavior unchanged); `articleHtmlToPlainText` flattens headings
  + lists to readable text.
- `knowledge-article.test.ts`: create/update persist sanitized `content`
  + derived `contentText`; XSS payload neutralized; empty-after-sanitize
  ⇒ `400`; **audit regression** (content-only edit = one `UPDATED`,
  marker only, no body leak); no-op `PATCH` still writes no row; legacy
  plain-text row updated ⇒ becomes HTML, one `UPDATED`.
- `knowledge-article.portal.test.ts`: portal detail returns rich
  `content`; portal list `excerpt` is plain, markup-free, ≤ 200; DRAFT
  still `404`.
- Search test: rich article matches on a readable word; does **not**
  match `"nofollow"` / a tag name / an `href` URL; legacy article still
  matches.
- `ai.test.ts` / `customer-ai.test.ts`: candidates + SOURCES carry plain
  text only (no `<`/tag substrings); PUBLISHED-only; truncation limits;
  no `auditLog.create` on the retrieval path.

**Frontend**

- `knowledge-article-editor.test.tsx` (new): toolbar applies each V1
  format; `getHtml()` emits allowlisted tags only; H2/H3 present, no
  disallowed nodes.
- `knowledge-base.test.tsx` / form tests: submit sends serialized HTML;
  hydration from rich HTML and from legacy plain text (paragraphs
  preserved); empty body blocked with the existing error key; RBAC guard
  unchanged.
- `<ArticleContent>` tests: rich renders formatted; `<script>`/`onclick`/
  `javascript:` payload stripped; legacy plain text renders via the
  `whitespace-pre-wrap` path unchanged; `dir="auto"` present.
- `portal-knowledge.test.tsx`: portal detail uses `<ArticleContent>`;
  layout selectors still match (update any pinned CSS-selector assertion
  in the same task — see cerebrum note on `portal-pages.test.tsx`).
- EN/AR i18n parity test stays green.

## Migration Strategy

- One Prisma migration: add `contentText TEXT` (nullable) +
  `UPDATE "KnowledgeArticle" SET "contentText" = "content"`.
- Additive, non-destructive, reversible (drop column).
- No rewrite of `content`. No lifecycle/enum/index change.
- Rollback: revert the code + drop the column; `content` still renders
  (legacy rows plain; any rich rows written meanwhile still sanitize fine
  through the reverted plain-text renderer would show tags — acceptable
  and unlikely in the rollback window; documented).

## Documentation Impact (applied in KB-RICH-014, not now)

- **`docs/17-decisions-log.md` — new ADR** "Knowledge Base Rich Text on
  the existing Lexical + sanitizer infrastructure": editor reuse, HTML in
  `content`, additive `contentText`, backward-compat sniff,
  security boundary, search/AI derivation. This **is** a new
  architectural decision (new column, new render surface, editor
  migration) — unlike KB-AUDIT which was an ADR-039 progress note. It
  supersedes ADR-020's "no rich-text" consequence.
- **`docs/05-api-contract.md`** — note that KB `content` is now
  server-sanitized rich HTML (representation change, same field/type);
  portal list `excerpt` stays plain.
- **`docs/18-ui-pages-spec.md` §11–13** — the article editor is now a
  bounded rich editor, not a `<textarea>`.
- **`docs/06-auth-rbac.md`** — no permission change; at most a one-line
  note that authoring uses a rich editor (RBAC identical).
- **`specs/constitution.md`** (line ~22) and **`specs/architecture.md`**
  (lines ~86–91) — correct the "KB bodies are plain text / no rich-text
  migration" statements. **Minimal pointers added by this planning task**
  to keep the SDD set self-consistent; fuller doc edits in KB-RICH-014.
- **`docs/19-progress-tracking.md`** — status: KB Rich Text implemented
  on branch / verified, when done.

## Rollout / Regression Concerns

- **API representation change** for `content` — the main compat risk;
  mitigated by lockstep in-repo consumer updates + `docs/05` note + no
  known external consumer. Flag if inspection finds one.
- **Client bundle** — Lexical is already in the ticket bundle; the KB
  editor route can be lazy-loaded (KB authoring is not a hot path) to
  avoid growing the initial chunk.
- **Sniff false-negative on an odd legacy body** — renders as
  preformatted text (current behavior), never unsafe.
- **`portal-pages.test.tsx` / `portal-knowledge.test.tsx` pinned CSS
  selectors** — update in the same task that changes the markup (cerebrum
  note).
- **Reply sanitizer shared edit** — keep every existing reply/notes/
  email/AI-context test green to prove no ticket regression.
- **Search behavior shift** — `contentText`-based search is *more*
  precise; add a test asserting a previously-matching legacy query still
  matches.

## Expected File Impact — Rich Text

### Backend — expected to change

- `server/prisma/schema.prisma` (`+ contentText String?`)
- `server/prisma/migrations/<new>/migration.sql` (additive + backfill)
- `server/src/shared/rich-text/reply-html.ts` (add article sanitize
  options + helper; extend flatten regex)
- `server/src/shared/rich-text/reply-html.test.ts` (or a new
  `article-html.test.ts`)
- `server/src/modules/knowledge-base/knowledge-article.schema.ts`
- `server/src/modules/knowledge-base/knowledge-article.service.ts`
- `server/src/modules/ai/ai-kb-candidates.ts`
- `server/src/modules/customer-ai/customer-ai-context.ts`
- `server/src/modules/customer-ai/customer-ai.service.ts`
- `server/src/modules/knowledge-base/knowledge-article.test.ts`
- `server/src/modules/knowledge-base/knowledge-article.portal.test.ts`
- `server/src/modules/ai/ai.test.ts`
- `server/src/modules/customer-ai/customer-ai.test.ts`

### Frontend — expected to change

- `client/src/features/knowledge-base/knowledge-article-editor.tsx` (new)
- `client/src/features/knowledge-base/knowledge-article-editor-toolbar.tsx` (new)
- `client/src/features/knowledge-base/knowledge-article-content.tsx` (new)
- `client/src/lib/rich-text/article-html.ts` (new; final path TBD at task time)
- `client/src/features/knowledge-base/knowledge-article-form-page.tsx`
- `client/src/features/knowledge-base/knowledge-article.schemas.ts`
- `client/src/features/knowledge-base/knowledge-base-detail-page.tsx`
- `client/src/features/portal/portal-knowledge-pages.tsx`
- `client/src/features/knowledge-base/knowledge-article-editor.test.tsx` (new)
- `client/src/features/knowledge-base/knowledge-base.test.tsx`
- `client/src/features/portal/portal-knowledge.test.tsx`
- `client/src/locales/en/*.json`, `client/src/locales/ar/*.json`
- possibly `client/src/features/knowledge-base/knowledge-article-link-popover.*` (copy) — only if the ticket popover cannot be imported cleanly

### Docs / specs — expected to change (KB-RICH-014)

- `docs/17-decisions-log.md` (new ADR), `docs/05-api-contract.md`,
  `docs/18-ui-pages-spec.md`, `docs/06-auth-rbac.md`,
  `docs/19-progress-tracking.md`
- `specs/constitution.md`, `specs/architecture.md` (minimal pointers
  already added at planning time; confirm/expand)
- `specs/features/knowledge-base/spec.md` / `plan.md` — only if
  implementation reveals a needed correction

### Explicitly NOT expected to change

- Any `client/src/features/tickets/**` file (editor, toolbar, link
  popover source, `ticket-conversation-ui.tsx`, conversation tests)
- `server/src/modules/audit-logs/**` (KB-AUDIT frozen)
- `server/src/modules/knowledge-base/knowledge-article.routes.ts`,
  `knowledge-article.portal.routes.ts`,
  `knowledge-article.controller.ts` (no route/RBAC/signature change)
- `server/src/modules/portal/portal.service.ts` KB paths
- `KnowledgeArticleStatus` enum; any lifecycle field
- KB list page, table, hooks, api client, permissions, error map
- Portal KB **list** page/handler; portal nav; routing; RBAC guards
- `package.json` / lockfiles (no dependency change, client or server)
- `docs/11-ai-features.md` behavior (grounding semantics unchanged)

## Rich Text — Open Decisions For Human Review

1. **`contentText` column** — the plan recommends adding the additive
   nullable column (required for non-leaky search + one canonical
   plain-text path). Reviewer may instead accept **narrowed search
   (title + category only)** with read-time derivation for AI/excerpt and
   **no schema change** — at the cost of `RT-5.1`/`RT-5.3`.
2. **Heading levels** — plan assumes **two** (H2 section, H3
   sub-section). Confirm vs. one or three.
3. **Link popover** — import the ticket component vs. copy into the KB
   folder. Decided at task time by import-graph inspection; noted here
   because it is the one "reuse vs. duplicate" judgement call.
4. **`content` schema `.max()` headroom value** — plan suggests
   `200_000`; confirm it is comfortably above realistic sanitized-HTML
   size for a 50 000-char article.

## Rich Text — Plan Status

`IMPLEMENTATION COMPLETE` — implemented per this plan and `tasks.md`
(`KB-RICH-001`…`KB-RICH-015`) on branch `chore/sdd-foundation` (2026-09-09),
ADR-057. The four "Open Decisions For Human Review" were approved as the plan
recommended: (1) add `contentText`; (2) two heading levels; (3) the ticket
link popover is **reused by import** (clean presentational graph); (4)
`content` `.max()` raised to `200_000`. Changes unstaged/uncommitted.

Prior status (kept for history): `READY FOR TASK BREAKDOWN`

Resolved: editor strategy (reuse Lexical, new sibling component),
storage (`content` = sanitized HTML, no column change; additive
`contentText String?` for the plain-text projection), backward
compatibility (normalize-on-write + shape sniff, zero destructive
migration), security (server sanitizer as trust boundary + client
re-sanitize, reused utilities), search (`contentText`), AI grounding
(`articleHtmlToPlainText`, PUBLISHED-only unchanged), audit (frozen,
regression-tested), file impact (enumerated, with an explicit
not-changing list).

Deferred to human review: the four items above.

Next step: extend `specs/features/knowledge-base/tasks.md` with the
`KB-RICH-*` sequence (task breakdown only — no implementation).

---

## Plan Status (KB Audit pilot)

`READY FOR TASK BREAKDOWN`

Resolved:

- **Entity type** — `KNOWLEDGE_ARTICLE`, new string constant, no migration.
- **Action granularity** — five dedicated constants
  (`KNOWLEDGE_ARTICLE_CREATED` / `_UPDATED` / `_PUBLISHED` / `_UNPUBLISHED` /
  `_DELETED`), matching the `*_ACTIVATED` / `*_DEACTIVATED` lifecycle
  precedent; status-derived action selection inside `updateKnowledgeArticle`.
- **Service integration points** — `createKnowledgeArticle`,
  `updateKnowledgeArticle`, `deleteKnowledgeArticle` in
  `knowledge-article.service.ts`; controller context wiring; routes
  unchanged.
- **Transaction strategy** — all three mutations wrapped in a new
  `prisma.$transaction` with `createAuditLog(..., tx)` inside; reads
  untouched; blocking (not best-effort) audit per ADR-039.
- **Metadata strategy** — `title` / `category` / `status` via
  `changedFields` with real values; `content` as
  `metadata.contentChanged` boolean only; body never stored; delete keeps
  `title` / `category` / `status` `from` + id.
- **Request context strategy** — `actorId` from `request.auth.userId`,
  IP/UA from `getAuditRequestContext(request)`, both passed from the
  controller; no client-supplied actor; route signatures unchanged.
- **Test strategy** — concrete per-mutation assertions + negative
  (unauthorized / invalid / read) + atomicity, extending existing suites,
  with the one-time `$transaction`/`auditLog` mock port.

Next step: create `specs/features/knowledge-base/tasks.md` (task breakdown
only — no implementation).
