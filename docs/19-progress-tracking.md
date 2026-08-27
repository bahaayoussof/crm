# Customer Support CRM — Progress Tracking

Last Updated: 2026-08-27 (`master`/`origin/master` reconciled at `c846d96`; Settings and visual-system follow-ups are integrated. Notifications is implemented and automated-verified on uncommitted `feature/notifications-roadmap`.)

Current Integration Branch: `master` at `c846d96`, equal to the `origin/master` tracking ref (ahead 0, behind 0). Historical verification evidence below is preserved without claiming reruns.

Current Working Branch: `feature/notifications-roadmap`, branched from `origin/master` at `c846d96`. Notifications is implemented and automated-verified: client 356, server 338, root 694 tests pass; both package typechecks and builds pass; server lint and focused Notifications client lint pass. Repository-wide client lint remains blocked by 11 pre-existing errors outside Notifications plus one existing warning. The existing Vite chunk-size warning remains. PostgreSQL migration `20260827161500_add_notification_ticket_id` was successfully deployed to the configured Neon development database after the UI exposed the missing-column failure; authenticated browser verification was not performed. Changes are unstaged and uncommitted; nothing was pushed, merged, rebased, amended, or tagged.

> This file is a status summary and the single authoritative status-and-roadmap document. Requirements, architecture, API contracts, RBAC rules, workflows, UI specifications, and architecture decisions remain authoritative in their respective documents.

> Status terms are not interchangeable. `Integrated into master` = Git ancestry confirms containment. `Automated-verified` = automated tests were run and passed (historically, during the cited feature). `PostgreSQL-verified` / `Browser-verified` = a live check was actually performed. This audit reran nothing: all test counts, PostgreSQL results, and browser results below are preserved historical evidence from prior feature work.

## 1. Overall Status

- `master` (at `e34818b`) contains Project Foundation, Database Schema, Authentication, Customer Management, Localization and RTL, Frontend Design Polish, TanStack Table adoption, Bilingual Typography, Ticket Management, Ticket Conversation, Agent Dashboard, Customer Portal, the reviewed Ticket authorization/workflow fix, the reviewed Dashboard ticket-queue fix, basic SLA presentation (`e7d9b14`), Knowledge Base (`ef647ef`), and Secure Attachments (`8e24d22`). `e387667` is a docs-only tracker update on top of `e7d9b14`; `d89cf47` is the docs-only task-coverage/roadmap reconciliation on top of `e387667`; `ef647ef` is the Knowledge Base feature on top of `d89cf47`; `069839a` is the docs-only KB integration sync; `8e24d22` is the Secure Attachments feature; `cb63871` and `e34818b` are docs-only tracker/integration-status updates on top of `8e24d22`. `feature/quick-replies` (roadmap order 3) is implemented on its own branch off `e34818b` and is NOT yet integrated.
- Basic SLA presentation is integrated: one shared request-time derivation helper (`server/src/shared/sla/derive-sla.ts`) consumed by both the Agent Dashboard and authorized internal Ticket Details, an explicit `effectiveSlaTarget`, derived Ticket Details response fields, a compact localized Ticket Details SLA subsection, and Portal SLA-free regression assertions.
- The end-to-end customer/agent support loop is implemented: customers can create, list, inspect, reply to, and reopen eligible requests through the owned Portal boundary, while internal staff can manage, converse on, and resolve tickets with customer context, Dashboard visibility, and clear SLA state.
- This document now carries an original-task coverage audit (section 2A). Against the full original assignment, with `feature/knowledge-base` (`ef647ef`) and `feature/attachments` (`8e24d22`) integrated into `master`: **24 COMPLETE, 7 PARTIAL, 18 NOT_STARTED, 9 ARCHITECTURE_ONLY, 1 INTENTIONALLY_DEFERRED** — 59 requirement rows (5 Knowledge Base / Portal-FAQ rows plus the Customer-Management Attachments row are COMPLETE; Attachments moved PARTIAL → COMPLETE on integration at `8e24d22`). Most remaining non-P0 areas are still `NOT_STARTED`, not intentionally cut.
- The project is not finished or production-ready: Quick Replies, Customer Feedback, Reports, Users Management, Settings, Notifications, SLA automation, Tasks/Reminders, Team Collaboration, AI assistance, Custom Branding, realistic demo data, final integrated QA, unresolved Dashboard and SLA visual verification, and deployment verification all remain. Attachments upload/download (with icon Preview/Download UX) is integrated into `master` at `8e24d22`, automated-verified; its live PostgreSQL, private Vercel Blob, and authenticated browser verification are outstanding.
- Knowledge Base (`feature/knowledge-base`, roadmap order 1) is integrated into `master` at `ef647ef` and automated-verified: internal `/api/knowledge-articles` CRUD (`ADMIN`/`MANAGER` manage, `AGENT` read-only, `CUSTOMER`/anon rejected), published-only `/api/portal/knowledge-articles`, internal `/knowledge-base` routes + nav item + `AGENT` editor guard, `/portal/knowledge-base` Help Center, English/Arabic + RTL, full state handling, and backend + frontend regression tests. No Prisma schema or migration change; no popularity tracking, no article versions, no rich-text editor, no related-article recommendations. PostgreSQL and browser verification were not performed.
- Provider-backed channels and other production external integrations remain architecture/demo-only (ADR-002, ADR-019).
- `feature/attachments` (roadmap order 2) is integrated into `master` at `8e24d22` and automated-verified.
- Quick Replies (`feature/quick-replies`, roadmap order 3) is implemented on its uncommitted branch and automated-verified: internal `/api/quick-replies` CRUD (`ADMIN`/`MANAGER` manage; `ADMIN`/`MANAGER`/`AGENT` list/read; `CUSTOMER`/anon rejected), server-derived `createdById`, safe author projection, title-then-id ordering, case-insensitive title/body search, bounded pagination; a manager-only `/quick-replies` workspace (nav `ADMIN`/`MANAGER` only, `QuickReplyManageRoute` → `/dashboard` guard) with a refined `table-fixed` **Title / Reply text / Updated / Actions** table (icon-only Edit/Delete in one Actions cell, anchored `role="dialog"` confirm popover, mobile cards) and a Ticket composer footer with a collapsed `Insert quick reply` trigger opening a keyboard-accessible search popover portalled to `document.body` (`position: fixed`, anchored + viewport-clamped + flips above, `z-50`) so it is not clipped by the Conversation card's `overflow-hidden` — debounced server search, loading/empty/no-results/non-blocking-error states, cursor-aware insertion with focus + caret restore, a 20,000-char length guard, document-`pointerdown` outside-close, never auto-sends, absent from the Internal Note tab, read-only/unassigned states, and the Customer Portal; English/Arabic + RTL; backend + management + real-picker composer integration tests. No Prisma schema or migration change; no new ADR (RBAC decision ADR-022 preserved). PostgreSQL and browser verification were not performed. Next implementation feature after integration: **`feature/customer-feedback`** (section 5, roadmap order 4). Final demo seed data is **not** the next task (section 6A).

## 2. Feature Progress

