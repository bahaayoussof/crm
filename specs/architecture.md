# Architecture

Verified against `server/`, `client/`, `server/prisma/schema.prisma`,
`README.md`, and `docs/02-architecture.md` / `docs/06` / `docs/07` /
`docs/08` / `docs/09` / `docs/22`. Citations are `path:line` where useful;
see `## Review Notes` at the end for discrepancies found during this audit.

## Repository Layout

```text
client/src/
├── app/          router (protected + role/audience guards), layouts, providers
├── components/   ui/ (hand-rolled design-system primitives) + shared/ (data-table, charts, file-upload...)
├── features/     one folder per domain (api.ts + hooks.ts + schemas.ts + pages + tests, colocated)
├── locales/      en/, ar/ translation JSON (kept in lockstep)
├── services/     single axios instance (api-client.ts)
└── lib/          i18n, language/RTL sync, theme, utils

server/src/
├── config/       Zod-validated env, Prisma client singleton
├── middleware/   auth, requireRole, requireActiveUser, requireFreshToken, validate, rate-limit, error-handler
├── shared/       errors, sla derivation, team-scope RBAC helpers, rich-text sanitize, validation fragments
└── modules/      one folder per bounded domain (routes/controller/service/schema/tests colocated)
```

`server/src/modules/`: `auth`, `users`, `customers`, `categories`,
`departments`, `branches`, `teams`, `tickets`, `assignment`,
`sla-automation`, `collaboration`, `notifications`, `realtime`,
`integrations/{email,sms,whatsapp}`, `email` (transactional system email,
distinct from `integrations/email`), `live-chat`, `attachments`,
`knowledge-base`, `quick-replies`, `feedback`, `tasks`, `dashboard`,
`manager`, `reports`, `audit-logs`, `settings`, `ai`, `customer-ai`,
`portal`.

There is no `jobs/`/`schedulers/` folder — background work is exclusively
externally-triggered `POST/GET /api/internal/*` endpoints gated by a static
`CRON_SECRET`, meant to be invoked by an external scheduler (Vercel Cron).
No queue library (bull/bullmq/agenda) and no in-process cron library exist.

## Frontend Architecture

- **Routing**: `client/src/app/router/app-router.tsx` — public auth routes,
  then two audience gates via `<ProtectedRoute audience="internal"|"customer">`.
  `getRoleHome`/`getProtectedRedirect` (`features/auth/auth-routing.ts`) map
  `CUSTOMER → /portal`, `MANAGER → /manager`, else `/dashboard`, and block
  cross-audience access. Nested per-feature guards (`ManagerRoute`,
  `UserManageRoute`, `CustomerManageRoute`, `TicketEditRoute`,
  `KnowledgeArticleManageRoute`, `QuickReplyManageRoute`, `ReportsRoute`,
  `SettingsRoute`, `AuditLogRoute`) each check a `can<X>(role)` helper and
  redirect on failure — **these are UX conveniences only; the server-side
  RBAC check is the real boundary** (explicitly commented in the guards).
- **API access pattern**: one axios instance (`services/api-client.ts`)
  injects the bearer token and, on a 401, clears it and dispatches a global
  `auth:unauthorized` DOM event. Each feature has a thin `*-api.ts` (one-line
  wrappers unwrapping the `{ data: T }` envelope) and a `*-hooks.ts`
  (TanStack Query hooks with a `<feature>Keys` query-key factory); mutations
  invalidate the relevant keys on success. This `api.ts → hooks.ts` layering
  is consistent across every feature folder.
- **Forms**: React Hook Form + `zodResolver`, with i18n-key validation
  messages (not literal strings) resolved via `t(...)` at render time; native
  inputs use `register()`, non-native controlled inputs (phone, rich text)
  use `<Controller>`. Representative example:
  `client/src/features/customers/customer-form-page.tsx` +
  `customer.schemas.ts`.
