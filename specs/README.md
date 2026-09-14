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
  the production build all pass; full test suite 1114/1114 passes. The
  prior `EPERM` DLL lock during `prisma generate` was caused by a locally
  running `npm run dev` (`tsx watch src/server.ts`) process holding the
  Prisma query engine binary open; stopping that process and clearing the
  stale `.dll.node.tmp*` files resolved it.

### Runtime/DB verification (2026-09-13/14, authorized disposable Neon TEST DB)

A follow-up pass used the project's already-configured Neon database,
explicitly authorized as a **disposable TEST-only** instance for this one
verification session, to close the runtime evidence gap left above.

- **Full migration chain**: `prisma migrate reset --force` rebuilt the
  database from empty through all 19 migrations twice (once before, once
  after runtime testing) -- both rebuilds applied cleanly, `prisma migrate
  status` reported "up to date", `prisma validate` and `prisma generate`
  passed both times. **Full-chain rebuild verified**, not just reviewed by
  inspection.
- **`20260909120000_kb_article_content_text`**: verified at the strongest
  level (Option A). Schema was replayed on real Postgres up to the
  migration immediately before it, a legacy `KnowledgeArticle` row was
  inserted with only the pre-existing `content` column populated (no
  `contentText`), the migration was then applied, and the resulting row
  showed `contentText` backfilled to an exact match of the legacy
  `content` value -- on real PostgreSQL, with real legacy-shaped data.
- **`20260913172511_category_name_lower_unique`**: verified on real
  Postgres. Creating `Support` then `support` raised Prisma `P2002` with
  `target: ["lower(name)"]`; `pg_indexes` confirmed the functional unique
  index `Category_name_lower_key ON "Category" ((lower(name)))` exists
  alongside the original exact-case `Category_name_key`. No API-layer
  mapping could be exercised -- the Category module currently exposes only
  `GET /api/categories` (no create/update endpoint) -- so this is DB-level
  proof only, which is what the constraint actually enforces.
- **API -> Prisma -> PostgreSQL persistence**: exercised with real HTTP
  requests against the rebuilt/reseeded database (ADMIN/AGENT/CUSTOMER
  login through the shared `/api/auth/login` surface, ticket priority
  mutation via `PATCH /api/tickets/:id` read back both directly from
  Postgres and via a separate authenticated `GET`, RBAC checks on
  ticket/KB endpoints, and Knowledge Base + Quick Reply create/read).
  Full flow and role-boundary evidence is in the verification pass report.
- **Fresh rebuild/reapply**: repeated once more after the runtime pass
  (reset -> 19/19 migrations -> reseed -> login sanity check) to confirm
  the environment is reliably reconstructible. **Fresh rebuild/reapply
  verified.**
- **Browser/E2E**: four-role smoke completed for ADMIN, MANAGER, AGENT,
  and CUSTOMER, verifying frontend -> API -> Prisma -> Neon -> reload.
  Final ticket-transaction verification completed with 10 sequential
  watched-ticket replies and 3 internal notes; persistence and watcher
  fan-out were verified with zero P2028, P1001, or transaction-expiry
  errors in the final window. See `specs/reassessment-evidence.md`.
- **Tooling drift found and fixed**: `server/scripts/seed-test-data.ts`
  predated the `contentFormat`/`contentSource` fields added to
  `TicketMessage`/`TicketNote` by the Conversations/Channels migrations
  and failed on a fresh DB. Fixed as a test-tooling change only (no
  product/API code touched) so the seed script matches the current schema.

Remaining gap: client full-suite flakiness (environment, not product).
This is not a proven product defect. See the closing review report for the
full per-test/per-area breakdown.
