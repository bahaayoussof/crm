# Conversations / Channels Implementation Plan

## Plan Status

**Status: implemented — see `tasks.md` for execution/verification status.**

This plan implements `specs/features/conversations-channels/spec.md`. It defines architecture and approach only; `tasks.md` decomposed it into task IDs `CONV-001`–`CONV-057`, which are complete and verified. This document is not an execution-status tracker — it remains the authoritative record of the HOW (architecture, schema/migration strategy, and testing strategy).

## Goal

Harden the existing Ticket-based conversation system across WEB/Portal, Email, SMS, WhatsApp, and Live Chat with durable outbound delivery, explicit message content provenance, message/note-owned attachments, reliable correlation and idempotency, safe phone ambiguity handling, canonical creation audit coverage, and concurrency-safe Live Chat sessions while preserving all Tickets SDD invariants.

## Architectural Direction

Keep `Ticket` as the conversation aggregate, `TicketMessage` as the only customer-visible message, and `TicketNote` as the internal-only record. Extend those existing seams instead of creating a parallel inbox or generic event platform. PostgreSQL remains authoritative; REST/webhooks remain write paths; SSE remains post-commit invalidation only.

Outbound delivery remains commit-first. The local message and its normal transactional side effects commit first, then an immediate provider attempt updates a durable delivery row. A bounded external-cron retry endpoint reuses that same row and message; it never creates a second `TicketMessage`. Provider callbacks, only where supported, address and update the same delivery row.

## Global Invariants

- `CLOSED` is viewable and fully immutable. No staff, Portal, provider, attachment, retry, or callback path may append conversation content to a CLOSED ticket.
- Public content is stored only in `TicketMessage`; internal content is stored only in `TicketNote`. Notes are never provider-delivered or Portal-visible.
- Commit-first outbound delivery is preserved. Provider failure cannot roll back or delete a committed reply.
- Customer/provider activity may reuse a ticket only through explicit ticket/session correlation or reliable provider thread/message correlation. Customer identity alone never selects a “latest” ticket.
- Portal and reliably correlated Email replies may reopen RESOLVED; heuristic SMS/WhatsApp input may not. New Live Chat sessions always create new tickets.
- First response is stamped once by an authenticated human `ADMIN`, `MANAGER`, or `AGENT` public reply. Notes, inbound provider messages, system events, and unsent AI output do not count.
- Realtime events remain post-commit, contain identifiers only, and carry complete server-side audience metadata including `teamId`.
- No new runtime dependency, queue, broker, WebSocket transport, or second auth mechanism is required.

## Existing Implementation to Reuse

- `server/src/modules/tickets/ticket.service.ts`: canonical staff ticket creation, mutation access, public reply/note transactions, first-response stamping, notification fan-out, and provider dispatch point.
- `server/src/modules/portal/portal.service.ts`: Portal ownership projection, Portal ticket creation/reply, RESOLVED reopen logic, and public-only responses.
- `server/src/modules/integrations/outbound-delivery.ts`: shared delivery result/failure vocabulary; evolve this into the channel-neutral durable orchestration seam and remove WhatsApp policy duplication.
- `server/src/modules/integrations/{email,sms,whatsapp}/`: verified inbound adapters and provider clients. Keep wire parsing/authentication provider-local while moving shared identity, correlation, idempotency, ticket creation, audit, notification, and event assembly into narrowly scoped helpers.
- `server/src/modules/live-chat/live-chat.service.ts`: department/team routing, auto-assignment, customer-safe projection, and end-session behavior.
- `server/src/modules/attachments/`: private storage, byte/type limits, authorization-before-upload, cleanup, and safe download projections.
- `server/src/shared/rich-text/reply-html.ts`: server sanitization and deterministic plain-text projection.
- `server/src/modules/realtime/realtime.publisher.ts`: transaction-aware post-commit outbox and existing ticket audience contract.
- `server/src/modules/audit-logs/audit-log.service.ts` and constants: one canonical audit writer and action vocabulary.
- Existing Ticket, Portal, provider, Live Chat, attachment, realtime, rich-text, and frontend conversation tests; expand these rather than creating a separate test harness.

## Database and Prisma Changes

### 1. Durable message content metadata

Add Prisma enums and fields:

