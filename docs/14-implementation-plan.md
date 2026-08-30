# Implementation Plan

The three-day plan below is the **historical** plan for the original time-boxed assessment. It is retained as written. Its Day 1–3 items describe the P0 support loop, which is implemented and integrated into `master`. It does not claim that Knowledge Base, Reports, AI, or other non-P0 areas were completed during those three days — several Day 2/Day 3 items ("Knowledge Base", "Reports", "AI", "seed data") were not reached and are carried into the post-P0 roadmap below.

The current dependency-aware roadmap from the integrated state through final demo and deployment is in section "Post-P0 Completion Roadmap" at the end of this document and is mirrored in `docs/19-progress-tracking.md`.

---

# Three-Day Implementation Plan (historical)

## Day 1: Foundation and Core CRM

### Foundation
- repository setup
- frontend setup
- backend setup
- PostgreSQL + Prisma
- linting and environment setup

### Core Models
- User
- Customer
- Ticket
- TicketMessage
- TicketNote
- Category

### Authentication
- register/login
- JWT
- protected routes
- role middleware

### Frontend Shell
- login
- application layout
- sidebar/header
- protected routing

### Customers
- list
- create
- edit
- details

### Tickets
- list
- create
- details
- update
- assign agent
- priority/category/status

### Day 1 Exit Condition
A logged-in internal user can create/find a customer, create a ticket, assign it, and update it.

---

## Day 2: Support Experience

### Ticket Detail
- conversation
- public replies
- internal notes
- history
- attachments if feasible

### Agent Dashboard
- assigned tickets
- status/priority summaries
- recent tickets

### Customer Portal
- login/session
- my tickets
- create ticket
- ticket details
- reply

### SLA
- deadlines
- SLA state
- breach indicator

### Knowledge Base
- article CRUD
- list/search
- customer read view

### Notifications
- basic in-app notifications if time allows

### Day 2 Exit Condition
The customer-agent support loop works end to end.

---

## Day 3: Reporting, AI, Polish, Delivery

### Dashboard and Reports
- KPI cards
- tickets by status
- tickets by priority
- SLA summary
- agent performance basics

### AI
In order:
1. ticket summary
2. suggested reply
3. automatic categorization
4. suggested knowledge article

### Internationalization
- English/Arabic structure
- language switcher
- RTL support

### Responsive Polish
- dashboard
- tickets
- ticket detail
- portal

### Testing
- critical unit tests
- critical backend authorization tests where practical

### Delivery
- seed data
- demo accounts
- README
- API docs if feasible
- final production build check
- deployment

## Rule

When time is short:
P0 completion wins over starting another P2/P3 feature.

---

# Post-P0 Completion Roadmap

The original Customer Support CRM requirement list is the feature-completeness baseline (ADR-038). The earlier time-boxed priorities remain useful history, but Email, SMS, production Live Chat, a customer-facing AI chatbot, system-wide Audit Logs, multi-department, multi-branch, ERP, generic external systems, and Custom Branding are no longer treated as out-of-scope placeholders. Each is required future work on its own branch, with a fresh documentation/repository audit immediately before implementation.

Completed and current work retains its historical evidence in `docs/19-progress-tracking.md`. The remaining execution order is:

