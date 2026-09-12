# Tickets — Implementation Plan

Companion to [`spec.md`](./spec.md). Covers the six human-approved changes (OD-1 … OD-6, OD-5 = defer). Brownfield: every change is anchored to a real existing seam in the repository. This plan describes **how**; it changes no code.

---

## 1. Plan Status

- **Brownfield.** The Tickets domain ships end-to-end (`server/src/modules/tickets/`, `client/src/features/tickets/`, `Ticket` + related Prisma models).
- **Spec finalised** — `spec.md` is `READY FOR PLAN`; all discovery-phase Open Decisions resolved by the human on 2026-09-10.
- **Human decisions resolved** — OD-1 fix reopen SLA; OD-2 audit routing changes; OD-3 portal-create realtime; OD-4 `channel` list filter; OD-5 defer SLA pause; OD-6 team-scope customer-ticket history (Case B — fix).
- **Implementation planning: complete.**
- **Tasks not yet generated** — `tasks.md` is deliberately not created; it waits for human review of this plan + the finalised spec.

**Status: `IMPLEMENTED` (2026-09-10, branch `chore/sdd-foundation`)** — kept as the historical planning record.

Delivered exactly as planned: one new `AUDIT_ACTIONS.TICKET_ROUTING_CHANGED` constant, one additive `channel` query param (+ canonical frontend filter), one reused visibility helper (`teamScopedTicketWhere`) applied in `listCustomerTickets`, and the OD-1 reopen clause + OD-3 portal-create outbox — all behaviour correction inside existing transactions/seams. No Prisma schema change, no migration, no new dependency. Per-task verification evidence is in [`tasks.md`](./tasks.md).

---

## 2. Goals

| # | Goal | Approved by |
| --- | --- | --- |
| G1 | Manual `RESOLVED → IN_PROGRESS` clears `resolvedAt`, retains `resolutionDueAt`, and lets the ticket re-enter live SLA evaluation (no fresh deadline). | OD-1 / DG-4 |
| G2 | A ticket-routing change (`departmentId` / `branchId` / `teamId`) writes exactly one safe `AuditLog` row (`TICKET_ROUTING_CHANGED`), in the update transaction, ids only, none on no-op / rejected. | OD-2 / DG-5 |
| G3 | Portal (`CUSTOMER`) ticket creation emits the canonical post-commit `ticket.updated` event so connected staff (ADMIN) see new portal work without a refresh. No new `AuditLog` requirement. | OD-3 / DG-6 |
| G4 | `GET /tickets` accepts a `channel` query filter (server Zod + Prisma `where` + canonical frontend filter UI), RBAC-safe, composable with all existing filters + pagination. | OD-4 / DG-7 |
| G5 | `GET /api/customers/:id/tickets` obeys the canonical team-scoped ticket-visibility model — MANAGER constrained to their managed team; ADMIN / AGENT unchanged. | OD-6 / DG-11 |
| G6 | Regression coverage for all of the above, plus proof that `WAITING_CUSTOMER` SLA countdown semantics are unchanged (OD-5 guard). | — |
| G7 | Preserve every existing API shape, route, status code, RBAC rule, lifecycle rule, and realtime contract not explicitly changed above. | — |

---

## 3. Non-Goals

Explicitly excluded from this plan and from any generated task:

- SLA **pause / resume** while `WAITING_CUSTOMER`, business-hours calendars, per-ticket SLA overrides (OD-5 — future SLA SDD feature).
- Creating a **fresh `resolutionDueAt`** on reopen, or any recalculation of resolution SLA on reopen.
- A broad `TicketHistory` redesign, or a new `TicketHistory` action for routing (OD-2 is `AuditLog`-only).
- A broad `AuditLog` redesign; auditing inbound-channel or portal ticket **creation** (a separate future decision covering all four non-internal creation paths together).
- A new realtime transport, Socket.IO, a new SSE event type, or a durable event queue.
- Channel-provider rewrites; changing webhook signature schemes; `channel` change after ticket creation.
- A new role, a new permission, or changes to `requireRole` allowlists.
- Ticket deletion behaviour.
- An independent sender-verification system for inbound channels (DG-10 stays an accepted boundary).
- Unrelated ticket-list filter redesign, unrelated UI redesign, `createdAt` date-range list filter.
- Any change to the customer-portal ticket **listing** contract (OD-4 is internal-only).

---

## 4. Current Architecture Seams

Verified by inspection on `chore/sdd-foundation`.

### Backend — ticket mutation & query

