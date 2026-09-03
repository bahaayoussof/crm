# Public Demo Environment

The demo is **the same CRM** booted with two extra environment flags. There is
no forked codebase, no mocked UI and no duplicated pages. Auth, RBAC, validation,
ticket workflow, SLA, reports, realtime, the customer portal and EN/AR + RTL all
behave exactly as in development/production. Only three things change, all gated
behind `config/demo.ts` (server) and `lib/demo.ts` (client):

1. **Outbound provider transports are simulated** at their adapter boundary —
   WhatsApp, SMS and Email. The local `TicketMessage`, ticket history,
   notifications and realtime events are still written; only the network call to
   Meta / TextBee / Resend is skipped, and no provider credentials are required.
2. **The four seeded demo accounts are protected** from destructive mutation, and
   departments/teams cannot be deleted.
3. **AI actions run under a tight per-user rate limit** (6 / 30 min instead of
   20 / 10 min). With no `AI_API_KEY` the endpoints return the normal graceful
   `AI_NOT_CONFIGURED`.

When `DEMO_MODE` is unset or `false`, every helper is inert and the application is
byte-for-byte the same as before.

---

## Enabling demo mode

| Where | Variable | Value |
| --- | --- | --- |
| Server (Vercel project `server`) | `DEMO_MODE` | `true` |
| Server | `DATABASE_ENV` | `demo` (only consulted by `demo:reset`) |
| Client (Vercel project `client`) | `VITE_DEMO_MODE` | `true` (build-time) |

`GET /api/health` returns `{ "status": "ok", "demo": true }` when the server flag
is on — a non-secret way to confirm the deployment.

---

## Local demo commands — `server/.env.demo`

The isolated demo database and the demo-only flags live in **`server/.env.demo`**,
kept strictly separate from `server/.env` (normal local development). It is
git-ignored (`server/.env.demo.example` is committed with placeholders).

Only three npm scripts load it, and they load it **automatically** — no
`$env:DEMO_MODE="true"` / `export DATABASE_ENV=demo` and no copying over `.env`:

| Command (run from `server/`) | Loads `.env.demo` | Action |
| --- | --- | --- |
| `npm run db:demo:deploy` | yes | `prisma migrate deploy` against the demo DB (never `migrate dev` / `migrate reset`) |
| `npm run demo:seed` | yes | additive public-demo seed |
| `npm run demo:reset` | yes | three-signal-guarded TRUNCATE + reseed |

`npm run dev`, `npm start` and `npm run db:deploy` are **unchanged** — they use the
normal `server/.env` loading and never read `.env.demo`.

### How it loads

Each demo script's first import is `scripts/load-demo-env.js`
(`scripts/demo-env.ts`), which runs before `dotenv/config` and
`src/config/env.ts`:

1. Reads `server/.env.demo` (path resolved from the script, not the cwd). **If the
   file is missing it aborts** with
   `Demo environment file not found: server/.env.demo` — no fall back to
   `server/.env` / the development database.
2. Applies every key, **overriding** any stale shell export, so
   `DATABASE_URL`, `DATABASE_ENV`, `DEMO_MODE`, `JWT_SECRET` are taken from
   `.env.demo`. `DEMO_RESET_CONFIRM` is the one key it refuses to read from the
   file (stripped with a warning).
3. Validates `DEMO_MODE=true`, `DATABASE_ENV=demo`, `DATABASE_URL` present —
   otherwise aborts. The existing in-script guards (`assertDemoEnv`,
   `assertDemoResetAllowed`) still run on top.

### Env precedence for demo commands

| Variable | Comes from |
| --- | --- |
| `DATABASE_URL` | `server/.env.demo` (overrides shell + `.env`) |
| `DATABASE_ENV` | `server/.env.demo` (must be `demo`) |
| `DEMO_MODE` | `server/.env.demo` (must be `true`) |
| `JWT_SECRET` | `server/.env.demo` |
| `DEMO_RESET_CONFIRM` | **the invoking shell / CI only** — never `.env.demo` |

The deployed Vercel app is unaffected: it reads its variables from Vercel Project
Settings and never loads `.env.demo`.

### First-time local setup

```bash
# from server/
Copy-Item .env.demo.example .env.demo      # PowerShell   (cp on macOS/Linux)
# edit .env.demo: DATABASE_URL = isolated Neon demo pooled URL, JWT_SECRET = new random 32+ chars
npm run db:demo:deploy
npm run demo:seed
```

---

## Demo accounts

Seeded by `npm run demo:seed`. Credentials are **public by design**.

