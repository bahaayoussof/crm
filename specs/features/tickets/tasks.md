# Tickets — Task Breakdown

| Field | Value |
| --- | --- |
| Feature | Tickets |
| Type | Brownfield (behaviour correction + one additive filter) |
| Spec status | [`spec.md`](./spec.md) — `IMPLEMENTED — READY FOR HUMAN REVIEW` |
| Plan status | [`plan.md`](./plan.md) — `IMPLEMENTED` (historical planning record; see this file for execution status) |
| Task status | **`11 / 11 COMPLETE · READY FOR HUMAN REVIEW`** (branch `chore/sdd-foundation`, not merged) |
| Branch | `chore/sdd-foundation` (single SDD working branch — do not branch, do not merge) |
| Total tasks | 11 (`TK-001` … `TK-011`) |
| Completed | 11 / 11 |
| Current task | — (complete) |

Decomposition of [`plan.md`](./plan.md) into ordered, independently verifiable tasks. Scope authority is [`spec.md`](./spec.md) + `plan.md`. This file adds **no new decisions** — every task is anchored to an already-resolved decision (OD-1 … OD-6). Creating this file changes no production code, no schema, no dependency, no test.

---

## Scope Guard

The **only** production behaviour changes this task set may introduce:

1. Manual `RESOLVED → IN_PROGRESS` clears `Ticket.resolvedAt` (keeps `resolutionDueAt`). *(OD-1)*
2. A ticket-routing change (`departmentId` / `branchId` / `teamId`) writes one `AuditLog TICKET_ROUTING_CHANGED` row; a `teamId` re-route also feeds the existing `changed` / realtime path. *(OD-2)*
3. Customer-portal ticket creation emits one canonical post-commit `ticket.updated` event. *(OD-3)*
4. `GET /tickets` accepts an additive `channel` query filter (backend + canonical frontend filter UI). *(OD-4)*
5. `GET /api/customers/:id/tickets` applies the canonical team-scope predicate so `MANAGER` is team-bounded. *(OD-6)*

Any PR touching this feature that also does the following must be rejected in review unless `spec.md` **and** `plan.md` are first revised and re-approved:

- SLA pause / resume while `WAITING_CUSTOMER`, business-hours calendars, per-ticket SLA overrides (OD-5 — deferred to the future SLA SDD feature).
- Creating a **fresh** `resolutionDueAt` (or any resolution-SLA recalculation) on reopen.
- A Prisma schema change or a migration (incl. an index on `Ticket.channel`).
- A new dependency / lockfile change.
- A new `TicketHistory` action for routing; a broad `TicketHistory` or `AuditLog` redesign.
- Auditing inbound-channel or portal ticket **creation**.
- A new realtime transport, Socket.IO, a new SSE event type, or a durable queue.
- A new role / permission / `requireRole` allowlist change; RBAC broadening (OD-6 narrows only).
- Channel-provider changes, webhook signature-scheme changes, `channel` change after creation.
- An independent sender-verification system for inbound channels (DG-10 stays an accepted boundary).
- Ticket deletion; unrelated ticket-list filter or Tickets-table redesign; `createdAt` date-range list filter.
- Memoising team resolution / other unrelated performance refactors (not required by the plan).

API request/response shapes, routes, status codes, error codes, pagination, ordering, and portal visibility stay exactly as today except where items 1–5 above explicitly change them.

---

## Implementation Discipline (for later agents)

Implement **one task at a time**. Do not chain tasks.

For each task:

1. Read `AGENTS.md` (preflight + Git Safety Rules) and the ticket docs it points at (`docs/04`, `docs/05`, `docs/06`, `docs/07`, `docs/08`; `docs/09` + `docs/18` for TK-007).
2. Read `specs/features/tickets/spec.md` and `specs/features/tickets/plan.md`.
3. Read this `tasks.md`.
4. Inspect the actual target files in the repo — do not implement from the plan text alone.
5. Implement only the selected task.
6. Run that task's **Verification** commands/checks; report actual pass/fail + counts.
7. Report files changed and commands run. Show a suggested commit message; do **not** commit, stage, push, merge, rebase, or amend.
8. Do **not** proceed to the next task unless explicitly instructed.

Verification commands are run from the relevant package (`server/` or `client/`) per `specs/constitution.md`.

---

## Task List

- [x] **TK-001** — Clear `resolvedAt` on manual `RESOLVED → IN_PROGRESS` *(server)* — done: one clause added in `updateTicket`; 5 focused tests; `ticket.test.ts` 108 pass; server typecheck + lint clean.
- [x] **TK-002** — Reopen SLA regression: derivation + filter + cron + `WAITING_CUSTOMER` guard *(server tests)* — done: 4 derivation/filter tests in `ticket.test.ts`, 3 cron/guard tests in `sla-automation.test.ts`; 131 pass. No production change.
- [x] **TK-003** — `TICKET_ROUTING_CHANGED` AuditLog on routing change + `teamId` in `changed` *(server)* — done: `AUDIT_ACTIONS.TICKET_ROUTING_CHANGED` added; `updateTicket` writes one id-only routing row in-tx; `effectiveNewTeamId` folded into `changed`. typecheck + lint clean.
- [x] **TK-004** — Routing-audit tests *(server tests)* — done: 8-case `routing AuditLog (OD-2)` describe in `ticket.test.ts` (single field, combined, team adoption, no-op, rejected, combined w/ status, safe metadata, one realtime event); read-RBAC covered by `audit-log.test.ts`. `ticket.test.ts` 120 pass.
- [x] **TK-005** — Portal ticket creation emits post-commit `ticket.updated` + tests *(server)* — done: `portal.service.createTicket` wrapped in `withRealtimeOutbox`, emits one `emitTicketUpdated({teamId:null,assignedAgentId:null})` post-commit; no AuditLog. 3 portal tests + 1 realtime canReceive test. portal+realtime 46 pass; typecheck+lint clean.
- [x] **TK-006** — Backend `channel` filter on `GET /tickets` + server tests *(server)* — done: `channel: z.nativeEnum(Channel)` in `ticketListQuerySchema`; `...(query.channel && { channel })` in `listTickets` where (ANDed after visibility); client `TicketFilters.channel` type added. 9-case describe; `ticket.test.ts` 131 pass; server + client typecheck + server lint clean.
- [x] **TK-007** — Frontend `channel` filter in the canonical Tickets list + client tests *(client)* — done: `channel` URL param + `useTickets` wiring + `TicketFiltersPopover` `<select>` (`channelLabel` / `channelOptions`) + `hasFilters`/`onClearFilters`/`getEmptyMessage`; `tickets.allChannels` + `tickets.noChannelMatches` EN/AR (channel labels already existed). 5 new client tests; `ticket-pages.test.tsx` 46 pass; client typecheck + lint clean (2 pre-existing unrelated warnings).
- [x] **TK-008** — Team-scope `listCustomerTickets` (MANAGER) *(server)* — done: `listCustomerTickets` now builds `where` as `{ customerId, ...teamScopedTicketWhere(actor, await resolveActorTeamId(actor)) }` — canonical helper, no duplicated role logic. ADMIN/AGENT unchanged, MANAGER team-bounded.
- [x] **TK-009** — Customer-ticket visibility tests (split + cross-team leakage) *(server tests)* — done: split the old `ADMIN/MANAGER → [FULL,FULL]` it.each into an ADMIN org-wide test + a `MANAGER customer-ticket visibility (OD-6)` describe (team-scoped where, teamless → `{id:{in:[]}}` empty page, cross-team predicate carries team id, pagination composes). AGENT/CUSTOMER cases retained. `customer.test.ts` 27 pass; typecheck + lint clean.
- [x] **TK-010** — Documentation & SDD reconciliation *(docs)* — done: `docs/05` (channel filter + customer-ticket MANAGER scope + Later Ticket Actions attachment status), `docs/06` (customer-ticket team scope + `TICKET_ROUTING_CHANGED`), `docs/07` (full transition union incl. `→ ESCALATED`, reopen SLA rule, routing = AuditLog-only), `docs/08` (reopen re-enters SLA), `docs/22` (§3 emission table + §4 outbox entrypoints + §5 team-scoped `canReceive`), `docs/19` (dated implementation entry), `specs/features/tickets/spec.md` + `plan.md` markers flipped to implemented. No new ADR. `git diff --check` clean.
- [x] **TK-011** — Final verification gate + manual smoke + merge-readiness verdict *(verification)* — see the Verification Evidence block below. Verdict: **READY FOR HUMAN REVIEW**.

### TK-011 Verification Evidence (2026-09-10, branch `chore/sdd-foundation`)