| Area | Status | Branch | Backend | Frontend | Tests | DB Verified | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Project Foundation | ✅ COMPLETE | `feature/project-foundation` | Express health foundation | React/Vite foundation | Passing | N/A | Tip is contained in `master`. |
| Database Schema | ✅ COMPLETE | `feature/database-schema` | 16 Prisma domain models and five enums | N/A | Schema contract passing | Yes, prior verified run | Initial migration exists and was previously confirmed current. Seed data is absent. |
| Authentication | ✅ COMPLETE | `feature/authentication` | Registration, login, `/auth/me`, JWT and role middleware | Login, registration, protected routing and logout | Passing | Yes, prior verified run | No refresh-token or revocation infrastructure. |
| Customer Management | ✅ COMPLETE | `feature/customer-management`, authorization/support-context refinements on `feature/agent-dashboard` | ADMIN/MANAGER mutations; AGENT read-only customer data; complete safe ticket-summary history | Role-aware actions/forms plus FULL/SUMMARY_ONLY customer Tickets tab | Passing | Yes | Attachments are metadata-only; summary visibility is separate from Ticket Management access. |
| Frontend Localization / RTL | ✅ COMPLETE | `fix/frontend-localization` | Localized API error support where implemented | Persisted English/Arabic and document direction | Passing | N/A | Commit ancestry confirms it is contained in `master`. |
| Frontend Design Polish & Visual Identity | ✅ COMPLETE | `fix/frontend-design-polish` / visual system | No material backend scope | Shared auth/protected shells, Neutral Monochrome SaaS UI + Semantic Functional Colors, Zero-Flash ThemeProvider, and Light/Dark mode | Passing (353 client tests) | N/A | Tip is contained in `master`. Full Light/Dark switching visually verified in browser. |
| Table Design System & Shared Primitives | ✅ COMPLETE | current working branch | Semantic table tokens (`--table-*`), shared primitives (`TableContainer`, `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`), `DataTableSurface`, `DataTableToolbar`, `DataTableSearch`, `DataTableFiltersPopover`, `DataTablePagination`, `DataTableEmptyRow`/`DataTableEmptyCard`, `DataTableSkeleton`, and `DataTableRowActions` | Applied consistently across Tickets, Users, Customers, Customer Tickets tab, Knowledge Base, Quick Replies, Dashboard, Reports, Settings, and Customer Portal | Passing (353 client tests, 314 server tests, 0 typecheck errors, build clean) | N/A | Compact SaaS density, restrained priority/SLA indicators, plain text headers, portalled popovers, single-row compact toolbars, and full bilingual RTL support. |
| Ticket Management authorization/workflow fix | ✅ COMPLETE | `fix/ticket-agent-permissions` | AGENT update allowlist, actor-derived creation assignment/history, and unchanged close transition enforcement | Protected edit route, role-scoped controls, confirmed close action, explicit Ticket/Customer column containment | Passing | Prior verification | Commit `19fbedde` is integrated into `master`. |
| Ticket Conversation | ✅ COMPLETE | `feature/ticket-conversation` | Internal detail conversation read, public replies, internal notes, RBAC and first-response transaction | Localized timeline and accessible reply/note composer | Passing | Yes | Tip is contained in `master`; browser capture verification was not completed. |
| Agent Dashboard | ✅ COMPLETE | `fix/dashboard-ticket-queues`, SLA helper extraction on `feature/sla` (both contained in `master`) | Explicit role-derived primary queues; AGENT active assigned-only work; backend Recent exclusion after primary selection; now uses the shared SLA derivation helper without response-shape change | Localized role-aware headings, non-duplicate sections, fixed-width scrollable tables, overflow-safe mobile cards, and stale-response crash protection | 103 client / 126 server passing | Yes, prior verified run | Dashboard queue fix and the SLA helper extraction are integrated into `master` at `e7d9b14`; dashboard regression tests confirm unchanged counts, visibility, ranking, response shape, and boundaries. Browser visual verification remains incomplete. |
| Customer Portal | ✅ COMPLETE | `feature/customer-portal` | Customer-owned Portal APIs, IDOR-safe ownership, creation, public replies, and reopening | Final responsive English/Arabic Portal shell, overview, list, creation, detail, and navigation polish | 82 client / 87 server passing | Yes, prior verified run | Commit `458af2e` ancestry confirms integration into `master`. Authenticated English/Arabic desktop and mobile visual verification and final navigation regression verification were completed previously. |
| SLA / Automation | ✅ BASIC PRESENTATION COMPLETE | `feature/sla` (commit `e7d9b14`, contained in `master`) | Deadline snapshots/recalculation, one-time first-response recording, Portal-safe behavior, and one shared request-time derivation helper (`SlaState` + `SlaTarget` + fixed 60-minute window) consumed by Dashboard and authorized internal Ticket Details | Dashboard SLA presentation unchanged; internal Ticket Details gains a compact localized English/Arabic SLA subsection (state, effective target, effective deadline, raw first-response/resolution deadlines, first-response completion) using derived API fields, text-not-color-alone, LTR-isolated dates, no countdown | 103 client / 126 server passing | Not verified against PostgreSQL this session; 18 deterministic boundary tests cover all states | Basic SLA presentation and shared derivation are integrated into `master` at `e7d9b14`. Deferred: background workers, scheduled monitoring, persisted SLA state/breach events, notifications, automatic escalation/assignment, SLA reports, and SLA administration. PostgreSQL and authenticated browser verification of the Ticket Details SLA subsection remain outstanding. |
| Knowledge Base | ✅ COMPLETE — integrated into master | `feature/knowledge-base` (roadmap order 1), integrated into `master` at `ef647ef` | `server/src/modules/knowledge-base/*`: internal `GET/POST/PATCH/DELETE /api/knowledge-articles` (ADMIN/MANAGER manage, AGENT read-only), published-only `GET /api/portal/knowledge-articles(/:id)`; server-derived `createdById`; safe projections; both routers registered in `app.ts` | `client/src/features/knowledge-base/*` list/detail/editor + `/knowledge-base*` routes, nav item, AGENT editor guard; `client/src/features/portal/portal-knowledge-pages.tsx` + `/portal/knowledge-base*` Help Center | 37 server (`knowledge-article.test.ts` 31, `knowledge-article.portal.test.ts` 6) + 32 client (`knowledge-base.test.tsx` 23, `knowledge-article-hooks.test.tsx` 3, `portal-knowledge.test.tsx` 6) + guard/routing coverage; full suites at `ef647ef`: client 141 / server 163 / 304 total, 0 failed / 0 skipped / 0 todo | Not PostgreSQL/browser verified (not rerun in this documentation-only task); deterministic mocked tests cover every path | Commit `ef647ef`. No schema change. Limitations: no popularity/view tracking, no article versioning, no rich-text editing, no related-article recommendations. Historical Vite chunk-size warning remains non-failing. Unblocks AI suggested-solution and Reports content. |
| Quick Replies | 🟢 IMPLEMENTED — on branch, not integrated | `feature/quick-replies` (roadmap order 3), uncommitted | `server/src/modules/quick-replies/*`: `GET/POST/PATCH/DELETE /api/quick-replies` — `ADMIN`/`MANAGER` manage, `ADMIN`/`MANAGER`/`AGENT` list/read, `CUSTOMER`/anon rejected; server-derived `createdById`; safe author projection; `title asc, id asc`; case-insensitive title/body search; bounded pagination; router registered in `app.ts` | `client/src/features/quick-replies/*` manager-only `/quick-replies` workspace (nav `ADMIN`/`MANAGER` only, `QuickReplyManageRoute` → `/dashboard` guard). Refined table: `table-fixed` + `<colgroup>`, explicit **Title / Reply text / Updated / Actions** columns (Author moved to mobile-card meta), two-line clamps with `[overflow-wrap:anywhere]` + full value in `title`, icon-only Edit/Delete grouped in one Actions cell, anchored `role="dialog"` confirm popover (focus in on open, back to trigger on Cancel, pending-disable, `role="alert"` + Retry on failure); mobile cards with a trailing icon-action row. Composer: collapsed `Insert quick reply` trigger (`aria-haspopup`/`aria-expanded`) in a composer footer at the logical start with **Send reply** at the end (full-width stack on mobile); it opens a search popover **portalled to `document.body`** (`position: fixed`, anchored to the trigger rect, viewport-clamped, flips above when needed, `z-50`) so it clears the Conversation card's `overflow-hidden`; debounced server search, cursor/replace insertion, focus+caret restore, 20,000-char length guard, document `pointerdown` outside-close, never auto-send Also in this cycle a Ticket Details layout correction: `min-w-0` on both grid columns + `break-words [overflow-wrap:anywhere]` across message body / subject / description / History / customer email so long content can no longer produce a page-level horizontal scrollbar; conversation messages rebuilt as compact bordered cards (`max-w-[min(85%,46rem)]` on `sm+`, logical side alignment by author, Internal Note keeps the explicit label); a `MessageBody` `Show more` / `Show less` progressive-disclosure control (deterministic threshold >800 chars or >10 newlines, `line-clamp-[10]`, `aria-expanded`, full text always in the DOM); content-sized desktop actions (`sm:w-auto` on Save changes / Upload attachment / Send reply / Close-confirm), `sm:grid-cols-2 xl:grid-cols-1` Manage Ticket field grid, attachment filename `title`. New `tickets.conversation.showMore` / `showLess` (EN/AR). | 24 server (`quick-reply.test.ts`) + 66 client (`quick-replies.test.tsx` 21, `quick-reply-manage-route.test.tsx` 5, `quick-reply-composer.test.tsx` 26 — incl. portal-location + outside-`pointerdown`-close, `ticket-details-layout.test.tsx` 14 — containment / bubbles / Show more-less / responsive action sizing / Manage Ticket grid / EN-AR); full suites on branch: client 256 / server 243 / 499 total, 0 failed | Not PostgreSQL/browser verified | No Prisma schema change. No placeholders/variables, categories/folders, favorites, usage analytics, or AI generation. Composer popover fetches a bounded page (`limit` 10) per debounced search — all replies reachable by title/body text. The popover is portalled to `document.body` (`position: fixed`, viewport-clamped, flips above) to clear the Ticket Conversation card's `overflow-hidden`. Not in Internal Note, read-only/unassigned, or Customer Portal. Icon set is inline SVG (no icon dependency). |
| Customer Feedback | 🟢 IMPLEMENTED — on branch, not integrated | `feature/customer-feedback` (roadmap order 4), uncommitted | `server/src/modules/feedback/*`: `POST`/`GET /api/portal/tickets/:id/feedback` as `portalRouter` sub-routes (`requireRole(CUSTOMER)`); eligibility = own ticket, stored status `RESOLVED`/`CLOSED`; `rating` int 1–5, optional `comment` ≤2,000, `customerId` server-derived; one `Feedback` per ticket (`@unique` + in-transaction pre-check); one `TicketHistory` `FEEDBACK_SUBMITTED` row per submission; `feedbackEligible` + `feedback` added to `portal.service.ts` `ticketDetail` | `client/src/features/portal/*`: `useSubmitPortalFeedback`, `submitPortalFeedback`, `PortalFeedback` type, `portalFeedbackSchema`; a feedback section on the Portal ticket-detail page — required `role="radiogroup"` star control + optional comment textarea + submit for eligible/unsubmitted, read-only `role="img"` star summary + comment + "Submitted {date}" once present, nothing otherwise; `portal.feedback.*` EN/AR (520/520 parity) | 10 server (`feedback.test.ts`) + 3 client (added to `portal-pages.test.tsx`); full suites on branch: client 259 / server 253 / 512 total, 0 failed / 0 skipped / 0 todo | Not PostgreSQL/browser verified; deterministic mocked tests cover every route/role/status/one-per-ticket/validation path | No Prisma schema change. ADR-023. Limitations: no edit/withdraw, no internal/agent feedback view (deferred to `feature/reports`), no CSAT-vs-NPS distinction, no follow-up prompts or reminder emails, no reports surface. Historical Vite chunk-size warning remains non-failing. |
| Reports | 🟢 IMPLEMENTED — on branch, not integrated | `feature/reports` (roadmap order 5), uncommitted | `server/src/modules/reports/*`: `GET /api/reports/{overview,tickets,agents,sla}` (`requireRole(ADMIN, MANAGER)`), registered at `/api/reports` after `/api/dashboard`; optional `from`/`to` ISO range (default trailing 30 days, UTC bucketing, `from>to`/`>366d`/unknown-field → 400); created cohort + `resolvedAt`-in-range resolved counts; SLA met/breached/pending derived from stored timestamps (no persisted breach record); satisfaction from `Feedback.rating`; no schema change | `client/src/features/reports/*` (`reports.types.ts`, `reports-permissions.ts` `canViewReports`, `reports-api.ts`, `reports-hooks.ts`, `reports-page.tsx`) + `client/src/app/router/reports-route.tsx` guard (AGENT/CUSTOMER → `/dashboard`); `/reports` route + conditional nav item; date-range presets (7/30/90) + custom `from`/`to` synced to URL; KPI cards, created-vs-resolved volume + status charts (Recharts), SLA compliance bars + per-priority table, satisfaction distribution, agent-performance table (desktop + mobile cards), priority/category breakdown; loading/page-error/section-error/empty states; `reports.*` EN/AR (577/577 parity), RTL | 12 server (`reports.test.ts`) + 10 client (`reports.test.tsx`) + 3 route-guard (`reports-route.test.tsx`); full suites on branch: client 282 / server 265 / 547 total, 0 failed / 0 skipped / 0 todo | Not PostgreSQL/browser verified; deterministic mocked tests cover auth, range validation, and all aggregation math | No Prisma schema change. ADR-024. Limitations: no department/branch/channel breakdown, no previous-period trend deltas, no CSV/PDF export, no per-day SLA series, no caching (recomputes per call), fixed UTC bucketing. Historical Vite chunk-size warning remains non-failing. |
| Users Management & Shared AppSelect | 🟢 IMPLEMENTED — on branch, not integrated | `feature/user-management` (roadmap order 6), uncommitted | `server/src/modules/users/*`: `GET /users`, `GET /users/:id`, `POST /users`, `PATCH /users/:id` (name/email/role/isActive — **single safe update path**, only submitted keys written, runs in one `$transaction`) — all `requireAuth` → `requireActiveUser` → `requireRole(ADMIN)` (no `app.ts` change; `/users/agents` keeps its ADMIN/MANAGER/AGENT lookup + filters `isActive`). No `PATCH /users/:id/role` route. Strict Zod; safe projection (no `passwordHash`); bcrypt cost 12; internal-role-only (`CUSTOMER` id → 404). Conflicts: self role change → 409 `SELF_ROLE_CHANGE_FORBIDDEN`, self deactivation → 409 `SELF_DEACTIVATION_FORBIDDEN`, last active ADMIN demote/deactivate → 409 `LAST_ACTIVE_ADMIN_REQUIRED`, dup email → 409 `EMAIL_ALREADY_REGISTERED`. New `server/src/middleware/require-active-user.ts` resolves the caller's current DB role/active state before `requireRole` (demoted → 403, deactivated → 401 `ACCOUNT_DEACTIVATED`) — scoped to `/api/users` admin routes. Schema: `User.isActive Boolean @default(true)` (migration `20260827101406_add_user_is_active`). `auth.service.ts`: deactivated login → 403, `/auth/me` mid-session → 401 `ACCOUNT_DEACTIVATED` | `client/src/features/users/*` + `client/src/app/router/user-manage-route.tsx` (non-ADMIN → `/dashboard`); `/users` list (search + role + status filters synced to URL, `table-fixed` TanStack table with read-only Role/Status **badges** + `truncate` email + `You` badge + mobile cards), `/users/new` + `/users/:id/edit` forms (Role dropdown via `AppSelectField` with `Controller`, disabled + explained on your own account; Active checkbox disabled for self), row Edit + Deactivate/Reactivate actions; the confirmation is a **portalled** anchored `role="dialog"` (`aria-modal`) rendered on `document.body` via `components/shared/use-anchored-popover.ts`. **Shared AppSelect Component**: Created `@radix-ui/react-select` based `AppSelect` and `AppSelectField` primitives (`client/src/components/ui/app-select.tsx` and `select.tsx`) featuring branded trigger/content shells, single rotating chevron, check indicator for selected option, portal floating menu, empty string sentinel mapping, and full ARIA/keyboard/RTL accessibility. Replaced all native `<select>` elements across the CRM: User Management filters & forms, Ticket Management filters, form, & detail operations, Customer Portal status filter & creation category, Knowledge Base status filter & form status. Unit tests in `app-select.test.tsx` (11 tests); `users.*` + `navigation.users` EN/AR (644/644 parity), RTL | server `user.test.ts` 31 + `auth.test.ts` 2 deactivation + `middleware/auth.test.ts`; client `users.test.tsx` 35 + `app-select.test.tsx` 11 + `user-manage-route.test.tsx` 4; full suites on branch: **client 332 / server 298 (630 total)**, 0 failed / 0 skipped / 0 todo | Not PostgreSQL/browser verified; deterministic mocked tests cover every route/role/guard/validation/self-protection/last-admin/stale-JWT-role path and all AppSelect primitives across features | ADR-025 (+ pre-integration correction addendum; portalled status-confirmation correction; shared AppSelect foundational component). One column added (`User.isActive`). Limitations: no password-reset flow, no bulk actions, no CSV import/export, no admin-action audit log, no MFA/session revocation, no department/branch assignment, no user-deletion route (retire via `isActive=false`); active-session freshness is enforced on `/api/users` + `/auth/me` only (other routers use JWT role until 8h expiry — deliberate, no per-request lookup, no refresh tokens). Historical Vite chunk-size warning remains non-failing. |
| Settings | ⚪ NOT_STARTED | `feature/settings` (planned, order 7) | Not implemented | Not implemented | None | No | Nothing editable in-app; categories read-only, SLA rules managed directly. |
| Notifications | ⚪ NOT_STARTED | `feature/notifications` (planned, order 8) | Schema only (`Notification`) | Not implemented | Schema only | Schema only | In-app read/unread only when built. |
| SLA Automation | ⚪ NOT_STARTED | `feature/sla-automation` (planned, order 9) | Manual escalation only; no monitoring/auto-assign/alerts | Not implemented | None | No | Distinct from request-time SLA derivation, which is done. |
| Attachments | ✅ COMPLETE — integrated into master | `feature/attachments` (roadmap order 2), integrated into `master` at `8e24d22` | `server/src/modules/attachments/*`: private Vercel Blob adapter behind `AttachmentStorage` + in-memory test adapter; `busboy` bounded 4 MiB single-file parser rejecting all textual multipart fields (reserved → `422 INVALID_ATTACHMENT_CONTEXT`, other → `422 INVALID_UPLOAD`); content-signature MIME allowlist; per-context authorization service; internal `GET/POST` ticket/message/customer routes + `GET /api/attachments/:id/download`; Portal `GET/POST /api/portal/tickets/:id/attachments` + `GET /api/portal/attachments/:id/download`; safe download headers; orphan cleanup on DB-after-provider failure; `GET /customers/:id` no longer leaks `storageKey` | `client/src/features/attachments/*` (list/upload + `AttachmentActions` icon Preview/Download buttons + `AttachmentPreviewDialog` in-browser image/PDF/text preview via a temp authenticated Blob URL) + sections in Ticket Details, Ticket conversation (message attachments), Customer Details tab, and Portal Ticket Details | 56 server (`attachment.test.ts`) + 49 client (`attachments.test.tsx` 44 incl. Preview action/dialog, `attachment-api.test.ts` 5); full suites at `8e24d22`: client 190 / server 219 / 409 total, 0 failed / 0 skipped / 0 todo | Not PostgreSQL/Blob/browser verified — automated suites use a mocked storage adapter; a developer-provided git-ignored `server/.env` carries a real private-Blob token but no live upload/download or authenticated browser check was run | Commit `8e24d22`. No schema change. No malware scanning; no attachment deletion; **no thumbnails / image transformations** (the in-browser Preview is a client presentation of the same authorized download — not a public URL and not malware scanning); no multi-file/resumable upload; DB has no uploader/size/checksum column; no background orphan-cleanup worker. |
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
| Attachments | COMPLETE | `server/src/modules/attachments/*` — private Vercel Blob adapter, 4 MiB signature-validated upload with strict multipart-field rejection, per-context authorization, internal + Portal routes, safe authenticated download proxy, orphan cleanup; `GET /customers/:id` `storageKey` leak fixed | Ticket Details / conversation / Customer Details tab / Portal Ticket Details attachment sections; icon Preview/Download actions + accessible preview dialog | `attachment.test.ts` (56), `attachments.test.tsx` (44), `attachment-api.test.ts` (5) | Integrated at `8e24d22`; automated-verified (mocked adapter covers every path). Live PostgreSQL, private Vercel Blob upload/download, and authenticated English/Arabic browser verification outstanding | No malware scanning, no deletion endpoint, no thumbnails/image transforms, no multi-file/resumable upload; DB records no uploader/size/checksum | `feature/attachments` — integrated at `8e24d22` |

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
| Quick replies | IMPLEMENTED (on branch, not integrated) | `server/src/modules/quick-replies/*` — `/api/quick-replies` CRUD, `ADMIN`/`MANAGER` manage, `AGENT` list/read | `client/src/features/quick-replies/*` — refined manager `/quick-replies` table (Title/Reply text/Updated/Actions, icon actions, anchored confirm popover) + collapsed composer trigger + anchored search popover in the reply-composer footer | `quick-reply.test.ts` (24), `quick-replies.test.tsx` (21), `quick-reply-manage-route.test.tsx` (5), `quick-reply-composer.test.tsx` (26), `ticket-details-layout.test.tsx` (14) | Automated-verified on branch; PostgreSQL/browser outstanding | Insertion is editable and never auto-sends; composer dropdown is portalled (clears the Conversation card clipping); conversation bubbles + `Show more`/`Show less`; long content contained via `min-w-0`/`[overflow-wrap:anywhere]`; desktop actions content-sized; not in Internal Note or Portal; no placeholders/variables/analytics | `feature/quick-replies` (roadmap order 3, uncommitted) |
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
| Submit feedback | IMPLEMENTED (on branch, not integrated) | `server/src/modules/feedback/*` — Portal `POST`/`GET /api/portal/tickets/:id/feedback`, eligibility on own `RESOLVED`/`CLOSED` ticket, `rating` 1–5 + optional `comment`, one per ticket, `FEEDBACK_SUBMITTED` history row | `client/src/features/portal/*` — star-rating + comment section on Portal ticket detail (read-only submitted state), on the redesigned Portal Ticket Details page that now shares the internal conversation/card visual language | `feedback.test.ts` (10), `portal-pages.test.tsx` (+13: 3 feedback, 10 design-alignment) | Automated-verified on branch; PostgreSQL/browser outstanding | One immutable submission per ticket; `customerId` server-derived; no internal/agent view (→ `feature/reports`); no edit/withdraw | `feature/customer-feedback` (roadmap order 4, uncommitted) |