- `ConversationContentFormat`: `PLAIN_TEXT | SANITIZED_HTML`.
- `ConversationContentSource`: `STAFF | PORTAL | EMAIL | SMS | WHATSAPP | LIVE_CHAT | SYSTEM`.
- `TicketMessage.contentFormat` and `TicketMessage.contentSource` as required fields after backfill.
- `TicketNote.contentFormat` and `TicketNote.contentSource`; note source is normally `STAFF`, but retaining the field keeps the persistence contract explicit and future-safe.

The API must project `contentFormat`; clients must stop sniffing markup to choose rendering. `contentSource` is internal provenance and need not be exposed to Portal unless a presentation requirement later needs it.

### 2. Durable outbound delivery

Add one `MessageDelivery` row per provider-bound outbound message:

- `id`, unique `messageId`, `channel`, and `status`.
- `providerMessageId` when available, with a provider/channel-scoped unique constraint suitable for callbacks.
- `attemptCount`, sanitized `lastErrorCode` and bounded non-secret `lastErrorMessage` (or omit the message if provider text cannot be safely normalized).
- `nextAttemptAt`, `firstAttemptedAt`, `lastAttemptedAt`, `sentAt`, `deliveredAt`, `failedAt`, `createdAt`, and `updatedAt`.
- A short claim/lease field such as `claimedUntil` so overlapping cron invocations cannot send the same attempt concurrently.

Use statuses that distinguish actionable states without pretending every provider confirms carrier delivery: `PENDING`, `SENDING`, `SENT`, `DELIVERED`, and `FAILED`. `SENT` means provider accepted; `DELIVERED` is used only after a supported trusted callback.

Indexes must support bounded retry selection (`status`, `nextAttemptAt`) and callback lookup (`channel`, `providerMessageId`). Do not add a general job/outbox table.

### 3. Inbound provider idempotency

Add a nullable `TicketMessage.inboundKey` with a unique database constraint. New provider messages write a namespaced value (`email:<id>`, `sms:<id>`, `whatsapp:<wamid>`) in the same transaction as all inbound side effects. Keep legacy `externalId`/`externalMessageId` during migration compatibility; outbound provider ids move to `MessageDelivery.providerMessageId` so the old field is no longer overloaded for new writes.

Duplicate classification must inspect the violated database constraint/target and return `DUPLICATE` only for `TicketMessage.inboundKey`. An unrelated unique violation—including placeholder email collisions—must be resolved by its owning flow or propagated.

### 4. Message/note attachment ownership

Extend `Attachment` with nullable `noteId` and a `TicketNote.attachments` relation. Update the service-enforced context invariant so a conversation attachment resolves to exactly one `messageId` or `noteId`; `ticketId`/`customerId` contexts remain only for legacy/general file features and are never presented as attached to a newly sent conversation item.

No destructive conversion of existing ticket-level attachments is safe because their intended message cannot be inferred. Leave them as legacy ticket files.

### 5. Live Chat session identity

Add nullable unique `Ticket.liveChatSessionKey` (or a narrowly named one-to-one session model only if Prisma/PostgreSQL cannot express the required lifecycle cleanly). New Live Chat starts require a server-validated opaque session key generated by the client widget and persisted on the new `LIVE_CHAT` ticket.

The unique key is the concurrency boundary: simultaneous creates for the same session race on one DB constraint, and the loser re-reads and returns the winner. A fresh session key always creates a fresh ticket; customer identity never resumes another session. Legacy Live Chat rows remain nullable and read-only through the compatibility path.

## Migration and Backfill

Use additive, reversible-forward migrations; do not reset data.

1. Add nullable content metadata, `inboundKey`, `noteId`, `liveChatSessionKey`, delivery enums/table, relations, and indexes.
2. Backfill content deterministically:
   - known SMS/WhatsApp inbound system authors and Email inbound plain bodies → `PLAIN_TEXT` with their provider source;
   - authenticated customer Portal rows → `SANITIZED_HTML` only when their write path already guaranteed server sanitization, otherwise `PLAIN_TEXT`;
   - staff message/note rows created through the sanitized rich-text boundary → `SANITIZED_HTML` / `STAFF`;
   - uncertain historical rows default to `PLAIN_TEXT`, which is the safer non-interpreting representation.
3. Backfill `inboundKey` only where provider origin and identity are unambiguous. Detect duplicate candidates before creating the unique index; report conflicts for manual review rather than deleting or merging messages.
4. Existing outbound `externalId` values cannot always be distinguished safely from inbound ids. Do not fabricate delivery history. Optionally backfill `MessageDelivery(status = SENT)` only for rows whose staff authorship, provider channel, and id provenance are conclusive; otherwise leave historical delivery unknown and document that limitation.
5. Make content metadata non-null after the backfill proves complete. Keep Live Chat session keys nullable for legacy tickets.

