# Final QA & Production Readiness Audit

> File numbered `24-` because `docs/20-final-qa-production-readiness.md` was the
> requested name but `20-` is already taken by `20-whatsapp-integration.md`.
> This is the "docs/20 final QA" artifact the audit task asked for.

Audit branch: `test/final-qa-production-readiness` (off `master` `935c91e`).
Date: 2026-09-02. No commit / push performed.

---

## 1. Executive Summary

**Overall status: READY WITH FIXES.**

Automated system integrity is strong. The whole automated quality gate
(TypeScript, ESLint, unit/integration tests, production build) is green on both
packages after this audit. Authorization, team isolation, customer isolation,
ticket workflow, automatic assignment, and realtime audience routing were
reviewed at the code level and are sound. Two real defects were found and fixed
(a broken server ESLint gate; a shipped development JWT/DB fallback that could
reach production). One HIGH workflow-correctness inconsistency in the SLA-monitor
cron is documented with a concrete fix but not implemented here (it needs its own
branch and a test rewrite; it is not a data-isolation issue).

Not verified in this environment (no browser, no disposable database, no live
provider credentials): the multi-role browser matrix, a fresh-database migration
run, and live Email / WhatsApp / SMS / AI provider behavior.

| Metric | Count |
| --- | --- |
| Release recommendation | **READY WITH FIXES** |
| Blockers | 0 |
| High-risk findings | 0 open (SEC/WF-1 SLA cron team-scoping **RESOLVED** on `fix/sla-team-scoped-assignment`) + outstanding manual verification (live providers, fresh DB, browser matrix) |
| Medium-risk findings | 4 |
| Low / info findings | 4 |
| Bugs fixed during audit | 2 |

---

## 2. Verification Matrix

| Area | Automated | Manual | Result | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| Server TypeScript | Yes | – | PASS | `npm --prefix server run typecheck` → exit 0 | |
| Server ESLint | Yes | – | PASS (was FAIL) | `npm --prefix server run lint` → exit 0 | Pre-existing 2 errors in `scripts/verify-login.ts` fixed this audit |
| Server tests | Yes | – | PASS | `vitest run` → **854 passed / 48 files** | 845 at audit time (+6 `env.test.ts`); +9 more from the SEC/WF-1 `sla-automation.test.ts` rewrite |
| Client TypeScript | Yes | – | PASS | `npm --prefix client run typecheck` → exit 0 | |
| Client ESLint | Yes | – | PASS | `npm --prefix client run lint` → exit 0 | 2 pre-existing `react-refresh/only-export-components` **warnings** (non-failing) |
| Client tests | Yes | – | PASS | `vitest run` → **767 passed / 64 files** | |
| Client production build | Yes | – | PASS | `tsc -b && vite build` → exit 0 | Pre-existing single-chunk >500 kB warning (`index-*.js` ≈ 2.12 MB / 606 kB gzip) |
| `git diff --check` | Yes | – | PASS | exit 0 | |
| RBAC / role gates | Yes | – | PASS (code review + tests) | `middleware/auth.ts`, per-module route guards, `docs/06` | Backend middleware authoritative; verified by module test suites |
| Team isolation (MANAGER/AGENT) | Yes | – | PASS (code review + tests) | `shared/team/team-scope.ts`, `tickets/ticket-visibility.ts` | Query-level scoping; cross-team id → 404 (no existence leak) |
| Customer isolation (Portal) | Yes | – | PASS (code review + tests) | `portal/portal.service.ts` (`customerIdFor` + `{ id, customerId }` on every query) | IDOR-safe; no client `customerId`/email in authz |
| Automatic assignment engine | Yes | – | PASS (code review + tests) | `modules/assignment/*`, `assignment.test.ts` | Team-scoped, race-safe, never overwrites, never infers a team |
| Automatic assignment — SLA cron path | Yes | – | PASS (was PARTIAL) | `sla-automation.service.ts` `assignUnassignedTickets`, `sla-automation.test.ts` | SEC/WF-1 fixed on `fix/sla-team-scoped-assignment`: cron is now a candidate finder that skips `teamId = null` and delegates to canonical `autoAssignTicket(tx, …)`; dept/branch no longer used |
| Realtime SSE audience isolation | Yes | – | PASS (code review + tests) | `realtime.service.ts` `canReceive`, `realtime.test.ts` | ADMIN/MANAGER(team)/AGENT(assigned or own-team unassigned)/CUSTOMER(own+public) |
| Realtime transactional safety | Yes | – | PASS | `withRealtimeOutbox` in `realtime.publisher.ts` | Events buffered, flushed only after commit, discarded on throw |
| Webhook signature verification | Yes | – | PASS (code review) | `whatsapp.signature.ts`, `sms.signature.ts`, email integration | HMAC-SHA256 + `timingSafeEqual`; raw body preserved (routers mounted before `express.json()`) |
| Cron endpoint auth | Yes | – | PASS | `sla-automation/sla-automation.auth.ts` | Unset `CRON_SECRET` → 503 (fails closed); bearer compared timing-safe |
| Env / secret configuration | Yes | – | PASS (was risk) | `config/env.ts` + new `env.test.ts` | Dev fallbacks for `JWT_SECRET` / `DATABASE_URL` now rejected at prod startup |
| Database migrations (static) | Yes | – | PASS | `prisma validate` → valid; `prisma-schema.test.ts` passes | 13 ordered additive migrations; safe enum recreation pattern |
| Database migrations (fresh apply) | No | Pending | **NOT VERIFIED** | – | No disposable Postgres; only a shared Neon dev DB (destructive reset prohibited) |
| Live Email (Resend) | No | Pending | **NOT VERIFIED** | – | No credentials; adapter + inbound threading reviewed only |
| Live WhatsApp (Meta) | No | Pending | **NOT VERIFIED** | – | No credentials; verification + signature + idempotency reviewed only |
| Live SMS (TextBee) | No | Pending | **NOT VERIFIED** | – | No credentials/device. Code/API contract review: **PASS** — TextBee signs webhooks with `X-Signature`, HMAC-SHA256 over the raw body using the webhook signing secret, which is exactly what `sms.signature.ts` verifies. Live webhook delivery still unverified until exercised with a real device. |
| Live AI provider | No | Pending | **NOT VERIFIED** | – | Mock provider only in tests; missing-key/timeout/invalid-response paths covered by `ai.test.ts` |
| Attachment blob storage | Partial | Pending | PARTIAL | `attachment.test.ts` (57) | Unset `BLOB_READ_WRITE_TOKEN` → 503; live upload/download to a real private store not exercised here |
| Multi-role browser matrix (EN/AR, RTL, light/dark, responsive) | No | Pending | **NOT VERIFIED** | – | No browser / running stack in this environment |

