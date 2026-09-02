# Fresh Database + Repeated Seed + Multi-Role Runtime QA

Strongest practical production-like QA performed locally: an **empty disposable
PostgreSQL**, the real migration history, three consecutive official seed runs,
the real backend + frontend, and multi-role journeys exercised over real HTTP
(REST + Server-Sent Events) and a real browser (Chromium via Playwright).

No application code was changed. No commit or push was performed. This is the
`docs/24` "remaining manual verification" list, actually executed.

---

## Environment

| Item | Value |
| --- | --- |
| Branch | `test/fresh-db-and-browser-qa` |
| Base commit | `b11408f` (`master`: *fix(seed): reuse teams and correct customer message authors*) |
| Working tree | clean except pre-existing `.wolf/memory.md` (OpenWolf bookkeeping) |
| Node | v22.18.0 |
| PostgreSQL | **17.5** — portable `embedded-postgres` cluster, throwaway, in the session scratchpad (no Docker, no system Postgres available) |
| Disposable database | `crm_fresh_qa_20260902180340` on `127.0.0.1:55432` (created empty, dropped after) |
| Shared Neon dev DB | **never touched** — the server ran with a QA-only `DOTENV_CONFIG_PATH` env file; `.env` was not loaded |
| Backend | `tsx src/server.ts` → `http://localhost:3000` (all external providers deliberately **unconfigured**) |
| Frontend | `vite` → `http://localhost:5173` (`VITE_API_URL=http://localhost:3000/api`) |
| Browser tool | Playwright 1.62.1 + bundled Chromium (headless) |
| Date | 2026-09-02 |

---

## Automated Baseline

