# Customer Support CRM — Progress Tracking

Last Updated: 2026-08-26

Current Integration Branch: `master`, synchronized with `origin/master` at feature start (local/remote ahead 0, behind 0). The reviewed dashboard ticket-queue fix is now contained in `master`.

Current Working Branch: `feature/sla` - basic SLA presentation and shared derivation implemented from synchronized `master`; all changes remain unstaged and uncommitted.

> This file is a status summary. Requirements, architecture, API contracts, RBAC rules, workflows, UI specifications, and architecture decisions remain authoritative in their respective documents.

## 1. Overall Status

- `master` contains Project Foundation, Database Schema, Authentication, Customer Management, Localization and RTL, Frontend Design Polish, TanStack Table adoption, Bilingual Typography, Ticket Management, Ticket Conversation, Agent Dashboard, Customer Portal, the reviewed Ticket authorization/workflow fix, and the reviewed Dashboard ticket-queue fix.
- `feature/sla` adds basic SLA presentation: one shared request-time derivation helper (`server/src/shared/sla/derive-sla.ts`) now consumed by both the Agent Dashboard and authorized internal Ticket Details, an explicit `effectiveSlaTarget`, derived Ticket Details response fields, and a compact localized Ticket Details SLA subsection. Changes are unstaged.
- The end-to-end customer/agent support loop is implemented: customers can create, list, inspect, reply to, and reopen eligible requests through the owned Portal boundary, while internal staff can manage, converse on, and resolve tickets with customer context and Dashboard visibility.
- The project is not finished or production-ready: final SLA presentation/monitoring scope, realistic demo data, final integrated QA, unresolved Dashboard visual verification, deployment verification, and deferred/P1 features remain.
- Provider-backed channels and other production external integrations remain intentionally deferred.

## 2. Feature Progress