Migration verification must include row counts, null checks for new required metadata, uniqueness-conflict reports, representative plain/rich rows, and preservation of every existing TicketMessage/Note/Attachment.

## Canonical Content Validation and Size Policy

One server-owned policy applies before every conversation write:

- Normalize line endings and reject content whose semantic plain-text projection is empty.
- Maximum semantic content is **20,000 Unicode characters** for staff replies, internal notes, Portal replies, Email, SMS, and WhatsApp inbound/outbound.
- Rich input additionally has a **50,000-character serialized payload ceiling** before sanitization to bound parser work and allow markup overhead. After sanitization, its plain-text projection must still be 1–20,000 characters.
- The compact Live Chat composer intentionally has the smaller **2,000-character semantic limit**; the server enforces it from the Live Chat source, not only in the browser.
- Provider payload parsers reject or safely ignore oversize messages according to their authenticated webhook contract; they must not silently truncate persisted conversation content. Email subject preview generation may truncate only the derived subject, never the stored body.
- `PLAIN_TEXT` is stored without HTML interpretation and rendered through a text node with preserved whitespace. `SANITIZED_HTML` is accepted only from an approved rich surface, sanitized server-side before persistence, and rendered according to `contentFormat` with client re-sanitization as defense in depth.

Centralize this policy beside `server/src/shared/rich-text/reply-html.ts` or a small conversation-content sibling. Provider adapters supply declared source/format; they do not implement their own divergent length rules.

## Backend Changes

### Shared conversation creation seams

Extract small service helpers only where current duplication has caused defects:

- `createCanonicalTicket(...)`: creates the ticket, SLA snapshot, `TicketHistory(TICKET_CREATED)`, exactly one `AuditLog(TICKET_CREATED)`, optional assignment, and returns complete realtime audience fields. Staff passes its actor id; Portal/provider/Live Chat passes `actorId = null`.
- `persistInboundMessage(...)`: applies the namespaced idempotency key, declared content metadata, correlated-ticket status transition, notification recipients, and complete event payload in one transaction.
- `resolveCustomerByCanonicalPhone(...)`: returns a discriminated `none | one | ambiguous` result. Provider adapters own their existing create shape for `none`; `ambiguous` performs no ticket/message writes and produces a safe logged/operator-visible outcome.
- `resolveCorrelatedTicket(...)`: accepts only explicit ticket/session evidence or verified provider thread/message evidence. It must not accept customer id as sufficient selection input.

Keep provider signature verification, payload schemas, retrieval, and provider-specific identifiers in their existing modules.

### Ticket matching and lifecycle

- Portal reply remains explicit by owned ticket id and preserves the existing RESOLVED reopen transaction (`OPEN`, clear `resolvedAt`, retain `resolutionDueAt`; leave first-response fields untouched).
- Email retains RFC header, reply token, and public reference correlation in that order, all sender/customer constrained. Remove the “exactly one active Email ticket” identity-only fallback. Reopen RESOLVED only when one of those reliable correlations succeeds.
- SMS/WhatsApp no longer look up the newest active ticket by customer/phone. Without explicit/reliable message-thread correlation supported by that provider flow, create a new ticket. They never reopen RESOLVED from identity matching.
- Live Chat start/resume uses only `liveChatSessionKey`. RESOLVED/CLOSED session keys are terminal; a new key creates a fresh ticket.
- All paths guard CLOSED before message, attachment, delivery state, notification, history, audit, or event writes.

### Durable outbound orchestration

In the staff public-reply transaction, validate any requested attachments and channel capability first, then create `TicketMessage`, bind attachments, stamp first response, create notifications, and create `MessageDelivery(PENDING, attemptCount = 0)` for EMAIL/SMS/WHATSAPP. Commit and emit the normal message event. After commit, claim and execute the initial attempt.

The shared delivery service must:

- claim one delivery atomically using status/lease guards;
- increment `attemptCount` exactly once per provider call;
- reuse a stable message-derived provider idempotency key when the provider supports it;
- persist provider id/status/timestamps or a coarse sanitized error;
- schedule at most **three total attempts** (initial attempt plus two retries), with fixed bounded delays of **1 minute then 5 minutes**;
- mark terminal `FAILED` after attempt three or a non-retryable validation/provider rejection;
- never create another message, notification, AuditLog, first-response stamp, or message-created realtime event during retry;
- preserve the existing immediate `201` delivery projection based on the post-commit initial attempt, while detail APIs subsequently project durable delivery status.

