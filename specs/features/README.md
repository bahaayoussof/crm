# Feature Specs

For a feature that meets the bar in `specs/README.md` ("When a full feature
spec is (and isn't) needed"), create:

```text
specs/features/<feature-name>/
├── spec.md
├── plan.md
└── tasks.md
```

Use a short kebab-case `<feature-name>` (e.g. `live-chat-transfer`,
`sla-pause-on-hold`).

## Ownership contract (spec / plan / tasks)

Each file has one job. Do not duplicate a file's job in another file.

### `spec.md` owns

Purpose, scope/out-of-scope, actors/permissions, functional behavior,
business/domain invariants, API behavior at contract level, edge cases,
acceptance criteria, discovered gaps/deferred scope, and **current feature
status** (implemented / partial / not started, plus known gaps).

It should answer: **"What does this feature do and what behavior is
authoritative?"**

### `plan.md` owns

Implementation approach, architecture choices, existing seams/modules to
reuse, schema/migration strategy when required, backend/frontend
implementation strategy, security considerations, testing strategy, and
rollout/migration risks.

It should answer: **"How should the approved behavior be implemented?"**

`plan.md` must NOT become the execution-status tracker. Once a feature is
implemented, plan.md should simply state that the plan has been implemented
and point to `tasks.md` for execution/verification status — it should not
carry its own progress state ("READY FOR TASK DECOMPOSITION", "NOT YET
IMPLEMENTED", etc.) once work has started.

### `tasks.md` owns

Executable task IDs, implementation/checklist status, acceptance/
verification per task, and concise final verification state.

It should answer: **"What work must be done, and what is complete?"**

`tasks.md` must NOT be used as a session diary, debugging journal, or
chronological transcript. Prefer concise entries:

```text
[x] TASK-ID — goal
Verification: ...
Notes/Risk: ...
```

## `spec.md` — WHAT and WHY

Recommended sections:

- **Goal** — one or two sentences.
- **Context** — why this is needed now; link relevant `docs/` sections or
  `specs/domain-model.md` entities this touches.
- **Actors** — which roles/actors are involved (see
  `specs/domain-model.md#actors--roles`).
- **User Stories** — short, from the actor's point of view.
- **Functional Requirements** — the concrete behavior being added/changed.
- **Permissions** — who can do what; call out any RBAC change explicitly
  (this repo treats permission changes as requiring `docs/06-auth-rbac.md`
  updates — see `specs/constitution.md`).
- **Edge Cases** — states/inputs that need explicit handling.
- **Acceptance Criteria** — observable, testable statements (see below).
- **Out of Scope** — what this feature deliberately does not do.
- **Open Questions** — anything that needs the developer's decision before
  planning starts.

### Acceptance criteria style

Prefer observable, testable criteria. Given/When/Then is useful when the
behavior is conditional or stateful:

```text
Given a logged-in customer
When they start a live chat
Then they must select a department before the conversation starts.
```

Don't force Given/When/Then when a plain requirement is clearer (e.g. "The
export button is disabled while a report is loading.").

## `plan.md` — HOW

Recommended sections:

- **Existing implementation to reuse** — name the actual services/components/
  hooks this should build on (check `specs/architecture.md` and
  `.wolf/anatomy.md` first; do not introduce a new abstraction that
  duplicates an existing one).
- **Architecture changes** — any structural change beyond "add a file here".
- **Backend changes** — routes, controllers, services, middleware.
- **Frontend changes** — pages, hooks, components.
- **Database changes** — Prisma schema/migration, referencing
  `docs/04-database-design.md` conventions.
- **API changes** — request/response shape changes; update
  `docs/05-api-contract.md` when implemented.
- **Realtime implications** — new/changed SSE events, if any.
- **Security / permissions** — server-side enforcement plan.
- **Localization** — new user-facing strings need `en`/`ar` entries.
- **Testing strategy** — what Vitest/Supertest coverage this needs.
- **Risks / migration concerns**.

## `tasks.md` — small, verifiable steps

Break the plan into small tasks, each with a stable ID using the feature's
initials, e.g. `LC-001`, `LC-002`. Each task should be small enough that an
agent can implement and verify it without accidentally completing the rest
of the feature. Example:

```text
LC-001: Add `transferredToAgentId` nullable column + migration
LC-002: Server: POST /api/tickets/:id/transfer (MANAGER/ADMIN only)
LC-003: Server: emit realtime `ticket-transferred` event
LC-004: Frontend: transfer action in ticket header (role-gated)
LC-005: Tests: transfer authorization + realtime event
```

## Feature Coverage Matrix

Reflects repository state as of 2026-09-13. Update this table whenever a
feature package's status changes.

| Feature | Package | Status | Notes |
|---|---|---|---|
| Tickets | `specs/features/tickets/` | Implemented + verified (uncommitted on `chore/sdd-foundation`) | Server 964/964, client 805/805 tests pass. Deferred: bulk actions/export/saved views/SLA pause (DG-12); unmemoised per-request team lookup accepted for V1 (DG-9). |
| Customers | `specs/features/customers/` | Implemented + verified (uncommitted) | Includes case-insensitive email uniqueness hardening (DB-level functional index, CUST-FOLLOWUP-001) and inbound-channel audit logging (DG-1). No open gaps beyond a deliberately deferred `requestContext` (IP/UA) audit-plumbing follow-up. |
| Knowledge Base | `specs/features/knowledge-base/` | Implemented, task-complete, **ready for human review/merge pending one verification step** (uncommitted) | KB Audit Logging (11/11 tasks) and KB Rich Text Content (15/15 tasks) both done; server 926 / client 800 tests pass. `specs/constitution.md` and `specs/architecture.md` correctly document the shipped Rich Text capability (ADR-057 superseding ADR-020) — no stale plain-text claim remains at the global-spec level. Open item: migration apply/rollback for `20260909120000_kb_article_content_text` has not been exercised against a disposable Postgres in this environment — tracked as an explicit pending step in `tasks.md` (KB-RICH-015), required before merge. |
| Conversations / Channels | `specs/features/conversations-channels/` | Implemented + verified (uncommitted) | 57/57 tasks (CONV-001–057) complete; server 1085/1085, client 833+/835 tests pass, migrations applied. Known gap: Portal/Live-Chat reply composer has no client Attach-file UI yet, though the server contract exists (CONV-049). |
| Notifications | `specs/features/notifications/` | Implemented + verified (uncommitted) | 6/6 tasks complete (NOTIF-001/002 fixed dead Task-notification click and missing per-row mark-as-read). Deferred: point-in-time text snapshot not re-checked at read time (NOTIF-GAP-4), no per-type icon differentiation (NOTIF-GAP-5), no "view all" page (NOTIF-GAP-6). |
| Realtime | `specs/features/realtime/` | Implemented + verified (uncommitted) | 5/5 tasks complete; fixed a real SLA auto-escalation team-scope bug (RT-GAP-1/RT-001) with regression coverage (RT-004). Accepted architecture debt: no Redis/multi-instance fanout (RT-GAP-3), no durable replay (RT-GAP-4). |
| Dashboard / Reporting | `specs/features/dashboard-reporting/` | Implemented + verified (uncommitted) | 8/8 tasks complete. No correctness/security defect found; dashboard aggregate scope reuses Tickets' `ticketVisibilityWhere` (no cross-role leak). Fixed one stale `docs/06-auth-rbac.md` claim about AGENT dashboard scope (DR-003). Deferred: duplicated MANAGER scope-rule encoding vs. Tickets (DR-GAP-1), duplicated SLA-window filter in dashboard service (DR-GAP-2), no real-Postgres row-level test (DR-GAP-3, repo-wide characteristic). |
| Tasks / Reminders | `specs/features/tasks-reminders/` | Implemented + verified (uncommitted) | 1/1 fast-track task complete. Fixed a confirmed security/RBAC leak (TASKS-001): a task's linked-ticket `subject` was never re-checked against ticket visibility at read time, so a creator/assignee who lost ticket access (team re-route, reassignment) kept seeing it — closed with read-time redaction + regression tests. Corrected two stale `docs/05-api-contract.md` claims (integration status, MANAGER scope). Deferred: no client UI ever links a task to a ticket despite full backend support (DG-3), MANAGER teamless-scope degrades asymmetrically vs. Tickets (DG-2, not a leak), no CUSTOMER client guard on detail/form pages (DG-4, server-authoritative). |

### Remaining CRM capability areas — ownership status

Listed only where no `specs/features/<name>/` package exists today, or where
ownership needed a check against the actual repository. Confirm against
`.wolf/anatomy.md` / the codebase before starting — this list is not
authoritative discovery, just a planning aid. Reflects repository state as of
2026-09-13.

**Implemented in code, no dedicated SDD package (candidates for a future
package, not gaps in the product):**

- Team & user management — `server/src/modules/{auth,users,teams,departments,branches}`; RBAC behavior is embedded/described in Tickets and Customers specs but the CRUD surfaces themselves have no standalone package.
- SLA policy configuration — `server/src/modules/settings` (`PUT /api/settings/sla-rules/:priority`, category CRUD). Distinct from the SLA **auto-escalation runtime** behavior, which is already covered by Realtime (`RT-GAP-1`) and Tickets (SLA Integration section).
- AI features — `server/src/modules/{ai,customer-ai}`, `client/src/features/ai-assistant`. Referenced only as a read-only dependency by Tickets (`POST /tickets/:id/ai`) and Knowledge Base (AI grounding) specs; no package owns the AI assistant surface itself.
- Quick Replies — `server/src/modules/quick-replies`. Referenced only as a dependency by Conversations/Channels ("Quick Replies/AI for draft insertion only"); not owned by any package.
- Integrations / webhooks **admin configuration** — provider credentials (Resend/WhatsApp/SMS API keys, webhook secrets) are env-var only; no admin UI exists to configure them. Distinct from the provider **transport** (inbound parsing, outbound delivery, retries), which Conversations/Channels already owns and documents.

**Already owned by an existing feature package (not pending):**

- Attachments, Collaboration (`@mention`/watchers), Feedback — all ticket-scoped; owned by `specs/features/tickets/spec.md` ("Ticket owns" / Cross-Feature Boundary Summary).
- Customer Portal — not a standalone capability; portal ticket routes are owned by Tickets, portal Knowledge Base routes by Knowledge Base, and Portal/Live-Chat conversation behavior by Conversations/Channels. No separate "Customer Portal" package is needed.
- Audit Logs — cross-cutting infrastructure (`createAuditLog`) consumed and specified per-mutation inside each owning feature package (Tickets, Customers, Knowledge Base, Conversations/Channels); not a standalone product feature.

**Confirmed not present in this repository (removed from this list after
verification — do not re-add without new evidence):**

- Billing / subscription management — no billing/subscription code, schema, or requirement found anywhere in `server/`, `client/`, or `specs/`.

### Deferred consolidation notes (do not act on these yet)

- Several feature `plan.md`/`spec.md` files duplicate parts of `docs/04-06-09-18-22` (RBAC, API contract, database design, realtime events). This is the known `docs/` ↔ `specs/` overlap the eventual migration is meant to resolve — intentionally left untouched per task scope.

## After implementation

Update `spec.md`'s Acceptance Criteria (or add a short "Implemented as"
note) when actual behavior intentionally diverges from the original spec,
and update `docs/17-decisions-log.md` if the change is architecturally
significant, per `specs/constitution.md`.