| Area | Status | Branch | Backend | Frontend | Tests | DB Verified | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Project Foundation | ✅ COMPLETE | `feature/project-foundation` | Express health foundation | React/Vite foundation | Passing | N/A | Tip is contained in `master`. |
| Database Schema | ✅ COMPLETE | `feature/database-schema` | 16 Prisma domain models and five enums | N/A | Schema contract passing | Yes, prior verified run | Initial migration exists and was previously confirmed current. Seed data is absent. |
| Authentication | ✅ COMPLETE | `feature/authentication` | Registration, login, `/auth/me`, JWT and role middleware | Login, registration, protected routing and logout | Passing | Yes, prior verified run | No refresh-token or revocation infrastructure. |
| Customer Management | ✅ COMPLETE | `feature/customer-management`, authorization/support-context refinements on `feature/agent-dashboard` | ADMIN/MANAGER mutations; AGENT read-only customer data; complete safe ticket-summary history | Role-aware actions/forms plus FULL/SUMMARY_ONLY customer Tickets tab | Passing | Yes | Attachments are metadata-only; summary visibility is separate from Ticket Management access. |
| Frontend Localization / RTL | ✅ COMPLETE | `fix/frontend-localization` | Localized API error support where implemented | Persisted English/Arabic and document direction | Passing | N/A | Commit ancestry confirms it is contained in `master`. |
| Frontend Design Polish | ✅ COMPLETE | `fix/frontend-design-polish` | No material backend scope | Shared auth/protected shells and responsive refinement | Passing | N/A | Tip is contained in `master`. |
| TanStack Table Refactor | ✅ COMPLETE | `fix/frontend-design-polish` | Existing server pagination retained | Typed customer and ticket tables with responsive cards | Passing | N/A | Tip is contained in `master`. |
| Ticket Management authorization/workflow fix | ✅ COMPLETE | `fix/ticket-agent-permissions` | AGENT update allowlist, actor-derived creation assignment/history, and unchanged close transition enforcement | Protected edit route, role-scoped controls, confirmed close action, explicit Ticket/Customer column containment | Passing | Prior verification | Commit `19fbedde` is integrated into `master`. |
| Ticket Conversation | ✅ COMPLETE | `feature/ticket-conversation` | Internal detail conversation read, public replies, internal notes, RBAC and first-response transaction | Localized timeline and accessible reply/note composer | Passing | Yes | Tip is contained in `master`; browser capture verification was not completed. |
| Agent Dashboard | ✅ COMPLETE | `fix/dashboard-ticket-queues` (contained in `master`) | Explicit role-derived primary queues; AGENT active assigned-only work; backend Recent exclusion after primary selection; now uses the shared SLA derivation helper without response-shape change | Localized role-aware headings, non-duplicate sections, fixed-width scrollable tables, overflow-safe mobile cards, and stale-response crash protection | 103 client / 126 server passing | Yes, prior verified run | Dashboard queue fix is integrated into `master`. `feature/sla` extracts the SLA helper; dashboard regression tests confirm unchanged counts, visibility, ranking, response shape, and boundaries. Browser visual verification remains incomplete. |
| Customer Portal | ✅ COMPLETE | `feature/customer-portal` | Customer-owned Portal APIs, IDOR-safe ownership, creation, public replies, and reopening | Final responsive English/Arabic Portal shell, overview, list, creation, detail, and navigation polish | 82 client / 87 server passing | Yes, prior verified run | Commit `458af2e` ancestry confirms integration into `master`. Authenticated English/Arabic desktop and mobile visual verification and final navigation regression verification were completed previously. |
| SLA / Automation | 🟡 BASIC PRESENTATION IMPLEMENTED | `feature/sla` (unstaged) | Deadline snapshots/recalculation, one-time first-response recording, Portal-safe behavior, and one shared request-time derivation helper (`SlaState` + `SlaTarget` + fixed 60-minute window) consumed by Dashboard and authorized internal Ticket Details | Dashboard SLA presentation unchanged; internal Ticket Details gains a compact localized English/Arabic SLA subsection (state, effective target, effective deadline, raw first-response/resolution deadlines, first-response completion) using derived API fields, text-not-color-alone, LTR-isolated dates, no countdown | 103 client / 126 server passing | Not this session; deterministic boundary tests cover all states | Basic SLA presentation and shared derivation complete on `feature/sla`, unstaged. Deferred: background workers, scheduled monitoring, persisted SLA state/breach events, notifications, automatic escalation/assignment, SLA reports, and SLA administration. |
| Knowledge Base | ⚪ NOT STARTED | — | Schema only | Not implemented | Schema only | Schema only | P1 after the P0 demo flow. |
| Reports | ⚪ NOT STARTED | — | Not implemented | Not implemented | None | No | Depends on meaningful ticket/SLA/feedback data. |
| AI Assistant | 🟣 DEFERRED | — | Not implemented | Not implemented | None | No | P2; must require human review when promoted. |
| Notifications | ⚪ NOT STARTED | — | Schema only | Not implemented | Schema only | Schema only | P1 in-app notifications only. |
| Attachments | ⚪ NOT STARTED | — | Schema and customer metadata read path only | Customer metadata display only | Partial customer coverage | Schema only | No upload/storage provider or ownership validation service. |
| Audit Logs | 🟣 DEFERRED | — | Ticket history schema is not a general audit log | Not implemented | Schema only | Schema only | P2. |
| Multi-Department | 🟣 DEFERRED | — | Schema only | Not implemented | Schema only | Schema only | P2 behavior. |
| Multi-Branch | 🟣 DEFERRED | — | Schema only | Not implemented | Schema only | Schema only | P2 behavior. |
| External Integrations | 🟣 DEFERRED | — | Channel enum representation only | Not implemented | Schema only | Schema only | WhatsApp, SMS, inbound email, live transport, ERP, and arbitrary systems are demonstration/architecture only. |
| Deployment | ⚪ NOT STARTED | — | No deployed API evidence | No deployed frontend evidence | Local build passing | Development DB only | Deployment targets are documented but not configured or verified. |
| Final QA | 🟡 INCOMPLETE | — | Current working scope passes automated checks | Current working scope passes automated checks | 16 client files / 103 tests; 9 server files / 126 tests; 229 total passed, 0 failed, 0 skipped, 0 todo | Not this session | `feature/sla`: lint, typecheck, and builds pass; the non-failing Vite chunk-size warning remains. PostgreSQL and authenticated English/Arabic browser verification for the SLA presentation were not performed this session; deterministic boundary tests cover every SLA state. |

