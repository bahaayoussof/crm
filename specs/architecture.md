# Architecture

Verified against `server/`, `client/`, `server/prisma/schema.prisma`, and
`README.md`. Citations are `path:line` where useful; see `## Review Notes`
at the end for discrepancies found during the original audit pass.

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

## Module / Folder Boundary Conventions

Durable placement rules — check these before creating a new top-level
directory, not just a new file:

- **Top level stays `client/`, `server/`, `docs/`, `specs/`.** Do not
  introduce `apps/`, `packages/`, `frontend/`, `backend/`, `api/`, or `web/`
  without an explicit developer decision recorded in `specs/decisions.md`.
  No monorepo tooling (Nx/Turborepo/Lerna); npm workspaces are acceptable
  only if they meaningfully simplify the setup.
- **`client/src/app/`** — router, providers, and layouts only; no
  domain/business components here.
- **`client/src/components/ui/`** — reusable low-level primitives
  (button, card, input, table, select, modal, badge, sheet, tooltip,
  action-menu). Not ticket/customer-specific.
- **`client/src/components/shared/`** — cross-feature application
  components (data-table, charts, file-upload, rich-text editor, page
  header/empty/error states). Only move a component here once it is
  genuinely shared by more than one feature — see the Rich Text extraction
  precedent (`rich-text-editor.tsx`, moved out of Tickets once Quick
  Replies and Knowledge Base both depended on it).
- **`client/src/features/<name>/`** — one folder per domain, colocating
  `*-api.ts` (thin axios wrappers), `*-hooks.ts` (TanStack Query hooks +
  `<feature>Keys` factory), pages, schemas, and tests. Do not preemptively
  create every subfolder — only when the feature actually needs it.
- **`client/src/services/`** — application-wide infrastructure only (the
  one shared axios instance). Domain API calls belong in their feature's
  `*-api.ts`, not a global services folder.
- **`client/src/types/`** — only genuinely cross-feature frontend types;
  feature-specific types stay inside the feature.
- **`server/src/modules/<name>/`** — one folder per bounded backend domain,
  colocating routes/controller/service/schema/tests. Add a repository file
  only when query complexity actually justifies one — do not scaffold one
  for every module by default.
- **`server/src/shared/`** — only genuinely cross-domain backend utilities
  (errors, SLA derivation, team-scope helpers, rich-text sanitize,
  validation fragments). Avoid turning this into a dumping ground.
- **`server/prisma/`** — `schema.prisma`, `migrations/`, `seed.ts` are all
  tracked in Git; migrations are never edited after the fact.
- Before creating a new directory: check whether an existing documented
  location fits, prefer feature-local code for domain-specific behavior,
  avoid new top-level folders, and avoid duplicating an existing pattern. A
  feature task is not permission to restructure the repository.

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
- **Rich text**: the generic Lexical-based editor UI/insertion primitives
  are shared infrastructure at `client/src/components/shared/rich-text/
  rich-text-editor.tsx` (`RichTextEditor`), with DOMPurify sanitizing
  rendered HTML on the client (server also sanitizes on write — see
  Backend). It was extracted out of Tickets (where it originated as
  `TicketReplyEditor`) once Quick Replies and Knowledge Base also came to
  depend on it. Ownership on top of the shared component stays per
  consumer: Tickets owns ticket reply/note composition and send behavior
  (`specs/features/tickets/spec.md`); Quick Replies owns reusable reply
  templates and composer insertion (`specs/features/quick-replies/`);
  Knowledge Base owns article body editing. Knowledge Base article bodies
  use a **bounded Rich Text** model since `KB-RICH-*` / ADR-057: a Lexical
  editor (V1 set — paragraphs, H2/H3, bold/italic/underline, lists, links,
  undo/redo) on the same `sanitize-html` + DOMPurify infrastructure,
  stored as **server-sanitized HTML in the existing `content` field**,
  rendered through a shared client-re-sanitizing `<ArticleContent>` guard
  on both the internal and portal detail views. A deterministic plain-text
  projection is stored in an additive nullable `contentText` column and
  drives search, the portal excerpt, and AI grounding. **Legacy
  plain-text articles keep rendering unchanged** (`whitespace-pre-wrap` +
  `dir="auto"`, no `dangerouslySetInnerHTML`) via a content-shape sniff,
  and are lazily converted to sanitized HTML the first time they are
  re-edited — no destructive migration. ADR-057 supersedes ADR-020's "no
  rich text" consequence; the KB-AUDIT audit behavior is unchanged (no
  article body in `AuditLog`).
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
  — see `specs/features/auth-rbac/spec.md`.
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

Known limitation (documented in `specs/features/realtime/spec.md`): a
long-lived SSE connection can be force-closed by a serverless platform's
max execution duration; the client's reconnect logic is the mitigation, not
a server-side fix.

## Deployment

Inferable from `vercel.json` and `client/vercel.json`: the client is a Vite
SPA (`vercel.json` rewrites all paths to `/index.html`); the server runs as
a Node/Express service invoked by Vercel, with `prisma generate` as part of
`npm run build`. Database is managed PostgreSQL (Neon in this project's
deployments). SLA monitoring, live-chat inactivity close, and task
reminders are triggered by Vercel Cron hitting `/api/internal/*` endpoints
authenticated by a static `CRON_SECRET` (not a product JWT) — there is no
in-process scheduler.

### Cron jobs (`server/vercel.json`)