- **UI kit / design system**: a small set of hand-rolled primitives under
  `client/src/components/ui/` (button, card, input, table, select, modal,
  badge, sheet, tooltip, action-menu) styled with Tailwind CSS 4 (CSS-first
  config, no `tailwind.config.js`) and a CSS-custom-property token system in
  `index.css`. Only `@radix-ui/react-select` is an actual Radix dependency.
  **This is not a shadcn CLI-generated component set** — see Review Notes.
- **Data tables**: real TanStack Table v8 integration under
  `components/shared/data-table/` (surface, toolbar, search, filters,
  pagination, skeleton, empty state) reused across tickets/customers/users/
  tasks/audit-logs list pages.
- **Notifications UI**: no toast/snackbar library — the pattern is a
  persistent notification bell (`features/notifications/`) fed by the
  backend `Notification` model, plus inline `role="alert"`/`role="status"`
  banners for form/API errors.
- **Realtime on the client**: a hand-rolled authenticated SSE client over
  raw `fetch` + `ReadableStream` (`features/realtime/realtime-client.ts`),
  not native `EventSource` (which cannot carry an `Authorization` header)
  and not socket.io. Exponential backoff with jitter, `Last-Event-ID`
  resume, and a hard stop (no retry) on 401/403. Mounted once around the
  whole route tree via `RealtimeProvider`; a dropped stream never blocks
  the UI — REST + TanStack Query remain the source of truth.
- **Rich text**: Lexical-based composer for ticket replies/notes and
  knowledge-base article bodies, with DOMPurify sanitizing rendered HTML on
  the client (server also sanitizes on write — see Backend).
- **i18n / RTL**: i18next, two languages (`en`, `ar`) with translation files
  kept in lockstep. Document `lang`/`dir` are synced at the document root
  off the persisted language choice (`crm-language` in `localStorage`), so
  Tailwind logical-property utilities (`ms-`, `me-`, `text-start`, etc.)
  flip automatically; technical values (emails, phone numbers) are forced
  `dir="ltr"` even inside Arabic layouts. Self-hosted Inter + Cairo fonts
  split by `unicode-range` so no JS font-switch is needed.
- **Customer portal**: `/portal/*` routes — overview, ticket list, new
  ticket, ticket detail (reply thread), profile, knowledge base browsing —
  plus a globally-mounted floating **Support Widget** (AI chat + human Live
  Chat) rendered by the portal's `AppShell` on every portal page, not a
  separate dedicated route. `/portal/live-chat` and `/portal/support` are
  intentional compatibility redirects into the widget.

## Backend Architecture

Request flow (`README.md` §9, verified): **Route → Auth/RBAC → Zod
validation → Controller (thin) → Domain service → Prisma → side effects**.

- **Routing**: Email/SMS/WhatsApp webhook routes are mounted with
  `express.raw()` **before** the global JSON body parser in `app.ts`, so the
  exact raw body is available for provider signature verification.
  Everything else uses `express.json()`.
- **Auth**: JWT (`jsonwebtoken`), 8-hour expiry, payload carries only `role`
  (subject = user id), issued in `auth.service.ts` with `bcrypt` (cost 12)
  password hashing. `requireAuth` middleware resolves and attaches
  `request.auth` from `Authorization: Bearer <token>`; it is wired
  per-router, not globally. **Freshness is not enforced everywhere**: a
  demoted/deactivated user keeps their old JWT-embedded role until it
  expires, *except* on the customer-portal router (`requireFreshToken`, a
  DB re-check) and the User Management admin router
  (`requireActiveUser`, which also overwrites `request.auth.role` from a
  fresh DB read). This is a documented, intentional scope limit, not a bug
  — see `docs/06-auth-rbac.md`.
- **RBAC**: `requireRole(...)` middleware does the coarse per-router role
  allowlist. Fine-grained ticket rules live in service code:
  `ticket-visibility.ts` builds role-scoped Prisma `where` predicates
  (ADMIN unrestricted; MANAGER scoped to their team; AGENT scoped to
  own-assigned-or-unassigned within their team);
  `enforceMutationPermissions()` restricts AGENT PATCHes to
  `status`/`priority` on self-assigned tickets only; AGENT is blocked from
  any transition into/out of `ESCALATED`. Team-scoped logic is centralized
  in `server/src/shared/team/team-scope.ts` and reused everywhere rather
  than duplicated per module.
