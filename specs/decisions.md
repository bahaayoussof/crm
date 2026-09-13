# Architecture Decision Log

Canonical, curated ADR log for the Customer Support CRM. This **replaces**
`docs/17-decisions-log.md` (removed during the docs → specs consolidation,
2026-09-13) as the single place new architectural decisions are recorded.

This is a curated index, not a verbatim transcript: each entry states the
decision, why it was chosen, and its consequences in a few sentences, then
points at the `specs/features/<name>/spec.md` or `specs/architecture.md` /
`specs/domain-model.md` section that is the current authoritative behavior
description. Full historical prose (alternatives considered, session-level
detail) lived in `docs/17-decisions-log.md`; it is preserved in Git history
at the commit that removed the file, not duplicated here.

**Renumbering note carried over from `docs/17`:** three identifier
collisions were fixed there before this file was created — `ADR-052`
(Customer AI boundary) → **ADR-054**; `ADR-051` (SMS channel) → **ADR-056**;
`ADR-039` (Portal Ticket Details redesign) → **ADR-055**. The numbers below
reflect the corrected, de-duplicated sequence. Do not reuse a number listed
here for a new decision.

**Adding a new decision:** append an entry at the top of "Decisions" with
the next unused ADR number, a one-paragraph decision + reason, and a pointer
to the spec file that now owns the resulting behavior. Update
`docs/17-decisions-log.md`'s successor obligation is satisfied by this file
alone — do not recreate `docs/17-decisions-log.md`.

## Status legend

- **Active** — still the current architecture/behavior, unmodified.
- **Superseded by ADR-NNN** — a later decision changed or replaced this one; kept for history, not current authority.
- **Implemented, evolved** — the core decision stands but later passes (usually an SDD brownfield audit) refined details; see the owning spec for the current shape.

---

## Decisions

### ADR-001 — Express instead of NestJS
**Status:** Active. One developer, time-boxed delivery; Express + TypeScript keeps a clean route/controller/service layering without framework overhead. See `specs/architecture.md` Backend Architecture.

### ADR-002 — External channels are architecture-ready, WEB is primary
**Status:** Superseded by ADR-019 / ADR-030 / ADR-056 / ADR-044 / ADR-057 (Email, WhatsApp, SMS are now real, implemented providers, not demo-only enum values). Historical starting point only.

### ADR-003 — Customer identity, conversation, and notes
**Status:** Active. `User` is the single authenticated identity for every role; `Customer` is the CRM profile with an optional unique link to `User`. Every `TicketMessage` has one required `authorUserId`; `TicketNote`/`CustomerNote` are separate internal-only models. See `specs/domain-model.md` Core Entities.

### ADR-004 — Escalation and SLA persistence
**Status:** Active. `ESCALATED` is a real `TicketStatus` value (not a separate flag); SLA targets are one `SlaRule` row per priority, and each ticket snapshots `firstResponseDueAt`/`resolutionDueAt` at creation. See `specs/domain-model.md` SLA and `specs/features/sla-automation/spec.md`.

### ADR-005 — Attachment context validation
**Status:** Active (validation approach), storage superseded by ADR-021. Prisma cannot enforce "exactly one of ticket/message/customer context" — this is service-layer validation. See `specs/features/tickets/spec.md`.

### ADR-006 — Assessment access-token session
**Status:** Active. Stateless 8-hour bearer JWT, no refresh tokens, no server session store; browser stores the token in `localStorage` and clears it on logout or a `401`. See `specs/features/auth-rbac/spec.md`.

### ADR-007 — Persisted frontend language and document direction
**Status:** Active. i18next, `en`/`ar`, persisted under `crm-language` in `localStorage`; document `lang`/`dir` synced at the root on startup and on every language change. See `specs/constitution.md` Localization.

### ADR-008 — TanStack Table for frontend table models
**Status:** Active. TanStack Table v8 for implemented data tables; TanStack Query remains the server-data owner; URL params own shareable search/pagination state; server-backed tables use manual pagination/sorting matching real API support.

### ADR-009 — Internal ticket access and workflow enforcement
**Status:** Implemented, evolved. Original ADMIN/MANAGER-all, AGENT-assigned-or-unassigned model; later superseded in scope by ADR-048 (agent list scoping + self-claim) and ADR-050 (team scoping). Current authoritative behavior: `specs/features/tickets/spec.md`.

