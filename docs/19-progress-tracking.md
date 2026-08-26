# Customer Support CRM — Progress Tracking

Last Updated: 2026-08-26 (feature/attachments implemented, not integrated)

Current Integration Branch: `master` at `ef647ef` (`ef647ef0d618bd645764b5680abc7f947a0cac77`), equal to the `origin/master` tracking ref (local/remote ahead 0, behind 0). `ef647ef feat: implement knowledge base` sits directly on `d89cf47 docs: reconcile task coverage and implementation roadmap` (a documentation-only commit on top of `e387667` / `e7d9b14 feat: complete basic SLA presentation`). Both `feature/sla` (`e7d9b14`) and `feature/knowledge-base` (`ef647ef`) are contained in `master`; `ef647ef` was integrated by fast-forward with no merge commit.

Current Working Branch: `feature/attachments`, created from clean synchronized `master` at `069839a` (`docs: sync knowledge base integration status`, a docs-only commit on top of `ef647ef`; `master` == `origin/master`). Secure Attachments is implemented on this branch and **not integrated into `master`**. Nothing has been staged, committed, pushed, merged, rebased, amended, or tagged; the only non-source change is the added `@vercel/blob` + `busboy` + `@types/busboy` dependencies in `server/package.json`/`package-lock.json`.

> This file is a status summary and the single authoritative status-and-roadmap document. Requirements, architecture, API contracts, RBAC rules, workflows, UI specifications, and architecture decisions remain authoritative in their respective documents.

> Status terms are not interchangeable. `Integrated into master` = Git ancestry confirms containment. `Automated-verified` = automated tests were run and passed (historically, during the cited feature). `PostgreSQL-verified` / `Browser-verified` = a live check was actually performed. This audit reran nothing: all test counts, PostgreSQL results, and browser results below are preserved historical evidence from prior feature work.

## 1. Overall Status

