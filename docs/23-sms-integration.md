# TextBee Cloud SMS Integration

## Overview

- **Provider:** TextBee Cloud (`https://api.textbee.dev`), a gateway that relays
  SMS through a paired Android device. Called directly over `fetch` — there is no
  vendor SDK.
- **Purpose:** SMS is a transport for the existing Ticket conversation. It adds
  no second inbox, composer, message table, workflow, or permission model.
- **Direction:** both inbound (customer → CRM, via a `MESSAGE_RECEIVED` webhook)
  and outbound (staff reply → customer, via the normal ticket-message endpoint).
- **Isolation:** all provider HTTP details live in
  `server/src/modules/integrations/sms/`. Ticket business logic depends only on
  the small `SmsProvider` contract (`sendMessage(input) → { externalId? }`);
  `getSmsProvider()` returns `textBeeProvider` in production or a test override.
- **Delivery-status callbacks** (carrier-level "delivered"/"failed") are out of
  scope for this MVP. TextBee "acceptance" means queued/accepted by the Android
  gateway, not carrier confirmation.

## Configuration

Server-only variables, all optional at startup — an unset SMS config never
crashes the server and does not affect WEB / Email / WhatsApp:

| Variable | Use |
| --- | --- |
| `TEXTBEE_API_KEY` | Dashboard API key, sent as the `x-api-key` header on outbound sends |
| `TEXTBEE_DEVICE_ID` | Paired Android device id used for outbound sends |
| `TEXTBEE_BASE_URL` | Optional; defaults to `https://api.textbee.dev` |
| `TEXTBEE_WEBHOOK_SECRET` | HMAC signing secret for inbound webhook verification |

Setup: create a TextBee Cloud account, install and pair the TextBee Android app,
create an API key, and register a `MESSAGE_RECEIVED` webhook pointing at
`https://<api-domain>/api/integrations/sms/webhook`. Local development needs a
public HTTPS tunnel to the server. Never commit real credentials.

## Outbound Flow

```text
staff reply (Lexical rich text) -> POST /api/tickets/:id/messages
  -> auth / ticket access / assigned-agent check / body validation   (fail here = 401/403/404/422, nothing written)
  -> sanitize HTML, persist TicketMessage, stamp firstRespondedAt, watcher fan-out   [one transaction, commits]
  -> realtime ticket.message.created                                  (post-commit)
  -> deliverOutboundSmsReply(...)  ->  deliverSmsReply(...)  ->  textBeeProvider.sendMessage(...)
       -> POST {baseUrl}/api/v1/gateway/send-sms  { recipients:[phone], message, deviceId }
       -> result -> delivery: { channel:"SMS", status:"SENT"|"FAILED", externalId?|reason }
```

- The provider call runs **after the local commit** (commit-first, ADR-052),
  mirroring WhatsApp and Email. A provider or configuration failure never rolls
  back the persisted reply.
- The customer receives plain text only — the sanitized reply HTML is converted
  with `replyHtmlToPlainText` before the send.
- `deliverSmsReply` validates before touching the provider: missing / non-E.164
  phone → `CUSTOMER_PHONE_REQUIRED`, empty body → `EMPTY_MESSAGE`, body over
  20,000 characters → `SMS_MESSAGE_TOO_LONG` (all `422`).
- On success: `delivery.status = "SENT"`, and the TextBee `smsBatchId` (when
  present) is written to `TicketMessage.externalId` in a second best-effort
  update — a failure of that write is logged only.
- On failure: HTTP is still `201`, the response carries
  `delivery: { channel:"SMS", status:"FAILED", reason }`, and exactly one
  `SMS_DELIVERY_FAILED` `TicketHistory` row is written (`actorUserId = null`,
  `newValue = reason`). The reply is never lost.

## Inbound Flow

`POST /api/integrations/sms/webhook` receives a raw JSON `MESSAGE_RECEIVED`
payload from TextBee. Processing, in order:

1. **Signature verification** — the hex HMAC-SHA256 `X-Signature` header is
   recomputed over the exact raw body with `TEXTBEE_WEBHOOK_SECRET` and compared
   with `timingSafeEqual`. Missing / malformed / wrong signature → `401`
   `SMS_INVALID_SIGNATURE`. An unset secret → `503`
   `SMS_WEBHOOK_NOT_CONFIGURED` (fail-closed).
2. **Parsing** — non-JSON → `400` `SMS_INVALID_PAYLOAD`. The body is then Zod
   validated (`smsId`, `message` 1–20,000 chars, `deviceId`,
   `webhookEvent = "MESSAGE_RECEIVED"`, `sender` as a required international
   phone, `receivedAt`); any failure → `400` `SMS_INVALID_PAYLOAD`.
3. **Deduplication** — `smsId` is stored as `TicketMessage.externalId` (unique).
   A pre-existing row, or a `P2002` unique-violation race, short-circuits to
   `{ status: "DUPLICATE" }` with no side effects.
4. **Customer resolution** — the sender is run through the shared phone
   normalizer; the newest `Customer` matching the normalized / digits-only / raw
   number is reused. If none matches, an SMS customer is created with
   `name = <phone>` and a non-routable `sms-<digits>@no-email.invalid`
   placeholder email (the WhatsApp precedent).
5. **Ticket lookup / creation** — the newest active SMS ticket for that customer
   (`channel = SMS` and status in `OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`,
   `ESCALATED`) is reused. Otherwise a new ticket is created:
   `channel = SMS`, `priority = MEDIUM`, `status = OPEN`, unassigned,
   `teamId = null`, `subject = "SMS: <first 60 chars>"`, `description = <full
   text>`, and SLA deadline snapshots from the active MEDIUM `SlaRule` (both
   `null` if there is no active rule). A `RESOLVED` or `CLOSED` SMS ticket is
   **not** reopened — a new ticket is started instead.
6. **Message persistence** — the inbound text is stored as a `TicketMessage`
   authored by the inactive `sms-inbound@system.invalid` system user, with
   `createdAt = receivedAt`.
7. **Status behavior** — a reused ticket in `WAITING_CUSTOMER` moves to
   `IN_PROGRESS` with a `STATUS_CHANGED` history row (`actorUserId = null`). No
   other status changes on inbound.
8. **Notifications** — recipients come from `customerReplyNotificationRecipientIds`
   (the normal per-channel customer-reply rule): the assigned agent + the
   owning-team manager (from `Ticket.teamId` only) + explicit watchers, with an
   active-`ADMIN` fallback only when the ticket is unrouted, unassigned, and
   unwatched. This is deliberately narrower than the escalation fan-out.
9. **Realtime** — after the transaction commits, `ticket.message.created` is
   published through the same realtime outbox every channel uses.

Success responds `200` with `{ received: true, status }` where `status` is
`TICKET_CREATED`, `MESSAGE_APPENDED`, or `DUPLICATE`.

## Security

- **Webhook verification** is mandatory: constant-time hex HMAC-SHA256 over the
  raw request body keyed by `TEXTBEE_WEBHOOK_SECRET`. The route is mounted with
  `express.raw({ type: () => true, limit: "1mb" })` **before** the global JSON
  body parser so the exact bytes are available. Product JWTs grant no access to
  this endpoint; it is an external machine endpoint.
- **Provider secrets** (`TEXTBEE_API_KEY`, `TEXTBEE_DEVICE_ID`,
  `TEXTBEE_WEBHOOK_SECRET`) are server-only environment values, never sent to
  the client and never logged. Error logs record status codes and coarse reason
  categories only — no message bodies, phone numbers, or credentials.

## Error Handling

Outbound failures are classified and mapped to a shared `reason` vocabulary
(`outbound-delivery.ts`), surfaced as `delivery.reason` on the `201` response:

| Condition | Thrown | `delivery.reason` |
| --- | --- | --- |
| `TEXTBEE_API_KEY` / `TEXTBEE_DEVICE_ID` unset | `503 SMS_NOT_CONFIGURED` | `INTEGRATION_NOT_CONFIGURED` |
| No / invalid customer phone | `422 CUSTOMER_PHONE_REQUIRED` | `NO_RECIPIENT_PHONE` |
| Outbound timeout (`AbortSignal.timeout(20_000)`) or never-connected (DNS / socket) | `504 SMS_DELIVERY_UNREACHABLE` | `PROVIDER_UNREACHABLE` |
| TextBee responded and rejected — non-2xx, `data.success === false`, or `data.failureCount > 0` | `502 SMS_DELIVERY_FAILED` | `PROVIDER_REJECTED` |
| Empty / over-long body | `422 EMPTY_MESSAGE` / `SMS_MESSAGE_TOO_LONG` | `PROVIDER_REJECTED` |
| Anything else unmapped | — | `PROVIDER_UNREACHABLE` |

- The distinction between `PROVIDER_UNREACHABLE` (no HTTP response was received)
  and `PROVIDER_REJECTED` (TextBee answered and refused) is deliberate and
  matches the Email classification. The `try/catch` around the `fetch` call — and
  only that call — is the "no response" seam.
- The outbound send is bounded to **20 seconds** by `AbortSignal.timeout`. The
  timeout fires only after the local reply is committed, so it cannot roll back
  the CRM reply or emit a duplicate event.
- **No retry.** Each outbound reply is a single attempt; there is no queue,
  backoff, or delivery-status reconciliation.

## Ticket Behavior

| Aspect | SMS behavior |
| --- | --- |
| `channel` | `SMS` (set at creation, never changed) |
| Default priority | `MEDIUM` for inbound-created tickets |
| Assignment | Created unassigned with `teamId = null`; automatic assignment does **not** run at creation. Once an `ADMIN` routes the ticket to a team, the canonical ticket-update flow auto-assigns it (ADR-051). |
| Status on inbound | New ticket → `OPEN`; reused `WAITING_CUSTOMER` → `IN_PROGRESS`; `RESOLVED` / `CLOSED` → new ticket, never reopened |
| Status on outbound | Unchanged by the send itself |
| Customer identity | Newest phone-matched `Customer`, else a new SMS customer with a `.invalid` placeholder email |
| Attachments | SMS is text-only; the internal attachment controls are disabled for SMS tickets. Bodies are trimmed and bounded to 20,000 plain-text characters; carriers may split long messages into segments. |

## Realtime / Notifications

SMS-originated messages are ordinary `TicketMessage` rows. After commit they flow
through the same realtime outbox (`ticket.message.created`) and the same in-app
`Notification` model as every other channel — there is no SMS-specific event
type, socket, or notification. Outbound staff replies likewise reuse the shared
conversation endpoint, so first-response stamping, watcher fan-out, and realtime
all behave identically to a WEB reply.

## Testing

`server/src/modules/integrations/sms/sms.test.ts` covers:

- the TextBee request shape (URL, `x-api-key` header, `{ recipients, message,
  deviceId }` body) and that `smsBatchId` is returned as `externalId`;
- `AbortSignal.timeout` abort → `SMS_DELIVERY_UNREACHABLE` (asserted with a
  mocked `fetch`, no real 20 s wait);
- a raw connection failure (`TypeError: fetch failed`) →
  `SMS_DELIVERY_UNREACHABLE`;
- a TextBee HTTP 5xx and a body-level failure → `SMS_DELIVERY_FAILED`
  (provider responded);
- a missing customer phone rejected before any provider call;
- an unsigned webhook → `401 SMS_INVALID_SIGNATURE`;
- a correctly-signed but schema-invalid payload → `400 SMS_INVALID_PAYLOAD`.

Cross-module coverage: `modules/tickets/ticket.test.ts` asserts an SMS outbound
timeout returns `201` + `delivery.reason = "PROVIDER_UNREACHABLE"` with a single
side effect, and `integrations/outbound-delivery.test.ts` covers the reason
mapping and the single-history-row guarantee. Live TextBee delivery is not
exercised by the suite (no real credentials).