Add a bounded `GET` or `POST /api/internal/outbound-delivery-retry` endpoint protected by existing `CRON_SECRET` middleware and modeled after the SLA/inactivity sweep. Process a deterministic limited batch; an overlapping invocation must safely skip leased rows. The exact scheduler registration/deployment remains operational configuration, not an in-process timer.

Provider callbacks must use raw-body signature verification and provider-specific schemas. Implement only callbacks the current provider/account contract actually supports; deduplicate repeated callbacks and enforce monotonic transitions (for example, a stale “sent” callback cannot downgrade `DELIVERED`). Unknown provider ids return a safe acknowledged/no-op result where retry behavior requires it.

### Attachment send contract

For this SDD scope, external attachment transmission is **not enabled** until a provider-specific send implementation and tests exist. Therefore:

- WEB/Portal and Live Chat may create locally visible message-owned attachments.
- Internal notes may create note-owned attachments and remain internal-only.
- EMAIL/SMS/WhatsApp outbound requests containing attachments are rejected before `TicketMessage` creation with a channel-capability error; no text-only downgrade occurs.
- Existing Email inbound attachment ingestion remains supported and binds files to the inbound message.
- Existing ticket-level/customer-level files remain available as legacy/general attachments but cannot be selected as outbound conversation attachments.

Use staged attachment ids owned by the authenticated actor/session. Validate ownership, ticket, virus/type/size policy already available, and target-channel capability before the message transaction; atomically consume/bind the staged rows with the message/note. Do not upload provider bytes inside the database transaction.

### Confirmed defect corrections

- Email inbound `emitTicketMessageCreated` must pass the correlated/created ticket's `teamId`.
- WhatsApp inbound must pass `teamId` on the same event.
- SMS must treat only the named inbound-key constraint as duplicate; placeholder-email and every unrelated `P2002` follow their own resolution/error path.
- Live Chat create/resume must use the unique session key and conflict re-read described above.

## API and DTO Changes

- Conversation items expose `contentFormat`; public message items additionally expose durable delivery summary to authorized internal users. Portal may receive only customer-safe status wording for its own/support messages if product UI needs it; never expose provider errors or ids.
- Staff message/note creation accepts declared staged attachment ids. Unknown fields remain rejected. The server derives content source and does not accept arbitrary provenance, actor, channel, delivery status, or provider id from clients.
- Live Chat start accepts a bounded opaque `sessionKey` plus `departmentId` only for a create. Resume ignores rerouting input and requires the same session key.
- Provider webhook success responses add an explicit safe ambiguity outcome where necessary. They do not echo phone/email, candidate customer ids, or raw payloads.
- Add the CRON-secret retry endpoint and only provider callback endpoints that are supported during implementation.
- Update `docs/05-api-contract.md`, channel integration docs, `docs/07-ticket-workflow.md`, `docs/08-sla-automation.md`, `docs/22-realtime-events.md`, and the applicable ADRs when production behavior changes. ADR-052 remains the commit-first authority and should be amended, not reversed.

## Frontend Changes

- Replace markup sniffing in `MessageBody` with `contentFormat` branching. Plain content renders escaped with preserved whitespace; rich content uses the existing DOMPurify defense-in-depth path.
- Extend conversation types/API mappings for format and authorized delivery summary. Render durable per-message delivery state after reload, with EN/AR text for pending, sending, sent, delivered, failed, and retry-exhausted states. Provider ids/errors remain hidden.
- Change composer attachment flow from ambiguous ticket upload to staged items submitted with the exact message/note. Disable/hide attachment selection for EMAIL/SMS/WhatsApp in this scope and surface the server capability error if a stale client attempts it.
- Give the Live Chat widget an opaque session key persisted only for that browser session/conversation lifecycle. Starting a new session rotates the key; resume uses the existing key; customer identity alone does not attach an older active ticket.
- Preserve current TanStack Query invalidations, draft retention, auto-scroll, RTL behavior, and no-optimistic-message rule. A retry/callback delivery update should invalidate the ticket detail through the existing `ticket.updated` event rather than adding a new event type.

## Realtime and Notification Implications

