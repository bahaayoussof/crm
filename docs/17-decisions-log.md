# Architecture Decisions Log

Use this file for decisions not already fixed by the project documentation.

Do not record trivial implementation details.

## Template

### ADR-XXX: Decision Title

**Date:** YYYY-MM-DD

**Context**

What required a decision?

**Decision**

What was chosen?

**Reason**

Why was it chosen for this assessment?

**Alternatives Considered**

What reasonable options were not chosen?

**Consequences**

What trade-offs or follow-up work result from the decision?

---

## ADR-001: Use Express Instead of NestJS

**Context**

The project is implemented by one developer in approximately three days.

**Decision**

Use Express + TypeScript for the backend.

**Reason**

It minimizes framework overhead while preserving a clean route/controller/service architecture.

**Alternatives Considered**

NestJS.

**Consequences**

Some conventions normally enforced by NestJS must be maintained through repository rules and documentation.

---

## ADR-002: External Channels Are Architecture-Ready

**Context**

The requirements mention email, WhatsApp, live chat, SMS, and web forms.

**Decision**

WEB is the primary fully functional support channel for the assessment. Other channel types may exist in the data model and interface without claiming production provider integration.

**Reason**

Production integrations require external providers, credentials, webhooks, operational infrastructure, and more time than the assessment window allows.

**Consequences**

Future provider adapters can be added without changing the ticket domain model.

---

## ADR-003: Customer Identity, Conversation, and Notes

**Date:** 2026-08-24

**Context**

The CRM needs both customer profiles and customer portal authentication. Ticket messages may be written by internal users or customers, while nullable user/customer author columns would permit ambiguous or authorless messages.

**Decision**

`User` is the single authenticated identity for every role. `Customer` remains the CRM profile and has an optional unique link to `User`. Every ticket message has one required `authorUserId`; a customer message is authored by a `User` with the `CUSTOMER` role whose linked customer owns the ticket. `TicketMessage` stores only public conversation, while `TicketNote` and `CustomerNote` separately store internal notes for a ticket and customer profile.

**Reason**

This makes portal ownership and message authorship straightforward without polymorphic author fields. Customer records can still exist before portal access is provisioned.

**Alternatives Considered**

Separate customer credentials; two nullable author foreign keys; a polymorphic author identifier.

**Consequences**

Later authentication/customer services must enforce that portal users have a linked customer profile and that customer message authors own the ticket. Contact email remains on `Customer`, while login email remains on `User`. Customer-facing queries must never include either internal note model.

---

## ADR-004: Escalation and SLA Persistence

**Date:** 2026-08-24

**Context**

The workflow permits either an escalation status or a separate escalation flag, and SLA targets need configuration without implementing an SLA engine in the schema feature.

**Decision**

Use the documented `ESCALATED` ticket status. Store one configurable `SlaRule` per priority, while each ticket stores nullable `firstResponseDueAt` and `resolutionDueAt` deadline snapshots. `firstRespondedAt` stores the actual first public agent-response timestamp.

**Reason**

This follows the existing workflow enum and keeps later SLA calculations simple and auditable without adding duplicate state.

**Alternatives Considered**

A separate escalation flag; one SLA row per ticket; versioned SLA policy tables.

**Consequences**

Later workflow logic must define allowed transitions into and out of `ESCALATED`. Later SLA services calculate and populate ticket deadlines from the active priority rule, set `firstRespondedAt` only once, and compare the actual response timestamp with its deadline.

---

## ADR-005: Attachment Context Validation

**Date:** 2026-08-24

**Context**

Attachment metadata may belong to a ticket, a public ticket message, or a customer profile. Prisma can represent these optional relations but cannot enforce cross-record ownership rules or require at least one of several optional foreign keys.

**Decision**

Keep `ticketId`, `messageId`, and `customerId` optional in the schema and enforce supported attachment context in the later attachment service.

**Reason**

This supports ticket-level, message-level, and customer-level attachments without binary database storage or polymorphic identifiers that discard foreign-key integrity.

**Alternatives Considered**

Separate attachment tables per context; a polymorphic context type/id pair; PostgreSQL-specific check constraints in a manual migration.

**Consequences**

The attachment service must require at least one context, verify that a message belongs to any supplied ticket, and verify customer ownership. The schema alone permits invalid context combinations until that validation is implemented.