## 3. Completed Work

### Project Foundation

- Branch: `feature/project-foundation` (contained in `master`).
- Delivered: separate React/Vite and Express applications, shared root commands, Prisma/PostgreSQL wiring, validation, error handling, and baseline quality tooling.
- Tests: current lint, typecheck, tests, and build pass.
- Limitation: deployment remains unconfigured.

### Database Schema

- Branch: `feature/database-schema` (contained in `master`).
- Delivered: core CRM models, relations, constraints, enums, migration, and schema contract tests.
- Tests: five schema contract tests pass; the initial migration was previously verified against PostgreSQL.
- Limitation: no seed script or assessment demo dataset exists.

### Authentication

- Branch: `feature/authentication` (contained in `master`).
- Delivered: customer-only registration, all-role login, JWT middleware, backend RBAC, `/auth/me`, browser session state, protected routes, and logout.
- Tests: focused client and server authentication tests pass; a prior live ADMIN login and `/auth/me` run passed.
- Limitation: eight-hour access tokens are locally stored with no refresh, revocation, or production session infrastructure.

### Customer Management

- Branch: `feature/customer-management` (contained in `master`).
- Delivered: protected customer CRUD/search, conservative deletion, customer notes, support summaries, complete safe customer ticket history with FULL/SUMMARY_ONLY access, responsive screens, and localized states.
- Tests: customer API, schema, page, and edit-cache regression tests pass.
- Limitation: file upload is not implemented.

### Frontend Localization / RTL

- Branch: `fix/frontend-localization` (contained in `master`).
- Delivered: persisted English/Arabic switching, root `lang`/`dir`, localized implemented screens, locale formatting, and direction isolation for technical values.
- Tests: localization, language-switcher, and relevant page tests pass; prior browser verification covered English and Arabic.
- Limitation: future features still require their own translations and RTL checks.

### Bilingual Typography

- Branch: `fix/bilingual-typography` (contained in `master`; commit `4d188bd` ancestry verified).
- Delivered: self-hosted Inter Latin and Cairo Arabic subsets, four production weights, one mixed-script font stack, inherited form typography, and semantic language labels.
- Verification: current client tests, lint, typecheck, and production build pass; prior English/Arabic checks confirmed localization and RTL behavior remained intact.
- Limitation: the production bundle still has the separate non-failing Vite chunk-size warning.

### Ticket Management

- Branch: `feature/ticket-management` (contained in `master`; commit `0165f50` ancestry verified).
- Delivered: protected ticket queue/detail/create/update flows, assignment, priority/category/status workflow, history, server-scoped AGENT visibility, SLA snapshots, responsive TanStack Table/cards, and localized forms/details.
- Verification: current client/server suites and quality gates pass; a prior PostgreSQL happy-path verified the implemented workflow and SLA snapshot behavior.
- Limitation: attachments and background SLA automation remain unimplemented.

### Ticket Conversation

- Branch: `feature/ticket-conversation` (contained in `master`; commit `879762e` ancestry verified).
- Delivered: internal public-message/private-note timeline, authorized reply/note mutations, and transactional one-time first-response recording.
- Verification: current client/server suites and quality gates pass; prior PostgreSQL verification covered conversation and first-response behavior.
- Limitation: no separate browser capture was completed for the internal conversation workspace.

### Agent Dashboard

