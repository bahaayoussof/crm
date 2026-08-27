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

## ADR-018: Isolated Customer Portal boundary

**Date:** 2026-08-25

> Renumbered from a second `ADR-011` heading that collided with "ADR-011: Operational Dashboard and Fixed SLA Warning Window". Substance is unchanged; the identifier is now unique.

The Customer Portal uses dedicated routes, schemas, response types, Prisma selects, query keys, and pages. Ownership comes from the linked Customer profile. Public status mapping hides ESCALATED, staff authors become SUPPORT, and Portal reads never query notes, history, attachments, SLA, or assignment data.

---

## ADR-019: Final Demo Targets Broader Original-Task Coverage

**Date:** 2026-08-26

**Context**

The delivered system implements a coherent P0 support loop (customers, tickets, conversation, Portal, operational Dashboard, basic SLA presentation), all integrated into `master`. The original assignment, however, contains broader feature areas — Knowledge Base, Attachments upload/download, Quick Replies, Customer Feedback, Reports, Users Management, Settings, Notifications, SLA automation, Tasks/Reminders, Team Collaboration, AI assistance, and Custom Branding — that are documented but not implemented. A coverage audit (`docs/19-progress-tracking.md`) reconciled documented status against repository evidence and produced a dependency-aware roadmap.

**Decision**

The final demo target is broader original-assignment coverage, not only the time-boxed three-day P0 scope. Provider-backed external integrations (inbound email, WhatsApp, SMS, production live chat, ERP, arbitrary external systems) and the full AI chatbot remain architecture/demo-only unless explicitly promoted. Features are delivered one isolated branch each, in the order recorded in `docs/19-progress-tracking.md`, beginning with `feature/knowledge-base`. Final comprehensive demo seed data (`feature/demo-seed-data`) is sequenced after the features whose schema and data it must exercise, not treated as the next task.

**Reason**

The three-day P0 assessment constraint is historical. The assignment scope is larger than P0, and the coverage matrix shows most non-P0 areas are `NOT_STARTED` rather than intentionally cut. Sequencing seed data last keeps the demo dataset aligned with a stable feature model.

**Alternatives Considered**

Freezing scope at the current P0 loop and shipping demo seed immediately; implementing remaining areas without a fixed dependency order; bundling multiple features per branch.

**Consequences**

`docs/01-scope-and-priorities.md`, `docs/14-implementation-plan.md`, `docs/18-ui-pages-spec.md`, `docs/05-api-contract.md`, and `docs/06-auth-rbac.md` distinguish implemented behavior from planned and unresolved scope. Tasks, Reminders, Team Collaboration, and Custom Branding still require product decisions before implementation and are documented as decision points, not specified contracts. External-provider limitations must not be described as functional because a channel enum exists.

---

## ADR-015: Agent Ticket Ownership and Definition Boundary

**Date:** 2026-08-26

**Decision**

Internal tickets created by an `AGENT` are assigned transactionally to the authenticated agent and receive one assignment-history event. Client-supplied assignment is forbidden for agent creation. After creation, the agent update boundary is an explicit `status` and `priority` allowlist that requires ownership; ticket definition, classification, organization, and assignment remain `ADMIN`/`MANAGER` capabilities. Closing remains the documented `RESOLVED -> CLOSED` update and is exposed through a dedicated confirmed action.

**Reason**

This removes the unassigned creation dead end, prevents partial or unintended core-field mutation, and makes the consequential close operation discoverable without adding an endpoint or changing the workflow model.

**Consequences**

The client protects ticket edit routes for `ADMIN`/`MANAGER`, renders unassigned agent views read-only, and invalidates rich detail plus related list, dashboard, and customer-context queries after updates. Customer Portal behavior and ticket visibility remain unchanged.

---

## ADR-016: Role-Aware Dashboard Primary Queues

**Date:** 2026-08-26

**Decision**

Keep the shared Ticket visibility predicate unchanged, but derive an explicit Dashboard primary queue from the authenticated server-side role. `ADMIN` and `MANAGER` receive `NEEDS_ATTENTION`; `AGENT` receives `MY_ASSIGNED_TICKETS`, limited to active tickets assigned to that agent. Return this as `primaryQueueType` plus `primaryTickets`, then query Recent Tickets from the complete role-visible dataset while excluding primary IDs before applying its limit.

**Reason**

Ticket visibility and an operational work queue answer different questions. Explicit response naming prevents an agent's complete assigned workload from being mislabeled as SLA attention, while backend exclusion keeps Recent Tickets full and non-duplicative without weakening visibility.

**Consequences**

AGENT metrics and Recent Tickets may still include eligible unassigned tickets. No claiming, assignment, workflow, schema, background processing, or Portal behavior changes. Dashboard clients must use the explicit primary response and preserve role-aware localized headings.

---

## ADR-017: Shared Request-Time SLA Derivation

**Date:** 2026-08-26

**Context**

Dashboard SLA derivation gained a second real consumer when internal Ticket Details needed the same operational state and effective target.

**Decision**

Keep one pure shared backend helper that accepts persisted ticket SLA timestamps plus an explicit current time. It returns the derived state, ISO effective deadline, and explicit first-response or resolution target. Dashboard continues exposing its established response shape; internal Ticket Details adds the target; Portal remains on isolated SLA-free selects.

**Reason**

One deterministic derivation prevents Dashboard and Ticket Details boundary drift without adding persistence, services, routes, schema changes, or client-side SLA calculation.

