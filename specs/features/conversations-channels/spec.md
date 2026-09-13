# Conversations / Channels

## Feature Status

**Status: `SPECIFICATION APPROVED — PRODUCT DECISIONS RESOLVED; READY FOR IMPLEMENTATION PLANNING`.**

This specification records the current implementation on `chore/sdd-foundation` and the approved target behavior for the Conversations / Channels hardening pass. The implementation is functional across WEB/Portal, EMAIL, SMS, WhatsApp, and LIVE_CHAT; the nine product decisions discovered during brownfield analysis are now resolved below. Production code and schema changes belong to the later implementation phase, not this specification update.

Repository evidence is authoritative where older documentation differs. In particular, ADR-052 and the current code supersede the pre-ADR-052 rollback descriptions in ADR-044 and `docs/21-email-integration.md`.

---

## Purpose and Scope

Conversations / Channels is the cross-feature boundary that turns every customer/staff exchange into the existing Ticket domain rather than a separate inbox per provider. It owns this specification of:

- the canonical public-message/internal-note model;
- conversation mutation semantics and visibility;
- inbound provider authentication, normalization, identity resolution, ticket matching, deduplication, status changes, notifications, and realtime signals;
- outbound reply persistence, provider delivery, immediate delivery result, and failure history;
- message-related attachment and rich-text boundaries;
- frontend conversation/query/cache behavior.

It depends on Tickets for lifecycle, visibility, ownership, SLA timestamps, and CLOSED immutability; Customers for durable contact identity; Attachments for secure object handling; Notifications for persisted internal alerts; Realtime for best-effort invalidation; Quick Replies/AI for draft insertion only; and provider adapters for transport-specific I/O.

Out of scope: adding provider accounts, live provider verification, campaigns/broadcasts, a second conversation store, WebSockets/presence/typing, arbitrary cross-channel identity merging, and general messaging infrastructure unrelated to Tickets. Provider callbacks are included only where an already-supported provider exposes a usable delivery callback; read receipts and unsupported callback types remain deferred. `tasks.md` and production implementation remain later lifecycle phases.

---

## Current Architecture Summary

```text
Internal CRM / Customer Portal / Live Chat widget / provider webhook
                              |
                              v
                    existing Ticket identity
                              |
              +---------------+----------------+
              |                                |
      TicketMessage (public)            TicketNote (internal)
              |                                |
     Portal-visible, provider-           staff-only, mentions,
     deliverable by ticket channel       watchers, never delivered
              |
     TicketHistory / Notification / post-commit SSE invalidation
```

- `Ticket` is the conversation aggregate. `channel` is fixed at creation and is one of `WEB`, `EMAIL`, `WHATSAPP`, `SMS`, or `LIVE_CHAT`.
- `TicketMessage` is the only public conversation row. It requires one `authorUserId`; provider-originated messages use channel-specific inactive `CUSTOMER` system users because external senders usually have no login.
- `TicketNote` is a separate internal-only row. The internal detail service reads both tables and returns one deterministic discriminated `conversation`; Portal reads only `messages` and never selects notes.
- Staff public replies use one internal endpoint and one composer. The ticket's channel decides whether a post-commit provider adapter is called.
- LIVE_CHAT is not a second messaging subsystem: it is a routed `LIVE_CHAT` Ticket whose customer messages use the normal Portal reply endpoint and whose staff messages use the normal internal reply endpoint.
- REST/webhooks remain the write paths and PostgreSQL/REST remain authoritative. SSE carries IDs only and tells TanStack Query which data to refetch.

### Canonical persisted models

| Model | Current role | Important constraints |
| --- | --- | --- |
| `TicketMessage` | Customer-visible public message | required `ticketId`, required `authorUserId`, `body`, `createdAt`; nullable unique `externalId` and `externalMessageId`; may have attachments |
| `TicketNote` | Staff-only ticket note | required ticket/author/body; no provider identifiers or attachments; supports `TicketMention` |
| `TicketHistory` | Per-ticket operational/lifecycle trail | status/assignment/category/etc. plus `<CHANNEL>_DELIVERY_FAILED`; no message body and no direct message foreign key |
| `AuditLog` | Administrative/security trail | conversation bodies are intentionally excluded; inbound Customer creation and selected Live Chat lifecycle mutations are audited |
| `Attachment` | Private file metadata | exactly one logical ticket/message/customer context is service-enforced; `storageKey` and nullable provider `externalId` are unique |
| `Notification` | Internal in-app alert | user-scoped, optionally ticket-linked; no customer notification center or external delivery |

There is no persisted Conversation, DeliveryAttempt, DeliveryStatus, provider-event, or outbox table. Provider status after the synchronous response is not modeled.

---

## Public Message vs Internal Note

### Public reply

- Internal route: `POST /api/tickets/:id/messages`, available only to authenticated `ADMIN`, `MANAGER`, and `AGENT` through the ticket router.
- Portal route: `POST /api/portal/tickets/:id/messages`, available only to the owning linked `CUSTOMER` through the Portal router.
- Stored in `TicketMessage`; returned to Portal; emits `ticket.message.created` with `visibility: "public"` after commit.
- A staff public reply stamps `firstRespondedAt` once with the server-generated message time. The code applies this to any allowed internal actor (`ADMIN`, `MANAGER`, or `AGENT`), although several docs say “agent reply.”
- A staff public reply may trigger EMAIL/SMS/WhatsApp delivery based on immutable `Ticket.channel`. WEB and LIVE_CHAT have no external provider send.
- A customer public reply may change ticket status as described below and creates `CUSTOMER_REPLY` notifications.

### Internal note