- **Validation**: Zod schemas colocated per module (`<module>.schema.ts`),
  wired through generic `validateBody`/`validateQuery`/`validateParams`
  middleware that `safeParse`s and throws a structured `400
  VALIDATION_ERROR` `AppError` on failure. Environment configuration itself
  is Zod-validated at boot, with an additional guard that refuses to start
  in `NODE_ENV=production` with a default/dev `JWT_SECRET` or
  `DATABASE_URL`.
- **Domain services / side effects**: services own workflow rules and use
  Prisma transactions when multiple rows must change together. Side effects
  — `TicketHistory` rows, a separate general-purpose `AuditLog`, in-app
  `Notification` rows, and a realtime event — are written inside the same
  transaction as the primary change; **realtime events are only published
  after the transaction commits** (an `AsyncLocalStorage`-based outbox in
  `realtime.publisher.ts` buffers events during the transaction and flushes
  post-commit, so clients never observe a phantom pre-rollback event).
- **Outbound channel delivery is commit-first**: for WhatsApp/Email/SMS
  replies, the `TicketMessage` is persisted (and its realtime event queued)
  *before* the provider call; a provider failure after commit does not roll
  back the message — it records a `<CHANNEL>_DELIVERY_FAILED` history entry
  instead, so a customer-visible reply is never silently lost to a
  transient provider outage (ADR-052).

## Important Runtime Flows

### Authentication

```text
Client → POST /api/auth/login → Zod validate credentials
       → auth.service.login (bcrypt.compare) → 8h JWT (role in payload, sub = user id)
       → frontend stores token, axios attaches Authorization header
       → GET /auth/me re-reads current profile (rejects tokens issued before passwordChangedAt)
```

### Ticket Creation

```text
Client / webhook (Email|WhatsApp|SMS) → route → auth/signature check
       → Zod validate → ticket.service.createTicket
       → resolve/create Customer → snapshot SLA deadlines from active SlaRule(priority)
       → auto-assign (if teamId routed) via the single canonical assignment engine
       → TicketHistory(TICKET_CREATED) + Notification + realtime event (post-commit)
```

### Ticket Conversation

```text
Customer / Agent → POST message (portal or internal route)
       → conversation mutation-access check (AGENT must be the assignee)
       → persist TicketMessage in a transaction
       → stamp firstRespondedAt if still null (first public agent reply only)
       → provider delivery for EMAIL/WHATSAPP/SMS channels (commit-first, see above)
       → realtime ticket.message.created event (post-commit)
```

### External Channels

- **Email** — real `resend` SDK; inbound webhook (raw body + signature
  verify) resolves/creates a `Customer` by email and threads via
  `In-Reply-To`/`References`, a per-ticket `emailThreadToken`, or the public
  ticket reference as a fallback.
- **WhatsApp** — real Meta Cloud (Graph) API over `fetch`; webhook
  verification (`GET`) + HMAC signature verification (`POST`); unset
  credentials return a structured `503 WHATSAPP_NOT_CONFIGURED`, not a
  crash.
- **SMS** — real TextBee HTTP API over `fetch` (no SDK), HMAC signature
  verification on inbound, 20s outbound timeout; text-only, no attachments.
- **Live Chat** — **not a separate messaging system.** A live chat is an
  ordinary `Ticket` with `channel = LIVE_CHAT`, reusing `TicketMessage`
  end-to-end. Adds only: department-based team routing at start, and a
  cron-triggered inactivity auto-close sweep.

All three provider integrations are optional at startup — an unset
credential set returns a structured "not configured" error rather than
crashing the server, and the rest of the CRM is unaffected.

## Realtime