Run on the branch before any runtime work, using the repository scripts.

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` (client + server) | **PASS** — exit 0 |
| Lint | `npm run lint` (client + server) | **PASS** — exit 0 (2 pre-existing non-failing `react-refresh/only-export-components` warnings on the client, per `docs/24`) |
| Server tests | `npm --prefix server run test` (`vitest run`) | **PASS** — **860 passed / 49 files**, exit 0 |
| Client tests | `npm --prefix client run test` (`vitest run`) | **766 passed / 1 failed / 64 files** in the full parallel run. The 1 failure is the **documented pre-existing flake** `attachments.test.tsx` *"Loading preview…"* timeout under parallel load — **44/44 when run in isolation**. Effective **767 / 64**. |
| Build | `npm run build` | **PASS** — exit 0. Client `tsc -b && vite build` → `index-*.js` 2,118 kB / gzip 606 kB (pre-existing >500 kB single-chunk warning). Server `prisma generate` + `tsc` clean. *(A transient `EPERM` on `prisma generate` occurred while the disposable API server held the query-engine DLL; rerun after stopping the server → exit 0.)* |
| `git diff --check` | — | **PASS** — exit 0 |

Matches the `docs/24` baseline (854→860 server as the SLA-cron branch merged; client unchanged).

---

## Fresh Database

### Migration (`prisma migrate deploy` from empty)

- **Result:** exit 0. **13 / 13 migrations applied in order**, ~52 s. No shadow-DB error, no enum-recreation failure, no FK failure, Team migration (`20260901103646_add_team_scope`) applied cleanly.
- **Migrations:** `20260824142611_init_crm_schema`, `20260827101406_add_user_is_active`, `20260827161500_add_notification_ticket_id`, `20260827200533_add_tasks`, `20260828120000_add_ticketmessage_external_id`, `20260828163000_add_team_collaboration`, `20260830120000_add_audit_logs`, `20260830190000_add_password_reset`, `20260830210000_add_user_phone`, `20260830220000_departments_branches_fields`, `20260831180000_add_email_channel_metadata`, `20260831220000_remove_ticket_status_new`, `20260901103646_add_team_scope`.
- `prisma validate` → **valid**. `prisma migrate status` → **up to date**.
- `prisma migrate diff` (schema datamodel ↔ live DB) → **"No difference detected."** The migration history reproduces the Prisma schema exactly.
- Prisma Client connected and served every query below. Schema push was **not** used.

### Seed runs (`npm run seed:test`, x3 on the same DB)

All three runs exited 0. **No `Team_departmentId_name_key`**, no other unique-constraint error, no FK error. Runs 2 and 3 logged `Purged prior seed data (387 tickets, 180 customers, 49 users)` (the 5 portal customers are matched separately by e-mail) and then completed. Teams are never purged — they are upserted on `(departmentId, name)` and `Team.managerId` is re-bound to the freshly created manager each run.

### Count stability

| Entity | Run 1 | Run 2 | Run 3 | Stable? |
| --- | --- | --- | --- | --- |
| Teams | 5 | 5 | 5 | ✅ |
| Departments | 8 | 8 | 8 | ✅ |
| Branches | 4 | 4 | 4 | ✅ |
| Managers | 5 | 5 | 5 | ✅ |
| Agents (33 active / 2 inactive) | 35 | 35 | 35 | ✅ |
| Admins (incl. `bahaa@crm.com`) | 4 | 4 | 4 | ✅ |
| Portal customer users | 5 | 5 | 5 | ✅ |
| Customers (5 portal-linked) | 185 | 185 | 185 | ✅ |
| Tickets | 387 | 387 | 387 | ✅ |
| — assigned | 290 | 290 | 290 | ✅ |
| — routed, unassigned (`teamId≠null`, `agent=null`) | 90 | 90 | 90 | ✅ |
| — unrouted (`teamId=null`, always `agent=null`) | 7 | 7 | 7 | ✅ |
| TicketMessages | 1344 | 1344 | 1344 | ✅ |
| TicketNotes | 129 | 129 | 129 | ✅ |
| TicketHistory | 387 | 387 | 387 | ✅ |
| Tasks | 107 | 107 | 107 | ✅ |
| KnowledgeArticles | 63 | 63 | 63 | ✅ |
| QuickReplies | 47 | 47 | 47 | ✅ |
| AuditLogs | 412 | 412 | 412 | ✅ |
| Notifications | 85 | 85 | 85 | ✅ |
| Feedback | 13 | 13 | 13 | ✅ |
| Categories / SlaRules | 10 / 4 | 10 / 4 | 10 / 4 | ✅ |

Every count is identical across the three runs. No accumulating duplicate fixture rows.

---

## Seed Integrity

Verified with direct SQL against the seeded disposable database.

### Teams

| Team | Department | Manager | `manager.teamId == team.id` | Agents (active/inactive) |
| --- | --- | --- | --- | --- |
| Billing Support | Customer Support | Marcus Vance | ✅ | 7 / 0 |
| Technical Support | Customer Support | Maya Lin | ✅ | 7 / 0 |
| Field Operations | Field Services | Tariq Al-Mansoor | ✅ | 7 / 0 |
| Onboarding Squad | Onboarding | Chloe Dubois | ✅ | 7 / 0 |
| Payments Desk | Billing Operations | David Kim | ✅ | 5 / 2 |

- **Exactly 5 canonical Teams**; **0** duplicate `(departmentId, name)` rows.
- Each Team has exactly one Manager; each Manager manages exactly one Team and belongs to it.
- Every Agent (all 35, active and the 2 inactive) has a valid `teamId`; every Manager has a valid `teamId`.
- **Two Teams under `Customer Support`** (Billing Support / Technical Support) with **different Managers** (Marcus Vance / Maya Lin) and **disjoint Agent sets** — the intended in-department isolation fixture.
- Manager re-binding after a re-seed: verified against the real DB (all 5 `manager.teamId` values match their managed Team after runs 1/2/3).

### Ticket / Team assignment

- **0** assigned tickets where `ticket.teamId ≠ assignedAgent.teamId`. No cross-team assigned ticket exists.
- **0** assigned tickets with a null team.
- Routed-unassigned: 90 (`teamId≠null`, `assignedAgentId=null`). Unrouted: 7 (`teamId=null`), **all** with `assignedAgentId=null` — ADMIN-routing only.
- Status mix: OPEN 65 · IN_PROGRESS 65 · WAITING_CUSTOMER 65 · RESOLVED 64 · CLOSED 64 · ESCALATED 64.
- Priority mix: LOW 76 · MEDIUM 155 · HIGH 117 · URGENT 39.
- Channel mix (this QA run, pre-fix): WEB 195 · EMAIL 116 · WHATSAPP 38 · LIVE_CHAT 38 · **SMS 0** — *Bug 2* (seed fixture defect; the SMS branch was unreachable). **Fixed on `fix/outbound-reply-resilience`:** WEB 195 · EMAIL 116 · WHATSAPP 38 · SMS 19 · LIVE_CHAT 19 (total still 387).

### Seeded conversation ownership (regression from `bug-135` / the seed author fix)

| Portal customer | Tickets | Msgs | Customer-authored | Authored by own `userId` | Foreign-customer authored |
| --- | --- | --- | --- | --- | --- |
| `portal.customer@crm.local` | 29 | 320 | 167 | 167 | **0** |
| `portal.customer2@crm.local` | 25 | 127 | 72 | 72 | **0** |
| `portal.customer3@crm.local` | 16 | 81 | 45 | 45 | **0** |
| `portal.customer4@crm.local` | 2 | 3 | 2 | 2 | **0** |
| `portal.customer5@crm.local` | 2 | 4 | 3 | 3 | **0** |

- **Global check:** portal-customer-authored `TicketMessage` rows sitting on a ticket owned by a *different* customer → **0**.
- Tickets whose customer has **no** portal `User` (180 of 185): every message is **staff (AGENT) authored** (Option A fallback) — 809 rows, **0** borrowed portal identities.

---

## Role Matrix

Seven seeded accounts; every check performed over real HTTP against the disposable stack. Password for all seed accounts is `password123` except `bahaa@crm.com` (`123`). Credentials are test-only.

| Persona | Account | Team | Critical scope checks | Result |
| --- | --- | --- | --- | --- |
| **ADMIN** | `bahaa@crm.com` | — | tickets across ≥3 teams in one page; can open unrouted (`teamId=null`) ticket; all 9 primary routes 200 (`/dashboard/overview`, tickets, customers, users, teams, tasks, KB, reports, audit-logs, settings, notifications); ticket detail + conversation + history | **PASS** |
| **MANAGER A** | `manager1@crm.local` | Billing Support | list = own team only (100 rows, 1 distinct `teamId`); foreign-team ticket → **404**; own-team ticket → 200; `/users/agents` = 7 own-team only; `/manager/overview` + `/manager/team` 200 own-team; `/reports/overview` 200 | **PASS** |
| **MANAGER B** | `manager2@crm.local` | Technical Support | symmetric (68 rows, own `teamId` only); foreign-team ticket → **404** | **PASS** |
| **AGENT A** | `agent1@crm.local` | Billing Support | `scope=mine` → only self-assigned (59 rows, 0 violations); `scope=unassigned` → only own-team unassigned (18 rows, 0 violations); foreign-team assigned **and** unassigned ticket → **404**; `POST /customers` → **403**; `POST /users` → **403**; priority + status change on own assigned ticket → 200; reassign to another agent → **403** | **PASS** |
| **AGENT B** | `agent8@crm.local` | Technical Support | symmetric (8 mine / 19 unassigned, 0 violations); foreign-team tickets → **404**; writes → **403** | **PASS** |
| **CUSTOMER A** | `portal.customer@crm.local` | — | `/portal/tickets` own only (29 rows); other customer's ticket → **404** (IDOR); own detail hides `assignedAgent`/`teamId`/`notes`/SLA-due fields; conversation authors are `CUSTOMER`/`SUPPORT` only; create WEB ticket + reply + conversation renders | **PASS** |
| **CUSTOMER B** | `portal.customer2@crm.local` | — | symmetric (25 rows); Customer A's ticket **and** Customer A's freshly created ticket → **404** | **PASS** |

No FAIL, no PARTIAL. Enforcement is server-side (route middleware + query-level `where` scoping); a foreign id yields `404` with no existence leak.

---

## Critical Journeys

| Journey | Result | Evidence |
| --- | --- | --- |
| **Web ticket** (customer create → reply → conversation → cross-customer isolation) | **PASS** (LOCAL RUNTIME) | `POST /portal/tickets` → 201; `POST …/messages` → 201; detail shows the reply; Customer B → 404 on it. |
| **Reopen** | **PASS** (LOCAL RUNTIME) | `WAITING_CUSTOMER` + customer reply → **`IN_PROGRESS`**; `RESOLVED` + customer reply → **`OPEN`**; `CLOSED` + customer reply → **409 `TICKET_CLOSED`** (message rejected). Statuses re-read from the API after each reply. |
| **Automatic assignment** | **PASS** (LOCAL RUNTIME) | ADMIN `PATCH /tickets/<unrouted> {teamId: Billing Support}` → team set; canonical engine assigned a **Billing Support** agent (`agent.teamId == ticket.teamId`); `ASSIGNMENT` row in ticket history; re-routing to the same team **kept the existing assignee** (never overwritten). Live-chat create path also auto-assigns an in-team agent (below). |
| **Realtime** | **PASS** (LOCAL RUNTIME) | Raw SSE `/api/realtime/events` opened for 6 roles. Customer public reply on a **Team A** ticket → events on `admin` + `manager1` + owning customer **only** (`manager2`, `agent8`, other customer receive nothing). Symmetric for a **Team B** ticket (`admin` + `manager2` + owner). Internal note → **0** customer streams. `PATCH … {teamId: Team B}` → `admin` + `manager2` only (`manager1` excluded). No manual reload involved. |
| **Live chat** | **PASS** (LOCAL RUNTIME) | `GET /portal/live-chat/departments` → customer-safe `{id,name}[]`. Fresh `POST /portal/live-chat {departmentId}` (after draining pre-existing chats) → 201 `channel=LIVE_CHAT`, `teamId` = a team in the chosen department, **in-team auto-assignment** + `ASSIGN` history. `GET /portal/live-chat` resumes the same chat; customer message → 201; `POST …/:id/end` → 200. |
| **AI graceful failure / handoff** | **PASS** (LOCAL RUNTIME, provider unconfigured) | Support widget opens (non-modal, no dimming backdrop, anchored bottom-right even under `dir=rtl`). `POST /portal/ai/chat` unconfigured → **200** graceful (portal never crashes; live-support handoff stays available). `POST /tickets/:id/ai` unconfigured → **503 `AI_NOT_CONFIGURED`** (structured, fail-closed). |

---

## UI Smoke

Playwright + Chromium against the running stack. Screenshots captured to the session scratchpad (`shots/`, `shots2/`, `shots3/`).

| Dimension | Result | Notes |
| --- | --- | --- |
| **English** | **PASS** | Dashboard, Tickets, Customers, Users, Knowledge Base, Tasks, Reports, Settings, Audit Logs all render with a heading and real seeded data; no "page not found"; no raw i18n keys. |
| **Arabic / RTL** | **PASS** | `document.dir = rtl` on login, dashboard, tickets, ticket detail. Sidebar mirrored to the right edge. Nav / status / priority / dates localized (Arabic-Indic digits). **0** horizontal body overflow on tickets and ticket detail. No raw i18n keys. |
| **Light** | **PASS** | Baseline. |
| **Dark** | **PASS** | Dashboard / Tickets / Ticket detail / Portal ticket detail all render a dark background (mean RGB ≈ 20) with light text (mean ≈ 245); support widget opens correctly in dark. Theme persists via `crm-theme` localStorage. |
| **Desktop 1440px** | **PASS** | No overflow; layouts intact. |
| **Mobile 390px** | **PASS** | Internal dashboard / tickets / ticket detail and portal home / tickets: **0** horizontal overflow. |

---

## Integration Smoke

All external providers were deliberately unconfigured for this run. Verification levels are called out explicitly.

| Integration | Level | Result |
| --- | --- | --- |
| **Email (Resend)** | CODE VERIFIED + LOCAL RUNTIME (unconfigured path) | Inbound webhook → **503 `EMAIL_WEBHOOK_NOT_CONFIGURED`** (fail-closed). Outbound: staff reply on an `EMAIL`-channel ticket unconfigured → **201, reply persisted**, `delivery: { status: "FAILED", reason: "INTEGRATION_NOT_CONFIGURED" }` + `EMAIL_DELIVERY_FAILED` history row (**Bug 1 resolved**, branch `fix/outbound-reply-resilience` / ADR-052). Live delivery: **NOT VERIFIED**. |
| **WhatsApp (Meta)** | CODE VERIFIED + LOCAL RUNTIME (unconfigured path) | GET verify → **503**; POST webhook → **503** (fail-closed). Staff reply on a `WHATSAPP`-channel ticket → **201, message persisted**, response carries `delivery: { status: "FAILED", reason: "INTEGRATION_NOT_CONFIGURED" }` (graceful — the intended pattern). Live delivery: **NOT VERIFIED**. |
| **SMS (TextBee)** | CODE VERIFIED | POST webhook unconfigured → **503**. Inbound contract unchanged and still matches `sms.signature.ts`: `X-Signature` = HMAC-SHA256 over the raw request body keyed by the webhook secret. Outbound reply path now shares the post-commit seam (**Bug 1 resolved** / ADR-052): failure → **201 + `delivery.status = "FAILED"` + `SMS_DELIVERY_FAILED` history row**, reply persisted. Seed now produces SMS-channel tickets (**Bug 2 resolved**). Live delivery: **NOT VERIFIED**. |
| **Blob (Vercel)** | LOCAL RUNTIME VERIFIED (unconfigured path) | Attachment upload → **503 `STORAGE_UNAVAILABLE`** (structured). Live private-store round-trip: **NOT VERIFIED**. |
| **AI provider** | LOCAL RUNTIME VERIFIED (unconfigured path) | Internal endpoint → **503 `AI_NOT_CONFIGURED`**; portal AI chat → **200** graceful. Live provider response: **NOT VERIFIED**. |
| **Realtime SSE** | LOCAL RUNTIME VERIFIED | Streamed real events for 6 roles with correct audience isolation (see Critical Journeys). |
| **Cron auth** | LOCAL RUNTIME VERIFIED | `/api/internal/sla-monitor` — no bearer → **401**; wrong bearer → **401**; correct `CRON_SECRET` → **200**. |

Legend used above: **CODE VERIFIED** (reviewed in source) · **LOCAL RUNTIME VERIFIED** (exercised against this disposable stack) · **LIVE PROVIDER VERIFIED** (real external delivery — none) · **NOT VERIFIED**.

---

## Bugs Found

### Bug 1 — MEDIUM — staff reply to an EMAIL-channel ticket is lost when email is unconfigured — ✅ RESOLVED

- **Role / route:** any ADMIN / MANAGER / AGENT · `POST /api/tickets/:id/messages` on a ticket whose `channel = EMAIL`.
- **Repro:** with `RESEND_API_KEY` / `EMAIL_FROM` unset, post a public reply to an EMAIL-channel ticket.
- **Was:** HTTP **503 `EMAIL_NOT_CONFIGURED`** and **no `TicketMessage` row created** — `deliverEmailReply()` / `deliverSmsReply()` ran *inside* the `prisma.$transaction` before `tx.ticketMessage.create`, so a `requireOutboundEmailConfig()` 503 (or any `502` provider error) rolled the whole transaction back. WhatsApp delivery, by contrast, runs **after** commit.
- **Fix (branch `fix/outbound-reply-resilience`, ADR-052):** the transaction now persists local durable state only (access/workflow validation, `TicketMessage`, `firstRespondedAt`, watcher fan-out, EMAIL thread bookkeeping); the realtime `ticket.message.created` event is published on commit; then EMAIL/SMS/WhatsApp delivery is attempted **after commit** via non-throwing wrappers (`deliverOutboundEmailReply`, `deliverOutboundSmsReply`, `deliverOutboundReply`). A provider/configuration failure returns **HTTP 201** with `delivery: { channel, status: "FAILED", reason }` and records a `<CHANNEL>_DELIVERY_FAILED` ticket-history row; the local reply is never rolled back. Success still returns `status: "SENT"` + `externalId` and stores the provider id.
- **Behaviour now — EMAIL:** unconfigured → 201 + `reason: "INTEGRATION_NOT_CONFIGURED"`; runtime provider error → 201 + `reason: "PROVIDER_REJECTED" | "PROVIDER_UNREACHABLE"`; missing/invalid customer email → 201 + `NO_RECIPIENT_EMAIL` / `RECIPIENT_INVALID`; configured + accepted → 201 + `status: "SENT"`, `externalId` stored, no failure history. **SMS/TextBee:** identical semantics.
- **Delivery failure is still surfaced explicitly and is never treated as successful delivery.**
- **Regression tests:** `ticket.test.ts` (EMAIL/SMS unconfigured, runtime failure, success, no-provider-call-before-commit, single-side-effect), `outbound-delivery.test.ts` (reason mapping, history-row write, SMS wrapper), `email.test.ts` outbound block. Full server vitest **878/878** (50 files); client **767/767**.
- **Runtime:** NOT EXECUTED against a live disposable stack in this branch (no running QA Postgres); covered by the automated regression suite above.

### Bug 2 — LOW (fixture only) — seed generates zero SMS-channel tickets — ✅ RESOLVED

- **File:** `server/scripts/seed-test-data.ts` — `else channel = i % 2 === 0 ? Channel.SMS : Channel.LIVE_CHAT;` reached only when `i % 10 === 9` (always odd), so `Channel.SMS` was dead code and all 38 of those tickets became `LIVE_CHAT`.
- **Fix (ADR-052):** extracted a pure, exported `seedTicketChannel(i)` helper; the last bucket now splits on `Math.floor(i / 10) % 2`. Deterministic (no PRNG), total still **387**, WEB/EMAIL/WHATSAPP split unchanged (195 / 116 / 38), last bucket → **19 SMS + 19 LIVE_CHAT**. New `seed-test-data.helpers.test.ts` block asserts every channel is non-zero and the total/legacy split hold.

### Bug 3 — INFO (fixture only) — seed writes HTML into `Ticket.description`

The seed stores `<p>…</p><code>…</code>` markup in `Ticket.description`, but both the portal and the internal CRM render `description` as **plain text** (by design — only `TicketMessage.body` / notes are HTML), so QA screenshots show literal `<p>` tags in the portal "Request details" panel. Real portal / internal ticket creation uses a plain `<textarea>`, so production data is unaffected. Cosmetic, seed-only.

### Bug 4 — INFO (fixture only) — seed creates several concurrent open LIVE_CHAT tickets per portal customer

The seed treats `LIVE_CHAT` as an ordinary channel in the ticket loop, so a portal customer can end up with multiple non-terminal `LIVE_CHAT` tickets. `GET /portal/live-chat` correctly returns the most-recent non-terminal one and ending it surfaces the next; the Live Chat feature otherwise assumes one active chat per customer. No product defect — a fixture-realism gap.

**No new correctness, authorization, or data-isolation bugs were found.** RBAC was not weakened; no production behavior was changed; no code was committed.

---

## Release Recommendation

### READY WITH MINOR FIXES

- A truly empty disposable PostgreSQL ran **all 13 migrations in order**; the migration history reproduces the Prisma schema with **no drift**.
- The official seed ran **3 consecutive times on the same database** with **every entity count identical** and **no constraint errors**; the canonical 5 Teams, manager re-binding, agent membership, ticket/team assignment consistency, and per-customer conversation ownership all verified against the real seeded data.
- The real backend + frontend started cleanly against the disposable DB; **ADMIN, two MANAGERs, two AGENTs, and two CUSTOMERs** were exercised over real HTTP + SSE — cross-team isolation, customer IDOR, ticket reopen, automatic (team-scoped) assignment, realtime audience isolation, and the live-chat lifecycle all hold.
- **EN / AR + RTL**, **light / dark**, and **desktop / mobile** smoke all pass with no overflow, clipping, or untranslated keys.
- Automated gates are green: **860** server tests, **767** effective client tests, typecheck / lint / build / `git diff --check` clean.

**Before a production release:**

1. ~~**Bug 1** — make the Email (and SMS) outbound reply resilient when the provider is unconfigured or erroring.~~ **✅ Resolved** on branch `fix/outbound-reply-resilience` (ADR-052): EMAIL/SMS delivery moved after the local commit; provider failure → 201 + `delivery.status = "FAILED"` + `<CHANNEL>_DELIVERY_FAILED` history, reply never rolled back. Live Resend/TextBee delivery still NOT VERIFIED.
2. ~~**Bug 2**~~ **✅ Resolved** (same branch) — seed now generates SMS-channel tickets (`seedTicketChannel`). **Bug 3 / Bug 4** — small seed-fixture cleanups (description markup, concurrent live chats); non-blocking.
3. Still **NOT VERIFIED** (outside local scope): live Resend / Meta / TextBee / AI provider delivery, a real Vercel Blob round-trip, and the production deployment smoke test (SPA deep-link refresh, prod CORS, cron on Vercel).

Do not mark the project fully READY until the live external-provider behavior and the production deployment smoke have actually been performed.
