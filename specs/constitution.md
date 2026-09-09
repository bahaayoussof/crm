# Project Constitution

Stable engineering rules for the Customer Support CRM. This summarizes and
points at `AGENTS.md` and `docs/` rather than restating them in full —
`AGENTS.md` remains the authoritative preflight document and takes
precedence if anything here is out of date.

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
- Lexical (rich text editor for replies + KB articles)
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
  `docs/06-auth-rbac.md`). Frontend permission hiding is UX convenience
  only, never a security boundary.
- Domain services own business rules; Prisma is the only thing that touches
  PostgreSQL directly.
- Realtime events publish only after the producing transaction commits.
- Follow the existing route → auth/RBAC → Zod validation → controller →
  service → Prisma flow (`README.md` §9) for new backend endpoints.
- Follow the existing page → feature hooks → TanStack Query → Axios flow
  (`README.md` §8) for new frontend data access; do not duplicate server
  state in local component state.
- Avoid large unrelated refactors during a scoped feature or fix.

## Dependency Policy

Per `AGENTS.md` "Dependency Control": do not add, remove, replace, or
upgrade runtime or dev dependencies unless the task explicitly requires it
or the existing stack genuinely cannot implement the requirement. Explain
why before adding anything. Do not modify lockfiles incidentally.

## Validation

- Backend: Zod schemas validate request body/params/query at the route
  boundary before controllers run (`docs/05-api-contract.md`,
  `docs/10-backend-guidelines.md`).
- Frontend: React Hook Form + Zod schemas validate forms, generally mirroring
  the server's validation shape (`docs/09-frontend-guidelines.md`).
- Do not add ad-hoc validation that bypasses these established boundaries.

## Localization

- Two supported languages: English (default/fallback) and Arabic, via
  i18next; translations live under `client/src/locales/` (`en` / `ar`).
- Document direction (`dir`) is driven off the selected language at the
  document root, not per-component state (see ADR-007 in
  `docs/17-decisions-log.md`).
- Technical/directional values (emails, phone numbers, URLs, IDs) need
  explicit LTR isolation inside Arabic/RTL layouts even when surrounding
  text is RTL.
- New user-facing strings require both `en` and `ar` entries — do not ship
  English-only copy.

## Accessibility / UI Consistency

- Follow `docs/09-frontend-guidelines.md` and
  `.agents/skills/design-taste-frontend/SKILL.md` for visual/UX decisions —
  the latter is advisory and does not override project docs.
- Reuse existing shared UI primitives (`client/src/components/`) instead of
  hand-rolled equivalents; the codebase treats ad-hoc styled cards vs.
  shared design-system primitives as a real quality axis (see
  `.wolf/cerebrum.md` Do-Not-Repeat entries on portal redesign work).

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
of these apply and report actual pass/fail — never claim a check passed
without running it.

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
- All commits, pushes, and merges are performed manually by the human
  developer.
