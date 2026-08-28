# WhatsApp Cloud API Integration

MVP integration that lets customers reach the business on WhatsApp and lets
agents answer from the existing ticket conversation UI. It is an adapter over the
existing customer / ticket / conversation / notification / SLA services — **not**
a parallel messaging system.

## Architecture

```text
Customer's WhatsApp
        │
        ▼
Meta WhatsApp Cloud API  ──webhook──▶  POST /api/integrations/whatsapp/webhook
                                             │  verify X-Hub-Signature-256
                                             │  normalize payload
                                             ▼
                         whatsapp.service.processInboundTextMessage()
                                             │  match/create Customer (by phone)
                                             │  find active WHATSAPP Ticket or create one
                                             │  create TicketMessage (externalId = wamid)
                                             │  CUSTOMER_REPLY notification fan-out
                                             ▼
                              Existing internal Ticket Conversation

Agent types a reply in the existing composer
        │  POST /api/tickets/:id/messages   (unchanged RBAC)
        ▼
ticket.service.addTicketMessage()  ── persists TicketMessage ──▶ committed
        │  ticket.channel === WHATSAPP ?
        ▼
whatsapp.service.deliverOutboundReply()
        │
        ▼
whatsapp.client.sendTextMessage()  ──▶  Meta Graph API  ──▶  Customer's WhatsApp
```

Module: `server/src/modules/integrations/whatsapp/`

| File | Responsibility |
| --- | --- |
| `whatsapp.routes.ts` | `GET`/`POST /webhook`. Mounted in `app.ts` **before** `express.json()`; `POST` uses `express.raw()` so the body stays a Buffer for HMAC. |
| `whatsapp.controller.ts` | Webhook verification handshake; signature check; payload parse; dispatch. Returns `200` for accepted/ignored, `401` bad signature, `400` non-JSON, `503` unconfigured. |
| `whatsapp.signature.ts` | `X-Hub-Signature-256` HMAC-SHA256 verification and constant-time string compare. |
| `whatsapp.schema.ts` | Lenient Zod validation of the Meta webhook payload + `extractInboundTextMessages()`. |
| `whatsapp.service.ts` | `processInboundTextMessage()` (idempotent inbound pipeline) and `deliverOutboundReply()` (outbound send + failure recording). |
| `whatsapp.client.ts` | Graph API HTTP client — `sendTextMessage({ to, text })`. Owns URL, auth header, payload mapping, error normalization. |
| `whatsapp.config.ts` | Typed accessors over the optional `WHATSAPP_*` env vars. |
| `whatsapp.types.ts` | CRM-facing types. |

## Environment variables

All optional. When unset, the rest of the CRM is unaffected; WhatsApp transport
returns a structured `WHATSAPP_NOT_CONFIGURED` / `INTEGRATION_NOT_CONFIGURED`
error only when it is specifically invoked. Server-side only — never sent to the
browser, never logged, never in an API response.

| Variable | Purpose | Required for |
| --- | --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | Bearer token for the WhatsApp Business phone number. | Outbound replies |
| `WHATSAPP_PHONE_NUMBER_ID` | The Phone Number **ID** (not the phone number) from the Meta app. | Outbound replies |
| `WHATSAPP_VERIFY_TOKEN` | Arbitrary string echoed during the Meta webhook verification handshake. | Webhook GET verification |
| `WHATSAPP_APP_SECRET` | Meta **App Secret**; verifies the `X-Hub-Signature-256` header on inbound webhooks. | Inbound webhook |
| `WHATSAPP_API_VERSION` | Graph API version. Optional, defaults to `v22.0`. | — |

## Meta Developer configuration (manual)

1. **meta.com/developers** → your App → add the **WhatsApp** product.
2. Note the **Phone number ID** and generate a permanent **access token**
   (System User token recommended) → `WHATSAPP_ACCESS_TOKEN`,
   `WHATSAPP_PHONE_NUMBER_ID`.
3. App → **Settings → Basic** → copy the **App Secret** → `WHATSAPP_APP_SECRET`.
4. Choose any string for `WHATSAPP_VERIFY_TOKEN`.
5. WhatsApp → **Configuration → Webhook**:
   - **Callback URL:** `https://<api-domain>/api/integrations/whatsapp/webhook`
   - **Verify token:** the same value as `WHATSAPP_VERIFY_TOKEN`
   - Click **Verify and save** — Meta calls `GET` with `hub.challenge`; the server
     echoes it when the token matches.
6. **Webhook fields:** subscribe to **`messages`**. No other field is used.
7. Add the destination numbers as test recipients (or complete Business
   verification for production).

## Webhook endpoints

```text
GET  /api/integrations/whatsapp/webhook   Meta verification handshake (hub.challenge)
POST /api/integrations/whatsapp/webhook   Inbound events (signed with the App Secret)
```

Required Meta subscription: **`messages`** only.

## Inbound message flow

Only **text** messages are handled. Per inbound message, in one transaction:

1. **De-dupe:** `TicketMessage.externalId` (the Meta `wamid`) is unique. A
   repeated webhook delivery makes no further writes and returns `200`.
2. **Author:** a single login-less `User` (`whatsapp-inbound@system.invalid`,
   role `CUSTOMER`, `isActive: false`) authors every inbound message —
   `TicketMessage.authorUserId` is a required FK and WhatsApp senders usually
   have no account.