### 9. Reports and Management

| Requirement | Status | Backend evidence | Frontend evidence | Tests | DB/browser evidence | Gap | Planned branch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ticket reports | IMPLEMENTED (on branch) | `GET /api/reports/overview` + `/tickets` — created/resolved volume, daily buckets, status/priority/category breakdown | `/reports` page: KPI cards, created-vs-resolved chart, breakdown tables | `reports.test.ts`, `reports.test.tsx` | Automated-verified; PostgreSQL/browser outstanding | Fixed UTC buckets; no export/trend deltas | `feature/reports` (uncommitted) |
| SLA performance | IMPLEMENTED (on branch) | `GET /api/reports/sla` — first-response + resolution met/breached/pending, compliance %, per-priority, avg minutes (timestamp-derived) | SLA compliance bars + per-priority table on `/reports` | `reports.test.ts` | Automated-verified; PostgreSQL/browser outstanding | No persisted breach record; no per-day SLA series | `feature/reports` (uncommitted) |
| Agent performance | IMPLEMENTED (on branch) | `GET /api/reports/agents` — per-agent assigned/resolved/open/SLA-met%/avg-response over the created cohort | Agent table (desktop + mobile cards) on `/reports` | `reports.test.ts`, `reports.test.tsx` | Automated-verified; PostgreSQL/browser outstanding | No productivity metrics beyond stored columns | `feature/reports` (uncommitted) |
| Customer satisfaction | IMPLEMENTED (on branch) | `GET /api/reports/overview` — `Feedback.rating` average + 1–5 distribution + response count for rows created in range | Satisfaction KPI + distribution bars on `/reports` | `reports.test.ts`, `reports.test.tsx` | Automated-verified; PostgreSQL/browser outstanding | No CSAT-vs-NPS split; needs demo feedback rows to look populated | `feature/reports` (uncommitted) |
| Management dashboards | PARTIAL | `GET /dashboard/overview` — KPIs, status distribution, role-scoped queues, request-time SLA | Dashboard page with KPI cards + distribution chart | `dashboard.test.ts`, `dashboard-page.test.tsx` | Automated-verified; browser outstanding | Operational only; no date-range analytics, no trends, no agent-performance summary | `feature/reports` |