| Seam | File / symbol | Role |
| --- | --- | --- |
| Ticket update (status / priority / assignment / category / routing) | `server/src/modules/tickets/ticket.service.ts` → `updateTicket()` (≈ L341–512) | Single generic `PATCH /tickets/:id` path. Builds `data`, runs `prisma.$transaction` (`timeout: 15_000`), writes `TicketHistory` (`events[]`, L400–405) + `AuditLog` (`auditEvents[]`, L406–412), notifications, watcher fan-out; computes `changed` (L490–499); emits `emitTicketUpdated` post-commit when `changed`. |
| Transition table + rules | `ticket.service.ts` → `const transitions` (L43–50), `validateTransition()` (L605–608), `enforceMutationPermissions()` (L598–603) | State machine; AGENT field allowlist; ESCALATED role gate. |
| Resolution-timestamp writes | `ticket.service.ts` L390–391 (`data.resolvedAt = now` / `data.closedAt = now` — **set only, never cleared on manual reopen**) | The DG-4 fault line. |
| SLA priority-recalc | `ticket.service.ts` L393–397 | Precedent for "recompute deadlines inside the update transaction". |
| Agent self-claim | `ticket.service.ts` → `selfAssignTicket()` (L521–567) | Separate atomic path; does not touch routing/resolution — untouched by this plan. |
| Ticket list query | `ticket.service.ts` → `listTickets()` (L52–91); schema `ticket.schema.ts` → `ticketListQuerySchema` (L6–26) | Builds `where` from validated query; `where` shared by `findMany` + `count` in one `$transaction`. Visibility via `ticketListVisibilityWhere`. |
| Visibility builders | `server/src/modules/tickets/ticket-visibility.ts` → `ticketVisibilityWhere`, `ticketListVisibilityWhere` | Role + team `where` fragments. |
| Team-scope helpers | `server/src/shared/team/team-scope.ts` → `resolveActorTeamId()`, `teamScopedTicketWhere(actor, teamId)` (MANAGER → `{ teamId }` / `MATCH_NOTHING`; others → `{}`) | The canonical, reused team-scope fragment — **this is the OD-6 fix ingredient.** |
| SLA derivation | `server/src/shared/sla/derive-sla.ts` → `deriveSla()` (guard L24: `RESOLVED`/`CLOSED`/`resolvedAt`/`closedAt` → `MET`) | Consumes `resolvedAt`; no change needed once G1 clears it. |
| SLA list filter | `server/src/shared/sla/sla-filter.ts` → `slaFilterWhere()` (`UNRESOLVED` requires `resolvedAt: null`) | No change needed once G1 clears `resolvedAt`. |
| SLA cron | `server/src/modules/sla-automation/sla-automation.service.ts` → `escalateBreachedTickets()` (requires `resolvedAt: null`) | No change needed once G1 clears `resolvedAt`. |
| `AuditLog` helper + vocab | `server/src/modules/audit-logs/audit-log.service.ts` → `createAuditLog(input, tx)`, `changedFields(before, after, fields)`; `audit-log.constants.ts` → `AUDIT_ACTIONS`, `AUDIT_ENTITY_TYPES` | `createAuditLog` already used inside `updateTicket`. **`AUDIT_ACTIONS.TICKET_ROUTING_CHANGED` does not exist yet** — one constant to add. `changedFields` produces exactly the `{field:{from,to}}` shape. |
| Audit request context | `ticket.controller.ts` passes `getAuditRequestContext(request)` into `updateTicket` → threaded to `createAuditLog` (ip/ua). | Reuse as-is. |
| Realtime publish | `server/src/modules/realtime/realtime.publisher.ts` → `withRealtimeOutbox()`, `emitTicketUpdated({ ticketId, assignedAgentId, customerId, teamId? })`; audience routing `realtime.service.ts` → `canReceive()` | Post-commit outbox. `emitTicketUpdated` with `teamId: null` + `assignedAgentId: null` → audience = ADMIN only. **This is the OD-3 fix ingredient.** |
| Portal ticket create | `server/src/modules/portal/portal.service.ts` → `createTicket()` (L76–98) | `prisma.$transaction` only — **no `withRealtimeOutbox`, no emit**. `withRealtimeOutbox` + `emitTicketMessageCreated` already imported (used by `reply()`); `emitTicketUpdated` is **not** imported yet. |
| Customer-ticket history | `server/src/modules/customers/customer.service.ts` → `listCustomerTickets(customerId, query, actor)` (L93–113) | `where = { customerId }` **only — no visibility predicate**. Controller already passes `{ userId, role }`. **This is the OD-6 fault line.** |

### Frontend — canonical ticket list & filters

| Seam | File / symbol | Role |
| --- | --- | --- |
| List page + URL params | `client/src/features/tickets/ticket-list-page.tsx` → `TicketListPage` | `useSearchParams`; reads each filter from the query string; `setFilter(key, value)` writes it back and resets `page`; `onClearFilters` deletes the filter keys; `getEmptyMessage()` builds contextual empties. |
| Filter popover | `client/src/features/tickets/ticket-filters-popover.tsx` → `TicketFiltersPopover` | Renders the status / priority / category / agent / department / branch `<select>`s from `*Options` arrays + `onFilterChange` / `onClearFilters`. |
| Query hook + keys | `client/src/features/tickets/ticket-hooks.ts` → `useTickets(filters)`, `ticketKeys.list(filters)` | `filters` object is the query key; passed straight to `getTickets`. |
| API + types | `ticket-api.ts` → `getTickets(filters)` (Axios `params`); `ticket.types.ts` → `TicketFilters`, `TicketChannel` (`"WEB" \| "EMAIL" \| "WHATSAPP" \| "SMS" \| "LIVE_CHAT"` — already defined), `TICKET_CREATE_CHANNELS` (excludes `LIVE_CHAT`). |
| Localisation | `client/src/locales/{en,ar}/*.json` — `tickets.status.*`, `tickets.allStatuses`, `tickets.noStatusMatches`, etc. Channel labels for badges may already exist (`tickets.channel.*`); verify during tasks. |
| Realtime → cache | `client/src/features/realtime/realtime-event-handler.ts` — `ticket.updated` already invalidates `ticketKeys.detail`, `ticketKeys.lists()`, `["dashboard"]` for internal roles. **No client change for OD-3.** |

### Tests

| Suite | File | Touched by |
| --- | --- | --- |
| Ticket API / lifecycle / assignment / SLA | `server/src/modules/tickets/ticket.test.ts` | G1, G2, G4 |
| Customer-ticket history | `server/src/modules/customers/customer.test.ts` (L47–105; **L72 asserts MANAGER = FULL for all — must be split**) | G5 |
| Portal | `server/src/modules/portal/portal.test.ts` | G3 |
| Realtime routing/outbox | `server/src/modules/realtime/realtime.test.ts` | G3 (audience sanity) |
| SLA cron | `server/src/modules/sla-automation/sla-automation.test.ts` | G1 (reopened ticket now escalatable) |
| Frontend ticket pages | `client/src/features/tickets/ticket-pages.test.tsx` | G4 |

---

## 5. OD-1 Implementation Plan — Reopen SLA Fix (G1)

### Behaviour

On a **real** status transition `RESOLVED → IN_PROGRESS` through `updateTicket()`:

- set `data.resolvedAt = null`;
- **do not** touch `resolutionDueAt`, `firstResponseDueAt`, `firstRespondedAt`, `closedAt`;
- everything else (transition validation, `STATUS_CHANGED` history, `TICKET_STATUS_CHANGED` audit, notifications, watcher fan-out, `ticket.updated` emit) is unchanged and already fires for a status change.

