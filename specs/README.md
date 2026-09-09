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
