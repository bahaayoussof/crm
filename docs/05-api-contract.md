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

Registered routers as of `master` `79c7067` plus the uncommitted `feature/customer-feedback` branch: `/api/auth`, `/api/customers`, `/api/categories`, `/api/users` (lookup only), `/api/tickets`, `/api/dashboard`, `/api/knowledge-articles`, `/api/quick-replies` (integrated at `79c7067`), `/api/attachments`, `/api/portal/knowledge-articles`, `/api/portal/attachments`, `/api/portal`, `/api/health`, plus attachment sub-routes on `/api/tickets`, `/api/customers`, and the portal ticket router (`feature/attachments`, integrated at `8e24d22`), and feedback sub-routes on the portal ticket router (`feature/customer-feedback`, on branch). There is no registered `/api/reports`, `/api/notifications`, `/api/feedback` (feedback is Portal-only), or `/api/settings` route.

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

## Users — PARTIAL

```text
GET    /users/agents      LIVE
GET    /users             PLANNED
GET    /users/:id         PLANNED
POST   /users             PLANNED
PATCH  /users/:id         PLANNED
```

`GET /users/agents` is the only registered users route. It is an internal-only Ticket Management lookup that returns safe summaries of `AGENT` users (`id`, `name`, `email`) to `ADMIN`, `MANAGER`, and `AGENT`. It never returns password hashes or customer identities.

The list/detail/create/update routes are the planned `feature/user-management` contract for ADMIN-managed internal users and roles. They are not implemented. When built they must not allow public creation of `ADMIN`, `MANAGER`, or `AGENT` accounts; internal-user administration is separate from public customer registration. Exact request/response shapes and the MANAGER capability boundary are resolved during that feature.

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

```text
POST /tickets/:id/messages
POST /tickets/:id/notes
```

Both mutations accept the strict body `{ body: string }`, trim it, reject empty or unknown fields, and derive `authorUserId` from the authenticated internal identity. They never accept a client-provided author or timestamp.

`POST /tickets/:id/messages` creates a customer-visible `TicketMessage`. The first successful public staff reply sets `firstRespondedAt` to the message creation timestamp in the same transaction only when it is currently null; later replies do not overwrite it. The response is `{ data: { kind: "PUBLIC_MESSAGE", id, body, createdAt, author } }`.

`POST /tickets/:id/notes` creates an internal-only `TicketNote`, never a `TicketMessage` or `CustomerNote`, and never changes `firstRespondedAt`, ticket status, `resolvedAt`, or `closedAt`. The response is `{ data: { kind: "INTERNAL_NOTE", id, body, createdAt, author } }`.

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

## Reports — PLANNED

```text
GET /reports/overview      PLANNED
GET /reports/tickets       PLANNED
GET /reports/agents        PLANNED
GET /reports/sla           PLANNED
```

No route is registered. This is the `feature/reports` contract for `ADMIN`/`MANAGER`: created/resolved volume, status distribution, SLA compliance, average first-response time, agent performance, and customer satisfaction, all from real persisted data with an explicit date-range and timezone definition. `GET /dashboard/overview` (LIVE, below) is an operational snapshot, not the Reports feature. Satisfaction metrics depend on `feature/customer-feedback`. Do not invent fabricated analytics.

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

Satisfaction reporting (`GET /reports/*`) is still `feature/reports` and consumes `Feedback.rating`; no reports route is registered yet.

## Notifications — PLANNED

No route is registered. `Notification` (`userId`, `type`, `title`, `message`, `readAt?`) exists in `schema.prisma` only. `feature/notifications` covers in-app notifications and a read/unread workflow. It must distinguish event-driven in-app notifications from SLA request-time derivation and from any scheduled monitoring; serverless scheduling constraints apply.

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

The standard `{ data }` envelope contains `metrics`, real counts grouped in `statusDistribution`, `primaryQueueType`, at most 10 `primaryTickets`, at most 8 `recentTickets`, and `generatedAt`. `primaryQueueType` is `NEEDS_ATTENTION` for `ADMIN`/`MANAGER` and `MY_ASSIGNED_TICKETS` for `AGENT`. Dashboard ticket items expose only identifier, subject, status, priority, update time, effective SLA deadline/state, safe customer summary, and safe assignee summary.

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
- `GET /portal/tickets`: owned pagination, search, and customer-facing status filtering.
- `GET /portal/tickets/:id`: safe details and public `TicketMessage` records only.
- `POST /portal/tickets`: strict subject, description, and optional category creation.
- `POST /portal/tickets/:id/messages`: strict customer reply, maximum 20,000 characters.

Portal responses exclude priority, assignee, organization, SLA state, SLA targets, SLA deadlines, notes, history, staff roles/emails, audit data, and escalation semantics. In particular, Portal serializers never expose `slaState`, `effectiveSlaDueAt`, `effectiveSlaTarget`, `firstResponseDueAt`, `firstRespondedAt`, or `resolutionDueAt`.

The Portal ticket detail (`GET /portal/tickets/:id`) itself still carries no attachment data. `feature/attachments` adds a **separate** owned-ticket attachment surface (`GET/POST /portal/tickets/:id/attachments`, `GET /portal/attachments/:id/download`) with its own minimal `{ id, fileName, mimeType, createdAt, messageId }` projection — no ticket/customer ids, storage keys, staff identity, or SLA/notes/history. See "Attachments — LIVE".