- `master` (at `ef647ef`) contains Project Foundation, Database Schema, Authentication, Customer Management, Localization and RTL, Frontend Design Polish, TanStack Table adoption, Bilingual Typography, Ticket Management, Ticket Conversation, Agent Dashboard, Customer Portal, the reviewed Ticket authorization/workflow fix, the reviewed Dashboard ticket-queue fix, basic SLA presentation (`e7d9b14`), and Knowledge Base (`ef647ef`). `e387667` is a docs-only tracker update on top of `e7d9b14`; `d89cf47` is the docs-only task-coverage/roadmap reconciliation on top of `e387667`; `ef647ef` is the Knowledge Base feature on top of `d89cf47`.
- Basic SLA presentation is integrated: one shared request-time derivation helper (`server/src/shared/sla/derive-sla.ts`) consumed by both the Agent Dashboard and authorized internal Ticket Details, an explicit `effectiveSlaTarget`, derived Ticket Details response fields, a compact localized Ticket Details SLA subsection, and Portal SLA-free regression assertions.
- The end-to-end customer/agent support loop is implemented: customers can create, list, inspect, reply to, and reopen eligible requests through the owned Portal boundary, while internal staff can manage, converse on, and resolve tickets with customer context, Dashboard visibility, and clear SLA state.
- This document now carries an original-task coverage audit (section 2A). Against the full original assignment, with `feature/knowledge-base` integrated into `master` at `ef647ef`: **23 COMPLETE, 8 PARTIAL, 18 NOT_STARTED, 9 ARCHITECTURE_ONLY, 1 INTENTIONALLY_DEFERRED** — 59 requirement rows (5 Knowledge Base / Portal-FAQ rows are COMPLETE). Most remaining non-P0 areas are still `NOT_STARTED`, not intentionally cut.
- The project is not finished or production-ready: Quick Replies, Customer Feedback, Reports, Users Management, Settings, Notifications, SLA automation, Tasks/Reminders, Team Collaboration, AI assistance, Custom Branding, realistic demo data, final integrated QA, unresolved Dashboard and SLA visual verification, and deployment verification all remain. Attachments upload/download is implemented on the uncommitted `feature/attachments` branch (automated-verified only) and awaits developer review/integration.
- Knowledge Base (`feature/knowledge-base`, roadmap order 1) is integrated into `master` at `ef647ef` and automated-verified: internal `/api/knowledge-articles` CRUD (`ADMIN`/`MANAGER` manage, `AGENT` read-only, `CUSTOMER`/anon rejected), published-only `/api/portal/knowledge-articles`, internal `/knowledge-base` routes + nav item + `AGENT` editor guard, `/portal/knowledge-base` Help Center, English/Arabic + RTL, full state handling, and backend + frontend regression tests. No Prisma schema or migration change; no popularity tracking, no article versions, no rich-text editor, no related-article recommendations. PostgreSQL and browser verification were not performed.
- Provider-backed channels and other production external integrations remain architecture/demo-only (ADR-002, ADR-019).
- `feature/attachments` (roadmap order 2) is implemented on its branch and automated-verified; it is **not** in `master`. Next implementation feature after integration: `feature/quick-replies` (section 5, roadmap order 3). Final demo seed data is **not** the next task (section 6A).

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
| Agent Dashboard | ✅ COMPLETE | `fix/dashboard-ticket-queues`, SLA helper extraction on `feature/sla` (both contained in `master`) | Explicit role-derived primary queues; AGENT active assigned-only work; backend Recent exclusion after primary selection; now uses the shared SLA derivation helper without response-shape change | Localized role-aware headings, non-duplicate sections, fixed-width scrollable tables, overflow-safe mobile cards, and stale-response crash protection | 103 client / 126 server passing | Yes, prior verified run | Dashboard queue fix and the SLA helper extraction are integrated into `master` at `e7d9b14`; dashboard regression tests confirm unchanged counts, visibility, ranking, response shape, and boundaries. Browser visual verification remains incomplete. |
| Customer Portal | ✅ COMPLETE | `feature/customer-portal` | Customer-owned Portal APIs, IDOR-safe ownership, creation, public replies, and reopening | Final responsive English/Arabic Portal shell, overview, list, creation, detail, and navigation polish | 82 client / 87 server passing | Yes, prior verified run | Commit `458af2e` ancestry confirms integration into `master`. Authenticated English/Arabic desktop and mobile visual verification and final navigation regression verification were completed previously. |
| SLA / Automation | ✅ BASIC PRESENTATION COMPLETE | `feature/sla` (commit `e7d9b14`, contained in `master`) | Deadline snapshots/recalculation, one-time first-response recording, Portal-safe behavior, and one shared request-time derivation helper (`SlaState` + `SlaTarget` + fixed 60-minute window) consumed by Dashboard and authorized internal Ticket Details | Dashboard SLA presentation unchanged; internal Ticket Details gains a compact localized English/Arabic SLA subsection (state, effective target, effective deadline, raw first-response/resolution deadlines, first-response completion) using derived API fields, text-not-color-alone, LTR-isolated dates, no countdown | 103 client / 126 server passing | Not verified against PostgreSQL this session; 18 deterministic boundary tests cover all states | Basic SLA presentation and shared derivation are integrated into `master` at `e7d9b14`. Deferred: background workers, scheduled monitoring, persisted SLA state/breach events, notifications, automatic escalation/assignment, SLA reports, and SLA administration. PostgreSQL and authenticated browser verification of the Ticket Details SLA subsection remain outstanding. |
| Knowledge Base | ✅ COMPLETE — integrated into master | `feature/knowledge-base` (roadmap order 1), integrated into `master` at `ef647ef` | `server/src/modules/knowledge-base/*`: internal `GET/POST/PATCH/DELETE /api/knowledge-articles` (ADMIN/MANAGER manage, AGENT read-only), published-only `GET /api/portal/knowledge-articles(/:id)`; server-derived `createdById`; safe projections; both routers registered in `app.ts` | `client/src/features/knowledge-base/*` list/detail/editor + `/knowledge-base*` routes, nav item, AGENT editor guard; `client/src/features/portal/portal-knowledge-pages.tsx` + `/portal/knowledge-base*` Help Center | 37 server (`knowledge-article.test.ts` 31, `knowledge-article.portal.test.ts` 6) + 32 client (`knowledge-base.test.tsx` 23, `knowledge-article-hooks.test.tsx` 3, `portal-knowledge.test.tsx` 6) + guard/routing coverage; full suites at `ef647ef`: client 141 / server 163 / 304 total, 0 failed / 0 skipped / 0 todo | Not PostgreSQL/browser verified (not rerun in this documentation-only task); deterministic mocked tests cover every path | Commit `ef647ef`. No schema change. Limitations: no popularity/view tracking, no article versioning, no rich-text editing, no related-article recommendations. Historical Vite chunk-size warning remains non-failing. Unblocks AI suggested-solution and Reports content. |
| Quick Replies | ⚪ NOT_STARTED | `feature/quick-replies` (planned, order 3) | Schema only (`QuickReply`) | Not implemented | Schema only | Schema only | No management API, no composer insertion. |
| Customer Feedback | ⚪ NOT_STARTED | `feature/customer-feedback` (planned, order 4) | Schema only (`Feedback`) | Not implemented | Schema only | Schema only | Primary demo journey depends on it (satisfaction reporting). |
| Reports | ⚪ NOT_STARTED | `feature/reports` (planned, order 5) | Not implemented | Not implemented | None | No | Operational Dashboard is not Reports. Depends on feedback for satisfaction. |
| Users Management | 🟡 PARTIAL | `feature/user-management` (planned, order 6) | `GET /users/agents` lookup only; RBAC enforced elsewhere | Role-aware guards only | `auth.test.ts`, `middleware/auth.test.ts` | Prior PostgreSQL | No user CRUD, no `/users` page. |
| Settings | ⚪ NOT_STARTED | `feature/settings` (planned, order 7) | Not implemented | Not implemented | None | No | Nothing editable in-app; categories read-only, SLA rules managed directly. |
| Notifications | ⚪ NOT_STARTED | `feature/notifications` (planned, order 8) | Schema only (`Notification`) | Not implemented | Schema only | Schema only | In-app read/unread only when built. |
| SLA Automation | ⚪ NOT_STARTED | `feature/sla-automation` (planned, order 9) | Manual escalation only; no monitoring/auto-assign/alerts | Not implemented | None | No | Distinct from request-time SLA derivation, which is done. |
| Attachments | 🟢 IMPLEMENTED — not integrated | `feature/attachments` (order 2, uncommitted) | `server/src/modules/attachments/*`: private Vercel Blob adapter behind `AttachmentStorage` + in-memory test adapter; `busboy` bounded 4 MiB single-file parser; content-signature MIME allowlist; per-context authorization service; internal `GET/POST` ticket/message/customer routes + `GET /api/attachments/:id/download`; Portal `GET/POST /api/portal/tickets/:id/attachments` + `GET /api/portal/attachments/:id/download`; safe download headers; orphan cleanup on DB-after-provider failure; `GET /customers/:id` no longer leaks `storageKey` | `client/src/features/attachments/*` (list/upload + `AttachmentActions` icon Preview/Download buttons + `AttachmentPreviewDialog` in-browser image/PDF/text preview via a temp authenticated Blob URL) + sections in Ticket Details, Ticket conversation (message attachments), Customer Details tab, and Portal Ticket Details | 56 server (`attachment.test.ts`) + 49 client (`attachments.test.tsx` 44 incl. Preview action/dialog, `attachment-api.test.ts` 5); full suites on branch: client 190 / server 219 / 409 total, 0 failed | Not PostgreSQL/Blob/browser verified — automated suites use a mocked storage adapter; a local `server/.env` now carries a real private-Blob token but no live upload/download or authenticated browser check was run | No schema change. No malware scanning; no attachment deletion; **no thumbnails / image transformations** (in-browser Preview is a client presentation of the same authorized download, not a public URL and not malware scanning); no multi-file/resumable upload; DB has no uploader/size column. |
| Tasks / Reminders | ⚪ NOT_STARTED | `feature/tasks-reminders` (planned, order 10) | Not implemented | Not implemented | None | No | Product decision required before implementation. |
| Team Collaboration | 🟡 PARTIAL | `feature/team-collaboration` (planned, order 11) | Internal notes + history + assignment | Note composer/rendering | `ticket.test.ts` | Automated | Scope (mentions/watchers/handoff) undefined; product decision required. |
| AI Assistant | 🟣 DEFERRED | `feature/ai-assistant` (planned, order 12) | Not implemented | Not implemented | None | No | P2; summary → reply → categorization → KB solution. No AI output mutates a ticket or sends without human approval. Chatbot deferred (P3). |
| Custom Branding | ⚪ NOT_STARTED | `feature/custom-branding` (planned, order 13) | Not implemented | Not implemented | None | No | Product decision required before implementation. |
| Audit Logs | 🟣 DEFERRED | roadmap tail (P2) | No `AuditLog` model; `TicketHistory` is ticket-lifecycle only | Not implemented | Schema only (`TicketHistory`) | Schema only | Not a general cross-entity audit log. |
| Multi-Department | 🟣 DEFERRED | — | Schema only | Not implemented | Schema only | Schema only | P2 behavior. |
| Multi-Branch | 🟣 DEFERRED | — | Schema only | Not implemented | Schema only | Schema only | P2 behavior. |
| External Integrations | 🟣 DEFERRED | — | Channel enum representation only | Not implemented | Schema only | Schema only | WhatsApp, SMS, inbound email, live transport, ERP, and arbitrary systems are demonstration/architecture only. |
| Deployment | ⚪ NOT_STARTED | deployment branch (planned, order 16) | No deployed API evidence | No deployed frontend evidence | Local build passing | Development DB only | Deployment targets are documented but not configured or verified. |
| Final QA | 🟡 INCOMPLETE | `test/core-flows` (planned, order 15) | Automated checks passed during `feature/sla` (code unchanged since `e7d9b14`; `e387667` is docs-only) | Same | 16 client files / 103 tests; 9 server files / 126 tests; 229 total passed, 0 failed, 0 skipped, 0 todo (historical, not rerun in this audit) | Outstanding | Lint, typecheck, and builds passed historically; the non-failing Vite chunk-size warning remains. PostgreSQL and authenticated English/Arabic browser verification for the SLA presentation and the Dashboard were not performed. Broader-scope QA also depends on features in the roadmap. |

## 2A. Original-Task Coverage Matrix

Every bullet from the original assignment appears exactly once. `Status` is the primary implementation state (`COMPLETE` / `PARTIAL` / `NOT_STARTED` / `ARCHITECTURE_ONLY` / `INTENTIONALLY_DEFERRED`). Verification is recorded separately in the `DB/browser evidence` column and in section 9; a `COMPLETE` row can still have outstanding live verification. Evidence paths are relative to repo root.