- Route: `POST /api/tickets/:id/notes`; internal roles only.
- Stored separately in `TicketNote`, returned only in the internal discriminated conversation, and emits `ticket.message.created` with `visibility: "internal"` after commit.
- Never delivered to Email/SMS/WhatsApp, never returned by Portal detail, never sets `firstRespondedAt`, and is never accepted from a provider webhook.
- Supports `@[Name](userId)` mentions. Mention parsing creates `TicketMention`, auto-watch state, and mention notifications in the same transaction; generic watcher notification excludes mentioned users to avoid duplicate alerts.
- Notes are append-only: no edit/delete route exists.

### Ordering and presentation

- Internal detail merges public messages and notes, sorting by `createdAt`, then `kind`, then `id`.
- Portal sorts public messages by `createdAt`, then `id` and maps authors to `CUSTOMER` or `SUPPORT` without exposing staff roles.
- Internal UI shows customer messages at logical start and staff/notes at logical end; notes use a distinct internal tone and label. Portal and Live Chat use viewer-relative bubbles (customer at end, support at start).

---

## Authorization and Mutation Rules

| Capability | ADMIN | MANAGER | AGENT | CUSTOMER |
| --- | --- | --- | --- | --- |
| Read internal merged conversation | Any ticket in internal scope | Own-team ticket | Own-assigned or own-team unassigned ticket | Never |
| Add staff public reply | Any visible non-CLOSED ticket | Any visible own-team non-CLOSED ticket | Only a non-CLOSED ticket assigned to self | Never via internal route |
| Add internal note | Same as staff reply | Same as staff reply | Same as staff reply | Never |
| Read public Portal conversation | Never via Portal API | Never via Portal API | Never via Portal API | Own ticket only |
| Add Portal/Live Chat customer reply | No | No | No | Own non-CLOSED ticket |
| Attach to own public message | Yes, own message only | Yes, own message only | Own message on assigned ticket | No message-level Portal upload route |

Server-side queries and route middleware are authoritative. Frontend controls are convenience only. Hidden/foreign internal tickets return `404 TICKET_NOT_FOUND`; non-owned Portal tickets also return the same IDOR-safe 404.

### CLOSED immutability inherited from Tickets SDD

`CLOSED` is viewable but fully immutable. Staff public reply, internal note, ticket/message upload, Portal reply, Portal upload, metadata/workflow/routing updates, and agent self-claim reject with `409 TICKET_CLOSED`. There is no Admin override. Reads, attachment listing/download, conversation, history, and SLA remain available.

External inbound channels do not append to CLOSED tickets: Email discards a CLOSED correlation and creates a new EMAIL ticket; SMS/WhatsApp active-ticket lookup excludes CLOSED; Live Chat treats CLOSED as non-resumable and a new start creates a new chat. This is not a mutation of the closed ticket.

### RESOLVED and customer-reply behavior

Current behavior is intentionally not uniform:

| Path | RESOLVED behavior | CLOSED behavior |
| --- | --- | --- |
| Portal / WEB customer reply | Reuse ticket; `RESOLVED -> OPEN`; clear `resolvedAt`; retain `resolutionDueAt` | `409 TICKET_CLOSED` |
| Inbound EMAIL | Correlation may reuse ticket; `RESOLVED -> OPEN`; clear `resolvedAt`; retain deadline | Start new EMAIL ticket |
| Inbound SMS | Active lookup excludes RESOLVED; start new SMS ticket | Start new SMS ticket |
| Inbound WhatsApp | Active lookup excludes RESOLVED; start new WhatsApp ticket | Start new WhatsApp ticket |
| LIVE_CHAT | Resolved chat is terminal/non-resumable; customer starts a fresh chat | Closed chat is terminal/non-resumable; customer starts a fresh chat |
| Staff reply/note | Allowed; does not reopen or change status | Rejected |

All inbound/customer paths bump `WAITING_CUSTOMER -> IN_PROGRESS` when reusing the ticket. Other active statuses do not transition automatically. The channel differences above are already documented as product behavior; discovery does not normalize them.

---

## Channel-by-Channel Current Behavior

### WEB / Customer Portal

- Internal proactive WEB creation accepts an existing `customerId`; Portal creation derives the linked Customer from JWT identity and forces `OPEN`, `MEDIUM`, `WEB`, unassigned, unrouted, and normal SLA snapshots.
- Portal public replies use the same rich Lexical editor and server sanitizer as staff, are authored by the actual authenticated customer User, and never trigger external provider delivery.
- Portal detail exposes only safe public message author shape, category/description/timestamps/status, attachments, and feedback. It excludes notes, assignment, team/org data, history, watchers, SLA, internal priority on detail, and provider identifiers.
- Portal upload is ticket-level only; upload alone does not create a message or reopen a ticket.

### EMAIL

- Inbound endpoint verifies Resend/Svix headers against the exact raw body, then retrieves message content/headers/attachments from the Receiving API.
- Sender email is normalized and matched case-insensitively; otherwise a Customer is created and audited.
- Ticket correlation order is same-Customer RFC `In-Reply-To`/`References`, unique reply-address token, unique same-Customer public reference, exactly one active EMAIL ticket, else new ticket. A matched CLOSED ticket is replaced by a new ticket; RESOLVED is reused and reopened.
- Plain text is preferred. Inbound HTML is sanitized and flattened to plain text. Message body is clipped to 20,000 characters.
- Provider email id and RFC Message-ID populate unique message fields. Valid inbound attachments are retrieved and stored as message-level attachments.
- Staff outbound Email sends sanitized HTML plus a plain-text projection, uses a message-derived provider idempotency key, reply-token address, and references, after the local commit.

### SMS

