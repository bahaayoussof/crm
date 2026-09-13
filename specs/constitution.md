# Project Constitution

Stable engineering rules for the Customer Support CRM. `AGENTS.md` remains
the authoritative preflight/workflow document and takes precedence if
anything here is out of date; this file, `specs/architecture.md`, and
`specs/domain-model.md` are the canonical source for current system
behavior and constraints — `docs/` is historical/supporting only (see
`docs/README.md`).

## Project Scope & Priorities

Historical context: this system began as a three-day, one-developer,
time-boxed assessment. That constraint is no longer the delivery target.

**Current target (ADR-038):** complete original-assignment coverage, not
just the original three-day P0 loop. The original priority tiers below are
retained as a historical reference for what was built first, not as a
statement of what remains out of scope today — per `specs/features/README.md`'s
feature coverage matrix, effectively all originally-listed product areas
(Knowledge Base, Attachments, Quick Replies, Feedback, Reports, Users
Management, Settings, Notifications, SLA automation, Tasks/Reminders, Team
Collaboration, AI assistance, Email/WhatsApp/SMS channels, Departments/
Branches, Audit Logs) are implemented. A brand-configuration admin surface
(`feature/custom-branding`) and any remaining ERP/generic-external-system
integration are the main areas with no implementation today.

- **P0 (original three-day scope):** authentication, RBAC, customer CRUD,
  ticket CRUD/assignment/priority/category/workflow, ticket conversation +
  internal notes, ticket history, agent dashboard, customer portal core
  journey, basic SLA presentation, responsive UI, English/Arabic + RTL.
- **P1 (should-have, now implemented):** attachments, knowledge base, in-app
  notifications, reports, quick replies, customer feedback.
- **P2/P3 (nice-to-have / architecture-only, now implemented or in
  progress):** AI ticket summary/suggested-reply/categorization/KB
  suggestions, automatic assignment, audit logs, multi-department/
  multi-branch behavior, WhatsApp/SMS/email provider integration.
- **Rule that still applies:** a lower-priority feature must never block
  completion or correctness of a higher-priority one, and no feature may be
  described as working merely because its enum, model, or nav label exists
  — see each `specs/features/<name>/spec.md` for actual implementation
  status.

## Technology Stack

Verified against `client/package.json`, `server/package.json`, and
`README.md` §8–9.

**Frontend** (`client/`):
- React 19, TypeScript 5.9, Vite 7
- React Router 7 (protected + role-scoped routes)
- TanStack Query 5 (server-state cache/invalidation/mutations)
- TanStack Table 8 (CRM data tables)
- React Hook Form 7 + Zod 4 (typed forms matching server schemas)
- Tailwind CSS 4 (styling, full RTL support)
- Axios 1 (HTTP client, auth header injection)
- i18next / react-i18next (EN/AR localization + RTL)
- Lexical (rich text editor). The generic editor UI/insertion primitives
  live in shared infrastructure at
  `client/src/components/shared/rich-text/rich-text-editor.tsx`
  (`RichTextEditor`) — extracted from Tickets after Tickets, Quick
  Replies, and Knowledge Base all came to depend on it. Each consumer
  owns its own behavior on top of the shared component: Tickets owns
  ticket reply/note composition and send behavior, Quick Replies owns
  reusable reply templates, and Knowledge Base owns article body editing
  (`KB-RICH-*` / ADR-057 — a bounded Rich Text set on the same Lexical +
  `sanitize-html` infra, stored as server-sanitized HTML in the existing
  `content` field; legacy plain-text articles still render and are
  lazily converted on edit). See `specs/features/knowledge-base/spec.md`
  "Knowledge Base Rich Text Content" and ADR-057, which supersedes
  ADR-020's "no rich text" consequence.
- Recharts (report charts)
- DOMPurify (sanitize rich HTML before render)
- react-international-phone (phone input)
- Radix UI (Select primitive)
- Vitest + Testing Library (unit/component tests)

**Backend** (`server/`):
- Node.js 20+, Express 5, TypeScript 5.9
- Prisma 6 + PostgreSQL
- jsonwebtoken (JWT), bcrypt (password hashing)
- Zod 4 (request validation)
- Resend (email delivery + inbound email)
- @vercel/blob (attachment storage)
- sanitize-html, busboy (multipart uploads)
- libphonenumber-js (phone normalization for SMS/WhatsApp)
- Vitest + Supertest (unit + HTTP-level API tests)

Do not introduce a technology outside this list without a strong technical
reason and explicit developer approval (see Dependency Policy).

## Architecture Principles

