# Knowledge Base

## Status

Two capabilities, tracked separately in this one package:

| Capability | State |
| --- | --- |
| **KB Audit Logging** (`KB-AUDIT-001`…`011`) | **Implementation complete** (2026-09-09). See [Pilot Enhancement — Audit-Log Integration](#pilot-enhancement--audit-log-integration) and [Implemented as (2026-09-09)](#implemented-as-2026-09-09). Preserved below as implemented history. |
| **KB Rich Text Content** (`KB-RICH-*`) | **Implemented; code + test verification complete** on branch `chore/sdd-foundation` (2026-09-09, `KB-RICH-001`…`KB-RICH-015`; ADR-057). Changes committed. **One verification step remains open**: migration apply/rollback for `20260909120000_kb_article_content_text` has not been exercised against a disposable Postgres in this environment — see [Migration Verification Status](#migration-verification-status). See [Knowledge Base Rich Text Content](#knowledge-base-rich-text-content). |
| **Overall Knowledge Base SDD enhancement work** | **Ready for human review; merge gated on the migration-apply verification step above** — the Rich Text enhancement is implemented and every `KB-RICH-015` check other than the disposable-DB migration apply/rollback has run. |

The Audit pilot resolved its seven clarification questions
(section [Clarification Decisions](#clarification-decisions)). This is a
**brownfield** spec: the Knowledge Base already ships end-to-end
(`server/src/modules/knowledge-base/`, `client/src/features/knowledge-base/`,
`client/src/features/portal/portal-knowledge-pages.tsx`, the
`KnowledgeArticle` model, ADR-020). The finalized scope of this SDD pilot
is a single low-risk enhancement — **audit-log coverage for Knowledge
Base management mutations** — on top of behavior that must not regress.

## SDD Pilot Scope Statement

> The first Knowledge Base SDD pilot is intentionally a brownfield,
> low-risk vertical slice. Its implementation scope is:
>
> **Add `AuditLog` coverage to the existing Knowledge Base management
> mutations (create, edit, publish, unpublish, delete) while preserving
> all existing Knowledge Base product behavior.**
>
> `plan.md` and `tasks.md` must treat the current Knowledge Base
> implementation as fixed baseline, not as work to rebuild or redesign.
> No schema change, no migration, no new dependency, no lifecycle change,
> no localization work.

## Goal

Let customers self-serve published help content before opening a ticket,
and let authorized staff manage that content. This pilot adds one thing:
management changes to that content become traceable through the same
system-wide `AuditLog` used by the rest of the CRM.

## Context

### Why now

- The CRM has a documented, actively-written system-wide `AuditLog`
  (`specs/domain-model.md#core-entities`,
  `specs/features/auth-rbac/spec.md` "Audit logging — `AuditLog` and
  `TicketHistory`"). Knowledge Base
  management mutations are currently **not** recorded there — an
  inconsistency with users, customers, tickets, categories, SLA rules,
  and org-structure entities, all of which audit their mutations.
- Knowledge Base content is customer-facing and grounds the AI
  assistants; changes to it deserve the same traceability as other
  administrative changes.
- It is a contained slice that exercises the SDD workflow without
  redesigning a working feature.

### Domain entities touched

- `KnowledgeArticle` — `id`, `title`, `content`, `category?` (nullable
  free-text String), `status` (`DRAFT` | `PUBLISHED`, default `DRAFT`),
  `createdById`, `createdAt`, `updatedAt`.
- `KnowledgeArticleStatus` enum — `DRAFT`, `PUBLISHED` (unchanged).
- `AuditLog` — `actorId?`, `action` (String), `entityType` (String),
  `entityId?`, `metadata` (Json, flat safe values +
  `metadata.changes`), `ipAddress?`, `userAgent?`, `createdAt`. Written
  via `createAuditLog(...)` in
  `server/src/modules/audit-logs/audit-log.service.ts`, which accepts a
  Prisma transaction client. Action/entity constants live in
  `audit-logs/audit-log.constants.ts` (`AUDIT_ACTIONS`,
  `AUDIT_ENTITY_TYPES`); request IP/UA come from
  `getAuditRequestContext(...)`.
- `User` — `createdById` author reference, `onDelete: Restrict`
  (unchanged).

### Relevant decisions / specs

- ADR-020 — "Knowledge Base on the Existing `KnowledgeArticle` Model"
  (`specs/decisions.md`): plain-text body (superseded by ADR-057, below),
  2-state lifecycle, RBAC, portal contract.
- ADR-054 — customer-AI context boundary (published-only retrieval).
- ADR-034 Phase 5 — KB→reply insertion deferred (no customer-safe
  absolute article URL).
- ADR-057 — Knowledge Base Rich Text (`specs/decisions.md`).
- `specs/features/auth-rbac/spec.md` — "Internal Knowledge Base
  Permissions" table.
- `specs/features/ai-assistance/spec.md` — published-only KB retrieval
  for AI.
- `docs/18-ui-pages-spec.md` §11–13 (historical/non-authoritative) — page
  structure reference.

## Actors

Roles per `Role` enum and `specs/domain-model.md#actors--roles`:
`ADMIN`, `MANAGER`, `AGENT`, `CUSTOMER`.

| Actor | Knowledge Base role (unchanged by this pilot) |
| --- | --- |
| `ADMIN` | Full management, global scope: list/read (any status), create, edit, publish, unpublish, delete. |
| `MANAGER` | Same as `ADMIN` for KB — full management, **global** (not team-scoped). |
| `AGENT` | Read-only: list/search and read articles including `DRAFT`; consumes KB via internal workflows (e.g. the "Find Solution" AI action). No create/edit/publish/unpublish/delete. |
| `CUSTOMER` | Read **published** articles only, through the authenticated portal (browse, search, category filter, detail). No drafts, no status/author/internal fields, no write. |
| Unauthenticated | No access to any KB route (internal or portal). |

This pilot adds no actor and changes no permission. It only makes the
`ADMIN`/`MANAGER` management actions auditable.

## User Stories

- As a **customer**, I want to browse and search published Knowledge
  Base content so I can solve common support issues without creating a
  ticket.
- As a **customer**, I want article content shown with correct reading
  direction (LTR/RTL) for its own text, regardless of my portal UI
  language.
- As an **agent**, I want to read internal Knowledge Base content
  (including drafts) so I can find approved support information while
  handling customer issues.
- As an **authorized Knowledge Base manager (`ADMIN`/`MANAGER`)**, I want
  to create and maintain articles so customer-facing support
  information stays accurate.
- As an **administrator**, I want Knowledge Base management changes to be
  auditable so administrative content changes can be traced consistently
  with the rest of the CRM.

No stories are added for future localization, archive, public-KB, or
structured-taxonomy work.

## Functional Requirements

### Existing Behavior to Preserve

This pilot must **not intentionally alter** any of the following. They
are non-regression constraints for `plan.md`, `tasks.md`, and
implementation.

**Routes / contracts**

- Internal: `GET /api/knowledge-articles`, `GET /api/knowledge-articles/:id`,
  `POST /api/knowledge-articles`, `PATCH /api/knowledge-articles/:id`,
  `DELETE /api/knowledge-articles/:id` — request/response shapes,
  projections, and status codes unchanged.
- Portal: `GET /api/portal/knowledge-articles`,
  `GET /api/portal/knowledge-articles/:id` — unchanged.
- Frontend routes `/knowledge-base`, `/knowledge-base/new`,
  `/knowledge-base/:id`, `/knowledge-base/:id/edit`, and portal
  `/portal/knowledge-base`, `/portal/knowledge-base/:id` — unchanged.

**Permissions**

- Internal read: `ADMIN` / `MANAGER` / `AGENT` (drafts included).
- Internal mutations: `ADMIN` / `MANAGER` only; `AGENT` → `403`;
  `CUSTOMER` / anonymous rejected.
- Portal: authenticated `CUSTOMER` only; internal roles rejected from
  the portal boundary.
- `createdById` is server-derived and never client-supplied; strict
  schemas reject unknown fields.
- Server-side authorization remains the only security boundary;
  frontend guards (`KnowledgeArticleManageRoute`) stay UX-only.

**Lifecycle & deletion**

- Two states only: `DRAFT` ⇄ `PUBLISHED`, freely reversible via `PATCH`.
- No `ARCHIVED`, no `publishedAt`, no soft-delete field.
- `DELETE` is a hard, permanent delete per current authorization/
  business rules.

**Content & rendering**

- Body is **plain text** (`title` 3–200 chars, `content` 1–50 000
  chars, both trimmed). No Markdown, no rich text, no
  `dangerouslySetInnerHTML`.
- Detail rendering preserves paragraphs (`whitespace-pre-wrap`,
  `break-words`) and uses `dir="auto"` so an Arabic or English body
  renders in the correct direction.

> **Superseded for content only.** The two plain-text bullets above
> describe the **pre-Rich-Text baseline** the Audit pilot was built on.
> The [Knowledge Base Rich Text Content](#knowledge-base-rich-text-content)
> capability (specified 2026-09-09) replaces the plain-text authoring and
> rendering model with a bounded Rich Text one, while keeping every other
> item in this "Existing Behavior to Preserve" list — routes, RBAC,
> lifecycle, read semantics, customer visibility, AI grounding safety,
> audit behavior — unchanged. Directionality (`dir="auto"`) and paragraph
> preservation remain required.

**Read semantics**

- Search: case-insensitive substring over `title` + `content` +
  `category`. Internal search spans all statuses; portal + AI search
  stay `PUBLISHED`-only. Empty query = unfiltered list; no matches =
  empty state, not an error. `search` bounded ≤ 100 chars.
- Category filter: exact-match on the free-text string (1–100 chars),
  optional.
- Ordering: `updatedAt DESC`, then `id ASC`.
- Pagination: `page` (≥ 1, default 1), `limit` (1–100, default 20);
  `meta: { page, limit, total, totalPages }`.

**Customer visibility**

- Portal listing/detail/search return `PUBLISHED` only; no draft or
  internal field (status, author) is ever exposed to a customer through
  any parameter combination.
- A portal request for a `DRAFT` id and for a missing id return the
  identical `404 KNOWLEDGE_ARTICLE_NOT_FOUND` — draft existence is not
  probeable.
- A previously-shared link to an unpublished article resolves to the
  standard not-found outcome for customers; internal roles still reach
  it.

**AI grounding**

- `customer-ai` context retrieval and the internal `ai` KB-suggestion
  retrieval query `status = PUBLISHED` only and project id/title/excerpt
  — never full body, never drafts. Unchanged.

**Other**

- Global `MANAGER` scope for KB management (no team-scoped ownership or
  filtering).
- `category` stays optional free-text (not the ticket `Category`
  entity, no `KnowledgeCategory` table).
- Knowledge Base access is through the authenticated customer portal
  only (no public/anonymous routes, no SEO surface, no public article
  URLs).
- No realtime/SSE events for KB; mutations invalidate the relevant
  TanStack Query keys (internal list/detail + the portal
  `["portal","knowledge-articles"]` subtree).
- `KnowledgeArticle.createdBy` remains `onDelete: Restrict`.

### Pilot Enhancement — Audit-Log Integration

The only new behavior in this pilot.

1. Each **successful** Knowledge Base management mutation performed
   through the internal routes produces exactly one `AuditLog` entry,
   written with the project's existing audit conventions
   (`createAuditLog(...)`, `AUDIT_ACTIONS` / `AUDIT_ENTITY_TYPES`
   constants, `getAuditRequestContext(...)`).
2. Auditable mutations:
   - article **created** (`POST`)
   - article **edited** — a successful `PATCH` that changes auditable
     article data (`title`, `content`, `category`)
   - article **published** — a successful `PATCH` transition
     `DRAFT → PUBLISHED`
   - article **unpublished** — a successful `PATCH` transition
     `PUBLISHED → DRAFT`
   - article **deleted** (`DELETE`)
3. A single `PATCH` that both edits fields and changes status may
   produce the natural combination of the above per existing audit
   conventions; the exact action-constant granularity (distinct
   `*_PUBLISHED` / `*_UNPUBLISHED` actions vs. a status entry in
   `metadata.changes` on an update action) is a **plan-level decision**,
   constrained to match how the codebase already models comparable
   lifecycle changes (e.g. `USER_ACTIVATED` / `USER_DEACTIVATED` vs.
   `changedFields(...)` in `metadata.changes`).
4. Reads never produce an audit entry: `GET` list, `GET` detail,
   internal search, portal list/detail/search, and AI grounding
   retrieval create no `AuditLog` row.
5. A rejected mutation (`403` unauthorized, `400` validation, `404`
   missing article) produces **no** success `AuditLog` entry.
6. The audit `actorId` is derived from the authenticated server-side
   user context (`request.auth`); a client-supplied actor field is never
   trusted or accepted.
7. Audit `metadata` carries only safe, flat descriptive values (changed
   field names and lifecycle booleans/labels via `metadata.changes`);
   it must not contain the full article body, secrets, tokens, or
   unsanitized content.
8. Audit writing follows the project's existing transactional
   convention for the operation: where a mutation already runs in a
   Prisma transaction, the audit write participates in that transaction
   (via the `db` parameter of `createAuditLog`) so a failed mutation
   leaves no audit row and a successful one always has its audit row.
9. No new audit-read surface, endpoint, filter, or UI is added — the
   new entries appear in the existing `ADMIN`-only audit-log views and
   filters by virtue of using the standard entity type / actions.

## Article Lifecycle (unchanged)

| State | Customer sees it? | Who can set it | Notes |
| --- | --- | --- | --- |
| `DRAFT` | No | `ADMIN`, `MANAGER` | Default on create; internally visible to all internal roles. |
| `PUBLISHED` | Yes (portal + AI grounding) | `ADMIN`, `MANAGER` | Reversible to `DRAFT`. |

- `PUBLISHED → DRAFT` immediately removes the article from portal
  listing, portal detail, and AI candidate retrieval.
- `DELETE` is hard and permanent (no dependency check today).
- `ARCHIVED` / soft-delete / restore flows are **not** part of this
  pilot — see [Future Enhancements](#future-enhancements).

## Permissions

Unchanged by this pilot. Current matrix, restated for the plan:

| Capability | ADMIN | MANAGER | AGENT | CUSTOMER | Anon |
| --- | :-: | :-: | :-: | :-: | :-: |
| List/search internal (any status) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Read internal article incl. `DRAFT` | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create / edit / publish / unpublish | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete (hard) | ✅ | ✅ | ❌ | ❌ | ❌ |
| List/read **published** via portal | ❌* | ❌* | ❌* | ✅ | ❌ |

\* Internal roles are rejected from `/api/portal/knowledge-articles/*` by
design.

### RBAC-change note

This pilot introduces **no** RBAC change, so no permission-table change is
required. `specs/features/auth-rbac/spec.md` notes that Knowledge Base
management mutations are recorded in `AuditLog`.

## Audit Requirements

Finalized, testable requirements for the enhancement:

- A successful **create** must be auditable.
- A successful **meaningful edit** (change to `title`, `content`, or
  `category`) must be auditable, with the changed fields represented in
  audit `metadata.changes` per existing conventions.
- A successful **publish** (`DRAFT → PUBLISHED`) and **unpublish**
  (`PUBLISHED → DRAFT`) must each be auditable.
- A successful **delete** must be auditable, capturing at least the
  deleted article's id (and title where the existing convention keeps a
  human-readable label).
- **Reads and searches must not create audit events** — internal list/
  detail, portal list/detail, internal search, portal search, AI
  grounding retrieval.
- **Rejected or unauthorized mutations must not create a success audit
  entry** (`403` for `AGENT`/`CUSTOMER`/anon, `400` validation, `404`
  missing article).
- Audit writing should follow the project's existing transactional
  conventions where the underlying mutation is transactional, so audit
  rows and article state cannot diverge.
- Audit `metadata` must not contain secrets, tokens, or unsafe/
  unsanitized content, and must not embed the full article body.
- The audit `actor` must be derived from authenticated server-side user
  context; the frontend must not be trusted to provide audit actor
  identity.
- No new audit vocabulary beyond what is needed: reuse `createAuditLog`,
  add a `KNOWLEDGE_ARTICLE` entity type and the minimum action
  constants consistent with existing lifecycle-audit patterns. Exact
  constant names and file placement are decided in `plan.md`.

### Implemented as (2026-09-09)

The pilot was implemented exactly to `plan.md`; no acceptance criterion
diverged. Concrete resolutions of the plan-level choices, for reference:

- Entity type `KNOWLEDGE_ARTICLE` and actions `KNOWLEDGE_ARTICLE_CREATED`
  / `_UPDATED` / `_PUBLISHED` / `_UNPUBLISHED` / `_DELETED` added to
  `server/src/modules/audit-logs/audit-log.constants.ts` (string
  constants — no schema/migration).
- A `DRAFT ⇄ PUBLISHED` transition in a `PATCH` selects the lifecycle
  action (`_PUBLISHED` / `_UNPUBLISHED`), which wins over `_UPDATED` even
  when `title` / `category` / `content` change in the same request —
  still exactly one row.
- `metadata.changes` carries real `from`/`to` only for `title` /
  `category` / `status`; a body change is the flat marker
  `metadata.contentChanged = true`. The article `content` never appears
  in the audit record.
- A no-op `PATCH` (values equal the current row) writes no audit row.
- All three mutations (`create` / `update` / `delete`) run the mutation
  and `createAuditLog(..., tx)` in one `prisma.$transaction`; a failing
  audit write rolls the mutation back (covered by test).
- No frontend, RBAC, API-contract, dependency, or new audit-read-surface
  change.

## Edge Cases

| Case | Required behavior |
| --- | --- |
| `PATCH` with a body that resolves to no actual field change | No article change; per existing conventions, no misleading "edited" audit entry for a no-op (plan decides whether `changedFields` emptiness suppresses the entry). |
| `PATCH` that changes both content fields and status in one request | Article updated once; audit reflects both the field changes and the lifecycle change per existing conventions (combined entry or entry + `metadata.changes`, decided in plan). |
| Mutation succeeds but the audit write fails | If the mutation is transactional, both roll back together (no partial audit, no silent unaudited mutation). Non-transactional paths: plan must define whether the audit write is best-effort or blocking — default to consistency with how other modules handle it. |
| `AGENT` attempts create/edit/publish/delete | `403`, nothing changes, no audit entry. |
| `CUSTOMER` / anonymous hits an internal KB route | Rejected at the auth/role boundary; no audit entry. |
| `DELETE` on a missing id | `404 KNOWLEDGE_ARTICLE_NOT_FOUND`; no audit entry. |
| Customer opens an article that is unpublished/deleted while the page is open | Already-rendered page not forcibly changed; next fetch returns the standard not-found outcome. (Unchanged behavior.) |
| Direct link to a `DRAFT`, customer vs. internal | Customer: identical `404` as a missing id. Internal read role: resolves normally. (Unchanged.) |
| Duplicate article titles | Allowed; disambiguation by id; ordering stays stable (`updatedAt DESC, id ASC`). (Unchanged.) |
| Very long body | Bounded at ≤ 50 000 chars on create/edit; over-limit is a validation error (no audit entry). Detail rendering wraps, does not overflow. (Unchanged.) |
| Author (`User`) deletion | Still blocked by `onDelete: Restrict` on `KnowledgeArticle.createdBy`. (Unchanged.) |
| Arabic-language article body | Renders RTL with correct alignment via `dir="auto"`, independent of portal UI language. (Unchanged.) |

## Acceptance Criteria

### Regression — existing behavior must not change

```
Given a mix of DRAFT and PUBLISHED articles
When a customer lists, searches, or filters the portal Knowledge Base by any parameter
Then only PUBLISHED articles are returned and no draft-only field (status, author) appears.
```

```
Given an article in DRAFT
When a customer requests it directly by id via the portal
Then the response is the same not-found outcome as for a non-existent id.
```

```
Given an AGENT user
When they attempt to create, edit, publish, unpublish, or delete an article
Then the request is rejected with a standard authorization error and nothing changes.
```

```
Given an ADMIN or MANAGER
When they create an article
Then createdById is the authenticated user, status defaults to DRAFT, and the article is not customer-visible.
```

```
Given a PUBLISHED article
When an ADMIN or MANAGER sets it to DRAFT
Then it immediately disappears from the portal list, portal detail, and AI candidate retrieval.
```

```
Given published Knowledge Base content whose title, body, or category contains a term
When a customer searches that term in any case
Then all matching PUBLISHED articles are returned and no DRAFT article is.
```

```
Given a customer whose portal UI language is Arabic
When they browse the Knowledge Base
Then all UI chrome is Arabic and RTL, and an article body renders in the direction of its own text.
```

```
Given the AI grounding retrieval paths (customer-ai context, internal KB suggestions)
When they run
Then they query PUBLISHED content only and never expose the full article body or a draft.
```

### Enhancement — audit-log behavior to implement

```
Given an authorized ADMIN or MANAGER
When a Knowledge Base article is successfully created
Then exactly one AuditLog entry representing the creation is persisted using existing project audit conventions, with the actor taken from authenticated server context.
```

```
Given an existing article
When an authorized user successfully changes auditable article data (title, content, or category)
Then the change is represented in AuditLog metadata (metadata.changes) per existing conventions.
```

```
Given an article lifecycle change between DRAFT and PUBLISHED
When the change succeeds
Then an appropriate audit event is recorded distinguishing publish from unpublish.
```

```
Given an authorized delete request for an existing article
When the article is successfully deleted
Then the deletion is represented in AuditLog, including at least the article id.
```

```
Given any authorized user
When they list, search, or read an article (internal or portal), or AI grounding retrieves articles
Then no AuditLog entry is created solely because of that read.
```

```
Given an unauthorized (AGENT/CUSTOMER/anonymous) or invalid (400/404) mutation attempt
When the operation is rejected
Then no successful-mutation AuditLog entry is created.
```

```
Given a successful management mutation
When the AuditLog row is created
Then its actor identity comes from authenticated server context, never from a request-controlled actor field, and its metadata contains no article body, secret, or unsafe content.
```

```
Given a management mutation that runs inside a database transaction
When the audit write is part of that transaction and the mutation fails
Then neither the article change nor the audit row is persisted.
```

---

# Knowledge Base Rich Text Content

> **Separate capability. Added 2026-09-09, after `KB-AUDIT-011`.** This
> section is additive: it does **not** alter, weaken, or re-open any
> `KB-AUDIT-*` requirement. Every "Existing Behavior to Preserve" item
> above still holds except the two plain-text *content* bullets, which
> this capability supersedes. Status: **implemented; migration
> verification pending** on branch `chore/sdd-foundation`
> (`KB-RICH-001`…`KB-RICH-015`; ADR-057).
> See [KB Rich Text Content — `IMPLEMENTED; MIGRATION VERIFICATION PENDING`](#kb-rich-text-content--implemented-migration-verification-pending).

## Why

- The current article body is a plain `<textarea>` / plain-text string.
  Support content routinely needs structure — steps, sub-headings,
  emphasis, links to other resources — that plain text cannot express, so
  authors either ship walls of text or resort to ad-hoc conventions
  ("Step 1)", ALL CAPS) that read poorly for customers and for the AI.
- The repository **already runs a Lexical rich-text editor** for ticket
  replies and internal notes, with a **server-authoritative HTML
  sanitizer** (`server/src/shared/rich-text/`), a **client re-sanitizing
  render path** (`MessageBody`, DOMPurify), and an **HTML→plain-text
  flattener** used for AI context and outbound channels. Knowledge Base
  can adopt this proven infrastructure instead of inventing a parallel
  one or adding a dependency.
- Doing this now, before the Knowledge Base feature is declared closed,
  keeps the content model decision in one place rather than revisiting a
  "closed" feature later.

## Goal

Replace the plain-text Knowledge Base article authoring and rendering
experience with a **bounded Rich Text** experience built on the existing
Lexical + sanitizer infrastructure, such that:

- authorized internal authors format article bodies with a small,
  practical toolset;
- customers and the AI receive **safe, meaningful** content — never
  unsafe HTML, never raw editor markup;
- **all** existing Knowledge Base behavior (routes, RBAC, lifecycle,
  visibility, search intent, AI-grounding safety, audit) is preserved;
- **existing plain-text articles keep working with no data migration and
  no manual recreation.**

## Actors

Unchanged from the table in [Actors](#actors). This capability adds no
role and changes no permission. It only changes *how* the
`ADMIN` / `MANAGER` author a body and *how* a body renders for readers.

## Functional Requirements — Rich Text

### RT-1 Authoring (internal)

- `RT-1.1` Internal article create and edit (`/knowledge-base/new`,
  `/knowledge-base/:id/edit`) use a **Rich Text editor** for the body
  instead of the plain `<textarea>`. Title and category stay plain
  single-line inputs.
- `RT-1.2` RBAC is unchanged: only `ADMIN` / `MANAGER` reach these
  screens and may mutate; `AGENT` stays read-only; `CUSTOMER` / anonymous
  have no access. The editor is a UX affordance, **never** the security
  boundary.
- `RT-1.3` **V1 formatting set (bounded, deliberately small):**
  - paragraphs
  - headings — **two levels only** (section and sub-section; the page
    already owns the top-level heading)
  - bold, italic, underline
  - ordered list, unordered list
  - links (with visible link text, safe protocols only)
  - undo / redo
- `RT-1.4` **Explicitly not in V1** (and not implied as approved):
  images, video/media embeds, file uploads, tables, arbitrary/raw HTML,
  code blocks or inline code, block quotes, text colour, alignment, font
  size, mentions, slash commands, collaborative editing, comments,
  templates. Rationale: the existing ticket editor supports none of these
  either, so each would be net-new surface (new nodes, new sanitizer
  allowances, new dependency) — out of proportion for a help-article
  editor.
- `RT-1.5` The editor must present correctly in both LTR and RTL locales
  and let an author write an Arabic or English body that renders in the
  direction of its own text (`dir="auto"` preserved).
- `RT-1.6` A body that is empty once formatting/markup is stripped is
  rejected with the existing validation error semantics (no new error
  code, no silent accept) — same intent as today's "content is required".

### RT-2 Editing existing articles

- `RT-2.1` Every existing article remains editable through the same
  screen and the same `PATCH /api/knowledge-articles/:id` route.
- `RT-2.2` Editing a body must preserve the **existing update behavior**:
  optimistic response shape, `updatedAt` bump, TanStack Query
  invalidation of internal list/detail + the portal
  `["portal","knowledge-articles"]` subtree, lifecycle rules.
- `RT-2.3` **Audit behavior is exactly as `KB-AUDIT-*` already defines
  it.** In particular:
  - the article body is **never** copied into `AuditLog` — not the rich
    representation, not a derived plain-text representation, not an
    excerpt, not a diff, not a length, not a hash;
  - a body change continues to be recorded **only** as
    `metadata.contentChanged = true`;
  - no new audit action name, no extra audit row, no change to
    exactly-once or to transactional atomicity;
  - a `PATCH` that changes only the body still produces exactly one
    `KNOWLEDGE_ARTICLE_UPDATED` row (or the lifecycle action if `status`
    also changed), same as today.
- `RT-2.4` Opening a **legacy plain-text** article in the editor loads
  its text as editable rich content with paragraph structure preserved;
  the author is not forced to re-type it. Saving it is a normal edit
  (see [Backward Compatibility](#backward-compatibility--rich-text)).

### RT-3 Rendering

- `RT-3.1` Rich article bodies render correctly in the **internal**
  article detail view and in the **customer portal** article detail view,
  with formatting (headings, emphasis, lists, links) visible.
- `RT-3.2` Rendering must **not** expose unsafe HTML or executable
  content under any input — see [Security](#security--rich-text).
- `RT-3.3` Links in rendered content open safely (no reverse-tabnabbing;
  untrusted-destination rel semantics) consistent with how rendered
  ticket-reply links already behave.
- `RT-3.4` Long bodies stay readable (wrap, do not overflow; existing
  layout constraints preserved). Directionality per `dir="auto"`.

### RT-4 Existing plain-text articles (backward compatibility — mandatory)

- `RT-4.1` After the enhancement ships, an existing plain-text article
  that is **never re-edited** still displays correctly to internal users,
  to customers, and to the AI — as readable text with its paragraphs
  intact.
- `RT-4.2` No bulk content migration is required to achieve `RT-4.1`. No
  article must be manually recreated.
- `RT-4.3` User-visible behavior for an un-migrated legacy article:
  identical to today (plain-text rendering, `whitespace-pre-wrap`
  semantics, `dir="auto"`).
- `RT-4.4` Once a legacy article **is** edited and saved through the new
  editor, it is stored and rendered as rich content from then on. This
  transition is a normal edit and is audited as a normal edit (`RT-2.3`).

### RT-5 Search

- `RT-5.1` Internal and portal Knowledge Base search continue to match on
  **human-readable article body text** — the words an author or customer
  would actually read — not on serialized editor markup, tag names,
  attribute values, URLs inside `href`, or `rel`/`target` boilerplate.
- `RT-5.2` Search API behavior is otherwise unchanged: same query
  parameter, same case-insensitive substring intent over
  title + body + category, same status scoping (internal spans all
  statuses; portal + AI stay `PUBLISHED`-only), same pagination,
  ordering, and empty-state semantics.
- `RT-5.3` A search that matched a legacy plain-text article before the
  enhancement still matches it after (no regression for existing
  content).

### RT-6 AI grounding

- `RT-6.1` Customer AI grounding and internal KB-suggestion retrieval
  keep using **`PUBLISHED`-only** content, the existing safe projections,
  and the existing access boundaries. No draft, no full internal record,
  no author/internal metadata reaches a prompt.
- `RT-6.2` The article text supplied to any model (SOURCES block,
  candidate excerpt, ranking input) must be **clean human-readable plain
  text** derived from the rich body — no HTML tags, no editor markup, no
  attribute noise, no hidden/internal metadata.
- `RT-6.3` Existing excerpt/truncation limits (candidate excerpt length,
  SOURCES content, per-article caps) are preserved and applied to the
  derived plain text.
- `RT-6.4` Deriving text for AI is a pure read transformation — it must
  not write anything, and in particular must not touch `AuditLog`.
- `RT-6.5` No weakening of existing AI-grounding safety: prompt-injection
  neutralization, "use only supplied sources", and published-only scoping
  all remain.

### RT-7 API compatibility

- `RT-7.1` Existing Knowledge Base routes, methods, status codes, error
  codes, pagination shape, and the `{ data, meta }` envelope are
  preserved.
- `RT-7.2` The `content` field keeps its name and JSON type (string). Its
  **representation changes** from plain text to a safe rich
  representation. This is the same kind of change the ticket
  `Message.body` field already underwent (ADR-035) and is documented
  explicitly in this spec's endpoint sections so no consumer is
  surprised.
- `RT-7.3` In-repo consumers (internal detail page, portal detail page)
  are updated in lockstep. No out-of-repo consumer is known; if one is
  discovered during planning it must be called out, not silently broken.
- `RT-7.4` The portal list `excerpt` stays a server-derived, plain,
  length-bounded string (customers never receive markup in the list).
- `RT-7.5` No new public request field is accepted. Strict schemas still
  reject unknown keys. `createdById` stays server-derived.

### RT-8 Portal behavior

- `RT-8.1` Publish / unpublish semantics are unchanged. `DRAFT ⇄
  PUBLISHED` only, freely reversible.
- `RT-8.2` A `DRAFT` article still never appears in the portal list,
  portal detail, portal search, or AI grounding. A portal request for a
  `DRAFT` id still returns the same `404` as a missing id.
- `RT-8.3` `PUBLISHED → DRAFT` still immediately removes an article from
  portal + AI retrieval.

### RT-9 Audit (restated so it cannot drift)

The Rich Text implementation must **not**:

- store any form of the article body in `AuditLog`;
- alter any existing audit action name
  (`KNOWLEDGE_ARTICLE_CREATED` / `_UPDATED` / `_PUBLISHED` /
  `_UNPUBLISHED` / `_DELETED`);
- create an extra audit row for a single mutation;
- change exactly-once behavior;
- change the transactional atomicity guarantee (mutation + audit commit
  or roll back together);
- change no-op suppression (a `PATCH` that resolves to no real change
  writes no row).

All `KB-AUDIT-*` acceptance criteria remain in force.

## Storage Model (product-level statement)

*Technical evaluation and the final decision live in `plan.md`
([Step 3 / Storage](./plan.md)). Product-level requirements only:*

- There is **one canonical representation** of a rich article body.
- There is **one deterministic way** to derive human-readable plain text
  from it, reused by search, by excerpts, and by AI grounding.
- The representation is **safe to render** (see Security) and **safe at
  rest** (no active content persisted).
- Backward compatibility with existing plain-text rows is a hard
  constraint; a destructive migration is not acceptable.
- A schema change is acceptable **only** if it delivers a clear
  architectural benefit that a no-schema approach cannot
  (`plan.md` must make this case or choose otherwise).

## Backward Compatibility — Rich Text

- `BC-1` At enhancement launch, **every existing row is plain text.** Any
  compatibility mechanism must treat that as the starting state.
- `BC-2` Distinguishing a legacy plain-text body from a new rich body
  must be **reliable**, not a fragile guess. `plan.md` chooses the
  mechanism (content-shape detection, a normalization-on-write guarantee,
  a marker, or a combination) and states why it is safe.
- `BC-3` Required, explicitly answered in `plan.md`:
  - how a legacy article renders (internal + portal) before any re-edit;
  - what the editor shows when a legacy article is opened;
  - what is stored when a legacy article is saved;
  - whether any data migration runs, and if so that it is additive and
    non-destructive.
- `BC-4` Preferred outcome: **zero destructive migration**; legacy rows
  render unchanged until lazily converted by a normal edit.

## Security — Rich Text

- `SEC-1` **Trust boundary is explicit and server-side.** The client
  editor's output is untrusted input. The **server** produces the only
  trusted stored representation. The client **re-sanitizes** on render.
  Neither side relies on the other being safe; "Lexical is safe" is not
  an accepted assumption anywhere.
- `SEC-2` The stored representation must not be able to carry: `<script>`,
  event-handler attributes (`onclick`, …), `javascript:` /`data:` /
  `vbscript:` / `file:` URLs, `style`/`class`/`id`/`data-*`, iframes,
  objects, embeds, forms, media, or any tag outside the small V1
  allowlist.
- `SEC-3` User-authored **links**: only `http`, `https`, `mailto`
  protocols; anything else is dropped. Rendered links carry safe
  `rel`/`target` semantics (consistent with rendered ticket replies).
- `SEC-4` **Pasted content** (from Word, web pages, etc.) is reduced to
  the V1 allowlist — on the client by the editor's node model and,
  authoritatively, by the server sanitizer on write.
- `SEC-5` Rendering uses a controlled, re-sanitized injection path
  equivalent to the existing `MessageBody` pattern. No new unguarded
  `dangerouslySetInnerHTML` surface is introduced; the one used is fed
  only sanitizer output.
- `SEC-6` The AI plain-text derivation (`RT-6.2`) also strips all markup,
  so a malformed or hostile body cannot reach a model as markup.
- `SEC-7` Existing project security utilities are reused
  (`server/src/shared/rich-text/*`, client DOMPurify config). No new
  sanitization library.

## Acceptance Criteria — Rich Text

```
Given an ADMIN or MANAGER on the article create or edit screen
When they format the body (headings, bold/italic/underline, lists, a link)
Then the formatting is applied in a Rich Text editor, saved, and shown formatted on the detail view — with RBAC unchanged (AGENT still cannot reach the screen).
```

```
Given an existing plain-text article that is never re-edited
When an internal user, a customer, or the AI grounding path reads it after the enhancement ships
Then it displays/grounds exactly as before — readable text with paragraphs intact — with no data migration having recreated it.
```

```
Given a legacy plain-text article
When an author opens it in the new editor and saves it unchanged or edited
Then it is stored as rich content from then on, and the save is audited as a single normal KNOWLEDGE_ARTICLE_UPDATED (or the lifecycle action if status changed) with metadata.contentChanged only — no body text in AuditLog.
```

```
Given a rich article body containing a script tag, an onclick attribute, a javascript: link, and an <img>
When it is saved and later rendered internally and in the portal
Then none of those survive: no executable content, no disallowed tag or attribute, the link dropped or neutralized, and the visible text preserved.
```

```
Given published articles whose readable body text contains a term
When a customer or an internal user searches that term
Then matching articles are returned as before, and a search for editor markup tokens (tag names, "nofollow", href URLs) does NOT spuriously match.
```

```
Given the customer AI grounding path and the internal KB-suggestion path
When they build prompt context from published rich articles
Then the model receives clean plain text (no tags/markup), PUBLISHED-only, within existing excerpt/truncation limits, and nothing is written to AuditLog.
```

```
Given the Knowledge Base API
When a client calls the internal or portal article endpoints after the enhancement
Then routes, methods, status codes, error codes, and the { data, meta } envelope are unchanged; only the representation of `content` differs, and that change is documented in this spec's endpoint sections.
```

```
Given a DRAFT rich article
When a customer requests it by id via the portal, or the AI grounding path runs
Then it is not returned (same 404 as a missing id; excluded from grounding) — portal visibility rules unchanged.
```

## Rich Text — Out of Scope

- Markdown as the authoring or storage model.
- A different rich-text editor library / new rich-text dependency.
- Images, media embeds, file attachments in article bodies.
- Tables, code blocks, block quotes, callouts, columns, or any layout
  widget.
- Arbitrary/raw HTML authoring.
- Article templates, snippets, or reusable content blocks.
- Revision history, draft autosave, side-by-side diff of rich content.
- Collaborative / multi-cursor editing, inline comments, suggestions.
- Rich content in the portal **list** (excerpt stays plain).
- Rich content in `AuditLog` in any form.
- Any RBAC, lifecycle, route, or portal-visibility change.
- Semantic/vector search over rich content (still keyword substring).
- A public/anonymous Knowledge Base surface.

## Rich Text — Open Questions

Carried into `plan.md` for a technical decision; none blocks
specification:

1. **Storage representation** — sanitized HTML in the existing `content`
   field (ticket precedent) vs. an alternative. `plan.md` decides and
   justifies.
2. **Plain-text-for-search/AI source** — whether a stored derived
   plain-text projection (small additive schema change) is justified vs.
   deriving on read. `plan.md` decides; if it adds a column it must show
   the clear architectural benefit and that the migration is additive and
   non-destructive.
3. **Legacy-vs-rich detection mechanism** — the concrete, non-fragile
   rule (`BC-2`).
4. **Two heading levels** — confirm section/sub-section is the right V1
   choice for help articles (vs. one level, vs. three).

## Out of Scope

Explicitly excluded from this pilot (and not implied as approved by it):

- Bilingual / EN-AR content schema redesign; per-language fields;
  translation tables; linked localized records; any migration for
  localization.
- Public / anonymous Knowledge Base; SEO metadata; public article URLs;
  anonymous search.
- `ARCHIVED` lifecycle state; soft-delete fields; restore flows;
  lifecycle migrations.
- Dedicated Knowledge Base categories / `KnowledgeCategory` model;
  reuse of the ticket `Category` entity; category hierarchy; category
  migrations.
- `AGENT` authoring (create/edit/publish/unpublish/delete) or
  draft-authoring permissions.
- Team-scoped Knowledge Base ownership or filtering for `MANAGER`.
- Semantic / vector / embedding search; RAG.
- AI article generation or AI summarization of KB content.
- Article ratings / helpfulness voting.
- Comments or customer-submitted content.
- Revision / version history; diff; rollback.
- Editorial approval workflow before publish.
- Markdown authoring; editor-**library** migration (a new rich-text
  dependency). **Note:** bounded Rich Text authoring/rendering on the
  *existing* Lexical infrastructure is **no longer out of scope** — it was
  promoted to an approved capability on 2026-09-09; see
  [Knowledge Base Rich Text Content](#knowledge-base-rich-text-content).
- Slugs / human-readable article URLs.
- Popularity / view-count tracking; popularity-based ordering.
- File attachments on articles.
- Realtime / SSE events for Knowledge Base changes.
- "Insert KB link into customer reply" from the internal ticket
  composer (deferred, ADR-034 Phase 5).
- Any new audit-read endpoint, filter, or UI beyond the existing
  `ADMIN`-only audit views.

## Future Enhancements

Deferred decisions surfaced during clarification. Each requires its own
spec and is **not** approved by this pilot:

- **True EN/AR article localization** — one logical article with English
  + Arabic localized content and defined fallback behavior.
- **Archive / safer-deletion lifecycle** — an `ARCHIVED` terminal state
  and/or soft delete with restore, replacing unconditional hard delete.
- **Structured Knowledge Base taxonomy** — dedicated KB categories with
  their own management surface.
- **Public Knowledge Base** — an anonymous, cacheable help center with a
  public base URL (also unblocks KB→reply link insertion).
- ~~**Richer authoring/content model** — Markdown or rich text for article
  bodies, if the product later needs formatting.~~ **Promoted to an
  approved capability on 2026-09-09** — a bounded Rich Text model on the
  existing Lexical infrastructure. See
  [Knowledge Base Rich Text Content](#knowledge-base-rich-text-content).
  (A full Markdown model or a different editor library remains deferred.)

## Open Questions

None for this pilot.

All seven draft questions are resolved conservatively in
[Clarification Decisions](#clarification-decisions); the remaining
lifecycle/localization/taxonomy items are recorded under
[Future Enhancements](#future-enhancements) and are out of scope, not
blocking. Repository inspection of the `AuditLog` model, `createAuditLog`
service, action/entity constants, and request-context helper revealed no
blocking ambiguity for the audit integration — the exact action-constant
granularity is a normal plan-level decision, not a product question.

## Clarification Decisions

Settled by the developer for this pilot (2026-09-09):

1. **EN/AR content model** — **unchanged.** No per-language fields,
   translation tables, linked localized records, or schema/migration
   work. `title` / `content` / `category` stay as implemented; bodies
   may hold Arabic or English text; rendering preserves directionality
   via existing UI behavior (`dir="auto"`). A true bilingual model is a
   future feature, not approved scope here.
2. **`AGENT` authoring** — **unchanged.** `AGENT` stays read-only
   (list/read internal articles incl. `DRAFT`, consume via internal
   workflows). No create/edit/publish/unpublish/delete; no
   draft-authoring permission.
3. **`MANAGER` scope** — **unchanged.** Knowledge Base management stays
   **global** for `MANAGER`; no team-scoped ownership or filtering. This
   applies to the current Knowledge Base model only and does not imply
   every CRM resource is global.
4. **Authenticated vs. public** — **unchanged.** Knowledge Base stays
   authenticated-only, via the customer portal. No public/anonymous
   routes, SEO behavior, public URLs, or anonymous search. A public
   Knowledge Base may be a separate future spec.
5. **Archive vs. hard delete** — **unchanged.** Two-state lifecycle
   `DRAFT ⇄ PUBLISHED`; hard delete stays exactly as governed by
   current authorization/business rules. No `ARCHIVED`, soft-delete,
   restore flow, or lifecycle migration. Safer deletion semantics are a
   possible future feature.
6. **Category model** — **unchanged.** `category` stays an optional
   free-text value. No reuse of ticket `Category`, no `KnowledgeCategory`
   model, no hierarchy, no category migration. A structured taxonomy is
   a possible future feature.
7. **Audit logging** — **APPROVED for this pilot.** Knowledge Base
   management mutations integrate with the existing system-wide
   `AuditLog`. This is the single behavioral enhancement the plan will
   deliver; see [Pilot Enhancement](#pilot-enhancement--audit-log-integration)
   and [Audit Requirements](#audit-requirements).

## Specification Status

### KB Audit Logging — `IMPLEMENTATION COMPLETE`

- All seven clarification decisions incorporated.
- Existing Knowledge Base behavior fixed as a non-regression baseline.
- `AuditLog` integration for management mutations specified with testable
  acceptance criteria and anchored to existing audit conventions.
- Implemented per `plan.md` / `tasks.md` (`KB-AUDIT-001`…`011`); changes
  committed on `chore/sdd-foundation`.

### KB Rich Text Content — `IMPLEMENTED; MIGRATION VERIFICATION PENDING`

- Product behavior specified above ([Knowledge Base Rich Text
  Content](#knowledge-base-rich-text-content)) with testable acceptance
  criteria (`RT-1`…`RT-9`, `BC-*`, `SEC-*`).
- Implemented per `plan.md` / `tasks.md` (`KB-RICH-001`…`KB-RICH-015`) on
  branch `chore/sdd-foundation`; changes committed.
- The four deferred technical questions were resolved as approved: sanitized
  HTML in `content`; an additive nullable `contentText` projection column;
  a normalize-on-write + content-shape sniff for legacy detection; two
  heading levels (H2/H3). See ADR-057.
- Preserves every existing Knowledge Base behavior except the plain-text
  *content* model; re-opens no `KB-AUDIT-*` requirement (article body still
  never enters `AuditLog`).
- All code-level and test-level checks in `KB-RICH-015` have run and pass
  (server 926/926, client 800/800, typecheck/lint/build clean, no scope
  drift). See [Migration Verification Status](#migration-verification-status)
  for the one remaining, non-code verification step.

### Migration Verification Status

The additive migration `server/prisma/migrations/20260909120000_kb_article_content_text/`
(`ALTER TABLE ... ADD COLUMN "contentText" TEXT;` then a straight backfill
`UPDATE "KnowledgeArticle" SET "contentText" = "content"`) is present in the
repository and is non-destructive by construction (nullable column, no
default, no data rewrite of `content`). It has **not** been applied to a
disposable/scratch Postgres in this environment to verify apply + rollback
end-to-end, per `.wolf/memory.md` (2026-09-09, KB-RICH-001..015 entry:
"disposable-DB migration apply not runnable here"). No other evidence of an
apply/rollback run exists in `.wolf/buglog.json` or `.wolf/memory.md`.

**This is explicitly not claimed as complete.** Remaining action before
merge (tracked in `tasks.md` under `KB-RICH-015`):

1. Run `npx prisma migrate deploy` (or `migrate dev`) against a disposable/
   staging Postgres.
2. Confirm `npx prisma migrate status` reports clean, and that every
   existing row's `contentText` equals its `content` immediately after
   apply (per the backfill statement).
3. Confirm a rollback plan is safe if ever needed (the column is additive
   and nullable, so `DROP COLUMN "contentText"` is the only rollback and
   loses no other data).

### Overall Knowledge Base SDD enhancement — `READY FOR HUMAN REVIEW; MERGE GATED ON MIGRATION VERIFICATION`

The Rich Text enhancement is implemented and every `KB-RICH-015` check other
than the disposable-DB migration apply/rollback (above) has run. Merge is
performed manually by the developer, after that step is done.
