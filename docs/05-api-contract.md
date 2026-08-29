# API Contract

Base path:

```text
/api
```

## Implementation status legend

This contract mixes live and planned endpoints. Each section is tagged:

- `LIVE` — route is registered in `server/src/app.ts` and backed by a controller/service.
- `PARTIAL` — only part of the listed surface is registered; the rest is planned.
- `PLANNED` — documented target with no registered route yet. Do not consume as a live API.

Registered routers as of `master` `12a0c12` (feature/customer-feedback integrated) plus the uncommitted `feature/reports` branch: `/api/auth`, `/api/customers`, `/api/categories`, `/api/users` (lookup only), `/api/tickets`, `/api/dashboard`, `/api/reports` (`feature/reports`, on branch — ADMIN/MANAGER), `/api/knowledge-articles`, `/api/quick-replies`, `/api/attachments`, `/api/portal/knowledge-articles`, `/api/portal/attachments`, `/api/portal`, `/api/health`, plus attachment sub-routes on `/api/tickets`, `/api/customers`, and the portal ticket router (`feature/attachments`, integrated at `8e24d22`), and feedback sub-routes on the portal ticket router (`feature/customer-feedback`, integrated at `12a0c12`). There is no registered `/api/feedback` (feedback is Portal-only) or `/api/settings` route in `master`. `/api/notifications` is integrated (`e28962b`); `/api/tasks` + `/api/internal/task-reminders` are on the uncommitted `feature/tasks-reminders` branch; `/api/integrations/whatsapp/webhook` is on the uncommitted `feature/whatsapp-integration` branch (mounted before `express.json()`).

## Authentication

```text
POST /auth/register
POST /auth/login
GET  /auth/me
```

`POST /auth/register` accepts `{ name, email, password, phone? }`, rejects unknown fields, and always creates a customer identity. `POST /auth/login` accepts `{ email, password }`. Both successful endpoints return:

```json
{
  "data": {
    "token": "<access-token>",
    "user": {
      "id": "...",
      "name": "...",
      "email": "...",
      "role": "CUSTOMER",
      "customer": { "id": "...", "name": "...", "email": "...", "phone": null }
    }
  }
}
```

`GET /auth/me` requires `Authorization: Bearer <token>` and returns `{ "data": { "user": ... } }`. Internal users have `customer: null`. Password hashes are never returned. Authentication errors use `{ "error": { "code": "...", "message": "..." } }`.

## Users — LIVE

```text
GET    /users/agents      LIVE
GET    /users             LIVE   (ADMIN)
GET    /users/:id         LIVE   (ADMIN)
POST   /users             LIVE   (ADMIN)
PATCH  /users/:id         LIVE   (ADMIN)   name / email / role / isActive
```

`GET /users/agents` is an internal-only Ticket Management lookup that returns safe summaries of **active** `AGENT` users (`id`, `name`, `email`) to `ADMIN`, `MANAGER`, and `AGENT`. It never returns password hashes or customer identities. It is JWT-role gated (not DB-fresh).

The remaining routes are the `feature/user-management` administration surface (roadmap order 6) and are **ADMIN only** — `MANAGER`/`AGENT`/`CUSTOMER`/anonymous receive `403`/`401`. They act on internal identities only (`CUSTOMER` rows are invisible: a `CUSTOMER` id returns `404 USER_NOT_FOUND`). Each admin route runs a `requireActiveUser` middleware that resolves the caller's **current database role and active state** before `requireRole(ADMIN)`, so a stale JWT cannot keep ADMIN access after a demotion, and a deactivated caller gets `401 ACCOUNT_DEACTIVATED` on the next request.

- `GET /users` — paginated list (`page`, `limit≤100`, `search` over name/email, optional `role` filter in `{ADMIN,MANAGER,AGENT}`, optional `status` in `{active,inactive}`; unknown query keys and `role=CUSTOMER` → `400`). Ordered `createdAt DESC, id ASC`. Row shape: `{ id, name, email, role, isActive, createdAt, updatedAt }` (no `passwordHash`). Envelope: `{ data, meta: { page, limit, total, totalPages } }`.
- `GET /users/:id` — same row shape; `404 USER_NOT_FOUND`.
- `POST /users` — strict body `{ name (2–100), email, password (8–128), role in {ADMIN,MANAGER,AGENT} }`. `role=CUSTOMER` or any extra field → `400`. Duplicate email → `409 EMAIL_ALREADY_REGISTERED`. Password is bcrypt-hashed (cost 12). `201` with the row shape.
- `PATCH /users/:id` — the single safe update path. Strict partial body `{ name?, email?, role?, isActive? }` (≥1 key; unknown fields → `400`; `role=CUSTOMER` → `400`). Only submitted fields are written. Read-check-write runs inside one transaction. Conflicts:
  - changing **your own** role → `409 SELF_ROLE_CHANGE_FORBIDDEN` (submitting your own unchanged role is allowed);
  - deactivating **your own** account → `409 SELF_DEACTIVATION_FORBIDDEN`;
  - demoting or deactivating the **last active `ADMIN`** (no other active `ADMIN` remains) → `409 LAST_ACTIVE_ADMIN_REQUIRED`;
  - email collision → `409 EMAIL_ALREADY_REGISTERED`.
  `200` with the row shape. There is no separate `PATCH /users/:id/role` route — role changes go through this payload (the Edit User form is the only client entry point).

Internal-user administration is separate from public customer registration; this surface never creates or exposes `CUSTOMER` accounts. There is no user-deletion route — accounts are retired by setting `isActive=false`, which blocks login (`403 ACCOUNT_DEACTIVATED`) and, on a live session, `GET /auth/me` and every `/api/users` admin request (`401 ACCOUNT_DEACTIVATED`).

## Settings — LIVE on `feature/settings`

Every `/settings/*` endpoint requires an authenticated, currently active `ADMIN`; other roles receive `403`. Routes: `GET/POST /settings/categories`, `PATCH /settings/categories/:id`, `GET /settings/sla-rules`, and `PUT /settings/sla-rules/:priority`.

Category management returns active and inactive rows; supports strict name search, create, edit, and activation; and never deletes. Names are trimmed, 2–100 characters, and unique; descriptions are at most 500 characters. Duplicate names return `409 CATEGORY_NAME_ALREADY_EXISTS`; missing rows return `404 CATEGORY_NOT_FOUND`. The existing `GET /categories` contract remains active-only and unchanged.

SLA management returns all configured rules and safely creates or updates one LOW, MEDIUM, HIGH, or URGENT resource. Minute values are integers from 1 through 525,600 and resolution cannot be lower than first response. Rules are activated/deactivated, never deleted. Changes are prospective and existing Ticket deadline snapshots are never rewritten. Background automation remains deferred.

## Categories

```text
GET /categories
```

`GET /categories` is internal-only and returns active categories for ordinary ticket forms. Category administration is outside Ticket Management.

## Customers

```text
GET    /customers
GET    /customers/:id
POST   /customers
PATCH  /customers/:id
DELETE /customers/:id
```

All customer-management routes require authentication, and `CUSTOMER` identities are rejected. `ADMIN` and `MANAGER` may use every customer route. `AGENT` has read-only access to `GET /customers`, `GET /customers/:id`, and `GET /customers/:id/notes`; this includes the paginated customer search used by Ticket creation. `AGENT` receives the standard structured `403 FORBIDDEN` response from `POST /customers`, `PATCH /customers/:id`, `DELETE /customers/:id`, and `POST /customers/:id/notes`. Listing supports `search`, `page`, and `limit` query parameters and returns `{ data, meta: { page, limit, total, totalPages } }`. Search covers customer name, email, and phone.

