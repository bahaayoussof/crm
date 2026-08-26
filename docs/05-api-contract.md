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

Registered routers as of `master` `e387667`: `/api/auth`, `/api/customers`, `/api/categories`, `/api/users` (lookup only), `/api/tickets`, `/api/dashboard`, `/api/portal`, `/api/health`. There is no registered `/api/knowledge-articles`, `/api/reports`, `/api/notifications`, `/api/feedback`, `/api/quick-replies`, `/api/settings`, or attachment upload/download route.

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

## Knowledge Base — PLANNED

```text
GET    /knowledge-articles          PLANNED
GET    /knowledge-articles/:id      PLANNED
POST   /knowledge-articles          PLANNED
PATCH  /knowledge-articles/:id      PLANNED
DELETE /knowledge-articles/:id      PLANNED
```

No route is registered. `KnowledgeArticle` and `KnowledgeArticleStatus` (`DRAFT`, `PUBLISHED`) exist in `schema.prisma` only. This is the `feature/knowledge-base` contract: internal list/search and article detail for `ADMIN`/`MANAGER`/`AGENT`, management (create/update/delete) for `ADMIN`/`MANAGER`, and a published-only customer read path reused by `GET /portal/knowledge-articles`. Response shapes, search parameters, and category handling are resolved during that feature.

## Reports — PLANNED

```text
GET /reports/overview      PLANNED
GET /reports/tickets       PLANNED
GET /reports/agents        PLANNED
GET /reports/sla           PLANNED
```

No route is registered. This is the `feature/reports` contract for `ADMIN`/`MANAGER`: created/resolved volume, status distribution, SLA compliance, average first-response time, agent performance, and customer satisfaction, all from real persisted data with an explicit date-range and timezone definition. `GET /dashboard/overview` (LIVE, below) is an operational snapshot, not the Reports feature. Satisfaction metrics depend on `feature/customer-feedback`. Do not invent fabricated analytics.

## Attachments — PLANNED

No upload or download route is registered. `Attachment` exists in `schema.prisma` with optional `ticketId`, `messageId`, and `customerId` context. `GET /customers/:id` (LIVE) returns customer-level attachment metadata only; there is no way to upload or retrieve file bytes. `feature/attachments` must first resolve: storage provider and Vercel/serverless compatibility, allowed MIME types, maximum file size, upload/download authorization per context, Portal ownership, orphan cleanup, and the absence of malware scanning. See `docs/18-ui-pages-spec.md` and `docs/19-progress-tracking.md` for the decision list. Do not invent the endpoint shape before those decisions.

## Feedback — PLANNED

No route is registered. `Feedback` (`ticketId`, `customerId`, `rating`, `comment?`) exists in `schema.prisma` only. `feature/customer-feedback` must define: eligible ticket statuses (expected `RESOLVED`/`CLOSED`), customer ownership, one feedback record per ticket, rating validation range, optional comment, whether a submission can be updated, Portal UX, and how the rating feeds `GET /reports/*`.

## Notifications — PLANNED

No route is registered. `Notification` (`userId`, `type`, `title`, `message`, `readAt?`) exists in `schema.prisma` only. `feature/notifications` covers in-app notifications and a read/unread workflow. It must distinguish event-driven in-app notifications from SLA request-time derivation and from any scheduled monitoring; serverless scheduling constraints apply.

## Quick Replies — PLANNED

No route is registered. `QuickReply` (`title`, `body`, `createdById`) exists in `schema.prisma` only. `feature/quick-replies` covers management permissions, list/search where practical, and insertion of editable content into the Ticket composer. A quick reply is never sent automatically.

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

Planned Portal additions (no route registered): `GET /portal/knowledge-articles` (published-only read, `feature/knowledge-base`) and `POST /portal/tickets/:id/feedback` (`feature/customer-feedback`).

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

Portal responses exclude priority, assignee, organization, SLA state, SLA targets, SLA deadlines, notes, history, attachments, staff roles/emails, audit data, and escalation semantics. In particular, Portal serializers never expose `slaState`, `effectiveSlaDueAt`, `effectiveSlaTarget`, `firstResponseDueAt`, `firstRespondedAt`, or `resolutionDueAt`.