### 1. Customer Management

| Requirement | Status | Backend evidence | Frontend evidence | Tests | DB/browser evidence | Gap | Planned branch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Customer profiles | COMPLETE | `server/src/modules/customers/*` — `GET/POST/PATCH/DELETE /customers`, `GET /customers/:id` | `client/src/features/customers/*` — list, detail, form pages; router `/customers*` | `customer.test.ts`, `customer-pages.test.tsx`, `customer.schemas.test.ts` | PostgreSQL-verified (prior); browser partial (prior) | — | — |
| Contact details | COMPLETE | Customer `name`/`email`/`phone`; detail representation w/ safe linked-user fields | Contact info in detail Overview | `customer.test.ts` | PostgreSQL-verified (prior) | — | — |
| Interaction history | PARTIAL | Activity derived from customer timestamps + `CustomerNote` only; no unified lifecycle event feed | Customer Details Activity tab (derived) | `customer-pages.test.tsx` | Not verified this cycle | No ticket-created/replied/feedback events in one timeline; "Recent Tickets" on Overview may still be placeholder | `feature/reports` context + later activity feed |
| Notes | COMPLETE | `CustomerNote` model; `GET/POST /customers/:id/notes`; internal-only, RBAC-gated | Notes tab; agent read-only explanation | `customer.test.ts`, `customer-pages.test.tsx` | PostgreSQL-verified (prior) | — | — |
| Attachments | COMPLETE (on `feature/attachments`, uncommitted) | `server/src/modules/attachments/*` — private Vercel Blob adapter, 4 MiB signature-validated upload, per-context authorization, internal + Portal routes, safe download proxy, orphan cleanup; `GET /customers/:id` `storageKey` leak fixed | Ticket Details / conversation / Customer Details tab / Portal Ticket Details attachment sections | `attachment.test.ts` (56), `attachments.test.tsx` (44), `attachment-api.test.ts` (5) | Not PostgreSQL/Blob/browser verified (mocked adapter covers every path) | No malware scanning, no deletion, no thumbnails/image transforms, no multi-file upload; the in-browser Preview is a client presentation of the same authorized download; not integrated into `master` | `feature/attachments` |

### 2. Ticket Management

| Requirement | Status | Backend evidence | Frontend evidence | Tests | DB/browser evidence | Gap | Planned branch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Create and track tickets | COMPLETE | `ticket.routes.ts` — `GET/POST /tickets`, `GET/PATCH /tickets/:id`; pagination/filter | `features/tickets/*` — list, form, detail; router `/tickets*` | `ticket.test.ts` (26 cases), `ticket-pages.test.tsx` | PostgreSQL happy-path (prior) | — | — |
| Categories and priorities | COMPLETE | `GET /categories` lookup; `TicketPriority` enum; create/update validation | Category + priority selectors; badges | `ticket.test.ts` | PostgreSQL-verified (prior) | Category administration (CRUD) not built — see Settings | `feature/settings` (category admin) |
| Assign tickets to agents | COMPLETE | `PATCH /tickets/:id` assignment; `GET /users/agents`; ADMIN/MANAGER only; agent-created self-assign + history | Assignee control (ADMIN/MANAGER); agent create flow | `ticket.test.ts`, `ticket-edit-route.test.tsx` | PostgreSQL-verified (prior) | No automatic assignment | `feature/sla-automation` (auto-assign) |
| Status and escalation | COMPLETE | Transition matrix enforced; `ESCALATED` status; ADMIN/MANAGER enter/leave escalation | Status control, confirmed Close action | `ticket.test.ts` | PostgreSQL-verified (prior) | Automatic escalation rules not built | `feature/sla-automation` |
| Ticket history | COMPLETE | `TicketHistory` writes on create/assign/status/priority; in `GET /tickets/:id` | History section in workspace | `ticket.test.ts` | PostgreSQL-verified (prior) | Not a general audit log | — |

### 3. Communication Channels

| Requirement | Status | Backend evidence | Frontend evidence | Tests | DB/browser evidence | Gap | Planned branch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Email | ARCHITECTURE_ONLY | `Channel.EMAIL` enum only | Channel value display | — | N/A | No inbound email ingestion, no outbound email | demo-only (ADR-002) |
| WhatsApp | ARCHITECTURE_ONLY | `Channel.WHATSAPP` enum only | Channel value display | — | N/A | No provider integration | demo-only (ADR-002) |
| Live chat | ARCHITECTURE_ONLY | `Channel.LIVE_CHAT` enum only | Channel value display | — | N/A | No realtime transport | demo-only (ADR-002) |
| SMS | ARCHITECTURE_ONLY | `Channel.SMS` enum only | Channel value display | — | N/A | No provider integration | demo-only (ADR-002) |
| Web forms | COMPLETE | `Channel.WEB` default; internal `POST /tickets` and `POST /portal/tickets` | Internal create form; Portal create form | `ticket.test.ts`, `portal.test.ts` | PostgreSQL-verified (prior) | — | — |

### 4. Agent Dashboard

| Requirement | Status | Backend evidence | Frontend evidence | Tests | DB/browser evidence | Gap | Planned branch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Assigned tickets | COMPLETE | `GET /dashboard/overview` — `MY_ASSIGNED_TICKETS` primary queue for AGENT | `features/dashboard/dashboard-page.tsx` | `dashboard.test.ts`, `dashboard-page.test.tsx` | Automated-verified; browser outstanding | — | — |
| Customer information | COMPLETE | Dashboard safe customer summary; ticket workspace customer context panel | Customer context panel in ticket detail | `ticket-pages.test.tsx` | Automated-verified | — | — |
| Tasks | NOT_STARTED | none | none | none | N/A | No model, no code, no spec | `feature/tasks-reminders` (product decision required) |
| Reminders | NOT_STARTED | none | none | none | N/A | No model, no code, no spec | `feature/tasks-reminders` (product decision required) |
| Quick replies | NOT_STARTED | `QuickReply` model only | none | none | Schema only | No management API, no composer insertion | `feature/quick-replies` |
| Team collaboration | PARTIAL | Internal `TicketNote` + `CustomerNote`; assignment; history | Internal note composer; notes rendering | `ticket.test.ts` | Automated-verified (notes) | No mentions/watchers/handoff/shared-comment model; scope undefined | `feature/team-collaboration` (product decision required) |

### 5. SLA and Automation

| Requirement | Status | Backend evidence | Frontend evidence | Tests | DB/browser evidence | Gap | Planned branch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Response targets | COMPLETE | `SlaRule` per priority; `firstResponseDueAt` snapshot; one-time `firstRespondedAt`; `deriveSla` | Ticket Details SLA subsection (first-response deadline + completion) | `derive-sla.test.ts` (18), `ticket.test.ts` | Automated-verified; PostgreSQL + browser of derivation outstanding | Presentation/derivation only | verification: `test/core-flows` |
| Resolution targets | COMPLETE | `resolutionDueAt` snapshot; `MET` on RESOLVED/CLOSED; `deriveSla` | SLA subsection (resolution deadline, effective target) | `derive-sla.test.ts`, `ticket.test.ts` | Automated-verified; PostgreSQL + browser outstanding | Presentation/derivation only | verification: `test/core-flows` |
| Automatic assignment | NOT_STARTED | none (docs: manual only) | none | none | N/A | No load-based assignment | `feature/sla-automation` |
| Escalation rules | PARTIAL | Manual `ESCALATED` transitions (ADMIN/MANAGER) enforced | Escalation via status control | `ticket.test.ts` | Automated-verified (manual path) | No automatic/time-based escalation engine | `feature/sla-automation` |
| Alerts | NOT_STARTED | none | none | none | N/A | No SLA warning/breach alerting | `feature/sla-automation` |
| Notifications | NOT_STARTED | `Notification` model only | none | none | Schema only | No notification API/UI/read-unread | `feature/notifications` |

