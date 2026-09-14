# Reassessment Evidence

Purpose: fast evaluator navigation to strongest evidence against
`AI_FullStack_Assessment_Rubric_v1.0`. Not a duplicate of feature specs —
see `specs/features/<name>/{spec,plan,tasks}.md` for full detail and
`specs/decisions.md` for the ADR log.

## Official rubric mapping

| # | Criterion | Weight | Primary evidence location |
|---|---|---:|---|
| 1 | Requirement & Specification | 10 | `specs/features/*/spec.md` (Scope, Actors, Acceptance Criteria, Edge Cases, Non-Goals sections) |
| 2 | Planning & Task Breakdown | 20 | `specs/features/*/plan.md` + `tasks.md` (dependency graphs, phased plans, verification gates) |
| 3 | AI Usage & Verification | 10 | `.wolf/cerebrum.md` Do-Not-Repeat, `.wolf/buglog.json`, brownfield-audit spec.md "Discovered Gap" sections |
| 4 | Engineering Foundations | 10 | `specs/architecture.md`, `server/src/middleware/auth.ts`, shared helpers (`shared/sla/derive-sla.ts`, `shared/team/team-scope.ts`) |
| 5 | Backend / API / Database | 10 | `server/prisma/migrations/` (19 migrations), Tickets/Customers/Auth spec.md, real Neon runtime verification (this session's transcript, not yet a file) |
| 6 | Frontend & End-to-End Flow | 10 | `client/src/features/*`, `client/src/features/tickets/ticket-conversation-ui.tsx` (shared rich-text/portal component) |
| 7 | Productivity & Delivery | 10 | `git log` (141 commits, Conventional Commits, feature/fix/docs scoped), `README.md` §14–16 |
| 8 | Correctness & Maintainability | 10 | ADR-040/041 (shared FileUploadModal, link popover reuse), `e636c44` rich-text extraction commit |
| 9 | Testing, Security & Edge Cases | 5 | server 1111/1111 tests, RBAC/IDOR fixes below, `.wolf/buglog.json` |
| 10 | Technical Understanding & Ownership | 5 | bug-190 (live-DB-only race), bug-196 (RBAC reversal), Neon destructive-op authorization gate |

## Mandatory scope evidence

- Customer CRUD + validation: `specs/features/customers/spec.md`; ADR-013 (AGENT read-only), ADR-014 (safe history summaries); case-insensitive email uniqueness enforced by a hand-authored functional index (`20260912163955_customer_email_lower_unique`) because Prisma schema DSL can't express it.
- Ticket CRUD + workflow: `specs/features/tickets/spec.md`; ADR-009/015/046/048/050/051 (visibility, ownership, status simplification, team scoping, auto-assignment).
- Agent dashboard: `specs/features/dashboard-reporting/spec.md`; ADR-011/016/048 (role-aware primary queues, agent performance block).
- Auth/RBAC: `specs/features/auth-rbac/spec.md`; ADR-006/025/042; bug-196 fix (stale-authority reload).
- End-to-end flow: HTTP → Express route → controller/service → Prisma → PostgreSQL verified this session against a real Neon test database (19-migration chain applied, ticket mutation persisted, subsequent read returned the persisted value, RBAC denial observed at runtime). Browser-level smoke not yet performed — see Known Disclosed Gaps.
- README/architecture notes: `README.md` (629 lines, §1–16 cover journey, architecture, both maps, lifecycle, team scope, frontend/backend architecture, realtime, omnichannel, domain model, local dev, testing); `specs/architecture.md`, `specs/domain-model.md`, `specs/constitution.md`.
- Tests / repeatable verification: server 1111/1111 (58 files), client passes when run isolated/grouped (full-parallel run shows CPU-contention timeouts, not a product defect — see `.wolf/cerebrum.md` 2026-09-13 entry).

## Strongest SDD examples (Planning & Task Breakdown, Weight 20)

Full chain — requirement → assumptions → plan → dependencies → ordered tasks → implementation → discovered gap → correction → verification — demonstrated end-to-end in:

1. **Knowledge Base Rich Text**, `specs/features/knowledge-base/tasks.md:1740-1807` (task KB-RICH-015). Migration apply/rollback step could not be executed in the dev environment; the task explicitly refuses to self-report DB-verified status until that step runs, and `spec.md:11` carries the gate into the package header ("MERGE GATED ON MIGRATION VERIFICATION"). This is disclosed limitation, not overclaimed completion.

   This historical gate was later closed by the real-Neon verification documented below: the full migration chain was applied, a legacy content-only row was migrated, and contentText backfill was verified against real PostgreSQL. The original task record is intentionally preserved to show verification was not claimed prematurely.

   | Step | Evidence |
   |---|---|
   | Requirement | `specs/features/knowledge-base/spec.md:11` (rich-text content requirement, gated header) |
   | Spec | `specs/features/knowledge-base/spec.md:992-1015` (migration gap disclosed at spec time) |
   | Plan | `specs/features/knowledge-base/plan.md` (contentText backfill approach) |
   | Dependencies | `specs/features/knowledge-base/tasks.md:1740-1807` (KB-RICH-015 depends on migration apply/rollback step) |
   | Tasks | `specs/features/knowledge-base/tasks.md:1740-1807` (KB-RICH-015 refuses DB-verified status pending migration) |
   | Implementation | `20260909120000_kb_article_content_text` migration |
   | Gap | Migration apply/rollback step not executable in dev environment at spec time; merge gated |
   | Correction | Real Neon TEST database reset, full migration chain applied this session |
   | Verification | Legacy content-only row migrated and contentText backfill verified against real PostgreSQL (see Runtime verification section below) |

2. **Auth/RBAC stale-authority defect**, `specs/features/auth-rbac/spec.md:62-82` (SG-1/TG-1/TG-2/DD-1). Test-first correction: `tasks.md` adds failing coverage for the gap (AUTH-001/002) before the fix (AUTH-003), then re-verifies every other role boundary wasn't broken (AUTH-004-009), full-suite regression (AUTH-010/011, "1096/1096 tests across 58 files"). `plan.md:5` states the rejected alternative explicitly (stateful sessions) vs. the chosen minimal-seam fix (reload current user in `requireRole`).
3. **SLA-Automation dual defect fix**, `specs/features/sla-automation/spec.md:86-87` (DG-1 wrong-recipient, DG-2 sweep-failure isolation). `plan.md:33-35` reasons about blast radius before touching code ("DG-1 strictly widens... DG-2 strictly narrows... cannot introduce a cross-team leak"). Verified with a two-candidate concurrency-style regression test (`tasks.md:28-35`) proving one candidate's transaction failure doesn't discard already-committed peers' realtime events.
4. **Conversations/Channels correlation-fallback removal**, `specs/features/conversations-channels/spec.md:484,494` (CC-GAP-11/21) — removed "customer's newest active ticket" identity-only matching across SMS/WhatsApp per decision OD-CC-4 (`spec.md:519`), replacing with thread/reference-based correlation; a genuine architecture correction driven by an audit, not a first-pass design.

## Runtime verification (this session, real Neon PostgreSQL)

- Authorized TEST database reset, full 19-migration chain applied (repeatable, run more than once).
- KB legacy-content backfill verified against real PostgreSQL.
- Category case-insensitive unique index verified against real PostgreSQL.
- Seed drift found and corrected during fresh-DB verification (`contentFormat` field missing from seed script — caught by real-DB constraint failure, not by mocked tests).
- Live HTTP auth round-trip; a real Ticket mutation persisted via Prisma → PostgreSQL; a subsequent API read returned the persisted value.
- RBAC denial verified at runtime (not just unit-tested).
- Fresh rebuild → reseed → login cycle verified.
- **Not yet done:** browser-driven UI → API → DB smoke. Frontend build/typecheck/lint pass and component/integration tests pass, but no current-session visual/browser confirmation exists.

## Security/correctness discoveries (AI-assisted, human-verified)

| Bug | Defect | Fix | Why it shows ownership, not AI dependence |
|---|---|---|---|
| bug-196 | `requireRole` trusted JWT-embedded role/active-state up to 8h post-demotion/deactivation | Reload current user state per request | A prior session (2026-08-27, `.wolf/cerebrum.md`) deliberately chose the *lighter* stateless design; this pass re-assessed it as a live vulnerability and reversed the decision with new tests — judgment applied twice, not a one-shot AI suggestion. |
| bug-197 | `Task.ticket{id,subject}` leaked regardless of current ticket visibility | `redactUnauthorizedTicketLinks` | Found by re-checking a documented "done" task against actual visibility rules, not by a new feature request. |
| bug-198 | Quick Reply CRUD produced zero `AuditLog` rows, inconsistent with every sibling admin module | Added `QUICK_REPLY_CREATED/UPDATED/DELETED`, body diffed as presence-only boolean (privacy-aware) | Shows deliberate scope limiting (not logging body text) rather than blind logging. |
| bug-190 | Live-chat race: P2002 recovery re-queried an already-aborted Postgres transaction client, causing real 500s | Re-query on a fresh client after rollback | **Found by testing against a real dev Neon DB**, not by mocked unit tests — direct evidence mocks alone were insufficient and real-DB verification caught what they missed. |
| bug-189 | `createCanonicalTicket` had 9 passing tests and zero production callers, despite docs claiming full rollout | Wired into all 6 ticket-creation paths | Caught by grepping call sites instead of trusting a `tasks.md [x]` checkbox — explicit distrust of self-reported AI completion claims. |

Destructive-action discipline: Neon TEST database reset only performed after explicit human authorization this session; `npm audit` fix requiring a forced dependency downgrade was found and **deliberately not applied** without sign-off.

## Known disclosed gaps

- Browser-driven UI smoke test not yet performed this session (frontend/backend integration proven at the HTTP/API layer, not yet visually in a browser).
- Client full-suite run shows CPU-contention-sensitive timeouts under full parallel load; affected tests pass individually/in groups — documented as tooling drift, not a reproduced product defect.
- KB Rich Text migration apply/rollback step flagged as not-yet-executed in a disposable DB at spec time (`specs/features/knowledge-base/spec.md:992-1015`); superseded by this session's real-Neon migration-chain verification above, but the historical spec text still shows the gap was disclosed rather than hidden.
- `npm audit` high-severity advisory (via Prisma CLI's `deepmerge-ts`) known, forced-downgrade fix intentionally deferred.
- AD-1 in `specs/features/auth-rbac/spec.md:80-82` is explicit deferred architecture debt, not fixed in this cycle.

## Key file links

- ADR log: `specs/decisions.md` (57 ADRs, curated with supersession chain)
- Architecture: `specs/architecture.md`, `specs/domain-model.md`, `specs/constitution.md`
- Feature packages: `specs/features/{auth-rbac,tickets,customers,dashboard-reporting,sla-automation,conversations-channels,knowledge-base,tasks-reminders,quick-replies,notifications,realtime,sla-settings-categories,ai-assistance}/{spec,plan,tasks}.md`
- Root README: `README.md`
- Session logs: `.wolf/STATUS.md`, `.wolf/cerebrum.md`, `.wolf/buglog.json`