| Path | Schedule | Auth | Idempotent |
| --- | --- | --- | --- |
| `/api/internal/sla-monitor` | `*/5 * * * *` | `Authorization: Bearer $CRON_SECRET` | Yes — guarded `updateMany`, batch-bounded (100/100) |
| `/api/internal/task-reminders` | `*/5 * * * *` | same | Yes — `remindedAt` bookmark + guarded `updateMany` |
| `/api/internal/live-chat-inactivity` | `*/5 * * * *` | same | Yes — re-runs the same predicate as a conditional `updateMany` |

`CRON_SECRET` must be ≥ 32 chars, distinct from `JWT_SECRET`, server-side
only. An unset secret makes these endpoints fail closed (`503`) rather than
run unauthenticated — automation is simply off, not open.

### Environment variable boundary

- **Frontend (`client/`):** only `VITE_API_URL` (the API origin for Axios
  + the realtime SSE stream). No secret of any kind belongs behind a
  `VITE_*` variable — anything with that prefix ships to the browser bundle.
- **Backend (`server/`), required for a real deployment:** `DATABASE_URL`
  (Postgres), `JWT_SECRET` (≥ 32 chars, unique — see the production-secrets
  startup guard below), `CLIENT_URL`/`CLIENT_URLS` (CORS allowlist),
  `APP_URL` (absolute link base for emails).
- **Backend, optional per integration** (every one of these is designed to
  degrade to a structured "not configured" response rather than crash the
  server or block unrelated functionality — see External Provider
  Architecture below): `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`,
  `RESEND_API_KEY`/`RESEND_WEBHOOK_SECRET`/`EMAIL_INBOUND_ADDRESS`/
  `EMAIL_FROM`/`EMAIL_FROM_NAME`, `WHATSAPP_ACCESS_TOKEN`/
  `WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_VERIFY_TOKEN`/`WHATSAPP_APP_SECRET`/
  `WHATSAPP_API_VERSION`, `TEXTBEE_API_KEY`/`TEXTBEE_DEVICE_ID`/
  `TEXTBEE_BASE_URL`/`TEXTBEE_WEBHOOK_SECRET`, `AI_PROVIDER`/`AI_API_KEY`/
  `AI_MODEL`/`AI_TIMEOUT_MS`.
- **Production secret guard:** at boot, `NODE_ENV=production` with an
  unset or still-default `JWT_SECRET`/`DATABASE_URL` throws immediately
  (`assertProductionSecretsConfigured` in `config/env.ts`) rather than
  silently running with a publicly-known signing key. Dev/test are
  unaffected.
- Never commit secrets; `.env.example` in each package documents the
  required variable names with placeholder values only.

### External Provider Architecture

Every external integration is optional at startup and isolated behind its
own adapter module under `server/src/modules/integrations/` (Email,
WhatsApp, SMS) or a dedicated module (`attachments` for Vercel Blob, `ai`/
`customer-ai` for the AI provider) — an unset credential set returns a
structured `<X>_NOT_CONFIGURED` error only when that specific integration
is invoked; the rest of the CRM is unaffected. Full inbound/outbound
business behavior for each channel is owned by
`specs/features/conversations-channels/spec.md`, not repeated here.

| Provider | Purpose | Webhook path | Verification |
| --- | --- | --- | --- |
| Resend (Email) | Outbound send + inbound receiving | `POST /api/integrations/email/webhook` | `svix-*` headers over the raw body via the Resend SDK's `webhooks.verify()` |
| Meta WhatsApp Cloud API | Outbound send + inbound webhook | `GET`/`POST /api/integrations/whatsapp/webhook` | `GET`: `hub.verify_token` constant-time compare. `POST`: `X-Hub-Signature-256` HMAC-SHA256 over the raw body |
| TextBee Cloud (SMS) | Outbound send + inbound webhook | `POST /api/integrations/sms/webhook` | `X-Signature` HMAC-SHA256 over the raw body, `timingSafeEqual` |
| Vercel Blob | Private attachment storage | — (direct SDK calls, no webhook) | `BLOB_READ_WRITE_TOKEN`, server-side only |
| AI provider (OpenRouter first adapter) | Ticket AI Assistant + Customer AI | — (outbound `fetch` only) | `AI_API_KEY`, server-side only |

All three messaging-provider webhook routes are mounted with
`express.raw()` **before** the global `express.json()` parser in `app.ts`
so the exact raw body bytes are available for signature verification —
this ordering must never move. Local development for a webhook-based
provider needs a public HTTPS tunnel (e.g. `ngrok`) pointed at the
matching `/api/integrations/<channel>/webhook` path; production needs a
real public HTTPS API domain. Provider secrets are never logged, never
returned in an API response, and never exposed to the frontend build.

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
  and is actively written across many services (reconciled 2026-09-09).
  `specs/features/auth-rbac/spec.md` documents the two trails and their
  `ADMIN`-only read path; it is not an open question.
- **Escalation-notification audience** (reconciled 2026-09-09): every
  active `ADMIN` plus only the escalated ticket's own-team manager,
  `ADMIN`-only for an unrouted ticket — which is what
  `sla-automation.service.ts` implements and what
  `specs/features/sla-automation/spec.md` documents.
- **No dedicated `migrate` npm script** exists in `server/package.json`
  (only `prisma:generate`, `seed:test`) — deploy runs
  `prisma migrate deploy` directly; do not assume an `npm run migrate`
  script exists.
- **Realtime is confirmed SSE, never WebSocket/socket.io**, and there is no
  queue or in-process scheduler library anywhere in the backend — background
  work is entirely externally-triggered `/api/internal/*` HTTP endpoints.
  Any future spec assuming an in-process cron/queue would be inventing new
  architecture and needs explicit developer approval first.
