# Specs — Spec-Driven Development (SDD) Foundation

This directory is a lightweight Spec-Driven Development layer on top of the
repository's existing `docs/` system. It does **not** replace `docs/` — it
gives future feature work a small, consistent lifecycle (idea → spec → plan →
tasks → implementation) while `docs/` remains the detailed, continuously
maintained source of truth for architecture, API contract, RBAC, ticket
workflow, SLA, and decisions.

If you are about to implement anything, `AGENTS.md` is still the mandatory
entry point and its documentation preflight (reading the relevant `docs/*`
files) is still required. This directory adds a place to specify **new or
materially changing behavior** before it is built.

## Files in this directory

- **`constitution.md`** — stable engineering rules and constraints (tech
  stack, architecture principles, dependency policy, validation,
  localization, testing, Git rules). Changes rarely; summarizes/points at
  `docs/` and `AGENTS.md` rather than duplicating them.
- **`architecture.md`** — current system structure and the important runtime
  flows (auth, ticket creation, ticket conversation, channels, realtime,
  deployment), as verified against the actual code.
- **`domain-model.md`** — the business domain: actors/roles, core entities,
  ticket lifecycle, priorities, channels, SLA, ownership/assignment rules,
  customer visibility. Written for the business rules, not a field-by-field
  Prisma dump.
- **`features/`** — specifications for larger features that materially change
  product behavior. See `features/README.md` for the expected structure and
  when a feature actually needs this.

## This is a reverse-specification pass

`constitution.md`, `architecture.md`, and `domain-model.md` were written by
inspecting the current implementation (Prisma schema, routes, services,
middleware, tests) and the existing `docs/`/`README.md`, which are
themselves actively maintained and already reasonably accurate. Where the
audit found a discrepancy between documentation and code, it is called out
in a `## Review Notes` section at the end of the relevant file instead of
being silently resolved. **None of these documents are authoritative until a
human developer reviews them.**

## Lifecycle for future substantial features

```text
Idea
  -> Specification   (specs/features/<name>/spec.md   — what & why)
  -> Clarification    (resolve open questions with the developer)
  -> Implementation Plan (specs/features/<name>/plan.md — how)
  -> Tasks             (specs/features/<name>/tasks.md — small, ID'd steps)
  -> Implementation     (follow AGENTS.md preflight + existing docs/ conventions)
  -> Verification       (typecheck, lint, tests, build — see constitution.md)
  -> Spec update        (when behavior intentionally changes, update the spec
                          and, where applicable, docs/17-decisions-log.md)
```

## When a full feature spec is (and isn't) needed

A full `specs/features/<name>/` package is generally warranted for:

- new business capabilities
- major integrations (a new channel, a new external provider)
- role/permission changes
- ticket workflow changes (new statuses, new transitions)
- new support channels
- major reporting functionality
- SLA behavior changes
- large cross-stack features (touch schema + API + UI)

A full package is generally **not** needed for:

- spacing/layout tweaks
- badge/color fixes
- simple copy or translation changes
- small isolated bug fixes
- minor responsive fixes

When in doubt, prefer the smaller path — a spec that never gets read is
worse than no spec. `AGENTS.md`'s existing "No-Code-Before-Docs" and branch
rules still apply regardless of whether a feature spec exists.

## Docs consolidation readiness (planning only — not yet executed)

All 13 feature packages under `features/` have completed a brownfield SDD
audit pass (discovery → spec → plan → tasks → verification). This section is
a **migration inventory and future-owner map** for the eventual point where
`specs/` — not `docs/` — becomes the single source of truth. It records
where things should end up; it does not move anything yet.

### Migration inventory (`docs/*.md` → future owner)

Classification: **A** = information already fully owned by an existing
`specs/` file, safe to drop from `docs/` during consolidation; **B** = still
only in `docs/`, must be migrated into a `specs/` file before `docs/` can
stop being authoritative for it; **C** = historical/QA/session-log material
that should become non-normative archive, not a normative spec.