| Role | Email | Password |
| --- | --- | --- |
| ADMIN | `admin@demo.local` | `Demo123!` |
| MANAGER | `manager@demo.local` | `Demo123!` |
| AGENT | `agent@demo.local` | `Demo123!` |
| CUSTOMER | `customer@demo.local` | `Demo123!` |

`@demo.local` matches the existing seed convention (`crm.local`) and passes the
project's `zod` `.email()` validation on both sides. Passwords are stored with the
application's normal `bcrypt` hashing (cost 12) — there is **no auth bypass**. The
login page shows a single "Demo Accounts" card: four compact rows (role label,
`…@demo.local` email, "Use account" button) with subtle dividers, and one shared
`Demo123!` password section at the bottom. Every "Use account" button calls the
real `/auth/login` endpoint through the normal `login()` flow (real JWT, real
role redirect); credentials are shown for anyone who prefers to type them into
the main form. The card renders only when `VITE_DEMO_MODE=true`.

The demo manager is made the manager of the first seeded team; the demo agent is
a member of that team. The demo customer owns six hand-written support scenarios
(see below).

### What is protected (backend-enforced, `middleware/demo-guard.ts`)

For the four demo accounts, in demo mode only, the API returns
`403 DEMO_PROTECTED_RESOURCE`:

- changing email, password or name (`PATCH /auth/change-password`,
  `PATCH /auth/profile`, `PATCH /users/:id`)
- changing role / deactivating (`PATCH /users/:id`)
- password-reset requests for a demo email are silently no-ops (still returns the
  generic success — no account-enumeration signal)

Structural deletes are blocked in demo mode for **all** rows:

- `DELETE /departments/:id`, `DELETE /teams/:id` → `403 DEMO_PROTECTED_RESOURCE`

Everything else stays interactive: create/edit tickets, ticket messages, internal
notes, status / priority / assignment changes, tasks, customers, KB articles,
quick replies.

---

## Provider simulation

| Channel | Demo behaviour | Production behaviour |
| --- | --- | --- |
| **WhatsApp** | `whatsapp.client.sendTextMessage` returns a synthetic `demo-wamid-…` before any Graph API call. No access token needed. | Unchanged — real Graph API call, `WHATSAPP_NOT_CONFIGURED` when unset. |
| **SMS / TextBee** | `getSmsProvider()` returns `demoSmsProvider`, which returns `demo-sms-…`. TextBee is never imported or called; no API key / device needed. | Unchanged — `textBeeProvider`, 20 s timeout, `SMS_NOT_CONFIGURED` when unset. |
| **Email (ticket replies)** | `email.client.sendTicketEmail` returns a synthetic `demo-email-…` before any Resend call. | Unchanged — real Resend send, timeout handling, `EMAIL_NOT_CONFIGURED` when unset. |
| **Email (transactional: password reset, etc.)** | `getEmailProvider()` forces the log transport — message is written to the server log, never sent. | Unchanged — Resend when configured, log transport otherwise. |
| **AI** | Same code path, but `aiRateLimit` is 6 requests / 30 min per user. No key → `AI_NOT_CONFIGURED` message in the panel (no crash, no leaked config). | 20 requests / 10 min per user. |

The simulation is at the **integration boundary**, so `deliverOutboundSmsReply`,
`deliverOutboundWhatsappReply` and the email reply path still commit the message,
write ticket history, fire notifications and emit realtime events — the demo
shows the *complete* conversation workflow, not a frontend fake.

---

## Seed data

`npm run demo:seed` runs the full `seedTestData()` baseline (deterministic RNG,
seed `42`) and then layers the demo accounts and scenarios on top:

- ~44 internal users (4 ADMIN incl. `admin@demo.local`, 6 MANAGER, 35 AGENT), 5
  seeded teams across 5 departments / branches
- ~190 customers (incl. `customer@demo.local`)
- ~393 tickets — all statuses, all priorities, all 5 channels, spread across the
  previous ~30–180 days so dashboard/report charts are meaningful
- ticket conversations (10–14 messages on the busiest tickets), internal notes,
  ticket history, SLA first-response/resolution timestamps
- ~107 tasks, ~63 KB articles, ~47 quick replies, ~412 audit logs, ~85
  notifications, CSAT feedback on resolved tickets