| Order | Work item | Current status | Dependency / note |
| ----: | --------- | -------------- | ----------------- |
| 1 | Finish current Ticket Details work | IN PROGRESS | complete review and outstanding visual verification |
| 2 | Finish / merge `feature/ai-assistant` | PARTIAL / FOUNDATION EXISTS | internal staff assistant only; distinct from the customer chatbot |
| 3 | `feature/audit-logs` | PLANNED | platform completeness |
| 4 | `feature/departments` | FOUNDATION EXISTS | schema fields exist; end-to-end behavior is PLANNED |
| 5 | `feature/branches` | FOUNDATION EXISTS | schema fields exist; end-to-end behavior is PLANNED |
| 6 | `feature/email-channel` | FOUNDATION EXISTS | `EMAIL` enum only; provider implementation is PLANNED |
| 7 | `feature/sms-channel` | FOUNDATION EXISTS | `SMS` enum only; provider implementation is PLANNED |
| 8 | `feature/live-chat` | FOUNDATION EXISTS | `LIVE_CHAT` enum only; transport/workflow is PLANNED |
| 9 | `feature/ai-chatbot` | PLANNED | customer-facing and isolated from the internal AI Assistant |
| 10 | `feature/external-integrations` | PLANNED | must precede ERP |
| 11 | `feature/erp-integration` | PLANNED | depends on `feature/external-integrations` |
| 12 | `feature/custom-branding` | PLANNED | bounded persisted branding |
| 13 | `feature/final-seed-demo` | PLANNED | after product features |
| 14 | `feature/final-integrated-qa` | PLANNED | acceptance against the original requirements |
| 15 | Final deployment verification | PLANNED | only after integrated QA |

## Phase — Platform Completeness

### `feature/audit-logs`

- **Goal:** implement a system-wide ADMIN audit log, separate from per-ticket history.
- **Backend:** record important user create/update/disable and role actions, permission-sensitive actions, ticket assignment/escalation, customer/settings/SLA/department/branch/integration changes; store actor, action, entity type/id, timestamp, safe before/after summary, and optional appropriate request context such as IP/user-agent.
- **Frontend:** ADMIN audit workspace with pagination, search, and actor/action/entity/date-range filters.
- **RBAC/security:** ADMIN-only by default; never record passwords, API keys, access tokens, secrets, or full sensitive payloads.
- **Tests:** event coverage, safe redaction, pagination/filtering, and non-ADMIN denial.
- **Dependencies:** existing auth and administrative mutation surfaces. **Non-goal:** replacing `TicketHistory`.

### `feature/departments`

- **Goal:** complete end-to-end multi-department support, not merely a database field.
- **Backend:** Department CRUD, user/agent and ticket association, department-aware visibility, assignment, dashboard/report queries, and migration/backfill decisions.
- **Frontend:** admin management, user/ticket assignment controls, filters, dashboards, and reports.
- **RBAC/security:** define administrative management and operational visibility rules; enforce cross-department isolation server-side.
- **Tests:** CRUD, assignment, filters/metrics, RBAC, cross-department isolation, and optional/unassigned cases.
- **Dependencies:** audit logging for administrative changes; existing Department schema is only a foundation. **Non-goal:** treating the existing FK as feature completion.

### `feature/branches`

- **Goal:** complete multi-branch support as an optional organizational workflow.
- **Backend:** Branch CRUD; relevant user/customer/ticket associations; branch-aware filtering, dashboards, reports, and configuration; define behavior when branches are unused.
- **Frontend:** admin branch management and branch-aware customer/ticket/report/dashboard controls.
- **RBAC/security:** server-enforced branch permissions and isolation.
- **Tests:** CRUD, association/filter/metrics behavior, RBAC/isolation, and organizations with no branches.
- **Dependencies:** audit logging; coordinate semantics with departments. Existing Branch schema is only a foundation.

## Phase — Communication Channels

### `feature/email-channel`

- **Goal:** implement email as a real inbound and outbound ticket channel.
- **Backend:** provider abstraction; verified inbound webhook/request handling; customer lookup by email; ticket creation/thread correlation; deduplication; attachments; normalized sanitized HTML/plain text; outbound reply delivery and error state.
- **Frontend:** channel/delivery state in the existing ticket conversation and appropriate administration/configuration surfaces.
- **RBAC/security:** keep provider secrets server-side, verify inbound requests, sanitize HTML, preserve customer isolation.
- **Tests:** thread correlation, idempotency, attachments/content normalization, outbound success/failure, webhook verification, RBAC, and sanitization.
- **Dependencies:** attachment and ticket foundations; integration configuration/audit conventions. **Non-goal:** coupling core CRM models to one email vendor.