### 6. Knowledge Base

| Requirement | Status | Backend evidence | Frontend evidence | Tests | DB/browser evidence | Gap | Planned branch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FAQs | COMPLETE | `GET/POST/PATCH/DELETE /api/knowledge-articles` (`server/src/modules/knowledge-base/*`) | `/knowledge-base` list/detail/editor; nav item; `/portal/knowledge-base` Help Center | `knowledge-article.test.ts`, `knowledge-article.portal.test.ts`, `knowledge-base.test.tsx`, `portal-knowledge.test.tsx` | Automated-verified at `ef647ef`; PostgreSQL/browser outstanding | — | `feature/knowledge-base` (integrated at `ef647ef`) |
| Help articles | COMPLETE | Published-only `GET /api/portal/knowledge-articles(/:id)` | Portal Help Center list + article view | `knowledge-article.portal.test.ts`, `portal-knowledge.test.tsx` | Automated-verified at `ef647ef` | Neutral "Help articles" label — no popularity data | `feature/knowledge-base` (integrated at `ef647ef`) |
| Solutions and guides | COMPLETE | Free-text `category`; DRAFT/PUBLISHED lifecycle | Editor (title/category/content/status), plain-text detail rendering | `knowledge-article.test.ts`, `knowledge-base.test.tsx` | Automated-verified at `ef647ef` | No rich-text/Markdown, no versioning | `feature/knowledge-base` (integrated at `ef647ef`) |
| Search | COMPLETE | Case-insensitive server search over title/content/category; status + exact category filter; bounded pagination | URL-backed search + status + category filters on list; Portal search | `knowledge-article.test.ts`, `knowledge-article.portal.test.ts`, `knowledge-base.test.tsx` | Automated-verified at `ef647ef` | Category filter is exact-match on free text | `feature/knowledge-base` (integrated at `ef647ef`) |

### 7. AI Features

| Requirement | Status | Backend evidence | Frontend evidence | Tests | DB/browser evidence | Gap | Planned branch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ticket summaries | NOT_STARTED | no `ai` module | none | none | N/A | No provider service; P2 | `feature/ai-assistant` (1st) |
| Suggested replies | NOT_STARTED | none | none | none | N/A | P2; must require human review | `feature/ai-assistant` (2nd) |
| Automatic categorization | NOT_STARTED | none | none | none | N/A | Suggestion only; never auto-mutates category | `feature/ai-assistant` (3rd) |
| Suggested solutions | NOT_STARTED | none | none | none | N/A | Depends on Knowledge Base | `feature/ai-assistant` (4th) |
| AI chatbot | INTENTIONALLY_DEFERRED | none | none | none | N/A | Explicit P3 deferral (docs 01, 11); still in roadmap as last/deferred | `feature/ai-assistant` (deferred tail) |

### 8. Customer Portal

| Requirement | Status | Backend evidence | Frontend evidence | Tests | DB/browser evidence | Gap | Planned branch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Submit tickets | COMPLETE | `POST /portal/tickets` — CUSTOMER-only, owned, SLA snapshot | Portal New Request page | `portal.test.ts`, `portal-pages.test.tsx` | PostgreSQL-verified (prior); 14 captures (prior) | — | — |
| Track requests | COMPLETE | `GET /portal/tickets`, `GET /portal/tickets/:id`; public status mapping | Portal list + detail | `portal.test.ts`, `portal-routing.test.tsx` | PostgreSQL + browser-verified (prior) | — | — |
| View history | COMPLETE | `GET /portal/overview` recent + owned list pagination | Portal Home + My Requests | `portal.test.ts` | PostgreSQL-verified (prior) | — | — |
| Access FAQs | COMPLETE | `GET /api/portal/knowledge-articles(/:id)` — CUSTOMER-only, published-only, DRAFT/missing return identical 404 | `/portal/knowledge-base` Help Center list + article view; Help Center nav item | `knowledge-article.portal.test.ts`, `portal-knowledge.test.tsx`, `portal-routing.test.tsx` | Automated-verified at `ef647ef` | — | `feature/knowledge-base` (integrated at `ef647ef`) |
| Submit feedback | NOT_STARTED | `Feedback` model only; no route | none | none | Schema only | No eligibility, ownership, one-per-ticket, rating validation | `feature/customer-feedback` |

### 9. Reports and Management

| Requirement | Status | Backend evidence | Frontend evidence | Tests | DB/browser evidence | Gap | Planned branch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ticket reports | NOT_STARTED | no `/reports` route or module | no `/reports` page/nav | none | N/A | Operational Dashboard is not the Reports feature | `feature/reports` |
| SLA performance | NOT_STARTED | none | none | none | N/A | No compliance %, met/breached aggregation | `feature/reports` |
| Agent performance | NOT_STARTED | none | none | none | N/A | No per-agent assigned/resolved/SLA-met report | `feature/reports` |
| Customer satisfaction | NOT_STARTED | none | none | none | N/A | Depends on `feature/customer-feedback` | `feature/reports` |
| Management dashboards | PARTIAL | `GET /dashboard/overview` — KPIs, status distribution, role-scoped queues, request-time SLA | Dashboard page with KPI cards + distribution chart | `dashboard.test.ts`, `dashboard-page.test.tsx` | Automated-verified; browser outstanding | Operational only; no date-range analytics, no trends, no agent-performance summary | `feature/reports` |

### 10. Security and Administration

| Requirement | Status | Backend evidence | Frontend evidence | Tests | DB/browser evidence | Gap | Planned branch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Users and roles | PARTIAL | `Role` enum; JWT; `requireAuth`/`requireRole` on all live routers; CUSTOMER-only registration | Role-aware nav/route guards; login/register | `auth.test.ts`, `auth-context.test.tsx`, `middleware/auth.test.ts` | PostgreSQL-verified (prior) | No user administration beyond `GET /users/agents` lookup; no create/list/update users, no `/users` page | `feature/user-management` |
| Permissions | PARTIAL | Server-side `requireRole` groups per route; customer read/write split; agent allowlist; portal boundary | UI hides unauthorized controls; redirect guards | `customer.test.ts`, `ticket.test.ts`, `portal.test.ts` | PostgreSQL-verified (prior) | Permission model for KB, Reports, Users mgmt, Settings, Feedback, Notifications, Tasks not implemented (see `06-auth-rbac.md`) | multiple (per feature) |
| Audit logs | NOT_STARTED | no `AuditLog` model; `TicketHistory` covers ticket lifecycle only | none | none | N/A | No general audit log across entities | deferred P2 (roadmap tail) |
| System configuration | NOT_STARTED | no `/settings` route; no config API | no `/settings` page/nav | none | N/A | Categories read-only; SLA rules managed directly; nothing editable in-app | `feature/settings` |

### 11. Integrations