- Inbound TextBee webhook requires HMAC-SHA256 `X-Signature` over the raw body and a strict `MESSAGE_RECEIVED` payload.
- Phone is normalized; Customer matching checks normalized, digits-only, and raw forms ordered newest first. No match creates a placeholder-email Customer and audit row.
- Newest active SMS ticket is reused; terminal tickets cause a new `OPEN`/`MEDIUM`/unrouted ticket. SMS is text-only.
- `smsId` is the unique inbound `externalId`; accepted outbound `smsBatchId`, when present, becomes the message `externalId`.
- Outbound provider accepts plain text and has a 20-second network bound. Acceptance means queued by the Android gateway, not carrier delivery.

### WHATSAPP

- Meta webhook verification uses verify-token handshake plus raw-body `X-Hub-Signature-256`; only inbound text messages are processed.
- Phone matching follows normalized/digits/raw variants. Multiple matches select the most recently updated Customer and log a warning; no match creates a placeholder-email Customer and audit row. Unlike SMS, the create path also checks the deterministic placeholder email before insert.
- Newest active WhatsApp ticket is reused; terminal tickets cause a new one. `wamid` is the inbound unique `externalId`.
- Outbound sends a plain-text projection after commit. The provider message id is best-effort persisted to `externalId`.
- Media, templates, reactions, read/delivery callbacks, and interactive messages are not implemented.

### LIVE_CHAT

- Customer starts/resumes from the Portal support widget. A resumable chat is the newest own `LIVE_CHAT` ticket in an active status.
- New chat requires a customer-selected active Department with an active Team. Server deterministically chooses the oldest active Team, sets Department/Branch/Team on the first row, and runs canonical team-scoped auto-assignment.
- Messages use the normal Portal/internal public-message endpoints; there is no chat-specific message model or delivery adapter.
- Customer end moves an active chat to `RESOLVED`, writes history plus AuditLog, emits `ticket.updated`, and is concurrency-safe/idempotent. CLOSED returns 409.
- The externally-triggered inactivity sweep resolves an answered chat after the configured inactivity window; unanswered chats are excluded. No typing, presence, or read receipts exist.
- The compact widget composer is plain text limited to 2,000 characters and wraps escaped text in a paragraph before using the rich Portal reply endpoint. This is intentionally narrower than the full Portal ticket composer.

---

## Inbound Message Pipeline

### Common shape

1. Machine endpoint authenticates the provider payload over raw request bytes.
2. Adapter parses and bounds the supported message type.
3. Provider message id is checked for duplication.
4. Sender resolves to an existing Customer or creates a placeholder-backed Customer.
5. A channel-scoped ticket is matched or created.
6. A channel-specific inactive CUSTOMER User authors the public `TicketMessage`.
7. Reused `WAITING_CUSTOMER` transitions to `IN_PROGRESS`; channel-specific RESOLVED rules apply.
8. Customer-reply notifications are persisted in the transaction.
9. `ticket.message.created` is emitted through the realtime outbox only after commit.

### Deduplication and idempotency

- Email: `externalId = resend:<emailId>` is checked before provider retrieval and again in the transaction; `externalMessageId` stores RFC Message-ID; attachment ids use unique `resend:<emailId>:<attachmentId>`. Any Prisma `P2002` in the transaction is currently returned as `DUPLICATE`.
- SMS: `externalId = smsId`; pre-check plus a broad transaction-level `P2002 -> DUPLICATE` catch.
- WhatsApp: `externalId = wamid`; pre-check and message-create `P2002 -> DUPLICATE` handling.
- Live Chat/Portal: authenticated user mutation has no request idempotency key. A repeated submit creates another message; the UI only blocks duplicates while its mutation is pending.
- Ticket creation via internal or Portal APIs has no idempotency key. Live Chat start has a read-before-create resume check but no DB uniqueness constraint guaranteeing one active chat under a true concurrent race.

### Sender/customer resolution

- Portal/Live Chat: `User -> Customer.userId`; no client Customer id is accepted.
- Email: normalized sender email, case-insensitive match. The database now enforces case-insensitive Customer email uniqueness through a functional index.
- SMS/WhatsApp: phone match across normalized E.164, digits-only, and raw legacy representations; when multiple rows match, newest wins (SMS silently, WhatsApp with a warning). Neither channel links the provider sender to a Portal User.
- A valid provider signature authenticates the webhook source, not independent ownership of the asserted sender address/phone. This is the accepted external trust boundary from the Tickets SDD.

### Ticket creation vs reply matching

- Email uses explicit thread evidence first and deliberately refuses the fallback when more than one active EMAIL ticket exists.
- SMS/WhatsApp always choose the newest active same-channel ticket for the Customer.
- Live Chat resumes the newest active chat regardless of a new Department selection; Portal normal reply targets an explicit owned ticket id.
- New provider tickets are `OPEN`, `MEDIUM`, receive SLA snapshots, and are unrouted/unassigned (`teamId = null`) except Live Chat, which is synchronously routed and eligible for auto-assignment.
- Inbound/Portal/Live Chat ticket creation always writes `TicketHistory TICKET_CREATED`; inbound Email/SMS/WhatsApp Customer creation writes `AuditLog CUSTOMER_CREATED`. Provider/Portal ticket creation itself is not consistently audited.

---

## Outbound Message Pipeline and Failure Semantics

### Commit-first contract

For a staff public reply, the server first validates access/CLOSED state and sanitizes the body, then commits `TicketMessage`, one-time `firstRespondedAt`, watcher notifications, and Email thread bookkeeping in one transaction. Its realtime event flushes after that commit. Only then does the server call WhatsApp, Email, or SMS.

Provider/configuration failure never rolls back the reply. HTTP remains `201`; provider channels return an immediate `delivery` object:

```ts
{
  channel: "EMAIL" | "SMS" | "WHATSAPP";
  status: "SENT" | "FAILED";
  externalId?: string;
  reason?: "INTEGRATION_NOT_CONFIGURED" | "NO_RECIPIENT_PHONE" |
           "NO_RECIPIENT_EMAIL" | "RECIPIENT_INVALID" |
           "PROVIDER_REJECTED" | "PROVIDER_UNREACHABLE";
}
```

Failure writes a best-effort `<CHANNEL>_DELIVERY_FAILED` TicketHistory row with a coarse reason. Success best-effort updates `TicketMessage.externalId`. Failure to persist the provider id or failure-history row is logged and does not change the 201 response.

### Provider error mapping

| Condition | Shared result |
| --- | --- |
| Missing provider config | `FAILED / INTEGRATION_NOT_CONFIGURED` |
| Missing phone/email | `FAILED / NO_RECIPIENT_PHONE` or `NO_RECIPIENT_EMAIL` |
| Invalid Email recipient | `FAILED / RECIPIENT_INVALID` |
| Provider answered and rejected | `FAILED / PROVIDER_REJECTED` |
| Timeout/network/unmapped throw | `FAILED / PROVIDER_UNREACHABLE` |

Email and SMS use the shared mapping/helper. WhatsApp keeps equivalent local types and failure-history helper, so the policy is aligned but implementation is duplicated. Email and SMS have explicit 20-second bounds; WhatsApp relies on its client behavior and does not expose the same explicit bound in the conversation service.

### Persisted/returned delivery state

- Returned: immediate synchronous result only, on the create-message response.
- Persisted success evidence: nullable `TicketMessage.externalId`; absence is ambiguous because providers may return no id and a successful post-send metadata update may fail.
- Persisted failure evidence: ticket-level history action/reason, not linked to a message id.
- Not persisted: canonical per-message status, attempts, timestamps, provider response category, retry count, carrier delivery/read state.
- Reloaded `GET /tickets/:id` conversation does not return delivery status. The UI warning exists only for the mutation response; history can show a provider failure but cannot reliably associate it with one message.
- No automatic retry, queue, webhook reconciliation, or manual resend action exists.

---

## Notifications, Realtime, and History

### Notification fan-out

Customer replies across Portal, Email, SMS, and WhatsApp call the same `customerReplyNotificationRecipientIds` rule:

- active assigned agent;
- active manager of `Ticket.teamId` only;
- explicit ticket watchers;
- exclude the replying Portal user when supplied;
- if the set is empty, fall back to all active Admins (typical new unrouted/unassigned/unwatched provider ticket).

Recipients are deduplicated. `CUSTOMER_REPLY` rows are committed with the message. Customers never receive `notification.*` and have no notification center. Staff public replies notify watchers via `TICKET_WATCH_ACTIVITY`; internal notes notify mentioned users and remaining watchers. Outbound delivery failures create history only, not notifications.

### Realtime event and audience rules

- Public message/note: `ticket.message.created { ticketId, messageId, visibility }`.
- Lifecycle/routing/Live Chat create/end: `ticket.updated { ticketId }`.
- Notification creation/read: user-scoped invalidation events.
- Wire frames contain IDs and visibility only; audience metadata is server-side.
- ADMIN receives all ticket events; MANAGER own-team only; AGENT own-assigned or own-team unassigned only; CUSTOMER own-ticket public events only.
- Events are best-effort/in-memory. There is no durable replay despite `Last-Event-ID`; reconnect/focus REST refetch is the recovery mechanism.

Current inconsistency: internal replies, notes, Portal, SMS, and Live Chat pass `teamId` to event audience metadata. Inbound Email and WhatsApp omit it, so the emitter defaults `teamId` to null. For an existing routed ticket this suppresses the message event from its own-team Manager and Agent subscribers (Admin and owning Portal Customer can still receive it). This is an implementation bug, not intentional channel behavior.

### Audit/history consistency

- Conversation bodies are intentionally absent from `AuditLog`.
- TicketHistory carries creation/status transitions and delivery failure markers. It does not contain a row for every message/note; the conversation tables are the durable message history.
- Inbound Email/SMS/WhatsApp Customer creation is audited; match/reuse is not.
- Portal/Email/SMS/WhatsApp ticket creation writes creation history but no ticket-creation AuditLog. Internal ticket creation does both. Live Chat start writes history but no AuditLog; explicit/end/inactivity resolution writes AuditLog.
- Whether non-internal ticket creation should share the internal ticket audit policy remains an unresolved product decision rather than an automatic normalization.

---

## Attachments

### Current restrictions

- One multipart file named `file`; no text fields; maximum 4 MiB.
- Content-derived allowlist: JPEG, PNG, WebP, PDF, safe UTF-8 plain text. Client MIME, extension, filename, and context fields are not trusted.
- Private object storage behind the attachment adapter; downloads are authorized and proxied with `nosniff`/private no-store behavior.
- Internal ticket/message upload follows ticket visibility, assigned-Agent restriction, CLOSED guard, and (for message-level upload) author ownership.
- Portal may upload only to an owned non-CLOSED ticket. Portal has no message-level upload route.
- SMS UI disables attachments. WhatsApp and Email UI do not disable ticket-level upload, but outbound provider delivery sends no file. Current Email inbound supports message-level files; inbound SMS/WhatsApp are text-only; Live Chat widget has no attachment control.
- The shared composer’s Attach action uploads a ticket-level file independently; it is not part of the message POST and is not bound to or transmitted with the next reply. Outbound Email explicitly documents attachment sending as future work.
- No deletion, malware scanning, uploader identity, persisted byte size, multi-file upload, or resumable upload.

### Visibility

Internal ticket attachment queries return ticket- and public-message-level files. Notes cannot own attachments. Portal returns a narrower projection and can see owned ticket/message files, including inbound Email files, but never customer-profile attachments or storage/provider keys.