Manual customer creation accepts `{ name, email, phone? }`, normalizes the email, and creates only a CRM `Customer` with `userId = null`; it does not provision authentication credentials. Updates accept only `name`, `email`, and `phone`.

`GET /customers/:id` returns the complete customer-detail representation, including safe linked-user identity fields, ticket counts, last-interaction time, and customer-level attachment metadata. It never includes password hashes. Ticket counts are read-only summary data; Ticket Management remains a separate feature.

`POST /customers` and `PATCH /customers/:id` return the persisted core customer fields (`id`, `name`, `email`, `phone`, `createdAt`, and `updatedAt`). Derived detail fields such as `supportSummary` are not mutation-response fields; clients must invalidate or refetch customer detail after an update rather than replace a full detail cache entry with the mutation response.

```text
GET  /customers/:id/notes
POST /customers/:id/notes
```

Customer notes are internal-only, ordered newest first, and use the authenticated internal user as author. Note creation accepts `{ body }`; arbitrary author IDs are not accepted.

```text
GET /customers/:id/tickets?page=1&limit=20
```

This internal Customer Management endpoint returns a complete paginated safe-summary history for the requested customer to `ADMIN`, `MANAGER`, and `AGENT`; `CUSTOMER` is rejected. It verifies the customer exists, orders by `updatedAt` descending then `id` ascending, and returns only `id`, `subject`, `status`, `priority`, `createdAt`, `updatedAt`, safe `category`, safe `assignedAgent`, and server-derived `access`.

`ADMIN` and `MANAGER` receive `FULL` for every summary. An `AGENT` receives `FULL` when the ticket is assigned to that agent or unassigned, and `SUMMARY_ONLY` when it belongs to another agent. `SUMMARY_ONLY` is presentation metadata only: it never authorizes Ticket detail, conversation, notes, history, mutation, queue, or Dashboard access.

Deletion returns `409 CUSTOMER_HAS_SUPPORT_HISTORY` when the customer has a linked login identity, tickets, feedback, notes, or attachments. Only unlinked customers without related support history can be deleted.

## Tickets

```text
GET    /tickets
GET    /tickets/:id
POST   /tickets
PATCH  /tickets/:id
```

All routes require `ADMIN`, `MANAGER`, or `AGENT`; `CUSTOMER` is rejected. `ADMIN` and `MANAGER` see all tickets. `AGENT` sees assigned and unassigned tickets only. Listing supports server-side `page`, `limit`, `search`, `status`, `priority`, `categoryId`, `assignedAgentId`, and `customerId` filters and uses the standard pagination envelope. Requested filters are intersected with server-authoritative visibility. This remains the normal Ticket Management contract and is not broadened by customer-history summary access.

Creation accepts documented ticket fields and defaults channel to `WEB`. Assignment targets must be `AGENT` users. `ADMIN` and `MANAGER` may create assigned or unassigned tickets. An `AGENT` must omit `assignedAgentId`; supplying it, including `null`, returns `403 FORBIDDEN`. The service assigns an agent-created ticket to the authenticated agent and writes `TICKET_CREATED` plus one `ASSIGNMENT_CHANGED` history entry in the same transaction.

Updates accept only editable ticket fields and enforce the role permissions and transition matrix in `07-ticket-workflow.md`. `ADMIN` and `MANAGER` retain documented definition, classification, assignment, priority, and workflow updates. An `AGENT` update has an explicit `status`/`priority` field allowlist and requires the ticket to be assigned to that agent. Any other supplied field, or a mixed allowed/forbidden body, returns `403 FORBIDDEN` without a partial update or history write. Workflow timestamps and SLA deadline snapshots are service-owned.

Ticket deletion is intentionally unavailable because tickets are retained as support history.

### Internal Ticket Conversation

`GET /tickets/:id` includes an internal-only `conversation` array for callers authorized to view the Ticket Management detail. The array combines public messages and internal ticket notes into one deterministic chronological read shape:

```json
{
  "conversation": [
    {
      "kind": "PUBLIC_MESSAGE",
      "id": "...",
      "body": "...",
      "createdAt": "2026-08-25T10:00:00.000Z",
      "author": { "id": "...", "name": "...", "role": "AGENT" }
    },
    {
      "kind": "INTERNAL_NOTE",
      "id": "...",
      "body": "...",
      "createdAt": "2026-08-25T10:05:00.000Z",
      "author": { "id": "...", "name": "...", "role": "MANAGER" }
    }
  ]
}
```

Items are ordered by `createdAt` ascending, then by `kind` and `id` for stable ties. Only the fields shown above are returned. This shape belongs exclusively to the internal Ticket Management detail contract. Future customer/portal ticket responses must use a separate public shape that includes public messages only and never queries or serializes `TicketNote` records.

The authorized internal detail also includes request-time SLA derivation alongside the existing raw snapshot timestamps:

```json
{
  "slaState": "AT_RISK",
  "effectiveSlaDueAt": "2026-08-26T12:00:00.000Z",
  "effectiveSlaTarget": "FIRST_RESPONSE"
}
```

`effectiveSlaTarget` is `FIRST_RESPONSE`, `RESOLUTION`, or `null`. The effective deadline is an ISO timestamp or `null`. These values are derived only after internal Ticket visibility succeeds, are never accepted from clients, and are not added to Ticket list or Portal response contracts.

The authorized internal detail also carries the caller's collaboration state for the ticket (`feature/team-collaboration`, ADR-032):

```json
{
  "watcherCount": 3,
  "viewerIsWatching": true
}
```

`watcherCount` is the number of internal users following the ticket; `viewerIsWatching` is whether the authenticated caller is one of them. Both are internal-only and never appear in the Ticket list or Portal contracts.

```text
POST /tickets/:id/messages
POST /tickets/:id/notes
```