- Reuse existing abstractions before adding new ones — check
  `specs/architecture.md` and `.wolf/anatomy.md` before creating a new
  service, hook, or shared component.
- Authorization is enforced server-side (RBAC + team scope, see
  `specs/features/auth-rbac/spec.md`). Frontend permission hiding is UX
  convenience only, never a security boundary.
- Domain services own business rules; Prisma is the only thing that touches
  PostgreSQL directly.
- Realtime events publish only after the producing transaction commits (see
  `specs/features/realtime/spec.md`).
- Follow the existing route → auth/RBAC → Zod validation → controller →
  service → Prisma flow (`specs/architecture.md` Backend Architecture) for
  new backend endpoints.
- Follow the existing page → feature hooks → TanStack Query → Axios flow
  (`specs/architecture.md` Frontend Architecture) for new frontend data
  access; do not duplicate server state in local component state.
- Avoid large unrelated refactors during a scoped feature or fix.

## Dependency Policy

Per `AGENTS.md` "Dependency Control": do not add, remove, replace, or
upgrade runtime or dev dependencies unless the task explicitly requires it
or the existing stack genuinely cannot implement the requirement. Explain
why before adding anything. Do not modify lockfiles incidentally.

## Validation

- Backend: Zod schemas validate request body/params/query at the route
  boundary before controllers run, via generic `validateBody`/
  `validateQuery`/`validateParams` middleware.
- Frontend: React Hook Form + Zod schemas validate forms, generally
  mirroring the server's validation shape.
- Do not add ad-hoc validation that bypasses these established boundaries.

## API Conventions

Cross-cutting conventions every endpoint follows (full per-endpoint
behavior lives in the owning `specs/features/<name>/spec.md`, not here):

- **Envelope:** success responses are `{ "data": ... }`, optionally with
  `{ "meta": { page, limit, total, totalPages } }` for paginated list
  endpoints (`skip = (page - 1) * limit`). Errors are
  `{ "error": { "code": "SOME_CODE", "message": "..." } }` — one shape,
  never a second error format per module.
- **Auth header:** `Authorization: Bearer <jwt>` on every protected route;
  missing auth is `401`, a currently-disallowed role is `403`.
- **404 concealment:** a resource that exists but is outside the caller's
  authorized scope returns the same `404` as a genuinely missing resource
  (e.g. another agent's ticket, another customer's attachment) — existence
  is never leaked through a `403` vs `404` distinction.
- **Dates/times:** ISO 8601 timestamps, UTC. Reporting/date-bucketed
  endpoints bucket by UTC day and echo `timezone: "UTC"` explicitly rather
  than assuming a client timezone.
- **Validation errors:** a Zod `safeParse` failure at the route boundary is
  a structured `400 VALIDATION_ERROR`; unknown/extra fields in a strict
  schema are rejected, not silently ignored.

## Definition of Done

A feature is not complete because the happy-path UI renders. Before
reporting a task complete:

- behavior matches the owning spec (or the explicit task instruction, for
  work with no dedicated `specs/features/` package)
- TypeScript has no relevant errors; lint is clean
- request/input validation exists at the boundary
- backend authorization exists wherever required — never UI-only
- loading, empty, error, and success states are all handled (frontend work)
- responsive behavior is checked (frontend work)
- no secrets committed; no unrelated refactor bundled in
- relevant tests added/updated when valuable; relevant docs/spec files
  updated (see `specs/features/README.md` "After implementation")
- the actual verification commands were run and their real pass/fail
  reported — see Testing / Verification below

Before hand-off, report: feature, branch, files changed, behavior
implemented, tests/checks actually run, known limitations, and a suggested
commit message. Never commit/merge/push (see Git Rules).

## Localization

- Two supported languages: English (default/fallback) and Arabic, via
  i18next; translations live under `client/src/locales/` (`en` / `ar`).
- Document direction (`dir`) is driven off the selected language at the
  document root, not per-component state (see ADR-007 in
  `specs/decisions.md`).
- Technical/directional values (emails, phone numbers, URLs, IDs) need
  explicit LTR isolation inside Arabic/RTL layouts even when surrounding
  text is RTL.
- New user-facing strings require both `en` and `ar` entries — do not ship
  English-only copy.

## Accessibility / UI Consistency

- Follow `.agents/skills/design-taste-frontend/SKILL.md` for visual/UX
  decisions where it doesn't conflict with this file — it is advisory and
  does not override project specs.