---

## 3. Role Matrix

Enforcement is server-side (route middleware + query-level `where` scoping);
the client only mirrors it for UX. Verified by code review against `docs/06` and
the per-module test suites; **not** re-verified through a live browser session.

| Persona | Intended scope | Enforcement reviewed | Result |
| --- | --- | --- | --- |
| **ADMIN** | Organization-wide: dashboard, tickets, customers, users, teams, departments, branches, reports, tasks, KB, quick replies, settings, audit logs, manager tools, assignment, routing | `requireRole(ADMIN)` on admin routers; no team `where` predicate anywhere; `requireActiveUser` re-reads role/active on `/api/users` | PASS |
| **MANAGER — Team A** | Own team only: team tickets, team agents, Manager Work Console, team reports, team-linked tasks, ticket conversation/attachments/AI for own-team tickets | `resolveActorTeamId` → `{ teamId }` in list/detail/update/assign/conversation/watchers/attachments/AI/tasks/dashboard/reports/`/users/agents`; `assertManagerTicketAccess` → 404 on foreign id; manager with no team → matches nothing | PASS |
| **MANAGER — Team B** | Symmetric to Team A; must not see Team A data via list, detail, direct id, filters, realtime, notifications, reports, task links, attachment downloads, AI context | Same helpers; realtime `canReceive` MANAGER branch = `subscriber.teamId === audience.teamId`; operational notifications keyed on `Ticket.teamId` manager only | PASS |
| **AGENT — Team A** | Assigned tickets (anywhere) + unassigned tickets **within own team**; self-claim only unassigned own-team; status/priority only while assigned; read-only customers; no escalation; no reassignment | `ticketVisibilityWhere` AGENT branch (`assignedAgentId = self` OR unassigned+own-team); `selfAssignTicket` guarded `updateMany(assignedAgentId: null)`; `enforceMutationPermissions` | PASS |
| **AGENT — Team B** | Symmetric; must never see Team A operational data through any surface | Same helpers; realtime AGENT unassigned-queue narrowed to `subscriber.teamId` | PASS |
| **CUSTOMER A** | Own tickets, own conversations (public only), own attachments, own feedback, own live chat, own realtime stream, AI support, published KB | `customerIdFor(userId)` + every portal query ANDed with `customerId`; `portalRouter` = `requireRole(CUSTOMER)`; realtime CUSTOMER branch = own `customerId` + `visibility !== "internal"` | PASS |
| **CUSTOMER B** | Symmetric; guessed ticket/attachment id for Customer A → 404 | Ownership is in the `where`, not a post-hoc check → 404 `TICKET_NOT_FOUND` / `ATTACHMENT_NOT_FOUND` | PASS |