| Requirement | Status | Backend evidence | Frontend evidence | Tests | DB/browser evidence | Gap | Planned branch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| APIs | PARTIAL | Internal REST API (`/api/*`) for implemented domains; consistent error shape | Axios client consumes it | route/controller tests | PostgreSQL-verified (prior) | No external/public API program, API keys, webhooks, or versioning | not scheduled |
| ERP | ARCHITECTURE_ONLY | none | none | none | N/A | Documented only (ADR-002) | demo-only |
| Email, SMS, and WhatsApp | ARCHITECTURE_ONLY | `Channel` enum values only | none | none | N/A | No provider adapters | demo-only (ADR-002) |
| External systems | ARCHITECTURE_ONLY | none | none | none | N/A | No integration framework | demo-only |

### 12. Platform

| Requirement | Status | Backend evidence | Frontend evidence | Tests | DB/browser evidence | Gap | Planned branch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Arabic and English | COMPLETE | localized API error support where implemented | i18next; `locales/en`, `locales/ar`; persisted `crm-language`; `lang`/`dir` sync | `i18n.test.ts`, `language.test.ts`, `language-switcher.test.tsx` | Browser-verified for Portal (prior) | Each new feature must add its own translations + RTL check | per feature |
| Responsive web / mobile-friendly | COMPLETE | N/A | Tailwind; desktop tables + mobile cards; responsive Portal shell | page tests assert both variants | Portal browser-verified (prior); Dashboard + SLA subsection browser outstanding | Visual verification incomplete for Dashboard and SLA subsection | verification: `test/core-flows` |
| Multi-department | ARCHITECTURE_ONLY | `Department` model + optional FKs on `User`/`Ticket`; `(branchId, name)` constraint | none | `prisma-schema.test.ts` | Schema only | No admin, no scoping, no UI | deferred P2 |
| Multi-branch | ARCHITECTURE_ONLY | `Branch` model + optional FKs | none | `prisma-schema.test.ts` | Schema only | No admin, no scoping, no UI | deferred P2 |
| Custom branding | NOT_STARTED | none | none | none | N/A | No model, no settings, no persistence | `feature/custom-branding` (product decision required) |

### Coverage totals

| Status | Count |
| --- | ---: |
| COMPLETE | 23 |
| PARTIAL | 8 |
| NOT_STARTED | 18 |
| ARCHITECTURE_ONLY | 9 |
| INTENTIONALLY_DEFERRED | 1 |
| **Total requirement rows** | **59** |

COMPLETE includes 5 rows delivered by `feature/knowledge-base` (Knowledge Base FAQs / Help articles / Solutions and guides / Search, and Customer Portal "Access FAQs"), integrated into `master` at `ef647ef` and automated-verified. PostgreSQL and authenticated browser verification of Knowledge Base remain outstanding.

Verification outstanding on implemented work: 5 areas — basic SLA derivation/presentation (PostgreSQL + browser), Agent Dashboard (browser), Ticket Conversation workspace (browser capture), responsive visual review of Dashboard + SLA subsection (browser), and Knowledge Base (PostgreSQL + authenticated English/Arabic browser). Automated boundary/regression tests cover these; live checks were not rerun.

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

## 4. Earlier Integrated Feature — Basic SLA Presentation (historical detail)

- Basic SLA presentation was implemented on `feature/sla` from synchronized `master`, then committed by the developer as `e7d9b14 feat: complete basic SLA presentation` and fast-forward merged into `master`. `feature/sla` is contained in `master`. A later docs-only commit `e387667 update progress tracking` sits on top of `e7d9b14`; `master` has since advanced past it to `d89cf47` (docs-only) and `ef647ef` (Knowledge Base). The prior "only uncommitted change is this tracker" note is superseded: that synchronization was committed as `e387667`.
- Shared derivation: the Dashboard's local SLA derivation moved to a pure `server/src/shared/sla/derive-sla.ts` module owning `SlaState`, `SlaTarget`, the fixed 60-minute `SLA_WARNING_MINUTES` constant, and `deriveSla(ticket, now)`. `now` is injected; terminal (`RESOLVED`/`CLOSED`/`resolvedAt`/`closedAt`) returns `MET` with null target and deadline; while `firstRespondedAt` is null the first-response deadline applies, the resolution deadline applies while non-terminal, the earlier deadline wins, and an exact tie prefers `FIRST_RESPONSE`; `dueAt <= now` is `BREACHED`, `0 < remaining <= 60min` is `AT_RISK` (60 minutes exactly is `AT_RISK`), `> 60min` is `ON_TRACK`; a configured-and-completed first response with no resolution deadline returns `MET`; otherwise `NOT_CONFIGURED` with null target and deadline. Boundaries use millisecond UTC `Date` math with no minute rounding.
- Dashboard: `getDashboardOverview` now calls the shared helper; the `GET /api/dashboard/overview` response shape, role visibility, active-ticket definitions, KPI meanings, warning window, Needs Attention / Recent ordering, list sizes, and safe summaries are unchanged. `effectiveSlaTarget` is not added to Dashboard items.
- Ticket Details: `GET /api/tickets/:id` adds `slaState`, `effectiveSlaDueAt`, and `effectiveSlaTarget`, derived only after existing authorization/visibility succeeds, alongside the unchanged raw `firstResponseDueAt`, `firstRespondedAt`, `resolutionDueAt`, `resolvedAt`, and `closedAt`. No Ticket List or Portal contract change; `CUSTOMER` and unauthenticated callers remain rejected.
- Portal: no SLA field added to `/api/portal/*`; server and client regression assertions confirm Portal responses and pages never expose `slaState`, `effectiveSlaDueAt`, `effectiveSlaTarget`, `firstResponseDueAt`, `firstRespondedAt`, or `resolutionDueAt`.
- Frontend: a compact bordered SLA subsection inside the existing Ticket Details metadata surface (not a nested card) shows the localized state with a text label plus restrained semantic accent (state never conveyed by color alone), the localized effective target, the effective deadline when applicable, and the raw first-response deadline, first-response completion, and resolution deadline. Dates use the existing locale formatter with `<bdi dir="ltr">` isolation. No countdown, interval, polling, or client-side state derivation. Full English and Arabic strings added; RTL mirrors through document direction.
- Verification: 103 client and 126 server tests pass (229 total, 0 failed/skipped/todo), including 18 shared-helper boundary tests, ADMIN/MANAGER/AGENT Ticket Details derived-field coverage, unauthenticated/CUSTOMER rejection, raw-snapshot presence, Portal SLA-free server and client assertions, Dashboard response-shape regression, and 5 Ticket Details SLA-state UI tests plus target-label, deadline-formatting, missing-deadline, first-response-completion, English, Arabic, and RTL tests. Client/server lint, typecheck, builds, translation JSON, `git diff --check`, and OpenWolf validation pass. The existing Vite chunk-size warning remains.
- PostgreSQL verification and authenticated English/Arabic desktop/mobile browser verification of the SLA presentation were not performed; deterministic boundary tests cover every SLA state. Prior feature verification evidence is preserved unchanged below.
- The SLA implementation is committed at `e7d9b14` and contained in `master`. When this section was written `master` and `origin/master` both pointed at `e387667` (docs-only, on top of `e7d9b14`); `master` has since advanced to `d89cf47` (docs-only task-coverage/roadmap reconciliation) and then `ef647ef` (`feat: implement knowledge base`), and `master` equals `origin/master` (ahead 0, behind 0). All pushes were performed by the developer, not by the AI.

## 5. Next Recommended Work

