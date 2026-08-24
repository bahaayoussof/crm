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
```

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

Customer detail responses include safe linked-user identity fields, ticket counts, last-interaction time, and customer-level attachment metadata. They never include password hashes. Ticket counts are read-only summary data; Ticket Management remains a separate feature.

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
DELETE /tickets/:id
```

### Ticket Actions

```text
POST /tickets/:id/messages
POST /tickets/:id/notes
POST /tickets/:id/assign
POST /tickets/:id/status
POST /tickets/:id/attachments
GET  /tickets/:id/history
```

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
- Ticket list should support filters such as status, priority, category, assignee, and search.
- Never trust a customer-provided customerId for access control.