### ADR-010 — Internal ticket conversation read shape
**Status:** Active. `GET /tickets/:id` returns a discriminated `conversation` array (`PUBLIC_MESSAGE` | `INTERNAL_NOTE`); Portal responses must never select `TicketNote`. See `specs/features/tickets/spec.md`.

### ADR-011 — Operational dashboard and fixed SLA warning window
**Status:** Active. `GET /dashboard/overview` reuses ticket-visibility predicates; SLA `AT_RISK` window is a fixed 60 minutes, computed at request time (no persisted status). See `specs/features/dashboard-reporting/spec.md`.

### ADR-012 — Development loopback CORS
**Status:** Active. Non-production origins on `localhost`/`127.0.0.1`/`[::1]` (any port) are allowed; production is restricted to the configured `CLIENT_URLS`/`CLIENT_URL` allowlist. See `specs/architecture.md` Deployment.

### ADR-013 — AGENT Customer Management is read-only
**Status:** Active. `ADMIN`/`MANAGER` full customer CRUD + notes; `AGENT` list/search/detail/notes-read only; `CUSTOMER` rejected. See `specs/features/customers/spec.md`.

### ADR-014 — Customer history uses safe summaries without broadening ticket access
**Status:** Implemented, evolved (team-scoped for MANAGER since ADR-050/OD-6). `GET /customers/:id/tickets` returns `FULL`/`SUMMARY_ONLY` per row and never grants ticket detail/conversation access. See `specs/features/customers/spec.md` and `specs/features/tickets/spec.md`.

### ADR-015 — Agent ticket ownership and definition boundary
**Status:** Active. Agent-created tickets are transactionally self-assigned; post-creation agent updates are a `status`/`priority` allowlist requiring assignment. See `specs/features/tickets/spec.md`.

### ADR-016 — Role-aware dashboard primary queues
**Status:** Active. `ADMIN`/`MANAGER` get `NEEDS_ATTENTION`; `AGENT` gets `MY_ASSIGNED_TICKETS`; Recent Tickets excludes primary-queue IDs. See `specs/features/dashboard-reporting/spec.md`.

### ADR-017 — Shared request-time SLA derivation
**Status:** Active. One pure helper (`shared/sla/derive-sla.ts`) computes SLA state/effective deadline from persisted timestamps at request time; reused by Dashboard, Ticket Details, Reports. See `specs/domain-model.md` SLA.

### ADR-018 — Isolated Customer Portal boundary
**Status:** Active. Dedicated Portal routes/schemas/Prisma selects; ownership via `Customer.userId`; `ESCALATED` hidden from Portal status mapping; notes/history/attachments/SLA/assignment never selected. See `specs/features/auth-rbac/spec.md` Portal privacy boundary.

### ADR-019 — Final demo targets broader original-task coverage
**Status:** Superseded by ADR-038 (restated as the final completeness baseline). Historical: recorded the decision to pursue full original-assignment coverage instead of freezing at the three-day P0 scope, in a fixed per-branch order.

### ADR-020 — Knowledge Base on the existing `KnowledgeArticle` model
**Status:** Superseded (body representation) by ADR-057 (KB Rich Text). Model reuse, RBAC, and Portal-published-only boundary remain active. See `specs/features/knowledge-base/spec.md`.

### ADR-021 — Secure attachments on the existing `Attachment` model with private Vercel Blob
**Status:** Active. Private Vercel Blob store behind an `AttachmentStorage` interface; 4 MiB limit; MIME allowlist validated by file signature, not client-supplied type; server-generated `storageKey`; no deletion; no malware scanner. See `specs/features/tickets/spec.md` (ticket/message attachments) and `specs/architecture.md`.

### ADR-022 — Quick Replies on the existing `QuickReply` model with a dedicated manager workspace
**Status:** Active. `ADMIN`/`MANAGER` manage, `ADMIN`/`MANAGER`/`AGENT` list/use; searchable combobox insertion into the reply composer at the cursor; no Portal route. See `specs/features/quick-replies/spec.md`.

### ADR-023 — Customer Feedback on the existing `Feedback` model as a one-shot Portal rating
**Status:** Active. `RESOLVED`/`CLOSED`-only eligibility, one immutable rating (1-5) + optional comment per ticket, Portal-only endpoints. See `specs/features/tickets/spec.md` and `specs/features/dashboard-reporting/spec.md` (satisfaction metric).

