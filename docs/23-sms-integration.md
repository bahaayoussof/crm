# TextBee Cloud SMS Integration

SMS is a transport for the existing ticket conversation. Provider-specific HTTP details stay in `server/src/modules/integrations/sms/`; ticket business logic depends only on `SmsProvider`.

## Configuration

Server-only variables:

- `TEXTBEE_API_KEY` — dashboard API key, sent as `x-api-key`.
- `TEXTBEE_DEVICE_ID` — paired Android device selected for outbound sends.
- `TEXTBEE_BASE_URL` — optional; defaults to `https://api.textbee.dev`.
- `TEXTBEE_WEBHOOK_SECRET` — TextBee webhook signing secret.

Create a TextBee Cloud account, install the TextBee Android application, pair the device from the dashboard, create an API key, and create a `MESSAGE_RECEIVED` webhook. The production URL is `https://<api-domain>/api/integrations/sms/webhook`. Local development needs a public HTTPS tunnel to the server. Never put real credentials in source control.

## Outbound

`POST /api/tickets/:id/messages` retains normal ticket visibility and assignment authorization. For an SMS ticket it validates the customer's existing normalized international phone, converts sanitized rich reply HTML to plain text, and calls `SmsProvider` inside the database transaction. TextBee receives `POST /api/v1/gateway/send-sms` with `{ recipients, message, deviceId }`. A successful response stores `smsBatchId` in `TicketMessage.externalId`. Provider/configuration/phone failures return a structured error and roll back the message and all related effects.

TextBee acceptance means queued/accepted by the Android gateway, not carrier delivery confirmation. Delivery-status webhooks are outside this MVP.

## Inbound

TextBee sends a raw JSON `MESSAGE_RECEIVED` payload. The endpoint verifies the hexadecimal HMAC-SHA256 `X-Signature` against the exact raw body, validates fields with Zod, and uses `smsId` as `TicketMessage.externalId` for idempotency.

The sender uses the shared phone normalizer. The newest matching customer is reused; otherwise an SMS customer with a non-routable `.invalid` placeholder email is created, matching the WhatsApp precedent. The newest active SMS ticket (`OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `ESCALATED`) is reused or a new unassigned MEDIUM SMS ticket is created with SLA snapshots. `WAITING_CUSTOMER` moves to `IN_PROGRESS`. Notifications use `ticketOperationalRecipientIds` (admins, owning-team manager, assignee), and the normal realtime message event is published after commit.

SMS is text-only. The internal attachment controls are disabled for SMS tickets. Message bodies are trimmed and bounded to 20,000 plain-text characters; carriers may split long SMS into multiple segments.