Roadmap order 1 (`feature/knowledge-base`) is integrated into `master` at `ef647ef` and automated-verified.

Roadmap order 2 (`feature/attachments`) is implemented on the uncommitted `feature/attachments` branch (from `master` `069839a`) and automated-verified: private Vercel Blob storage behind an adapter interface, 4 MiB signature-validated single-file upload, per-context authorization (ticket / ticket message / customer profile / Portal owned ticket), safe download proxy with `nosniff` and forced-attachment headers, orphan cleanup, and English/Arabic UI. No schema change. It awaits developer review and integration.

Next implementation feature after that integration: **`feature/quick-replies`** (roadmap order 3). No blocking dependency was found in repository evidence.

Full dependency-aware sequence (one isolated branch per feature; ADR-019; mirrored in `docs/14-implementation-plan.md`):

| Order | Branch | Feature |
| ----: | ------ | ------- |
| 1 | `feature/knowledge-base` | Internal KB CRUD/search, published customer read, Portal FAQs — **integrated into `master` at `ef647ef`** |
| 2 | `feature/attachments` | Secure attachment upload/download and per-context ownership — **next** |
| 3 | `feature/quick-replies` | Quick Reply management and composer insertion |
| 4 | `feature/customer-feedback` | Portal feedback workflow and eligibility |
| 5 | `feature/reports` | Ticket, SLA, agent, and satisfaction reports |
| 6 | `feature/user-management` | ADMIN-managed internal users and roles |
| 7 | `feature/settings` | Real configuration pages for existing configurable resources |
| 8 | `feature/notifications` | In-app notifications and read/unread workflow |
| 9 | `feature/sla-automation` | Bounded monitoring, assignment/escalation rules, and alerts |
| 10 | `feature/tasks-reminders` | Agent Tasks and Reminders after product decisions |
| 11 | `feature/team-collaboration` | Explicit collaboration scope beyond existing notes/history |
| 12 | `feature/ai-assistant` | Summary, suggested reply, categorization, suggested KB solution |
| 13 | `feature/custom-branding` | Persisted, bounded CRM/Portal branding |
| 14 | `feature/demo-seed-data` | Final realistic dataset covering implemented features |
| 15 | `test/core-flows` | Final integrated QA, accessibility, responsive, English/Arabic, RTL |
| 16 | deployment branch (project convention) | Deployment preparation and verification |

Independent of the feature sequence, these verification follow-ups on already-integrated work can be done at any time and are also folded into `test/core-flows`:

- PostgreSQL spot-check of `deriveSla` against real tickets, and authenticated English/Arabic desktop/mobile visual verification of the Ticket Details SLA subsection (BREACHED / AT_RISK / ON_TRACK / MET / NOT_CONFIGURED where data permits).
- Authenticated ADMIN/MANAGER and AGENT English/Arabic desktop/mobile Dashboard visual verification.

This follows `docs/01-scope-and-priorities.md`, `docs/14-implementation-plan.md`, and `docs/18-ui-pages-spec.md`.

## 6. Remaining Scope

### 6A. Demo seed data timing (explicit)

Final Demo Seed Data must not be treated as the next completion task.

The final comprehensive demo dataset (`feature/demo-seed-data`, order 14) is implemented only after the features whose schema and data the demo must show are stable, including at least Knowledge Base, Customer Feedback, Reports, Quick Replies, and Notifications. Seeding earlier would produce a dataset that does not exercise those features and would need rework.

A minimal temporary developer fixture may be introduced by an earlier feature branch when required for that feature's own testing (for example a few `SlaRule` rows to exercise `deriveSla`). Such a fixture is explicitly not the final demo dataset and must not be presented as it.

### Core Remaining

- SLA monitoring/automation beyond the implemented snapshots, first-response timestamp, shared request-time derivation, and Dashboard/Ticket Details presentation; background automation remains deferred unless separately promoted.
- PostgreSQL and authenticated English/Arabic desktop/mobile browser verification of the `feature/sla` Ticket Details SLA subsection (BREACHED / AT_RISK / ON_TRACK / MET / NOT_CONFIGURED where data permits).
- Realistic seed/demo data and demo accounts covering the critical support journey and a range of live SLA states.
- Final integrated end-to-end assessment QA.
- Authenticated ADMIN/MANAGER and AGENT English/Arabic desktop/mobile Dashboard visual verification.
- Deployment preparation and verification.
- Remaining responsive and accessibility checks across the integrated journey.

### Secondary

- Attachments, in-app notifications, reports, quick replies, customer feedback, and richer ticket history. (Knowledge Base is integrated into `master` at `ef647ef`.)
- Complete demo seed data for users, customers, tickets, conversations, articles, SLA states, and feedback.

### Deferred / Demonstration Only

- AI assistance, automatic assignment, general audit logs, multi-department behavior, and multi-branch behavior remain P2.
- WhatsApp, SMS, inbound email ingestion, production live chat transport, ERP, arbitrary external systems, and a full AI chatbot remain P3 architecture/demo scope.

## 7. Known Limitations

- No refresh-token, token-revocation, or production session infrastructure.
- Customer Portal attachments, feedback, notifications, profile editing, and external messaging integrations remain deferred. The Customer Portal Knowledge Base (Help Center) is integrated into `master` at `ef647ef`.
- Attachment upload/download with a private Vercel Blob store, 4 MiB signature-validated single-file uploads, service-level context/ownership validation, a safe authenticated download proxy, and orphan cleanup are implemented on the uncommitted `feature/attachments` branch (automated-verified only; not in `master`). No malware scanning, no attachment deletion, no thumbnails/previews, no multi-file or resumable upload; the model records no uploader or file size.
- No real-time messaging or provider-backed communication channel.
- Basic SLA presentation exists: deadline snapshots on creation, eligible priority-change recalculation, one-time first-response recording, and one shared request-time `deriveSla` helper (`ON_TRACK` / `AT_RISK` / `BREACHED` / `MET` / `NOT_CONFIGURED` plus an explicit `FIRST_RESPONSE` / `RESOLUTION` / null target) consumed by the Agent Dashboard and authorized internal Ticket Details. Integrated into `master` at `e7d9b14`: internal Ticket Details renders a compact localized SLA subsection; Portal behavior remains SLA-safe without exposing raw or derived internal fields. Background workers, scheduled monitoring, persisted SLA state or breach events, notifications, automatic escalation/assignment, SLA reports, and SLA administration do not exist.
- No notifications, reports, feedback workflow, or AI actions. Knowledge Base is integrated into `master` at `ef647ef`; it has no popularity/view tracking, no article versioning, no rich-text editing, and no related-article recommendations.
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

### `feature/knowledge-base` (2026-08-26, integrated into `master` at `ef647ef`)

Full suites were run for `feature/knowledge-base` during implementation; that work is committed at `ef647ef` and contained in `master`. Baseline before this feature was 103 client / 126 server / 229 total. The counts below are preserved historical evidence from the feature implementation and were not rerun for this documentation-only synchronization.

