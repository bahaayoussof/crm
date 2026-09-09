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

## After implementation

Update `spec.md`'s Acceptance Criteria (or add a short "Implemented as"
note) when actual behavior intentionally diverges from the original spec,
and update `docs/17-decisions-log.md` if the change is architecturally
significant, per `specs/constitution.md`.