**Server (`server/`):**
- `npm run typecheck` → PASS (exit 0).
- `npm run lint` → PASS (exit 0).
- `npm test -- ticket.test.ts` → PASS, **131** tests.
- `npm test -- customer.test.ts` → PASS, **27** tests.
- `npm test -- portal.test.ts realtime.test.ts` → PASS, **46** tests.
- `npm test -- sla-automation.test.ts` → PASS, **19** tests.
- `npm test` (full) → PASS, **964 / 964**, 52 files.
- `npm run build` → `tsc -p tsconfig.json` compile step PASS (exit 0). The `prisma generate` prelude of `npm run build` is blocked in this environment by a Windows file lock (`EPERM: rename … query_engine-windows.dll.node`) — an environment issue, not a code issue: `schema.prisma` is unchanged, the existing generated client is valid (full suite + typecheck green against it). Re-run of `prisma generate` on an unlocked machine is a **PENDING HUMAN** step.

**Client (`client/`):**
- `npm run typecheck` (`tsc -b`) → PASS (exit 0).
- `npm run lint` → PASS (0 errors; 2 pre-existing unrelated `react-refresh` warnings in `breakdown-chart.tsx` / `theme-provider.tsx`).
- `npm test -- ticket-pages.test.tsx` → PASS, **46** tests.
- `npm test` (full) → PASS, **805 / 805**, 67 files (one initial run showed a flaky slow `PhoneInput` country-dropdown test at ~4.8s; green on re-run — unrelated to Tickets).
- `npm run build` → PASS (pre-existing single-chunk >500 kB warning).

**Prisma / DB:**
- `git diff --stat -- server/prisma` → empty. `server/prisma/schema.prisma` unchanged.
- No new file under `server/prisma/migrations/` (latest is the pre-existing `20260909120000_kb_article_content_text`).
- **No Prisma schema change, no migration, no DB migration action required for Tickets SDD.**

**Repository:**
- `git diff --check` → clean (only a benign LF→CRLF warning on `.wolf/memory.md`).
- `git status --short` → only `specs/**`, `docs/**`, `.wolf/**`, and the intended `server/src/modules/{tickets,customers,portal,realtime,sla-automation,audit-logs}/**` + `client/src/features/tickets/**` + `client/src/locales/{en,ar}/translation.json`. `specs/features/tickets/` is untracked (new SDD dir). No stray files.
- `git diff --stat` → 24 files, +626 / −37 (excl. untracked `specs/features/tickets/`).

**Manual smoke checklist:** `PENDING HUMAN SMOKE` for all 9 steps — no local Postgres / browser in this environment (the Prisma engine DLL is even file-locked here). The steps in TK-011 above are the precise human checklist.

**Dependency order (execute sequentially):** `TK-001 → TK-002 → TK-003 → TK-004 → TK-005 → TK-006 → TK-007 → TK-008 → TK-009 → TK-010 → TK-011`.

---

## TK-001 — Clear `resolvedAt` on manual `RESOLVED → IN_PROGRESS`

### Goal
A `PATCH /tickets/:id` that transitions a ticket from `RESOLVED` to `IN_PROGRESS` sets `resolvedAt = null` while leaving `resolutionDueAt`, `firstResponseDueAt`, `firstRespondedAt`, and `closedAt` untouched, atomically with the existing status-change side effects.

