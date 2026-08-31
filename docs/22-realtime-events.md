# Realtime CRM Events (SSE)

`feature/realtime-events` — ADR-045.

A reusable server → client realtime layer so important server-side changes appear
in the frontend without a manual reload. **REST stays the source of truth**;
realtime only signals "this changed — refetch it".

```
Customer Email / WhatsApp / Portal / internal agent
        → backend persists change (existing REST / webhook / service)
        → domain realtime event (transport-neutral publisher)
        → authorized SSE connection
        → frontend receives event
        → TanStack Query invalidate / refetch
        → UI updates automatically (no F5)
```

Deliberately **not** in scope: typing indicators, presence, read receipts, live
cursors, WebRTC, chat rooms, arbitrary event broadcasting. Those are future
live-chat work.

---

## 1. Architecture

| Concern | Mechanism |
| --- | --- |
| Writes | Unchanged REST endpoints / provider webhooks |
| Server → client push | Server-Sent Events (`text/event-stream`) |
| Frontend cache / source | TanStack Query (invalidate on event) |
| Transport isolation | `realtimePublisher.emit*()` — never `response.write` from domain code |

No existing mutation API changed. The realtime layer is additive and best-effort:
if it is unavailable the CRM keeps working through REST + Query focus/reconnect
refetch.

### Server module — `server/src/modules/realtime/`

| File | Responsibility |
| --- | --- |
| `realtime.types.ts` | Event contract (discriminated union) + internal audience type |
| `realtime.service.ts` | SSE transport: subscription registry, framing, heartbeat, dead-socket cleanup, `canReceive` authorization |
| `realtime.publisher.ts` | Transport-neutral, transaction-safe publication (`withRealtimeOutbox`, `emit*` helpers) |
| `realtime.controller.ts` | `GET /api/realtime/events` — headers, preamble, register, disconnect cleanup |
| `realtime.routes.ts` | Authenticated router, internal roles only |
| `realtime.test.ts` | Transport / authorization / lifecycle / outbox tests |

Domain code depends only on `realtime.publisher.ts`. Swapping SSE for
WebSocket/Socket.IO/a managed provider later means replacing
`realtime.service.ts` + `realtime.controller.ts` only — EMAIL, WhatsApp, Tickets
and Notifications are untouched.

### Frontend feature — `client/src/features/realtime/`

| File | Responsibility |
| --- | --- |
| `realtime.types.ts` | Mirror of the event contract + `parseRealtimeEvent` runtime guard |
| `realtime-client.ts` | One authenticated `fetch`-stream connection with backed-off reconnect |
| `realtime-event-handler.ts` | Maps each event to targeted TanStack Query invalidations |
| `realtime-provider.tsx` | One app-level connection for authenticated internal users; lifecycle |
| `realtime-client.test.ts` / `realtime.test.tsx` | Client tests |

`RealtimeProvider` is mounted once in `app-router.tsx` around all routes. It
opens **one** connection per browser tab (never one per ticket page).

---

## 2. Event contract

```ts
type RealtimeEvent =
  | { type: "ticket.message.created"; ticketId: string; messageId: string; visibility: "public" | "internal" }
  | { type: "ticket.updated"; ticketId: string }
  | { type: "notification.created"; notificationId: string | null }
  | { type: "notification.read"; notificationId: string };
```

Small invalidation events only — no `Ticket` / `TicketMessage` / `Customer` /
`User` / `Notification` records over the wire. This limits stale duplicated
state, authorization-leak risk, payload size and DTO coupling.

Wire frame:

```
id: 42
event: crm-event
data: {"type":"ticket.message.created","ticketId":"...","messageId":"...","visibility":"public"}

```

Heartbeat is an SSE comment every 25s: `: ping\n\n` (never business data).

---

## 3. Emission points (domain events first)

Providers are **not** coupled to SSE. Each event is emitted by the centralized
domain/service layer after the database work commits.