Both mutations accept the strict body `{ body: string }` (`min 1`, `max 50000` — markup headroom over the client's 20k plain-text limit), trim it, reject empty or unknown fields, and derive `authorUserId` from the authenticated internal identity. They never accept a client-provided author or timestamp.

`POST /tickets/:id/messages` creates a customer-visible `TicketMessage`. The reply body is **rich text (HTML) from the Lexical composer** and is **sanitized server-side on write** to a fixed support-reply allowlist (`b/strong/i/em/u/p/br/ul/ol/li/a[href]`; `http`/`https`/`mailto` only; links forced to `rel="noopener noreferrer nofollow" target="_blank"`; scripts, styles, classes, ids, event handlers, media, iframes, and data URIs discarded). A body that is empty once sanitized (markup-only) is rejected with `422 EMPTY_MESSAGE`. The stored value is trusted markup; every consumer that must not carry markup flattens it to plain text first — WhatsApp outbound delivery and the AI prompt context. Historical plain-text bodies are unaffected. The first successful public staff reply sets `firstRespondedAt` to the message creation timestamp in the same transaction only when it is currently null; later replies do not overwrite it. The response is `{ data: { kind: "PUBLIC_MESSAGE", id, body, createdAt, author } }` (`body` = the sanitized HTML).

When `ticket.channel === "WHATSAPP"` the persisted reply is also sent to the customer through the WhatsApp Cloud API after the message transaction commits, and the response carries an extra `delivery` field: `{ data: { kind: "PUBLIC_MESSAGE", …, delivery: { channel: "WHATSAPP", status: "SENT", externalId } } }` on success, or `{ …, delivery: { channel: "WHATSAPP", status: "FAILED", reason } }` on failure (`reason` ∈ `INTEGRATION_NOT_CONFIGURED | NO_RECIPIENT_PHONE | PROVIDER_REJECTED | PROVIDER_UNREACHABLE`). A send failure never rolls back the message; it is also recorded as a `WHATSAPP_DELIVERY_FAILED` ticket-history row. Non-WhatsApp tickets are unchanged (no `delivery` field). See "WhatsApp Integration" below and `docs/20-whatsapp-integration.md`.

`POST /tickets/:id/notes` creates an internal-only `TicketNote`, never a `TicketMessage` or `CustomerNote`, and never changes `firstRespondedAt`, ticket status, `resolvedAt`, or `closedAt`. The note body is now **rich text (HTML) from the same Lexical composer as public replies** and is **sanitized server-side on write** to the identical support allowlist; a body that is empty once sanitized is rejected with `422 EMPTY_MESSAGE`. `@[Name](userId)` mention tokens are plain text and survive the sanitizer intact, so mention resolution (below) is unchanged and runs on the sanitized body. The AI prompt context flattens note HTML to plain text. The response is `{ data: { kind: "INTERNAL_NOTE", id, body, createdAt, author } }` (`body` = the sanitized HTML).

`ADMIN` and `MANAGER` may read and mutate conversation on any ticket. `AGENT` may read assigned or unassigned tickets but may create replies or notes only on tickets assigned to that agent. Tickets assigned to another agent are hidden. `CUSTOMER` cannot access these internal routes. Public replies and internal notes do not perform automatic status transitions, including on `RESOLVED` or `CLOSED` tickets.

### Later Ticket Actions

```text
POST /tickets/:id/assign          PLANNED (superseded)
POST /tickets/:id/status          PLANNED (superseded)
POST /tickets/:id/attachments     PLANNED (feature/attachments)
GET  /tickets/:id/history         PLANNED (optional focused read)
```

None of these are registered. Assignment and status changes are already implemented through `PATCH /tickets/:id` (LIVE), so the dedicated `assign`/`status` action endpoints are not planned for implementation. History is currently included in `GET /tickets/:id`; a focused `GET /tickets/:id/history` read endpoint is optional. `POST /tickets/:id/attachments` belongs to `feature/attachments` and has no storage backend yet.

## Knowledge Base — LIVE

```text
GET    /knowledge-articles          LIVE
GET    /knowledge-articles/:id      LIVE
POST   /knowledge-articles          LIVE
PATCH  /knowledge-articles/:id      LIVE
DELETE /knowledge-articles/:id      LIVE
```

Backed by `server/src/modules/knowledge-base/*` and registered in `server/src/app.ts` (`feature/knowledge-base`). `KnowledgeArticle` and `KnowledgeArticleStatus` (`DRAFT`, `PUBLISHED`) are used as-is; no schema, migration, category table, slug, excerpt, popularity, or versioning field was added. `category` remains an optional free-text string.

All internal routes require authentication; `CUSTOMER` and unauthenticated callers are rejected. `GET` routes allow `ADMIN`/`MANAGER`/`AGENT`. `POST`/`PATCH`/`DELETE` allow `ADMIN`/`MANAGER` only; `AGENT` receives the standard structured `403 FORBIDDEN`.

### Internal list

`GET /knowledge-articles` (`ADMIN`/`MANAGER`/`AGENT`). Query: `page` (int ≥ 1, default 1), `limit` (int 1–100, default 20), `search` (trimmed, ≤ 100), `status` (`DRAFT` | `PUBLISHED`), `category` (trimmed, 1–100, exact match). `search` is case-insensitive (PostgreSQL `mode: "insensitive"`) across `title`, `content`, and `category`. Ordering is `updatedAt DESC`, then `id ASC`. Response: `{ data, meta: { page, limit, total, totalPages } }`. Row projection is `{ id, title, category, status, createdAt, updatedAt, createdBy: { id, name, role } }` — no `content`, no author email.

### Internal detail

`GET /knowledge-articles/:id` (`ADMIN`/`MANAGER`/`AGENT`). Returns `{ id, title, content, category, status, createdAt, updatedAt, createdBy: { id, name, role } }` for any status. Missing article → `404 KNOWLEDGE_ARTICLE_NOT_FOUND`.

### Create

`POST /knowledge-articles` (`ADMIN`/`MANAGER`). Strict body `{ title, content, category?: string | null, status?: "DRAFT" | "PUBLISHED" }`. `title` trimmed 3–200, `content` trimmed 1–50000, `category` trimmed ≤ 100 with empty/whitespace normalized to `null`, `status` defaults to `DRAFT`. `createdById` is derived from the authenticated user server-side; a client-supplied `createdById` or any unknown field is rejected with `400 VALIDATION_ERROR`. Returns `201 { data: <detail projection> }`.

### Update

`PATCH /knowledge-articles/:id` (`ADMIN`/`MANAGER`). Strict partial body over `{ title?, content?, category?: string | null, status? }`; at least one field required (empty body → `400`). `createdById`, `id`, timestamps, and unknown fields are rejected with `400`. Supports `DRAFT -> PUBLISHED` and `PUBLISHED -> DRAFT`. The original `createdById` is never modified. Missing article → `404 KNOWLEDGE_ARTICLE_NOT_FOUND`. Returns `200 { data: <detail projection> }`.

### Delete

`DELETE /knowledge-articles/:id` (`ADMIN`/`MANAGER`). Permanent delete (no soft-delete field, no dependent Knowledge Base records). Returns `204` with no body. Missing article → `404 KNOWLEDGE_ARTICLE_NOT_FOUND`.

### Portal Knowledge Base

```text
GET /portal/knowledge-articles          LIVE
GET /portal/knowledge-articles/:id      LIVE
```

Registered at `/api/portal/knowledge-articles` (`feature/knowledge-base`), `CUSTOMER` only; internal roles and unauthenticated callers are rejected, matching the established Portal boundary. `status = PUBLISHED` is always enforced server-side and a requested `status` is not accepted (`400`).

`GET /portal/knowledge-articles` query: `page`, `limit` (1–100), `search` (≤ 100), `category` (1–100, exact). Search/category filtering stay published-only. Ordering is `updatedAt DESC`, then `id ASC`. Row projection: `{ id, title, category, updatedAt, excerpt }`; `excerpt` is derived server-side from `content` (whitespace-collapsed, ≤ 200 chars, ellipsis when truncated) — there is no `excerpt` column. Internal status and author data are omitted.

`GET /portal/knowledge-articles/:id` returns only `{ id, title, content, category, updatedAt }`. A `DRAFT` id and a nonexistent id both return the identical `404 KNOWLEDGE_ARTICLE_NOT_FOUND`, so a customer cannot distinguish a hidden draft from a missing article.

Known limitations: no popularity/view tracking, no article versioning/revision history, no rich-text or Markdown rendering, no related-article recommendations.

## Reports — LIVE (on `feature/reports`, not yet integrated)

```text
GET /reports/overview   ADMIN, MANAGER
GET /reports/tickets    ADMIN, MANAGER
GET /reports/agents     ADMIN, MANAGER
GET /reports/sla        ADMIN, MANAGER
```

`reportsRouter` is registered at `/api/reports` in `server/src/app.ts` (after `/api/dashboard`). `requireAuth` then `requireRole(ADMIN, MANAGER)` on every route — `AGENT`, `CUSTOMER`, and unauthenticated callers receive the standard `403 FORBIDDEN` / `401`. No schema change (existing `Ticket`, `Feedback`, `Category`, `User` rows only). `GET /dashboard/overview` remains a separate operational snapshot.

**Date range.** Every route accepts optional `from` / `to` ISO datetimes. Default: the trailing 30 days ending now. `from` after `to`, a span over 366 days, or any unknown query field → `400 VALIDATION_ERROR`. All day bucketing is **UTC**; every response echoes `range: { from, to }`, `timezone: "UTC"`, and `generatedAt`.

**Cohort rules.** The "created cohort" is tickets with `createdAt` in range; "resolved" counts use `resolvedAt` in range (so tickets created earlier still count). SLA outcomes are derived from stored timestamps — there is no persisted breach record:
- First response `MET` = `firstRespondedAt <= firstResponseDueAt`; `BREACHED` = responded late, or unanswered past due; `PENDING` = unanswered, not yet due; `NONE` = no `firstResponseDueAt`.
- Resolution `MET` = `resolvedAt`/`closedAt` `<= resolutionDueAt`; `BREACHED` / `PENDING` / `NONE` analogous.
- `compliancePct = round(met / (met + breached) * 100)`, `null` when the denominator is 0.

**`GET /reports/overview`** → `{ kpis: { createdTickets, resolvedTickets, slaCompliancePct, averageFirstResponseMinutes, satisfaction: { averageRating, responseCount } }, ticketVolume: [{ date, created, resolved }] (one bucket per UTC day), statusDistribution: [{ status, count }] (created cohort), satisfaction: { averageRating, responseCount, distribution: [{ rating: 1..5, count }] } }`. Satisfaction is read from `Feedback.rating` for rows created in range; `averageRating` is `null` with no feedback.

**`GET /reports/tickets`** → `{ totals: { created, resolved, open }, volume: [...], byStatus: [...], byPriority: [{ priority, created, resolved }], byCategory: [{ categoryId, categoryName, created }] (null bucket = uncategorized, sorted by count) }`.

**`GET /reports/agents`** → `{ agents: [{ agentId, agentName, assigned, resolved, open, slaMet, slaBreached, slaMetPct, averageFirstResponseMinutes }] }` — one row per `AGENT`-role user plus any agent still referenced by an in-range ticket; figures cover the agent's created-cohort tickets (`resolved` uses `resolvedAt` in range). Sorted by `assigned` desc, then `resolved` desc, then name.

**`GET /reports/sla`** → `{ firstResponse: { met, breached, pending, total, compliancePct }, resolution: { … }, byPriority: [{ priority, firstResponseMet, firstResponseBreached, resolutionMet, resolutionBreached, compliancePct }], averageFirstResponseMinutes, averageResolutionMinutes }` over the created cohort.

Known limitations: no department/branch/channel breakdown, no trend deltas vs. a previous period, no CSV/PDF export, no per-day SLA series, no caching layer (each call recomputes from a lean ticket projection), fixed UTC bucketing (no per-user timezone). Nothing is fabricated — every figure traces to a stored column.

## Attachments — LIVE (integrated into `master` at `8e24d22`)

Backed by `server/src/modules/attachments/*` and registered in `server/src/app.ts`. `Attachment` is used as-is (no schema change, no migration). Bytes live in a **private Vercel Blob store** through an `AttachmentStorage` interface (`@vercel/blob@2.x` server SDK adapter + an in-memory test adapter). The provider token (`BLOB_READ_WRITE_TOKEN`) is server-side only; a raw provider URL or token is never returned. When the token is unset every upload/download returns `503 STORAGE_UNAVAILABLE` — there is no fallback to public or local-disk storage.

```text
GET  /api/tickets/:ticketId/attachments
POST /api/tickets/:ticketId/attachments
GET  /api/tickets/:ticketId/messages/:messageId/attachments
POST /api/tickets/:ticketId/messages/:messageId/attachments
GET  /api/customers/:customerId/attachments
POST /api/customers/:customerId/attachments
GET  /api/attachments/:attachmentId/download

GET  /api/portal/tickets/:ticketId/attachments
POST /api/portal/tickets/:ticketId/attachments
GET  /api/portal/attachments/:attachmentId/download
```

**Upload.** Server-proxied `multipart/form-data`. The request must contain **exactly one part: a file named `file`**. **No textual multipart fields are accepted** — any `field` event is rejected deterministically (the field value is never read, logged, or echoed). Max **4 MiB**. Allowed types (validated by file **signature/content**, not the client MIME type, extension, or multipart filename): `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `text/plain`. `text/plain` is validated over the whole buffer (reject NUL bytes, invalid UTF-8, any binary signature, and `<!doctype`/`<html`/`<head`/`<body`/`<script`/`<svg`/`<?xml`/`<!--` markup starts). On any rejection the multipart stream is drained, no provider upload and no database write occur, and exactly one response is returned. `storageKey` is `attachments/<random uuid>`, generated server-side, never from the filename or the request. The original filename is kept only as sanitized display metadata (path components across `/` and `\`, control characters, and leading dots stripped; length bounded to 200; `"file"` fallback).

Exactly one documented code per condition:

| Condition | Code | Status |
| --- | --- | --- |
| No file part | `NO_FILE` | 422 |
| A file part under a field name other than `file` | `NO_FILE` | 422 |
| More than one file part | `MULTIPLE_FILES` | 422 |
| The file part has zero bytes | `EMPTY_FILE` | 422 |
| The file part exceeds 4 MiB (upload **and** a stored object larger than 4 MiB on download) | `FILE_TOO_LARGE` | 413 |
| Detected content type not in the allowlist / MIME spoof | `UNSUPPORTED_FILE_TYPE` | 415 |
| A **reserved** textual field is submitted (`storageKey`, `ticketId`, `messageId`, `customerId`, `mimeType`, `fileName`, `createdAt`) | `INVALID_ATTACHMENT_CONTEXT` | 422 |
| Any other unexpected textual field, malformed multipart, a stream error, or an aborted request | `INVALID_UPLOAD` | 422 |
| Storage not configured (`BLOB_READ_WRITE_TOKEN` unset) or provider unavailable | `STORAGE_UNAVAILABLE` | 503 |
| Provider upload succeeded but the metadata row could not be created | `ATTACHMENT_UPLOAD_FAILED` | 500 |
| Missing attachment record, unauthorized attachment, or missing stored object (no provider detail) | `ATTACHMENT_NOT_FOUND` | 404 |
| Missing/hidden ticket | `TICKET_NOT_FOUND` | 404 |
| Message not found under the supplied ticket | `MESSAGE_NOT_FOUND` | 404 |
| Portal upload to a `CLOSED` ticket | `TICKET_CLOSED` | 409 |
| Portal caller has no linked `Customer` profile | `CUSTOMER_PROFILE_REQUIRED` | 403 |
| Role/assignment/authorship violation (incl. attaching to another user's message — enforced for `ADMIN`/`MANAGER` too) | `FORBIDDEN` | 403 |

No alternate aliases exist in code (no `VALIDATION_ERROR`, `UNEXPECTED_FILE_FIELD`, `ATTACHMENT_TOO_LARGE`, or `MESSAGE_NOT_OWNED`). Backend, the frontend `attachments.errors.*` map, English/Arabic strings, and tests use these exact codes.

**Context invariants** (service-enforced; `docs/04`): ticket-level = `ticketId` set, `messageId`/`customerId` null; message-level = `ticketId` + `messageId` set (the message must belong to the ticket), `customerId` null; customer-level = `customerId` set, others null.

**Metadata projections.** Internal: `{ id, fileName, mimeType, createdAt, ticketId, messageId, customerId }`. Portal (distinct serializer): `{ id, fileName, mimeType, createdAt, messageId }` only — no `ticketId`, `customerId`, `storageKey`, provider URL, or staff identity. `GET /api/tickets/:ticketId/attachments` returns ticket-level plus message-level rows whose message belongs to the ticket, each once (`OR: [{ ticketId, messageId: null }, { message: { ticketId } }]`); the focused message route returns that message's rows only.

**Listing / upload authorization.** `GET` routes require `ADMIN`/`MANAGER`/`AGENT`; `CUSTOMER` and unauthenticated callers are rejected (`403` / `401`). Ticket and message listing/download follow the existing ticket visibility predicate (`AGENT` sees assigned or unassigned only; a hidden ticket → `404 TICKET_NOT_FOUND`, and a hidden/foreign attachment → `404 ATTACHMENT_NOT_FOUND`). Ticket/message **upload** additionally requires an `AGENT` to be the assigned agent (`403 FORBIDDEN` otherwise); message upload also requires `message.authorUserId ===` the authenticated user — enforced for `ADMIN`/`MANAGER` too (`403 FORBIDDEN`). Customer-profile listing/download is available to every internal read role; customer-profile **upload** is `ADMIN`/`MANAGER` only (`AGENT` → `403 FORBIDDEN`).

**Download / Preview transport.** Both the Download action and the frontend in-browser **Preview** use the **same** authenticated download endpoints (`GET /api/attachments/:id/download` and `GET /api/portal/attachments/:id/download`). Preview is a client-side presentation of that authorized private response as a temporary in-memory browser Blob URL — there is **no** preview endpoint, no public Blob access, and no storage key / provider URL / token in the response.

**Download.** Always through the authenticated app endpoint. Order: load metadata → resolve context → enforce internal visibility / Portal ownership → `storage.head` (missing object → `404 ATTACHMENT_NOT_FOUND` with no provider detail; `size > 4 MiB` → `413 FILE_TOO_LARGE`) → `storage.get`. Authorization always runs before any provider call. Response uses the stored validated MIME type and sends `Content-Disposition: attachment; filename="<ascii>"; filename*=UTF-8''<pct>`, `X-Content-Type-Options: nosniff`, and `Cache-Control: private, no-store`. The browser is never redirected to a provider URL.

**Orphan cleanup.** Creation order: authenticate → authorize context → parse multipart → validate signature → generate key → provider `put` → DB `create`. If `put` succeeds but `create` fails, the provider object is deleted immediately and `500 ATTACHMENT_UPLOAD_FAILED` is returned; if the cleanup delete also fails, the original failure is preserved and the orphan `storageKey` is logged (no tokens or file contents). There is **no** background orphan-cleanup worker and no cross-provider transaction.

**No deletion.** There is no attachment DELETE endpoint. No malware scanning is configured; signature validation is not a malware guarantee.

**Portal.** `CUSTOMER` only. Identity and ticket ownership derive from `User -> Customer.userId`; `customerId` is never accepted from the browser. Missing and non-owned tickets both return the existing `404 TICKET_NOT_FOUND`; missing, non-owned, and customer-profile attachments all return `404 ATTACHMENT_NOT_FOUND`. Upload is allowed only for an owned non-`CLOSED` ticket; a `CLOSED` ticket returns `409 TICKET_CLOSED`. A Portal upload alone never creates a `TicketMessage` and never reopens the ticket.

## Feedback — LIVE (Portal only)

```text
POST /api/portal/tickets/:id/feedback   submit rating (CUSTOMER, own RESOLVED/CLOSED ticket) → 201
GET  /api/portal/tickets/:id/feedback   read own submitted feedback (CUSTOMER) → 200 or 404
```

`feature/customer-feedback` uses the existing `Feedback` model (`ticketId @unique`, `customerId`, `rating`, `comment?`) unchanged — no schema or migration change. Both routes are sub-routes on the existing `portalRouter` (`requireAuth` + `requireRole(CUSTOMER)`); there is **no internal `/api/feedback` route** and no `app.ts` change. Identity and ticket ownership derive from `User -> Customer.userId`; `customerId` is never accepted from the browser.

- **Eligibility:** owned ticket with stored status `RESOLVED` or `CLOSED`. Missing/non-owned ticket → `404 TICKET_NOT_FOUND` (IDOR-safe); owned ticket in any other status → `409 TICKET_NOT_ELIGIBLE_FOR_FEEDBACK`.
- **One-shot, immutable:** one `Feedback` row per ticket (enforced by `@unique` and a pre-create check in the same transaction). No update or delete endpoint. A repeat submission → `409 FEEDBACK_ALREADY_SUBMITTED`.
- **Body:** `rating` is a JSON number, integer `1`–`5` (else `400 VALIDATION_ERROR`); `comment` is an optional trimmed string 1–2,000 chars, stored `NULL` when omitted/blank. Strict schema rejects unknown fields.
- **Response:** `{ data: { rating, comment, createdAt } }`. `GET` returns the same shape or `404 FEEDBACK_NOT_FOUND`.
- **Side effect:** submission writes one `TicketHistory` row (`action: "FEEDBACK_SUBMITTED"`, `actorUserId` = customer's user id, `newValue` = rating string) inside the create transaction.
- **Ticket detail:** `GET /api/portal/tickets/:id` additionally returns `feedbackEligible: boolean` and `feedback: { rating, comment, createdAt } | null` so the Portal page needs no extra request.

Satisfaction reporting (`GET /reports/*`, ADMIN/MANAGER) consumes `Feedback.rating` and is implemented on the `feature/reports` branch — see "Reports — LIVE" above.

## Notifications — LIVE

```text
GET   /api/notifications                  list current user's notifications
GET   /api/notifications/unread-count     current user's unread count
PATCH /api/notifications/read-all         mark all current user's notifications read
PATCH /api/notifications/:id/read         mark one owned notification read
```

All routes require `ADMIN`, `MANAGER`, or `AGENT`; `CUSTOMER` is rejected. List query supports bounded `page`, `limit`, and `read=true|false`; every operation is scoped to `request.auth.userId`, and a missing or wrong-owner id returns the same `404 NOTIFICATION_NOT_FOUND`. Assignment, customer-reply, escalation, mention, and watcher-activity notifications are written atomically with their ticket transaction and may carry an optional `ticketId` link. Unread count polls every 30 seconds in the internal client. There is no Portal notification surface, realtime transport, email/push delivery, or arbitrary-update notification fan-out.

## Team Collaboration — LIVE (on `feature/team-collaboration`, not yet integrated)

`feature/team-collaboration` (ADR-032). Internal-only mentions and ticket watchers. `CUSTOMER` and unauthenticated callers are rejected everywhere; the Customer Portal exposes none of it.

```text
GET    /api/users/mentionable?search=      active internal users for @mention autocomplete
GET    /api/tickets/:id/watchers           list the ticket's watchers
POST   /api/tickets/:id/watchers           follow the ticket (self only, idempotent)
DELETE /api/tickets/:id/watchers/me        unfollow the ticket (self only, safe if absent)
```

- `GET /api/users/mentionable` — `ADMIN`/`MANAGER`/`AGENT` (same lookup group as `/users/agents`, registered before `/users/:id`). Returns at most 10 `{ id, name, email }` of **active internal** users; optional case-insensitive `search` over name/email. Never returns `CUSTOMER`. This is a separate route from the ADMIN-only `/api/users` list.
- Watcher routes are sub-routes of `ticketRouter` (`requireAuth` + `requireRole(ADMIN, MANAGER, AGENT)`); each re-checks ticket visibility, so a hidden or missing ticket returns `404 TICKET_NOT_FOUND` (IDOR-safe). `POST` and `DELETE` act on the authenticated caller only and return `{ data: { watching: boolean, watcherCount: number } }`. `GET` returns `{ data: [{ id, createdAt, user: { id, name, email } }] }`.
- **@mentions:** an internal note body may contain `@[Display Name](userId)` tokens. On `POST /api/tickets/:id/notes`, inside the same transaction as the note: valid tokens are resolved to active internal users (author excluded), `TicketMention` rows are written, the note author and every mentioned user are auto-added as watchers, and each mentioned user receives one `TICKET_MENTION` notification. Malformed tokens, `CUSTOMER` ids, inactive users, and the author are ignored. The stored note text is never rewritten.
- **Watcher activity:** watchers receive a `TICKET_WATCH_ACTIVITY` notification when a staff reply or internal note is added, when status changes, when assignment changes, or when the customer replies from the Portal — always excluding the actor and any recipient already notified by the triggering event's own notification (assignment, escalation, customer-reply, or a `TICKET_MENTION` for the same note).
- No schema column changes to existing tables; new tables `TicketWatcher` and `TicketMention` (migration `20260828163000_add_team_collaboration`). No new `Notification` enum — `type` stays a string with two new values.

## AI Assistant — INTERNAL (on `feature/ai-assistant`, not yet integrated)

`feature/ai-assistant` (ADR-034). Internal agent-assistance layer — suggestions only. `CUSTOMER` and unauthenticated callers are rejected at the router; the Customer Portal exposes nothing.

```text
POST /api/tickets/:id/ai      body: { "action": "SUMMARY" | "SUGGEST_REPLY" | "CLASSIFY" | "KB_SUGGESTIONS", "locale"?: "en" | "ar" }
```

- Sub-route of `ticketRouter` (`requireAuth` + `requireRole(ADMIN, MANAGER, AGENT)`). The client sends **only `{ action }`** plus an optional strict `locale` enum — no messages, notes, customer data, or free-form text. `.strict()` body; any extra key, unknown action, or unsupported locale → `400 VALIDATION_ERROR`. `locale` currently affects **SUMMARY** only (output language); other actions ignore it.
- The server builds the AI context itself after the **same ticket-visibility check as `GET /api/tickets/:id`** (`ticketVisibilityWhere`); a hidden or missing ticket → `404 TICKET_NOT_FOUND` (IDOR-safe). There is no weaker AI-only visibility rule.
- **Context is minimized per action.** SUMMARY and SUGGEST_REPLY may use internal notes (SUGGEST_REPLY only inside a non-disclosable private block). **CLASSIFY and KB_SUGGESTIONS never receive internal notes** and only get the recent public exchange plus the server-owned candidate list.
- This endpoint never mutates the ticket, sends a message, or changes status/category/priority/assignment. Using a suggestion (insert reply text, apply category, open article) is a separate explicit user action through the existing ticket-update / composer / KB-route paths and their RBAC.
- Success → `200 { data: { action, promptVersion, result } }`:
  - `SUMMARY` → `result: { issue, timeline: string[] (≤8), currentState, recommendedNextAction }`
  - `SUGGEST_REPLY` → `result: { reply }` (≤5000 chars; internal notes never appear in it)
  - `CLASSIFY` → `result: { categoryId, categoryName, confidence (0..1), reason }` — `categoryId` is always one of the server's active categories (re-validated after generation; `categoryName` from the server record, not the model)
  - `KB_SUGGESTIONS` → `result: { articles: [{ id, title, excerpt, relevance (0..1), reason }] }` (≤5) — every `id` is a real **PUBLISHED** article from the server candidate set; `title`/`excerpt` from the server record
- Provider config is four optional env vars (`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS`). Not fully configured, or `AI_PROVIDER` naming an unsupported vendor → `503 AI_NOT_CONFIGURED` (never a startup crash, never a silent fallback to OpenRouter); the rest of the CRM is unaffected. Provider timeout → `504 AI_TIMEOUT`; **provider rate-limited (HTTP 429 from OpenRouter/upstream)** → `503 AI_PROVIDER_RATE_LIMITED` (retryable; `Retry-After` header + `details.retryAfterSeconds` when known; the adapter already made one bounded in-budget retry); other provider/network/output failure → `502 AI_GENERATION_FAILED`; **CLASSIFY** with zero active categories → `422 AI_NO_CANDIDATES` (KB_SUGGESTIONS with no matching articles is a normal `200 { articles: [] }`, not an error, and does not call the provider). Raw provider errors, upstream provider names, and OpenRouter internals are never forwarded.
- Rate limit: `429 RATE_LIMITED` after 20 actions per user per 10 minutes, with a `Retry-After` header and `{ retryAfterSeconds }` detail.
- First provider adapter: OpenRouter via native `fetch` (`z-ai/glm-5.2:free` initial dev/demo model), fully isolated behind an `AiProvider` interface; model is chosen only by `AI_MODEL`. No schema or migration change.

## SLA automation — INTERNAL CRON

```text
GET /api/internal/sla-monitor
Authorization: Bearer <CRON_SECRET>
```

This is a deployment-scheduler endpoint, not a product API. Product JWTs, authenticated roles, and Portal sessions do not grant access. Missing server configuration returns `503 CRON_NOT_CONFIGURED`; a missing or invalid scheduler bearer secret returns `401 CRON_AUTHENTICATION_REQUIRED`. A successful response contains only `{ data: { assigned, escalated, inspected, generatedAt } }` and exposes no ticket or user records.

Vercel Cron invokes it every five minutes. Each execution inspects at most 100 oldest unassigned active tickets and 100 oldest resolution-SLA-breached unresolved tickets. Automatic assignment preserves every existing assignment, considers active `AGENT` users only, matches every non-null ticket department/branch constraint, chooses the lowest active assigned-ticket count, and breaks ties by agent id ascending. Automatic escalation changes a nonterminal, non-`ESCALATED` ticket to `ESCALATED` when `resolutionDueAt <= execution time`; first-response deadlines do not trigger escalation.

Each mutation uses a conditional database update inside the same transaction as its `TicketHistory` row and notifications. If another or repeated execution has already assigned, escalated, resolved, closed, or otherwise changed the ticket, the conditional update affects zero rows and no history or notification is written. Automated history uses `actorUserId: null`, with actions `AUTO_ASSIGNMENT` and `SLA_AUTO_ESCALATED`. Assignment alerts go to the selected agent; escalation alerts go to active `ADMIN` and `MANAGER` users. No derived SLA state is persisted.

## WhatsApp Integration — INTERNAL WEBHOOK (on `feature/whatsapp-integration`, not yet integrated)

```text
GET  /api/integrations/whatsapp/webhook   Meta verification handshake (echoes hub.challenge)
POST /api/integrations/whatsapp/webhook   Inbound WhatsApp events (Meta X-Hub-Signature-256 signed)
```

Machine endpoints — **no product JWT**. `whatsappRouter` is mounted in `server/src/app.ts` **before** `express.json()` so the `POST` body stays a raw Buffer for HMAC verification. Backed by `server/src/modules/integrations/whatsapp/*` (`feature/whatsapp-integration`, ADR-030). Uses the official Meta WhatsApp Cloud API only. All five `WHATSAPP_*` env vars are optional — when unset the endpoints return `503 WHATSAPP_NOT_CONFIGURED` and the rest of the CRM is unaffected.

- **`GET /webhook`** — Meta calls this with `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`. When `hub.verify_token` matches `WHATSAPP_VERIFY_TOKEN` (constant-time) the server responds `200 text/plain` with the challenge; otherwise `403 WHATSAPP_VERIFICATION_FAILED`. No `WHATSAPP_VERIFY_TOKEN` → `503 WHATSAPP_NOT_CONFIGURED`.
- **`POST /webhook`** — verifies `X-Hub-Signature-256` (HMAC-SHA256 of the raw body keyed by `WHATSAPP_APP_SECRET`). Invalid/missing signature → `401 WHATSAPP_INVALID_SIGNATURE`; no `WHATSAPP_APP_SECRET` → `503 WHATSAPP_NOT_CONFIGURED`; signed but non-JSON → `400 WHATSAPP_INVALID_PAYLOAD`; signed but structurally unexpected → `200 { received: true, processed: 0, ignored: true }`. Success → `200 { received: true, processed: <n> }`.
- **Inbound processing (text messages only), one transaction per message:** de-duplicated by `TicketMessage.externalId` (the Meta `wamid`, a unique column) → authored by the login-less system `User` `whatsapp-inbound@system.invalid` → `Customer` matched by normalized `+E164` phone, or created (`{ name: profile name or +E164, phone: +E164, email: "wa-<digits>@no-email.invalid" }` — a non-routable placeholder, `Customer.email` being required + unique) → newest ticket for that customer with `channel = WHATSAPP` and status ∉ `{RESOLVED, CLOSED}` is appended to, else a new ticket is created (`channel = WHATSAPP`, `status = NEW`, `priority = MEDIUM`, MEDIUM-priority SLA snapshot, `TICKET_CREATED` history with `actorUserId = null`, subject `WhatsApp: <first 60 chars>`) → `TicketMessage` created with `externalId`; `firstRespondedAt` untouched → a message to a `WAITING_CUSTOMER` ticket bumps it to `IN_PROGRESS` (atomic history) → a `CUSTOMER_REPLY` notification fans out to the assigned agent plus active `ADMIN`/`MANAGER` via the existing notification service. Delivery/read `statuses`, non-text messages and unrelated fields are ignored with `200`.
- **Outbound** replies use the existing `POST /api/tickets/:id/messages` (RBAC unchanged) — see the Tickets section. A `WHATSAPP_DELIVERY_FAILED` `TicketHistory` action records a failed send.
- The webhook needs a public HTTPS URL: `https://<api-domain>/api/integrations/whatsapp/webhook`. Required Meta webhook subscription: **`messages`** only.

Known limitations: text only (in and out); no media/templates/interactive/status-receipt UI; no multi-number/multi-WABA; no historical import; ambiguous phone matches route to one existing customer (logged, never merged); a WhatsApp message after a ticket is `RESOLVED`/`CLOSED` opens a new ticket rather than reopening. Full detail in `docs/20-whatsapp-integration.md`.

## Tasks — LIVE (on `feature/tasks-reminders`, not yet integrated)

```text
GET    /api/tasks           list (ADMIN, MANAGER, AGENT) — ?status &assigneeId &ticketId &search &page &limit
POST   /api/tasks           create (ADMIN, MANAGER, AGENT)
GET    /api/tasks/:id       read one (ADMIN, MANAGER, AGENT)
PATCH  /api/tasks/:id       update (field-level rights, see below)
DELETE /api/tasks/:id       delete (ADMIN, MANAGER, or creator) → 204
```

`taskRouter` is registered at `/api/tasks` in `server/src/app.ts` behind `requireAuth` + `requireRole(ADMIN, MANAGER, AGENT)`. `CUSTOMER` and unauthenticated callers are rejected everywhere; there is no Portal route. New `Task` model + nullable `Notification.taskId` (migration `20260827200533_add_tasks`).

- **Visibility:** `ADMIN`/`MANAGER` see every task; `AGENT` sees only tasks they created or are assigned. An `AGENT`'s `assigneeId` list filter is ignored.
- **Assignment:** `AGENT` may only self-assign (other `assigneeId` → `403 FORBIDDEN`); `ADMIN`/`MANAGER` assign to any active `AGENT` or self (`404 ASSIGNEE_NOT_FOUND` otherwise). Assigning to another user writes one `TASK_ASSIGNED` notification in the same transaction.
- **Ticket link (optional):** validated against ticket-visibility for the actor (`404 TICKET_NOT_FOUND`) and the effective assignee (`422 TICKET_NOT_ACCESSIBLE_BY_ASSIGNEE`). No `TicketHistory` row is written.
- **Field-level `PATCH`:** `ADMIN`/`MANAGER` → all fields; `AGENT` creator → content, `status`, `dueAt`, `ticketId`, never `assigneeId` (`403`); `AGENT` assignee-but-not-creator → `status` only (any other field → `403`). `remindedAt` is reset when `dueAt` changes, the assignee changes, or a `DONE` task is reopened.
- **Not found / IDOR:** any task outside the caller's visibility → `404 TASK_NOT_FOUND`.
- A successful mutation returns `{ data: <task> }` with safe `creator` / `assignee` (`{ id, name }`) and `ticket` (`{ id, subject }`) projections — never `passwordHash` or email.

### Task reminders — INTERNAL CRON

```text
GET /api/internal/task-reminders
Authorization: Bearer <CRON_SECRET>
```

Deployment-scheduler endpoint, not a product API — reuses the **same** `CRON_SECRET` bearer check as `/api/internal/sla-monitor` (`503 CRON_NOT_CONFIGURED`, `401 CRON_AUTHENTICATION_REQUIRED`). Vercel Cron invokes it every five minutes. Each run selects at most 100 tasks with `status = OPEN`, `remindedAt IS NULL`, and `dueAt <= now`, oldest `dueAt` first; per task, inside a transaction, a conditional `updateMany({ remindedAt: null }) → count === 1` guard stamps `remindedAt` and sends one `TASK_REMINDER` notification to the assignee. Repeated or overlapping runs write nothing extra. Response is only `{ data: { inspected, reminded, generatedAt } }`.

## Quick Replies — LIVE (on `feature/quick-replies`, not yet integrated)

```text
GET    /api/quick-replies          list (ADMIN, MANAGER, AGENT)
GET    /api/quick-replies/:id      read one (ADMIN, MANAGER, AGENT)
POST   /api/quick-replies          create (ADMIN, MANAGER)
PATCH  /api/quick-replies/:id      update (ADMIN, MANAGER)
DELETE /api/quick-replies/:id      delete (ADMIN, MANAGER) → 204
```

`quickReplyRouter` is registered at `/api/quick-replies` in `server/src/app.ts`. `requireAuth` then a use-role group (`ADMIN`/`MANAGER`/`AGENT`) on `GET` and a manage-role group (`ADMIN`/`MANAGER`) on `POST`/`PATCH`/`DELETE`. `AGENT` and `CUSTOMER` receive the standard `403 FORBIDDEN` on mutations; `CUSTOMER` and unauthenticated callers are rejected from every route. There is no Portal route — the Customer Portal never sees quick replies.

`QuickReply` (`id`, `title`, `body`, `createdById`, `createdAt`, `updatedAt`) is used unchanged; no Prisma schema or migration change. `createdById` is assigned from the authenticated user and never accepted from the client; strict schemas reject unknown fields. `title` is trimmed 2–120 chars; `body` is trimmed 1–5,000 chars; `PATCH` requires at least one of `title`/`body`.

List response: `{ data: QuickReply[], meta: { page, limit, total, totalPages } }` where each item is `{ id, title, body, createdAt, updatedAt, createdBy: { id, name, role } }` (author email is never projected; `body` is included so the composer inserter needs no second request). Ordering is `title asc, id asc`. `search` is a case-insensitive `contains` over `title` and `body`. `page`/`limit` are bounded (`limit` max 100, default 20). A missing id returns `404 QUICK_REPLY_NOT_FOUND`.

`feature/quick-replies` also adds a manager-only `/quick-replies` management workspace (list + create/edit) with a nav item shown only to `ADMIN`/`MANAGER`, and a `QuickReplyPicker` in the internal Ticket public-reply composer: a searchable, keyboard-accessible combobox that queries this list endpoint's `search` (debounced, bounded page) so every quick reply is reachable, and inserts the selected `body` as editable plain text at the textarea cursor (replacing any selected range, preserving surrounding draft, restoring focus and caret) subject to the 20,000-char public-reply limit. Selection never sends; the picker is absent from the Internal Note tab, read-only/unassigned agent states, and the Customer Portal.

## Settings / Configuration management — PLANNED

No route is registered. `feature/settings` exposes configuration only for resources with real persistence and APIs: categories (currently read-only via `GET /categories`), `SlaRule` rows (currently seeded/managed directly), quick replies, and bounded branding once `feature/custom-branding` exists. No dead settings surface. SLA-rule and category administration CRUD shapes are resolved during that feature.

## Dashboard — LIVE

```text
GET /dashboard/overview
```

`GET /dashboard/overview` requires `ADMIN`, `MANAGER`, or `AGENT`; `CUSTOMER` is rejected. `ADMIN` and `MANAGER` receive metrics and tickets across all internal tickets. `AGENT` visibility remains tickets assigned to that agent plus unassigned tickets, matching Ticket Management visibility. This scope continues to govern metrics, status distribution, and recent tickets. The AGENT primary queue is intentionally narrower and contains only active tickets assigned to the authenticated agent.

The standard `{ data }` envelope contains `metrics`, real counts grouped in `statusDistribution`, `ticketActivity`, `primaryQueueType`, at most 10 `primaryTickets`, at most 8 `recentTickets`, and `generatedAt`. `primaryQueueType` is `NEEDS_ATTENTION` for `ADMIN`/`MANAGER` and `MY_ASSIGNED_TICKETS` for `AGENT`. Dashboard ticket items expose only identifier, subject, status, priority, update time, effective SLA deadline/state, safe customer summary, and safe assignee summary.

`ticketActivity` is a fixed-length array of exactly 30 `{ date, opened, resolved }` objects — one per UTC day, oldest first, ending on the current UTC day, zero-filled. `opened` counts tickets whose `createdAt` falls on that day; `resolved` counts tickets whose `resolvedAt` falls on that day. The series honours the same role visibility as every other field (ADMIN/MANAGER: all internal tickets; AGENT: assigned-or-unassigned). It is an additive presentation aid for the dashboard "Ticket activity" chart and is independent of the ADMIN/MANAGER-only `/reports` endpoints. See `17-decisions-log.md` ADR-031.

For `ADMIN` and `MANAGER`, `primaryTickets` preserves Needs Attention ordering by SLA breach, urgent priority, SLA risk, high priority, unassigned state, oldest relevant update, and final identifier tie-breaker. For `AGENT`, it excludes unassigned, other-agent, `RESOLVED`, and `CLOSED` tickets and orders active assigned work by breached SLA, at-risk SLA, priority from urgent through low, oldest update, and final identifier tie-breaker. Recent tickets exclude every primary Ticket ID before applying the eight-item limit, then use `updatedAt` descending and identifier ascending across the remaining role-visible records.

Active metrics include `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`, and `ESCALATED`, excluding `RESOLVED` and `CLOSED`. `assignedToMe` always means active tickets assigned to the authenticated user. `resolvedToday` uses the current UTC calendar day. SLA state is derived at read time according to `08-sla-automation.md`; no derived state is persisted.

## Customer Portal

Portal routes may reuse ticket APIs with customer-scoped authorization rather than duplicate business logic. The implemented Portal namespace uses dedicated isolated routes (see "Customer Portal API" below).

`GET /portal/knowledge-articles` and `GET /portal/knowledge-articles/:id` are LIVE (published-only read, `feature/knowledge-base`); see "Portal Knowledge Base" above. `POST /portal/tickets/:id/feedback` and `GET /portal/tickets/:id/feedback` are LIVE on `feature/customer-feedback` (on branch); see "Feedback — LIVE (Portal only)" above.

## API Rules

- All protected endpoints require authenticated context.
- Authorization is server-side.
- Request bodies and parameters are validated.
- List endpoints should support pagination when practical.
- Ticket list should support filters such as status, priority, category, assignee, and server-side search across the exact ticket ID, subject, description, customer name, and customer email.
- Never trust a customer-provided customerId for access control.

## Customer Portal API

All `/api/portal/*` endpoints require an authenticated `CUSTOMER` and derive ownership from the user's linked Customer profile. Missing profiles return `403 CUSTOMER_PROFILE_REQUIRED`; missing and non-owned tickets both return `404 TICKET_NOT_FOUND`.

- `GET /portal/overview`: owned open/waiting/resolved counts and up to five recent requests.
- `GET /portal/categories`: active `{ id, name }` category summaries only.
- `GET /portal/tickets`: owned pagination and search plus customer-facing `status`, `priority`, and `categoryId` filtering. Query params: `page` (≥ 1, default 1), `limit` (1–100, default 20), `search` (≤ 100 — exact ticket `id` OR case-insensitive `subject`/`description` contains), `status` (portal enum `OPEN|IN_PROGRESS|WAITING_FOR_YOU|RESOLVED|CLOSED`), `priority` (`LOW|MEDIUM|HIGH|URGENT`), `categoryId` (exact). Unknown params (incl. `assignedAgentId`, `departmentId`, `branchId`, `customerId`, `sort`) are rejected by the strict schema. Every filter is ANDed with the authenticated customer's `customerId` in the same DB query — ownership is never client-supplied. Ordering is fixed `updatedAt DESC`, then `id ASC` (no `sort` param). Row projection: `{ id, subject, status, priority, category: { id, name } | null, createdAt, updatedAt }`.
- `GET /portal/tickets/:id`: safe details and public `TicketMessage` records only.
- `POST /portal/tickets`: strict subject, description, and optional category creation.
- `POST /portal/tickets/:id/messages`: strict customer reply. The body is now **rich text (HTML) from the shared Lexical composer** and is **sanitized server-side on write** to the same support allowlist as staff replies; a markup-only body is rejected with `422 EMPTY_MESSAGE`. Maximum 20,000 characters. No mention tokens are produced on the Portal.

Portal **ticket detail** and every other Portal serializer exclude priority, assignee, organization, SLA state, SLA targets, SLA deadlines, notes, history, staff roles/emails, audit data, and escalation semantics; they never expose `slaState`, `effectiveSlaDueAt`, `effectiveSlaTarget`, `firstResponseDueAt`, `firstRespondedAt`, or `resolutionDueAt`. The single exception is the **`GET /portal/tickets` list row**, which carries a customer-safe `priority` (`LOW|MEDIUM|HIGH|URGENT` — the ticket's own priority, not any internal SLA/escalation state) to back the "My Requests" priority column and filter (ADR-033).

The Portal ticket detail (`GET /portal/tickets/:id`) itself still carries no attachment data. `feature/attachments` adds a **separate** owned-ticket attachment surface (`GET/POST /portal/tickets/:id/attachments`, `GET /portal/attachments/:id/download`) with its own minimal `{ id, fileName, mimeType, createdAt, messageId }` projection — no ticket/customer ids, storage keys, staff identity, or SLA/notes/history. See "Attachments — LIVE".