Server-Sent Events (SSE), **not** WebSocket/socket.io — no such dependency
exists in either `package.json`. `GET /api/realtime/events` streams frames
written directly with `response.write()`, held in an in-memory (single
process, no Redis pub/sub) subscriber registry. Client uses `fetch` +
`ReadableStream` instead of native `EventSource` so the JWT can ride in the
`Authorization` header, with exponential-backoff reconnect and
`Last-Event-ID` resume.

Four event types: `ticket.message.created`, `ticket.updated`,
`notification.created`, `notification.read`. Authorization mirrors ticket
visibility rules per role (ADMIN all; MANAGER own team; AGENT own-assigned-
or-unassigned; CUSTOMER own tickets/public messages only, never
notifications). Events publish only after the producing transaction
commits and carry identifiers, not full records — clients refetch via REST
for authoritative state.

Known limitation (documented in `docs/22-realtime-events.md`): a long-lived
SSE connection can be force-closed by a serverless platform's max execution
duration; the client's reconnect logic is the mitigation, not a server-side
fix.

## Deployment

Inferable from `vercel.json`, `client/vercel.json`, and `docs/13`: the
client is a Vite SPA (`vercel.json` rewrites all paths to `/index.html`);
the server runs as a Node/Express service invoked by Vercel, with
`prisma generate` as part of `npm run build`. SLA monitoring, live-chat
inactivity close, and task reminders are triggered by Vercel Cron hitting
`/api/internal/*` endpoints authenticated by a static `CRON_SECRET` (not a
product JWT) — there is no in-process scheduler.

## Review Notes

- **UI kit is not shadcn/ui CLI-generated.** If any existing doc describes
  the frontend as using "shadcn/ui" as a drop-in library, correct it: this
  is a small hand-rolled primitive set under `client/src/components/ui/`
  inspired by shadcn conventions, with only `@radix-ui/react-select` as an
  actual Radix dependency (no `class-variance-authority`, no shadcn CLI
  scaffolding).
- **No toast/snackbar system exists.** The notification pattern is a
  bell dropdown (`features/notifications/`) plus inline alert banners — not
  a toast library. Any doc assuming toasts should be corrected.
- **`AuditLog` is a fully implemented, separate model from `TicketHistory`**
  and is actively written across many services. `docs/06-auth-rbac.md`
  (line 78) still frames a dedicated audit log beyond `TicketHistory` as an
  open/unresolved question — code has moved ahead of that doc; it should be
  updated to reflect that `AuditLog` already exists.
- **Escalation-notification audience wording is inconsistent between
  docs.** `docs/06-auth-rbac.md` states escalation alerts go to every
  active ADMIN plus only the ticket's *own team* manager (team-scoped,
  post-ADR-050). `docs/08-sla-automation.md`'s automation section describes
  it more broadly as "active ADMIN/MANAGER users" without repeating the
  team-scoping qualifier. The code (`sla-automation.service.ts`) implements
  the team-scoped version — `docs/06` is accurate; `docs/08`'s phrasing on
  this specific point is stale and should be reconciled.
- **`docs/23-sms-integration.md` is far shorter (~29 lines) than the
  WhatsApp/Email docs (~150–200 lines) despite SMS having equally complete
  code** (provider, signature verification, config, full webhook + outbound
  flow, dedicated tests). Treat SMS as a fully implemented channel, not a
  minor one, regardless of its thin doc.
- **No dedicated `migrate` npm script** exists in `server/package.json`
  (only `prisma:generate`, `seed:test`). If `docs/13-deployment.md` implies
  an `npm run migrate` script, that could not be verified in code — this
  should be checked directly against `docs/13` and the actual deploy
  process before relying on it.
- **Realtime is confirmed SSE, never WebSocket/socket.io**, and there is no
  queue or in-process scheduler library anywhere in the backend — background
  work is entirely externally-triggered `/api/internal/*` HTTP endpoints.
  Any future spec assuming an in-process cron/queue would be inventing new
  architecture and needs explicit developer approval first.
