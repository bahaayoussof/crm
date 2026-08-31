# Resend Email Channel Integration

EMAIL is a transport for the existing Ticket conversation. It does not create a second inbox, composer, message table, workflow, or permission model.

## Architecture

```text
Customer email -> Resend email.received webhook -> verified raw-body endpoint
 -> Receiving API (body/headers/attachments)
 -> Customer + EMAIL Ticket correlation -> TicketMessage + Attachment

Existing public-reply composer -> POST /api/tickets/:id/messages
 -> existing RBAC/sanitization -> Resend send API -> TicketMessage commit
```

Provider-specific code is isolated in `server/src/modules/integrations/email/`.
The existing `server/src/modules/email/` remains the transactional/password-reset
email facility and is not a ticket conversation system.

## Endpoint and security

`POST /api/integrations/email/webhook` is public and accepts at most 1 MiB. It is
mounted before global `express.json()` and uses `express.raw()` only on this
route. The server passes the exact raw payload plus `svix-id`, `svix-timestamp`,
and `svix-signature` to the official Resend SDK `webhooks.verify()` method.
Missing/invalid signatures return a safe `401`. Unsupported signed events return
`200 IGNORED`.

For `email.received`, the server uses the Receiving API because webhook events
contain metadata rather than full content. Plain text is preferred. HTML is
reduced through the existing sanitizer and converted to plain text; arbitrary
inbound HTML is never rendered. Sender addresses are normalized and validated.
Full bodies and credentials are not logged.

## Configuration

All values are server-only and optional at application startup:

| Variable | Use |
| --- | --- |
| `RESEND_API_KEY` | Receiving API, attachment retrieval, outbound sends |
| `RESEND_WEBHOOK_SECRET` | Webhook verification |
| `EMAIL_INBOUND_ADDRESS` | Resend receiving address and reply-token base |
| `EMAIL_FROM` | Outbound sender email (or legacy `Name <email>` format) |
| `EMAIL_FROM_NAME` | Friendly name when `EMAIL_FROM` is a bare address |
| `BLOB_READ_WRITE_TOKEN` | Existing private attachment storage |

Missing inbound values produce `503 EMAIL_WEBHOOK_NOT_CONFIGURED` only on the
webhook. Missing/invalid outbound values produce `EMAIL_NOT_CONFIGURED` or
`EMAIL_SENDER_INVALID` only when EMAIL is used. WEB, WhatsApp, startup, and
unrelated transactional email remain functional.

## Development without a custom domain

1. Create a Resend API key with sending and Receiving access.
2. Use the assigned Resend-managed `*.resend.app` receiving address as
   `EMAIL_INBOUND_ADDRESS`.
3. Create a webhook for the public API URL
   `/api/integrations/email/webhook`, subscribe to `email.received`, and set its
   signing secret as `RESEND_WEBHOOK_SECRET`.
4. Set `EMAIL_FROM=onboarding@resend.dev` (or another provider-supported test
   sender) and optionally `EMAIL_FROM_NAME=CRM Support`.

The shared `resend.dev` sender is for testing and normally sends only to the
email address associated with the Resend account. The CRM does not bypass that
restriction. Resend test recipients simulate delivery events; they are not a
real customer mailbox round trip.

## Threading and ticket matching

Outbound subject: `[CRM-<existing 8-character public ticket reference>] <subject>`.
The reference matches the existing UI `#<last 8 characters>` convention and is
only a fallback.

Matching order, always constrained to `channel=EMAIL` and the normalized sender's Customer:

1. `In-Reply-To` / `References` matching `TicketMessage.externalMessageId`.
2. A random `Ticket.emailThreadToken` in the ticket-specific `Reply-To` address.
3. The public ticket reference in the subject, only for exactly one same-Customer match.
4. Exactly one active EMAIL ticket for that Customer.
5. Otherwise create a new EMAIL ticket.

A sender mismatch cannot cross tickets. A CLOSED correlation starts a new
ticket. RESOLVED reuses the existing reopen rule (`RESOLVED -> OPEN`, clear
`resolvedAt`); `WAITING_CUSTOMER -> IN_PROGRESS` is also reused.

## Idempotency

- `TicketMessage.externalId` stores unique `resend:<email_id>`.
- `TicketMessage.externalMessageId` stores the unique RFC Message-ID.
- `Attachment.externalId` stores unique `resend:<email_id>:<attachment_id>`.
- `Ticket.emailThreadToken` is unique and nullable for non-email tickets.
- Duplicate delivery returns `200 DUPLICATE` without side effects; database
  uniqueness closes concurrent-delivery races.

## Attachments

Inbound attachment downloads are bounded by the existing 4 MiB limit and reuse
content-byte detection, MIME allowlisting, filename sanitization, private
storage, and the Attachment model. Supported types remain JPEG, PNG, WebP, PDF,
and safe UTF-8 text. Unsupported/oversized files are skipped while the message
is accepted. Valid files require configured private storage. There is no malware
scanner.

The current composer uploads files only after a message exists and does not send
attachment IDs with the reply mutation. Outbound EMAIL therefore does not attach
existing CRM files in this phase; that needs a future explicit API contract.

## Outbound consistency and RBAC

Only the existing public-message endpoint triggers EMAIL. Existing ADMIN/MANAGER
visibility and assigned-AGENT rules run first. Internal notes never call Resend.
Resend is called inside the existing message transaction using an idempotency key
derived from the pre-generated message ID. A provider rejection returns
`502 EMAIL_DELIVERY_FAILED` and rolls back the message, first-response timestamp,
watcher notifications, and related effects. WEB and WhatsApp are unchanged.

## Production custom domain later

No code change is required:

1. Add the future domain (prefer a dedicated subdomain) in Resend.
2. Configure the SPF, DKIM, MX, and optional DMARC records shown by Resend.
3. Wait for sending and receiving verification.
4. Set `EMAIL_FROM=support@domain.com`, `EMAIL_FROM_NAME=CRM Support`, and update
   `EMAIL_INBOUND_ADDRESS` if needed.
5. Retest outbound delivery, inbound receipt, threading, and attachments.

Delivery lifecycle events are safely ignored today and can be added later
without changing the Ticket conversation architecture.

## Manual QA checklist

1. Configure API key, Resend-managed inbound address, webhook secret, test sender, and Blob token.
2. Expose the backend over public HTTPS and create the `email.received` webhook.
3. Send a new email; confirm one EMAIL ticket and customer message.
4. Reply from the CRM; confirm delivery where Resend's development restriction permits it.
5. Reply from the external mailbox; confirm the same ticket.
6. Test valid, unsupported, and oversized attachments.
7. Confirm an internal note sends no email.
8. Replay the webhook; confirm no duplication.
9. Test an invalid signature; confirm `401` and no writes.
10. Check Ticket Details in EN/AR, RTL, dark mode, desktop/mobile.
11. Regression-test WEB and WhatsApp replies and internal notes.

Do not claim production-ready delivery until a verified production sender/domain
and a real inbound/outbound mailbox round trip have been tested.
