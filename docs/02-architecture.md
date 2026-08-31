# Architecture

## High-Level Architecture

```text
React Application
       |
       | HTTP / REST
       v
Node.js + Express API
       |
       v
Service Layer
       |
       v
Prisma ORM
       |
       v
PostgreSQL
```

## Realtime Signalling (additive, `feature/realtime-events`)

```text
Domain service commit
        |
   realtimePublisher.emit*()   (transport-neutral; buffered until tx commits)
        |
   SSE transport  --event: crm-event-->  one per-tab authenticated stream
        |
   frontend handler  -->  TanStack Query invalidate / refetch
        |
   UI updates without reload
```

REST + Prisma + PostgreSQL remain authoritative; SSE only tells clients which
query to refetch. Transport detail lives only in `modules/realtime/`. See
`docs/22-realtime-events.md`.

## Frontend Data Flow

```text
Page / Feature Component
        |
        v
Feature Hook
        |
        v
TanStack Query Mutation / Query
        |
        v
API Service
        |
        v
Axios Client
        |
        v
REST API
```

## Backend Request Flow

```text
Route
  |
Middleware
  |
Validation
  |
Controller
  |
Service
  |
Prisma
  |
Database
```

## Architectural Rules

- Controllers stay thin.
- Business logic belongs in services.
- Database access should not be spread through controllers.
- Authorization must be enforced on the backend.
- API request data must be validated.
- Frontend server state belongs in TanStack Query.
- Avoid putting server data into global client state.
- Global client state is reserved for UI/session concerns that genuinely require it.
- Feature code should remain colocated where practical.

## Deployment Boundary

Frontend and API are separate logical applications even if deployed under compatible Vercel infrastructure.

## Out of Scope Architecture

Do not introduce:
- microservices
- event buses
- CQRS
- GraphQL
- Redis
- Kafka
- container orchestration

unless explicitly requested later.