### Why
OD-1 / spec [DG-4](./spec.md#known-gaps--drift): today `updateTicket` only ever *sets* `resolvedAt`, so a manually reopened ticket keeps it populated → `deriveSla` reports `MET` forever, the ticket is invisible to `sla=breached|at_risk`, and the SLA-monitor never escalates it. Channel-driven reopen already clears it; the manual path is the only gap.

### Dependencies
None.

### Likely Files / Modules
- `server/src/modules/tickets/ticket.service.ts` → `updateTicket()`, in the `data` builder next to the existing `data.resolvedAt = now` / `data.closedAt = now` lines (plan §5).
- `server/src/modules/tickets/ticket.test.ts` — add the focused cases below.

### Implementation Requirements
- Add exactly one clause: when `input.status === TicketStatus.IN_PROGRESS && current.status === TicketStatus.RESOLVED`, set `data.resolvedAt = null`.
- Do **not** modify `resolutionDueAt`, `firstResponseDueAt`, `firstRespondedAt`, `closedAt`, or the SLA-recalc block.
- Do **not** touch `deriveSla`, `slaFilterWhere`, or `sla-automation.service.ts` — they behave correctly once `resolvedAt` is `null`.
- The clause runs inside the existing `updateTicket` `$transaction`; the existing `STATUS_CHANGED` `TicketHistory` + `TICKET_STATUS_CHANGED` `AuditLog` + notifications + watcher fan-out + post-commit `emitTicketUpdated` already fire for a status change — no additional side effect.
- Add a short code comment noting that all reopen paths (portal reply, inbound EMAIL, manual) share the rule "clear `resolvedAt`, keep `resolutionDueAt`".

### Tests (in `ticket.test.ts`; deeper SLA/cron coverage is TK-002)
- `RESOLVED → IN_PROGRESS` as `ADMIN`: response + reloaded ticket show `resolvedAt === null`, `resolutionDueAt` unchanged; exactly one `STATUS_CHANGED` history row and one `TICKET_STATUS_CHANGED` audit row.
- Same transition by a **self-assigned `AGENT`** succeeds and clears `resolvedAt`.
- `RESOLVED → CLOSED` still sets `closedAt` and **keeps** `resolvedAt` (terminal path unaffected).
- No-op `PATCH` (`status: "IN_PROGRESS"` on an already-`IN_PROGRESS` ticket) does not write `resolvedAt` and emits no `ticket.updated`.
- `firstRespondedAt` / `firstResponseDueAt` are byte-identical before and after the reopen.

### Non-Goals
- No fresh `resolutionDueAt`. No SLA recalculation on reopen. No shared-helper extraction (the three reopen sites set different target statuses and already inline the clear). No change to `WAITING_CUSTOMER` handling.

### Completion Criteria
- The clause is present and scoped to `current.status === RESOLVED`.
- All TK-001 tests pass; no pre-existing `ticket.test.ts` case regresses.
- `server`: `npm run typecheck`, `npm run lint`, `npm test -- ticket.test.ts` green.

### Verification
```
cd server
npm run typecheck
npm run lint
npm test -- ticket.test.ts
```

---

## TK-002 — Reopen SLA regression: derivation, filter, cron, `WAITING_CUSTOMER` guard

### Goal
Prove that a manually reopened ticket re-enters live SLA evaluation against its retained `resolutionDueAt`, and that `WAITING_CUSTOMER` SLA semantics are unchanged.

### Why
OD-1 must fix the downstream effects of DG-4 (not just the column write), and OD-5 requires an explicit guard that no pause behaviour was introduced.

### Dependencies
`TK-001`.

### Likely Files / Modules
- `server/src/modules/tickets/ticket.test.ts` (derivation + list filter).
- `server/src/modules/sla-automation/sla-automation.test.ts` (auto-escalation).
- No production change.

### Implementation Requirements
Add regression tests only. No production code.

### Tests
- **Derivation:** after `RESOLVED → IN_PROGRESS`, `GET /tickets/:id` returns `slaState ≠ "MET"`; a fixture whose retained `resolutionDueAt` is in the past → `slaState === "BREACHED"` with a non-null `effectiveSlaDueAt`; a future `resolutionDueAt` → `ON_TRACK` / `AT_RISK` per the 60-minute window.
- **List filter:** `GET /tickets?sla=breached` as `ADMIN` includes a reopened ticket whose `resolutionDueAt` is past; `sla=at_risk` includes one inside the warning window.
- **Cron:** the SLA-monitor escalates a reopened, non-`ESCALATED`, active ticket whose `resolutionDueAt` has passed (extend `sla-automation.test.ts`); it does not re-escalate an already-`ESCALATED` ticket; a first-response breach still does not trigger escalation.
- **OD-5 guard:** a ticket in `WAITING_CUSTOMER` past its `resolutionDueAt` — its `deriveSla` output, `sla=breached` membership, and cron auto-escalation are identical to the pre-TK-001 behaviour (assert `BREACHED` + escalated; no pause, no deadline shift).

### Non-Goals
- No new production behaviour. No SLA-pause tests beyond the "unchanged" assertion.

### Completion Criteria
- All TK-002 tests pass; `sla-automation.test.ts` and `ticket.test.ts` full files green.

### Verification
```
cd server
npm test -- ticket.test.ts sla-automation.test.ts
```

---

## TK-003 — `TICKET_ROUTING_CHANGED` AuditLog + `teamId` in `changed`

### Goal
A `PATCH /tickets/:id` that changes `departmentId`, `branchId`, and/or `teamId` writes exactly one `AuditLog` row (`action = "TICKET_ROUTING_CHANGED"`, `entityType = "TICKET"`) in the update transaction, with `metadata.changes` holding only the changed routing fields as `{ from, to }` id values; and a `teamId` re-route now participates in the existing `changed` detection so `ticket.updated` fires for the new team's audience.

### Why
OD-2 / spec [DG-5](./spec.md#known-gaps--drift): routing changes to the authoritative ownership field are currently untraceable. Plan §6 also folds in the related micro-fix where `changed` (L490–499 of `updateTicket`) omits `teamId`, so a pure re-route without auto-assignment emits no realtime event.

### Dependencies
`TK-002` (keeps `ticket.service.ts` edits sequential and re-verified).

### Likely Files / Modules
- `server/src/modules/audit-logs/audit-log.constants.ts` → add `TICKET_ROUTING_CHANGED: "TICKET_ROUTING_CHANGED"` to `AUDIT_ACTIONS` (no schema change — `action` is a free string).
- `server/src/modules/tickets/ticket.service.ts` → `updateTicket()`: build `routingChanges` alongside the existing `auditEvents` array; call `createAuditLog({ ..., action: AUDIT_ACTIONS.TICKET_ROUTING_CHANGED, changes: routingChanges, requestContext }, tx)`; extend the `changed` expression with the effective-`teamId` comparison.
- `server/src/modules/tickets/ticket.test.ts` (smoke — full matrix is TK-004).

### Implementation Requirements
- Compute routing changes from the already-loaded `current` (selects `departmentId`/`branchId`/`teamId`) vs the resolved new values:
  - `input.departmentId !== undefined && input.departmentId !== current.departmentId` → `changes.departmentId = { from, to }`.
  - `input.branchId !== undefined && input.branchId !== current.branchId` → `changes.branchId`.
  - `effectiveNewTeamId = input.teamId !== undefined ? input.teamId : (adoptTeamId ?? current.teamId)`; `effectiveNewTeamId !== current.teamId` → `changes.teamId` (covers explicit re-route **and** the unrouted-ticket "adopt the assignee's team" path).
- Write the audit row only when `Object.keys(routingChanges).length > 0`, using `tx` (same transaction as the mutation) so a failure rolls the whole `updateTicket` back — matching the existing `TICKET_STATUS_CHANGED` behaviour.
- `metadata.changes` carries **ids only** (or `null`). No names, subject, description, or body. Reuse `createAuditLog` as-is.
- Do **not** add a `TicketHistory` row for routing.
- Add `|| (effectiveNewTeamId !== current.teamId)` to the `changed` boolean so a re-route emits `ticket.updated` (to the new team's MANAGER + ADMIN via the unchanged `canReceive`).
- Automatic assignment (which fills the assignee, not `teamId`) must **not** produce a routing audit row.

### Tests (smoke here; full set in TK-004)
- `PATCH` changing `teamId` → one `TICKET_ROUTING_CHANGED` row, `changes.teamId = { from, to }` (ids), written in the same tx as the update.
- A no-op (`teamId` submitted unchanged) → no routing row.

### Non-Goals
- No `TicketHistory` routing row. No new entity type. No routing audit for creation flows. No index.

### Completion Criteria
- `AUDIT_ACTIONS.TICKET_ROUTING_CHANGED` exists; `updateTicket` writes it under the stated conditions; `changed` includes the `teamId` comparison.
- TK-003 smoke tests + full `ticket.test.ts` green; typecheck/lint clean.

### Verification
```
cd server
npm run typecheck
npm run lint
npm test -- ticket.test.ts
```

---

## TK-004 — Routing-audit tests

### Goal
Full behavioural coverage of the `TICKET_ROUTING_CHANGED` rules.

### Why
OD-2 requires: one row per combined routing mutation, safe metadata, none on no-op, none on rejected, transactional, and the re-route realtime micro-fix.

### Dependencies
`TK-003`.

### Likely Files / Modules
- `server/src/modules/tickets/ticket.test.ts` (extend). No production change.

### Tests
- Change `departmentId` + `branchId` in one `PATCH` → exactly **one** row, both keys present in `metadata.changes`.
- Unrouted ticket assigned an agent (team adoption) → routing row with `changes.teamId = { from: null, to: <agentTeam> }`.
- `PATCH` submitting current routing values unchanged → **no** routing row.
- Rejected `PATCH` (`400 INVALID_TEAM`; AGENT sending `teamId` → `403` from the field allowlist) → **no** routing row, no partial write.
- `PATCH` changing `teamId` **and** `status` → routing row **and** `TICKET_STATUS_CHANGED` row, both committed atomically.
- Metadata privacy: assert the routing row's `metadata` contains no `subject` / `description` / names / tokens — only `changes` with id/`null` values.
- `GET /api/audit-logs?action=TICKET_ROUTING_CHANGED` as `ADMIN` returns the row with the safe `changes` diff; `MANAGER` / `AGENT` → `403` (unchanged).
- Re-route now emits exactly one `ticket.updated` (`{ type, ticketId }` only); a pure re-route with no auto-assignment still emits it.

### Non-Goals
- No production change. No audit-read UI/endpoint change.

### Completion Criteria
- All TK-004 tests pass; `ticket.test.ts` full file green.

### Verification
```
cd server
npm test -- ticket.test.ts
```

---

## TK-005 — Portal ticket creation emits post-commit `ticket.updated`

### Goal
`POST /api/portal/tickets` publishes exactly one canonical `ticket.updated` event for the new ticket id, after the creating transaction commits; nothing is published if the transaction fails.

### Why
OD-3 / spec [DG-6](./spec.md#known-gaps--drift): portal-created tickets don't push to connected staff, so new inbound work is invisible until the first reply or an ADMIN action. `internal createTicket` and `live-chat` creation already emit this event.

### Dependencies
`TK-004`.

### Likely Files / Modules
- `server/src/modules/portal/portal.service.ts` → `createTicket()` (L76–98) and its import from `../realtime/realtime.publisher.js`.
- `server/src/modules/portal/portal.test.ts` (extend); optionally `server/src/modules/realtime/realtime.test.ts` for the audience assertion.

### Implementation Requirements
- Add `emitTicketUpdated` to the existing `import { emitTicketMessageCreated, withRealtimeOutbox } from "../realtime/realtime.publisher.js"`.
- Wrap the existing `prisma.$transaction(...)` body of `createTicket()` in `withRealtimeOutbox(async () => { ... })` — the same pattern `portal.service.reply()` already uses directly below.
- After the transaction resolves, call `emitTicketUpdated({ ticketId: ticket.id, assignedAgentId: null, customerId, teamId: null })` (portal tickets are always unrouted + unassigned — server-owned; `customerId` is the in-scope variable).
- Use the canonical event only — no new event type, no new payload field.
- Do **not** add an `AuditLog` row. Keep the existing `TICKET_CREATED` `TicketHistory` write and the `listSelect` response projection unchanged.

### Tests
- `POST /api/portal/tickets` → exactly one `ticket.updated` event for the new ticket id, observed **after** commit.
- Forced transaction failure (e.g. invalid `categoryId`) → **no** event.
- Event reaches a connected `ADMIN` subscriber; **not** delivered to a `MANAGER` / `AGENT` subscriber with no team; **not** delivered to a *different* customer's subscriber (no isolation regression).
- `TICKET_CREATED` `TicketHistory` row still written; **no** `AuditLog` row created for the portal create.
- Portal-create response shape unchanged.

### Non-Goals
- No `AuditLog` for portal (or inbound) creation. No realtime for AI-handoff beyond what the canonical `createTicket` path already yields. No client change (the existing `ticket.updated` handler already invalidates `ticketKeys.lists()` + `["dashboard"]`).

### Completion Criteria
- Exactly-once post-commit event; rollback publishes nothing; audience is ADMIN (+ owning customer's own portal refetch); history unchanged; no audit row.
- TK-005 tests + full `portal.test.ts` (and `realtime.test.ts` if touched) green; typecheck/lint clean.

### Verification
```
cd server
npm run typecheck
npm run lint
npm test -- portal.test.ts realtime.test.ts
```

---

## TK-006 — Backend `channel` filter on `GET /tickets`

### Goal
`GET /tickets?channel=<Channel>` returns only tickets whose `channel` matches, intersected with the caller's authoritative scope; an unknown value → `400 VALIDATION_ERROR`; omitting the param is unchanged behaviour.

### Why
OD-4 / spec [DG-7](./spec.md#known-gaps--drift): `channel` is first-class on the ticket and shown in the list, but not filterable there.

### Dependencies
`TK-005`.

### Likely Files / Modules
- `server/src/modules/tickets/ticket.schema.ts` → `ticketListQuerySchema` (`.strict()`).
- `server/src/modules/tickets/ticket.service.ts` → `listTickets()` `where` builder.
- `client/src/features/tickets/ticket.types.ts` → `TicketFilters` (add `channel?: TicketChannel`) — type only, no UI here.
- `server/src/modules/tickets/ticket.test.ts`.

### Implementation Requirements
- Schema: add `channel: z.nativeEnum(Channel).optional()`. All five `Channel` values are valid for the **filter** (a `LIVE_CHAT` ticket is a normal internal ticket) — add a comment noting this is intentionally wider than `createTicketSchema.channel` (which excludes `LIVE_CHAT`).
- Service: add `...(query.channel && { channel: query.channel })` to the `where` object, ANDed **after** `ticketListVisibilityWhere(...)` so it can only narrow a scoped list (no RBAC branch needed — unlike `assignee` / `sla`, a plain attribute filter is fine for `AGENT`).
- `where` stays shared by `findMany` + `count` in the one `$transaction` → `meta.total` reflects the channel-filtered count.
- Client `TicketFilters` type gains `channel?: TicketChannel` (wiring is TK-007).
- No database index. No migration.

### Tests (`ticket.test.ts`)
- `?channel=EMAIL` returns only EMAIL tickets; `?channel=LIVE_CHAT` returns LIVE_CHAT tickets.
- `?channel=BOGUS` → `400 VALIDATION_ERROR`.
- `?channel=WHATSAPP` for an `AGENT` intersects with `scope=mine` (no widening) and with `scope=unassigned` (own-team only).
- `?channel=EMAIL&status=OPEN&page=2&limit=5` — composes with another filter + pagination; `meta.total` reflects the channel-filtered count.
- `?channel=SMS` for a `MANAGER` stays within their team.
- Omitting `channel` → identical result set to before this task.

### Non-Goals
- No frontend UI (TK-007). No `createdAt` date-range filter. No `Ticket.channel` index. No portal-listing change.

### Completion Criteria
- Schema + service accept and apply `channel`; visibility and pagination intact; all TK-006 tests + full `ticket.test.ts` green; server + client typecheck clean.

### Verification
```
cd server
npm run typecheck
npm run lint
npm test -- ticket.test.ts
cd ../client
npm run typecheck
```

---

## TK-007 — Frontend `channel` filter in the canonical Tickets list

### Goal
The internal Tickets list exposes a Channel filter that behaves exactly like the existing Status/Priority/Category/Department/Branch filters: URL-search-param persisted, serialised into the TanStack Query key + request, cleared by "Clear filters", localised EN + AR, RTL-safe.

### Why
OD-4 — the plan confirms the canonical filter system is server-backed and extensible; frontend support is in scope.

### Dependencies
`TK-006` (shared `channel` query-param contract).

### Likely Files / Modules
- `client/src/features/tickets/ticket-list-page.tsx` → `TicketListPage` (URL param read, `useTickets` args, `channelOptions`, `hasFilters`, `onClearFilters`, `getEmptyMessage`).
- `client/src/features/tickets/ticket-filters-popover.tsx` → `TicketFiltersPopover` (new `channel` `<select>` modelled on the `status` block; `channel` + `channelOptions` props).
- `client/src/features/tickets/ticket.types.ts` — `TicketChannel` already exists; `TicketFilters.channel` added in TK-006.
- `client/src/locales/en/*.json` + `client/src/locales/ar/*.json` — `tickets.allChannels`, `tickets.channel.WEB|EMAIL|WHATSAPP|SMS|LIVE_CHAT`, `tickets.noChannelMatches` (reuse existing `tickets.channel.*` keys if channel badges already define them — verify first).
- `client/src/features/tickets/ticket-pages.test.tsx`.

### Implementation Requirements
- Read `channel` from `useSearchParams` with the same validate-against-known-list pattern as `status` (5-value `channels` array).
- Pass `channel` into `useTickets({ ... })` so it becomes part of `ticketKeys.list(filters)` and the Axios `params`.
- Add a `channel` `<select>` to `TicketFiltersPopover` (options: `{ value: "", label: t("tickets.allChannels") }` + the 5 channels). Wire `onFilterChange("channel", value)`.
- Include `channel` in `hasFilters`, in the `onClearFilters` handler (`next.delete("channel")`), and in `getEmptyMessage` (new `tickets.noChannelMatches`, single-filter branch).
- EN + AR strings added in lockstep. The popover already uses logical-property styling — the new control inherits RTL correctness; no directional value to isolate.
- Do **not** redesign the filter popover or table; reuse the existing block structure.

### Tests (`ticket-pages.test.tsx`)
- Selecting a channel in the popover pushes `channel=<v>` into the URL and into the query key / request params.
- "Clear filters" removes `channel`; when channel is the only active filter, the empty state shows `tickets.noChannelMatches`.
- EN and AR channel labels render.
- Existing status/priority/category/agent/department/branch filter tests still pass; the canonical list render is unchanged.

### Non-Goals
- No filter-UI redesign. No customer-portal listing change. No new shared component.

### Completion Criteria
- Channel filter works end-to-end in the internal list; URL persistence + clear + empty-state + i18n covered; client typecheck/lint/tests green.

### Verification
```
cd client
npm run typecheck
npm run lint
npm test -- ticket-pages.test.tsx
```

---

## TK-008 — Team-scope `listCustomerTickets` (MANAGER)

### Goal
`GET /api/customers/:id/tickets` returns, for a `MANAGER`, only tickets whose `Ticket.teamId` equals the manager's managed team; `ADMIN` stays org-wide; `AGENT` still receives the customer's full history with `access = SUMMARY_ONLY` for another agent's ticket; `CUSTOMER` stays `403`.

### Why
OD-6 / spec [DG-11](./spec.md#known-gaps--drift): confirmed **Case B** — `listCustomerTickets()` currently filters by `customerId` only (no ticket-visibility predicate), so a `MANAGER` sees cross-team ticket summaries — a visibility bypass and the last ADR-050 "deferred exception".

### Dependencies
`TK-007`.

### Likely Files / Modules
- `server/src/modules/customers/customer.service.ts` → `listCustomerTickets(customerId, query, actor)` (L93–113). The controller already passes `{ userId, role }`.
- Imports: `resolveActorTeamId`, `teamScopedTicketWhere` from `server/src/shared/team/team-scope.js`.

### Implementation Requirements
- Resolve `const teamId = await resolveActorTeamId(actor)` (MANAGER → led team; ADMIN / AGENT → `null`).
- Build `where` as `{ customerId, ...teamScopedTicketWhere(actor, teamId) }`:
  - `ADMIN` → helper returns `{}` → org-wide (unchanged).
  - `MANAGER` → `{ teamId }`, or `MATCH_NOTHING` (`{ id: { in: [] } }`) when teamless → own-team-only / empty page.
  - `AGENT` → helper returns `{}` → full customer history retained; the existing `access` downgrade logic is untouched.
- `where` stays shared by `findMany` + `count` → `meta.total` scoped consistently.
- Do **not** duplicate role logic — use the canonical helper only.
- No status-code change: `ensureCustomerExists` still runs first (`404 CUSTOMER_NOT_FOUND` for a missing customer); a scoped-out result is a normal `200` with a possibly-empty page.

### Tests (smoke here; full matrix in TK-009)
- `MANAGER` whose team owns 1 of a customer's 3 tickets → `data.length === 1`, `meta.total === 1`.
- `ADMIN` → all 3, `access === "FULL"`.

### Non-Goals
- No change to `AGENT` behaviour, the `access` field semantics, the response shape, or any other customer endpoint. No new role logic.

### Completion Criteria
- Helper applied; MANAGER team-bounded; ADMIN/AGENT/CUSTOMER unchanged; TK-008 smoke + updated `customer.test.ts` (see TK-009) green; typecheck/lint clean.

### Verification
```
cd server
npm run typecheck
npm run lint
npm test -- customer.test.ts
```

---

## TK-009 — Customer-ticket visibility tests (split + cross-team leakage)

### Goal
Replace the test that currently encodes the bypass and add same-team / cross-team / teamless regression coverage proving no cross-team ticket metadata reaches a `MANAGER` through `GET /api/customers/:id/tickets`.

### Why
`server/src/modules/customers/customer.test.ts:72` currently asserts `MANAGER → ["FULL","FULL"]` for **all** of a customer's tickets — the exact bypass OD-6 removes.

### Dependencies
`TK-008`.

### Likely Files / Modules
- `server/src/modules/customers/customer.test.ts` (rewrite the MANAGER case; keep and extend the ADMIN/AGENT/CUSTOMER cases). No production change.

### Tests
- **Split the `it.each([["ADMIN"…],["MANAGER"…]])` case:** `ADMIN` → every ticket of the customer, `access = "FULL"`; `MANAGER` → **only** their managed team's tickets for that customer.
- `MANAGER` whose team owns 1 of 3 of the customer's tickets → `data.length === 1`, `meta.total === 1`, the two other-team tickets absent from `data`.
- Teamless `MANAGER` → `data: []`, `meta.total: 0` (no error, `200`).
- **Cross-team leakage assertion:** a `MANAGER` response exposes no `subject` / `status` / `priority` / `assignedAgent` / `category` for a ticket owned by another team (they are simply not in `data`).
- `AGENT` unchanged — full history, `access === "SUMMARY_ONLY"` for another agent's ticket, pagination as today (keep the existing case).
- `CUSTOMER` / unauthenticated → `403` / `401` (keep the existing case).
- Pagination + team scope compose (`?page=2&limit=1` for a `MANAGER` with 2 in-team tickets for the customer).

### Non-Goals
- No production change. No new endpoint / filter.

### Completion Criteria
- The old MANAGER-sees-all assertion is gone; all TK-009 tests pass; full `customer.test.ts` green.

### Verification
```
cd server
npm test -- customer.test.ts
```

---

## TK-010 — Documentation & SDD reconciliation

### Goal
Update the repository documentation to match the implemented behaviour and reconcile the drift catalogued during discovery. No code, no schema.

### Why
Plan §17 + spec Known Gaps DG-1 / DG-2 / DG-3. Documentation is the repository's source of truth (`AGENTS.md`).

### Dependencies
`TK-001` … `TK-009` (all production + test tasks complete).

### Likely Files / Modules
- `docs/07-ticket-workflow.md` — rewrite "Valid Manual Transitions" to the full union incl. every `→ ESCALATED` transition and `ESCALATED → IN_PROGRESS` (DG-1); add: manual `RESOLVED → IN_PROGRESS` clears `resolvedAt`, retains `resolutionDueAt`.
- `docs/08-sla-automation.md` — note a reopened ticket re-enters SLA evaluation against the **retained** `resolutionDueAt` (no fresh deadline).
- `docs/22-realtime-events.md` — update the §3 emission table: add SMS inbound `ticket.message.created`, `portal.service.reply`, `live-chat` start/end, `selfAssignTicket`, and **`portal.service.createTicket` → `ticket.updated`**; refresh the §4 `withRealtimeOutbox` entrypoint list; update the §5 authorization table to state team-scoped `canReceive` (MANAGER own-team, AGENT unassigned-queue narrowed to team).
- `docs/05-api-contract.md` — add the `channel` query param to the `GET /tickets` section (note the list-filter enum includes `LIVE_CHAT`, unlike create); document `GET /api/customers/:id/tickets` MANAGER team-scoping; refresh the stale "Registered routers as of …" and "Later Ticket Actions" / attachment wording.
- `docs/06-auth-rbac.md` — change the ADR-050 "intentional exception … deferred" note for `GET /api/customers/:id/tickets` to "team-scoped for MANAGER (OD-6)"; add `TICKET_ROUTING_CHANGED` to the audited ticket-actions list.
- `docs/19-progress-tracking.md` — record the Tickets SDD implementation on `chore/sdd-foundation` (uncommitted), affected sections, exact test counts, lint/typecheck/build results, and that no migration was required.
- `specs/features/tickets/spec.md` — flip the "approved / not yet implemented" markers on OD-1 … OD-4 / OD-6 to "implemented"; add an "Implemented as" note where behaviour diverged from the plan.
- `specs/features/tickets/plan.md` — mark plan status implemented; keep as historical record.
- `specs/features/tickets/tasks.md` — tick completed tasks; update the status table and progress table.

### Implementation Requirements
- Factual edits only; preserve unrelated content, history, and formatting. Make the smallest accurate change per file.
- **No new ADR** — OD-1 … OD-6 are already recorded decisions and the changes are bug/parity fixes + one additive filter. Add an ADR only if implementation surfaced a genuinely new architectural/product decision (report it and stop instead of inventing one).
- Do not touch `docs/` sections unrelated to the nine changes above.

### Tests
None (documentation only). `git diff --check` must be clean.

### Non-Goals
- No behaviour change. No broad doc rewrite. No new ADR for straightforward fixes.

### Completion Criteria
- Every file above reflects the shipped behaviour; drift items DG-1 / DG-2 / DG-3 are reconciled; spec/plan/tasks statuses updated; `git diff --check` clean.

### Verification
```
git diff --check
```
(Plus a manual read-through that each edited `docs/*` statement matches the code as implemented in TK-001 … TK-009.)

---

## TK-011 — Final verification gate + manual smoke + merge-readiness verdict

### Goal
Run the full verification gate, confirm no schema/migration was introduced, execute the manual smoke checklist, and record a single merge-readiness verdict.

### Why
`specs/constitution.md` "Testing / Verification" + plan §19. This is the gate before the human reviews the Tickets slice for the eventual `master` merge of the whole SDD initiative.

### Dependencies
`TK-001` … `TK-010`.

### Likely Files / Modules
- None modified. Optionally append the results to `specs/features/tickets/tasks.md` (status/progress table) and `.wolf/STATUS.md` / `.wolf/memory.md`.

### Implementation Requirements
Run and record actual output (pass/fail + counts):

**Server (`server/`):**
```
npm run typecheck
npm run lint
npm test -- ticket.test.ts
npm test -- customer.test.ts
npm test -- portal.test.ts realtime.test.ts
npm test -- sla-automation.test.ts
npm test            # full server suite
npm run build
```

**Client (`client/`):**
```
npm run typecheck   # tsc -b — catches test-fixture type errors Vitest misses
npm run lint
npm test -- ticket-pages.test.tsx
npm test            # full client suite
npm run build
```

**Repository:**
```
git diff --check
git status --short          # expect only specs/**, docs/**, .wolf/** changes
```

**Database / schema:**
- `git diff --stat -- server/prisma` → **must be empty**. Confirm no new file under `server/prisma/migrations/`. Confirm `schema.prisma` is unchanged.
- State explicitly: **no Prisma schema change, no migration, no DB migration action required.**

**Manual smoke checklist** (real DB + browser if available; otherwise note "not run — no environment"):
1. Create and open a ticket.
2. Resolve it, then manually reopen it (`RESOLVED → IN_PROGRESS`).
3. Verify `resolvedAt` is cleared and `resolutionDueAt` is retained.
4. Verify the SLA state updates (no longer `MET`; `BREACHED` if past the retained deadline).
5. Change department / branch / team routing; verify exactly one `TICKET_ROUTING_CHANGED` audit row with safe (id-only) metadata via `GET /api/audit-logs`.
6. Create a portal ticket; verify a logged-in `ADMIN`'s ticket list / dashboard updates without a refresh.
7. Filter the internal ticket list by `channel`; combine `channel` with another filter; verify counts and clear-filters.
8. As a `MANAGER`, open a customer whose tickets span teams; verify only the manager's team's tickets appear in the history panel; as an `ADMIN`, verify all appear.
9. As a teamless `MANAGER`, verify the customer ticket-history panel is empty (no error).

### Tests
The full server + client suites, plus every targeted suite listed above.

### Non-Goals
- No code change. No commit / push / merge.

### Completion Criteria
- All server + client typecheck / lint / test / build commands pass; counts recorded.
- `git diff --check` clean; `git status --short` shows only `specs/**`, `docs/**`, `.wolf/**`.
- Confirmed: no Prisma schema change, no migration.
- Manual smoke checklist executed (or explicitly marked not-run with reason).
- End with a verdict line:
  - **`READY FOR HUMAN REVIEW`** — all gates green, no migration, behaviour matches `spec.md` acceptance criteria 43–62; **or**
  - **`BLOCKED`** — with the exact failing gate / unmet criterion.
- Do **not** merge.

### Verification
The commands under **Implementation Requirements** are themselves the verification.

---

## Manual-Smoke Follow-Ups

Post-`TK-011` fixes found during the human manual-smoke pass. MS-01 / MS-02 are
frontend/UX corrections — bringing the client in line with an **already-shipped**
backend invariant (MS-01) or recording a **new client-side product invariant**
that the backend already tolerates (MS-02), with no backend change. MS-03 closes
a genuine backend gap: it extends the existing Portal `409 TICKET_CLOSED`
protection to the staff conversation paths so a `CLOSED` ticket is truly
immutable, and mirrors it in the UI. MS-04 completes the same invariant by
extending the guard to the `PATCH /tickets/:id` metadata / workflow / routing
paths (and the `AGENT` self-claim), so `CLOSED = viewable + immutable` holds for
every mutation, not just the conversation. MS-05 is a client-only fix for the
mirror-image bug the MS-04 smoke pass surfaced: an **OPEN** ticket's edit
silently failing to persist because the sidebar / edit-form re-hydrated their
controls from every `ticket.data` reference change (including SLA-field churn on
a background refetch). No schema, migration, dependency, route, or
response-shape change. Same branch (`chore/sdd-foundation`), not merged.

- [x] **MS-01** — Assigned Agent dropdown offered agents from other teams *(client)*
  - **Symptom:** on the ticket detail sidebar (`TicketSidebar` → `PropertiesSection`), the Assigned Agent select listed every active agent. The backend correctly rejects a cross-team pick (`assertAgentAssignableToTicket` → `409 CROSS_TEAM_ASSIGNMENT`; spec.md §293 / §370 / acceptance #17), so a user could choose an option that always fails to save.
  - **Fix:** `client/src/features/tickets/ticket-sidebar.tsx` — derive `effectiveTeamId = record.team?.id` and call the existing `useAgents(effectiveTeamId)` flow (same hook the create/edit form uses). Client-side `scopedAgents` guard filters cached results to `agent.teamId === effectiveTeamId` and keeps the current assignee visible if a later team move made them cross-team.
  - **Unrouted ticket:** `record.team == null` → `useAgents(undefined)` (full list) is preserved, so assigning an agent still triggers the backend's team-adoption path.
  - **Backend:** untouched — the `409` validation remains the source of truth.
  - **Regression coverage:** `client/src/features/tickets/ticket-details-layout.test.tsx` → `describe("Ticket Details sidebar — Assigned Agent team scoping")`: (1) lookup scoped to the ticket's effective team, (2) unrouted ticket keeps the full list, (3) a cross-team agent is dropped from the options while same-team agents stay.
  - **Verification (`client/`):** `npx tsc -b` → PASS. `npx eslint` on the two changed files → clean. `npx vitest run ticket-details-layout.test.tsx ticket-pages.test.tsx` → PASS, **82** tests (`ticket-details-layout` 33 → **36**).

- [x] **MS-02** — Category change must clear the current Assigned Agent *(client)* — **new product invariant** (recorded in spec.md → *Assignment and Ownership* → "Reclassification clears the assignee (client-UX invariant)")
  - **Rule discovered in smoke testing:** when a ticket's Category changes, the current assignee is no longer valid (a category implies a different team / skill set). The stale agent must not stay selected after reclassification, and an already-assigned ticket must submit `assignedAgentId: null`.
  - **Fix — Ticket Detail sidebar** (`client/src/features/tickets/ticket-sidebar.tsx` `PropertiesSection`): new `handleCategoryChange(next)` — `setCategoryId(next)` **and** `setAssignedAgentId("")` on a real change (`next !== categoryId`). The existing `saveOperations` diff then emits `changes.assignedAgentId = null` (via `assignedAgentId || null`) whenever the ticket had an assignee. MS-01 team-scoped `useAgents(effectiveTeamId)` + `scopedAgents` filtering and the unrouted-ticket full-list path are untouched.
  - **Fix — Create / Edit form** (`client/src/features/tickets/ticket-form-page.tsx`): the Category `<Controller>` `onValueChange` now calls `field.onChange(next)` and then, **only on a genuine change to a different non-empty category** (`next && next !== previous`), `setValue("assignedAgentId", "", { shouldDirty: true })`. The guard keeps the echo `onValueChange` that fires while `reset()` hydrates an existing ticket from wiping the freshly-loaded assignee. The submit already maps `values.assignedAgentId || null`, so a cleared assignment is sent as `assignedAgentId: null` on edit. `handleDepartmentChange` / `handleTeamChange` already cleared the assignee — this makes Category consistent with them.
  - **Backend:** untouched — assignment / team validation (`assertAgentAssignableToTicket`, field allowlists) unchanged.
  - **Regression coverage:**
    - `ticket-details-layout.test.tsx` → `describe("Ticket Details sidebar — Category change clears the assignee")`: (1) an already-assigned ticket resets to Unassigned on Category change, (2) the submitted update is `{ categoryId, assignedAgentId: null }`, (3) re-selecting the **same** Category does not clear the assignee (no spurious dirty state).
    - `ticket-pages.test.tsx`: editing an already-assigned, routed ticket — the loaded assignee hydrates, then a Category change clears it to Unassigned while the new Category sticks (also exercises the MS-01 team-scoped path).
  - **Verification (`client/`):** `npx tsc -b` → PASS. `npx eslint` (`ticket-sidebar.tsx`, `ticket-form-page.tsx`, both test files) → clean. `npx vitest run src/features/tickets` → PASS, **148** tests (`ticket-details-layout` 36 → **39**, `ticket-pages` 46 → **47**).

- [x] **MS-03** — Closed tickets are viewable but immutable *(server + client)* — invariant `CLOSED = viewable + immutable` (recorded in spec.md → *Workflow → Transition rules* + *Invariants enforced* + error-code table)
  - **Rule:** a `CLOSED` ticket stays fully viewable for anyone who could already see it (detail, conversation, internal notes, history, SLA snapshots, attachment list/download), but accepts **no conversation mutation**. `CLOSED` stays terminal — no reopen, no Admin-only override. `RESOLVED` is unchanged: a customer reply still reopens it (to `OPEN`, clearing `resolvedAt`), and a staff reply to a `RESOLVED` ticket is still allowed.
  - **Gap found in smoke testing:** the Portal customer-reply path already rejected a `CLOSED` ticket with `409 TICKET_CLOSED` (`portal.service.reply`), and portal attachment upload already did (`attachment.service`), but the **staff** conversation paths did not — `POST /tickets/:id/messages` (public reply) and `POST /tickets/:id/notes` (internal note) would happily append to a `CLOSED` ticket. The internal UI also still rendered the reply/note composer + Attach action on a `CLOSED` ticket.
  - **Fix — backend (`server/`):**
    - `modules/tickets/ticket.service.ts` → `requireConversationMutationAccess` (shared by `addTicketMessage` **and** `addTicketNote`): select `status`; after the not-found check, `if (ticket.status === TicketStatus.CLOSED) throw new AppError(409, "TICKET_CLOSED", "Closed tickets are read-only")`. One guard covers both staff conversation entrypoints; it runs inside the `$transaction` before any write, so nothing is persisted and no realtime event is emitted.
    - `modules/attachments/attachment.service.ts` → new `requireOpenForMutation({ status })` helper called in `authorizeTicketUpload` + `authorizeMessageUpload` (before `requireAssignedAgent`) → `409 TICKET_CLOSED`. Parity with the pre-existing Portal attachment guard; `requireVisibleTicket` already selects `status`, and the listing paths are untouched (viewing attachments on a `CLOSED` ticket still works).
    - Portal (`portal.service.reply`) `409 TICKET_CLOSED` and the `RESOLVED → OPEN` + `resolvedAt: null` reopen — **untouched**, preserved.
  - **Fix — client (`client/`):**
    - `ticket-permissions.ts` → new `canMutateTicketConversation(ticket, user)` = `ticket.status !== "CLOSED" && canOperateAssignedTicket(...)`.
    - `ticket-detail-page.tsx` → `canMutate={canConverse}` (was `canWorkflow`) + new `closed={isClosed}` prop to `TicketWorkspaceTabs`. `canWorkflow` still drives the sidebar (metadata editing is out of MS-03 scope — "do not block viewing metadata/SLA/history").
    - `ticket-workspace-tabs.tsx` → new `closed` prop; when the composer is gated the read-only hint shows `tickets.conversation.closedReadOnly` instead of the generic `readOnly`. `canMutate === false` already disables the reply + note editors, the send button, Quick Reply, and the Attach file action.
    - i18n: `tickets.conversation.closedReadOnly` added EN + AR.
    - Portal client (`features/portal/portal-pages.tsx`) already shows `portal.closedNotice` and hides the composer + attach for `CLOSED`, and shows the reopen notice for `RESOLVED` — **untouched**.
  - **Regression coverage:**
    - `server/src/modules/tickets/ticket.test.ts` → `describe("MS-03 — CLOSED tickets are viewable but immutable")`: (1) full `CLOSED` detail still serves its conversation, (2) staff public reply → `409 TICKET_CLOSED`, no `messageCreate`, no realtime, (3) staff internal note → `409 TICKET_CLOSED`, no `noteCreate`, no realtime, (4) staff reply to a `RESOLVED` ticket still `201`.
    - `server/src/modules/portal/portal.test.ts` → `describe("MS-03 — CLOSED customer replies rejected, RESOLVED still reopens")`: customer reply to `CLOSED` → `409`, nothing written; customer reply to `RESOLVED` → `201`, `ticket.update` called with `{ status: OPEN, resolvedAt: null }` + `STATUS_CHANGED` history.
    - `client/src/features/tickets/ticket-details-layout.test.tsx` → `describe("Ticket Details — CLOSED ticket is viewable but the composer is disabled")`: conversation still renders, closed notice shown + send action disabled, no Attach file action.
  - **Verification:**
    - `server/`: `npm run typecheck` → PASS. `npm run lint` → PASS. `npx vitest run ticket.test.ts portal.test.ts attachment.test.ts` → PASS, **215** tests (`ticket.test.ts` 131 → **135**, `portal.test.ts` +2). Adjacent suites `sla-automation` / `realtime` / `customer` / `live-chat` → PASS, **101**.
    - `client/`: `npm run typecheck` (`tsc -b`) → PASS. `npx eslint` on the changed files → clean. `npx vitest run ticket-details-layout.test.tsx ticket-pages.test.tsx quick-reply-composer.test.tsx` → PASS, **121** tests (`ticket-details-layout` 39 → **42**). `npm run build` → PASS (pre-existing single-chunk >500 kB warning).

- [x] **MS-04** — CLOSED tickets are fully immutable *(server + client)* — completes the invariant `CLOSED = viewable + immutable` (recorded in spec.md → *Workflow → Transition rules* + *Manual transition matrix* note + *Invariants enforced* + acceptance #8b + error-code table)
  - **Rule:** MS-03 established `CLOSED = viewable + immutable` and closed the conversation paths. MS-04 extends the **same** `409 TICKET_CLOSED` guard to every remaining ticket mutation so a `CLOSED` ticket accepts nothing: `status`, `priority`, `categoryId`, `assignedAgentId`, `subject`, `description`, `departmentId` / `branchId` / `teamId` routing, and an `AGENT` self-claim. All reads (detail, conversation, history, SLA, metadata, attachment list/download) stay fully available. `CLOSED` stays terminal — no reopen, no Admin-only override. `RESOLVED` is unchanged: a customer reply still reopens it (`portal.service`).
  - **Gap found in smoke testing:** after MS-03, `PATCH /tickets/:id` still happily mutated a `CLOSED` ticket's metadata / workflow / routing (only `transitions.CLOSED = []` blocked a *status* move, and it surfaced the wrong code `INVALID_STATUS_TRANSITION`). The internal UI also still rendered the Edit link and the sidebar status/priority/category/assignee controls on a `CLOSED` ticket.
  - **Fix — backend (`server/`):**
    - `modules/tickets/ticket.service.ts` → new shared `assertTicketOpenForMutation({ status })` helper → `409 TICKET_CLOSED "Closed tickets are read-only"`. Called in `updateTicket` (right after the not-found check, **before** `enforceMutationPermissions` / `validateRelations` / `validateTransition`, so a `CLOSED` source returns the canonical `TICKET_CLOSED`, never `INVALID_STATUS_TRANSITION`) and in `selfAssignTicket` (after the visibility check; `current` select gains `status`). `requireConversationMutationAccess` was refactored to call the same helper in place of its inline MS-03 check — one guard for every staff mutation entrypoint.
    - `modules/attachments/attachment.service.ts` → **untouched**; `requireOpenForMutation` from MS-03 already rejects uploads on a `CLOSED` ticket, and the listing/download paths are already open.
    - Portal (`portal.service.reply`) `409 TICKET_CLOSED` + the `RESOLVED → OPEN` reopen — **untouched**, preserved.
  - **Fix — client (`client/`):**
    - `ticket-permissions.ts` → new `isTicketMutable(ticket)` = `ticket.status !== "CLOSED"`; new `canMutateTicketWorkflow(ticket, user)` and `canManageTicketNow(ticket, user)` compose it with the existing `canOperateAssignedTicket` / `canManageTicketDefinition`. `canMutateTicketConversation` (MS-03) and `canSelfAssignTicket` now go through `isTicketMutable` too. No scattered `status !== "CLOSED"` checks in components.
    - `ticket-detail-page.tsx` → `canManage` = `canManageTicketNow(...)`, `canWorkflow` = `canMutateTicketWorkflow(...)` — both now false for `CLOSED`, which hides the header **Edit** link, the sidebar metadata selects, and the AI "Apply category".
    - `ticket-sidebar.tsx` → the existing `!canWorkflow` read-only branch shows `tickets.closedReadOnly` instead of `tickets.unassignedReadOnly` when the ticket is `CLOSED`.
    - `ticket-form-page.tsx` → a direct navigation to `/tickets/:id/edit` for a `CLOSED` ticket renders a `tickets.closedReadOnly` notice + a link back, instead of an editable form whose save always 409s.
    - i18n: `tickets.closedReadOnly` added EN + AR.
  - **Regression coverage:**
    - `server/src/modules/tickets/ticket.test.ts` → `describe("MS-04 — CLOSED tickets are fully immutable")`: an 8-case `it.each` (status / priority / category / assignee / subject / description / department routing / team routing) → `409 TICKET_CLOSED`, no `ticketUpdate` / `historyCreateMany` / `auditCreate` / emit; `AGENT` self-claim on `CLOSED` → `409`, no `updateMany`; a `CLOSED → OPEN` PATCH → code is `TICKET_CLOSED`, not `INVALID_STATUS_TRANSITION`; `GET /tickets/:id` on `CLOSED` still serves history + SLA snapshot + full conversation.
    - `client/src/features/tickets/ticket-details-layout.test.tsx` → `describe("Ticket Details — CLOSED ticket hides all mutation controls")`: Edit link gone; status/priority/category/assignee comboboxes + Save button gone; sidebar closed notice shown; conversation + history still render. Existing MS-03 `describe` updated (`getAllByText` for the now-two closed notices).
  - **Verification:**
    - `server/`: `npm run typecheck` → PASS. `npm run lint` → PASS. `npx vitest run ticket.test.ts` → PASS, **146** tests (135 → **146**). Adjacent `portal` / `attachment` / `sla-automation` / `realtime` / `customer` → PASS, **157**.
    - `client/`: `npx tsc -b` → PASS. `npx eslint` on the changed files → clean. `npx vitest run ticket-details-layout.test.tsx ticket-pages.test.tsx quick-reply-composer.test.tsx` → PASS, **125** tests (`ticket-details-layout` 42 → **46**). `npm run build` → PASS (pre-existing single-chunk >500 kB warning). i18n suite → PASS.

- [x] **MS-05** — An OPEN (non-CLOSED) ticket's edits must actually persist *(client)* — regression found while smoke-testing the MS-01…MS-04 client changes. No backend change (the server accepts every OPEN-ticket PATCH the client sends; verified by replaying the exact edit-form and sidebar payloads against `updateTicket`). Same branch (`chore/sdd-foundation`), not merged.
  - **Symptom:** on an OPEN / `IN_PROGRESS` / etc. ticket, the user could open the sidebar controls or the `/tickets/:id/edit` form, change a field, and Save — but the change did not persist. On the sidebar the "Save changes" button would silently disappear; on the edit form Save would submit the *original* (server) values.
  - **Root cause — re-hydration on every `ticket.data` reference change (not an MS-04-specific bug; the two effects predate it, but the MS smoke pass is where it surfaced):**
    - `ticket-sidebar.tsx` → `PropertiesSection` ran `useEffect(() => { setStatus/setPriority/setCategoryId/setAssignedAgentId(record.*) }, [record])`.
    - `ticket-form-page.tsx` ran `useEffect(() => { reset({ …ticket.data }) }, [reset, ticket.data])`.
    - The ticket **detail** payload carries **time-derived** SLA fields (`slaState`, `effectiveSlaDueAt`, `effectiveSlaTarget` — `deriveSla` runs on every read of a live ticket). So a routine background refetch (`refetchOnWindowFocus`), or the realtime `ticket.updated` → `queryClient.invalidateQueries(ticketKeys.detail(id))` path (which TK-003 / TK-005 made fire in more situations), hands back a **new `ticket.data` object** even when nothing the user is editing changed. React Query's structural sharing still produces a new top-level reference because a nested field (`slaState`) changed, so the `[record]` / `[ticket.data]` effect re-runs and **resets the in-progress edit** before the user can Save. On the sidebar that also flips `dirty` back to `false`, removing the Save button.
  - **Fix — client only, smallest root-cause change:** guard both re-hydration effects with a **field signature** of only the ticket's own editable fields, stored in a `useRef`. The effect re-applies `record` → local state **only when one of those fields actually changed** (initial load, a genuine server-side change, or the post-save refetch), and ignores churn in `slaState` / `effectiveSlaDueAt` / `updatedAt` / conversation / history / attachments.
    - `ticket-sidebar.tsx`: `syncedFieldsRef` over `[id, status, priority, category?.id, assignedAgent?.id]`.
    - `ticket-form-page.tsx`: `hydratedFieldsRef` over `[customer.id, subject, description, priority, category?.id, assignedAgent?.id, department?.id, team?.id]`.
  - **Invariants preserved:** `CLOSED = viewable + fully immutable` (MS-03/MS-04 guards are elsewhere — untouched); OPEN / `IN_PROGRESS` / `WAITING_CUSTOMER` / `RESOLVED` / `ESCALATED` normal editing (edits now survive a refetch); MS-01 team-scoped assignee list (`useAgents` / `scopedAgents` untouched); MS-02 category-change clears the assignee (untouched — and now that clear isn't reverted by a stray refetch); RBAC / team validation (server untouched). After a successful save the refetch carries the changed field values → the signature changes → the controls re-sync and the sidebar Save button hides.
  - **Regression coverage:**
    - `client/src/features/tickets/ticket-details-layout.test.tsx` → `describe("MS-05 — OPEN ticket sidebar edits persist")`: routed OPEN ticket saves a plain status change / a category change / a priority change when the assignee is not in the team-scoped list; **keeps an in-progress priority edit when a background refetch only bumps `slaState`** (the regression); still re-syncs when the ticket's own fields really change (post-save).
    - `client/src/features/tickets/ticket-pages.test.tsx`: the edit form **keeps the user's unsaved subject when `ticket.data` refetches with only a fresher SLA state**; still re-hydrates when the ticket's own `subject` changes upstream.
  - **Note:** during triage a `git checkout` on `server/src/modules/tickets/ticket.test.ts` (which had *unstaged* MS-03/MS-04 server test additions on top of a staged version) discarded ~110 lines of those tests. They were recovered verbatim from the prior implementation session's transcript and re-applied; `ticket.test.ts` is back to **146** passing tests. Logged as bug in `.wolf/buglog.json`.
  - **Verification:**
    - `server/`: `npm run typecheck` → PASS. `npm run lint` → PASS. `npx vitest run ticket.test.ts portal.test.ts attachment.test.ts realtime.test.ts customer.test.ts sla-automation.test.ts` → PASS, **297** tests (`ticket.test.ts` **146**). No server code change.
    - `client/`: `npx tsc -b` → PASS. `npx eslint` on the changed files → clean. `npx vitest run src/features/tickets` → PASS, **162** tests (`ticket-details-layout` 46 → **51**, `ticket-pages` 47 → **49**).

- [x] **MS-06** — Edit-form Priority/Category select could revert to empty right after hydration *(client)* — regression found while smoke-testing the edit form after MS-05. No backend change.
  - **Symptom:** opening `/tickets/:id/edit` on an existing ticket sometimes showed Priority empty / Category empty (other fields hydrated fine). Ruled out: the MS-05 `hydratedFieldsRef` guard fired exactly once with the correct values, and RHF's own state stayed correct throughout — the guard was not the cause.
  - **Root cause:** `RadixSelect` (the non-searchable `AppSelect` variant used for Priority/Category — not the `searchable` variant used for Assigned Agent/Department/Team) wraps `@radix-ui/react-select`, which keeps a hidden native `<select>` mirror in sync for form/autofill compatibility. On the fast controlled-value swing `reset()` produces (default `MEDIUM`/`''` → hydrated `HIGH`/`category-1`, same commit), that mirror fires a second, spurious `onValueChange('')` right after the real value renders; `handleValueChange` forwarded it straight to `field.onChange('')`, reverting the just-hydrated Select back to empty in the DOM even though RHF's state stayed correct. Confirmed via instrumentation of `handleValueChange` (a `''` call fired with no corresponding app-code reset/setValue). The searchable variant doesn't wrap the Radix primitive and was unaffected.
  - **Fix — client only, smallest root-cause change:** `client/src/components/ui/app-select.tsx` `RadixSelect.handleValueChange` drops any raw empty-string (`''`) callback before forwarding to `onValueChange` — every `SelectItem` is keyed through `toInternalValue`, so a genuine "no value" selection always arrives as `EMPTY_SENTINEL`, never raw `''`; a raw `''` can therefore only be Radix's own spurious echo, safe to drop for every non-searchable `AppSelect` consumer.
  - **Invariants preserved:** MS-05 refetch-guard behavior unchanged; MS-02 category-clears-assignee unchanged; MS-01 team scoping unchanged; CLOSED immutability unchanged (fix is in the Select primitive, not ticket logic).
  - **Regression coverage:** `client/src/features/tickets/ticket-pages.test.tsx` → "hydrates Priority and Category on the first load of an existing ticket (not only on refetch)": simulates the real `isLoading:true → data present` transition and asserts the Priority/Category comboboxes' **text content** (`"High"` / `"Billing"`) — prior tests only asserted the combobox existed, never its rendered text, so this gap wasn't caught before.
  - **Verification:** `client/`: `npx vitest run src/features/tickets` → PASS, **163** tests (`ticket-pages` 49 → **50**). `npm run build` (`tsc -b` + `vite build`) → PASS. No server change.

- [x] **MS-07** — `/tickets/:id/edit` Save was a silent no-op on every ticket *(client)*. No backend change.
  - **Symptom:** on the ticket Edit page, clicking Save did nothing — no error, no navigation, no request. `handleSubmit` ran on every click and hit RHF's invalid-validation branch (`errors.channel` set), so `update.mutateAsync` was never reached and no PATCH was ever sent. The failing field had zero UI signal because the Channel field (and its error slot) is wrapped in `{!editing && (...)}` — invisible in edit mode. Ruled out: routing fields (valid at submit time) and the MS-06 RadixSelect guard (channel doesn't use the non-searchable `AppSelect` and isn't rendered on edit).
  - **Root cause:** the MS-05/MS-06 hydration effect's `reset({...})` call replaces the **entire** RHF form state, and it never included `channel` (reasonable at a glance — the edit form never renders or submits that field). RHF therefore reset `channel` to `undefined` on every edit-page load. The shared `ticketFormSchema.channel` was `z.enum(TICKET_CREATE_CHANNELS)` (required, create-only 4-value enum) — `undefined` always fails that, so `handleSubmit`'s validation branch ran on **every** edit-form Save, unconditionally, regardless of which ticket or which fields the user touched.
  - **Fix — client only, smallest root-cause change, two parts (either alone is insufficient — hydrating a value that still fails the narrower enum, e.g. a LIVE_CHAT ticket, would keep failing):**
    1. `ticket-form-page.tsx` hydration `reset({...})` now includes `channel: d.channel` (and the `hydratedFieldsRef` signature includes `d.channel`) — the field, though unrendered/unsubmitted on edit, always holds a valid value instead of `undefined`.
    2. `ticket.types.ts` / `ticket.schemas.ts`: added `TICKET_CHANNELS` (all 5 `TicketChannel` values) and widened the form schema's `channel` to `z.enum(TICKET_CHANNELS)` — the Channel `<select>` still only ever offers `TICKET_CREATE_CHANNELS` on create, but validation now accepts any real ticket channel (incl. `LIVE_CHAT`) so an edit-form hydration can never fail this field again. `ticket-form-page.tsx`'s create-branch payload casts `values.channel as TicketCreateChannel` (that branch's UI can only ever produce a create-eligible value).
  - **Invariants preserved:** MS-01 team-scoped assignees, MS-02 category-clears-assignee, MS-03/MS-04 CLOSED immutability, MS-05 unsaved-edit-survives-refetch guard, MS-06 Priority/Category hydration — none of these paths were touched; `channel` was never part of the update payload before or after.
  - **Regression coverage:** `client/src/features/tickets/ticket-pages.test.tsx` — new "saves an edited ticket on Save click (MS-07 — edit Save was a silent no-op)" (asserts `update.mutateAsync` is called with the exact expected payload and navigation to `/tickets/:id` occurs) and "saves an edited LIVE_CHAT ticket on Save click" (guards the schema-widening fix specifically, since a narrower "just hydrate `d.channel`" fix alone would still fail for a non-create-eligible channel).
  - **Verification:** `client/`: `npx tsc -b` → PASS. `npx eslint` on the changed files → clean. `npx vitest run src/features/tickets/ticket-pages.test.tsx` → PASS, **52** tests. `npx vitest run src/features/tickets` → PASS, **165** tests. No server change.

---

## Task Breakdown Status

`11 / 11 COMPLETE · READY FOR HUMAN REVIEW` (2026-09-10, branch `chore/sdd-foundation`, not merged to `master`).

| Task | Area | Type | Depends on | Status |
| --- | --- | --- | --- | --- |
| TK-001 | server | impl + focused tests | — | ☑ done |
| TK-002 | server | tests | TK-001 | ☑ done |
| TK-003 | server | impl + smoke tests | TK-002 | ☑ done |
| TK-004 | server | tests | TK-003 | ☑ done |
| TK-005 | server | impl + tests | TK-004 | ☑ done |
| TK-006 | server (+client type) | impl + tests | TK-005 | ☑ done |
| TK-007 | client | impl + tests | TK-006 | ☑ done |
| TK-008 | server | impl + smoke tests | TK-007 | ☑ done |
| TK-009 | server | tests | TK-008 | ☑ done |
| TK-010 | docs / specs | docs | TK-001…TK-009 | ☑ done |
| TK-011 | verification | gate | TK-001…TK-010 | ☑ done |

**Prisma migration required:** No.
**Unresolved product decisions:** None (OD-1 … OD-6 resolved; OD-5 deferred by decision).
**Blocker:** None.