Known intentional exception (documented in `docs/06`): `GET /api/customers/:id/tickets`
(`listCustomerTickets`) returns non-actionable ticket **summaries** for every
ticket of the opened customer regardless of team — `SUMMARY_ONLY`, grants no
detail/conversation/mutation route. Deferred pending a product decision.

---

## 4. Critical Journeys

Each journey was traced through the code paths and their unit/integration tests.
None were executed end-to-end against a running stack + browser.

| Journey | Result | Basis / gaps |
| --- | --- | --- |
| **A — Standard web ticket** (customer create → route → auto-assign → agent reply → realtime to customer → status → resolve → feedback → reports) | **PARTIAL** | Every step has service + test coverage (`portal.service`, `ticket.service`, `assignment.service`, `feedback`, `reports`, realtime outbox). TicketHistory / AuditLog / notifications / SLA fields / assignment history all written in-transaction. Not run through a live browser; realtime delivery to a real client not observed. |
| **B — Live chat** (widget → AI→Live → department → `LIVE_CHAT` ticket → routed → auto-assign → realtime both ways → switch/minimize don't end → End Chat terminates) | **PARTIAL** | `live-chat.service.startLiveChat` resolves team from the customer's most-recent active-team ticket, runs the canonical `autoAssignTicket` in-transaction, emits post-commit. Widget state model (channel switch = presentation only) covered by `customer-ai-widget.test.tsx`. End Chat = `POST /api/portal/live-chat/:id/end` conditional `updateMany`. Live two-way realtime + navigation persistence not browser-verified. |
| **C — AI support** (customer AI chat, published-KB grounding, private KB never exposed, rate limits, malformed provider response, provider failure doesn't crash portal, ticket + live-chat handoff, ownership preserved, no cross-customer context) | **PARTIAL** | `customer-ai-context.ts` queries `status = PUBLISHED` with an explicit `{ id, title, category, content }` projection (test-pinned). Rate limit 20 / 10 min (`customer-ai-rate-limit.ts`). Provider errors normalized to structured `AI_*` codes; failure path handed off, not thrown. Handoff delegates to `portal.createTicket` (customer id server-derived). Live provider NOT VERIFIED. |
| **D — Existing ticket reopened by customer** (reply to WAITING_CUSTOMER / RESOLVED / CLOSED) | **PARTIAL** | `docs/07` matrix: `WAITING_CUSTOMER → IN_PROGRESS`, `RESOLVED → OPEN` (clears `resolvedAt`), `CLOSED → 409 TICKET_CLOSED`. Implemented atomically with the message in `portal.service.reply` + covered by ticket/portal tests. Notification recipients use `customerReplyNotificationRecipientIds` (narrow: assignee + team manager + watchers; admin fallback only when empty). Not browser-verified. |

---

## 5. Integration Status

| Integration | Mock / automated | Live-provider | Notes |
| --- | --- | --- | --- |
| **Email (Resend)** | Adapter, inbound webhook threading, dedup, customer match, ticket create/reuse, outbound-in-transaction rollback — covered by `integrations/email/email.test.ts` | **NOT VERIFIED** | Requires `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_INBOUND_ADDRESS`, `EMAIL_FROM`. Signature = Svix headers over raw body (reviewed). Managed `*.resend.app` inbound enables dev; production needs a verified domain. |
| **WhatsApp (Meta Cloud API)** | GET verify-token (constant-time), POST `X-Hub-Signature-256` HMAC, idempotency via external message id, phone match, ticket reuse/create, outbound reply, `WHATSAPP_DELIVERY_FAILED` history — `integrations/whatsapp/whatsapp.test.ts` | **NOT VERIFIED** | Requires `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`. Unset → 503. Webhook URL: `https://<api-domain>/api/integrations/whatsapp/webhook`, subscribe `messages` field only. |
| **SMS (TextBee)** | Outbound send, inbound webhook, `X-Signature` HMAC, idempotency by `smsId`, customer match, ticket create/reuse, rollback on provider failure, attachments intentionally unsupported — `integrations/sms/sms.test.ts` | **NOT VERIFIED (live)** | Requires `TEXTBEE_API_KEY`, `TEXTBEE_DEVICE_ID`, `TEXTBEE_WEBHOOK_SECRET`. Code/API contract review: **PASS** — current TextBee docs confirm webhook requests carry `X-Signature` = HMAC-SHA256 of the raw request body keyed by the webhook signing secret, which matches `sms.signature.ts`. Only live delivery from a real TextBee device remains unverified. |
| **AI provider** | Missing key → `AI_NOT_CONFIGURED`; unsupported `AI_PROVIDER` → disabled, no crash; timeout, invalid response, rate limit → structured codes; per-user bucket — `modules/ai/ai.test.ts` (47), `customer-ai/customer-ai.test.ts` | **NOT VERIFIED** | Requires `AI_PROVIDER` (`openrouter`), `AI_API_KEY`, `AI_MODEL`. Credentials server-side only; never in any response. |
| **Attachments / Vercel Blob** | Upload/download/ownership/role-scope/customer-isolation/MIME+size/`503` when unconfigured — `attachments/attachment.test.ts` (57) | **PARTIAL** | `BLOB_READ_WRITE_TOKEN` = private store, server-side only, 4 MiB proxy cap. Live round-trip to a real store not exercised here. |
| **Realtime SSE** | `canReceive` isolation, reconnect, outbox post-commit, dedupe/invalidation — `realtime.test.ts` (server) + `realtime-client.test.ts` (client) | PASS (automated) | Vercel serverless truncates the stream at `maxDuration` (documented); persistent Node host recommended for production. |

---

## 6. Database / Migration Status

- **Migrations present:** 13, timestamp-ordered, additive. `migration_lock.toml`
  provider = `postgresql`.
- **Enum change** (`20260831220000_remove_ticket_status_new`) uses the safe
  pattern: data migrate → create new type → drop default → cast column → set
  default → drop old type → rename. No data loss.
- **`prisma validate`** → schema valid.
- **`prisma-schema.test.ts`** → passes (documented models, `Role`/`TicketStatus`
  enum values, `Team`/`Ticket.teamId`/`User.teamId` relations, indexes, FKs).
- **Fresh-database apply: NOT VERIFIED.** No disposable/local Postgres and no
  Docker in this environment; the only reachable database is a shared Neon dev
  branch, and `prisma migrate reset` against a shared DB is prohibited by
  `AGENTS.md` and the audit rules.
- **Recommended before release:** on a throwaway Postgres, run
  `prisma migrate deploy` from a clean database, then `npm --prefix server run
  seed:test`, then start the server and exercise journeys A–D.

### 6.1 QA seed data integrity (`fix/qa-seed-data-integrity`)

Two fixture-only defects found in `server/scripts/seed-test-data.ts` (no
production runtime impact — the script refuses to run under
`NODE_ENV=production`):

| Issue | Before | After |
| --- | --- | --- |
| **Seed idempotency** | The script advertised idempotency but recreated the five canonical Teams with `prisma.team.create`. STEP 2 cleanup deletes seed Users (managers included) but never Teams, and `Team.managerId` is `ON DELETE SET NULL`, so a 2nd run hit `Team_departmentId_name_key` and aborted. | Teams are upserted on their unique key (`departmentId` + `name`) via `buildTeamUpsertArgs`. A re-run reuses the surviving Team row and rebinds `managerId` to the Manager created in STEP 3 (the row is `managerId = null` at that point, courtesy of the FK's `SET NULL`). Runs 1/2/3 all succeed; no duplicate Teams; unrelated Teams / Departments / Branches are never deleted. |
| **Conversation fixture integrity** | Every customer-authored `TicketMessage` used `portalCustomerUsers[0]`, so a ticket owned by Customer B could show public replies "from" Customer A. | `resolveMessageAuthorId` attributes a customer turn only to `ticket.customer.userId` (that customer's own portal `User`). When the ticket's customer has no portal account (180 of 185 seed customers), the customer turn is emitted as support-authored history instead (Option A) — deterministic message volume preserved, no borrowed identities. |

Regression: `server/scripts/seed-test-data.helpers.test.ts` (6 tests) — Team
upsert keying, manager rebinding, 5-Team count + isolation-fixture shape,
correct portal-customer author, no-portal-user fallback.

**Live repeated re-seed: NOT EXECUTED** — no disposable Postgres in this
environment (same constraint as "fresh-database apply" above). Verified by
focused unit tests + `prisma validate` + `prisma-schema.test.ts` + full server
suite only. The 3×-reseed count-stability check remains a pre-release step on a
throwaway database.

---

## 7. Deployment Checklist

### Frontend (Vercel)
- [ ] Production build passes (verified: `vite build` exit 0).
- [ ] `VITE_API_URL` points at the deployed API origin.
- [ ] SPA deep-link refresh works for `/portal/*`, `/manager/*`, `/tickets/:id`,
      etc. **No `client/vercel.json` exists** — this relies on Vercel's Vite
      preset providing the `index.html` fallback. Confirm on the first deploy;
      add an explicit `rewrites` rule if 404s appear on refresh.
- [ ] Never set any `RESEND_*`, `WHATSAPP_*`, `TEXTBEE_*`, `BLOB_*`, `AI_*`,
      `JWT_SECRET`, `CRON_SECRET`, or `DATABASE_URL` in the frontend project.

### Backend
- [ ] `npm --prefix server run build` (`prisma generate` + `tsc`) then
      `node dist/server.js`.
- [ ] `NODE_ENV=production`. Startup now **fails fast** if `JWT_SECRET` or
      `DATABASE_URL` is unset or still the shipped dev default (added this audit).
- [ ] `JWT_SECRET` ≥ 32 chars, unique, not the dev string.
- [ ] `DATABASE_URL` = production Postgres (Neon). For destructive Prisma ops use
      the **direct (non-pooler)** host.
- [ ] `CLIENT_URL` / `CLIENT_URLS` = exact production frontend origin(s); prod
      CORS rejects `localhost`.
- [ ] `APP_URL` = public web origin (absolute links in emails).
- [ ] SSE: run as a persistent Node service (Render / Railway / Fly / container),
      or Vercel Fluid Compute with an extended `maxDuration`, or swap the
      transport at the `realtime.publisher` seam.
- [ ] Body limits: webhook routers are mounted before `express.json()` and parse
      raw — do not move them.

### Database
- [ ] `prisma migrate deploy` on the production database (never `migrate reset`).
- [ ] Verify FKs / unique constraints / indexes after deploy.
- [ ] Seed only reference data as needed; `seed:test` refuses to run when
      `NODE_ENV=production`.

### Cron (Vercel Cron — `server/vercel.json`)
| Path | Schedule | Auth | Idempotent |
| --- | --- | --- | --- |
| `/api/internal/sla-monitor` | `*/5 * * * *` | `Authorization: Bearer $CRON_SECRET` | Yes (guarded `updateMany`, batch-bounded) |
| `/api/internal/task-reminders` | `*/5 * * * *` | same | Yes |
| `/api/internal/live-chat-inactivity` | `*/5 * * * *` | same | Yes (re-runs the same predicate as a conditional `updateMany`) |
- [ ] `CRON_SECRET` ≥ 32 chars, distinct from `JWT_SECRET`, backend only.
- [ ] Unset `CRON_SECRET` → these endpoints return 503 (fail closed) — fine for a
      deployment without cron, but then SLA escalation / reminders / live-chat
      auto-resolve do not run.

### Webhooks — production URLs to register
| Provider | URL | Verification |
| --- | --- | --- |
| WhatsApp | `https://<api-domain>/api/integrations/whatsapp/webhook` | GET `hub.verify_token` == `WHATSAPP_VERIFY_TOKEN`; POST `X-Hub-Signature-256` |
| Email (Resend) | `https://<api-domain>/api/integrations/email/...` (see `email.routes.ts`) | Svix signature over raw body, `RESEND_WEBHOOK_SECRET` |
| SMS (TextBee) | `https://<api-domain>/api/integrations/sms/...` (see `sms.routes.ts`) | `X-Signature` HMAC-SHA256 over raw body, `TEXTBEE_WEBHOOK_SECRET` — matches current TextBee webhook docs |

### Environment variable reference

| Variable | Req? | Side | Purpose | Secret | Missing in dev | Missing in prod |
| --- | --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | optional | backend | runtime mode | no | defaults `development` | should be `production` |
| `PORT` | optional | backend | listen port | no | `3000` | `3000` |
| `DATABASE_URL` | **required (prod)** | backend | Postgres connection | **yes** | dev default localhost | **startup throws** (guard added) |
| `JWT_SECRET` | **required (prod)** | backend | JWT sign/verify | **yes** | dev default string | **startup throws** (guard added) |
| `CLIENT_URL` | recommended | backend | single allowed CORS origin + email link base | no | `http://localhost:5173` | prod CORS won't match real origin |
| `CLIENT_URLS` | optional | backend | comma-separated allowed CORS origins (overrides `CLIENT_URL` set) | no | unused | falls back to `CLIENT_URL` |
| `APP_URL` | recommended | backend | absolute link base in emails | no | falls back to `CLIENT_URL` | broken email links if also no `CLIENT_URL` |
| `CRON_SECRET` | recommended | backend | cron bearer auth | **yes** | cron endpoints 503 | cron endpoints 503 (automation off) |
| `BLOB_READ_WRITE_TOKEN` | optional | backend | private Vercel Blob store | **yes** | attachments 503 | attachments 503 |
| `RESEND_API_KEY` | optional | backend | outbound email | **yes** | log transport (prints) | log transport ("suppressed") |
| `RESEND_WEBHOOK_SECRET` | optional | backend | inbound email signature | **yes** | inbound email 503 | inbound email 503 |
| `EMAIL_INBOUND_ADDRESS` | optional | backend | inbound routing address | no | — | — |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` | optional | backend | outbound sender | no | log transport | log transport |
| `WHATSAPP_ACCESS_TOKEN` / `_PHONE_NUMBER_ID` / `_VERIFY_TOKEN` / `_APP_SECRET` | optional | backend | WhatsApp Cloud API | **yes** | endpoints 503 | endpoints 503 |
| `WHATSAPP_API_VERSION` | optional | backend | Graph API version | no | `v22.0` | `v22.0` |
| `TEXTBEE_API_KEY` / `_DEVICE_ID` / `_WEBHOOK_SECRET` | optional | backend | TextBee SMS | **yes** | send/webhook 503 | send/webhook 503 |
| `TEXTBEE_BASE_URL` | optional | backend | TextBee API base | no | `https://api.textbee.dev` | same |
| `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` | optional | backend | AI assistant + customer AI | **yes** | `AI_NOT_CONFIGURED` | `AI_NOT_CONFIGURED` |
| `AI_TIMEOUT_MS` | optional | backend | AI request timeout | no | `20000` | `20000` |
| `VITE_API_URL` | **required** | frontend | API base for Axios + SSE | no | build/runtime points nowhere | app cannot reach API |

No secret is exposed through a `VITE_*` variable. No `.env` file is committed
(`server/.env` exists locally, git-ignored). No secret values are printed in this
document.

---

## 8. Security Findings

| ID | Severity | Finding | Impact | Resolution |
| --- | --- | --- | --- | --- |
| SEC-1 | **HIGH** | `config/env.ts` supplied a working development fallback for `JWT_SECRET` (`"development-jwt-secret-key-must-be-at-least-32-characters-long"`) and `DATABASE_URL`. A production deploy that forgot to set `JWT_SECRET` would boot with a publicly-known signing key → anyone can forge a valid admin JWT. | Full authentication bypass / privilege escalation if misconfigured. | **FIXED.** Added `assertProductionSecretsConfigured()` in `env.ts`: when `NODE_ENV=production`, an unset or dev-default `JWT_SECRET`/`DATABASE_URL` throws at startup. Dev/test unaffected. Regression: `server/src/config/env.test.ts` (6 tests). |
| SEC/WF-1 | **HIGH — RESOLVED** (`fix/sla-team-scoped-assignment`) | The SLA-monitor cron `assignUnassignedTickets()` (`sla-automation.service.ts`) selected candidate agents by `departmentId`/`branchId` equality only and **ignored `Ticket.teamId`**. It also assigned tickets whose `teamId` was `null`. Customer channels (Portal/Email/WhatsApp/SMS) create tickets with `teamId = null` and no dept/branch → `chooseAgent` matched any active agent → within 5 minutes an arbitrary least-loaded agent org-wide was auto-assigned. | Contradicted ADR-051 / the canonical engine ("unrouted `teamId = null` → left for ADMIN routing") and could produce a cross-team assignment that `assertAgentAssignableToTicket` would reject on the manual path. No cross-team **data leak** (the agent only ever sees their own assigned ticket), but the ticket's team ownership stayed `null`, so its owning manager could not see it and realtime `ticket.updated` (keyed on `teamId`) reached ADMIN only. | **FIXED.** `assignUnassignedTickets()` is now a bounded *candidate finder* — its `findMany` filters `teamId: { not: null }` (plus unassigned + active status) and it delegates every assignment decision to the canonical `autoAssignTicket(tx, …)`, one transaction per candidate. The legacy `chooseAgent`/`EligibleAgent` dept-branch selection and the duplicated history/audit/notification writes were deleted. `Ticket.teamId` is now the single authoritative ownership boundary on every automatic path; a `teamId = null` ticket is left unassigned for ADMIN routing (automatic Team routing remains out of scope). Regression: `sla-automation.test.ts` rewritten (16 tests) — team scoping, least-loaded, deterministic tie, unrouted no-op, cross-team dept/branch rejection, guarded no-reassign, no-eligible-agent safe no-op, terminal exclusion, canonical side effects, batch consistency. Full server suite **854 passed / 48 files**; `tsc` + `eslint` clean; `git diff --check` clean; no client changes. |
| SEC-2 | MEDIUM | In-memory rate-limit buckets (`middleware/rate-limit.ts`, used by customer AI and `/api/tickets/:id/ai`) are per-process. | On multi-instance / serverless the effective limit is `max × instanceCount`; a cold start resets a caller's bucket. | Acceptable for the assessment. For production, back the limiter with a shared store (Redis / Upstash) or accept the looser bound. Documented. |
| SEC-3 | LOW | `verifyAccessToken` calls `jwt.verify(token, env.JWT_SECRET)` without pinning `algorithms: ["HS256"]`. | No practical exploit here — only a symmetric secret is ever configured, and jsonwebtoken v9 does not accept `alg: none` without an explicit opt-in — but pinning is defense-in-depth. | Recommend adding `{ algorithms: ["HS256"] }`. Not changed (no vulnerability, avoids churn). |
| SEC-4 | LOW | WhatsApp `X-Hub-Signature-256` comparison (`whatsapp.signature.ts`) compares the provider-supplied hex string case-sensitively against a lowercase digest. | Meta sends lowercase hex, so no real impact; a spec change to uppercase hex would break verification. | Optional: lowercase `provided` before compare. |
| SEC-5 | INFO | `POST /api/auth/register` is customer-only by strict schema (no `role` field); login is generic on bad credentials; password hashes never leave the server; portal boundary re-resolves `User → Customer.userId` on every request. | — | No action. Verified by `auth.test.ts` + `docs/06`. |
| SEC-6 | INFO | Cron endpoints fail **closed** (503) when `CRON_SECRET` is unset; bearer compared with `timingSafeEqual`. | — | No action. |

---

## 9. Bugs Fixed During Audit

### BUG-1 — Server ESLint gate broken (pre-existing)

- **Root cause:** `server/scripts/verify-login.ts:26` and `:30` used a ternary
  as an expression statement (`pass ? ok++ : fail++;`), which
  `@typescript-eslint/no-unused-expressions` rejects. `npm --prefix server run
  lint` exited 1 before this audit (confirmed pre-existing in `.wolf/STATUS.md`
  notes and the recorded baseline).
- **Files changed:** `server/scripts/verify-login.ts` (2 lines → `if (…) ok++;
  else fail++;`).
- **Regression test:** the `npm --prefix server run lint` gate is now green
  (exit 0); it runs in CI/quality-gate and will catch a re-introduction.

### BUG-2 — Development JWT / DB fallback usable in production

- **Root cause:** `server/src/config/env.ts` gave `JWT_SECRET` and
  `DATABASE_URL` Zod `.default(...)` values so a fresh clone boots without a
  `.env`. Nothing prevented those defaults from being the live configuration in a
  production deployment.
- **Files changed:** `server/src/config/env.ts` (exported `DEV_JWT_SECRET`,
  `DEV_DATABASE_URL`, `assertProductionSecretsConfigured(nodeEnv, raw)`; call it
  after parsing). New `server/src/config/env.test.ts` (6 tests).
- **Regression test:** `env.test.ts` — no-throw outside production even with dev
  defaults; throws in production when either var is unset or equals its dev
  default; both names reported together.

Net test delta: server **839 → 845** passing (**47 → 48** files). Client
unchanged at **767 / 64**. Server ESLint **FAIL → PASS**.

---

## 10. Remaining Manual Verification

Concrete checklist — none of these could be done in this environment.

1. **Fresh database**
   - [ ] On a throwaway Postgres: `prisma migrate deploy` from empty →
         `npm --prefix server run seed:test` → start server.
   - [ ] Confirm all 13 migrations apply in order with no shadow-DB error.
2. **Multi-role browser matrix** (EN + AR, RTL, light + dark, mobile / tablet /
   desktop) for ADMIN, MANAGER Team A, MANAGER Team B, AGENT Team A, AGENT
   Team B, CUSTOMER A, CUSTOMER B:
   - [ ] Login / Register, Dashboard, Manager Console, Tickets, Ticket
         Detail / Conversation, Customers, Tasks, Reports, Users, Settings /
         Teams, Customer Portal, Support Widget, Live Chat, AI Support.
   - [ ] Layout / overflow / hidden controls / modal focus / table
         responsiveness / loading / empty / error / RTL mirroring.
   - [ ] Manager Team A cannot open a Team B ticket by editing the URL id (expect
         404), sees no Team B rows, receives no Team B realtime updates.
   - [ ] Customer A cannot open Customer B's ticket or attachment by guessed id
         (expect 404).
3. **Realtime, live**
   - [ ] Agent replies → customer sees it with no refresh; and vice-versa.
   - [ ] Drop the network → stream reconnects, no stale "authoritative" data.
   - [ ] Navigate between pages with the stream connected — no reconnect storm.
4. **Automatic assignment, live**
   - [ ] Staff-created team ticket with no assignee → least-loaded eligible
         in-team agent assigned; `AUTO_ASSIGNMENT` history + `TICKET_AUTO_ASSIGNED`
         notification present.
   - [ ] Already-assigned ticket is never reassigned.
   - [ ] Route an unrouted ticket to a team → auto-assign fires once.
   - [x] **SEC/WF-1 resolved** — SLA cron delegates to the canonical team-scoped
         engine and skips `teamId = null` tickets (`fix/sla-team-scoped-assignment`).
         Live check: an unrouted customer-channel ticket is *not* auto-assigned by
         the cron; a routed unassigned ticket is assigned to an in-team agent only.
5. **Live providers** (each with real credentials, then mark verified):
   - [ ] Email (Resend): inbound webhook → ticket; outbound reply delivered;
         signature rejection on a tampered body.
   - [ ] WhatsApp (Meta): GET verify handshake; signed inbound → ticket; reply
         delivered; replayed webhook id is a no-op.
   - [ ] SMS (TextBee): outbound send; live inbound webhook (`X-Signature` /
         HMAC-SHA256 / raw body — contract already matches) → ticket; rollback
         on a simulated send failure.
   - [ ] AI provider: real key → grounded answer citing only published KB;
         invalid key → `AI_NOT_CONFIGURED`; timeout → structured error, portal
         stays up.
   - [ ] Blob: real private store → upload then download round-trips; wrong-owner
         id → 404.
6. **Production smoke**
   - [ ] Backend starts with the real env set; the new production guard passes.
   - [ ] Deep-link refresh on `/portal/tickets/:id` returns the app, not a 404.
   - [ ] CORS: the real frontend origin is accepted; a random origin is rejected.

---

## 11. Final Recommendation

**READY WITH FIXES** — automated system integrity is strong and both quality
gates are fully green after this audit. Three real defects were fixed (broken
server ESLint gate; production-unsafe JWT/DB fallback; SEC/WF-1 SLA-cron team
scoping). Before production release:

1. ~~Resolve **SEC/WF-1** (SLA-monitor cron ignores `Ticket.teamId`).~~ **Done**
   on `fix/sla-team-scoped-assignment`: the cron now finds candidates only
   (routed, unassigned, active) and delegates the decision to the canonical
   `autoAssignTicket(tx, …)`; unrouted (`teamId = null`) tickets are left for
   ADMIN routing. Rewritten `sla-automation.test.ts` (16 tests); full server
   suite 854/48 green.
2. Complete the outstanding **manual verification**: a fresh-database migration
   run, live Email / WhatsApp / SMS / AI provider validation (the SMS inbound
   signature scheme in particular), a real Blob round-trip, and the multi-role
   EN/AR/RTL/light-dark/responsive browser matrix.

Do not mark the project READY until the live external-provider behavior and the
production deployment smoke test have actually been performed.
