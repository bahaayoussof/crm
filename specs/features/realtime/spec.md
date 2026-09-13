# Realtime

## Feature Status

**Brownfield feature — discovery complete, one confirmed implementation bug, no open product decisions, fast-tracked straight to implementation.**

| Aspect | State |
| --- | --- |
| Implementation | **Exists and is mature.** Backend `server/src/modules/realtime/` (SSE transport, transaction-safe publisher, authorization). Frontend `client/src/features/realtime/` (authenticated `fetch`-stream client, provider, event handler). Producers across `tickets`, `portal`, `assignment`, `sla-automation`, `live-chat`, `integrations/{email,sms,whatsapp}`, `notifications`. This is the third SDD pass to touch this surface — `conversations-channels` (CONV-019/020/052) already closed the two known `teamId`-omission defects on the *message* path (Email/WhatsApp inbound), and `notifications` already audited the notification producer side. This pass audits the *transport itself* plus the one producer family (`sla-automation`) neither prior pass covered end-to-end. |
| Brownfield discovery | **Completed** (2026-09-13). |
| Gaps requiring work | **Small.** One real audience/team-scope bug (RT-GAP-1, same defect class as the already-fixed CC-GAP-01/02, in a file those passes didn't touch) plus one intra-file documentation inconsistency (RT-GAP-2). Everything else audited below is already correct. |
| Human product decisions | **None required.** |
| Ready for `plan.md`? | **Done** — see `plan.md` / `tasks.md`. |
| Final status | **IMPLEMENTED + VERIFIED ON SDD BRANCH** (2026-09-13). See `tasks.md` "Honest status at end of implementation". |

---

## Purpose

Realtime is the cross-feature transport that turns a committed backend change (ticket status/assignment, a new public message or internal note, a notification) into an automatic frontend refresh, without polling or a manual reload. It is deliberately a **signal-only** layer: Server-Sent Events (SSE) tell a connected client "this changed, refetch it" — PostgreSQL via REST stays the only source of truth. This spec documents and audits that transport end-to-end: connection lifecycle/auth, the transaction-safe outbox pattern, every producer call site's audience correctness, and the frontend subscription/invalidation contract.

## Scope

### In scope (Realtime owns)

- The SSE endpoint (`GET /api/realtime/events`): connection auth, headers, heartbeat, disconnect/reconnect, per-connection state resolution (customer/team).
- The transport-neutral, transaction-safe publisher (`withRealtimeOutbox`, `emit*` helpers) — the seam every domain producer calls through.
- The event contract (`RealtimeEvent` union) and per-event audience authorization (`canReceive`).
- Auditing every existing producer call site for audience correctness (team/user/customer scope), not owning the business logic that decides *when* to emit — that belongs to each producer's own feature (Tickets, Conversations/Channels, Notifications, SLA Automation, Live Chat).
- The frontend transport (`realtime-client.ts`, `realtime-provider.tsx`) and the query-invalidation mapping (`realtime-event-handler.ts`).

### Out of scope / deferred (unchanged by this feature)

- Redis/pub-sub, multi-instance fanout, durable event replay/event sourcing, a WebSocket migration, a generic realtime abstraction rewrite, or performance tuning without evidence — all explicitly deferred architecture debt (see below).
- Business rules that decide *when* a domain event fires (Tickets, Conversations/Channels, Notifications, SLA Automation own those) — this pass audits only the *audience* each already-firing event reaches.
- Typing indicators, presence, read receipts, live cursors, WebRTC, chat rooms, arbitrary event broadcasting — never in scope per `docs/22-realtime-events.md` §"Deliberately not in scope".
- Re-litigating `conversations-channels`' already-implemented fixes (CONV-019/020/021/022/052) or `notifications`' already-implemented fixes (NOTIF-001–005) — those are verified done on this same branch; this spec does not re-test them beyond confirming they still hold (they do, by inspection of the current code).

---

## Existing Architecture (as documented in `specs/architecture.md` and audited directly against code)

### Transport: SSE, not WebSocket/Kafka/Redis

`GET /api/realtime/events` streams `text/event-stream` frames written with `response.write()`, held in an in-memory (single-process) `Map<string, RealtimeSubscriber>` registry (`realtime.service.ts`). No queue, no pub/sub, no WebSocket dependency exists in either `package.json`. This is a deliberate, documented architectural choice (ADR-045), not an oversight.

### Connection lifecycle

- **Auth**: the client uses `fetch` + a `ReadableStream` reader (`client/src/features/realtime/realtime-client.ts`), not native `EventSource`, specifically so the existing `Authorization: Bearer <jwt>` header rides along — no token in the URL, no cookie, no second auth path. `requireAuth` + `requireRole(ADMIN, MANAGER, AGENT, CUSTOMER)` gate the route (`realtime.routes.ts`); an unauthenticated request gets `401` before any SSE header is written (`realtime.controller.ts:22-25`, verified by `realtime.test.ts` "rejects an unauthenticated connection").
- **Per-connection state resolution**: for a `CUSTOMER`, the linked `Customer.id` is resolved once via `prisma.customer.findUnique` when the stream opens (never per event) and patched onto the subscriber; for `MANAGER`/`AGENT`, the actor's team id is resolved once via `resolveActorTeamId` (`shared/team/team-scope.ts`, the same helper used by every other team-scoped RBAC check in the codebase — no second team-resolution implementation). Until resolution completes the connection simply receives no ticket events (realtime is best-effort, never a blocking gate).
- **Heartbeat**: an SSE comment (`: ping\n\n`, never business data) every 25s, started with the first subscriber and `unref()`'d so it never holds the Node process open; cleared when the last subscriber leaves.
- **Disconnect/cleanup**: `request.on("close"/"error")` and `response.on("error")` all call `removeSubscriber`, which is idempotent (`realtime.test.ts` "removeSubscriber is idempotent"). A write to a dead socket is caught, logged only outside test env, and the subscriber is dropped without throwing into the publish loop (`realtime.test.ts` "a write to a dead connection is dropped without throwing").
- **Reconnect**: client-side full-jitter exponential backoff `1s → 2s → 5s → 10s → 15s → 30s`; a `401`/`403` stops the loop permanently (token gone/rejected) rather than retrying — `RealtimeProvider` recreates the client when the signed-in user changes. `Last-Event-ID` is sent on reconnect but not used for replay (no durable log exists to replay from — see Deferred Architecture Debt).
- **Multiple tabs**: each tab/device is an independent `RealtimeSubscriber` even for the same user — verified by `realtime.test.ts` "handles multiple subscribers for the same user across tabs". This is intentional (multi-tab/device correctness for notifications and ticket views), not a bug to dedupe.

### Persistence/recovery on reconnect

Realtime carries **no durable event log**. A dropped connection loses any events emitted while disconnected; there is no replay even though `Last-Event-ID` is sent (an intentional, documented seam — `docs/22-realtime-events.md` §6 calls this out explicitly: "harmless today; documented seam for future replay — not implemented, not required for this scope"). Recovery is **fully substitutive, not gap-filling**: the DB remains authoritative, and TanStack Query's own focus/reconnect refetch plus the periodic notification unread-count poll (30s, `notification-hooks.ts`) mean a client that missed N events during a disconnect still converges to the correct current state on its next fetch — it just does not replay the N individual events. This is the documented, accepted trade-off of a single-process, in-memory subscriber registry with no message broker.

### Event producers (verified against code, not docs, 2026-09-13)

| Event | Producers | Wrapped in `withRealtimeOutbox`? |
| --- | --- | --- |
| `ticket.message.created` | `ticket.service.ts` (`addTicketMessage`, `addTicketNote`), `portal.service.ts` (`reply`), `email.service.ts` (inbound), `sms.service.ts` (inbound), `whatsapp.service.ts` (inbound) | Yes, at every call site (transitively, via the caller's own outer `withRealtimeOutbox` scope in each service's public entrypoint) |
| `ticket.updated` | `ticket.service.ts` (`createTicket`, `updateTicket`, `selfAssignTicket`), `portal.service.ts` (`createTicket`), `sla-automation.service.ts` (auto-assign + auto-escalate), `live-chat.service.ts` (start + end), `live-chat-inactivity.service.ts` (sweep), `integrations/outbound-delivery.ts` (delivery callback), `integrations/outbound-delivery-retry.service.ts` (retry sweep) | Yes, all wrapped (`sla-automation.runSlaMonitor` and the two Live Chat sweeps open their own outbox scope; the ticket/portal paths open one per mutation entrypoint) |
| `notification.created` | `notifications.service.createNotifications` — the single centralized creator called by every ticket/assignment/escalation/mention/watcher/SLA/task/customer-reply/inbound-channel producer | Yes (buffers inside the caller's outbox scope, or publishes immediately if none is open — see Transaction Safety) |
| `notification.read` | `notifications.service.markRead` | Yes |

No producer writes `response.write` directly — `realtime.publisher.ts` is the sole seam (enforced by convention/code review, not a lint rule; verified by grep — no `response.write`/`res.write` call exists outside `realtime.service.ts`).

SLA/escalation events use the existing `ticket.updated` type (no dedicated `sla.*` event exists, nor is one needed — the frontend only needs to know the ticket record changed and refetch it). Tasks/reminders are **not** realtime-enabled: `TASK_ASSIGNED`/`TASK_REMINDER` only produce a `notification.created` event (via the shared notification creator), never a ticket-shaped event — this is correct, since a Task is not a Ticket and has no dedicated realtime audience/query key of its own on the client (`useTasks` relies on REST + the 30s notification poll + manual refresh, not SSE).

### Transaction safety — `withRealtimeOutbox`

`AsyncLocalStorage`-based outbox (`realtime.publisher.ts`): every `emit*` call made while a wrapped `fn` runs — including deep inside a `prisma.$transaction` callback — is buffered and flushed only once `fn` *resolves*. If `fn` throws (the transaction rolled back), the buffer is discarded and nothing is published. Outside an outbox scope, `emit*` publishes immediately (safe for a caller already past its own commit). This is the mechanism that satisfies "events must only be published after the underlying DB transaction commits" — verified directly by `realtime.test.ts`'s `withRealtimeOutbox` describe block (buffers-until-resolve, discards-on-throw, immediate-when-no-scope) and by four/five per-channel commit-first regression tests already existing in `email.test.ts`/`sms.test.ts`/`whatsapp.test.ts`/`ticket.test.ts` (per `conversations-channels/spec.md` "Strong existing coverage").

### Audience / authorization model

`canReceive(subscriber, audience)` in `realtime.service.ts` is the single authorization chokepoint (never bypassed — `publish()` calls it for every subscriber on every event):

- `{ scope: "user", userId }` (notifications): delivered only to that exact user id, and never to a `CUSTOMER` connection even if a user id somehow collided (defense in depth — the Portal has no notification centre by design, ADR-029).
- `{ scope: "ticket", ticketId, assignedAgentId, teamId, customerId, visibility? }`:
  - `ADMIN`: every ticket event, unconditionally.
  - `MANAGER`: only when `subscriber.teamId === audience.teamId` and both are non-null — an unrouted ticket (`teamId: null`) reaches no manager.
  - `AGENT`: `assignedAgentId === subscriber.userId` (assigned-to-self, any team), **or** `assignedAgentId === null && subscriber.teamId === audience.teamId` (unassigned-queue, own team only).
  - `CUSTOMER`: `subscriber.customerId === audience.customerId` **and**, for `ticket.message.created`, `audience.visibility !== "internal"` — an internal note is never routed to any customer connection under any circumstance, verified by `realtime.test.ts` "CUSTOMER never receives an internal-note ticket event, even for their own ticket" and defended a second time client-side in `realtime-event-handler.ts` ("Never let an internal note touch portal state, even if one leaked here").
- The wire payload never carries `assignedAgentId`/`teamId`/`customerId`/`visibility`-as-authorization — those live only in the server-side `RealtimeAudience` object, never serialized (`realtime.types.ts` comments confirm this by design, and `realtime.test.ts`'s `dataOf` helper on every audience test confirms the actual frames contain only `{type, ticketId, messageId?, visibility?}` / `{type, notificationId}`).

This mirrors `ticket-visibility.ts` + `shared/team/team-scope.ts` exactly — there is no second, divergent authorization implementation for realtime.

### Frontend subscription and invalidation

- `RealtimeProvider` (`realtime-provider.tsx`) mounts once around the whole route tree (`app-router.tsx`), opening exactly one connection per authenticated session regardless of role — internal or `CUSTOMER`. It is recreated when `userId`/`role` changes (login/logout/account switch) and torn down on unmount or a global `auth:unauthorized` event (fired by the shared axios client on any 401). A failed/dropped connection never breaks the app shell — it is caught and reported only via `RealtimeStatusContext`, consumed for UI status only, never gating REST or mutations.
- `handleRealtimeEvent(queryClient, event, role)` (`realtime-event-handler.ts`) maps each event to targeted TanStack Query invalidations, reusing existing key factories — never a full-cache invalidation:
  - `ticket.message.created` (internal): `ticketKeys.detail(id)`, `ticketKeys.lists()`, `managerKeys.all`.
  - `ticket.message.created` (customer): `portalKeys.ticket(id)`, `portalKeys.tickets()`, `liveChatKeys.root` — with an explicit early-return defense-in-depth guard dropping any `visibility: "internal"` frame before it can touch portal state.
  - `ticket.updated` (internal): `ticketKeys.detail(id)`, `ticketKeys.lists()`, `["dashboard"]`, `managerKeys.all`.
  - `ticket.updated` (customer): `portalKeys.ticket(id)`, `portalKeys.tickets()`, `portalKeys.overview`, `liveChatKeys.root`.
  - `notification.created`/`notification.read`: `notificationKeys.lists()`, `notificationKeys.unreadCount()` — short-circuited entirely for a `CUSTOMER` role (no notification centre).
- Duplicate/replayed events are harmless by construction: invalidate → refetch is idempotent, so no client-side dedupe exists or is needed (verified conceptually — there is no event-id tracking on the client, and none is required since the events carry no state to double-apply).
- Malformed frames are dropped (`parseRealtimeEvent` runtime guard), never thrown; a dev-only `console.warn` is the only side effect.

---

## Discovered Gaps

| ID | Classification | Description | Disposition |
| --- | --- | --- | --- |
| RT-GAP-1 | **Implementation bug (missing team scope)** | `sla-automation.service.ts`'s `escalateBreachedTickets` emits `ticket.updated` for a just-escalated ticket **without** `teamId` (`emitTicketUpdated({ ticketId: ticket.id, assignedAgentId: ticket.assignedAgentId, customerId: ticket.customerId })` — `ticket.teamId` is already selected in the candidate query at line 92 but never passed). `emitTicketUpdated` defaults an omitted `teamId` to `null`, so `canReceive` routes the resulting audience as unrouted: the escalated ticket's own-team **MANAGER** never receives the invalidation (their team-scope check requires `subscriber.teamId === audience.teamId`, and `null !== "team-a"`), and an **unassigned** escalation would also be missed by that team's unassigned-queue AGENTs. Only ADMIN and the ticket's already-assigned AGENT (via the separate `assignedAgentId` match, unaffected by `teamId`) still receive it. This is the exact same defect class as the already-fixed `CC-GAP-01`/`CC-GAP-02` (Email/WhatsApp inbound message `teamId` omission), in a producer file neither the `conversations-channels` nor `notifications` SDD passes audited (SLA Automation is its own feature). The already-persisted `SLA_BREACH_ESCALATION` **notification** (separately, correctly, team-scoped per `notifications/spec.md`) still reaches the manager — so a manager is not left uninformed forever, but their open ticket list/detail view does not live-refresh on the escalation the way ADMIN's or the assignee's does; a hard page refresh is needed to see the `ESCALATED` status without waiting for the notification to be read. | **Fix now** (RT-001). |
| RT-GAP-2 | **Documentation drift** | `docs/22-realtime-events.md` §6 states `GET /api/realtime/events — requireAuth + requireRole(ADMIN, MANAGER, AGENT)`, which is stale — the actual route (`realtime.routes.ts`) and the same document's own §9 ("Customer portal — Implemented") both confirm `CUSTOMER` is included and has been since the Customer Portal realtime work landed. This is the same drift already flagged as `CC-DG-05` in `conversations-channels/spec.md` (which found it from the ADR/Conversations angle); this pass confirms it from the Realtime-transport angle and fixes the specific stale line since it sits in the doc this feature owns. | **Fix now, doc-only** (RT-002). |
| RT-GAP-3 | **Architecture debt (documented, accepted, unchanged)** | Single-process, in-memory subscriber registry: no Redis/pub-sub, no multi-instance fanout. A deployment with more than one API instance (or Vercel serverless with concurrent invocations) would only deliver an event to subscribers connected to the *same* process instance that handled the write. `docs/22-realtime-events.md` §10 already documents this as "not recommended as-is for production realtime" with three explicit, undone remediation options. No code change — this is exactly the "process-local/single-instance SSE is fine to keep as-is" case named in this task's own brief. | **Defer, already documented.** |
| RT-GAP-4 | **Architecture debt (documented, accepted, unchanged)** | No durable event log / replay. `Last-Event-ID` is sent by the client but never consulted server-side. A client offline for the outage window sees no historical events, only current state on its next REST fetch. Explicitly called out as an accepted trade-off in `docs/22-realtime-events.md` §6 and restated above under "Persistence/recovery on reconnect". | **Defer, already documented.** |
| RT-GAP-5 | **Test gap** | No existing regression test asserts `teamId` is present on the `emitTicketUpdated` call inside `escalateBreachedTickets` (the existing escalation test at `sla-automation.test.ts` "escalates only resolution-breached unresolved tickets and notifies the team manager and admins" asserts the notification recipients and the `ticketUpdateMany` call, but never inspects the `emitTicketUpdated` mock's arguments) — this is exactly why RT-GAP-1 went undetected by the existing suite. | **Fix now** (RT-004, alongside the RT-001 code fix). |

No other audience defect, pre-commit emission, duplicate-connection bug, broken invalidation, or customer/internal leakage was found anywhere else in the transport or its producers. In particular:

- Every other `emitTicketUpdated`/`emitTicketMessageCreated` call site (`ticket.service.ts` ×4, `portal.service.ts` ×2, `live-chat.service.ts` ×2, `live-chat-inactivity.service.ts`, `integrations/outbound-delivery.ts`, `integrations/outbound-delivery-retry.service.ts`, `email.service.ts`, `sms.service.ts`, `whatsapp.service.ts`) already passes `teamId` correctly (the Email/WhatsApp inbound cases were fixed under `conversations-channels` CONV-019/020, verified still present in the current code).
- No producer publishes before its transaction commits — every call site is inside a `withRealtimeOutbox` scope opened by the entrypoint, or is a caller already past its own commit.
- No internal-only content (internal notes, internal ticket fields) is ever emitted toward a `CUSTOMER` audience — enforced server-side (`canReceive`'s `visibility` check) and again client-side (defense in depth in `realtime-event-handler.ts`).
- No org-wide broadening exists anywhere in `canReceive` — ADMIN's "sees everything" is the sole intentional exception, matching every other RBAC surface in the codebase (ADMIN is unrestricted org-wide by design, e.g. `ticket-visibility.ts`).
- The SSE endpoint correctly rejects an unauthenticated connection with `401` before any stream header is written, and there is no alternate unauthenticated realtime entrypoint.
- Duplicate-connection handling (multiple tabs/devices for one user) is intentional multi-session correctness, not a bug — each tab gets its own subscriber and its own independent invalidation stream; there is no dedupe requirement here (unlike DB writes, an extra client-side refetch is free/idempotent).

---

## Acceptance Criteria

1. `GET /api/realtime/events` without a valid JWT returns `401` before any SSE header is written (already true, verified — no change).
2. A `MANAGER` connected for `team-a` receives `ticket.updated` when a `team-a` ticket is auto-escalated by the SLA monitor (currently fails — fixed by RT-001).
3. An `AGENT` in `team-a`'s unassigned queue receives `ticket.updated` when an unassigned `team-a` ticket is auto-escalated (currently fails — fixed by RT-001).
4. `ADMIN` and the ticket's already-assigned `AGENT` continue to receive the escalation event exactly as before (regression guard — must not change).
5. `docs/22-realtime-events.md` §6 accurately states the SSE route's allowed roles, matching `realtime.routes.ts` and the document's own §9 (fixed by RT-002).
6. No new SSE event type is introduced; no schema/migration/route/RBAC contract change; `RealtimeEvent`/`RealtimeAudience` unions are unchanged in shape.
7. Existing full transport test suite (`realtime.test.ts`) and every already-passing producer test (`sla-automation.test.ts`, `ticket.test.ts`, `email.test.ts`, `sms.test.ts`, `whatsapp.test.ts`, `notification.test.ts`, client `realtime-client.test.ts` / `realtime.test.tsx`) remain green after the fix.