---

## Sanitization and Rich-Text Boundaries

- Internal public replies, internal notes, and Portal replies accept Lexical HTML and are sanitized server-side.
- Allowed reply tags: `b`, `strong`, `i`, `em`, `u`, `p`, `br`, `ul`, `ol`, `li`, `a`; links allow only `http`, `https`, `mailto` and are forced to safe `rel`/`target`. Scripts/styles/classes/ids/handlers/media/iframes/data URIs are discarded. Empty after sanitization returns `422 EMPTY_MESSAGE`.
- Internal request schema allows 50,000 serialized characters for markup headroom while the editor enforces 20,000 plain-text characters. Portal reply schema permits 20,000 serialized characters, making its effective rich-text headroom smaller. Live Chat widget enforces 2,000 plain-text characters.
- Provider outbound consumers receive plain text except Email, which receives both sanitized HTML and plain text.
- Email inbound HTML is sanitized then flattened. SMS/WhatsApp inbound text is stored as plain provider text.
- Shared `MessageBody` re-sanitizes on render and chooses HTML rendering by detecting an allowlisted tag in the body, not by trusted provenance/format metadata. Therefore an SMS/WhatsApp customer can type literal allowed markup and have it interpreted as rich HTML in internal/Portal rendering. DOMPurify prevents script execution, but the representation boundary is ambiguous and can turn literal customer content into links/formatting.
- Historical plain-text rows render with preserved whitespace. Mention tokens in internal notes are converted to safe, non-link chips after sanitization.

---

## Approved Target Behavior

The following requirements resolve OD-CC-1 through OD-CC-9. They supersede the corresponding current-state behavior above where the two differ.

### Durable outbound delivery

- Commit-first remains the canonical rule: the public `TicketMessage` and its transactional CRM side effects commit before any provider call.
- Every outbound EMAIL, SMS, or WHATSAPP public message has one durable delivery record linked to that message. It records at minimum status, provider message id when available, attempt count, last non-secret error, creation/update time, and attempt/sent/delivered/failed timestamps as applicable.
- The first provider attempt may still run immediately after commit. A provider failure changes durable delivery state; it never deletes or rolls back the message.
- Retries operate on the existing delivery/message identity, are bounded, and never create another `TicketMessage`. Concurrent retry/initial-send workers must not perform an unbounded or duplicate state transition.
- Supported provider callbacks update the same delivery record by provider/message identity. Unknown, stale, or duplicate callbacks are safe no-ops; callback support is provider-capability-specific.
- TicketHistory may retain a customer-support-facing failure signal, but the linked delivery record is authoritative for per-message delivery state. Internal retry attempts do not create AuditLog noise.

### Attachments

- A conversation attachment belongs to the exact `TicketMessage` or `TicketNote` for which it was created; a composer upload must not remain an ambiguous ticket-level file.
- Message/note creation and attachment binding must be coordinated so a failed or rejected send does not leave a file presented as belonging to another reply.
- External transmission is allowed only for a channel/provider flow explicitly implemented and validated for the attachment's supported size/type. If the selected outbound channel cannot transmit the requested attachments, the request is rejected before the outbound public message is created.
- Unsupported attachment delivery is never silently reduced to text-only delivery. Existing non-conversation customer/ticket files may remain in their current contexts but are not treated as outbound-message attachments.

### Ticket matching and RESOLVED behavior

- Matching precedence is: (1) explicit ticket/session correlation, (2) reliable provider thread/message correlation, then (3) create a new ticket.
- Identity-only matching, including “latest ticket for this customer,” is forbidden for inbound provider routing.
- Portal replies target an explicit owned ticket and may reopen that ticket from `RESOLVED` to `OPEN`, clearing `resolvedAt` while retaining `resolutionDueAt` and all first-response fields.
- EMAIL may reopen a RESOLVED ticket only when reliable thread/message/ticket correlation identifies it. Sender identity alone is insufficient.
- SMS and WhatsApp never reopen RESOLVED from phone/customer heuristics; absent reliable correlation, they create a new ticket.
- Every new Live Chat session creates a fresh ticket. Session correlation may resume only the same active session; it never selects a different ticket by customer identity. RESOLVED and CLOSED sessions are terminal.
- `CLOSED` remains fully immutable. A correlated inbound message must never append to or reopen a CLOSED ticket; a new external conversation may create a new ticket where the channel entry flow permits it.

### Idempotency, concurrency, and identity ambiguity

- Each provider inbound message has a durable database uniqueness key derived from the provider/channel plus the provider message identity available for that channel. A duplicate is acknowledged without repeating customer, ticket, message, notification, audit, history, attachment, or realtime side effects.
- Code may classify a database conflict as duplicate delivery only when the violated constraint is the inbound-message idempotency constraint. Unrelated `P2002` and other database errors propagate through normal error handling.
- Live Chat start/create is protected by a database-level session invariant so simultaneous starts for one session yield one active ticket. Losing requests return/resume the winning ticket instead of creating a second one.
- After canonical phone normalization: zero customer matches uses the existing customer-creation flow; exactly one uses that customer; multiple matches stop automatic resolution. Ambiguity is logged with non-sensitive correlation context and surfaced as a safe provider-processing outcome for operator follow-up; no customer is chosen arbitrarily and no message is attached to a ticket.

### Audit and first-response SLA

- Every successful Ticket creation path emits exactly one canonical `TICKET_CREATED` AuditLog: staff/manual, Portal, Email, SMS, WhatsApp, and Live Chat.
- Staff/manual creation uses the authenticated actor. Portal-, provider-, and system-created tickets use `actorId = null`, even when a Portal customer initiated the request. Each creation retains its existing `TicketHistory` behavior.
- Reads, duplicate inbound delivery, provider callback replays, and internal delivery retry attempts create no AuditLog entries.
- `firstRespondedAt` is set once by the first customer-visible human public reply sent by an authenticated `ADMIN`, `MANAGER`, or `AGENT`. Internal notes and system/provider events never count. AI text counts only after a staff member explicitly sends it as their public reply.