- Branch: `feature/agent-dashboard` (contained in `master`; commit `d12067b` ancestry verified).
- Delivered: role-scoped overview API, real KPIs/status distribution, request-time SLA derivation, bounded Needs Attention/recent lists, responsive localized UI, and the integrated AGENT customer-authorization/support-context refinements.
- Verification: current automated suites and quality gates pass; prior read-only PostgreSQL/API verification covered Dashboard scoping and the Customer Management refinements.
- Limitation: authenticated ADMIN/MANAGER and AGENT English/Arabic desktop/mobile Dashboard visual verification was not completed.

### Customer Portal

- Branch: `feature/customer-portal` (contained in `master`; commit `458af2e` ancestry verified).
- Delivered: CUSTOMER-only ownership boundary, IDOR-safe overview/list/detail/create/reply APIs, resolved-ticket reopening, public-only conversation, and final responsive English/Arabic Portal navigation and page polish.
- Verification: current 82-client/87-server suite passes; prior two-customer PostgreSQL verification covered ownership, IDOR, creation, replies, transitions, and SLA-safe behavior, while 14 authenticated English/Arabic desktop/mobile captures and final navigation regression checks verified the Portal UI.
- Limitation: Portal Knowledge Base, attachments, feedback, notifications, realtime updates, profile editing, and external channels remain deferred.

## 4. Current Work

- `feature/sla` is implemented from `master` synchronized with `origin/master` at feature start. The Dashboard ticket-queue fix it builds on is already contained in `master`.
- Shared derivation: the Dashboard's local SLA derivation moved to a pure `server/src/shared/sla/derive-sla.ts` module owning `SlaState`, `SlaTarget`, the fixed 60-minute `SLA_WARNING_MINUTES` constant, and `deriveSla(ticket, now)`. `now` is injected; terminal (`RESOLVED`/`CLOSED`/`resolvedAt`/`closedAt`) returns `MET` with null target and deadline; while `firstRespondedAt` is null the first-response deadline applies, the resolution deadline applies while non-terminal, the earlier deadline wins, and an exact tie prefers `FIRST_RESPONSE`; `dueAt <= now` is `BREACHED`, `0 < remaining <= 60min` is `AT_RISK` (60 minutes exactly is `AT_RISK`), `> 60min` is `ON_TRACK`; a configured-and-completed first response with no resolution deadline returns `MET`; otherwise `NOT_CONFIGURED` with null target and deadline. Boundaries use millisecond UTC `Date` math with no minute rounding.
- Dashboard: `getDashboardOverview` now calls the shared helper; the `GET /api/dashboard/overview` response shape, role visibility, active-ticket definitions, KPI meanings, warning window, Needs Attention / Recent ordering, list sizes, and safe summaries are unchanged. `effectiveSlaTarget` is not added to Dashboard items.
- Ticket Details: `GET /api/tickets/:id` adds `slaState`, `effectiveSlaDueAt`, and `effectiveSlaTarget`, derived only after existing authorization/visibility succeeds, alongside the unchanged raw `firstResponseDueAt`, `firstRespondedAt`, `resolutionDueAt`, `resolvedAt`, and `closedAt`. No Ticket List or Portal contract change; `CUSTOMER` and unauthenticated callers remain rejected.
- Portal: no SLA field added to `/api/portal/*`; server and client regression assertions confirm Portal responses and pages never expose `slaState`, `effectiveSlaDueAt`, `effectiveSlaTarget`, `firstResponseDueAt`, `firstRespondedAt`, or `resolutionDueAt`.
- Frontend: a compact bordered SLA subsection inside the existing Ticket Details metadata surface (not a nested card) shows the localized state with a text label plus restrained semantic accent (state never conveyed by color alone), the localized effective target, the effective deadline when applicable, and the raw first-response deadline, first-response completion, and resolution deadline. Dates use the existing locale formatter with `<bdi dir="ltr">` isolation. No countdown, interval, polling, or client-side state derivation. Full English and Arabic strings added; RTL mirrors through document direction.
- Verification: 103 client and 126 server tests pass (229 total, 0 failed/skipped/todo), including 18 shared-helper boundary tests, ADMIN/MANAGER/AGENT Ticket Details derived-field coverage, unauthenticated/CUSTOMER rejection, raw-snapshot presence, Portal SLA-free server and client assertions, Dashboard response-shape regression, and 5 Ticket Details SLA-state UI tests plus target-label, deadline-formatting, missing-deadline, first-response-completion, English, Arabic, and RTL tests. Client/server lint, typecheck, builds, translation JSON, `git diff --check`, and OpenWolf validation pass. The existing Vite chunk-size warning remains.
- PostgreSQL verification and authenticated English/Arabic desktop/mobile browser verification of the SLA presentation were not performed this session; deterministic boundary tests cover every SLA state. Prior feature verification evidence is preserved unchanged below.
- All `feature/sla` changes remain unstaged and uncommitted. No stage, commit, push, merge, rebase, amend, or tag was performed.