### `feature/sms-channel`

- **Goal:** implement production SMS support.
- **Backend:** replaceable provider adapter, verified inbound webhook, phone normalization, customer identify/create, append to an active ticket or create one, outbound agent replies, provider message IDs, idempotency, delivery status where available, and length awareness.
- **Frontend:** SMS conversation/delivery state and bounded provider administration.
- **RBAC/security:** server-side credentials, webhook verification, customer isolation, and authorized outbound sends.
- **Tests:** normalization/matching, ticket selection, idempotency, statuses/errors, length behavior, RBAC, and request verification.
- **Dependencies:** ticket/customer foundations and integration configuration. **Non-goal:** vendor-specific domain fields without justification.

### `feature/live-chat`

- **Goal:** production-ready live customer chat attached to persisted tickets.
- **Backend:** persisted chat sessions/messages, ticket create/attach behavior, reconnect semantics, and customer isolation. Audit hosting/runtime constraints before selecting WebSocket, Server-Sent Events, or a polling fallback.
- **Frontend:** responsive customer chat and real-time agent conversation; optional typing/presence only when the selected architecture supports them cleanly.
- **RBAC/security:** never expose internal notes; authenticate sessions and enforce ticket/customer boundaries.
- **Tests:** session/ticket lifecycle, reconnect, ordering/persistence, isolation, internal-note exclusion, responsive/browser behavior.
- **Dependencies:** deployed-runtime audit and ticket conversation foundation. **Non-goal:** locking the roadmap to a transport before that audit.

## Phase — AI Expansion

### `feature/ai-chatbot`

- **Goal:** implement a customer-facing English/Arabic AI chatbot; this is not the internal AI Assistant.
- **Backend:** a separate customer-safe context builder grounded in published Knowledge Base content; answer/FAQ/article/solution suggestions; inability/confidence fallback; ticket creation or human handoff; optional handoff summary; rate limiting and abuse protection.
- **Frontend:** responsive customer chat UI with clear AI disclosure and handoff flow.
- **RBAC/security:** prompt-injection/data-boundary review. Never expose internal notes, assignees, internal SLA details, watchers/followers, internal metadata/activity, admin settings, private AI context, or another customer's data.
- **Tests:** grounding/fallback, EN/AR, handoff, rate limits/abuse, prompt injection, customer isolation, and explicit forbidden-field leakage regressions.
- **Dependencies:** Knowledge Base, customer authentication, ticket handoff, and AI provider foundation. **Non-goal:** reusing the internal assistant context boundary.

## Phase — External Integrations

### `feature/external-integrations`

- **Goal:** create the generic server-side foundation for ERP, billing, shipping, external support, and enterprise/custom systems.
- **Backend:** provider/adapter registry, secure configuration/secrets, inbound webhook and outbound API-client foundations, retry/backoff, idempotency, health/status, audit events, standardized errors, and provider abstraction.
- **Frontend:** ADMIN configuration and integration health/status surfaces.
- **RBAC/security:** ADMIN-only configuration, secret redaction, verified inbound requests, safe logs/audits, and no client-side credentials.
- **Tests:** registry/config authorization, encryption/redaction boundary, webhook verification/idempotency, retry/error normalization, and health state.
- **Dependencies:** audit logs and settings conventions. **Non-goal:** vendor-specific fields in core CRM models without strong justification.

### `feature/erp-integration`

- **Goal:** implement an ERP provider through `feature/external-integrations`, read-only first.
- **Backend:** an `ErpProvider` boundary for customer lookup/sync, external-ID mapping, and optional account/order context (`getCustomer`, `getOrders`, `getAccountSummary`); retries/errors, secure credentials, audit events.
- **Frontend:** customer/account/order context where approved plus ADMIN integration status.
- **RBAC/security:** least-privilege read access, server-only credentials, safe projections and audit summaries.
- **Tests:** adapter contract, mappings, stale/unavailable ERP behavior, retries, RBAC, and secret/data leakage.
- **Dependencies:** `feature/external-integrations` must be complete first. **Non-goal:** binding the CRM domain layer to one ERP vendor or enabling writes in the first pass.

