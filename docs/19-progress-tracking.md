# Customer Support CRM — Progress Tracking

Last Updated: 2026-08-26

Current Integration Branch: `master` at `19fbedde` (`19fbedde3da4249ed68e4fd79b65fe61e3a210e4`), synchronized with `origin/master` before this fix branch was created

Current Working Branch: `fix/dashboard-ticket-queues` at `3c4ba49` - implementation is committed locally; this verification-count reconciliation remains unstaged

> This file is a status summary. Requirements, architecture, API contracts, RBAC rules, workflows, UI specifications, and architecture decisions remain authoritative in their respective documents.

## 1. Overall Status

- `master` at `19fbedde` contains Project Foundation, Database Schema, Authentication, Customer Management, Localization and RTL, Frontend Design Polish, TanStack Table adoption, Bilingual Typography, Ticket Management, Ticket Conversation, Agent Dashboard, Customer Portal, and the reviewed Ticket authorization/workflow fix.
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
| Agent Dashboard | ✅ FIX IMPLEMENTED AND VERIFIED | `fix/dashboard-ticket-queues` | Explicit role-derived primary queues; AGENT active assigned-only work; backend Recent exclusion after primary selection | Localized role-aware headings, non-duplicate sections, fixed-width scrollable tables, overflow-safe mobile cards, and stale-response crash protection | 94 client / 104 server passing | Yes | Implementation is committed locally at `3c4ba49`; tracker reconciliation is unstaged. Browser visual verification remains incomplete. |
| Customer Portal | ✅ COMPLETE | `feature/customer-portal` | Customer-owned Portal APIs, IDOR-safe ownership, creation, public replies, and reopening | Final responsive English/Arabic Portal shell, overview, list, creation, detail, and navigation polish | 82 client / 87 server passing | Yes, prior verified run | Commit `458af2e` ancestry confirms integration into `master`. Authenticated English/Arabic desktop and mobile visual verification and final navigation regression verification were completed previously. |
| SLA / Automation | 🟡 PARTIAL | `feature/ticket-management`, `feature/ticket-conversation`, `feature/agent-dashboard`, `feature/customer-portal` | Deadline snapshots/recalculation, one-time first-response recording, Dashboard derivation, and Portal-safe behavior | Implemented SLA presentation uses `ON_TRACK`, `AT_RISK`, `BREACHED`, `MET`, and `NOT_CONFIGURED` where applicable | Passing | Yes, prior verified run | Basic SLA tracking implemented; automation remains partial/deferred. No background workers, scheduled monitoring, persisted breach events, notifications, or automatic escalation. |
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
| Final QA | 🟡 INCOMPLETE | — | Current working scope passes automated and PostgreSQL checks | Current working scope passes automated checks | 16 client files / 92 tests; 8 server files / 104 tests; 196 total passed, 0 failed | Yes for this fix | Representative authenticated English/Arabic Dashboard browser verification remains incomplete because headless captures never advanced beyond blank/loading output. |

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

- `fix/dashboard-ticket-queues` is implemented from synchronized `master` at `19fbedde`.
- Backend: role-derived `primaryQueueType`/`primaryTickets`; AGENT primary work is active and assigned-only; Recent Tickets excludes primary IDs before its eight-item limit while retaining role visibility.
- Frontend: auth-context role headings, localized assigned/recent empty states, explicit Dashboard column sizing, bounded horizontal table overflow, two-line long-value containment, LTR ticket IDs, and compact mobile cards.
- Verification: 94 client and 104 server tests passed (198 latest independently verified); focused Dashboard tests are 12/12 client and 10/10 server; Ticket visibility regression is 39/39. Client/server lint, typecheck, builds, translation JSON, and PostgreSQL role checks passed. The existing Vite chunk-size warning remains.
- PostgreSQL observed AGENT `MY_ASSIGNED_TICKETS` with 2 primary, 3 recent, 0 duplicates, 0 unassigned primary, and 0 terminal primary; ADMIN observed `NEEDS_ATTENTION` with 5 primary and 0 duplicates.
- Six authenticated headless browser attempts covered the requested breakpoint/language matrix, but the captures remained blank or on loading output even against a healthy isolated API. No visual verification is claimed.
- The implementation is committed locally at `3c4ba49`. This tracker reconciliation remains unstaged. Git ancestry does not show integration into `master`, and no push was performed or verified by the AI.

## 5. Next Recommended Work