---

## ADR-006: Assessment Access-Token Session

**Date:** 2026-08-24

**Context**

The assessment needs persistent browser authentication and logout without introducing refresh-token storage, server sessions, or external infrastructure.

**Decision**

Issue an eight-hour JWT access token containing the authenticated user ID and role. The browser stores the token in local storage, attaches it through the shared Axios client, and removes it on logout or an authenticated `401`. `/auth/me` remains the source of current user profile data.

**Reason**

This is the smallest maintainable access-token model for the time-boxed assessment and keeps authorization authoritative on the server.

**Alternatives Considered**

HTTP-only cookie sessions; refresh-token rotation with database persistence; in-memory-only tokens.

**Consequences**

There is no silent session renewal or server-side token revocation. Production hardening should reassess browser token storage and use secure HTTP-only cookies or a carefully designed refresh-token flow where appropriate.

---

## ADR-007: Persisted Frontend Language and Document Direction

**Date:** 2026-08-24

**Context**

The implemented English and Arabic interfaces need to retain the user's choice and apply bidirectional layout consistently across public and protected routes.

**Decision**

Use i18next with English as the default and fallback language. Persist only supported language codes (`en` or `ar`) in local storage under `crm-language`. Synchronize the root HTML `lang` and `dir` attributes during initial application startup and whenever the language changes.

**Reason**

This keeps language preference independent of authentication and makes document-level direction authoritative without duplicating RTL state across components.

**Alternatives Considered**

Account-backed preferences; browser-language auto-detection; per-page direction state.

**Consequences**

Invalid or unavailable stored values safely fall back to English. Email addresses, phone numbers, URLs, IDs, and similar values still require local direction isolation inside Arabic layouts.

---

## ADR-008: TanStack Table for Frontend Table Models

**Date:** 2026-08-24

**Context**

The customer list was the first implemented server-paginated CRM table and used manual column and row rendering. Later ticket, report, and administration features will also need typed, accessible table models without changing the existing server-state architecture.

**Decision**

Use TanStack Table v8 for implemented frontend data tables. Keep TanStack Query as the server-data owner and URL parameters as the owner of shareable search and pagination state. Server-backed tables use manual pagination, filtering, or sorting only when the corresponding API behavior exists. Prefer feature-local typed column definitions, and allow mobile card views to share the same query result.

**Reason**

This standardizes table modeling while preserving the project's headless styling, semantic markup, server-side pagination, localization, and responsive CRM layouts.

**Alternatives Considered**

Continue manual table rendering; introduce a full data-grid component library; build a universal project-wide data-table abstraction immediately.

**Consequences**

Implemented desktop tables use TanStack Table row and header models. Features still own their column rendering and styling, no client-side sort control is shown without backend support, and mobile layouts do not need to become horizontally scrolling desktop tables.

---

## ADR-009: Internal Ticket Access and Workflow Enforcement

**Date:** 2026-08-25

**Context**

Ticket Management required explicit agent visibility, mutation permissions, escalation behavior, SLA snapshot rules, and lookup API boundaries before implementation.

**Decision**

`ADMIN` and `MANAGER` manage all tickets. `AGENT` can view assigned and unassigned tickets but cannot view tickets assigned to another agent; agent priority and normal status mutations require assignment to that agent. Only `ADMIN` and `MANAGER` assign `AGENT` users or enter/leave `ESCALATED`. Manual transitions use the matrix in `07-ticket-workflow.md`, with escalation leaving through `ESCALATED -> IN_PROGRESS` and manual reopening deferred to conversation. Ticket creation and unresolved priority changes snapshot deadlines from active priority rules. Supporting selectors use focused `/categories` and `/users/agents` resources. Tickets are not deleted.

**Reason**

This supports a shared unassigned queue while protecting other agents' workloads, keeps authorization authoritative on the server, avoids hidden escalation state or schema changes, and separates resource lookups cleanly.

**Alternatives Considered**

All-agent ticket visibility; agent self-claiming; arbitrary enum transitions; a stored previous escalation status; one mixed ticket-options endpoint; destructive ticket CRUD.

**Consequences**

Agents cannot mutate unassigned tickets or claim work in this branch. Customer ticket access remains a later portal concern. Automatic escalation, timers, notifications, and reopening on customer reply remain later features.

