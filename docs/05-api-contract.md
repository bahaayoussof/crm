# API Contract

Base path:

```text
/api
```

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

## Users

```text
GET    /users
GET    /users/:id
POST   /users
PATCH  /users/:id
GET    /users/agents
```

`GET /users/agents` is an internal-only Ticket Management lookup that returns safe summaries of `AGENT` users. It never returns password hashes or customer identities.

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
POST /tickets/:id/assign
POST /tickets/:id/status
POST /tickets/:id/attachments
GET  /tickets/:id/history
```

For core Ticket Management, history is included in `GET /tickets/:id`; `GET /tickets/:id/history` may also be implemented as a focused read endpoint. Assignment, status, and attachment action endpoints remain outside this branch because existing ticket updates own the implemented assignment and status behavior.

## Knowledge Base

```text
GET    /knowledge-articles
GET    /knowledge-articles/:id
POST   /knowledge-articles
PATCH  /knowledge-articles/:id
DELETE /knowledge-articles/:id
```

## Reports

```text
GET /reports/overview
GET /reports/tickets
GET /reports/agents
GET /reports/sla
```

## Dashboard

```text
GET /dashboard/overview
```

`GET /dashboard/overview` requires `ADMIN`, `MANAGER`, or `AGENT`; `CUSTOMER` is rejected. `ADMIN` and `MANAGER` receive metrics and tickets across all internal tickets. `AGENT` visibility remains tickets assigned to that agent plus unassigned tickets, matching Ticket Management visibility. This scope continues to govern metrics, status distribution, and recent tickets. The AGENT primary queue is intentionally narrower and contains only active tickets assigned to the authenticated agent.

The standard `{ data }` envelope contains `metrics`, real counts grouped in `statusDistribution`, `primaryQueueType`, at most 10 `primaryTickets`, at most 8 `recentTickets`, and `generatedAt`. `primaryQueueType` is `NEEDS_ATTENTION` for `ADMIN`/`MANAGER` and `MY_ASSIGNED_TICKETS` for `AGENT`. Dashboard ticket items expose only identifier, subject, status, priority, update time, effective SLA deadline/state, safe customer summary, and safe assignee summary.

For `ADMIN` and `MANAGER`, `primaryTickets` preserves Needs Attention ordering by SLA breach, urgent priority, SLA risk, high priority, unassigned state, oldest relevant update, and final identifier tie-breaker. For `AGENT`, it excludes unassigned, other-agent, `RESOLVED`, and `CLOSED` tickets and orders active assigned work by breached SLA, at-risk SLA, priority from urgent through low, oldest update, and final identifier tie-breaker. Recent tickets exclude every primary Ticket ID before applying the eight-item limit, then use `updatedAt` descending and identifier ascending across the remaining role-visible records.

Active metrics include `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`, and `ESCALATED`, excluding `RESOLVED` and `CLOSED`. `assignedToMe` always means active tickets assigned to the authenticated user. `resolvedToday` uses the current UTC calendar day. SLA state is derived at read time according to `08-sla-automation.md`; no derived state is persisted.

## Customer Portal

Portal routes may reuse ticket APIs with customer-scoped authorization rather than duplicate business logic.

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

Portal responses exclude priority, assignee, organization, SLA, notes, history, attachments, staff roles/emails, audit data, and escalation semantics.