### Content format, provenance, and validation

- Every `TicketMessage` and `TicketNote` persists explicit content format/provenance sufficient for consumers to distinguish provider plain text from server-sanitized rich HTML without inspecting body contents.
- Provider plain text is persisted as plain text and always rendered escaped as text, even when it contains strings such as `<a>` or `<strong>`. SMS, WhatsApp, and plain-text Email payloads are never interpreted as trusted HTML.
- Rich HTML crosses one server sanitization boundary before persistence. Consumers may apply defense-in-depth sanitization, but format metadata—not markup sniffing—selects rich rendering.
- The implementation plan defines one canonical server-enforced content validation/size policy shared by conversation entry points, with only an explicitly documented smaller Live Chat surface limit.

## Frontend Query, Cache, and Update Behavior

- Internal `useTicket(id)` owns the full merged conversation. Successful reply/note invalidates `ticketKeys.detail(id)` and all ticket lists. It does not optimistically insert a message.
- Portal reply invalidates own ticket, all Portal ticket-list keys, and Portal overview. Live Chat send invalidates the canonical Portal ticket, Live Chat bootstrap, and Portal overview.
- SSE repeats targeted invalidation. Internal message events invalidate ticket detail/lists and Manager queries; customer message events invalidate the owned Portal detail/list and Live Chat bootstrap; ticket updates also invalidate Portal overview or internal Dashboard.
- Duplicate SSE events are harmless because invalidation/refetch is idempotent; no client event dedupe exists.
- Auto-scroll follows new items only when near the bottom and explicit local send uses a token; refetch does not focus the composer or intentionally clear drafts.
- Reply/note editors remain mounted across workspace/mode changes and hold separate drafts. Pending state blocks duplicate UI submissions; recoverable errors preserve the draft. Successful mutation clears only the active draft.
- Quick Reply is internal-public-reply-only, searches server-side, inserts editable plain text, respects the 20,000-character draft limit, and never sends. AI suggestions similarly insert only after human action.
- Delivery failure is shown as an inline localized error after a `201 FAILED` result. The same translation namespace still says `whatsappDelivery` internally even though its copy is channel-neutral. Reload loses the per-message warning because detail DTOs do not carry delivery state.
- Attachment upload caches are separate from ticket conversation caches. A ticket/Portal upload invalidates only its attachment key, so upload alone does not refetch/reopen conversation state.

---

## Validation and Error Semantics

| Boundary | Current semantics |
| --- | --- |
| Internal reply/note | strict `{ body }`; 1–50,000 serialized chars; unknown fields `400 VALIDATION_ERROR`; sanitized-empty `422 EMPTY_MESSAGE` |
| Portal reply | strict `{ body }`; 1–20,000 serialized chars; sanitized-empty `422 EMPTY_MESSAGE` |
| CLOSED mutation | `409 TICKET_CLOSED`, no writes/event/provider call |
| Hidden/non-owned ticket | IDOR-safe `404 TICKET_NOT_FOUND` |
| Agent without assignment | `403 FORBIDDEN` before transport |
| Bad provider signature | Email/WhatsApp/SMS safe `401`; unset webhook secret/config safe `503` |
| Invalid provider payload | Provider-specific `400`/`422`; unsupported signed Email/WhatsApp events may be ignored with `200` to avoid retries |
| Duplicate provider delivery | `200` with `DUPLICATE`, no intended further side effects |
| Provider outbound failure | Message remains committed; `201` with `delivery.status = FAILED`; best-effort failure history |
| Attachment | structured 413/415/422/404/503/500 codes; authorization before body/provider work where applicable |

Controller identity fields are never client-supplied. Ticket/channel/status/customer/provider ids are derived from auth, route, database, or verified payload. Error responses never include provider secrets or raw payloads.

---

## Privacy and Security Boundaries

- Internal notes, mention ids, watcher state, assignment/team/org metadata, TicketHistory, SLA, and internal provider data never appear in Portal ticket responses.
- Customer Portal ticket/message access is always constrained by linked Customer ownership. Internal ticket access is role/team/assignment scoped.
- Webhook signatures are verified over raw bytes before JSON parsing; product JWTs do not authorize machine endpoints.
- Provider credentials stay server-side and are not logged/returned. Logs should contain only coarse operation/status context; current Email attachment warnings include provider attachment ids, while bodies/contact values are not intentionally logged.
- Attachment filenames are sanitized display metadata; stored objects are private and downloads are authorized. Plain-text preview is escaped and never rendered as HTML.
- Realtime audience metadata is not serialized. Customer connections reject internal visibility both server-side and client-side.
- `TicketMessage.externalId` is provider-neutral but globally unique across all channels; provider namespacing is explicit for Email, while SMS/WhatsApp store raw provider ids and rely on provider-global uniqueness.
- Inactive channel system Users concentrate authorship. They distinguish source channel but do not prove the external individual owns the asserted email/phone.

---

## Current Test Coverage

### Strong existing coverage