| Command / category | Files | Passed | Failed | Skipped | Todo | Exit code | Evidence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Client tests: `npm --prefix client run test` | 20 | 141 | 0 | 0 | 0 | 0 | +38 vs baseline: `knowledge-base.test.tsx` (23), `knowledge-article-hooks.test.tsx` (3), `portal-knowledge.test.tsx` (6), `knowledge-article-manage-route.test.tsx` (4), `portal-routing.test.tsx` (+2). |
| Server tests: `npm --prefix server run test` | 11 | 163 | 0 | 0 | 0 | 0 | +37 vs baseline: `knowledge-article.test.ts` (31), `knowledge-article.portal.test.ts` (6). Pre-existing intentional handled stderr from the negative CORS / simulated failed-write ticket tests still does not fail the suite. |
| Combined/root tests: `npm run test` | 31 | 304 | 0 | 0 | 0 | 0 | Root command ran both suites successfully. |
| Client lint / Server lint | — | — | — | — | — | 0 | ESLint passed both packages. |
| Client typecheck / Server typecheck | — | — | — | — | — | 0 | `tsc -b` and `tsc --noEmit` passed. |
| Client build / Server build | — | — | — | — | — | 0 | Passed; Vite retained the pre-existing non-failing >500 kB chunk warning (~1,042 kB / gzip ~308 kB). |
| Translation JSON validation | 2 files | 418 / 418 keys | 0 | — | — | 0 | `en` and `ar` parse; identical flattened key sets including `knowledgeBase.*` and `portal.knowledgeBase.*`. |
| Whitespace: `git diff --check` | — | — | — | — | — | 0 | No trailing-whitespace or conflict markers. |
| OpenWolf validation | 10 core files / 7 hooks | — | 0 | — | — | 0 | `openwolf status`: all core files, hook scripts, and registered matchers present. |

Knowledge Base test scope: unauthenticated 401 and CUSTOMER 403 on every internal route; ADMIN/MANAGER/AGENT list all articles; internal DRAFT + PUBLISHED detail reads; bounded/correct pagination; search over title/content/category; status + trimmed-category filters; deterministic `updatedAt DESC, id ASC` ordering; safe list projection (no `content`, no author email); structured 404; ADMIN/MANAGER create DRAFT/PUBLISHED with server-derived `createdById`; rejection of client `createdById` and unknown fields; AGENT/CUSTOMER create 403; length/required validation; ADMIN/MANAGER update + publish/unpublish with creator preserved; empty-PATCH and forbidden-field rejection; AGENT update 403; update/delete 404; ADMIN/MANAGER delete 204; AGENT delete 403. Portal: CUSTOMER published-only list/detail; DRAFT excluded; search/category stay published-only; status-free author-free projections; DRAFT id and missing id return identical 404; internal-role and unauthenticated rejection. Frontend: nav item for all internal roles; semantic desktop columns + mobile cards; URL-backed search/status/category server queries; server-backed pagination; loading/error-retry/empty/no-results; long-title containment; Create-article visibility by role; AGENT editor route guard; form required-field validation; create omits `createdById` and navigates to detail; edit loads values and sends only approved fields; pending-save duplicate prevention; safe plain-text content render; AGENT read without Edit/Delete; ADMIN/MANAGER Edit+Delete with inline confirmation, cancel-no-mutation, pending-delete guard, failure preserves view; mutation hooks invalidate internal + `["portal","knowledge-articles"]` queries; English + Arabic + RTL; Portal Help Center list/detail with no author/management controls and correct search API.

### `feature/attachments` (2026-08-26, uncommitted branch — NOT in `master`)

Full suites were run on `feature/attachments` (created from `master` `069839a`). Baseline before this feature was client 141 / server 163 / 304 total.

| Command / category | Files | Passed | Failed | Skipped | Todo | Exit code | Evidence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Client tests: `npm --prefix client run test` | 22 | 190 | 0 | 0 | 0 | 0 | +49 vs baseline: `attachments.test.tsx` (44 — attachment list/upload/download/cache/localization plus the Preview icon-action + preview-dialog block: image/PDF/escaped-text/unsupported/failure-Retry rendering, object-URL revoke on close/file-change/unmount, Escape + focus-return, Portal endpoint routing, no-download-on-preview), `attachment-api.test.ts` (5). `ticket-pages.test.tsx` and `portal-pages.test.tsx` carry a `vi.mock` of `@/features/attachments/attachment-hooks`; counts otherwise unchanged. |
| Server tests: `npm --prefix server run test` | 12 | 219 | 0 | 0 | 0 | 0 | +56 vs baseline: `attachment.test.ts` (56, incl. a `multipart field rejection` block: reserved fields -> `INVALID_ATTACHMENT_CONTEXT`, unknown text field -> `INVALID_UPLOAD`, provider `put`/Prisma `create` not called, no hang, file-only request still succeeds). Pre-existing handled stderr from the negative CORS / simulated failed-write tests plus two handled `console.error` lines (an intentionally-rejected provider error and the safe orphan-key log) still do not fail the suite. |
| Combined/root tests: `npm run test` | 34 | 409 | 0 | 0 | 0 | 0 | Root command ran both suites successfully. |
| Client lint / Server lint | — | — | — | — | — | 0 | ESLint passed both packages. |
| Client typecheck / Server typecheck | — | — | — | — | — | 0 | `tsc -b` and `tsc --noEmit` passed. |
| Client build / Server build | — | — | — | — | — | 0 | Passed; Vite retained the pre-existing non-failing >500 kB chunk warning (~1,063 kB / gzip ~314 kB, up slightly from the preview dialog). |
| Translation JSON validation | 2 files | 460 / 460 keys | 0 | — | — | 0 | `en` and `ar` parse; identical flattened key sets including `attachments.*` (incl. `INVALID_UPLOAD` and the `preview*`/`downloadAttachment` action strings). |
| Whitespace: `git diff --check` | — | — | — | — | — | 0 | No trailing-whitespace or conflict markers. |
| OpenWolf validation | 10 core files / 7 hooks | — | 0 | — | — | 0 | `openwolf status`: all core files, hook scripts, and registered matchers present. |

Attachment test scope (server): unauthenticated `401` and `CUSTOMER` `403` on every internal route; internal roles `403` on Portal routes; `ADMIN`/`MANAGER`/assigned-`AGENT` ticket upload; unassigned-`AGENT` and other-agent upload rejection; ticket visibility on listing/download; `ADMIN`/`MANAGER` customer upload, `AGENT` customer upload `403`, `AGENT` customer read/download; message-belongs-to-ticket and message-authorship (`403` for `ADMIN` too); multipart-field rejection (7 reserved fields → `422 INVALID_ATTACHMENT_CONTEXT`, unknown text field → `422 INVALID_UPLOAD`, submitted value never echoed, provider `put` + Prisma `create` not called, no hang, file-only request still succeeds); missing-part/wrong-field/multiple/empty/oversized/unsupported/spoofed file rejection; detected-not-claimed MIME; unsafe-filename normalization; unpredictable server-derived keys; no `storageKey`/provider URL in any response; provider-failure → no DB row; DB-failure → provider cleanup; cleanup-failure without secret exposure; safe download headers; authorization before `head`/`get`; missing record / missing stored object / oversized stored object → structured status with `get` untouched; Portal owned non-closed upload with no message/reopen; Portal IDOR (`404 TICKET_NOT_FOUND` / `404 ATTACHMENT_NOT_FOUND`); `CLOSED` → `409 TICKET_CLOSED`; Portal minimal projection; `CUSTOMER_PROFILE_REQUIRED`. Frontend: upload visibility by role/assignment; read-only disabled reason; existing-attachment rendering; filename containment/`dir="auto"`; visible accepted types + 4 MiB; empty state; retryable load error; client-side type/size/empty pre-validation; pending duplicate prevention; failure preserves list + Retry; success clears selection; hook cache-key invalidation (ticket-only, customer + customer detail, portal-only); authenticated Blob download + object-URL revoke + duplicate-download block + localized failure + portal endpoint routing; **icon-only Download button keeps its localized accessible name/title and disables while pending; Preview icon button opens an accessible dialog that renders image (object-URL, alt=filename) / PDF (iframe on the temp Blob URL + fallback note) / escaped `<pre>` text (never HTML) / localized unsupported + failure-Retry; Preview never triggers a download; Download stays inside the dialog; object URL revoked on close, file change, and unmount; Escape closes; focus returns to the Preview button; decorative SVGs are `aria-hidden`; Portal Preview uses the Portal download endpoint**; message-attachment rows show the same icon actions; Portal projection carries no storage key or internal context; English + Arabic + RTL; `attachment-api` sends FormData with `Content-Type` unset and parses RFC 5987 then ASCII then default filename.