---

## ADR-010: Internal Ticket Conversation Read Shape

**Date:** 2026-08-25

**Context**

The internal ticket workspace needs one chronological view of public messages and private ticket notes, while future customer portal responses must never expose internal notes.

**Decision**

Extend the existing internal-only `GET /tickets/:id` response with a discriminated `conversation` array. Each item is explicitly `PUBLIC_MESSAGE` or `INTERNAL_NOTE` and contains only its identifier, body, creation timestamp, and safe author summary. The service reads both relations with explicit selects and merges them deterministically by timestamp, kind, and identifier. Future portal ticket reads must define and query a separate public-only response.

**Reason**

The ticket detail is already the authoritative workspace query. A discriminated timeline avoids a second request and frontend record-type guessing while keeping the private-note boundary explicit in both the contract and service.

**Alternatives Considered**

Separate message and note read endpoints; separate unordered arrays on ticket detail; a shared internal/customer detail serializer.

**Consequences**

Internal detail invalidation refetches the complete ticket and conversation after each mutation. Customer portal work cannot reuse this internal detail shape and must never select `TicketNote`.

---

## ADR-011: Operational Dashboard and Fixed SLA Warning Window

**Date:** 2026-08-25

**Context**

The Agent Dashboard needs real role-scoped workload data and a stable SLA warning definition without introducing reporting infrastructure or background automation.

**Decision**

Expose one focused `GET /dashboard/overview` resource using the same ticket visibility predicate as Ticket Management. Derive effective SLA state at request time from ticket deadline snapshots with a fixed 60-minute `AT_RISK` window. Query metrics and distribution in PostgreSQL, use bounded Prisma reads for at most 10 attention items and 8 recent items, and return dashboard-safe fields only.

**Reason**

This answers immediate operational questions from persisted ticket data while keeping authorization server-side, avoiding N+1 reads and unbounded in-memory loading, and preserving the assessment boundary around workers, reports, and notifications.

**Alternatives Considered**

Persisted SLA status; a generic reports service; client-side filtering of global dashboard data; background timers; loading the entire ticket table and ranking it in memory.

**Consequences**

Dashboard state changes when the endpoint is requested and does not update continuously without navigation or explicit refetch. The 60-minute warning window is a fixed product rule until a later documented configuration feature changes it.

---

## ADR-012: Development Loopback CORS

**Date:** 2026-08-25

**Decision**

In non-production environments, allow browser origins on `localhost`, `127.0.0.1`, and `[::1]` over HTTP or HTTPS with any port. Production remains restricted to the configured `CLIENT_URLS` allowlist or `CLIENT_URL` fallback.

**Reason**

Vite may select different local ports during development and verification. Restricting the exception to loopback hosts keeps arbitrary remote origins rejected while avoiding repeated local environment changes.
## ADR-013: AGENT Customer Management is read-only

**Date:** 2026-08-25

**Decision**

`ADMIN` and `MANAGER` retain customer list, search, detail, note-read, create, update, eligible-delete, and note-create access. `AGENT` retains only list/search/detail/note-read access, including the existing customer query used by Ticket creation. `CUSTOMER` remains rejected from internal Customer Management.

The Express customer router authenticates once and applies explicit read/write role groups to individual routes. The client derives management capability from the authenticated auth-context role, hides mutation controls for agents, and protects `/customers/new` and `/customers/:id/edit` with replacement navigation to `/customers`. Backend authorization remains authoritative; no response shape, Prisma model, Ticket visibility rule, or Customer Portal behavior changes.

## ADR-014: Customer history uses safe summaries without broadening Ticket access

**Date:** 2026-08-25

**Decision**

Customer Details uses `GET /customers/:id/tickets` for complete customer history instead of reinterpreting normal Ticket list visibility. The endpoint exposes a minimal summary and derives `FULL` or `SUMMARY_ONLY` on the server. For AGENT, other-agent tickets are summary-only and non-navigable; every Ticket Management endpoint, queue query, conversation mutation, and Dashboard continues using the shared assigned-or-unassigned boundary.

**Reason**

Support staff need complete customer history context without gaining another agent's operational ticket workspace or private content. A separate response shape makes that distinction explicit and prevents rich Ticket list/detail fields from leaking into customer context.