1. Developer review and manual browser verification of `fix/dashboard-ticket-queues`, then manual commit/integration if accepted.
2. Continue with `feature/sla` only after this fix is integrated.
3. Add realistic seed/demo data and demo accounts.
4. Run final end-to-end QA, accessibility, responsive, English/Arabic, and RTL review.
5. Complete deployment preparation and verification.

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
- Basic SLA tracking exists: deadline snapshots on creation, eligible priority-change recalculation, one-time first-response recording, and Dashboard request-time `ON_TRACK` / `AT_RISK` / `BREACHED` / `MET` / `NOT_CONFIGURED` derivation. Portal behavior remains SLA-safe without exposing internal fields. Background workers, scheduled monitoring, persisted breach events, notifications, and automatic escalation do not exist.
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

Verified on unstaged/uncommitted `fix/dashboard-ticket-queues` based on synchronized `master` at `19fbedde3da4249ed68e4fd79b65fe61e3a210e4` on 2026-08-26.

| Command / category | Files | Passed | Failed | Skipped | Todo | Exit code | Evidence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Client tests: `npm --prefix client run test` | 16 | 94 | 0 | 0 | 0 | 0 | Complete Vitest client suite passed after stale-response regression coverage was added. |
| Server tests: `npm --prefix server run test` | 8 | 104 | 0 | 0 | 0 | 0 | Complete Vitest server suite passed. Expected handled stderr from the negative CORS and simulated failed-write tests did not fail the suite. |
| Combined/root tests: `npm run test` | 24 | 196 | 0 | 0 | 0 | 0 | Root command reran both configured suites successfully. |
| Client lint: `npm --prefix client run lint` | — | — | — | — | — | 0 | ESLint passed. |
| Server lint: `npm --prefix server run lint` | — | — | — | — | — | 0 | ESLint passed. |
| Client typecheck: `npm --prefix client run typecheck` | — | — | — | — | — | 0 | TypeScript project check passed. |
| Server typecheck: `npm --prefix server run typecheck` | — | — | — | — | — | 0 | TypeScript no-emit check passed. |
| Client build: `npm --prefix client run build` | — | — | — | — | — | 0 | Production build passed; Vite retained the non-failing warning for a minified JavaScript chunk larger than 500 kB. |
| Server build: `npm --prefix server run build` | — | — | — | — | — | 0 | TypeScript production build passed. |
| Focused Dashboard client/server | 2 | 22 | 0 | 0 | 0 | 0 | Role headings, queue scope/order, exclusion, safe projection, stale-response compatibility, localization, semantics, and overflow behavior passed. |
| Ticket visibility regression | 1 | 39 | 0 | 0 | 0 | 0 | Existing internal Ticket visibility and authorization suite passed unchanged. |
| Translation JSON validation | 2 files | 2 | 0 | — | — | 0 | English and Arabic translation JSON parsed successfully. |
| OpenWolf validation | 10 core files / 7 hooks | — | 0 | — | — | 0 | All `.wolf/*.json` files parsed; `openwolf status` reported all core files, hook scripts, and registered hook matchers present. |

Current verification evidence:

- PostgreSQL/API: isolated-port requests using real ADMIN and AGENT identities passed queue type, active assigned-only AGENT primary scope, system-wide ADMIN scope, and zero cross-section duplicate checks.
- Dashboard visual verification: incomplete; six authenticated English/Arabic captures at 1440, 1280, 1024, 768, and 375 pixels stayed blank or on structured loading output despite a healthy isolated API, so no visual pass is claimed.

Prior verification evidence preserved without claiming a rerun:

- PostgreSQL/API: Ticket Management, Ticket Conversation, Agent Dashboard, AGENT Customer Management boundaries, and two-customer Portal ownership/IDOR/workflow checks were previously completed. The Portal database run observed the documented null-deadline fallback because no active MEDIUM SLA rule existed.
- Portal visual verification: 14 authenticated English/Arabic desktop/mobile captures and the final route-exact navigation regression verification were previously completed.
- Earlier Dashboard visual verification was also incomplete because authenticated capture attempts redirected to login.

These results cover implemented features, not the unimplemented project scope.

## 10. Branch Tracking

| Branch / area | Purpose | Integration state | Ancestry evidence |
| --- | --- | --- | --- |
| `master` | Synchronized integration branch | `bc25a02`; equals `origin/master` before this documentation edit | Local/remote ahead 0, behind 0. |
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