## 5. Next Recommended Work

1. Developer review and manual browser/PostgreSQL verification of `feature/sla`, then manual commit/integration if accepted.
2. Add realistic demo seed data and demo accounts covering the critical support journey and a range of live SLA states.
3. Run final end-to-end QA, accessibility, responsive, English/Arabic, and RTL review.
4. Complete deployment preparation and verification.

This follows the P0 roadmap and the dependency order in `docs/01-scope-and-priorities.md`, `docs/14-implementation-plan.md`, and `docs/18-ui-pages-spec.md`.

## 6. Remaining Scope

### Core Remaining

- Final SLA presentation or monitoring scope beyond the implemented snapshots, first-response timestamp, and request-time Dashboard derivation; background automation remains deferred unless separately promoted.
- Realistic seed/demo data and demo accounts covering the critical support journey.
- Final integrated end-to-end assessment QA.
- Authenticated ADMIN/MANAGER and AGENT English/Arabic desktop/mobile Dashboard visual verification.
- Deployment preparation and verification.
- Remaining responsive and accessibility checks across the integrated journey.

### Secondary

- Attachments, knowledge base, in-app notifications, reports, quick replies, customer feedback, and richer ticket history.
- Complete demo seed data for users, customers, tickets, conversations, articles, SLA states, and feedback.

### Deferred / Demonstration Only

- AI assistance, automatic assignment, general audit logs, multi-department behavior, and multi-branch behavior remain P2.
- WhatsApp, SMS, inbound email ingestion, production live chat transport, ERP, arbitrary external systems, and a full AI chatbot remain P3 architecture/demo scope.

## 7. Known Limitations

- No refresh-token, token-revocation, or production session infrastructure.
- Customer Portal Knowledge Base, attachments, feedback, notifications, profile editing, and external messaging integrations remain deferred.
- No attachment upload/storage provider; attachment contexts still require service-level presence and ownership validation.
- No real-time messaging or provider-backed communication channel.
- Basic SLA presentation exists: deadline snapshots on creation, eligible priority-change recalculation, one-time first-response recording, and one shared request-time `deriveSla` helper (`ON_TRACK` / `AT_RISK` / `BREACHED` / `MET` / `NOT_CONFIGURED` plus an explicit `FIRST_RESPONSE` / `RESOLUTION` / null target) consumed by the Agent Dashboard and authorized internal Ticket Details. On `feature/sla` (unstaged), internal Ticket Details renders a compact localized SLA subsection; Portal behavior remains SLA-safe without exposing raw or derived internal fields. Background workers, scheduled monitoring, persisted SLA state or breach events, notifications, automatic escalation/assignment, SLA reports, and SLA administration do not exist.
- No knowledge base, notifications, reports, feedback workflow, or AI actions.
- No seed script or realistic required demo dataset.
- No automated visual regression suite; current visual evidence is manual/headless-browser verification from prior feature work.
- Production build succeeds with a Vite warning for a JavaScript chunk larger than 500 kB.
- Prisma CLI's dependency tree has a known high-severity development advisory; the suggested forced downgrade was intentionally not applied.