- Tickets: conversation projection/order; reply/note RBAC; CLOSED immutability; first-response once; rich sanitization; mentions/watchers; per-channel commit-first delivery, mapping, and provider-not-called-before commit.
- Portal: ownership/IDOR-safe projection; WAITING/RESOLVED/CLOSED reply behavior; safe rich replies; internal-note exclusion; cache/UI response states.
- Email: signature/controller behavior, retrieval/normalization, threading paths, duplicate messages, attachments, reopen transitions, delivery success/failure/timeout, customer-creation audit.
- SMS: signature/payload, provider request and timeout/rejection classification, inbound create/match/dedupe/status/notifications/realtime, customer-creation audit.
- WhatsApp: extraction/signature/config, customer/ticket matching, inbound dedupe/status, notification/realtime behavior, outbound result/failure history, customer-creation audit.
- Live Chat: department/team routing, resume/create, auto-assignment, customer end/idempotency/CLOSED behavior, inactivity resolution, widget messaging/status/error/RTL behavior.
- Attachments: every role/context, parser codes, signature detection, cleanup, projection, download/preview security, CLOSED restrictions, cache invalidation.
- Realtime: outbox commit/rollback, event framing/lifecycle, role/team/customer audience rules, internal-note exclusion, client query invalidation.
- Quick Reply/Lexical: editor formatting/sanitization boundary, insertion/length, note/Portal isolation, pending/error/draft behavior.

### Missing or weak coverage

- No cross-channel contract test table asserts the complete shared matrix (WAITING, RESOLVED, CLOSED, notification recipients, realtime audience, audit/history) for all five channels.
- No regression test catches missing `teamId` in Email/WhatsApp inbound realtime audiences on an already-routed ticket.
- No durable-status/reload test can exist because delivery status is not modeled on messages.
- No concurrency test proves Live Chat start cannot create two active chats.
- Portal/API duplicate submissions have no idempotency-key coverage.
- SMS customer placeholder-email collision / broad `P2002` misclassification is not covered.
- No provenance test asserts literal allowlisted markup from SMS/WhatsApp remains literal text.
- No test asserts the semantic mismatch between Portal serialized max (20k) and internal HTML max (50k), or defines the desired common plain-text limit server-side.
- No test associates a delivery-failure history row to its originating message because the schema cannot represent that relation.
- Live Email/Meta/TextBee delivery, provider callbacks, Blob round trip, deployed SSE behavior, and full browser cross-channel QA remain unverified.

---

## Documentation Drift

| ID | Classification | Drift |
| --- | --- | --- |
| CC-DG-01 | documentation drift | `docs/21-email-integration.md` architecture/outbound section and ADR-044 still say Resend runs inside the transaction and rejection rolls back the message. ADR-052 and current code are commit-first and return 201 FAILED. |
| CC-DG-02 | documentation drift | `docs/07-ticket-workflow.md` repeats the obsolete “outbound public reply is committed only after Resend accepts it” rule. |
| CC-DG-03 | documentation drift | `docs/20-whatsapp-integration.md` says auto-created WhatsApp tickets are picked up by the SLA monitor; current team-scoped assignment deliberately excludes `teamId = null` until Admin routing. Its older notification text also describes broad Admin/Manager fan-out, now replaced by the shared narrow resolver. |
| CC-DG-04 | documentation drift | ADR-056 says SMS outbound occurs inside the ticket transaction so failure cannot commit a message; ADR-052/current code moved it after commit. |
| CC-DG-05 | documentation drift | ADR-045 and parts of `docs/22` retain “internal roles only”/old unscoped audience language while later sections and code include CUSTOMER plus Manager/Agent team scope. |
| CC-DG-06 | documentation drift | ADR-035 says Portal remained plain textarea and Internal Note was not migrated; ADR-037/current code use shared Lexical + sanitized HTML for both. |
| CC-DG-07 | documentation drift | `docs/19-progress-tracking.md` top snapshot remains dated 2026-09-02 and conflicts with the active SDD branch/current repository evidence. |
| CC-DG-08 | documentation drift | Several docs define first response as the first public “agent” reply, while `addTicketMessage` stamps it for every authorized internal role (Admin/Manager/Agent). Product wording or code intent needs clarification. |

---

## Discovered Gaps

Every gap is classified; differences that are already deliberate product rules are listed separately below and are not mislabeled as bugs.