**Alternatives Considered**

Duplicate calculation in Ticket service; derive state in the browser; persist current SLA state; broaden a shared serializer across internal and Portal reads.

**Consequences**

Both internal consumers share exact 60-minute and zero-time boundaries plus the first-response tie rule. State remains a request-time snapshot. Deferred workers, events, notifications, escalation, and reporting are unchanged.

---

## ADR-020: Knowledge Base on the Existing `KnowledgeArticle` Model

**Date:** 2026-08-26

**Context**

`feature/knowledge-base` is the first post-P0 roadmap branch. `KnowledgeArticle` (`id`, `title`, `content`, `category?`, `status` [`DRAFT`/`PUBLISHED`], `createdById`, timestamps) and `KnowledgeArticleStatus` already exist in `schema.prisma` with no consuming code. `docs/05-api-contract.md` left response shapes, search parameters, and category handling to be resolved during this feature; `docs/18-ui-pages-spec.md` §11–13 fixed the page structure and permitted a plain textarea editor.

**Decision**

Use the model as-is: no schema change, no migration, no category table/relation, no slug/excerpt/popularity/publishing-date field, no revision history, no rich-text dependency. `category` stays optional free-text.

- Internal routes `GET/POST/PATCH/DELETE /api/knowledge-articles` in a new `server/src/modules/knowledge-base/` module. `GET` allows `ADMIN`/`MANAGER`/`AGENT`; mutations allow `ADMIN`/`MANAGER`. `createdById` is server-derived; unknown fields and client `createdById` are rejected. List projection omits `content` and author email; detail includes `content` and a `{ id, name, role }` author summary. Ordering `updatedAt DESC, id ASC`; case-insensitive search over title/content/category; bounded `page`/`limit` (≤ 100).
- Portal routes `GET /api/portal/knowledge-articles` and `/:id`, mounted at `/api/portal/knowledge-articles` before the ticket portal router, `CUSTOMER`-only. `status = PUBLISHED` is always forced server-side; a requested status is rejected. The list projection adds a server-derived `excerpt` (whitespace-collapsed, ≤ 200 chars) instead of an `excerpt` column; the detail projection is `{ id, title, content, category, updatedAt }` only. A `DRAFT` id and a missing id return the identical `404 KNOWLEDGE_ARTICLE_NOT_FOUND`.
- The published-article query rule (`status = PUBLISHED` + search/category) lives once in the service and is shared by both Portal handlers; internal and Portal handlers do not duplicate it.
- Frontend: internal routes `/knowledge-base`, `/knowledge-base/new`, `/knowledge-base/:id`, `/knowledge-base/:id/edit`; nav item for `ADMIN`/`MANAGER`/`AGENT`. A `KnowledgeArticleManageRoute` guard (mirroring `CustomerManageRoute`) redirects `AGENT` from the editor routes to `/knowledge-base` with replace navigation. Content renders as plain text with preserved paragraphs (`whitespace-pre-wrap`, `break-words`) — no `dangerouslySetInnerHTML`, no Markdown. Delete uses an inline accessible confirmation region (Confirm/Cancel), not a new dialog dependency. Portal routes `/portal/knowledge-base` and `/portal/knowledge-base/:id` with a "Help Center" nav item; the Portal list is labelled "Help articles" (neutral) because no popularity data exists.
- TanStack Query feature-local keys (`knowledgeArticleKeys`, `portalKeys.knowledgeArticles`). Every create/update/delete invalidates internal list + detail queries and the Portal `["portal","knowledge-articles"]` subtree so publish/unpublish changes Portal visibility without a reload.

**Reason**

The model already carries every field the feature needs. Free-text `category` avoids a category-admin surface out of scope here. A shared published-only service function keeps the internal/Portal boundary in one place. Plain-text rendering and an inline confirmation avoid new dependencies for a time-boxed assessment.

**Alternatives Considered**

Adding `slug`/`excerpt`/`publishedAt` columns; a `KnowledgeCategory` table; a Markdown or rich-text editor; a shared serializer across internal and Portal reads; reusing the ticket portal router for the KB routes; popularity-based ordering for the Portal list.

**Consequences**

No popularity/view tracking, no article versioning, no rich-text editing, and no related-article recommendations exist. `excerpt` is presentation-only and not persisted. Category values are unnormalized free text, so filtering is exact-match on the stored string. The Portal list uses recency ("Help articles"), not popularity. `feature/attachments` is the next roadmap branch.

---

## ADR-021: Secure Attachments on the Existing `Attachment` Model with Private Vercel Blob

**Date:** 2026-08-26

**Context**

`feature/attachments` (roadmap order 2) needed secure upload/download for internal Ticket attachments, Ticket message attachments, internal customer-profile attachments, and Customer Portal owned-Ticket attachments. `Attachment` (`id`, optional `ticketId`/`messageId`/`customerId`, `fileName`, `mimeType`, unique `storageKey`, `createdAt`) already existed with no consuming code (ADR-005). `docs/05` left the storage provider, MIME allowlist, size limit, per-context authorization, Portal ownership, and orphan-cleanup strategy to be resolved here. `docs/00`/`docs/03`/`docs/13` assumed a possible Multer/local-disk path; `docs/05`/`docs/06`/`docs/18` stated the Portal never exposes attachments.

**Decision**