## 8. Database / Infrastructure Status

- PostgreSQL: a configured development database was previously reachable; no credentials are recorded here.
- Prisma: one initial migration exists and was previously reported applied/current against the development database.
- Schema readiness: core CRM schema is present and contract-tested, including users, customers, tickets, messages, notes, attachments, history, SLA, knowledge, notifications, feedback, quick replies, departments, and branches.
- Seed/demo data: no `server/prisma/seed.ts` exists; the documented demo dataset is not ready.
- Deployment: no deployed frontend/API verification or deployment configuration is present.

## 9. Testing Status

Verified on unstaged/uncommitted `feature/sla` based on `master` synchronized with `origin/master` at feature start, on 2026-08-26.

| Command / category | Files | Passed | Failed | Skipped | Todo | Exit code | Evidence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Client tests: `npm --prefix client run test` | 16 | 103 | 0 | 0 | 0 | 0 | Complete Vitest client suite passed, including the new Ticket Details SLA presentation tests and the Portal SLA-free assertion. |
| Server tests: `npm --prefix server run test` | 9 | 126 | 0 | 0 | 0 | 0 | Complete Vitest server suite passed, including 18 shared `deriveSla` boundary tests. Expected handled stderr from the negative CORS and simulated failed-write tests did not fail the suite. |
| Combined/root tests: `npm run test` | 25 | 229 | 0 | 0 | 0 | 0 | Root command ran both configured suites successfully. |
| Client lint: `npm --prefix client run lint` | — | — | — | — | — | 0 | ESLint passed. |
| Server lint: `npm --prefix server run lint` | — | — | — | — | — | 0 | ESLint passed. |
| Client typecheck: `npm --prefix client run typecheck` | — | — | — | — | — | 0 | TypeScript project check passed. |
| Server typecheck: `npm --prefix server run typecheck` | — | — | — | — | — | 0 | TypeScript no-emit check passed. |
| Client build: `npm --prefix client run build` | — | — | — | — | — | 0 | Production build passed; Vite retained the non-failing warning for a minified JavaScript chunk larger than 500 kB. |
| Server build: `npm --prefix server run build` | — | — | — | — | — | 0 | TypeScript production build passed. |
| Shared SLA helper: `server/src/shared/sla/derive-sla.test.ts` | 1 | 18 | 0 | 0 | 0 | 0 | NOT_CONFIGURED, first-response and resolution boundaries at 61/60/30/0/-1 minutes, earlier-deadline selection, exact-tie FIRST_RESPONSE, completed-first-response switch to resolution and MET, terminal status/timestamp MET, and ISO serialization. |
| Ticket Details API regression: `server/src/modules/tickets/ticket.test.ts` | 1 | 43 | 0 | 0 | 0 | 0 | ADMIN/MANAGER/AGENT receive derived SLA plus unchanged raw snapshots; unauthenticated 401 and CUSTOMER 403 without a visibility query; existing visibility, creation snapshot, priority recalculation, first-response, and internal-note behavior unchanged. |
| Dashboard regression: `server/src/modules/dashboard/dashboard.test.ts` | 1 | 10 | 0 | 0 | 0 | 0 | Counts, visibility, ranking, safe projection, and `effectiveSlaTarget`-free item shape unchanged after helper extraction. |
| Portal security regression: `server/src/modules/portal/portal.test.ts` | 1 | 11 | 0 | 0 | 0 | 0 | Portal detail body has none of `slaState`, `effectiveSlaDueAt`, `effectiveSlaTarget`, `firstResponseDueAt`, `firstRespondedAt`, `resolutionDueAt`. |
| Translation JSON validation | 2 files | 2 | 0 | — | — | 0 | English and Arabic translation JSON parsed successfully with matching `tickets.sla.*` keys. |
| Whitespace: `git diff --check` | — | — | — | — | — | 0 | No trailing-whitespace or conflict markers. |
| OpenWolf validation | 10 core files / 7 hooks | — | 0 | — | — | 0 | `openwolf status` reported all core files, hook scripts, and registered hook matchers present. |