| `docs/` file | Class | Future owner |
|---|---|---|
| `00-project-overview.md` | B | `specs/README.md` / `specs/constitution.md` (project overview) |
| `01-scope-and-priorities.md` | B | `specs/constitution.md` + relevant `specs/features/*/spec.md` |
| `02-architecture.md` | A | `specs/architecture.md` |
| `03-folder-structure.md` | B | `specs/architecture.md` (feature-module boundary conventions) |
| `04-database-design.md` | A | `specs/domain-model.md` (business rules) + `server/prisma/schema.prisma` (physical schema, already authoritative) |
| `05-api-contract.md` | A/C | Contract-level behavior for shipped endpoints is already owned per-feature (`specs/features/*/spec.md`); the full endpoint catalog format itself becomes a non-normative reference, not a duplicate normative source |
| `06-auth-rbac.md` | A | `specs/features/auth-rbac/spec.md` |
| `07-ticket-workflow.md` | A | `specs/features/tickets/spec.md` |
| `08-sla-automation.md` | A | `specs/features/sla-automation/spec.md` (+ `specs/features/sla-settings-categories/` for configuration) |
| `09-frontend-guidelines.md` | A/B | High-level conventions owned by `specs/constitution.md`; detailed how-to content not yet migrated |
| `10-backend-guidelines.md` | A/B | High-level conventions owned by `specs/constitution.md`; detailed how-to content not yet migrated |
| `11-ai-features.md` | A | `specs/features/ai-assistance/spec.md` |
| `12-testing-strategy.md` | B | `specs/constitution.md` (testing strategy section — not yet present) |
| `13-deployment.md` | B | `specs/architecture.md` (deployment section — referenced but not yet migrated) |
| `14-implementation-plan.md` | C | Historical build plan; archive, not a spec |
| `15-feature-branch-workflow.md` | B | `specs/constitution.md` (Git/workflow rules) |
| `16-definition-of-done.md` | A/B | Overlaps `specs/features/README.md`'s verification conventions; not fully reconciled |
| `17-decisions-log.md` | B | Future `specs/decisions.md`, if still desired as a live log |
| `18-ui-pages-spec.md` | C | Superseded by per-feature functional requirements/acceptance criteria in `specs/features/*/spec.md`; keep as historical page-catalog reference, not normative |
| `19-progress-tracking.md` | C | Historical/session log; archive only |
| `20-whatsapp-integration.md` | A/B | Behavioral contract owned by `specs/features/conversations-channels/spec.md`; operational/setup detail not yet migrated |
| `21-email-integration.md` | A/B | Same as above — `specs/features/conversations-channels/spec.md` |
| `22-realtime-events.md` | A | `specs/features/realtime/spec.md` |
| `23-sms-integration.md` | A/B | Same pattern as WhatsApp/Email — `specs/features/conversations-channels/spec.md` |
| `24-final-qa-production-readiness.md` | C | Historical QA log; archive only |
| `25-fresh-db-browser-qa.md` | C | Historical QA log; archive only |
| `dev-test-data.md` | C | Dev fixture reference; non-normative |

### Canonical future owners (summary)

- Project overview → `specs/README.md` / `specs/constitution.md`
- Scope/priorities → `specs/constitution.md` + feature specs
- Architecture → `specs/architecture.md`
- Database/domain rules → `specs/domain-model.md` + `server/prisma/schema.prisma`
- API feature contracts → each `specs/features/<name>/spec.md`
- Auth/RBAC → `specs/features/auth-rbac/`
- Ticket workflow → `specs/features/tickets/`
- SLA → `specs/features/sla-settings-categories/` (configuration) + `specs/features/sla-automation/` (execution) + `specs/features/tickets/` (deadline snapshot/lifecycle integration)
- Frontend/backend conventions → `specs/constitution.md` + `specs/architecture.md`
- AI → `specs/features/ai-assistance/`
- Testing strategy → `specs/constitution.md`
- Deployment → `specs/architecture.md`
- Implementation/progress logs → non-normative archive, not authoritative specs
- Decisions log → future `specs/decisions.md`, if still desired
- Provider integrations (Email/SMS/WhatsApp) → `specs/features/conversations-channels/`

No `docs/` file is moved, deleted, or rewritten by this section — it exists
so the eventual consolidation pass has a ready-made map instead of having to
re-derive ownership from scratch.
