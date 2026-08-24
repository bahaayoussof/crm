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