No new SLA snapshot. `deriveSla`, `slaFilterWhere`, and the SLA-monitor already behave correctly once `resolvedAt` is `null` — **no change to those files**.

### Seam

`ticket.service.ts` `updateTicket()`, in the `data` builder next to L390–391:

```
if (input.status === TicketStatus.RESOLVED && current.status !== TicketStatus.RESOLVED) data.resolvedAt = now;
if (input.status === TicketStatus.CLOSED   && current.status !== TicketStatus.CLOSED)   data.closedAt   = now;
// NEW:
if (input.status === TicketStatus.IN_PROGRESS && current.status === TicketStatus.RESOLVED) data.resolvedAt = null;
```

`validateTransition(current.status, input.status, role)` already permits `RESOLVED → IN_PROGRESS` for every role that reaches this path (AGENT only on self-assigned; ESCALATED gate irrelevant here) — no change.

### Channel-driven reopen — reuse, don't duplicate

`portal.service.reply()` and `email.service` already clear `resolvedAt` on `RESOLVED → OPEN` (`{ status: OPEN, resolvedAt: null }`). WhatsApp/SMS never reopen `RESOLVED`. The manual path is the only gap. The manual clause is a single expression; extracting a shared helper is **not** warranted (the three call sites set different target statuses and already inline it). Document in the code comment that all reopen paths share the "clear `resolvedAt`, keep `resolutionDueAt`" rule.

### Transaction / side effects

Entirely inside the existing `updateTicket` `$transaction`. Atomicity unchanged. `changed` is already `true` for a status change, so `ticket.updated` already fires. No notification/history change beyond what a `STATUS_CHANGED` already produces.

### Interaction with `WAITING_CUSTOMER` (OD-5 guard)

The new clause only matches `current.status === RESOLVED`. It cannot fire for a `WAITING_CUSTOMER` ticket. Add an explicit regression test proving a `WAITING_CUSTOMER` ticket's `resolutionDueAt` / breach / escalation behaviour is byte-identical before and after this change.

### Tests (`ticket.test.ts`)

1. `RESOLVED → IN_PROGRESS` (ADMIN): `resolvedAt` becomes `null`, `resolutionDueAt` unchanged, `STATUS_CHANGED` history + `TICKET_STATUS_CHANGED` audit written once.
2. Same for a self-assigned `AGENT`.
3. After reopen, `GET /tickets/:id` `slaState` is derived from `resolutionDueAt` (not `MET`); a fixture whose `resolutionDueAt` is in the past → `BREACHED`; in the future → `ON_TRACK`/`AT_RISK`.
4. After reopen, `GET /tickets?sla=breached` (ADMIN) includes the reopened past-deadline ticket.
5. After reopen, the SLA-monitor cron escalates the reopened past-deadline ticket (extend `sla-automation.test.ts`).
6. `firstRespondedAt` / `firstResponseDueAt` unchanged by reopen.
7. No-op `PATCH` (`status: IN_PROGRESS` on an already-`IN_PROGRESS` ticket) does not write `resolvedAt` and emits no `ticket.updated`.
8. `RESOLVED → CLOSED` still sets `closedAt`, keeps `resolvedAt` (terminal path unaffected).
9. `WAITING_CUSTOMER` SLA regression (OD-5 guard) — unchanged.
10. Channel-driven reopen (`portal.test.ts` existing tests) still green.

---

## 6. OD-2 Implementation Plan — Routing AuditLog (G2)

### Vocabulary (add once)

`server/src/modules/audit-logs/audit-log.constants.ts` — add to `AUDIT_ACTIONS`:

```
TICKET_ROUTING_CHANGED: "TICKET_ROUTING_CHANGED",
```

One coherent action (not three) — matches the "one action per logical change" convention (`TICKET_STATUS_CHANGED`, `TICKET_CATEGORY_CHANGED`). `AUDIT_ENTITY_TYPES.TICKET` already exists. No schema change (`AuditLog.action` is a free string; `metadata` is JSON).

### Where routing changes happen