### ADR-024 — Reports on existing rows: ADMIN/MANAGER read-only aggregates over a UTC date range
**Status:** Implemented, evolved (team-scoped for MANAGER since ADR-050; redesigned into sub-routes by ADR-047). No schema change; every figure derives from `Ticket`/`Feedback`/`Category`/`User` at request time; fixed UTC bucketing, default trailing 30 days. See `specs/features/dashboard-reporting/spec.md`.

### ADR-025 — Users administration: ADMIN-only CRUD + role change, `User.isActive` for retirement
**Status:** Active (amended in-place, no new ADR, for role-mutation consolidation into `PATCH /users/:id`, self-management guards, and last-active-ADMIN protection). See `specs/features/auth-rbac/spec.md`.

### ADR-026 — Functional Settings scope and contracts
**Status:** Active. ADMIN-only workspace for `Category` and `SlaRule`; activation instead of deletion; SLA changes are prospective only. See `specs/features/sla-settings-categories/spec.md`.

### ADR-027 — Tasks & Reminders: new `Task` model, internal-only, reminder sweep reuses `CRON_SECRET`
**Status:** Active. `TaskStatus(OPEN|DONE)`; AGENT sees only created-or-assigned tasks and may self-assign only; `GET /api/internal/task-reminders` cron reuses the SLA-monitor secret. See `specs/features/tasks-reminders/spec.md`.

### ADR-028 — CRM visual identity & global light/dark theme color system
**Status:** Active. Monochrome base + semantic accent tokens; zero-flash theme script; `ThemeProvider` with `light`/`dark`/`system`. Presentation-only; no behavioral spec owns this beyond the design tokens described in `specs/constitution.md`.

### ADR-029 — Bounded internal in-app notifications
**Status:** Active. Existing `Notification` model, optional `ticketId`; internal roles only (no Portal notification center); no websocket/external delivery; 30s unread-count poll as a fallback to realtime. See `specs/features/notifications/spec.md`.

### ADR-030 — Five-minute idempotent SLA monitor through Vercel Cron
**Status:** Implemented, evolved. Assignment delegation superseded by ADR-051 (team-scoped canonical engine); escalation behavior unchanged. See `specs/features/sla-automation/spec.md`.

### ADR-031 — Dashboard opened/resolved activity series as an additive field
**Status:** Active. `ticketActivity`: 30 zero-filled `{date, opened, resolved}` UTC-day buckets on the existing `GET /dashboard/overview`, scoped by the same `ticketVisibilityWhere`. See `specs/features/dashboard-reporting/spec.md`.

### ADR-032 — Team Collaboration: internal-note @mentions + ticket watchers (MVP)
**Status:** Active. Explicit-id mention tokens (`@[Name](userId)`); `TicketWatcher`/`TicketMention` models; mention/watch notifications written inside the triggering mutation's transaction. Internal-only, never reaches the Portal. See `specs/features/tickets/spec.md`.

### ADR-033 — Customer Portal "My Requests": minimal priority/category filter support
**Status:** Active. `priority`/`categoryId` added to the existing Portal ticket-list query, ANDed with the server-derived `customerId`; a dedicated list projection adds `priority` without leaking it into ticket detail. See `specs/features/tickets/spec.md`.

### ADR-034 — AI Assistant: internal agent-assistance layer behind an isolated provider seam
**Status:** Active. `AiService → AiProvider interface → OpenRouterProvider`; four actions (`SUMMARY`/`SUGGEST_REPLY`/`CLASSIFY`/`KB_SUGGESTIONS`), Zod-validated structured output, prompt-injection containment via delimited data blocks, human-approval-required for every "use this" action. See `specs/features/ai-assistance/spec.md`.

### ADR-035 — Ticket Details conversation-first redesign + Lexical rich reply composer
**Status:** Superseded (presentation detail) by ADR-036/037/055; the Lexical + `sanitize-html` infrastructure decision is active and is what ADR-057 (KB Rich Text) later reused. `TicketMessage.body` moved from plain text to server-sanitized HTML at this point. See `specs/architecture.md` Rich text.

### ADR-036 — Ticket Details structure follows the approved reference screenshot
**Status:** Superseded (further refined) by ADR-037/055. Presentation-only; fixed the two-column layout, header actions, context strip, and the four-tab lower workspace (`Reply | Attachments | Activity | Description`).

### ADR-037 — Ticket Details Pass 4b: shared rich composer everywhere + Customer Portal parity
**Status:** Active. Internal Note uses the same Lexical editor as Reply (with `@mention` support via `extraNodes`/`extraPlugins`, kept out of the Portal bundle); Customer Portal adopts the same composer/attach-file/viewer-relative-alignment pattern. See `specs/architecture.md` Rich text.