Current verification evidence:

- PostgreSQL/API: not performed this session for the SLA presentation. Deterministic automated coverage exercises every SLA state and boundary.
- SLA presentation visual verification: not performed this session; authenticated browser verification of the Ticket Details SLA subsection in English/Arabic desktop/mobile remains outstanding.

Prior verification evidence preserved without claiming a rerun:

- PostgreSQL/API: Ticket Management, Ticket Conversation, Agent Dashboard, AGENT Customer Management boundaries, and two-customer Portal ownership/IDOR/workflow checks were previously completed. The Portal database run observed the documented null-deadline fallback because no active MEDIUM SLA rule existed.
- Portal visual verification: 14 authenticated English/Arabic desktop/mobile captures and the final route-exact navigation regression verification were previously completed.
- Earlier Dashboard visual verification was also incomplete because authenticated capture attempts redirected to login.

These results cover implemented features, not the unimplemented project scope.

## 10. Branch Tracking

| Branch / area | Purpose | Integration state | Ancestry evidence |
| --- | --- | --- | --- |
| `master` | Synchronized integration branch | Equals `origin/master` at feature start | Local/remote ahead 0, behind 0. |
| Project Foundation | Client/server foundation | Contained in `master` | Local feature ref is an ancestor of `master`. |
| Database Schema | CRM Prisma schema and migration | Contained in `master` | Local feature ref is an ancestor of `master`. |
| Authentication | Authentication and RBAC | Contained in `master` | Local feature ref is an ancestor of `master`. |
| Customer Management | Customer APIs, UI, and later authorization/support-context refinements | Contained in `master` | Base feature ref and commit `d12067b` are ancestors of `master`. |
| Frontend Localization / RTL | English/Arabic localization and RTL | Contained in `master` | Local fix ref is an ancestor of `master`. |
| Frontend Design Polish | Shell/design polish, edit-cache fix, and TanStack Table adoption | Contained in `master` | Local fix ref is an ancestor of `master`. |
| Bilingual Typography | Inter/Cairo typography system | Contained in `master` | Commit `4d188bd` is an ancestor of `master`. |
| Ticket Management | Ticket queue, create/detail/update, assignment, workflow, history, and SLA snapshots | Contained in `master` | Commit `0165f50` is an ancestor of `master`. |
| Ticket Conversation | Public replies, internal notes, timeline, and first-response recording | Contained in `master` | Commit `879762e` is an ancestor of `master`. |
| Agent Dashboard and customer refinements | Operational Dashboard and Customer Management authorization/support context | Contained in `master` | Commit `d12067b` is an ancestor of `master`. |
| Customer Portal | Owned customer support journey and final Portal polish | Contained in `master` | Commit `458af2e` is an ancestor of `master`. |
| Dashboard ticket-queue fix | Role-aware primary queues and Recent exclusion | Contained in `master` | Commit `3c4ba49` is an ancestor of `master`. |
| SLA presentation | Shared request-time `deriveSla` helper, Ticket Details derived fields and UI, Portal SLA-free assertions | Implemented on `feature/sla`; unstaged and uncommitted | No `feature/sla` commit exists; branch tip equals `master` and Git ancestry does not show integration. |

“Contained in `master`” means Git ancestry confirms the cited commit or local branch ref is an ancestor of `master`; it does not infer how integration occurred.

## 11. Documentation Coverage

| Area | Coverage |
| --- | --- |
| Project overview and priorities | ✅ |
| Architecture and folder structure | ✅ |
| Database design | ✅ |
| API contract | ✅ |
| Authentication / RBAC | ✅ |
| Ticket workflow | ✅ |
| SLA / automation | ✅ |
| Frontend guidelines and UI pages | ✅ |
| Backend guidelines | ✅ |
| AI behavior | ✅ |
| Testing strategy | ✅ |
| Deployment | ✅ |
| Implementation plan and branch workflow | ✅ |
| Definition of done and decisions log | ✅ |