- Do not add an SSE event type. `ticket.message.created` remains the signal for a newly committed message; `ticket.updated` invalidates durable delivery-state changes when useful.
- Every message event assembles `ticketId`, `messageId`, `assignedAgentId`, `customerId`, `teamId`, and visibility from the committed ticket/message. Add regression coverage for routed Email and WhatsApp tickets.
- Retries and callback duplicates never emit `ticket.message.created`. A real delivery-state change may emit one post-commit `ticket.updated`; unchanged callbacks emit nothing.
- Preserve current customer/internal audience separation and narrow notification recipient resolver. Retry attempts and callbacks create no customer-reply notifications.

## Security, Privacy, and Error Handling

- Continue verifying provider signatures over exact raw bytes before parsing; delivery callbacks receive the same treatment.
- Never log message bodies, contact values, credentials, provider payloads, or ambiguous customer candidates. Log a generated correlation id, provider/channel, normalized-value hash if operationally necessary, and match count.
- Ambiguous phone resolution performs no automatic customer/ticket/message association. Return/acknowledge according to provider retry semantics while recording a safe operator-visible error; do not turn ambiguity into endless provider retries.
- Persist only coarse delivery error codes and bounded sanitized text. Never expose provider error bodies or delivery ids to Portal clients.
- Attachment authorization occurs before reading/uploading bytes where the route permits it, and staged ownership is rechecked inside the bind transaction.
- Maintain IDOR-safe `404` behavior and existing role/team/assignment checks. No frontend permission check is authoritative.

## Testing Strategy

### Schema and migration

- Prisma/schema tests pin content enums/required fields, unique inbound key, one-to-one delivery, provider-id lookup index, attachment note relation, retry index/lease, and unique Live Chat session key.
- Migration tests run against a representative pre-change database and verify conservative content backfill, no deleted rows, no false delivery history, and explicit reports for ambiguous inbound-key backfills.

### Cross-channel contract matrix

Create parameterized service/API coverage for WEB/Portal, Email, SMS, WhatsApp, and Live Chat asserting:

- explicit/reliable correlation precedence and absence of latest-customer-ticket fallback;
- WAITING customer reply transition;
- RESOLVED reopen only for explicit Portal and reliably correlated Email;
- SMS/WhatsApp heuristic input and new Live Chat sessions create fresh tickets;
- every CLOSED mutation is rejected/no-op as appropriate with no writes/provider calls/events;
- exactly one creation history and exactly one canonical `TICKET_CREATED` AuditLog with correct null/staff actor;
- first response stamps for ADMIN/MANAGER/AGENT public replies only and remains unchanged for notes, providers, system events, and later replies.

### Delivery and idempotency

- Initial provider attempt occurs only after message/delivery commit.
- Success, retryable failure, non-retryable failure, retry exhaustion, timeout, missing config/recipient, provider id persistence, and callback transitions update one delivery row.
- Three-attempt cap and 1m/5m scheduling are deterministic; overlapping workers claim once; retries never duplicate messages, first-response stamps, notifications, audits, or message-created events.
- Duplicate inbound webhook races hit the DB unique key and repeat no side effects.
- Constraint-target tests prove Email/SMS/WhatsApp ignore only the inbound idempotency conflict; unrelated `P2002` is never returned as `DUPLICATE`.
- Callback signature, duplicate, unknown-id, out-of-order, and terminal-state tests preserve monotonic delivery state.

### Realtime audiences

- Routed Email and WhatsApp inbound events include `teamId` and reach only ADMIN, owning-team MANAGER, eligible own-team AGENT/customer audiences under the existing rules.
- Internal notes remain excluded from Portal; duplicate webhook/retry/callback no-ops emit nothing; delivery changes use `ticket.updated` only.

### Content, attachments, and identity

- Literal `<a>`/`<strong>` from SMS, WhatsApp, and plain Email remains visible literal text in internal and Portal rendering.
- Rich content is sanitized before persistence; format metadata drives rendering; legacy/unknown rows backfilled as plain cannot activate markup.
- Canonical 20,000 semantic and 50,000 serialized bounds plus Live Chat 2,000 bound are enforced server-side across entry points.
- Each new conversation attachment has exactly one message/note owner; cross-user/ticket binding fails; failed message validation does not misbind files.
- EMAIL/SMS/WhatsApp attachment attempts reject before message creation and provider invocation; no text-only fallback. Email inbound attachments remain message-owned.
- Phone resolution covers zero/one/multiple matches, legacy forms collapsing to the same canonical number, safe ambiguity logging/outcome, and absence of ticket/message/customer side effects on ambiguity.

### Live Chat concurrency