| ID | Classification | Finding / impact |
| --- | --- | --- |
| CC-GAP-01 | implementation bug | Email inbound omits `teamId` from `emitTicketMessageCreated`; routed-ticket own-team Manager/Agent clients miss the realtime invalidation. |
| CC-GAP-02 | implementation bug | WhatsApp inbound omits `teamId` from the same event; same audience failure as CC-GAP-01. |
| CC-GAP-03 | implementation bug | SMS inbound treats any transaction `P2002` as duplicate-provider delivery. A placeholder-email collision (SMS does not perform WhatsApp's existing placeholder-email fallback) can roll back and return `DUPLICATE` even though no message with that `smsId` exists, dropping the inbound message. |
| CC-GAP-04 | architecture debt | Delivery success/failure is not a canonical message field/entity. Immediate UI state is ephemeral; failure history is ticket-level and not message-linked; provider-id persistence is best-effort and absence is ambiguous. |
| CC-GAP-05 | architecture debt | WhatsApp duplicates the shared outbound result/failure helper policy instead of using `outbound-delivery.ts`; drift risk remains despite current vocabulary alignment. |
| CC-GAP-06 | architecture debt | Provider integrations implement parallel customer resolution, ticket creation, notification, transition, and event assembly. The repeated code already produced the Email/WhatsApp team-audience defect and SMS identity discrepancy. |
| CC-GAP-07 | security/privacy concern | Rendering infers HTML from body content instead of persisted format/provenance. Literal allowed markup from plain-text SMS/WhatsApp can become active formatting/links. DOMPurify blocks script execution, but literal-content integrity and phishing presentation are not explicit. |
| CC-GAP-08 | architecture debt | Public messages authored by channel-wide inactive CUSTOMER system users preserve source but not sender identity as an authenticated CRM principal; this is an accepted provider-asserted identity boundary, yet it limits per-sender attribution and future multi-contact handling. |
| CC-GAP-09 | resolved target requirement | Add durable per-message delivery state and bounded attempt linkage; immediate result and ticket history alone are insufficient. |
| CC-GAP-10 | resolved target requirement | Bind conversation uploads to one message/note and reject unsupported external attachment delivery before creating an outbound message. |
| CC-GAP-11 | resolved target requirement | Match by explicit ticket/session correlation, then reliable provider thread/message correlation, otherwise create a new ticket; remove latest-customer-ticket fallbacks. |
| CC-GAP-12 | resolved target requirement | Portal and reliably correlated Email may reopen RESOLVED; heuristic SMS/WhatsApp matching may not; a new Live Chat session creates a fresh ticket. |
| CC-GAP-13 | resolved target requirement | Require DB-level provider inbound idempotency and concurrency-safe Live Chat session creation; ordinary Portal/internal send keys are deferred. |
| CC-GAP-14 | resolved target requirement | Emit exactly one canonical `TICKET_CREATED` AuditLog for every successful creation path, using `actorId = null` outside staff/manual creation. |
| CC-GAP-15 | resolved target requirement | Count the first public human ADMIN/MANAGER/AGENT reply; exclude notes, system/provider events, and AI text until staff explicitly sends it. |
| CC-GAP-16 | resolved target requirement | Persist explicit format/provenance and enforce the canonical content policy defined in the implementation plan. |
| CC-GAP-17 | test gap | No shared parameterized cross-channel invariant suite covers status, CLOSED, notification, realtime audience, and history/audit parity. |
| CC-GAP-18 | test gap | No targeted tests for CC-GAP-01/02/03, literal plain-text markup rendering, Live Chat start concurrency, or API idempotency behavior. |
| CC-GAP-19 | architecture debt | Realtime is process-local and non-replayable; Vercel/serverless reconnect behavior is best-effort and production realtime readiness is not established. |
| CC-GAP-20 | architecture debt | There is no delivery retry/reconciliation/manual resend mechanism, and outbound delivery-failure history persistence itself is best-effort. This is acceptable only if explicitly retained as MVP scope. |
| CC-GAP-21 | security/privacy concern | Phone identity can match multiple Customers; newest row wins (SMS silently, WhatsApp with warning). Misrouting can expose a customer's conversation to the wrong CRM profile. No uniqueness constraint or ambiguity quarantine exists. |
| CC-GAP-22 | implementation bug | Live Chat's read-before-create resume check has no concurrency guard/unique invariant despite comments claiming two near-simultaneous starts do not both create a chat; two requests can both observe no active chat and create two. |
| CC-GAP-23 | documentation drift | CC-DG-01 through CC-DG-08 leave contradictory current contracts across domain docs/ADRs and must be reconciled after decisions are made. |

### Documented differences currently treated as intentional

- Portal/Email reopen RESOLVED; SMS/WhatsApp/Live Chat start new.
- Email uses thread evidence and refuses ambiguous active fallback; SMS/WhatsApp use newest active ticket.
- Live Chat is immediately department/team routed; other customer/provider creation is unrouted.
- Email accepts inbound attachments; SMS/WhatsApp/Live Chat inbound are text-only.
- Email outbound carries HTML + text; SMS/WhatsApp carry plain text; WEB/LIVE_CHAT stay inside CRM.
- Live Chat composer is 2,000-character compact plain text; ticket/Portal composers expose richer formatting.
- CLOSED customer/provider activity starts a new external-channel ticket where applicable, but no path mutates the closed ticket.

These differences must remain documented until the product explicitly changes them.

---

## Product Decisions — Resolved

| Decision | Resolution |
| --- | --- |
| OD-CC-1 | Commit-first plus durable, per-message delivery state; bounded retry on the same message; supported callbacks update that state. |
| OD-CC-2 | Conversation attachments belong to one message/note and transmit only through explicitly supported provider flows; unsupported outbound combinations reject before message creation. |
| OD-CC-3 | Portal and reliably correlated Email may reopen RESOLVED; heuristic SMS/WhatsApp matching may not; every new Live Chat session creates a fresh ticket. CLOSED remains immutable. |
| OD-CC-4 | Explicit ticket/session correlation, then reliable provider thread/message correlation, otherwise new ticket. No latest-customer-ticket heuristic. |
| OD-CC-5 | Provider inbound idempotency is DB-enforced and constraint-specific; Live Chat active-session creation is concurrency-safe. Client request idempotency for ordinary Portal/internal sends is deferred. |
| OD-CC-6 | Zero normalized phone matches creates, one resolves, multiple stop automatic resolution and surface/log a safe ambiguity. |
| OD-CC-7 | Every successful ticket creation writes exactly one canonical `TICKET_CREATED` AuditLog; non-staff creation is actorless. |
| OD-CC-8 | A human ADMIN, MANAGER, or AGENT public reply satisfies first response; notes/system events do not; AI counts only when explicitly sent by staff. |
| OD-CC-9 | Persist explicit content format/provenance; plain text is escaped, rich HTML is server-sanitized, and the plan owns one canonical content validation/size policy. |

CC-GAP-01/02/03/22 are confirmed implementation defects and must be included in the plan with targeted regression coverage.

---

## Recommendation

**Ready for `plan.md`.** Brownfield discovery is complete and OD-CC-1 through OD-CC-9 are resolved. The plan must preserve the canonical Ticket/TicketMessage/TicketNote architecture and commit-first delivery, add only the durable state and integrity constraints required by these decisions, fix the confirmed defects with focused regression tests, and reconcile stale domain/API/ADR text during implementation.

## Specification Status

`SPECIFICATION APPROVED — PRODUCT DECISIONS RESOLVED; READY FOR IMPLEMENTATION PLANNING`