- **6 hand-written demo-customer scenarios** with realistic multi-message threads
  and internal notes: *Payment authorization failed*, *Unable to access account
  after email change*, *Refund status request*, *Delivery address update*,
  *Verification code not received*, *Mobile app crashes after login* — one per
  status (`OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `RESOLVED`, `CLOSED`,
  `ESCALATED`), spread over the last ~26 days, all channels, all priorities,
  assigned to the demo agent inside the demo manager's team.

Dashboard and report numbers come entirely from this seeded data through the
existing APIs — nothing is hard-coded in the frontend.

---

## Demo reset

`DATABASE_URL` / `DATABASE_ENV` / `DEMO_MODE` come from `server/.env.demo`
(loaded automatically). Only the reset confirmation is passed at run time:

```powershell
# PowerShell — from server/
$env:DEMO_RESET_CONFIRM="RESET_DEMO_DATABASE"
npm run demo:reset
Remove-Item Env:DEMO_RESET_CONFIRM
```

```bash
# macOS / Linux / CI — from server/
DEMO_RESET_CONFIRM=RESET_DEMO_DATABASE npm run demo:reset
```

`demo:reset`:

1. **Refuses to run** unless **all three** explicit signals are set
   (`config/demo.ts#evaluateDemoResetGuard`):
   - `DEMO_MODE=true`
   - `DATABASE_ENV=demo`
   - `DEMO_RESET_CONFIRM=RESET_DEMO_DATABASE`

   The guard is **independent of `NODE_ENV`** on purpose: the hosted demo runs
   `NODE_ENV=production`, so the old `NODE_ENV !== "production"` rule made the real
   demo database impossible to reseed. Safety now comes from three deliberate
   signals that no development or production environment ever sets together — a
   single fat-fingered flag can no longer wipe a real database.
2. `TRUNCATE`s every application table (`RESTART IDENTITY CASCADE`) — schema and
   `_prisma_migrations` are untouched. **No `prisma migrate reset`.**
3. Re-runs `demo:seed` (baseline + demo accounts + scenarios).

`demo:seed` on its own is additive (upserts accounts, recreates the six
demo-customer scenarios) and only requires `DEMO_MODE=true`. The shared
`seedTestData()` still refuses `NODE_ENV=production` **unless** the process is
pointed at the isolated demo database (`DEMO_MODE=true` + `DATABASE_ENV=demo`), so
a deliberate hosted-demo reseed works while a plain production seed of a real
database stays blocked.

There is **no HTTP reset endpoint** — reset is a script/CI operation only. The
existing internal cron endpoints (`/api/internal/sla-monitor`,
`/api/internal/task-reminders`, `/api/internal/live-chat-inactivity`) are
unchanged and still protected by `CRON_SECRET`; they are simply no longer
triggered automatically (see below).

---

## Vercel deployment (Hobby-compatible)

Two independent Vercel projects, same GitHub monorepo, matching the repo layout.
Neither application moves out of its directory.

| Project | Root Directory | Framework | Build command | Output / entry |
| --- | --- | --- | --- | --- |
| `client` | `client` | Vite (auto-detected) | `npm run build` (`tsc -b && vite build`) | `dist/` (static SPA) |
| `server` | `server` | Other (no framework) | `prisma generate` (from `server/vercel.json`) | `api/index.ts` serverless function |

### Server: serverless entrypoint

- `server/api/index.ts` re-exports the Express `app` from `server/src/app.ts`
  (`import app from "../src/app.js"; export default app;`). One app, one router
  tree, one middleware chain — nothing is re-declared.
- `server/vercel.json` rewrites `"/(.*)"` → `"/api"` so every request hits that
  one function, sets `buildCommand: "prisma generate"` (Prisma Client must be
  generated at build; **not** regenerated per request), and
  `functions["api/index.ts"].maxDuration: 60`.
- `npm run dev` / `npm start` still run the persistent Node server
  (`src/server.ts`, `app.listen`) locally and on any non-Vercel host. Importing
  `app.ts` or `api/index.ts` never starts a listener.
- `api/index.ts` is transpiled by `@vercel/node`; the `src → dist` `tsc` build is
  unused by Vercel and kept only for the persistent host. `npm run typecheck`
  covers `api/` through `server/tsconfig.vercel.json`.

### Client: SPA deep-link routing

`client/vercel.json` adds a single catch-all rewrite to `/index.html`. Vercel
serves real build assets (`/assets/*`, `/favicon.svg`, …) from the filesystem
before rewrites, so only unknown paths fall through to the SPA shell. Direct
navigation / refresh works on `/login`, `/dashboard`, `/tickets`,
`/tickets/:id`, `/customers`, `/reports`, `/portal`, etc. The client project has
no `/api` route (the API is the separate `server` project), so nothing is
excluded from the rewrite.

### API base URL

The client calls the API via `VITE_API_URL` (axios `baseURL` in
`services/api-client.ts`, and the SSE URL in `realtime/realtime-provider.tsx`).
The Express router mounts every route under `/api/...`, so `VITE_API_URL` must
**include** `/api`:

```
VITE_API_URL = https://<server-vercel-domain>/api
```

Client request paths are written without the prefix (`/auth/login`,
`/tickets`, …) — no `/api/api`, no missing `/api`.

### Health check

`GET https://<server-domain>/api/health` → `{ "status": "ok", "demo": true }`
when `DEMO_MODE=true`. No secrets or config are exposed. Use it as the first
post-deploy check.

### Cron change

`server/vercel.json` previously declared **three** Vercel Cron jobs on
`*/5 * * * *` (`/api/internal/sla-monitor`, `/api/internal/task-reminders`,
`/api/internal/live-chat-inactivity`). Vercel **Hobby** only allows cron
invocations **once per day**, so that configuration fails to deploy on Hobby.

`server/vercel.json` now contains **no `crons` array** — the frequent triggers
are removed. The endpoints and all SLA / task-reminder / live-chat-inactivity
business logic are **fully intact** and can still be called manually or wired to
an external scheduler (any HTTPS pinger sending
`Authorization: Bearer <CRON_SECRET>`). The public demo does not need automatic
5-minute background execution to demonstrate the product; SLA state is visible
from the seeded `firstResponseDueAt` / `resolutionDueAt` values and the SLA UI.

### CORS

`CLIENT_URLS` (comma-separated) — or single `CLIENT_URL` — on the server must
list **exactly** the deployed demo frontend origin(s), e.g.
`https://crm-demo-bahaa.vercel.app`. The decision is the pure
`app.ts#isOriginAllowed`:

- a request with no `Origin` (curl, server-to-server) is allowed;
- `localhost` / loopback is allowed **only** when `NODE_ENV !== "production"` — so
  local dev needs no config, but the hosted demo does not trust localhost;
- every other origin must appear verbatim in `CLIENT_URLS` / `CLIENT_URL`.

No `*`. **No `.vercel.app` wildcard** — a Vercel *preview* deployment URL is not
trusted automatically; add the specific preview origin to `CLIENT_URLS` if you
need CORS from a preview build. Auth is a bearer `Authorization` header (not
cookies), so credentialed CORS is not required; `OPTIONS` preflight is handled by
the `cors` middleware and returns the matching `Access-Control-Allow-Origin`.

### Realtime

The SSE endpoint (`GET /api/realtime/events`) is unchanged. On Vercel serverless
each invocation is bounded by `maxDuration`, so the stream is force-closed at that
limit and the client auto-reconnects (functional, slightly less smooth). For a
fully persistent stream, run the server as a persistent Node service. See
`docs/22-realtime-events.md`.

---

## Environment variables

### Client Vercel project (`client`)

**Required**

| Variable | Value | Notes |
| --- | --- | --- |
| `VITE_API_URL` | `https://<server-domain>/api` | build-time; **must include** `/api` |
| `VITE_DEMO_MODE` | `true` | build-time; enables the demo login panel + banner |

### Server Vercel project (`server`)

**Required**

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://…` — isolated **Neon demo** database | never the dev/prod DB |
| `DATABASE_ENV` | `demo` | tags the connection; consulted by seed + reset guards |
| `DEMO_MODE` | `true` | turns on demo mode |
| `JWT_SECRET` | 32+ char random | production startup refuses the dev default |
| `CLIENT_URL` **or** `CLIENT_URLS` | exact demo frontend origin(s) | CORS allow-list; `CLIENT_URLS` is comma-separated |

**Optional**

| Variable | Value | Notes |
| --- | --- | --- |
| `APP_URL` | demo frontend origin | absolute links in emails; defaults to `CLIENT_URL` |
| `CRON_SECRET` | 32+ char random | only if you wire an external pinger to `/api/internal/*` |
| `DEMO_RESET_CONFIRM` | `RESET_DEMO_DATABASE` | **do not set in the Vercel project.** Set it only in the shell/CI at the moment you run `npm run demo:reset` |
| `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET`, `EMAIL_INBOUND_ADDRESS` | — | not required — Email transport is simulated in demo |
| `WHATSAPP_*` | — | not required — WhatsApp transport is simulated |
| `TEXTBEE_*` | — | not required — SMS transport is simulated |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | — | leave unset → AI endpoints return `AI_NOT_CONFIGURED` gracefully |
| `BLOB_READ_WRITE_TOKEN` | — | set only if you want working attachment upload/download; unset → `503 STORAGE_UNAVAILABLE` |

`NODE_ENV=production` is set by Vercel automatically and is **compatible with**
`DEMO_MODE=true` — the only production startup assertion is `JWT_SECRET` +
`DATABASE_URL`; no external-provider credential is ever required to boot.

Never commit real secret values; `.env.example` files carry placeholders only.

---

## First deployment — empty Neon + empty Vercel → working public demo

1. **Neon:** create a new project (or a dedicated branch) for the **demo**
   database. It must not be a dev/prod database. Copy its pooled connection
   string.
2. Locally, in `server/`: `Copy-Item .env.demo.example .env.demo` (or `cp`), then
   set `DATABASE_URL=<neon demo pooled URL>` and a new random `JWT_SECRET` in it
   (`DATABASE_ENV=demo` / `DEMO_MODE=true` are already there). Then:
   ```bash
   npm run db:demo:deploy   # prisma migrate deploy against the demo DB — no reset
   npm run demo:seed
   ```
   Both load `server/.env.demo` automatically. `demo:seed` prints a ✓ line per
   demo account confirming the bcrypt hash verifies.
3. **Vercel — server project:** New Project → import the repo → **Root
   Directory = `server`** → Framework = *Other*. Add the **required** server env
   vars above (`DATABASE_URL` = the Neon demo string, `DATABASE_ENV=demo`,
   `DEMO_MODE=true`, `JWT_SECRET`, and a placeholder `CLIENT_URL` for now).
   Deploy.
4. **Verify the server:** open
   `https://<server-domain>/api/health` → expect `{ "status": "ok", "demo": true }`.
5. **Vercel — client project:** New Project → same repo → **Root Directory =
   `client`** → Framework = *Vite* (auto). Set `VITE_API_URL =
   https://<server-domain>/api` and `VITE_DEMO_MODE = true`. Deploy.
6. **Wire CORS:** set the server project's `CLIENT_URL` (or `CLIENT_URLS`) to the
   exact client domain from step 5, e.g. `https://crm-demo-bahaa.vercel.app`.
   Redeploy the server project (env change).
7. **Smoke test:** open the client URL → the demo login panel shows one
   "Demo Accounts" card with four role rows (each showing role, `…@demo.local`
   email and a "Use account" button) plus one shared-password section
   (`Demo123!`). Log in as each of ADMIN / MANAGER / AGENT / CUSTOMER. Check the
   dashboard, a ticket detail, reports, and `/portal`. Refresh on a nested route
   (`/tickets/<id>`) — it must load, not 404. Confirm the "Demo Environment"
   banner renders.
8. **Later — custom domain:** see below.

### Re-seeding the live demo

From a trusted machine / CI with `server/.env.demo` configured (Neon demo
`DATABASE_URL`, `DATABASE_ENV=demo`, `DEMO_MODE=true`):

```bash
# from server/ — reset confirmation is passed at run time, not stored in .env.demo
DEMO_RESET_CONFIRM=RESET_DEMO_DATABASE npm run demo:reset      # macOS / Linux / CI
```
```powershell
$env:DEMO_RESET_CONFIRM="RESET_DEMO_DATABASE"; npm run demo:reset; Remove-Item Env:DEMO_RESET_CONFIRM
```

No redeploy needed — the serverless function picks up the new data on the next
request.

### Custom domain (e.g. `crm-demo.bahaa.qzz.io`)

The app is domain-agnostic; only env values change. When attaching a custom
frontend domain:

- **client:** add the domain in Vercel; if the API domain is unchanged,
  `VITE_API_URL` stays as-is.
- **server:** add the new frontend origin to `CLIENT_URL` / `CLIENT_URLS`
  (replace or comma-append), update `APP_URL` to the new frontend origin, then
  redeploy the server.
- If the **server** also gets a custom domain, update the client's
  `VITE_API_URL` to `https://<new-api-domain>/api` and redeploy the client.

Nothing in application code references a hard-coded domain.

---

## Security

The demo is a normally-authenticated app. Not changed for the demo: JWT auth,
RBAC, server-side authorization, Zod validation, CORS restrictions, password
hashing, audit logging. No admin endpoint is made public, no role escalation is
possible, no password hash or env var is exposed. The demo-account protection and
structural-delete blocks are **added** guard rails, enforced on the backend — not
disabled frontend buttons.