3. **Customer match:** normalize the sender phone to `+<digits>`; match
   `Customer.phone`. Exactly one → reuse. None → create
   `{ name: profile name or +E164, phone: +E164, email: wa-<digits>@no-email.invalid }`.
   Multiple → deterministically the most-recently-updated, with a server warning
   (records are never merged).
4. **Ticket match:** newest ticket for that customer with `channel = WHATSAPP`
   and status ∉ `{RESOLVED, CLOSED}` → append. Otherwise create a ticket
   (`channel = WHATSAPP`, `status = NEW`, `priority = MEDIUM`, MEDIUM-priority SLA
   snapshot, `TICKET_CREATED` history with `actorUserId = null`, subject
   `WhatsApp: <first 60 chars>`).
5. **Message:** `TicketMessage` with `externalId`, `createdAt` from the payload
   timestamp (when sane). `firstRespondedAt` is never touched by an inbound
   message.
6. **Status:** a message to a `WAITING_CUSTOMER` ticket moves it to
   `IN_PROGRESS` (atomic history), mirroring the Portal customer-reply rule.
7. **Notifications:** a `CUSTOMER_REPLY` notification to the assigned agent (if
   any) plus every active `ADMIN`/`MANAGER`, via the existing notification
   service.

Non-text messages, delivery/read `statuses`, and unrelated fields are ignored
with `200`. A signed but non-JSON body returns `400`; a signed but structurally
unexpected JSON body returns `200` (no retry).

## Outbound reply flow

The agent uses the **existing** conversation composer. `POST /tickets/:id/messages`
persists the `TicketMessage` first (RBAC and the assigned-agent rule are
unchanged). If `ticket.channel === WHATSAPP`, `deliverOutboundReply()` then calls
the Graph API:

- **Success:** the Meta message id is stored on `TicketMessage.externalId`; the
  response `data.delivery` is `{ channel: "WHATSAPP", status: "SENT", externalId }`.
- **Failure** (not configured / no customer phone / Meta rejection / network):
  the message is **kept**; `data.delivery` is `{ status: "FAILED", reason }` and a
  `WHATSAPP_DELIVERY_FAILED` ticket-history row (`actorUserId = null`,
  `newValue = <reason>`) is written so the failure survives a page reload. The
  composer shows a localized warning instead of the success line.

`reason` ∈ `INTEGRATION_NOT_CONFIGURED | NO_RECIPIENT_PHONE | PROVIDER_REJECTED | PROVIDER_UNREACHABLE`.

## Security

- Webhook endpoints are **machine endpoints** — no product JWT. Authentication is
  the Meta HMAC signature (`WHATSAPP_APP_SECRET`) on `POST` and the constant-time
  verify-token check on `GET`.
- The signature is computed over the **raw** request bytes (hence the pre-`json()`
  mount + `express.raw()`).
- Bad signature → `401`; unset secret → `503`. No secret value is ever logged or
  returned.
- Outbound sends run **after** the normal ticket-conversation authorization; an
  agent can only trigger a WhatsApp send on a ticket they are allowed to reply to.

## SLA & notifications

WhatsApp tickets use the **same** `SlaRule` snapshots, the same
`GET /api/internal/sla-monitor` auto-assignment/escalation, and the same
per-user notification system as every other channel. Auto-created WhatsApp
tickets are unassigned and are picked up by the SLA monitor like any other
unassigned active ticket. No WhatsApp-specific SLA rule exists.

## Local testing

- Automated tests (`server/src/modules/integrations/whatsapp/whatsapp.test.ts` +
  additions in `ticket.test.ts`) mock the Graph API entirely — they never touch
  the network.
- Manual: expose the local API with a tunnel (e.g. `ngrok http 3000`), set the
  five env vars, point the Meta webhook at
  `https://<tunnel>/api/integrations/whatsapp/webhook`, verify, then message the
  business number from a registered WhatsApp account.
- To hand-craft a signed POST:
  `SIG=sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WHATSAPP_APP_SECRET" | awk '{print $2}')`.

## Production setup

- The webhook needs a public **HTTPS** URL:
  `https://<api-domain>/api/integrations/whatsapp/webhook`. The hostname is never
  hard-coded in application logic.
- Set all five `WHATSAPP_*` values in the server deployment environment. Never
  commit them.
- Compatible with the existing Vercel Node deployment — no new infrastructure.

## Supported message type

- **Inbound:** text only.
- **Outbound:** text only.

## Limitations (intentional, MVP)

- No media / audio / stickers / reactions / location / contacts / interactive
  buttons / templates / broadcasts / campaigns.
- No delivery/read-receipt lifecycle beyond the immediate send result.
- No multi-number or multi-WABA support.
- No historical WhatsApp message import.
- Ambiguous phone matches route to one existing customer (logged), never merge.
- Auto-created customers carry a non-routable `@no-email.invalid` placeholder
  email because `Customer.email` is a required unique column (see ADR-030).
- A WhatsApp message after a ticket is `RESOLVED`/`CLOSED` opens a **new** ticket
  (the active-ticket filter excludes terminal statuses); it does not reopen.
- No AI-generated reply suggestions — this integration is independent of any LLM
  provider.