- Reuse existing shared UI primitives (`client/src/components/`) instead of
  hand-rolled equivalents; the codebase treats ad-hoc styled cards vs.
  shared design-system primitives as a real quality axis (see
  `.wolf/cerebrum.md` Do-Not-Repeat entries on portal redesign work).
- Product design direction (durable, project-specific — not generic
  styling advice): clean, neutral, compact-but-readable, information-dense
  where agents need it, calm. Avoid heavy gradients, glassmorphism,
  oversized shadows, decorative 3D, neon colors, and excessive animation.
  Status/priority must never depend on color alone — always pair with text
  or an icon.
- The internal CRM favors dense tables/lists (TanStack Table, ADR-008) over
  large card grids for ticket/customer browsing; the Customer Portal is
  deliberately simpler/less dense than the internal CRM.
- Dropdowns use the shared `AppSelect`/`AppSelectField` system built on
  `@radix-ui/react-select`; there is no toast/snackbar library — the
  notification pattern is a persistent bell dropdown plus inline
  `role="alert"`/`role="status"` banners (see `specs/architecture.md`
  Review Notes). Icons are Lucide, consistently.
- Minimum accessibility bar: semantic HTML, keyboard-accessible interactive
  elements, visible focus indicators, proper labels, sufficient color
  contrast, accessible dialogs/dropdowns/form errors.
- RTL is a first-class requirement, not a late pass: logical CSS properties,
  no hard-coded left/right assumptions, and technical values (emails,
  phone numbers, URLs, IDs) stay LTR-isolated inside Arabic/RTL layouts even
  though the document direction is `rtl`.

## Testing / Verification

Minimum verification available in this repo, run from the relevant package
(or repo root to fan both out) per `README.md` §15 and `AGENTS.md`
"Completion":

- `npm run typecheck`
- `npm run lint`
- `npm test` (Vitest; Supertest for backend HTTP-level tests)
- `npm run build`

Not every command is meaningful for every change (e.g. a docs-only change
does not require `npm test`), but implementation tasks should run whichever
of these apply and report actual pass/fail.

**Verification categories** (use the precise term — they are not
interchangeable, and this repo's history has real cases of each):

- **Unit / integration (Vitest, both packages):** the default, cheapest,
  most-run tier. Backend integration tests typically run through Supertest
  at the HTTP layer with a mocked Prisma client, not a real database.
- **Frontend component (Vitest + Testing Library):** renders real
  components; mocks network/query state.
- **Authz / security tests:** role-matrix and ownership-boundary coverage
  (missing/invalid/expired auth, cross-team/cross-customer isolation,
  IDOR-safe `404`s) — treated as a first-class category in this repo, not
  an afterthought; see the Gaps/Findings sections of individual
  `specs/features/*/spec.md` files for the standard this repo holds itself
  to.
- **Manual / live-runtime verification:** an actual running server +
  browser, a real disposable PostgreSQL instance, or a real external
  provider (Resend/Meta/TextBee/the AI provider). This is the tier most
  often *not* performed in an agent session (no browser, no disposable DB,
  no live credentials available in most environments).

**The rule that matters most:** never claim live runtime, database, or
external-provider verification occurred unless it actually did, in this
session, with reproducible evidence (command output, not a description of
what "should" happen). If a check was not run, say so explicitly — "not
verified in this environment" is the correct and expected answer far more
often than not, and prior audits in this repo (see `specs/decisions.md`
history and the feature `tasks.md` files) show this distinction catching
real gaps. Do not silently upgrade "reviewed the code" to "verified".

## Git Rules

Per `AGENTS.md` "Git Safety Rules" and "Branch Rule" (authoritative source —
read it in full before any implementation task):

- The AI must NOT commit, push, force-push, merge, rebase, delete branches,
  modify Git history, or run destructive working-tree commands
  (`reset --hard`, `git clean`, discarding `stash`/`restore`) without
  explicit developer approval.
- Every feature/fix/refactor/docs task that changes repository state must
  happen on its own appropriately-named branch, created from an
  up-to-date `master` unless told otherwise — never directly on `master`.
  Small tightly-coupled work may share one branch; unrelated work may not.
- Branch naming: `feature/<short-name>`, `fix/<short-name>`,
  `refactor/<short-name>`, `docs/<short-name>`, `test/<short-name>`.
- Before implementing: inspect the current branch, working-tree status, and
  relevant specs; confirm the requested scope against them.
- At completion: run the relevant checks (Testing / Verification above),
  show a `git diff` summary, list changed files, provide a suggested commit
  message, and stop — the human developer stages, commits, and pushes.
- All commits, pushes, and merges are performed manually by the human
  developer.
