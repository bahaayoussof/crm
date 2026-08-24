# Repository Folder Structure

This project uses a simple `client` / `server` structure optimized for a short, time-boxed assessment.

The goal is to keep the repository easy to understand, fast to work with, and free from unnecessary monorepo tooling.

```text
/
├─ client/
│  ├─ src/
│  │  ├─ app/
│  │  │  ├─ router/
│  │  │  ├─ providers/
│  │  │  └─ layouts/
│  │  │
│  │  ├─ components/
│  │  │  ├─ ui/
│  │  │  └─ shared/
│  │  │
│  │  ├─ features/
│  │  │  ├─ auth/
│  │  │  ├─ customers/
│  │  │  ├─ tickets/
│  │  │  ├─ dashboard/
│  │  │  ├─ knowledge-base/
│  │  │  ├─ reports/
│  │  │  ├─ users/
│  │  │  └─ portal/
│  │  │
│  │  ├─ hooks/
│  │  ├─ lib/
│  │  ├─ locales/
│  │  │  ├─ en/
│  │  │  └─ ar/
│  │  │
│  │  ├─ services/
│  │  ├─ types/
│  │  ├─ utils/
│  │  ├─ main.tsx
│  │  └─ index.css
│  │
│  ├─ public/
│  ├─ .env.example
│  ├─ package.json
│  ├─ tsconfig.json
│  └─ vite.config.ts
│
├─ server/
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  ├─ migrations/
│  │  └─ seed.ts
│  │
│  ├─ src/
│  │  ├─ config/
│  │  ├─ middleware/
│  │  ├─ modules/
│  │  │  ├─ auth/
│  │  │  ├─ users/
│  │  │  ├─ customers/
│  │  │  ├─ tickets/
│  │  │  ├─ knowledge-base/
│  │  │  ├─ reports/
│  │  │  ├─ sla/
│  │  │  └─ ai/
│  │  │
│  │  ├─ shared/
│  │  │  ├─ errors/
│  │  │  ├─ types/
│  │  │  └─ utils/
│  │  │
│  │  ├─ app.ts
│  │  └─ server.ts
│  │
│  ├─ uploads/
│  │  └─ .gitkeep
│  │
│  ├─ .env.example
│  ├─ package.json
│  └─ tsconfig.json
│
├─ docs/
│  ├─ 00-project-overview.md
│  ├─ 01-scope-and-priorities.md
│  ├─ 02-architecture.md
│  ├─ 03-folder-structure.md
│  ├─ 04-database-design.md
│  ├─ 05-api-contract.md
│  ├─ 06-auth-rbac.md
│  ├─ 07-ticket-workflow.md
│  ├─ 08-sla-automation.md
│  ├─ 09-frontend-guidelines.md
│  ├─ 10-backend-guidelines.md
│  ├─ 11-ai-features.md
│  ├─ 12-testing-strategy.md
│  ├─ 13-deployment.md
│  ├─ 14-implementation-plan.md
│  ├─ 15-feature-branch-workflow.md
│  ├─ 16-definition-of-done.md
│  ├─ 17-decisions-log.md
│  └─ 18-ui-pages-spec.md
│
├─ AGENTS.md
├─ .gitignore
├─ package.json
└─ README.md
```

## Frontend Structure Rules

### `client/src/app`

Application-level configuration only.

Examples:

* router
* providers
* authenticated layouts
* portal layout
* global application initialization

Do not place domain/business components directly inside `app`.

### `client/src/components/ui`

Reusable low-level UI primitives.

Primarily:

* shadcn/ui components
* project-wide primitive wrappers when justified

Do not place ticket/customer-specific components here.

### `client/src/components/shared`

Cross-feature application components.

Examples:

* `PageHeader`
* `EmptyState`
* `ErrorState`
* `ConfirmDialog`

Only move a component here when it is genuinely shared.

### `client/src/features`

Business features live here.

Each feature should colocate its related UI and logic where practical.

Example:

```text
features/
└─ tickets/
   ├─ components/
   ├─ hooks/
   ├─ services/
   ├─ schemas/
   ├─ types/
   └─ utils/
```

Do not create every subfolder preemptively.

Create them only when the feature actually needs them.

### `client/src/services`

Reserved for application-wide service infrastructure.

Examples:

* Axios client
* generic API configuration

Domain API calls should preferably remain inside their feature.

Example:

```text
features/tickets/services/tickets-api.ts
```

rather than placing every API function into one global services folder.

### `client/src/types`

Only cross-feature frontend types belong here.

Feature-specific types remain inside the corresponding feature.

### `client/src/locales`

Translation resources:

```text
locales/
├─ en/
└─ ar/
```

The frontend architecture must remain compatible with both LTR and RTL layouts.

---

## Backend Structure Rules

### `server/src/config`

Infrastructure configuration.

Examples:

* environment parsing
* database configuration
* CORS configuration

### `server/src/middleware`

Cross-cutting Express middleware.

Examples:

* authentication
* authorization helpers
* error handling
* request validation helpers

Feature-specific middleware should remain near the feature where practical.

### `server/src/modules`

Backend business domains.

Recommended module structure:

```text
modules/
└─ tickets/
   ├─ ticket.routes.ts
   ├─ ticket.controller.ts
   ├─ ticket.service.ts
   ├─ ticket.schema.ts
   └─ ticket.types.ts
```

Additional files such as repositories may be introduced only when query complexity justifies them.

Do not automatically create repository classes for every feature.

### Request Flow

Preferred flow:

```text
Route
  ↓
Middleware
  ↓
Validation
  ↓
Controller
  ↓
Service
  ↓
Prisma
  ↓
PostgreSQL
```

Controllers should remain thin.

Business logic belongs in services.

### `server/src/shared`

Only genuinely cross-domain backend utilities belong here.

Examples:

```text
errors/
types/
utils/
```

Avoid turning `shared` into a dumping ground.

---

## Prisma

Prisma lives inside:

```text
server/prisma/
```

The following should be tracked in Git:

```text
schema.prisma
migrations/
seed.ts
```

Database migrations must not be ignored.

The project uses PostgreSQL.

Do not introduce SQLite as the primary implementation unless explicitly approved.

---

## Root `package.json`

A root `package.json` may be used to simplify development commands for both applications.

For example, it may provide commands for:

```text
dev
dev:client
dev:server
build
test
lint
typecheck
```

The root package must not introduce unnecessary monorepo frameworks.

Do not add:

```text
Nx
Turborepo
Lerna
```

for this assessment.

npm workspaces or another lightweight package-manager workspace mechanism may be used only when it meaningfully simplifies the setup.

---

## Shared Client/Server Types

Do not create a `packages/shared` package during initial project setup.

For the current assessment, frontend and backend types may remain in their respective applications.

If substantial schema/type duplication becomes a real maintenance problem later, a shared package may be introduced only after:

1. documenting the reason,
2. updating this document,
3. recording the architectural decision in `17-decisions-log.md`.

Do not create shared infrastructure speculatively.

---

## Top-Level Folder Rule

The intended top-level application structure is:

```text
client/
server/
docs/
```

Do not introduce alternative structures such as:

```text
apps/
packages/
frontend/
backend/
api/
web/
```

without explicit developer approval and a documented architectural decision.

---

## AI Rule

The AI must follow this folder structure when creating new code.

Before creating a new directory:

1. check whether an existing documented location fits,
2. prefer feature-local code for domain-specific behavior,
3. avoid new top-level folders,
4. avoid duplicate architecture patterns.

The AI must not restructure the repository during feature implementation unless explicitly requested.

A feature task is not permission to refactor the entire repository.