### ADR-038 — Original CRM requirements are the final completeness baseline
**Status:** Active. The full original assignment scope (not just the three-day P0 loop) is the completion target; provider-backed integrations and the full AI chatbot were promoted from demo-only to required work. See `specs/README.md` and `specs/constitution.md` Scope & Priorities.

### ADR-039 — System-wide audit logging
**Status:** Active. `AuditLog` is a separate, general-purpose cross-entity trail (actor, action, entity, metadata diffs, IP/UA) distinct from the per-ticket `TicketHistory`; `GET /api/audit-logs` is ADMIN-only. See `specs/domain-model.md` Core Entities and `specs/features/tickets/spec.md` (ticket-specific audit actions).

### ADR-040 — Shared reusable file upload modal for CRM and Customer Portal
**Status:** Active. One portalled `FileUploadModal` (drag-and-drop, file-type/size guidance, selected-file preview) used by both the internal Ticket Details attach flow and Portal attachments, instead of duplicated per-surface upload UI.

### ADR-041 — CRM-styled anchored link popover for the Lexical rich text editor
**Status:** Active. `TicketReplyLinkPopover` (URL + text + "open in new tab", safe-protocol validation, existing-link edit/unlink) reused by the Knowledge Base article editor's link tool (ADR-057) rather than re-implemented.

### ADR-042 — Account Management: password reset and shared self-profile for all roles
**Status:** Active. `POST /auth/forgot-password` / `reset-password` (single-use SHA-256-hashed token, 30-minute expiry, no account-enumeration); `PATCH /auth/change-password`; shared `GET`/`PATCH /auth/profile` for every role via `requireFreshToken`. See `specs/features/auth-rbac/spec.md`.

### ADR-043 — Departments & Branches end-to-end
**Status:** Active. ADMIN-only CRUD on `Department`/`Branch` (`isActive` retirement, safe-delete `409 *_IN_USE` guards); active-only lookup open to every internal role; a user's department must belong to its branch when both are set. See `specs/domain-model.md` Core Entities.

### ADR-044 — EMAIL is a Resend transport over Ticket conversation
**Status:** Implemented, evolved. Outbound-rollback-on-provider-failure superseded by ADR-052 (commit-first, `delivery.status=FAILED` instead); threading/matching precedence superseded by ADR-057 (no more identity-only "one active EMAIL ticket" fallback). See `specs/features/conversations-channels/spec.md`.

### ADR-045 — Realtime CRM events: REST for writes + SSE for server→client invalidation signals
**Status:** Active. Server-Sent Events, not WebSocket/socket.io; tiny invalidation-only payloads (`{type, ticketId, ...ids}`, never full records); `withRealtimeOutbox` publishes only after the producing transaction commits. See `specs/features/realtime/spec.md`.