Coverage means a governing document exists; it does not mean the feature is implemented.

## 12. Risks / Watch Items

- The customer PATCH response is intentionally narrower than customer detail; future mutations must preserve the established invalidate/refetch cache pattern.
- Live database and manual UI verification are not part of the default automated test command and must remain explicit completion checks.
- Missing demo seed data will make end-to-end assessment and report/dashboard verification harder.
- Authenticated Dashboard browser visual verification remains incomplete.
- Deployment preparation and deployed frontend/API verification have not been completed.
- Background SLA workers, scheduled monitoring, persisted breach events, notifications, and automatic escalation are not implemented.
- No upload/storage provider or complete attachment ownership-validation service exists.
- Authentication has no refresh-token or server-side revocation infrastructure.
- The production client build retains a non-failing JavaScript chunk-size warning above 500 kB.
- Prisma CLI's development dependency tree retains the reported high-severity advisory; the suggested forced downgrade remains intentionally unapplied.
- No automated visual regression suite exists.
- Advanced integrations are intentionally deferred and must not be represented as functional.

## 13. Definition of Project Completion

### MVP / Core Assessment Completion

The P0 journey is complete when authenticated internal users can manage customers and tickets, assign and progress tickets, exchange public replies, add private notes, see basic SLA state, use an agent dashboard, and securely complete the customer-side ticket journey. Relevant authorization, validation, loading/empty/error states, responsive behavior, RTL, tests, real database verification, build checks, and a realistic demo dataset must also pass.

### Optional Stretch Completion

P1 work adds attachments, ticket history, knowledge base, in-app notifications, reports, quick replies, feedback, and broader bilingual coverage. P2 AI, automation, audit, department, and branch behavior is optional and must not delay P0. P3 provider integrations remain demonstration/architecture scope unless explicitly promoted.

## 14. Progress Tracking Update Protocol

After completing or materially changing a feature:

1. Re-read the relevant feature docs.
2. Inspect actual repository state.
3. Update only affected rows/sections in this file.
4. Update `Last Updated`.
5. Move feature status only when evidence supports it.
6. Remove fixed limitations.
7. Add new limitations only if they are real.
8. Never mark work merged unless Git history confirms it.
9. Do not use this file as a replacement for feature/domain documentation.

## Customer Portal

- Status: complete and integrated into `master`; commit `458af2e` ancestry confirms containment.
- Delivered: isolated owned Portal API, overview, active categories, paginated list, server-owned creation/SLA snapshot, safe public detail, reply transitions, and responsive English/Arabic UI.
- Deferred: attachments, Knowledge Base, feedback, notifications, realtime updates, profile editing, and external channels.
- Verification: the 2026-08-26 rerun passed 82 client and 87 server tests (169 total), with client/server lint, typecheck, and builds, translation JSON, and OpenWolf integrity passing. Prior real PostgreSQL verification passed for two-customer isolation, IDOR-safe reads/replies, server-derived defaults, creation history, WAITING_CUSTOMER/RESOLVED/CLOSED reply behavior, and unchanged first response/deadline preservation. No active MEDIUM SLA rule existed, so that prior run observed the documented null-deadline fallback rather than a non-null SLA snapshot.
- UI polish: the legacy customer AppShell no longer wraps PortalShell; the complete Home, My Requests, and New Request navigation is route-exact, geometrically centered on desktop, centered in a full-width mobile row, and presented as conventional text links with an active underline and accessible focus state. Forms, filters, request tables/cards, and page actions have visible accessible responsive treatment. Authenticated English/Arabic desktop captures covered all four routes, and English/Arabic mobile captures covered home, list, and creation with one header, one active item, visible controls, RTL, and no overflow. The final navigation regression suite passes 6/6 with client typecheck and whitespace validation passing.