### 10. Security and Administration

| Requirement | Status | Backend evidence | Frontend evidence | Tests | DB/browser evidence | Gap | Planned branch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Users and roles | IMPLEMENTED (on branch) | `Role` enum; JWT; `requireAuth`/`requireRole` on all live routers; CUSTOMER-only registration; `feature/user-management` adds ADMIN-only `/api/users` CRUD (role changes via `PATCH /users/:id`, no `/role` route), `User.isActive` (deactivated → `ACCOUNT_DEACTIVATED` at login, `/auth/me`, `/api/users`), `requireActiveUser` DB-fresh role check on `/api/users`, and server-enforced self-role / self-deactivation / last-active-admin guards | Role-aware nav/route guards; login/register; `/users` list (read-only role/status badges) + create/edit (role in Edit form) + portalled anchored deactivate/reactivate confirmation (ADMIN) | `auth.test.ts`, `auth-context.test.tsx`, `middleware/auth.test.ts`, `user.test.ts`, `users.test.tsx`, `user-manage-route.test.tsx` | PostgreSQL-verified (prior); user-management branch not yet PostgreSQL/browser verified | No password-reset flow, no admin-action audit log, no user-deletion route (retire via `isActive=false`); active-session freshness scoped to `/api/users` + `/auth/me` | `feature/user-management` (on branch, ADR-025 + correction) |
| Permissions | PARTIAL | Server-side `requireRole` groups per route; customer read/write split; agent allowlist; portal boundary | UI hides unauthorized controls; redirect guards | `customer.test.ts`, `ticket.test.ts`, `portal.test.ts` | PostgreSQL-verified (prior) | Permission model for KB, Reports, Users mgmt, Settings, Feedback, Notifications, Tasks not implemented (see `06-auth-rbac.md`) | multiple (per feature) |
| Audit logs | NOT_STARTED | no `AuditLog` model; `TicketHistory` covers ticket lifecycle only | none | none | N/A | No general audit log across entities | deferred P2 (roadmap tail) |
| System configuration | IMPLEMENTED (on branch) | ADMIN-only `/api/settings/categories` list/create/update/activation and `/api/settings/sla-rules` list/per-priority upsert; active-only `/api/categories` unchanged | ADMIN-only `/settings` with Categories table/cards and editor, four SLA editors, and existing Quick Replies link | `settings.test.ts`, `settings-route.test.tsx` | Automated-verified; PostgreSQL/browser outstanding | No General/Branding/provider/integration settings; SLA changes prospective only | `feature/settings` (uncommitted) |

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
| COMPLETE | 24 |
| PARTIAL | 7 |
| NOT_STARTED | 18 |
| ARCHITECTURE_ONLY | 9 |
| INTENTIONALLY_DEFERRED | 1 |
| **Total requirement rows** | **59** |

