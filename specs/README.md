# Specs — Spec-Driven Development (SDD) Foundation

This directory is the **canonical single source of truth (SSOT)** for the
Customer Support CRM's current architecture, domain rules, and feature
behavior. It gives feature work a small, consistent lifecycle (idea → spec →
plan → tasks → implementation) and — since the 2026-09-13 docs → specs
consolidation — is no longer a layer *on top of* `docs/`. `docs/` is now
historical/supporting material only (see `docs/README.md`); where the two
disagree, `specs/` plus the actual implementation win.

If you are about to implement anything, `AGENTS.md` is still the mandatory
entry point. Its documentation preflight now points at this directory
first: `constitution.md` → `architecture.md` → `domain-model.md` →
the owning `specs/features/<name>/spec.md` when one exists. This directory
also adds a place to specify **new or materially changing behavior** before
it is built.

## Files in this directory

- **`constitution.md`** — stable engineering rules and constraints (tech
  stack, scope/priorities, architecture principles, dependency policy,
  validation, API conventions, localization, accessibility/design
  conventions, testing strategy, definition of done, Git/branch rules).
  Changes rarely.
- **`architecture.md`** — current system structure and the important runtime
  flows (auth, ticket creation, ticket conversation, channels, realtime,
  module/folder boundaries, deployment, external provider architecture), as
  verified against the actual code.
- **`domain-model.md`** — the business domain: actors/roles, core entities,
  ticket lifecycle, priorities, channels, SLA, ownership/assignment rules,
  customer visibility. Written for the business rules, not a field-by-field
  Prisma dump (the physical schema stays authoritative in
  `server/prisma/schema.prisma`).
- **`decisions.md`** — the canonical architecture decision log (ADR-001
  onward). Append new decisions here; do not recreate `docs/17-decisions-log.md`.
- **`features/`** — specifications for larger features that materially change
  product behavior. See `features/README.md` for the expected structure,
  the current feature coverage matrix, and when a feature actually needs
  this.

## Provenance

`constitution.md`, `architecture.md`, and `domain-model.md` were originally
written by inspecting the implementation (Prisma schema, routes, services,
middleware, tests) and cross-checked against the (now-retired) `docs/`
system. Every `specs/features/<name>/` package went through its own
brownfield SDD audit (discovery → spec → plan → tasks → verification).
Where an audit found a discrepancy between documentation and code, it is
called out in a `## Review Notes` / "Discovered Gaps" section in the
relevant file instead of being silently resolved — that discipline
continues to apply to future changes here.

## Lifecycle for future substantial features

```text
Idea
  -> Specification   (specs/features/<name>/spec.md   — what & why)
  -> Clarification    (resolve open questions with the developer)
  -> Implementation Plan (specs/features/<name>/plan.md — how)
  -> Tasks             (specs/features/<name>/tasks.md — small, ID'd steps)
  -> Implementation     (follow AGENTS.md preflight + specs/ conventions)
  -> Verification       (typecheck, lint, tests, build — see constitution.md)
  -> Spec update        (when behavior intentionally changes, update the spec
                          and, where architecturally significant, specs/decisions.md)
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

## Docs consolidation — executed (2026-09-13)

The migration inventory that used to live in this section has been
executed. Summary of the outcome (full detail in the consolidation
session's report / commit):

- **Removed from `docs/`** (content fully migrated, or already fully owned
  elsewhere, verified against current code first): `00-project-overview.md`,
  `01-scope-and-priorities.md`, `02-architecture.md`, `03-folder-structure.md`,
  `04-database-design.md`, `05-api-contract.md`, `06-auth-rbac.md`,
  `07-ticket-workflow.md`, `08-sla-automation.md`, `09-frontend-guidelines.md`,
  `10-backend-guidelines.md`, `11-ai-features.md`, `12-testing-strategy.md`,
  `13-deployment.md`, `14-implementation-plan.md`, `15-feature-branch-workflow.md`,
  `16-definition-of-done.md`, `17-decisions-log.md`, `20-whatsapp-integration.md`,
  `21-email-integration.md`, `22-realtime-events.md`, `23-sms-integration.md`.
- **Retained in `docs/`, explicitly labeled non-authoritative/historical**:
  `18-ui-pages-spec.md`, `19-progress-tracking.md`,
  `24-final-qa-production-readiness.md`, `25-fresh-db-browser-qa.md`,
  `dev-test-data.md`. See `docs/README.md`.
- **New canonical files**: `specs/decisions.md` (ADR log, replaces
  `docs/17-decisions-log.md`). Cross-cutting API conventions (envelope,
  error shape, pagination, 404 concealment, dates) were folded into
  `specs/constitution.md` rather than creating a separate file — no
  endpoint-catalog duplicate of `docs/05-api-contract.md` was created;
  endpoint-level behavior lives in each owning `specs/features/*/spec.md`.
- Folder-structure conventions → `specs/architecture.md` "Module / Folder
  Boundary Conventions". Deployment facts (cron table, env var boundary,
  external provider architecture) → `specs/architecture.md` "Deployment".
  Scope/priorities → `specs/constitution.md` "Project Scope & Priorities".
  Testing-tier vocabulary and the "never claim unverified verification"
  rule → `specs/constitution.md` "Testing / Verification". Definition of
  Done → `specs/constitution.md` "Definition of Done". Git/branch workflow
  → `specs/constitution.md` "Git Rules".

## Final verification summary (2026-09-13, `chore/sdd-foundation`)

A verification-closure pass re-ran the full technical gate to resolve the
open items from the prior closing review. Results:

- **Client**: typecheck clean, lint clean (2 pre-existing warnings only),
  build succeeds. Full test suite (851 tests) is **intermittently flaky**
  under this machine's parallel test execution: three consecutive full
  runs produced 0, 1, and 2 single-test `5000ms` timeouts, each time in a
  **different** file, none matching a specific test's own logic (the five
  originally reported failing tests all passed cleanly, both in isolation
  and grouped together, across every run). Root cause is worker/CPU
  contention on this environment, not a reproducible test or product
  defect -- no timeout values were changed to mask this.
- **Server**: typecheck, lint, `prisma validate`, `prisma generate`, and
  the production build all pass; full test suite 1111/1111 passes. The
  prior `EPERM` DLL lock during `prisma generate` was caused by a locally
  running `npm run dev` (`tsx watch src/server.ts`) process holding the
  Prisma query engine binary open; stopping that process and clearing the
  stale `.dll.node.tmp*` files resolved it.
- **Migrations** (`20260909120000_kb_article_content_text`,
  `20260913172511_category_name_lower_unique`): both reviewed by static
  SQL inspection only (additive nullable column + straight backfill;
  functional unique index mirroring the existing `Customer.email` pattern)
  and are safe by inspection. No disposable PostgreSQL instance was
  available in this environment (no Docker, no local `psql`/`pg_ctl`, the
  only configured `DATABASE_URL` is a remote Neon instance) --
  **disposable PostgreSQL unavailable; live migration verification not
  performed.**
- **Browser/E2E**: no Playwright config or browser-smoke tooling exists in
  this repo. Exercising any write flow (ticket reply, quick reply, KB
  article) would require the dev server to connect to the only reachable
  database -- the remote Neon (production-like) instance -- which is unsafe
  for this pass. **Not performed.**

Remaining gaps are verification/environment debt, not proven product
defects. See the closing review report for the full per-test/per-area
breakdown.