| Event | Emitted from | Triggers covered |
| --- | --- | --- |
| `ticket.message.created` | `ticket.service.addTicketMessage` / `addTicketNote`; `portal.service.reply`; `integrations/email` inbound; `integrations/whatsapp` inbound | Internal agent public reply, internal note, customer portal reply, inbound EMAIL, inbound WhatsApp |
| `ticket.updated` | `ticket.service.createTicket` / `updateTicket`; `sla-automation.service` (auto-assign + auto-escalate) | status, priority, assignment, category, department, branch, escalation, SLA auto-assignment |
| `notification.created` | `notifications.service.createNotifications` (the one centralized creator) | every notification, from every source (assignment, escalation, mentions, watchers, SLA, tasks, customer replies, inbound channels) |
| `notification.read` | `notifications.service.markRead` | single mark-as-read (multi-tab badge sync). `markAllRead` does not broadcast — the acting tab invalidates locally; other tabs self-heal on the next event / focus. |

`ticket.updated` is **not** emitted for a no-op `PATCH` (every provided field
equals its current value).

---

## 4. Transaction safety — `withRealtimeOutbox`

Events must reach clients only **after** the producing transaction commits,
otherwise the frontend refetches and reads stale/uncommitted data.

`withRealtimeOutbox(fn)` opens an `AsyncLocalStorage` buffer for the duration of
`fn`. Every `emit*` made while `fn` runs — including deep inside a
`prisma.$transaction` callback — is queued, and flushed only once `fn` resolves.
If `fn` throws (transaction rolled back) the buffer is discarded and nothing is
published.

Outside an outbox scope, `emit*` publishes immediately (safe for callers already
past their commit).

Service entrypoints wrapped in `withRealtimeOutbox`:
`ticket.service` (`addTicketMessage`, `addTicketNote`, `createTicket`,
`updateTicket`), `portal.service.reply`, `email.service.processInboundEmail`,
`whatsapp.service.processInboundTextMessage`, `sla-automation.runSlaMonitor`,
`task.service` (`createTask`, `updateTask`), `task-reminder.runTaskReminders`.

EMAIL rollback semantics are intact: if Resend processing or the DB transaction
fails, `processInboundEmail` throws before the flush and **no**
`ticket.message.created` is published (regression-tested).

---

## 5. Authorization

Events respect existing CRM RBAC. Nothing is broadcast to every authenticated
user. Resolved in `realtime.service.canReceive(subscriber, audience)`:

| Audience | Rule |
| --- | --- |
| `{ scope: "user", userId }` | Delivered only to connections for that user (notifications). |
| `{ scope: "ticket", ticketId, assignedAgentId }` | `ADMIN` / `MANAGER`: all tickets. `AGENT`: only when `assignedAgentId === null` or `assignedAgentId === <this agent>` — mirrors `ticket-visibility.ts`. |

The `assignedAgentId` on a ticket audience is a snapshot taken at emit time, so a
just-reassigned ticket routes to the new assignee. Internal notes carry
`visibility: "internal"` (the endpoint is internal-only today, so all internal
subscribers with ticket visibility receive them).

Ticket IDs, message IDs, notification IDs, assignment changes and customer
activity never reach an unauthorized connected user.

---

## 6. SSE endpoint & authentication strategy

