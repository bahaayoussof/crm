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

All customer-management routes require an authenticated `ADMIN`, `MANAGER`, or `AGENT`; `CUSTOMER` identities are rejected. Listing supports `search`, `page`, and `limit` query parameters and returns `{ data, meta: { page, limit, total, totalPages } }`. Search covers customer name, email, and phone.

Manual customer creation accepts `{ name, email, phone? }`, normalizes the email, and creates only a CRM `Customer` with `userId = null`; it does not provision authentication credentials. Updates accept only `name`, `email`, and `phone`.

`GET /customers/:id` returns the complete customer-detail representation, including safe linked-user identity fields, ticket counts, last-interaction time, and customer-level attachment metadata. It never includes password hashes. Ticket counts are read-only summary data; Ticket Management remains a separate feature.

`POST /customers` and `PATCH /customers/:id` return the persisted core customer fields (`id`, `name`, `email`, `phone`, `createdAt`, and `updatedAt`). Derived detail fields such as `supportSummary` are not mutation-response fields; clients must invalidate or refetch customer detail after an update rather than replace a full detail cache entry with the mutation response.

```text
GET  /customers/:id/notes
POST /customers/:id/notes
```

Customer notes are internal-only, ordered newest first, and use the authenticated internal user as author. Note creation accepts `{ body }`; arbitrary author IDs are not accepted.

Deletion returns `409 CUSTOMER_HAS_SUPPORT_HISTORY` when the customer has a linked login identity, tickets, feedback, notes, or attachments. Only unlinked customers without related support history can be deleted.

## Tickets

```text
GET    /tickets
GET    /tickets/:id
POST   /tickets
PATCH  /tickets/:id
```

All routes require `ADMIN`, `MANAGER`, or `AGENT`; `CUSTOMER` is rejected. `ADMIN` and `MANAGER` see all tickets. `AGENT` sees assigned and unassigned tickets only. Listing supports server-side `page`, `limit`, `search`, `status`, `priority`, `categoryId`, and `assignedAgentId` filters and uses the standard pagination envelope.

Creation accepts documented ticket fields and defaults channel to `WEB`. Assignment targets must be `AGENT` users. Updates accept only editable ticket fields and enforce the role permissions and transition matrix in `07-ticket-workflow.md`. Workflow timestamps and SLA deadline snapshots are service-owned.

Ticket deletion is intentionally unavailable because tickets are retained as support history.

### Later Ticket Actions

```text
POST /tickets/:id/messages
POST /tickets/:id/notes
POST /tickets/:id/assign
POST /tickets/:id/status
POST /tickets/:id/attachments
GET  /tickets/:id/history
```

For core Ticket Management, history may be included in `GET /tickets/:id`; `GET /tickets/:id/history` may also be implemented as a focused read endpoint. Message, note, and attachment mutations remain outside this branch.

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

## Customer Portal

Portal routes may reuse ticket APIs with customer-scoped authorization rather than duplicate business logic.

## API Rules

- All protected endpoints require authenticated context.
- Authorization is server-side.
- Request bodies and parameters are validated.
- List endpoints should support pagination when practical.
- Ticket list should support filters such as status, priority, category, assignee, and server-side search across the exact ticket ID, subject, description, customer name, and customer email.
- Never trust a customer-provided customerId for access control.