Only `updateTicket()` (`PATCH /tickets/:id`). `departmentId` / `branchId` / `teamId` arrive via `updateTicketSchema` (all `nullableDatabaseIdSchema`), are validated by `validateRelations()`, and land in `data` at L386–389. `teamId` can also change implicitly via `adoptTeamId` (unrouted ticket adopts an assignee's team) and — separately — automatic assignment fills the assignee but does **not** change `teamId`. Live-chat / portal / inbound creation set routing at insert time (creation, not a routing *change*) → out of scope per OD-3/Non-Goals.

**Decision:** audit an *explicit* routing field change in the request (`input.departmentId`/`input.branchId`/`input.teamId` present and different from `current`), **and** the `adoptTeamId` implicit team adoption (it is a real ownership change). Do **not** emit a routing row for auto-assignment (it changes the assignee, not `teamId`).

### Implementation

In `updateTicket()`, alongside the existing `auditEvents` array (L406–412), build routing changes from the already-loaded `current` (which selects `departmentId`, `branchId`, `teamId`) vs the resolved new values:

```
const routingChanges: AuditChanges = {};
if (input.departmentId !== undefined && input.departmentId !== current.departmentId)
  routingChanges.departmentId = { from: current.departmentId, to: input.departmentId };
if (input.branchId !== undefined && input.branchId !== current.branchId)
  routingChanges.branchId = { from: current.branchId, to: input.branchId };
const effectiveNewTeamId = input.teamId !== undefined ? input.teamId : (adoptTeamId ?? current.teamId);
if (effectiveNewTeamId !== current.teamId)
  routingChanges.teamId = { from: current.teamId, to: effectiveNewTeamId };

if (Object.keys(routingChanges).length)
  await createAuditLog({ actorId: actor.userId, action: AUDIT_ACTIONS.TICKET_ROUTING_CHANGED,
    entityType: AUDIT_ENTITY_TYPES.TICKET, entityId: ticketId, changes: routingChanges, requestContext }, tx);
```

- **ID values only** — `metadata.changes` carries `departmentId` / `branchId` / `teamId` ids (or `null`). No names, no bodies, no subject. `createAuditLog` already strips nothing extra; caller controls `changes`.
- **Same transaction** as the mutation (`tx`), exactly like the existing `TICKET_STATUS_CHANGED` etc. If `createAuditLog` throws, the whole `updateTicket` transaction rolls back — matches the established invariant for ticket audit writes.
- **No row on no-op** — the `!== current` guards handle it; also `updateTicketSchema.refine(hasAtLeastOneField)` already rejects an empty body.
- **No row on a rejected update** — `enforceMutationPermissions`, `validateTransition`, `validateRelations`, and the team invariants all throw **before** this code runs (AGENT can't send routing fields at all — `enforceMutationPermissions` allowlist is `status`/`priority`, so an AGENT routing attempt is `403` with no write).

### Related micro-fix (fold in)

`changed` (L490–499) currently omits `teamId`, so a pure re-route with no auto-assignment does not emit `ticket.updated`. Add `|| (effectiveNewTeamId !== current.teamId)` to `changed` so a re-route pushes to the (new-team) realtime audience. Low-risk, correctness-positive, in the same function.

### Tests (`ticket.test.ts`)

1. `PATCH` changing `teamId` → one `TICKET_ROUTING_CHANGED` audit row, `changes.teamId = { from, to }` (ids), same tx.
2. `PATCH` changing `departmentId` + `branchId` together → one row, both keys present.
3. Unrouted ticket assigned an agent (team adoption via `adoptTeamId`) → routing row with `changes.teamId = { from: null, to: <agentTeam> }`.
4. `PATCH` submitting the current `teamId` value unchanged (no-op) → **no** routing row.
5. Rejected `PATCH` (invalid team → `400 INVALID_TEAM`; AGENT sending `teamId` → `403`) → **no** routing row, no partial write.
6. `PATCH` changing `teamId` **and** `status` → routing row **and** `TICKET_STATUS_CHANGED` row, both committed.
7. Routing row metadata contains no `subject` / `description` / names / secrets (assert shape).
8. `GET /api/audit-logs?action=TICKET_ROUTING_CHANGED` (ADMIN) returns the row with the safe `changes` diff; MANAGER/AGENT → `403` (unchanged).
9. Re-route now emits `ticket.updated` (the `changed` micro-fix).

---

## 7. OD-3 Implementation Plan — Portal Creation Realtime (G3)

### Canonical event

`ticket.updated` — verified as the right choice: it is emitted by internal `createTicket` and by `live-chat` creation for exactly this "a ticket now exists / changed, refetch lists" purpose; the client handler already invalidates `ticketKeys.lists()` + `["dashboard"]` on it. No new event type. `ticket.message.created` is wrong (no message is created).

### Seam & change

`portal.service.ts` `createTicket()` (L76–98):

1. Add `emitTicketUpdated` to the existing `import { emitTicketMessageCreated, withRealtimeOutbox } from "../realtime/realtime.publisher.js"`.
2. Wrap the existing `prisma.$transaction(...)` in `withRealtimeOutbox(async () => { ... })` (same pattern already used by `portal.service.reply()` right below it).
3. Extend the `tx.ticket.create` `select` to also return `id` (already there) — `teamId` and `assignedAgentId` are known to be `null` for a portal-created ticket (server-owned), so pass literals; `customerId` is the in-scope `customerId` variable.
4. After the transaction resolves, `emitTicketUpdated({ ticketId: ticket.id, assignedAgentId: null, customerId, teamId: null })`.

### Audience

`emitTicketUpdated` with `teamId: null`, `assignedAgentId: null` → `canReceive`: `ADMIN` → true; `MANAGER` → false (`audience.teamId` null); `AGENT` → false (`assignedAgentId` null **and** `teamId` null); `CUSTOMER` → false (the creating customer's own `customerId` matches, but `ticket.updated` carries no `visibility` and `canReceive` for a CUSTOMER ticket-scope event checks `subscriber.customerId === audience.customerId` → the creator *would* receive it). **Acceptable:** it only triggers a REST refetch of the customer's own portal lists, which is harmless/beneficial. Confirm in a test that no internal-only data crosses and no other customer receives it.

### Post-commit guarantee

`withRealtimeOutbox` buffers `emitTicketUpdated` and flushes only after the callback resolves; a thrown/rolled-back transaction discards the buffer. Matches every other ticket emit.

### No audit change

Portal creation keeps writing only its `TICKET_CREATED` `TicketHistory` row. No `AuditLog` row (OD-3 explicit).

### Tests (`portal.test.ts`, + `realtime.test.ts` if a helper exists)

1. `POST /api/portal/tickets` → exactly one `ticket.updated` event for the new ticket id, emitted after commit.
2. A forced transaction failure (e.g. invalid category) → **no** event.
3. Event delivered to a connected `ADMIN` subscriber; **not** delivered to a `MANAGER` / `AGENT` subscriber with no team; **not** delivered to a *different* customer's subscriber.
4. `TICKET_CREATED` `TicketHistory` row still written (existing assertion) and **no** `AuditLog` row created.
5. Existing portal-create response shape (`listSelect` projection) unchanged.

---

## 8. OD-4 Implementation Plan — Channel Filter (G4)

### Backend

**Schema** (`ticket.schema.ts` `ticketListQuerySchema`, `.strict()`):

```
channel: z.nativeEnum(Channel).optional(),
```

All five `Channel` values valid for the *filter* (a `LIVE_CHAT` ticket is a normal internal ticket). This is intentionally wider than `createTicketSchema.channel` (which excludes `LIVE_CHAT`) — note it in a schema comment. An invalid value → the existing `400 VALIDATION_ERROR` from `validateQuery`.

**Service** (`ticket.service.ts` `listTickets()`): add to the `where` object next to the other exact-match filters:

```
...(query.channel && { channel: query.channel }),
```

`where` is shared by `findMany` + `count` (one `$transaction`) → pagination `meta.total` stays correct. It is ANDed after `ticketListVisibilityWhere(...)`, so it can only *narrow* a scoped list — an AGENT cannot widen their set. No RBAC branch needed (unlike `assignee` / `sla`, which are ADMIN/MANAGER-only operational shortcuts; a plain attribute filter is fine for AGENT).

**Types** (`ticket.types.ts` client `TicketFilters`): add `channel?: TicketChannel`.

### Frontend

`ticket-list-page.tsx`:

- read `const channel = channels.includes(params.get("channel") as TicketChannel) ? ... : undefined;` (mirror the `status` pattern; `channels` = the 5-value list).
- pass `channel` into `useTickets({ ... })`.
- add `channelOptions = [{ value: "", label: t("tickets.allChannels") }, ...channels.map(v => ({ value: v, label: t(\`tickets.channel.${v}\`) }))]`.
- pass `channel` + `channelOptions` into `<TicketFiltersPopover>`; include `channel` in `hasFilters`, in `onClearFilters` (`next.delete("channel")`), and in `getEmptyMessage` (new `tickets.noChannelMatches`).

`ticket-filters-popover.tsx`: add a `channel` `<select>` block modelled on the existing `status` block (`channel`, `channelOptions` props; `onFilterChange("channel", value)`).

**Localisation** (`locales/en` + `locales/ar`, in lockstep): `tickets.allChannels`, `tickets.channel.WEB|EMAIL|WHATSAPP|SMS|LIVE_CHAT` (reuse existing keys if channel badges already define them — verify), `tickets.noChannelMatches`. RTL: the popover is already logical-property styled; the new `<select>` inherits it. No new directional value.

### Tests

**Server (`ticket.test.ts`):**
1. `?channel=EMAIL` returns only EMAIL tickets; `?channel=LIVE_CHAT` returns LIVE_CHAT tickets.
2. `?channel=BOGUS` → `400 VALIDATION_ERROR`.
3. `?channel=WHATSAPP` for an AGENT intersects with `scope=mine` (no widening) and with `scope=unassigned` (own-team only).
4. `?channel=EMAIL&status=OPEN&page=2&limit=5` — composes with other filters + pagination; `meta.total` reflects the channel-filtered count.
5. `?channel=SMS` for a MANAGER stays within their team.

**Client (`ticket-pages.test.tsx`):**
6. Selecting a channel in the popover pushes `channel=<v>` to the URL and into the query key / request params.
7. "Clear filters" removes `channel`; empty-state shows `tickets.noChannelMatches` when channel is the only active filter.
8. EN + AR channel labels render.

---

## 9. OD-5 — SLA Pause: Deferral (no implementation)

**No task.** `WAITING_CUSTOMER` SLA countdown semantics are unchanged and frozen.

Guardrails so no task accidentally introduces pause behaviour:

- The G1 clause matches only `current.status === RESOLVED`; it cannot touch `WAITING_CUSTOMER`.
- `plan.md §5` test 9 and a dedicated `ticket.test.ts` case assert a `WAITING_CUSTOMER` ticket's `resolutionDueAt`, `deriveSla` output, `sla=breached` membership, and cron auto-escalation are identical before/after this cycle's changes.
- The spec ([Scope](./spec.md#scope), [SLA Integration](./spec.md#explicitly-not-part-of-the-ticket-side-contract)) states SLA pause is out of scope and owned by the future SLA SDD feature.

---

## 10. OD-6 Implementation Plan — Customer-Ticket MANAGER Scope (G5)

### Evidence — **Case B: visibility bypass exists**

`customer.service.ts` `listCustomerTickets()` (L93–113): `const where: Prisma.TicketWhereInput = { customerId };` — no ticket-visibility predicate. Any ADMIN/MANAGER/AGENT gets every ticket of the customer; only the response `access` field is downgraded (`SUMMARY_ONLY`) for an AGENT viewing another agent's ticket. A MANAGER receives `FULL` for every ticket regardless of team → **cross-team metadata leak** (subject, status, priority, assigned-agent name, category). `customer.test.ts:72` currently *asserts* this bypass (`MANAGER` → `["FULL","FULL"]` for all).

### Fix

Reuse the canonical helper — no duplicate role logic:

```
import { resolveActorTeamId, teamScopedTicketWhere } from "../../shared/team/team-scope.js";

export async function listCustomerTickets(customerId, query, actor) {
  await ensureCustomerExists(customerId);
  const teamId = await resolveActorTeamId(actor);           // MANAGER → led team; ADMIN/AGENT → null
  const where: Prisma.TicketWhereInput = {
    customerId,
    ...teamScopedTicketWhere(actor, teamId),                // MANAGER → { teamId } or MATCH_NOTHING; ADMIN/AGENT → {}
  };
  ...
}
```

- **ADMIN** — `teamScopedTicketWhere` returns `{}` → org-wide, unchanged.
- **MANAGER** — `{ teamId }` (or `MATCH_NOTHING` = `{ id: { in: [] } }` when they lead no team) → only their team's tickets for that customer; empty page when teamless. No org-wide fallback (consistent with `resolveActorTeamId` semantics used everywhere else).
- **AGENT** — `teamScopedTicketWhere` returns `{}` for non-MANAGER → the AGENT still receives the customer's **full** ticket history, with the existing `access = SUMMARY_ONLY` downgrade for another agent's ticket. This preserves the deliberate ADR-014 cross-agent support-history design; OD-6 targets MANAGER only ("AGENT follows existing contextual scope").
- **CUSTOMER** — already `403` at the router (`customerReadRoles`), unchanged.

`where` is shared by `findMany` + `count` in the same `$transaction`, so `meta.total` is scoped consistently. No status-code change (still `200` with a possibly-empty page; a missing customer is still `404 CUSTOMER_NOT_FOUND` from `ensureCustomerExists`, which runs first — no new existence-leak surface).

### Docs reconciliation

ADR-050's "intentional exception … deferred pending a product decision" for this endpoint is now resolved by OD-6. Note in the plan's documentation task ([§17](#17-documentation-updates)) that `docs/06-auth-rbac.md` line ≈71 must change from "still returns non-actionable ticket summaries … regardless of team" to "team-scoped for MANAGER (OD-6)".

### Tests (`customer.test.ts`)

1. **Split the existing L72 test:** ADMIN → all customer tickets, `access = FULL`; MANAGER → **only** their team's tickets for that customer.
2. MANAGER whose team owns 1 of the customer's 3 tickets → `data.length === 1`, `meta.total === 1`, the two other-team tickets absent.
3. MANAGER with no managed team → `data: []`, `meta.total: 0`.
4. Cross-team leakage assertion: a MANAGER request returns no `subject` / `status` / `priority` / `assignedAgent` / `category` for a ticket owned by another team.
5. AGENT unchanged — full history, `SUMMARY_ONLY` for another agent's ticket, pagination as today (keep the existing L85 test).
6. `CUSTOMER` / unauthenticated → `403` / `401` (keep existing L101).
7. Pagination + team scope compose (`?page=2&limit=1` for a MANAGER with 2 in-team tickets).

---

## 11. Data / Prisma Impact

**No Prisma schema change. No migration.**

- G1 writes an existing nullable column (`Ticket.resolvedAt`) — value change only.
- G2 uses `AuditLog` as-is (`action` free string, `metadata` JSON). New value in the `AUDIT_ACTIONS` **TypeScript** constant object — not a DB enum.
- G3 emits an in-memory event — no persistence.
- G4 filters an existing indexed column (`Ticket.channel`? — `@@index` list on `Ticket` includes `status`, `priority`, `categoryId`, `departmentId`, `branchId`, `teamId`, `createdAt`, `customerId`, `assignedAgentId` — **not `channel`**). Channel cardinality is 5; a full-scan-with-filter on an already-scoped + paginated query is acceptable at this data size. Adding `@@index([channel])` is **optional, deferred** — call it out as a future optimisation, not part of this plan (adding it *would* be a migration and is not required for correctness).
- G5 adds a `where` fragment — query change only.

If, during tasks, a `channel` index is deemed necessary, it becomes its own small migration task with explicit human sign-off — not folded in silently.

---

## 12. API Compatibility

| Change | Observable effect | Breaking? |
| --- | --- | --- |
| G1 | `GET /tickets/:id` for a manually-reopened ticket now returns `slaState` ≠ `MET` and a non-null `effectiveSlaDueAt`; such tickets now appear in `?sla=breached\|at_risk` and get auto-escalated. `resolvedAt` in the detail response is `null` after a manual reopen. | **Semantic change, intended.** No shape change. Corrects a documented reporting hole. Analytics/Reports that count "resolved" by `resolvedAt`-in-range will (correctly) no longer count a reopened ticket. |
| G2 | New `AuditLog` rows with `action = "TICKET_ROUTING_CHANGED"` visible via `GET /api/audit-logs` (ADMIN only). | Additive. No route/shape change. |
| G3 | Connected ADMIN clients refetch ticket lists sooner after a portal ticket is created. | Additive, best-effort. No route/shape change. |
| G4 | `GET /tickets?channel=<Channel>` supported; unknown value → existing `400 VALIDATION_ERROR`. | **Additive** query param. Omitting it = today's behaviour. |
| G5 | `GET /api/customers/:id/tickets` as a MANAGER returns fewer rows (own team only); `meta.total` correspondingly smaller; a teamless MANAGER gets an empty page. | **Intended visibility tightening** — closes an unintended bypass. ADMIN/AGENT responses unchanged. |

No route added or removed. No response envelope change. No `requireRole` change. No RBAC broadening — G5 narrows.

---

## 13. Transaction Boundaries

| Change | Inside the Prisma transaction | After commit |
| --- | --- | --- |
| G1 | `data.resolvedAt = null` on the `tx.ticket.update`; `STATUS_CHANGED` `TicketHistory`; `TICKET_STATUS_CHANGED` `AuditLog`; assignment/escalation/watcher notifications (as today for a status change). | `emitTicketUpdated` flushed by the existing `withRealtimeOutbox` wrapper (already there for `updateTicket`). |
| G2 | `createAuditLog({ action: TICKET_ROUTING_CHANGED, ... }, tx)` alongside the existing per-field audit writes; a throw rolls back the whole `updateTicket` (established invariant). | `emitTicketUpdated` (now also when only `teamId` changed — the `changed` micro-fix). |
| G3 | `tx.ticket.create` + `TICKET_CREATED` `TicketHistory` (as today) — now inside `withRealtimeOutbox`. | `emitTicketUpdated` buffered → flushed post-commit; discarded on rollback. |
| G4 | n/a (read path) — the `findMany` + `count` stay in one `prisma.$transaction([...])` with a shared `where`. | n/a |
| G5 | n/a (read path) — `findMany` + `count` in one `prisma.$transaction([...])` with a shared scoped `where`. | n/a |

Existing atomicity guarantees preserved everywhere. No new transaction, no widened transaction scope beyond wrapping the portal create in the same outbox pattern its sibling `reply()` already uses.

---

## 14. Realtime Safety

- **G3 event is post-commit only** via `withRealtimeOutbox`; a rolled-back portal create publishes nothing.
- **No duplicate event:** portal create currently emits nothing, so adding exactly one `emitTicketUpdated` cannot double up. Verified by a "exactly one event" test.
- **No audience broadening:** `emitTicketUpdated({ teamId: null, assignedAgentId: null })` resolves through the existing `canReceive` to ADMIN (+ the creating customer's own portal refetch). MANAGER/AGENT/other-customers excluded by the unchanged `canReceive` logic — no new branch, no metadata added to the wire frame (`{ type, ticketId }` only).
- **G2 `changed` micro-fix** makes a pure re-route emit `ticket.updated` to the **new** team's audience (MANAGER of the new team, ADMIN). This is correct — the ticket entered their scope. A test asserts the event fires and carries only `{ type, ticketId }`.
- `canReceive` team-scope + customer-isolation logic is **not** touched.

---

## 15. Security / Privacy

| Concern | Protection in this plan |
| --- | --- |
| Team scope | G5 reuses `teamScopedTicketWhere` — the canonical builder — so the customer-ticket endpoint stops leaking cross-team metadata to a MANAGER. Regression test asserts no leakage. No other endpoint's scope changes. |
| Customer isolation | Untouched. G3's event reaches the creating customer's own portal refetch only (their own ticket); no other customer, no internal-only payload (`{ type, ticketId }`). |
| Routing audit metadata | G2 stores `departmentId` / `branchId` / `teamId` **ids** only in `metadata.changes`. Explicit test asserts no `subject` / `description` / names / tokens. `createAuditLog` already excludes ip/ua from `changes`. |
| Internal-note privacy | Untouched — no conversation code in this plan. |
| No cross-team MANAGER leakage | G5 + dedicated regression tests (`§10` tests 2–4). |
| Provider-sender trust boundary (DG-10) | Unchanged — explicitly out of scope; documented as an accepted boundary in the spec. |
| No sensitive content in audit rows | G2 test 7; reuse of the existing safe `createAuditLog` + `listAuditLogs` projection (which already strips `actorType` and surfaces only `changes`). |
| RBAC not broadened | No `requireRole` change; G5 narrows MANAGER; G4's `channel` filter can only narrow a scoped list. |

---

## 16. Testing Strategy

### Server (`vitest` + Supertest)

| Area | File | Cases |
| --- | --- | --- |
| G1 reopen SLA | `server/src/modules/tickets/ticket.test.ts` | §5 tests 1–10 (reopen clears `resolvedAt`, keeps `resolutionDueAt`, re-enters `deriveSla` / `sla` filter, no-op guard, terminal-path unaffected, `WAITING_CUSTOMER` regression). |
| G1 cron | `server/src/modules/sla-automation/sla-automation.test.ts` | reopened past-deadline ticket is now an escalation candidate. |
| G2 routing audit | `ticket.test.ts` | §6 tests 1–9 (one row per routing change, combined fields, team adoption, no-op → none, rejected → none, combined with status change, safe metadata, ADMIN-only read, `changed`/emit micro-fix). |
| G3 portal realtime | `server/src/modules/portal/portal.test.ts` (+ realtime helper) | §7 tests 1–5 (exactly one post-commit event, none on rollback, ADMIN receives / MANAGER-AGENT-other-customer do not, history still written, no audit row, response shape unchanged). |
| G4 channel filter | `ticket.test.ts` | §8 server tests 1–5 (each channel incl. `LIVE_CHAT`, invalid → 400, AGENT no-widen, composes with filters + pagination, MANAGER team-bounded). |
| G5 customer-ticket scope | `server/src/modules/customers/customer.test.ts` | §10 tests 1–7 (split the L72 test; MANAGER own-team-only; teamless MANAGER empty; no cross-team leakage; AGENT unchanged; CUSTOMER 403; pagination + scope). |
| Negative authz | `ticket.test.ts`, `customer.test.ts` | AGENT routing `PATCH` → 403 no write; MANAGER cross-team ticket id → 404 (unchanged); `/audit-logs` MANAGER/AGENT → 403. |
| No-op / transaction failure | `ticket.test.ts` | no-op `PATCH` → no `resolvedAt` write, no routing row, no event; forced tx failure in portal create → no event. |
| Full server suite | — | `npm test` (server) green; report exact counts. |

### Client (`vitest` + Testing Library)

| Area | File | Cases |
| --- | --- | --- |
| G4 filter UI | `client/src/features/tickets/ticket-pages.test.tsx` | select channel → URL param + query serialization; clear-filters removes it; empty-state copy; EN + AR labels. |
| G4 no regression | same | existing status/priority/category/agent/department/branch filter tests still green; canonical list render unchanged. |
| Realtime (G3) | existing `client/src/features/realtime/realtime.test.tsx` | `ticket.updated` still invalidates `ticketKeys.lists()` for an internal role — no client change, confirm not broken. |
| Full client suite | — | `npm test` (client) green; report counts. |

### Existing suites likely impacted (verify green / update in lockstep)

- `server/src/modules/customers/customer.test.ts` — **must update** (L72 encodes the bypass).
- `server/src/modules/tickets/ticket.test.ts` — extend (new cases; no existing case should break — G1 only adds a clear on a path most tests don't exercise).
- `server/src/modules/portal/portal.test.ts` — extend for the new event; existing create assertions unchanged.
- `server/src/modules/sla-automation/sla-automation.test.ts` — extend for the reopened-ticket escalation case.
- `server/src/modules/realtime/realtime.test.ts` — sanity for the portal-create audience.
- `client/src/features/tickets/ticket-pages.test.tsx` — extend for the channel filter.
- Whole-repo `npm test` on both packages before "done".

---

## 17. Documentation Updates (applied in the implementation phase, not now)

Factual reconciliation once the code lands:

| Doc | Change |
| --- | --- |
| `specs/features/tickets/spec.md` | Flip the "approved / not yet implemented" markers on OD-1…OD-4/OD-6 to "implemented"; add an "Implemented as" note if behaviour diverged from this plan. |
| `docs/07-ticket-workflow.md` | (DG-1) rewrite the "Valid Manual Transitions" list to the full union incl. `→ ESCALATED` / `ESCALATED → IN_PROGRESS`; add: manual `RESOLVED → IN_PROGRESS` clears `resolvedAt`, retains `resolutionDueAt` (G1). |
| `docs/08-sla-automation.md` | Note that a reopened ticket re-enters SLA evaluation against the retained `resolutionDueAt` (no fresh deadline). |
| `docs/22-realtime-events.md` | (DG-2) update the §3 emission table: add SMS inbound `ticket.message.created`, `portal.service.reply`, `live-chat` start/end, `selfAssignTicket`, and **`portal.service.createTicket` → `ticket.updated`** (G3); refresh §4 `withRealtimeOutbox` entrypoint list; update §5 authorization table to state team-scoped `canReceive`. |
| `docs/05-api-contract.md` | (DG-3) add the `channel` query param to the `GET /tickets` section (G4); note the `channel` list-filter enum includes `LIVE_CHAT` unlike create; refresh the stale "registered routers" / "Later Ticket Actions" wording; document `GET /api/customers/:id/tickets` MANAGER team-scoping (G5). |
| `docs/06-auth-rbac.md` | Change the ADR-050 "intentional exception" note (~L71) for `GET /api/customers/:id/tickets` to "team-scoped for MANAGER (OD-6)"; add `TICKET_ROUTING_CHANGED` to the audited ticket actions list. |
| `docs/19-progress-tracking.md` | Record the Tickets SDD implementation (branch `chore/sdd-foundation`, uncommitted), affected sections, exact test counts, lint/typecheck/build results. |
| ADR | **No new ADR.** G1/G2/G3/G5 are bug/parity fixes and a reuse of an existing helper; G4 is an additive filter. None introduces a new architectural or product decision beyond what OD-1…OD-6 already record. If, during implementation, `changed`/`teamId` realtime behaviour or the `TICKET_ROUTING_CHANGED` shape proves contentious, add a short ADR then — not pre-emptively. |

Broader `docs/` drift beyond the rows above is recorded here for implementation-phase reconciliation; this plan does not touch `docs/` now.

---

## 18. Rollout / Compatibility Risks

| Risk | Assessment / mitigation |
| --- | --- |
| Existing tickets already `RESOLVED` with `resolvedAt` set | Unaffected until someone manually reopens them. On reopen they correctly become `BREACHED` if past `resolutionDueAt` (honest). No backfill, no migration. |
| Manual reopen right after deploy | Works immediately; the new clause is purely additive to `updateTicket`. |
| Reports / SLA analytics shift | A manually reopened ticket stops counting as "resolved" (`resolvedAt` cleared) and re-enters SLA breach stats. This is the *intended* correction of DG-4; call it out in the release note so an ops dashboard dip is understood, not alarming. |
| Cached frontend query keys (G4) | `TicketFilters` gains an optional `channel`; omitted = undefined = unchanged key. Existing cached lists remain valid; no key-format break. |
| Old/invalid `channel` query values | `z.nativeEnum(Channel)` rejects unknowns with the standard `400 VALIDATION_ERROR` — same as an unknown `status` today. No silent coercion. |
| Realtime duplicate events (G3) | Portal create emitted nothing before; exactly one added. Test-enforced. `withRealtimeOutbox` prevents pre-commit leakage. |
| MANAGER visibility behaviour change (G5) | A MANAGER using the customer detail page will see fewer tickets in the history panel for customers whose tickets span teams. Intended (closes a bypass). Note in the release summary; the panel is summary-only and grants no lost capability (they never had detail/mutation on those tickets). |
| `channel` unindexed (G4) | 5-value filter on an already-scoped, paginated query — acceptable at current scale. `@@index([channel])` deferred as an explicit future migration task if profiling shows a need. |
| No migration expected | Rollout is code-only. If tasks discover a real schema need, it stops and gets human sign-off — it is not folded in. |

---

## 19. Verification Gate

Run before declaring implementation complete; report actual pass/fail and counts.

### Server (`server/`)

- `npm run typecheck`
- `npm run lint`
- `npm test -- ticket.test.ts` (targeted)
- `npm test -- sla-automation.test.ts customer.test.ts portal.test.ts realtime.test.ts` (targeted)
- `npm test` (full server suite)
- `npm run build`

### Client (`client/`)

- `npm run typecheck` (`tsc -b` — catches test-fixture type errors Vitest misses)
- `npm run lint`
- `npm test -- ticket-pages.test.tsx` (targeted)
- `npm test` (full client suite)
- `npm run build`

### Repo

- `git diff --check` (whitespace/conflict markers)

### Manual smoke (real DB + browser, if available in the implementation environment)

1. Resolve a ticket, then reopen it (`RESOLVED → IN_PROGRESS`) → detail shows `resolvedAt` cleared, `slaState` no longer `MET`, SLA card reflects the retained deadline.
2. Re-route a ticket (change team) → `GET /api/audit-logs?action=TICKET_ROUTING_CHANGED` shows one safe row; the new team's MANAGER sees the ticket appear without a refresh.
3. Create a ticket from the customer portal → a logged-in ADMIN's ticket list / dashboard updates without an F5.
4. `GET /tickets?channel=EMAIL` (and via the list UI's new Channel filter) → only EMAIL tickets; clear-filters resets it; AR locale shows translated channel labels.
5. As a MANAGER, open a customer who has tickets in another team → the customer's ticket-history panel shows only this manager's team's tickets; as an ADMIN the same panel shows all.
6. As a MANAGER with no team, the customer ticket-history panel is empty (no error).

---

## Appendix — Task Preview (informational; `tasks.md` NOT created yet)

Anticipated task clusters, for human sizing only:

- **TK-01** OD-1: clear `resolvedAt` on manual `RESOLVED → IN_PROGRESS` in `updateTicket` + tests (`ticket.test.ts`, `sla-automation.test.ts`).
- **TK-02** OD-2: add `AUDIT_ACTIONS.TICKET_ROUTING_CHANGED`; emit routing `AuditLog` row in `updateTicket`; fold `teamId` into `changed`; tests.
- **TK-03** OD-3: wrap `portal.service.createTicket` in `withRealtimeOutbox`; emit `ticket.updated`; tests (`portal.test.ts`).
- **TK-04** OD-4 backend: `channel` in `ticketListQuerySchema` + `listTickets` `where` + `TicketFilters` type; server tests.
- **TK-05** OD-4 frontend: URL param + `useTickets` wiring + `TicketFiltersPopover` control + EN/AR strings + empty-state; client tests.
- **TK-06** OD-6: apply `teamScopedTicketWhere` in `listCustomerTickets`; split/rewrite `customer.test.ts` MANAGER cases + cross-team leakage tests.
- **TK-07** OD-5 guard: explicit `WAITING_CUSTOMER` SLA-unchanged regression test.
- **TK-08** Docs reconciliation (`docs/05/06/07/08/22/19` + spec markers) and progress-tracker update.
- **TK-09** Full verification gate (§19) + report.

---

## Plan Status

**`IMPLEMENTED`** (2026-09-10, branch `chore/sdd-foundation`, not merged) — `tasks.md` `TK-001…TK-011` executed. No production schema, migration, or dependency touched. Awaiting human review of the Tickets slice.