```text
feature/external-integrations
        ↓
feature/erp-integration
```

## Phase — Final Platform Completion

### `feature/custom-branding`

- **Goal:** complete bounded custom branding with safe defaults.
- **Backend:** persisted organization/app logo, primary/accent branding, login/Portal branding, and favicon where supported; validate assets and values.
- **Frontend:** ADMIN branding settings plus CRM login and Customer Portal application, with light/dark compatibility.
- **RBAC/security:** ADMIN-only mutation; no arbitrary CSS or HTML injection.
- **Tests:** validation/RBAC, defaults, persistence, theme/RTL/responsive rendering, and unsafe-input rejection.
- **Dependencies:** settings/persistence and file-storage decisions. **Non-goal:** arbitrary theme code execution.

### `feature/final-seed-demo`

- **Goal:** create realistic, repeatable data that makes every major workflow easy to evaluate.
- **Backend/data:** ADMIN, MANAGER, multiple AGENT users, customers, departments, branches, varied ticket states/priorities/channels/SLA states, tasks/reminders, Quick Replies, Knowledge Base, notifications, audit logs, feedback, reports/dashboard data, WhatsApp/Email/SMS examples, and AI-ready tickets.
- **Frontend:** no new product UI; verify seeded records are coherent across existing screens.
- **RBAC/security:** development/demo-only credentials and synthetic non-sensitive data; never seed production secrets.
- **Tests:** idempotent seed execution, referential integrity, role logins, and representative workflow smoke checks.
- **Dependencies:** all product features above. **Non-goal:** using small feature-specific fixtures as the final dataset.

### `feature/final-integrated-qa`

- **Goal:** perform the final acceptance pass against the original CRM requirements.
- **Acceptance matrix:** Customer profiles/contact/history/notes/attachments; ticket create/track/category/priority/assignment/status/escalation/history; Web/WhatsApp/Email/SMS/Live Chat; assigned work/customer context/tasks/Quick Replies/collaboration; SLA response/resolution/assignment/escalation/notifications; Knowledge Base FAQs/articles/guides/search; AI summary/reply/category/solutions/customer chatbot; Portal submit/track/history/KB/feedback; ticket/SLA/agent/satisfaction reports and dashboards; users/roles/permissions/audit/configuration; EN/AR/RTL/responsive/mobile/departments/branches/branding; APIs, ERP and external integration foundations.
- **Security/quality:** RBAC regression, customer isolation, HTML sanitization, webhook verification, rate limits, no secret leakage, accessibility sanity, and browser QA.
- **Backend/frontend work:** test and defect-fix only, with any material fixes isolated and documented; produce an evidence-backed acceptance matrix.
- **Dependencies:** every feature above and the final demo seed. **Non-goal:** marking missing or unverified behavior complete.

### Final deployment verification

- **Goal:** verify the complete system in its intended deployed environment; the project is not complete before this passes.
- **Checks:** client/server deployment, migrations, environment variables, CORS, JWT/auth, Vercel/runtime compatibility if still used, cron jobs, SLA monitor, task reminders, file/blob storage, WhatsApp webhooks, Email inbound/outbound, SMS webhooks, AI provider, external integrations, logging/error handling, and production security settings.
- **Security/tests:** production configuration and secret-leak checks plus deployed smoke/acceptance flows.
- **Dependencies:** `feature/final-integrated-qa`. **Non-goal:** inferring deployment readiness from local builds alone.

Small temporary fixtures remain allowed when a feature needs them, but they are not `feature/final-seed-demo`. No newly listed phase is complete merely because a schema enum, model, UI label, adapter fragment, or test fixture exists.