Recount proof (every §1–§12 sub-table row counted once): 5 + 5 + 5 + 6 + 6 + 4 + 5 + 5 + 5 + 4 + 4 + 5 = 59 rows. COMPLETE 24 (§1 profiles/contact/notes/**Attachments** = 4, §2 = 5, §3 web forms = 1, §4 = 2, §5 = 2, §6 = 4, §8 = 4, §12 = 2) + PARTIAL 7 (§1 interaction history, §4 team collaboration, §5 escalation rules, §9 management dashboards, §10 users+permissions, §11 APIs) + NOT_STARTED 18 + ARCHITECTURE_ONLY 9 + INTENTIONALLY_DEFERRED 1 = 59. Attachments moved PARTIAL → COMPLETE on integration at `8e24d22`; no other status changed.

COMPLETE includes 5 rows delivered by `feature/knowledge-base` (Knowledge Base FAQs / Help articles / Solutions and guides / Search, and Customer Portal "Access FAQs"), integrated into `master` at `ef647ef`, plus the Customer-Management Attachments row, integrated at `8e24d22`. Both are automated-verified; PostgreSQL, private Vercel Blob (attachments), and authenticated browser verification of both remain outstanding.

Verification outstanding on implemented work: 6 areas — basic SLA derivation/presentation (PostgreSQL + browser), Agent Dashboard (browser), Ticket Conversation workspace (browser capture), responsive visual review of Dashboard + SLA subsection (browser), Knowledge Base (PostgreSQL + authenticated English/Arabic browser), and Attachments (PostgreSQL + live private Vercel Blob upload/download + authenticated English/Arabic browser). Automated boundary/regression tests cover these; live checks were not rerun.

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
- Limitation: customer-profile attachment upload/download was added later by `feature/attachments` (`8e24d22`, ADMIN/MANAGER upload, all internal roles read/download); `GET /customers/:id` no longer exposes `storageKey`.

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
- Limitation: background SLA automation remains unimplemented. Ticket and Ticket-message attachments were added later by `feature/attachments` (`8e24d22`).

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
- Limitation: Portal feedback, notifications, realtime updates, profile editing, and external channels remain deferred. Portal Knowledge Base (Help Center, `ef647ef`) and Portal owned-ticket attachments (`8e24d22`) were added later.

### Secure Attachments

- Branch: `feature/attachments`; integrated into `master` at `8e24d22` (`cb63871` is a docs-only tracker update on top). Roadmap order 2. No Prisma schema or migration change.
- Delivered: an `AttachmentStorage` interface with a private Vercel Blob adapter (server-side token only, no fallback to public/local storage) and an in-memory test adapter; a `busboy` bounded single-file (`file` field, 4 MiB) parser that rejects every textual multipart field (`storageKey`/`ticketId`/`messageId`/`customerId`/`mimeType`/`fileName`/`createdAt` → `422 INVALID_ATTACHMENT_CONTEXT`, any other → `422 INVALID_UPLOAD`); content-signature MIME validation (`image/jpeg|png|webp`, `application/pdf`, `text/plain` with full-buffer text checks); a per-context authorization service (ticket / ticket-message with author-match for all roles / customer-profile / Portal owned ticket); `GET/POST /api/tickets/:id/attachments`, `GET/POST /api/tickets/:id/messages/:messageId/attachments`, `GET/POST /api/customers/:id/attachments`, `GET /api/attachments/:id/download`, and Portal `GET/POST /api/portal/tickets/:id/attachments` + `GET /api/portal/attachments/:id/download` with separate minimal projections; a safe authenticated download proxy (`head` size check before `get`, `Content-Disposition: attachment` + RFC 5987, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`, stored validated MIME, never a provider URL); best-effort orphan cleanup on DB-after-provider failure with a logged storage key (no background worker); `GET /customers/:id` no longer selects `storageKey`; frontend feature module + sections in Ticket Details, the conversation (message attachments), the Customer Details Attachments tab, and Portal Ticket Details; icon-only Preview and Download actions; an accessible modal that previews images, PDFs (browser viewer), and escaped plain text from a temporary authenticated Blob URL revoked on close / file change / unmount; English/Arabic + RTL strings.
- Tests: client 22 files / 190 passed, server 12 files / 219 passed, root 34 files / 409 passed (0 failed / 0 skipped / 0 todo) at `8e24d22` — historical evidence, not rerun for this documentation sync. Client + server lint, typecheck, and builds passed; translation JSON `en`/`ar` parity held; `git diff --check` and OpenWolf validation passed; the pre-existing non-failing Vite >500 kB chunk warning remained (~1,063 kB / gzip ~314 kB).
- Limitations: no malware scanning (signature/allowlist validation only), no deletion endpoint, no thumbnail generation, no image transformations, no multi-file or resumable upload, no background orphan-cleanup worker; the `Attachment` model records no uploader, size, or checksum. Live PostgreSQL, private Vercel Blob upload/download, and authenticated English/Arabic browser verification are outstanding.

## 4. Earlier Integrated Feature — Basic SLA Presentation (historical detail)

- Basic SLA presentation was implemented on `feature/sla` from synchronized `master`, then committed by the developer as `e7d9b14 feat: complete basic SLA presentation` and fast-forward merged into `master`. `feature/sla` is contained in `master`. A later docs-only commit `e387667 update progress tracking` sits on top of `e7d9b14`; `master` has since advanced past it to `d89cf47` (docs-only), `ef647ef` (Knowledge Base), `069839a` (docs-only KB sync), `8e24d22` (Secure Attachments), and `cb63871` (docs-only tracker update). The prior "only uncommitted change is this tracker" note is superseded: that synchronization was committed as `e387667`.
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

Roadmap order 2 (`feature/attachments`) is integrated into `master` at `8e24d22` and automated-verified: private Vercel Blob storage behind an adapter interface, 4 MiB signature-validated single-file upload with strict multipart-field rejection, per-context authorization (ticket / ticket message / customer profile / Portal owned ticket), a safe authenticated download proxy with `nosniff` and forced-attachment headers, orphan cleanup, icon-only Preview/Download actions, an accessible in-browser image/PDF/text preview dialog, and English/Arabic + RTL UI. No schema change. Live PostgreSQL, private Vercel Blob, and authenticated browser verification are outstanding.

Roadmap order 3 (`feature/quick-replies`) is implemented on its uncommitted branch and automated-verified: internal `/api/quick-replies` CRUD with `ADMIN`/`MANAGER` management and `ADMIN`/`MANAGER`/`AGENT` list/read (`CUSTOMER`/anon rejected), server-derived `createdById`, safe author projection, title-then-id ordering, case-insensitive title/body search, bounded pagination; a manager-only `/quick-replies` list + create/edit workspace with a role-gated nav item and an `AGENT`→`/dashboard` route guard; a `QuickReplyPicker` in the internal Ticket public-reply composer (Reply tab, mutating agent only): a collapsed `Insert quick reply` trigger (`button-secondary`, `aria-haspopup`/`aria-expanded`, inline-SVG icon) in a composer footer beside **Send reply** (footer stacks full-width on mobile), opening a keyboard-accessible search popover portalled to `document.body` (`position: fixed`, anchored to the trigger rect, viewport-clamped, flips above when room is tighter below, `z-50`, repositions on scroll/resize) so it escapes the Conversation card's `overflow-hidden` — debounced (~300 ms) server search over the existing list contract, loading/empty/no-results/non-blocking-error states, Arrow/Enter/Escape, document-`pointerdown` outside-close, focus returned to the trigger; cursor-aware insertion (replace selection or insert at caret, preserve surrounding draft, focus + caret restored after the inserted text), and a 20,000-char public-reply length guard that leaves the draft unchanged with a localized `role="alert"` error rather than truncating; never auto-sends; absent from the Internal Note tab, read-only/unassigned states, and the Customer Portal. The management table was refined to explicit **Title / Reply text / Updated / Actions** columns (`table-fixed` + `<colgroup>`), two-line clamps with `[overflow-wrap:anywhere]` and full values in `title`, icon-only Edit/Delete grouped in one Actions cell, and an anchored `role="dialog"` deletion-confirmation popover with focus management and a `role="alert"` + Retry failure path; mobile cards gained a trailing icon-action row. English/Arabic + RTL throughout. No schema change. PostgreSQL and browser verification are outstanding.

`feature/customer-feedback` is integrated at `12a0c12`; Reports at `827b3ff`; User Management at `8db4a83`; shared AppSelect at `18e44a0`; the UI design-system enhancement at `ae88e64`; and the Lucide icon refactor at `e528aa4`. Git ancestry confirms all are contained in `master`, and `master` equals `origin/master` at `e528aa4`. `feature/settings` (roadmap order 7) is the current implemented, automated-verified, uncommitted feature branch. The next roadmap feature after developer review/integration is **`feature/notifications`** (order 8). Historical verification evidence is preserved without claiming a rerun.

Full dependency-aware sequence (one isolated branch per feature; ADR-019; mirrored in `docs/14-implementation-plan.md`):

| Order | Branch | Feature |
| ----: | ------ | ------- |
| 1 | `feature/knowledge-base` | Internal KB CRUD/search, published customer read, Portal FAQs — **integrated into `master` at `ef647ef`** |
| 2 | `feature/attachments` | Secure attachment upload/download, per-context ownership, and Preview/Download UX — **integrated into `master` at `8e24d22`** |
| 3 | `feature/quick-replies` | Quick Reply management and composer insertion — **integrated into `master` at `79c7067`** |
| 4 | `feature/customer-feedback` | Portal feedback workflow and eligibility — **implemented on branch, not integrated** |
| 5 | `feature/reports` | Ticket, SLA, agent, and satisfaction reports — **integrated at `827b3ff`** |
| 6 | `feature/user-management` | ADMIN-managed internal users and roles — **integrated at `8db4a83`; AppSelect at `18e44a0`** |
| 7 | `feature/settings` | Real configuration pages for existing configurable resources — **integrated at `9d6beb0`** |
| 8 | `feature/notifications-roadmap` | In-app notifications and read/unread workflow — **implemented on branch, unstaged and uncommitted** |
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

- In-app notifications, reports, quick replies, customer feedback, and richer ticket history. (Knowledge Base is integrated into `master` at `ef647ef`; Secure Attachments at `8e24d22`.)
- Complete demo seed data for users, customers, tickets, conversations, articles, SLA states, and feedback.

### Deferred / Demonstration Only

- AI assistance, automatic assignment, general audit logs, multi-department behavior, and multi-branch behavior remain P2.
- WhatsApp, SMS, inbound email ingestion, production live chat transport, ERP, arbitrary external systems, and a full AI chatbot remain P3 architecture/demo scope.

## 7. Known Limitations

- No refresh-token, token-revocation, or production session infrastructure.
- Customer Portal feedback, notifications, profile editing, and external messaging integrations remain deferred. Customer Portal owned-ticket attachments (`8e24d22`) and the Portal Knowledge Base / Help Center (`ef647ef`) are integrated into `master`.
- Attachment upload/download with a private Vercel Blob store, 4 MiB signature-validated single-file uploads (no textual multipart fields accepted — reserved names → `422 INVALID_ATTACHMENT_CONTEXT`, others → `422 INVALID_UPLOAD`), service-level context/ownership validation, a safe authenticated download proxy, orphan cleanup, an icon-only Download action, and an accessible in-browser Preview dialog (image / built-in PDF viewer / escaped text from a temporary authenticated Blob URL) are integrated into `master` at `8e24d22` (automated-verified; live PostgreSQL / private Vercel Blob / authenticated browser verification outstanding). No malware scanning, no attachment deletion, **no thumbnails or image transformations** (Preview is a client presentation of the same authorized download, not a public URL and not malware scanning), no multi-file or resumable upload, no background orphan-cleanup worker; the model records no uploader, size, or checksum.
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

### `feature/customer-feedback` (2026-08-27, implemented on the uncommitted branch, NOT integrated)

Full suites were run on `feature/customer-feedback` (branched from `master` at `79c7067`). Baseline before this feature was client 256 / server 243 / 499 total (the `feature/quick-replies` branch state, now integrated at `79c7067`).

| Command / category | Files | Passed | Failed | Skipped | Todo | Exit code | Evidence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Server tests: `npm --prefix server run test` | 14 | 253 | 0 | 0 | 0 | 0 | +10 vs baseline: new `server/src/modules/feedback/feedback.test.ts` — unauthenticated 401 and every internal role 403 on `POST`; `CUSTOMER_PROFILE_REQUIRED` when no linked customer; rating range/integer/type + unknown-field + blank-comment rejection (400); IDOR-safe `404 TICKET_NOT_FOUND` for a missing/non-owned ticket with the `{ id, customerId }` scope asserted; `409 TICKET_NOT_ELIGIBLE_FOR_FEEDBACK` for a non-`RESOLVED`/`CLOSED` ticket (no `feedback.create`); `409 FEEDBACK_ALREADY_SUBMITTED` when a row exists (no `feedback.create`); `201` for `RESOLVED` and `CLOSED` with the trimmed comment, `{ ticketId, customerId, rating }` create payload, and a `TicketHistory` `FEEDBACK_SUBMITTED` / `newValue:"5"` row; `NULL` comment when omitted; `GET` reads back the row or `404 FEEDBACK_NOT_FOUND`. `portal.test.ts` (11) and `knowledge-article.portal.test.ts` (6) unchanged and green with the extended `ticketDetail` select. |
| Client tests: `npm --prefix client run test` | 26 | 269 | 0 | 0 | 0 | 0 | Feedback feature: +3 in `portal-pages.test.tsx` (eligible `RESOLVED` renders the star form and blocks submit with a `role="alert"` until a rating is chosen, then calls the mutation with `{ rating: 4, comment: "Fast and helpful" }`; a ticket with `feedback` renders the read-only `role="img"` "5 out of 5" summary + comment and no submit button; a non-eligible ticket renders no feedback section). Portal Ticket Details design alignment: **+10 more** in `portal-pages.test.tsx` (shared bordered conversation card + timeline list + no internal sidebar grid; customer→`justify-start` / support→`justify-end` width-bounded bubbles; long unbroken body + description get `[overflow-wrap:anywhere]` with newlines preserved; `Show more`/`Show less` disclosure with `aria-expanded` and short messages with no toggle; author labels "You"/"Support Team" with no internal roles/notes/Quick-Reply/Manage/SLA leakage; shared composer footer with content-sized `sm:w-auto sm:ms-auto` Send; closed ticket → calm bordered notice, no Send; bordered colour-coded status badge, not `bg-muted`; attachments panel in the shared card; Arabic "أنت"/"فريق الدعم" + RTL). Internal `ticket-details-layout.test.tsx` (14), `ticket-pages.test.tsx` (34), `quick-reply-composer.test.tsx` (26) all still green against the extracted `ticket-conversation-ui.tsx` primitives (no assertion changes needed). |
| Server tests | — | 253 | 0 | 0 | 0 | 0 | Unchanged by the design-alignment work (no server files touched). |
| Combined/root tests: `npm run test` | 40 | 522 | 0 | 0 | 0 | 0 | Root command ran both suites successfully. |
| Client lint / Server lint | — | — | — | — | — | 0 | ESLint passed both packages. |
| Client typecheck / Server typecheck | — | — | — | — | — | 0 | `tsc -b` and `tsc -p tsconfig.json --noEmit` passed. |
| Client build / Server build | — | — | — | — | — | 0 | `vite build` (chunk >500 kB warning preserved, ~1,100 kB) and `tsc -p tsconfig.json` passed. |
| Translation parity | — | — | — | — | — | — | `portal.feedback.*` plus `portal.conversationDescription` / `portal.timelineLabel` added and `portal.author.*` values changed to "You" / "Support Team"; en 522 / ar 522 keys, identical key sets. |
| `git diff --check` | — | — | — | — | — | 0 | No whitespace errors. |

No Prisma schema or migration change. PostgreSQL and authenticated English/Arabic browser verification were NOT performed (no reachable DB / no dev-server browser session in this environment); deterministic mocked tests cover every route/role/status/one-per-ticket/validation path and the Portal Ticket Details shared-design structure.

**Customer Portal Ticket Details design alignment (pre-integration, this cycle).** The Portal ticket-detail body was refactored to share the internal Ticket Details visual language without exposing internal data or calling internal APIs.
- **Shared components introduced:** `client/src/features/tickets/ticket-conversation-ui.tsx` — role-neutral presentational primitives `MessageBody` (long-message progressive disclosure, unchanged threshold), `ConversationMessage` (width-bounded, logical start/end-aligned message card; `tone="internal"` amber variant), `ConversationSection` (bordered `overflow-hidden` card: header, `min-h-48` list/empty body, optional composer footer). `ticket-conversation.tsx` (internal) was rewritten to compose these; its rendered output and every existing assertion are unchanged. Duplicated conversation/message markup between the internal view and the Portal is removed.
- **Portal changes (`portal-pages.tsx`, `portal-ui.tsx`):** conversation rebuilt from the shared primitives; description moved into its own bordered card with `[overflow-wrap:anywhere]`; header order aligned to internal (ref → subject `h1` with `[overflow-wrap:anywhere]` → badges → metadata `dl`); reply composer rebuilt as the shared footer layout with a content-sized `sm:w-auto sm:ms-auto` Send and the closed notice as a calm bordered footer; `PortalStatus` given the internal `TicketStatusBadge` bordered colour-coded pill shape keyed by the five customer-facing statuses; attachments panel wrapped in the shared card. Message author labels changed from "Customer"/"Support" to **"You"/"Support Team"** (EN) and "أنت"/"فريق الدعم" (AR).
- **Authorization boundaries preserved:** no new endpoint, no internal Ticket API call from the Portal, no schema change. The Portal still renders only `feedbackEligible` + `feedback` + the existing public-conversation/metadata fields from the ownership-safe Portal APIs. No Internal Notes, Quick Replies, Manage Ticket, status/priority/assignment/escalation controls, Ticket History, or internal SLA data appear; regression tests assert their absence.
- **Browser verification:** OUTSTANDING. No dev-server/browser session is available in this environment; the shared-structure and no-leak assertions are covered by deterministic component tests only. A manual authenticated English/Arabic desktop/mobile comparison of Portal vs internal Ticket Details remains to be done by the developer.
- **Limitations:** long-filename containment and attachment icon actions on the Portal rely transitively on the shared `AttachmentPanel`/`AttachmentRows` tests (`attachments.test.tsx`, `ticket-details-layout.test.tsx`); they are not re-asserted in the Portal suite because the Portal test file mocks the attachment hooks to an empty list.

### `feature/quick-replies` (2026-08-26, implemented on the uncommitted branch, NOT integrated)

Full suites were run on `feature/quick-replies` (branched from `master` at `e34818b`). Baseline before this feature was client 190 / server 219 / 409 total. Counts below include the post-review correction (searchable combobox + cursor-aware insertion), the pre-integration UI refinement of the management table and the Ticket composer, the portal fix for the composer dropdown (`document.body` portal, `position: fixed`, anchored + viewport-clamped + flips above, `z-50`, document-`pointerdown` close), and a pre-integration Ticket Details correction: long-content containment (`min-w-0` on the two grid columns, `break-words [overflow-wrap:anywhere]` on message bodies / subject / description / History rows / customer email-phone, `truncate` + `title` on attachment filenames, `whitespace-nowrap shrink-0` on History timestamps — no application-level `overflow-x-hidden`); conversation messages rebuilt as compact bordered cards (`max-w-[min(85%,46rem)]` on `sm+`, logical `justify-start`/`justify-end` by author, Internal Notes keep the amber surface **and** the explicit `"Internal note"` label); a `MessageBody` progressive-disclosure control (deterministic threshold: >800 chars or >10 newlines → `line-clamp-[10]` + localized `Show more`/`Show less` with `aria-expanded`, full text always in the DOM); and content-sized desktop actions (`sm:w-auto` on Save changes / Upload attachment / Send reply / Close-confirm; `sm:grid-cols-2 xl:grid-cols-1` for the Manage Ticket fields), full-width on mobile.

| Command / category | Files | Passed | Failed | Skipped | Todo | Exit code | Evidence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Client tests: `npm --prefix client run test` | 26 | 256 | 0 | 0 | 0 | 0 | +66 vs baseline. New `ticket-details-layout.test.tsx` (14 — two grid columns `min-w-0`; long unbroken content wraps in message body / subject / description / History / customer email; long filename `truncate` + `title` with actions still reachable; History timestamp `whitespace-nowrap shrink-0` and outside the description flow; messages are width-bounded bubbles with `justify-start` (customer) / `justify-end` (staff); no Show more on a short message; long message → `Show more` `aria-expanded=false` → full text present (`line-clamp-[10]`, not truncated) → `Show less`; Internal Note keeps the `"Internal note"` label and the public reply keeps `"Visible to customer"`; Arabic `Show more`/`Show less` + RTL; Save changes / Upload attachment / Send reply are `button-primary` + `sm:w-auto`; composer footer `flex-col sm:flex-row` with `sm:ms-auto` Send; Manage Ticket `sm:grid-cols-2 xl:grid-cols-1`; attachment row actions grouped + reachable; Arabic action labels + RTL). Client: `quick-replies.test.tsx` (21 — list loading/error-retry/empty, URL search, **Title/Reply text/Updated/Actions headers + 4-`<col>` colgroup**, **Edit/Delete icon controls grouped in one Actions cell with localized names**, **long Title + Reply text constrained (`line-clamp-2` / `break-words` / `[overflow-wrap:anywhere]`) with full values in `title`**, **confirm-required delete + focus return on Cancel**, explicit-confirm delete, **pending prevents duplicate**, **failed delete visible + Retry**, **mobile cards render alongside the table**, create sends only `{title, body}`, invalid-title block, edit loads + sends, **Arabic RTL keeps the same column ownership**, nav visibility by role, and composer trigger/popover: **collapsed trigger with no permanent input**, opens searchable listbox + `aria-expanded`, loading/empty/non-blocking-error states, keyboard select + Escape-returns-focus), `quick-reply-manage-route.test.tsx` (5 — `AGENT` redirect to `/dashboard`, `ADMIN`/`MANAGER` allowed), `quick-reply-composer.test.tsx` (26 — real `QuickReplyPicker` + real `useQuickReplies` in a `QueryClientProvider`: **collapsed trigger, opens from trigger, Escape closes + returns focus**, **dropdown portalled to `document.body` (not inside the `overflow-hidden` Conversation card, `fixed` + bounded `maxHeight`)**, **outside `pointerdown` closes (pointer inside the panel does not)**, result shows title + body preview, search by title, search by body, loading/empty/no-results/API-failure states, keyboard selection, insertion at start/middle/end, replace-selection, surrounding-draft preservation, focus + caret restoration, **draft stays editable**, length-guard block with unchanged draft, English + Arabic length error, hidden in Note mode, hidden when `!canMutate`, **desktop footer trigger-start/Send-end layout**, **mobile full-width stacking**, **Arabic trigger + RTL selector**, results beyond the first page reachable via search, and an `fs` guard that no Portal source references the feature). `ticket-pages.test.tsx` keeps its `vi.mock` of `@/features/quick-replies/quick-reply-picker` (stub); its 34 count is unchanged. |
| Server tests: `npm --prefix server run test` | 13 | 243 | 0 | 0 | 0 | 0 | +24 vs baseline: `quick-reply.test.ts` (24 — unauthenticated 401 and `CUSTOMER` 403 on every route; `ADMIN`/`MANAGER`/`AGENT` list + single read; `title asc, id asc` ordering + safe author projection; bounded pagination; case-insensitive title/body search; unknown-query rejection; structured `QUICK_REPLY_NOT_FOUND` 404; `ADMIN`/`MANAGER` create with server-derived `createdById` + client-`createdById` rejection; `AGENT` create/update/delete 403; length validation; partial update; empty-update + unknown-field rejection; update/delete 404; delete 204). No server code changed in the correction or the UI refinement. Pre-existing handled stderr from the negative CORS / simulated failed-write / attachment-orphan tests still does not fail the suite. |
| Combined/root tests: `npm run test` | 39 | 499 | 0 | 0 | 0 | 0 | Root command ran both suites successfully. |
| Client lint / Server lint | — | — | — | — | — | 0 | ESLint passed both packages. |
| Client typecheck / Server typecheck | — | — | — | — | — | 0 | `tsc -b` and `tsc -p tsconfig.json --noEmit` passed. |
| Client build / Server build | — | — | — | — | — | 0 | Passed; Vite retained the pre-existing non-failing >500 kB chunk warning (~1,090 kB / gzip ~319 kB). |
| Translation JSON validation | 2 files | 508 / 508 keys | 0 | — | — | 0 | `en` and `ar` parse; identical flattened key sets including `quickReplies.*` (incl. `editAction`, `deleteAction`, `deleteConfirmLabel`, and `picker.trigger`/`searchPlaceholder`/`searching`/`error`/`empty`/`noResults`/`results`/`lengthExceeded`) and `navigation.quickReplies`, plus `tickets.conversation.showMore` / `showLess`. |
| Whitespace: `git diff --check` | — | — | — | — | — | 0 | No trailing-whitespace or conflict markers. |
| OpenWolf validation | 10 core files / 7 hooks | — | 0 | — | — | 0 | `openwolf status`: all core files, hook scripts, and registered matchers present. |

Ticket Conversation regression (`ticket-pages.test.tsx`, 34) and Customer Portal regression (`portal-pages.test.tsx` 9, `portal-knowledge.test.tsx` 6, `portal-routing.test.tsx`) all pass unchanged.

PostgreSQL and authenticated browser verification were **not** performed for this feature or for the pre-integration UI refinement: no reachable database or authenticated dev-server browser session was available in this environment. Deterministic mocked Supertest and React Testing Library coverage exercises every route, role, projection, filter, ordering, validation, and 404 path; the composer integration test drives the real picker + real query hook (with `getQuickReplies` mocked) for search, keyboard selection, popup states, cursor/replace insertion, focus/caret restoration, the length guard in both languages, and the visibility rules. The management-table refinement and the composer-dropdown portal fix are covered by structural assertions (column headers, `<colgroup>`, single Actions cell, containment classes, confirm-popover focus flow, mobile-card parity; portal panel is a `document.body` child with a `fixed` class and bounded `maxHeight`, is outside the `overflow-hidden` Conversation `region`, and closes on an outside `pointerdown` but not on a pointer inside the panel) since JSDOM computes no layout and returns a zero `getBoundingClientRect`. The Ticket Details layout correction (long-content containment, conversation bubbles, `Show more`/`Show less`, responsive action sizing, Manage Ticket grid) is likewise covered by structural + behavioural assertions in `ticket-details-layout.test.tsx`.

A browser pass — English and Arabic at 1440 / 1024 / 768 / 375 / 320 px and 200% zoom, with representative data (short/long multi-paragraph message, very long URL, long unbroken string, long filename, long History entry, an Internal Note, enough Quick Reply results to scroll, no-results and API-error states), and with the Quick Reply dropdown opened near the bottom / edges of the viewport where placement must flip — remains outstanding to confirm: no page-level horizontal scrollbar, stable sidebar width, long strings staying inside their cards, complete messages expandable, the dropdown fully visible / selectable / unclipped and within the viewport, compact desktop actions, touch-friendly mobile actions, long filenames not obscuring actions, correct EN/AR layouts, and no clipped focus ring.

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

### `feature/attachments` (2026-08-26, integrated into `master` at `8e24d22`)

Full suites were run during `feature/attachments` implementation; that work is committed at `8e24d22` and contained in `master` (`cb63871` is a docs-only tracker update on top). Baseline before this feature was client 141 / server 163 / 304 total. This documentation-only synchronization did **not** rerun the application suites — the counts below are preserved historical evidence from the feature implementation.

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

PostgreSQL, live Vercel Blob, and authenticated browser verification were **not** performed for this feature: the configured local `DATABASE_URL` was unreachable during implementation and no authenticated dev-server browser session was available. A developer-provided `server/.env` supplies a real `BLOB_READ_WRITE_TOKEN` (git-ignored, not part of the tracked integration), but no live upload/download against the private Blob store was run. The in-memory storage adapter and mocked Prisma exercise every route, role, projection, validation, failure, and cleanup path deterministically; these live checks remain outstanding on the integrated code.

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
| `master` | Synchronized integration branch | `e34818b` (`docs: sync attachments integration status`, a docs-only commit on top of `cb63871` → `8e24d22 feat: implement secure attachments`); equals the `origin/master` tracking ref | Ahead 0, behind 0. Contains `8e24d22`, `cb63871`, and `e34818b` (`git merge-base --is-ancestor` passes for each). |
| `docs/task-coverage-roadmap` | Task-coverage audit and roadmap reconciliation | Contained in `master` at `d89cf47` (`docs: reconcile task coverage and implementation roadmap`) | Docs-only. |
| `feature/knowledge-base` | Knowledge Base: internal `/api/knowledge-articles` CRUD, published-only `/api/portal/knowledge-articles`, internal `/knowledge-base*` routes + nav + AGENT editor guard, `/portal/knowledge-base` Help Center, EN/AR/RTL, tests | Contained in `master` at `ef647ef`; integrated by fast-forward from `d89cf47` (branch tip equals `master`) | Implemented and automated-verified; no schema/migration change. |
| `feature/attachments` | Secure Attachments and Preview/Download UX: private Vercel Blob adapter, per-context authorization, strict multipart-field rejection, safe authenticated download proxy, orphan cleanup, icon Preview/Download actions + accessible image/PDF/text preview dialog, EN/AR/RTL, tests | Contained in `master` at `8e24d22`; integrated by fast-forward, no merge commit; `cb63871` and `e34818b` (docs-only) sit on top | `8e24d22` is an ancestor of `master`. No schema/migration change. Live PostgreSQL / Vercel Blob / browser verification outstanding. |
| `feature/quick-replies` | Quick Reply management + editable composer insertion (roadmap order 3): `/api/quick-replies` CRUD (`ADMIN`/`MANAGER` manage, `AGENT` list/read), manager-only `/quick-replies` workspace + nav + `AGENT`→`/dashboard` guard, refined Title/Reply text/Updated/Actions table with icon actions + anchored confirm popover, collapsed `Insert quick reply` composer trigger + anchored search popover in a composer footer, cursor-aware insertion (never auto-send), EN/AR/RTL, tests | Implemented on the uncommitted branch off `e34818b`; NOT integrated | Branch not committed. No schema/migration change; no new ADR. PostgreSQL / browser verification outstanding. |
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
| SLA presentation | Shared request-time `deriveSla` helper, Ticket Details derived fields and UI, Portal SLA-free assertions | Contained in `master` | Commit `e7d9b14` (`feature/sla`) is an ancestor of `master`; `master` tip is now `cb63871` (docs-only, on top of `8e24d22 feat: implement secure attachments`). |

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
- Attachment upload/download, the per-context ownership-validation service, and the Preview/Download UX are integrated into `master` at `8e24d22` (private Vercel Blob, automated-verified only). PostgreSQL, live private Vercel Blob upload/download, and authenticated English/Arabic browser verification are outstanding. Attachment deletion and malware scanning remain unavailable by design; there is no background orphan-cleanup worker.
- Authentication has no refresh-token or server-side revocation infrastructure.
- The production client build retains a non-failing JavaScript chunk-size warning above 500 kB.
- Prisma CLI's development dependency tree retains the reported high-severity advisory; the suggested forced downgrade remains intentionally unapplied.
- No automated visual regression suite exists.
- `feature/knowledge-base` is integrated into `master` at `ef647ef` and automated-verified; its PostgreSQL and authenticated English/Arabic browser verification were not performed and rely on deterministic mocked tests until a developer completes them. `KnowledgeArticle.category` is unnormalized free text, so category filtering is exact-match on the stored string.
- `feature/quick-replies` (roadmap order 3) is implemented on its uncommitted branch and automated-verified only; its PostgreSQL and authenticated English/Arabic browser verification were not performed, including a visual pass of the refined management table (column alignment / long-content containment at 1440–320 px) and the composer footer + selector. The composer `QuickReplyPicker` opens an anchored search popover that fetches a bounded page (`limit` 10) per debounced search over `GET /api/quick-replies`; every quick reply is reachable by title/body text. Row Edit/Delete and the composer trigger use inline-SVG icons (no icon dependency). There are no placeholders/variables, categories/folders, favorites, usage analytics, or AI generation by design.
- Advanced integrations are intentionally deferred and must not be represented as functional.

## 13. Definition of Project Completion

Three distinct completion bars. Do not conflate them.

### Core support loop complete (achieved)

Authenticated internal users can manage customers and tickets, assign and progress tickets, exchange public replies, add private notes, see basic SLA state, use an agent dashboard, and securely complete the customer-side Portal ticket journey. Authorization, validation, loading/empty/error states, responsive behavior, RTL, and automated tests are in place. Integrated into `master` at `e7d9b14` / `e387667`. Outstanding: PostgreSQL and browser verification of the SLA subsection and Dashboard; a realistic demo dataset.

### Broader original-task demo complete (target)

Requires the core loop plus the features promoted by the coverage audit (ADR-019), expected to include at least:

- Knowledge Base — integrated at `ef647ef`
- Attachments (upload/download with ownership) — integrated at `8e24d22`
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
- Deferred: feedback, notifications, realtime updates, profile editing, and external channels. Owned-ticket attachments (`8e24d22`) and the Knowledge Base Help Center (`ef647ef`) were added later.
- Verification: the 2026-08-26 rerun passed 82 client and 87 server tests (169 total), with client/server lint, typecheck, and builds, translation JSON, and OpenWolf integrity passing. Prior real PostgreSQL verification passed for two-customer isolation, IDOR-safe reads/replies, server-derived defaults, creation history, WAITING_CUSTOMER/RESOLVED/CLOSED reply behavior, and unchanged first response/deadline preservation. No active MEDIUM SLA rule existed, so that prior run observed the documented null-deadline fallback rather than a non-null SLA snapshot.
- UI polish: the legacy customer AppShell no longer wraps PortalShell; the complete Home, My Requests, and New Request navigation is route-exact, geometrically centered on desktop, centered in a full-width mobile row, and presented as conventional text links with an active underline and accessible focus state. Forms, filters, request tables/cards, and page actions have visible accessible responsive treatment. Authenticated English/Arabic desktop captures covered all four routes, and English/Arabic mobile captures covered home, list, and creation with one header, one active item, visible controls, RTL, and no overflow. The final navigation regression suite passes 6/6 with client typecheck and whitespace validation passing.
