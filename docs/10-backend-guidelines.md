# Backend Guidelines

## Module Pattern

Each domain module should prefer:

```text
module/
├─ routes
├─ controller
├─ service
├─ schema
└─ types
```

Repository files may be added when query complexity justifies them.

## Rules

- Validate params, query, and body.
- Keep controllers thin.
- Keep authorization on the server.
- Keep business rules in services.
- Centralize error handling.
- Do not leak stack traces or database errors.
- Use Prisma transactions when multiple writes must succeed atomically.
- Pagination should have sensible defaults and limits.
- Search/filter logic belongs in backend queries when it affects data volume.

## API Error Shape

Use one consistent shape, for example:

```json
{
  "error": {
    "code": "TICKET_NOT_FOUND",
    "message": "Ticket not found"
  }
}
```

Do not invent a second error format per module.