- Two truly concurrent start requests with the same session key produce one ticket/audit/history/assignment/event and both return that ticket.
- Different session keys for the same customer create different tickets.
- RESOLVED/CLOSED keys do not resume; a new key creates a new ticket; CLOSED itself remains unchanged.

### Frontend

- Delivery state survives detail refetch/reload; localized status/error rendering does not expose provider detail.
- Content format selects text versus rich rendering; draft, auto-scroll, mode, and query invalidation behavior remain intact.
- Channel attachment controls/capability failures and Live Chat session-key rotation/resume work in EN/AR and RTL.

Provider-network contract tests remain mocked. Live provider callbacks/delivery, deployed cron overlap, Blob round trips, and browser cross-channel QA are manual/deployment verification gates and must not be claimed from unit tests.

## Major Implementation Phases

1. **Persistence foundation:** additive Prisma schema/migration, conservative backfill, content metadata, inbound idempotency key, delivery state, attachment note ownership, and Live Chat session key.
2. **Shared domain seams:** canonical content validator, ticket-creation audit helper, phone resolution, correlation/idempotency helpers, and channel-neutral delivery state machine.
3. **Inbound hardening:** update Email/SMS/WhatsApp pipelines, remove identity-only ticket selection, handle ambiguity, fix constraint-specific dedupe and missing realtime `teamId`.
4. **Outbound durability:** create delivery rows transactionally, perform post-commit initial attempts, add bounded leased retry sweep, provider callback support where verified, and durable DTO projection.
5. **Attachments and Live Chat:** bind staged uploads to exact messages/notes, enforce channel capabilities before creation, and make session-key start concurrency-safe.
6. **Frontend and contracts:** format-driven rendering, durable delivery UI, staged attachment UX, Live Chat session identity, localization, and API/domain/ADR reconciliation.
7. **Verification:** migration rehearsal, cross-channel invariant matrix, concurrency tests, package typecheck/lint/tests/build, safe database checks, and manual browser/provider gates where credentials/infrastructure permit.

These are implementation phases, not `tasks.md` entries. The next SDD step should decompose them into independently verifiable task IDs.

## Risks and Mitigations

- **Historical provenance is ambiguous:** default uncertain rows to plain text; never infer rich HTML from markup shape.
- **Retry double-send:** use a DB claim lease, stable message idempotency key where supported, bounded attempts, and unique message-to-delivery relation. A provider without idempotency can still accept a send before a lost response; document this irreducible transport risk.
- **Backfill identifier ambiguity:** backfill only conclusive inbound/delivery identities and report exceptions; never delete/merge rows to make an index pass.
- **Attachment staging orphan risk:** expire/delete unbound staged objects through a bounded existing-style maintenance flow or documented operator cleanup; do not create a general media pipeline.
- **Webhook retry storms on ambiguity:** return a provider-appropriate acknowledged ambiguity outcome after safe logging/operator surfacing, because redelivery cannot resolve duplicate customer data.
- **Serverless scheduler overlap:** lease claims and deterministic bounded batches make overlap safe; retries remain eventually scheduled by external infrastructure.
- **Scope creep through shared helpers:** extract only rules shared by confirmed paths; leave wire-level provider behavior inside each integration.

## Explicitly Deferred

- `tasks.md` and all production implementation in this planning pass.
- Ordinary internal/Portal message request idempotency keys; only provider inbound and Live Chat session creation receive new end-to-end idempotency guarantees here.
- Outbound external attachment transmission for Email, SMS, or WhatsApp. This scope rejects those combinations; enabling one later requires a provider-specific spec/tested capability.
- WhatsApp media/templates/reactions/interactive messages; SMS MMS; Email features beyond the existing inbound attachment flow.
- Read receipts, typing, presence, agent availability, chat transfer, and WebSockets.
- Manual resend UI, unbounded retry, generic job queues, Redis/Kafka, and a general integration outbox.
- Customer merge/deduplication, canonical unique-phone enforcement, or automatic repair of ambiguous customer records.
- Delivery callbacks for providers that do not expose a verified supported contract in the current integration.
- Realtime transport replacement/replay and production hosting changes.
- Live-provider, production scheduler, and deployed SSE certification without credentials/infrastructure.

## Readiness for Tasks

This plan was decomposed into `tasks.md` (`CONV-001`–`CONV-057`), which is complete and verified. See `tasks.md` for the execution/verification record, including the one disclosed deferred item (Portal composer attach-file UI).