### ADR-046 — Ticket Workflow Simplification: removal of `NEW` status, `OPEN` canonical default
**Status:** Active. `TicketStatus` has six values with no `NEW`; every creation path defaults to `OPEN`. See `specs/domain-model.md` Ticket Lifecycle. (Any remaining "NEW" wording elsewhere is presentation-only drift — see Verification Findings in this consolidation's report.)

### ADR-047 — Reports information architecture redesign & sub-route analytics
**Status:** Active. `/reports` (Overview), `/reports/sla`, `/reports/agents`, `/reports/tickets` as focused sub-routes sharing `from`/`to`/`departmentId`/`branchId` via URL params; `GET /api/reports/agents` gained server-side search/sort/pagination. See `specs/features/dashboard-reporting/spec.md`.

### ADR-048 — Strict AGENT ticket visibility + agent personal work-console dashboard
**Status:** Implemented, evolved (team-narrowed further by ADR-050). Introduced `ticketListVisibilityWhere` (`mine`/`unassigned` scopes, no "all"), atomic self-claim, and an AGENT-only `agentPerformance` dashboard block. See `specs/features/tickets/spec.md` and `specs/features/dashboard-reporting/spec.md`.

### ADR-049 — Manager Work Console: dedicated operations experience
**Status:** Superseded (scope) by ADR-050 — this ADR's "MANAGER scope stays organization-wide" statement no longer holds; the Console's read-only aggregation endpoints and page structure remain active, now team-scoped. See `specs/features/dashboard-reporting/spec.md`.

### ADR-050 — Team-Based Manager Scope: real `Team` model, MANAGER authorization scoped to their own team
**Status:** Active — the current authoritative team-scoping model, superseding the "organization-wide MANAGER" statements in ADR-049 (and the earlier department/branch-only scoping implied by ADR-009/013/014/048). `shared/team/team-scope.ts` is the single source of team-scope predicates, reused everywhere (tickets, dashboard, reports, manager console, realtime audience, notifications). See `specs/domain-model.md` Ownership / Assignment Rules and `specs/features/auth-rbac/spec.md`.

### ADR-051 — Team-Scoped Automatic Ticket Assignment (synchronous, V1)
**Status:** Active. One canonical `autoAssignTicket` engine reused by both ticket creation and the SLA-monitor cron; picks the active `AGENT` on the ticket's team with the fewest active assigned tickets, tie-broken by id; a `teamId = null` ticket is left for ADMIN routing on every automatic path. See `specs/domain-model.md` Ownership / Assignment Rules.

### ADR-052 — Outbound Reply Resilience: local persistence decoupled from EMAIL/SMS provider delivery
**Status:** Active. `TicketMessage` (+ `firstRespondedAt`, watcher fan-out, realtime event) commits first; provider delivery is attempted after commit; a provider/configuration failure returns `201` + `delivery.status="FAILED"` + a `<CHANNEL>_DELIVERY_FAILED` history row instead of rolling back the reply. Brought EMAIL/SMS in line with WhatsApp's pre-existing commit-first behavior. See `specs/features/conversations-channels/spec.md`.

### ADR-053 — Brand asset replacement: static logo/favicon swap
**Status:** Active, narrow. Fixed static files under `client/public/brand/` (`BrandLogo` component); explicitly **not** `feature/custom-branding` (no admin-configurable/persisted branding exists).

### ADR-054 — Customer AI is a separate context boundary
**Status:** Active. `server/src/modules/customer-ai/` owns strict input, published-KB-only retrieval, customer prompt construction, and its own rate limiting; never reuses internal ticket context/prompts/actions/UI. Handoff delegates to the canonical Portal ticket-creation service. See `specs/features/ai-assistance/spec.md`.

### ADR-055 — Customer Portal Ticket Details: 2-column workspace redesign & workspace tabs
**Status:** Active, presentation-only. Description/metadata moved to the right rail; unified `Reply`/`Attachments` lower-workspace tabs; viewer-relative message alignment.

### ADR-056 — Provider-abstracted TextBee Cloud SMS channel
**Status:** Active. `SmsProvider` contract isolates TextBee HTTP details; outbound delivery inside the ticket transaction originally, later durable-delivery (ADR-057); inbound HMAC-SHA256 `X-Signature` verification; text-only, no attachments. See `specs/features/conversations-channels/spec.md`.

### ADR-057 — Conversations/Channels hardening: durable delivery, correlation precedence, audit consistency, content provenance, attachment staging
**Status:** Active — the current authoritative behavior for every provider channel and for Knowledge Base rich text (two related but independently-scoped decisions recorded under one number in `docs/17`; kept together here for traceability). Key changes: (1) removed every "customer's newest active ticket" identity-only correlation fallback across Email/WhatsApp/SMS — inbound messages without a reliable signal (RFC reference, reply token, thread match) always create a new ticket; (2) outbound delivery state moved to a durable `MessageDelivery` row with a bounded retry sweep and, where the provider supports it (Resend, Meta), a signed delivery-status callback; (3) conversation attachments are staged then atomically bound to the exact message/note; (4) every conversation item declares `contentFormat` explicitly instead of the client sniffing the body; (5) Knowledge Base article bodies became bounded Lexical rich text on the same `sanitize-html` + DOMPurify infrastructure as ticket replies, stored as sanitized HTML in the existing `content` column plus an additive `contentText` plain-text projection for search/AI grounding (supersedes ADR-020's plain-text-only consequence). See `specs/features/conversations-channels/spec.md` and `specs/features/knowledge-base/spec.md`.

---

## Template for new entries

```markdown
### ADR-NNN — Short decision title
**Status:** Active | Superseded by ADR-MMM | Implemented, evolved.
One paragraph: what was decided, why, and what it replaces (if anything).
See `specs/features/<owning-feature>/spec.md` (or `architecture.md` /
`domain-model.md`) for the current authoritative behavior.
```

Do not record trivial implementation details here — this log is for
decisions that changed architecture, data model, security boundaries, or
product behavior in a way another engineer/agent would need to know before
touching the same area again. Routine bug fixes belong in the owning
feature's `tasks.md`, not here.