`GET /api/realtime/events` — `requireAuth` + `requireRole(ADMIN, MANAGER, AGENT)`.

Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache,
no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`. The socket
timeout is disabled (`socket.setTimeout(0)`) and keep-alive enabled.

**Authentication:** the browser consumes this endpoint with `fetch` + a
`ReadableStream` reader — **not** native `EventSource` — specifically so the
existing `Authorization: Bearer <jwt>` header (JWT from `localStorage`,
`crm.authToken`) is sent unchanged. Consequences:

- No token in the URL, no query string, no new cookie, no second auth system.
- `verifyAccessToken` is reused as-is; JWT validation is not weakened.
- Tokens are never logged and never appear in event payloads.
- `Last-Event-ID` is sent on reconnect (harmless today; documented seam for
  future replay — not implemented, not required for this scope).

Rejected: putting a long-lived JWT in the URL, and any durable event queue
(Kafka / Redis Streams / RabbitMQ / event sourcing). Missed events self-heal:
on reconnect/focus, TanStack Query refetch restores the latest state.

---

## 7. Connection lifecycle

**Server:** each connection is a `RealtimeSubscriber` in an in-memory `Map`.
Removed on `request` `close` / `error` and on `response` `error`. A write to a
dead socket is caught and the subscriber dropped — it never throws into a
domain caller or crashes the process. A 25s heartbeat interval is created with
the first subscriber and cleared when the last one leaves; it is `unref`'d so it
never holds the process open. Multiple tabs for one user = multiple independent
subscribers.

**Client:** `createRealtimeClient` runs a single reconnect loop.

- Stream ends / network error → reconnect with full-jitter backoff
  `1s → 2s → 5s → 10s → 15s → 30s` (cap), avoiding a reconnect stampede after a
  backend restart.
- `401` / `403` → stop (token gone / rejected); `RealtimeProvider` recreates the
  client when the signed-in user changes.
- `close()` (logout, unmount, `auth:unauthorized` event) aborts the fetch and
  halts the loop.
- Malformed frames are dropped (logged in dev only), never thrown.
- Recovers automatically from laptop sleep, Wi-Fi reconnect, backend restart and
  proxy/network interruption. A failed realtime connection never breaks REST.

---

## 8. Frontend query invalidation

`handleRealtimeEvent(queryClient, event)` reuses the existing query-key
factories — no parallel key formats, no full-cache invalidation:

| Event | Invalidations |
| --- | --- |
| `ticket.message.created` | `ticketKeys.detail(ticketId)`, `ticketKeys.lists()` |
| `ticket.updated` | `ticketKeys.detail(ticketId)`, `ticketKeys.lists()`, `["dashboard"]` |
| `notification.created` / `notification.read` | `notificationKeys.lists()`, `notificationKeys.unreadCount()` |

Duplicate events are harmless — invalidate/refetch is idempotent, so there is no
client-side dedupe. Existing focus/reconnect refetch and the 30s unread-count
poll are kept as fallback; realtime is the primary signal. No `refetchInterval`
was added anywhere.

### Ticket conversation UX

An invalidated `ticketKeys.detail` refetches the open conversation in place. The
existing shared auto-scroll hook (`use-conversation-auto-scroll.ts`) already
follows new messages only when the reader is near the bottom and never calls
`.focus()`, so an incoming message does not yank a user reading history and does
not disturb composer draft, selected tab, attachments or note mode. No route or
window reload.

---

## 9. Customer portal

**Implemented.** An authenticated `CUSTOMER` opens the same single
application-level SSE connection as internal roles (`RealtimeProvider` now gates
on `user` alone, not `role !== "CUSTOMER"`). What a customer connection receives
is scoped entirely server-side:

- **Endpoint auth** — `realtime.routes.ts` `requireRole` now also lists
  `CUSTOMER`. Unauthenticated is still `401`. Nothing about the JWT check
  changed.
- **Ticket ownership** — when the stream is established, `realtime.controller.ts`
  resolves the caller's linked `Customer.id` **once** (`prisma.customer
  .findUnique({ where: { userId } })`) and stores it on the subscriber. No
  per-event query. `ticketId` from the client is never trusted — routing is
  `subscriber.customerId === audience.customerId`, where `audience.customerId` is
  the ticket's owner captured at emit time.
- **Audience metadata** — the `{ scope: "ticket" }` audience now carries
  `customerId` (owning portal account) and, for `ticket.message.created`,
  `visibility`. This is server-side authorization context only — it is **not**
  added to the SSE wire payload, which stays `{ type, ticketId, messageId?,
  visibility }`.
- **Public messages only** — `canReceive` returns `false` for a `CUSTOMER`
  subscriber whenever `audience.visibility === "internal"`. Internal notes never
  produce a customer-visible realtime event. The client handler drops an
  internal-visibility `ticket.message.created` for a `CUSTOMER` session as
  defence in depth.
- **`ticket.updated`** — delivered to the owning customer (no `visibility`
  field); it only triggers a REST refetch, and portal REST authorization remains
  the source of truth. No internal-only state is added to the payload.
- **Notifications** — user-scoped `notification.created` / `notification.read`
  are never routed to a `CUSTOMER` connection (`canReceive` short-circuits) and
  the client handler ignores them for a `CUSTOMER` session. The portal has no
  notification centre; scope was not broadened.
- **Query invalidation** — `handleRealtimeEvent(queryClient, event, role)`: for a
  `CUSTOMER` it invalidates `portalKeys.ticket(id)` + `portalKeys.tickets()`
  (message) and additionally `portalKeys.overview` (update). Internal
  `ticketKeys` / `notificationKeys` are untouched for that role. Refetch
  preserves composer text, scroll and selected ticket — TanStack Query only
  refreshes server state.

Internal (`ADMIN` / `MANAGER` / `AGENT`) visibility and notification targeting
are unchanged — the customer path is a separate branch in `canReceive`, never
folded into `ticket-visibility.ts`.

---

## 10. Deployment / runtime compatibility

- **Local (`npm run dev`, `node dist/server.js`):** persistent Node process —
  full long-lived SSE support, no artificial connection cap.
- **Vercel (`server/vercel.json`):** serverless functions bound each invocation
  by `maxDuration`. A long-lived SSE response is force-closed at that limit; the
  client's backed-off reconnect re-establishes it, so it *functions* but
  reconnects every few minutes and consumes a function invocation for the
  connection's lifetime. **Not recommended as-is for production realtime.**
  Options, in order of preference, none done here (no hosting migration in this
  task):
  1. Run the API as a persistent Node service (Render / Railway / Fly / a
     long-running container).
  2. Vercel Fluid Compute with an extended `maxDuration` (accept periodic
     reconnects).
  3. Replace the SSE transport with a managed realtime provider — the
     `realtime.publisher` seam means only `realtime.service.ts` +
     `realtime.controller.ts` change.
- No database schema change. No new dependency (client and server).
- Proxies: `X-Accel-Buffering: no` + `Cache-Control: no-transform` are set;
  a buffering CDN in front of the API would still delay events.

Production readiness for realtime is **not** claimed until the API runs on a
host that supports long-lived responses.

---

## 11. Manual QA checklist

### EMAIL realtime (do first)
1. Open an EMAIL ticket in the CRM; keep the page open.
2. Reply from Gmail as the customer.
3. The message appears with no browser reload, no duplicate.
4. Composer draft, selected tab, scroll position and note/public mode are intact.

### WhatsApp realtime
1. Open a WhatsApp ticket.
2. Send an inbound WhatsApp message.
3. It appears with no reload.

### Ticket updates
1. Open the same ticket (and the ticket list) in two authenticated sessions.
2. Change status / assignment in one.
3. The other view updates without reload.

### Notifications
1. Trigger a notification for another internal user (assign them a ticket).
2. Their header unread count updates without reload; the item is correct in the list.
3. Mark it read in one tab → a second tab of the same user drops the badge.

### Authorization
1. Sessions as ADMIN, MANAGER, AGENT.
2. Trigger events on a ticket assigned to a different agent.
3. The uninvolved AGENT session receives no update; ADMIN/MANAGER do.

### Reliability
1. Stop the backend → client shows reconnecting, app still usable via REST.
2. Restart the backend → client reconnects on its own within the backoff window.
3. Toggle network off/on → same.
4. No full-page reload occurs at any point.

---

## 12. Future live-chat path

If a true live-chat feature is built later: add presence / typing / read-receipt
events to the same contract, likely swap SSE for WebSocket via the
`realtime.publisher` seam. The customer-scoped connection already exists
(section 9). None of that changes ticket / email / WhatsApp / notification
business logic.