- **Model as-is:** no schema change, no migration, no uploader/size/checksum/soft-delete column, no bytes in PostgreSQL. Context invariants (ticket-only, message-level with the message belonging to the ticket, customer-only; no mixed/empty context) are enforced only in the new service.
- **Storage:** a private **Vercel Blob** store behind an `AttachmentStorage` interface (`put`/`head`/`get`/`remove`). Concrete adapters: `@vercel/blob@2.x` server SDK (verified against the installed `.d.ts` — `put`/`get` take `access: 'private'`, all four accept a store-relative pathname, token from `BLOB_READ_WRITE_TOKEN`), and an in-memory adapter for tests. No fallback to public Blob or local disk; a missing token yields `503 STORAGE_UNAVAILABLE`. `busboy` (Multer's own streaming core) parses the bounded single-file multipart body; Multer itself was not added.
- **Limits:** server-proxied multipart, exactly one `file` part and **no textual fields** (any `field` event is rejected — reserved names `storageKey|ticketId|messageId|customerId|mimeType|fileName|createdAt` → `422 INVALID_ATTACHMENT_CONTEXT`, anything else → `422 INVALID_UPLOAD`; the field value is never read/logged/echoed; the stream is drained and no provider/DB work occurs). 4 MiB max. MIME allowlist `image/jpeg|png|webp`, `application/pdf`, `text/plain` validated by file signature/content (client MIME/extension/filename untrusted; `text/plain` fully scanned for NUL bytes, invalid UTF-8, binary signatures, and HTML/SVG/XML markup starts). `storageKey = attachments/<uuid>` generated server-side, never from the request. Filename kept only as sanitized display metadata. One documented code per parser condition — see `docs/05` "Attachments — LIVE"; no `VALIDATION_ERROR`/`UNEXPECTED_FILE_FIELD`/`ATTACHMENT_TOO_LARGE`/`MESSAGE_NOT_OWNED` alias exists.
- **Endpoints:** `GET/POST /api/tickets/:ticketId/attachments`, `GET/POST /api/tickets/:ticketId/messages/:messageId/attachments`, `GET/POST /api/customers/:customerId/attachments`, `GET /api/attachments/:attachmentId/download`; Portal `GET/POST /api/portal/tickets/:ticketId/attachments` and `GET /api/portal/attachments/:attachmentId/download` (mounted before `/api/portal`, mirroring the KB portal router). No DELETE.
- **Authorization:** internal routes require `ADMIN`/`MANAGER`/`AGENT`; ticket/message read follows the existing ticket visibility predicate; ticket/message upload additionally requires the `AGENT` to be the assigned agent, and message upload requires `message.authorUserId ===` the caller for every role. Customer-profile read = any internal role; customer-profile upload = `ADMIN`/`MANAGER`. Portal = `CUSTOMER` only, ownership via `User -> Customer.userId`, upload blocked on `CLOSED` (`409 TICKET_CLOSED`), customer-profile and foreign attachments return `404 ATTACHMENT_NOT_FOUND`. Authorization always runs before any provider call.
- **Projections:** internal `{ id, fileName, mimeType, createdAt, ticketId, messageId, customerId }`; Portal a **separate** `{ id, fileName, mimeType, createdAt, messageId }`. `GET /customers/:id` stopped selecting `storageKey`.
- **Download:** proxied through the app; `head` bounds size (`> 4 MiB` → `413 FILE_TOO_LARGE`, missing object → `404 ATTACHMENT_NOT_FOUND` with no provider detail) before `get`; response uses the stored validated MIME type with `Content-Disposition: attachment` (+ RFC 5987), `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`; never a redirect to a provider URL.
- **Orphan cleanup:** on provider `put` success + DB `create` failure, delete the provider object immediately and return `500 ATTACHMENT_UPLOAD_FAILED`; if cleanup also fails, preserve the original failure and log only the orphan `storageKey`. No background worker; not a cross-provider transaction.
- **Frontend:** `client/src/features/attachments/*` — API/hooks/download helper/preview hook/permissions/error map, `attachment-ui.tsx` (`AttachmentPanel`, `AttachmentRows`, `AttachmentUploadForm`, `MessageAttachmentList`), and the reusable `AttachmentActions` / `AttachmentPreviewDialog` plus inline `PreviewIcon`/`DownloadIcon`/`CloseIcon`/`SpinnerIcon` SVGs (no icon dependency; decorative SVGs `aria-hidden`). Upload uses a FormData request with `{ "Content-Type": undefined }` so the browser sets the multipart boundary (verified against axios 1.11: the instance's JSON default is otherwise kept). Each attachment row/card and each message-attachment shows a compact **Preview + Download** icon group (localized `aria-label`+`title`, ~40px target, focus ring, disabled+spinner while pending, duplicate-request prevention; the visible "Download attachment" text is removed). Download fetches a Blob via the authenticated client, creates a temporary object URL, triggers the download with the server filename, and revokes it. **Preview** requests the file through the same authenticated download endpoint (internal or Portal), receives a Blob, and opens an accessible `role="dialog"` `aria-modal` modal rendering an image (`object-contain`, bounded, `alt` = safe filename), the browser's built-in PDF viewer in an `iframe` on the temporary Blob URL with a localized fallback note, or plain text decoded (native `Blob.text()` with a `FileReader` fallback) and shown escaped in a scrollable `<pre>` — never HTML, no `dangerouslySetInnerHTML`. Unsupported/failed previews show a localized state + Retry without closing; Download stays available in the dialog. Focus enters on open and returns to the Preview button on close; Escape and the localized close button dismiss it; Tab is trapped. The object URL is revoked on close, on previewing a different file, and on unmount. No provider URL/storage key/token is exposed; nothing enters persistent state or the query cache; Preview never triggers a download. Sections added to internal Ticket Details (ticket-level list + upload; message-level rendered inline in the conversation, grouped from the one ticket-wide query — no second fetch, no attachment appears twice in a view), Customer Details Attachments tab (focused query; upload for `ADMIN`/`MANAGER`), and Portal Ticket Details. The internal/Portal ticket-create forms keep their documented "Attachments" placeholder only — upload needs a persisted record and is out of scope here.
- **Cache:** focused TanStack Query keys `["attachments","ticket"|"customer"|"portal-ticket", id]`. Ticket/portal uploads invalidate only their attachment query; customer uploads also invalidate `["customers","detail",id]`. No KB/Dashboard invalidation.

**Reason**

The model already carries every needed field. A private object store keeps bytes out of PostgreSQL and off any public URL; the adapter interface keeps controllers/services provider-agnostic and lets tests run without credentials. A strict signature allowlist plus forced-attachment downloads and `nosniff` is the mitigation available with no malware scanner. Reusing the existing ticket visibility and assigned-agent boundaries avoids widening any authorization surface.

**Alternatives Considered**

Local-disk / Multer storage; storing bytes in PostgreSQL; public Blob with obscured keys; direct browser-to-Blob uploads; a polymorphic attachment context; adding uploader/size columns; a shared internal/Portal serializer; reusing the ticket portal router for the attachment routes; a background orphan-cleanup worker.

**Consequences**

No malware scanning (documented limitation — signature validation is not a guarantee); no attachment deletion; **no thumbnails and no image transformations** (the in-browser Preview is a client presentation of the same authorized download — it does not make the Blob public and is not malware scanning); no resumable or multi-file upload. The DB cannot report who uploaded a file or its byte size (size is enforced at upload only). Cross-provider atomicity is best-effort with logged orphans. Deterministic mocked tests cover every route, role, projection, validation, failure, and cleanup path; PostgreSQL, live private Vercel Blob upload/download, and authenticated English/Arabic browser verification were not performed during implementation and remain outstanding on the integrated code (`master` at `8e24d22`). `feature/quick-replies` is the next roadmap branch.

## ADR-022: Quick Replies on the Existing `QuickReply` Model with a Dedicated Manager Workspace

**Date:** 2026-08-26

**Context**

`feature/quick-replies` (roadmap order 3) needed reusable agent reply snippets with management permissions and composer insertion. `QuickReply` (`id`, `title`, `body`, `createdById`, `createdAt`, `updatedAt`) already existed with no consuming code. `docs/05` marked it PLANNED ("management permissions, list/search where practical, insertion of editable content into the Ticket composer; never sent automatically"); `docs/18` §23 said the control lives in the "Ticket reply composer" and management "may live in `/settings` or another documented admin section". Two points were underdefined: (a) `docs/06` line 36 said "`ADMIN` quick-reply management" while the standing roadmap prompt said "ADMIN/MANAGER manage"; (b) no management page was specified, and `feature/settings` (order 7) does not exist yet.

**Decision**

- **Model as-is:** no schema change, no migration. `createdById` is server-derived from the authenticated user; strict Zod schemas reject unknown fields (including a client `createdById`). `title` trimmed 2–120; `body` trimmed 1–5,000; `PATCH` requires ≥1 field.
- **RBAC:** `ADMIN`/`MANAGER`/`AGENT` may `GET` (list + read one); `ADMIN`/`MANAGER` may `POST`/`PATCH`/`DELETE`; `AGENT` and `CUSTOMER` get `403` on mutations; `CUSTOMER` and anonymous are rejected everywhere. This resolves the conflict in favour of the roadmap prompt and matches the Knowledge Base precedent (ADR-020); `docs/06` role lists and a new RBAC table are updated to say ADMIN/MANAGER manage.
- **Endpoints:** `GET /api/quick-replies`, `GET /api/quick-replies/:id`, `POST /api/quick-replies`, `PATCH /api/quick-replies/:id`, `DELETE /api/quick-replies/:id` (204). Router registered at `/api/quick-replies` in `server/src/app.ts`. **No Portal route.**
- **List shape:** `{ data, meta }`; each item `{ id, title, body, createdAt, updatedAt, createdBy: { id, name, role } }` — author email never projected. `body` **is** included in the list (unlike KB `content`) so the composer inserter needs no second request; quick-reply bodies are short and internal-only. Ordering `title asc, id asc` (the picker and management list are both browsed by title, not recency). Case-insensitive `contains` search over `title` + `body`. `limit` max 100, default 20. Missing id → `404 QUICK_REPLY_NOT_FOUND`.
- **Management UI:** a dedicated manager-only `/quick-replies` workspace (list + `/quick-replies/new` + `/quick-replies/:id/edit`), mirroring the Knowledge Base feature — nav item shown to `ADMIN`/`MANAGER` only, `QuickReplyManageRoute` redirects `AGENT`/`CUSTOMER` to `/dashboard`. Not deferred to `feature/settings`; that feature may later link here. The list uses a TanStack Table (ADR-008) with mobile cards, URL-backed search, manual pagination, and inline per-row Edit + Confirm/Cancel Delete (no dialog dependency).
- **Composer insertion:** a `QuickReplyPicker` searchable, keyboard-accessible combobox (`role="combobox"` + listbox, reusing the ticket Customer-combobox pattern — no new dependency) in the internal Ticket public-reply composer ("Reply" tab only), mounted only when `mode === "reply" && canMutate`. Typing searches through `GET /api/quick-replies` `search` (case-insensitive `title`+`body`), debounced ~300 ms, fetched only while open, bounded to `limit` 10 with `title asc, id asc` — replies past the first page stay reachable via search. Explicit loading / empty / no-results states; a failed list request shows a non-blocking inline message and the composer stays usable. Arrow/Enter/Escape keyboard nav; selection never submits and never switches the Note tab. Insertion is at the textarea cursor: replace the selected range or insert at the caret, preserve text on both sides, add blank-line spacing only when the adjacent side is non-empty and not already whitespace, return focus to the textarea, and place the caret immediately after the inserted text. It respects the 20,000-char public-reply limit (`ticketConversationBodySchema` / `portalReplySchema`) — an over-limit result leaves the draft unchanged and shows a localized `role="alert"` error, never a silent truncation. Unrelated composer state (Note draft, attachments, success message) is untouched. Absent from the Internal Note tab and the Customer Portal. `ticket-pages.test.tsx` mocks the picker to a stub to keep its existing render assertions and avoid a `QueryClient` there (same pattern as the attachments hooks mock); a dedicated `client/src/features/tickets/quick-reply-composer.test.tsx` renders the real picker + real `useQuickReplies` inside a `QueryClientProvider` and covers search, keyboard selection, every popup state, cursor/replace insertion at start/middle/end, focus/caret restoration, the length guard (English + Arabic), and the mode/permission/Portal visibility rules.
- **Out of scope (explicit):** no placeholders/variables, no categories/folders, no favorites, no usage analytics, no AI generation, no per-agent private replies.

**Reason**

The model already carries every needed field. ADMIN/MANAGER management matches the KB precedent and the standing instruction, and keeps managers self-sufficient before `feature/settings` exists. A dedicated workspace avoids a dead management gap; a plain `<select>` inserter is fully accessible, needs no new dependency, and cannot auto-send.

**Alternatives Considered**

`ADMIN`-only management (literal `docs/06` wording); API-only this cycle with the management screen deferred to `feature/settings`; a plain `<select>` inserter (rejected — not searchable, so replies past the first page would be unreachable) and a preloaded first-100 list; a disclosure/listbox menu; omitting `body` from the list projection and fetching per insertion; recency ordering; append-only insertion at the end of the draft (rejected — corrupts cursor context); a Portal quick-reply surface.

**Consequences**

`docs/06` gains a MANAGER capability it previously reserved to ADMIN. The composer combobox fetches a bounded page (`limit` 10) per debounced search rather than a full list; every quick reply is reachable by title/body text. PostgreSQL and authenticated English/Arabic browser verification were not performed and rely on deterministic mocked/integration tests until a developer completes them. `feature/customer-feedback` is the next roadmap branch.

---

## ADR-023: Customer Feedback on the Existing `Feedback` Model as a One-Shot Portal Rating

**Date:** 2026-08-27

**Context**

`feature/customer-feedback` (roadmap order 4) needed a way for a `CUSTOMER` to rate the support they received. `Feedback` (`id`, `ticketId @unique`, `customerId`, `rating Int`, `comment String?`, `createdAt`) already existed with no consuming code. `docs/05` "Feedback — PLANNED" listed the open questions: eligible ticket statuses (expected `RESOLVED`/`CLOSED`), customer ownership, one record per ticket, rating range, optional comment, whether a submission can be updated, Portal UX, and how the rating feeds `GET /reports/*` (`feature/reports`, order 5, not built yet). `docs/18` §31 shows a "Customer submits feedback if implemented" step in the critical demo flow and a "Feedback submitted" line in the Activity timeline.

**Decision**

- **Model as-is:** no schema change, no migration. `ticketId @unique` already enforces one feedback record per ticket. `customerId` is server-derived from `User -> Customer.userId` (the established Portal identity pattern); it is never accepted from the browser.
- **Eligibility:** the ticket must be owned by the authenticated customer and its stored status must be `RESOLVED` or `CLOSED`. A missing or non-owned ticket returns the existing IDOR-safe `404 TICKET_NOT_FOUND`; an owned ticket in any other status returns `409 TICKET_NOT_ELIGIBLE_FOR_FEEDBACK`.
- **One-shot, immutable:** there is no update or delete endpoint. A second `POST` for a ticket that already has feedback returns `409 FEEDBACK_ALREADY_SUBMITTED` (checked inside the same transaction as the create). Resolves the "whether a submission can be updated" question as *no* — the simplest contract, and a rating captured at resolution time is the datum reports want.
- **Rating / comment:** `rating` is a JSON number, integer, `1`–`5` (out-of-range / non-integer / string → `400 VALIDATION_ERROR`). `comment` is an optional trimmed string, 1–2,000 chars; omitted or blank stores `NULL`. Strict Zod schema rejects unknown fields.
- **Endpoints (Portal only):** `POST /api/portal/tickets/:id/feedback` → `201 { data: { rating, comment, createdAt } }`; `GET /api/portal/tickets/:id/feedback` → the same shape or `404 FEEDBACK_NOT_FOUND`. Both are sub-routes on the existing `portalRouter` (`requireAuth` + `requireRole(CUSTOMER)`), mirroring the `feature/attachments` Portal sub-route pattern — **no new `app.ts` registration, no internal route**.
- **Ticket-detail integration:** `GET /api/portal/tickets/:id` now also returns `feedbackEligible: boolean` (status `RESOLVED`/`CLOSED`) and `feedback: { rating, comment, createdAt } | null`, so the Portal ticket page renders the rating form, the read-only submitted state, or nothing without a second request.
- **History:** submission writes one `TicketHistory` row (`action: "FEEDBACK_SUBMITTED"`, `actorUserId` = the customer's user id, `newValue` = the rating as a string) inside the create transaction, satisfying the `docs/18` Activity "Feedback submitted" line.
- **Reports:** no `GET /reports/*` work in this branch. The rating is persisted and queryable; `feature/reports` (ADR to come) owns the satisfaction metric.
- **Portal UI:** an accessible star control (`role="radiogroup"` of five `1`–`5` radio inputs for input; `role="img"` with a localized summary label for the read-only state), an optional comment textarea (`maxLength=2000`), and a submit button that is blocked with a localized `role="alert"` until a rating is chosen. On success the invalidated ticket query refetches and the section switches to the read-only submitted state — that switch is the confirmation. EN/AR strings under `portal.feedback.*` (520/520 key parity), RTL-safe.
- **Out of scope (explicit):** no editing/withdrawing feedback, no agent/internal feedback view, no per-message or CSAT-vs-NPS distinction, no follow-up prompts, no reminder emails, no reports surface.

**Reason**

The model already carries every field. Eligibility on `RESOLVED`/`CLOSED` matches `docs/05`'s stated expectation and the demo flow (feedback after "Agent resolves Ticket"). One-shot immutability is the least surprising contract and keeps the reports datum stable. Folding `feedbackEligible`/`feedback` into the existing ticket-detail payload avoids an extra round trip and a separate loading state on the Portal page. Portal sub-routes with no internal endpoint keep the surface minimal, exactly as `feature/attachments` did.

**Alternatives Considered**

Updatable feedback (rejected — unstable reports datum, no product need); a dedicated `GET`-only internal feedback view this cycle (deferred to `feature/reports`); accepting feedback for any status or only `CLOSED` (rejected — `RESOLVED` is when the customer's experience is freshest and the demo flow resolves, not closes); a separate `/portal/feedback` collection route (rejected — feedback is per-ticket, the ticket route already scopes ownership); a numeric `<select>` instead of stars (rejected — stars are the expected CSAT affordance and the radiogroup is equally accessible); a `feature/reports`-style internal `app.ts` router (rejected — nothing internal consumes it yet).

**Consequences**

`GET /api/portal/tickets/:id` gains two fields; the Portal ticket-detail type and its tests are updated. A new `TicketHistory` `action` string value (`FEEDBACK_SUBMITTED`) joins `TICKET_CREATED` / `STATUS_CHANGED`; any future exhaustive history-action rendering must handle it. PostgreSQL and authenticated English/Arabic browser verification were not performed and rely on deterministic mocked tests until a developer completes them. `feature/reports` is the next roadmap branch and will consume `Feedback.rating`.

## ADR-024: Reports on Existing Rows — ADMIN/MANAGER Read-Only Aggregates over a UTC Date Range

**Status:** Accepted (implemented on `feature/reports`, uncommitted; automated-verified only)

**Context**

Roadmap order 5. `docs/05` and `docs/18` §14 call for a management Reports page: created/resolved volume, status distribution, SLA compliance, average first-response time, agent performance, and customer satisfaction — "all from real persisted data with an explicit date-range and timezone definition", and "do not invent fabricated analytics". The Operational Dashboard (`GET /dashboard/overview`) is a live snapshot, not this. Satisfaction depends on `Feedback.rating` (`feature/customer-feedback`, integrated at `12a0c12`).

**Decision**

- **No schema change, no migration.** Every figure is computed from existing `Ticket`, `Feedback`, `Category`, and `User` columns. There is no persisted SLA-breach record and none is added — SLA outcomes are derived from `firstResponseDueAt` / `firstRespondedAt` / `resolutionDueAt` / `resolvedAt` / `closedAt` at request time.
- **New module `server/src/modules/reports/`**, registered at `/api/reports` in `app.ts` (after `/api/dashboard`). Four `GET` routes — `/overview`, `/tickets`, `/agents`, `/sla` — behind `requireAuth` + `requireRole(ADMIN, MANAGER)`. No `AGENT` access (`docs/18` allows it "only if explicitly allowed" — it is not). No Portal route.
- **Date range:** optional `from` / `to` ISO datetimes via one shared `reportsRangeQuerySchema` (`validateQuery`). Default = trailing 30 days ending now. `from` after `to`, span over 366 days, or any unknown query field → `400 VALIDATION_ERROR`. All day bucketing is **UTC**; every response echoes `range`, `timezone: "UTC"`, `generatedAt`.
- **Cohort rules:** "created cohort" = `createdAt` in range; "resolved" counts use `resolvedAt` in range (tickets created earlier still count). One lean `ticket.findMany` (`OR: [createdAt in range, resolvedAt in range]`) feeds all aggregation in memory — no groupBy fan-out, no caching layer.
- **SLA derivation:** first-response / resolution each classified `MET` / `BREACHED` / `PENDING` / `NONE`; `compliancePct = round(met / (met + breached) * 100)`, `null` when the denominator is 0. This is a report-local calc, intentionally not the `shared/sla/deriveSla` helper (that produces a single current-state label for one ticket; reports need met-vs-breached tallies over a cohort).
- **Frontend `client/src/features/reports/`:** `reports-page.tsx` at `/reports`, guarded by `reports-route.tsx` (`canViewReports` = `ADMIN` || `MANAGER`, else `/dashboard` replace); conditional nav item. Presets (7/30/90) + custom dates synced to URL `from`/`to`. Recharts (already a client dep) for volume + status; hand-built bars for SLA/satisfaction. Per-section loading / page-error / section-error / empty states. `reports.*` EN/AR (577/577 parity), RTL, LTR-isolated dates.
- **Out of scope (explicit):** no department/branch/channel breakdown, no previous-period trend deltas, no CSV/PDF export, no per-day SLA series, no result caching, no per-user timezone (fixed UTC), no scheduled/emailed reports.

**Reason**

The domain rows already hold everything the spec asks for; a reporting schema would be premature. A single in-memory pass keeps the code testable (12 deterministic server tests cover auth, range validation, and every aggregation) and fast enough at assessment scale. UTC bucketing is the one timezone choice that is unambiguous and matches how the timestamps are stored. Keeping `AGENT` out matches the default in `docs/18`.

**Alternatives Considered**

Reusing `deriveSla` for compliance (rejected — wrong shape: single label vs. cohort tally); SQL `groupBy` per metric (rejected — many round trips, harder to keep the cohort rules consistent); a materialized/cached report table (rejected — no schema change wanted, data is small); putting Reports under the Dashboard router (rejected — different audience, different contract, `docs/05` lists them separately); allowing `AGENT` a scoped view (rejected — not requested, adds a visibility predicate to every query).

**Consequences**

`app.ts` gains one router. No existing endpoint or type changes. The satisfaction section needs demo `Feedback` rows to look populated — `feature/demo-seed-data` (order 14) must seed enough. PostgreSQL and authenticated English/Arabic browser verification were not performed and rely on the deterministic mocked tests until a developer completes them. Next roadmap branch: `feature/user-management` (order 6).

---

## ADR-025: Users Administration — ADMIN-only CRUD + Role Change, `User.isActive` for Retirement

**Status:** Accepted (implemented on `feature/user-management`, uncommitted; automated-verified only)

**Context**

Roadmap order 6. `docs/18` §15 asks for a `/users` page (table: Name, Email, Role, Status, Created; actions: Create User, Edit User, Change Role) to "manage internal CRM users and roles", scoped to `ADMIN` with "MANAGER access only if explicitly granted", and warns "avoid implementing unnecessary enterprise identity features". Before this feature the only users route was `GET /users/agents` (a ticket-assignment lookup); the schema had no way to disable an account.

**Decision**

- **Schema:** one column — `User.isActive Boolean @default(true)` (migration `20260827101406_add_user_is_active`). No status enum, no soft-delete columns, no `lastLoginAt`, no invite/token table, no department/branch assignment UI.
- **MANAGER boundary:** resolved to **ADMIN only**. Every administration route is `requireRole(ADMIN)`; `MANAGER`/`AGENT`/`CUSTOMER` get `403`. `GET /users/agents` keeps its existing `ADMIN`/`MANAGER`/`AGENT` group.
- **Routes** (extend the existing `userRouter`, still mounted at `/api/users` — no `app.ts` change): `GET /` (paginated list; `search` name/email, optional `role` + `status` filters; `createdAt DESC, id ASC`), `GET /:id`, `POST /` (`name`, `email`, `password` 8–128 bcrypt cost 12, `role`), `PATCH /:id` (`name?`, `email?`, `isActive?`), `PATCH /:id/role` (`role`). Strict Zod bodies; safe projection `{ id, name, email, role, isActive, createdAt, updatedAt }` — never `passwordHash`.
- **Internal identities only:** `role` on create / role-change is constrained to `{ADMIN,MANAGER,AGENT}` (`CUSTOMER` → `400`); list/detail/update filter `role in {ADMIN,MANAGER,AGENT}` so a `CUSTOMER` row returns `404 USER_NOT_FOUND`. This surface never creates or exposes portal customers.
- **Self-lockout guards:** deactivating your own account → `409 CANNOT_DEACTIVATE_SELF`; changing your own role → `409 CANNOT_CHANGE_OWN_ROLE`. Duplicate email on create/update → `409 EMAIL_ALREADY_REGISTERED`.
- **`isActive` enforcement in auth:** `authUserSelect` gains `isActive`; `login` rejects a deactivated account with `403 ACCOUNT_DEACTIVATED`; `getCurrentUser` (`GET /auth/me`) rejects mid-session with `401 ACCOUNT_DEACTIVATED` (forces client logout). `/users/agents` now filters `isActive: true` so disabled agents disappear from assignment.
- **No deletion route.** Retirement = `isActive=false`. Ticket/message/note/history FKs (`Restrict`) make row deletion unsafe and the spec does not ask for it.
- **Frontend `client/src/features/users/`:** `/users` list (search + role + status filters synced to URL, TanStack table, mobile cards), `/users/new` + `/users/:id/edit` forms (create takes password + role; edit takes name/email/`isActive` only — role is changed from the list), inline anchored `role="dialog"` role-change popover with a role `<select>` + Save/Cancel + error-retry. `user-manage-route.tsx` sends non-`ADMIN` to `/dashboard`; conditional nav item via `canManageUsers` = `role === "ADMIN"`. `users.*` + `navigation.users` EN/AR (634/634 parity), RTL, LTR-isolated email/date. Inline SVG icons (no icon dep).
- **Out of scope (explicit):** password reset / "send reset email", bulk actions, CSV import/export, audit log of admin actions, per-user permissions beyond the 4 roles, MFA, session revocation lists, department/branch assignment.

**Reason**

The spec is deliberately small ("avoid unnecessary enterprise identity features"). One boolean covers "Status"; four roles already exist; bcrypt + JWT auth is already in place. ADMIN-only matches the documented default and avoids designing a partial-MANAGER capability nobody asked for. Blocking self-deactivation / self-demotion prevents the one obvious way an admin bricks their own access.

**Alternatives Considered**

`status` enum (`ACTIVE`/`SUSPENDED`/`INVITED`) — rejected, no invite flow and `SUSPENDED` vs deleted is the only real distinction. Hard delete with dependency guards (like customer deletion) — rejected, `Restrict` FKs across tickets/messages/notes/history make it almost always fail and history must be preserved. Granting `MANAGER` read-only or create-but-not-role-change access — rejected, not requested; revisit only if a product decision lands. A dedicated `PATCH /:id` accepting `role` too — rejected, keeping role on its own route makes the "Change Role" action and its self-demotion guard explicit and auditable.

**Consequences**

One migration (`User.isActive`). `auth.service.ts` changed (select + two new rejection paths) — existing auth tests updated with an `isActive: true` fixture field plus two new deactivation cases. `GET /users/agents` response now hides inactive agents (intended). No other endpoint or type changes. PostgreSQL and authenticated English/Arabic browser verification were not performed and rely on the deterministic mocked tests (server 287, client 298) until a developer completes them. Next roadmap branch: `feature/settings` (order 7).

### Pre-integration correction (amends ADR-025, no new ADR — still on `feature/user-management`, uncommitted)

- **Role mutation consolidated into `PATCH /api/users/:id`.** The dedicated `PATCH /users/:id/role` route, `changeUserRoleSchema`, and the table's inline role-change popover are removed. `updateUserSchema` gains an optional `role`; role changes happen only in the Edit User form and travel in the one safe update payload. The Users table renders role and status as read-only badges (no dropdowns in cells).
- **Self-management safety, server-enforced:** `409 SELF_ROLE_CHANGE_FORBIDDEN` (was `CANNOT_CHANGE_OWN_ROLE`) when an admin submits a *changed* own role (unchanged is allowed, so a self profile edit still works); `409 SELF_DEACTIVATION_FORBIDDEN` (was `CANNOT_DEACTIVATE_SELF`). The Edit User page renders the caller's own Role select disabled and the Active checkbox disabled, each with a localized explanation and a `You` badge; the table hides/disables self-deactivation.
- **Last-active-`ADMIN` protection:** `updateUser` now runs read-check-write inside one `prisma.$transaction`; demoting or deactivating an active `ADMIN` triggers a `count` of other active admins and throws `409 LAST_ACTIVE_ADMIN_REQUIRED` when none remain. The frontend also disables the action when the loaded page *proves* a single active admin, and always handles the server conflict (data may be stale/paginated), preserving entered form values on rejection.
- **Active-session enforcement:** new `requireActiveUser` middleware (`server/src/middleware/require-active-user.ts`) resolves the caller's current DB `role`/`isActive` and overwrites `request.auth.role` before `requireRole(ADMIN)` on every `/api/users` admin route (not `/users/agents`, not other routers — scoped to keep the change bounded and avoid a per-request user lookup everywhere; no refresh tokens). A demoted admin loses `/api/users` access on the next request; a deactivated caller gets `401 ACCOUNT_DEACTIVATED`.
- **Only submitted fields are written** — `updateUser` builds the `data` object key by key; the client `updateUser` sends only the keys present in its payload (a status toggle sends `{ isActive }` alone).
- **Consistent Select treatment:** a `NativeSelect` primitive (`users-ui.tsx`) renders the native control with `appearance-none` + `bg-none` + `pe-9` and one absolutely-positioned custom `ChevronDownIcon` at the logical end (`end-3`, vertically centred, `pointer-events-none`, never rotated for RTL). Applied to the Role/Status filters and the Create/Edit Role field only — the global `.input` and unrelated selects are untouched. The `ShieldIcon` is replaced by `UserRoundXIcon` / `UserRoundCheckIcon` for the deactivate/reactivate actions; status changes use the anchored `role="dialog"` confirm pattern showing name + action + (for deactivation) the "cannot sign in / history preserved" consequence.
- **Table presentation:** explicit `table-fixed` column widths (Name 22%, Email flexible, Role 132px, Status 120px, Created 150px, Actions 112px); Email is `truncate` + `dir="ltr"` + `title` (no more character-by-character wrapping); Name links to Edit without persistent blue styling; mobile keeps a card list with the same actions and read-only role.
- Tests: server `user.test.ts` rewritten (31 cases incl. last-admin, self-guard codes, role-in-update, transaction-failure, stale-JWT-role, deactivated-caller); client `users.test.tsx` rewritten (24 cases). Full suites now **server 298 / client 310**, 0 failed. i18n `users.*` EN/AR parity **644/644**.