PostgreSQL, live Vercel Blob, and authenticated browser verification were **not** performed: the configured local `DATABASE_URL` is unreachable in this environment and no authenticated dev-server browser session was available. A `server/.env` supplying a real `BLOB_READ_WRITE_TOKEN` was later added to the working tree (git-ignored, developer-provided), but no live upload/download against the private Blob store was run. The in-memory storage adapter and mocked Prisma exercise every route, role, projection, validation, failure, and cleanup path deterministically.

### `master` state (historical, `feature/sla`, contained in `master`)

Verified during `feature/sla` implementation; that work is committed at `e7d9b14` and contained in `master`. Counts below are the `master` state on 2026-08-26 and were not rerun for this branch.

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

- Knowledge Base PostgreSQL/API: not performed. The configured default `DATABASE_URL` (local `crm`) was not reachable in this environment and no Neon credentials are recorded; `prisma generate` also hit a Windows file-lock (`EPERM`) on the query-engine binary. The existing generated client already contains `KnowledgeArticle`, so typecheck/build/tests are unaffected. Deterministic mocked Supertest coverage exercises every route, role, projection, filter, ordering, and 404 path.
- Knowledge Base visual verification: not performed; no authenticated dev-server browser session was available in this environment. Responsive/RTL behaviour is asserted structurally in the client tests (both desktop-table and mobile-card variants render in JSDOM; Arabic switches `document.documentElement.dir` to `rtl`).
- PostgreSQL/API: not performed for the SLA presentation. Deterministic automated coverage exercises every SLA state and boundary.
- SLA presentation visual verification: not performed; authenticated browser verification of the Ticket Details SLA subsection in English/Arabic desktop/mobile remains outstanding despite the code being integrated.

Prior verification evidence preserved without claiming a rerun:

- PostgreSQL/API: Ticket Management, Ticket Conversation, Agent Dashboard, AGENT Customer Management boundaries, and two-customer Portal ownership/IDOR/workflow checks were previously completed. The Portal database run observed the documented null-deadline fallback because no active MEDIUM SLA rule existed.
- Portal visual verification: 14 authenticated English/Arabic desktop/mobile captures and the final route-exact navigation regression verification were previously completed.
- Earlier Dashboard visual verification was also incomplete because authenticated capture attempts redirected to login.

These results cover implemented features, not the unimplemented project scope.

## 10. Branch Tracking

| Branch / area | Purpose | Integration state | Ancestry evidence |
| --- | --- | --- | --- |
| `master` | Synchronized integration branch | `ef647ef` (`feat: implement knowledge base`, on top of `d89cf47`); equals the `origin/master` tracking ref | Local/remote ahead 0, behind 0. |
| `docs/task-coverage-roadmap` | Task-coverage audit and roadmap reconciliation | Contained in `master` at `d89cf47` (`docs: reconcile task coverage and implementation roadmap`) | Docs-only. |
| `feature/knowledge-base` | Knowledge Base: internal `/api/knowledge-articles` CRUD, published-only `/api/portal/knowledge-articles`, internal `/knowledge-base*` routes + nav + AGENT editor guard, `/portal/knowledge-base` Help Center, EN/AR/RTL, tests | Contained in `master` at `ef647ef`; integrated by fast-forward from `d89cf47` (branch tip equals `master`) | Implemented and automated-verified; no schema/migration change. |
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
| SLA presentation | Shared request-time `deriveSla` helper, Ticket Details derived fields and UI, Portal SLA-free assertions | Contained in `master` | Commit `e7d9b14` (`feature/sla`) is an ancestor of `master`; `master` tip is now `ef647ef` (`feat: implement knowledge base`, on top of docs-only `e387667` / `d89cf47`). |

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
- `feature/sla` is committed at `e7d9b14` and contained in `master`, but its PostgreSQL and authenticated English/Arabic browser verification were not performed and rely on deterministic boundary tests until a developer completes them.
- Deployment preparation and deployed frontend/API verification have not been completed.
- Background SLA workers, scheduled monitoring, persisted breach events, notifications, and automatic escalation are not implemented.
- Attachment upload/storage and the per-context ownership-validation service exist on the uncommitted `feature/attachments` branch (private Vercel Blob, automated-verified only); PostgreSQL, live Blob, and browser verification are outstanding and it is not integrated into `master`.
- Authentication has no refresh-token or server-side revocation infrastructure.
- The production client build retains a non-failing JavaScript chunk-size warning above 500 kB.
- Prisma CLI's development dependency tree retains the reported high-severity advisory; the suggested forced downgrade remains intentionally unapplied.
- No automated visual regression suite exists.
- `feature/knowledge-base` is integrated into `master` at `ef647ef` and automated-verified; its PostgreSQL and authenticated English/Arabic browser verification were not performed and rely on deterministic mocked tests until a developer completes them. `KnowledgeArticle.category` is unnormalized free text, so category filtering is exact-match on the stored string.
- Advanced integrations are intentionally deferred and must not be represented as functional.

## 13. Definition of Project Completion

Three distinct completion bars. Do not conflate them.

### Core support loop complete (achieved)

Authenticated internal users can manage customers and tickets, assign and progress tickets, exchange public replies, add private notes, see basic SLA state, use an agent dashboard, and securely complete the customer-side Portal ticket journey. Authorization, validation, loading/empty/error states, responsive behavior, RTL, and automated tests are in place. Integrated into `master` at `e7d9b14` / `e387667`. Outstanding: PostgreSQL and browser verification of the SLA subsection and Dashboard; a realistic demo dataset.

### Broader original-task demo complete (target)

Requires the core loop plus the features promoted by the coverage audit (ADR-019), expected to include at least:

- Knowledge Base
- Attachments (upload/download with ownership)
- Quick Replies
- Customer Feedback
- Reports
- Users Management
- functional Settings
- Notifications
- agreed SLA automation scope
- agreed Tasks / Reminders scope
- final comprehensive demo data (`feature/demo-seed-data`)
- final integrated QA (`test/core-flows`)
- deployment preparation and verification

Each with its own authorization, validation, state handling, English/Arabic, RTL, responsive behavior, and tests.

### Architecture / demo-only (not part of "production-ready")

Inbound email ingestion, WhatsApp / SMS providers, production live chat transport, ERP, arbitrary external systems, the full AI chatbot, and multi-department / multi-branch behavior are represented but not production-connected. The complete original assignment must not be called production-ready while these limitations remain (ADR-002, ADR-019).

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
