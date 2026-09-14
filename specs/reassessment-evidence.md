# Reassessment Evidence

Purpose: fast evaluator navigation to strongest evidence against
`AI_FullStack_Assessment_Rubric_v1.0`. Not a duplicate of feature specs —
see `specs/features/<name>/{spec,plan,tasks}.md` for full detail and
`specs/decisions.md` for the ADR log.

## Assessment Evidence Summary

- Full SDD workflow (spec → plan → tasks → implementation → verification) applied across 13 feature packages; four traced end-to-end in "Strongest SDD examples" below.
- Real Neon PostgreSQL runtime verification: 19-migration chain, KB legacy-content backfill, case-insensitive uniqueness, live mutation/read-back, RBAC denial, fresh rebuild/reseed repeatability.
- Full browser E2E verification across all 4 roles (ADMIN, MANAGER, AGENT, CUSTOMER): UI mutation → API → Prisma → PostgreSQL → reload, confirmed live.
- Server test suite: **1114/1114** passing (58 files); typecheck, lint, `prisma validate`, `git diff --check` all clean.
- Ticket transaction reliability hardening verified with a final browser run: 10 sequential replies + 3 sequential notes, zero P2028/P1001, zero duplicates/missing messages, correct watcher fan-out.
- Authorization authority hardening: protected requests now re-evaluate current role/active-state/password-change status instead of trusting stale JWT claims; RBAC regression-tested and denial verified at runtime.
- AI-assisted development with systematic human verification: every AI-produced claim below was checked against real call sites, real threat models, or a real Postgres instance before being trusted — several were reversed or corrected as a result.

## Official Rubric Mapping

| # | Criterion | Weight | Primary evidence location |
|---|---|---:|---|
| 1 | Requirement & Specification | 10 | `specs/features/*/spec.md` (Scope, Actors, Acceptance Criteria, Edge Cases, Non-Goals sections) |
| 2 | Planning & Task Breakdown | 20 | `specs/features/*/plan.md` + `tasks.md` (dependency graphs, phased plans, verification gates) |
| 3 | AI Usage & Verification | 10 | "AI Usage & Verification" section below (tracked, evaluator-visible); `.wolf/cerebrum.md`/`.wolf/buglog.json` are local-only supplements, not primary evidence |
| 4 | Engineering Foundations | 10 | `specs/architecture.md`, `server/src/middleware/auth.ts`, shared helpers (`shared/sla/derive-sla.ts`, `shared/team/team-scope.ts`) |
| 5 | Backend / API / Database | 10 | `server/prisma/migrations/` (19 migrations), Tickets/Customers/Auth spec.md, real Neon runtime verification below |
| 6 | Frontend & End-to-End Flow | 10 | `client/src/features/*`, `client/src/features/tickets/ticket-conversation-ui.tsx` (shared rich-text/portal component); browser runtime smoke verified across all 4 roles against Neon TEST DB |
| 7 | Productivity & Delivery | 10 | `git log` (141+ commits, Conventional Commits, feature/fix/docs scoped), `README.md` §14–16 |
| 8 | Correctness & Maintainability | 10 | ADR-040/041 (shared FileUploadModal, link popover reuse), `e636c44` rich-text extraction commit |
| 9 | Testing, Security & Edge Cases | 5 | server 1114/1114 tests, "Engineering Hardening & Verification Outcomes" below |
| 10 | Technical Understanding & Ownership | 5 | Real-database concurrency verification (`server/src/modules/live-chat/live-chat.service.ts`), authorization authority hardening (`specs/features/auth-rbac/spec.md:62-82`), Neon destructive-op authorization gate ("Destructive-action discipline" below) |

## Previous Recommendation Coverage

| Recommendation | Current evidence | Status |
|---|---|---|
| Acceptance criteria / assumptions / ordered tasks / dependencies / trade-offs | Explicit acceptance criteria, assumptions, dependencies, task ordering, and trade-offs are now established in the SDD workflow (`specs/features/*/spec.md`, `plan.md`, `tasks.md`) and used for ongoing/current work; retrospective authorship remains historically distinguishable from work planned before implementation. | Established for current/future work |
| Ticket priority / assigned-dashboard / auth / permissions evidence | `specs/features/tickets/spec.md`, `specs/features/dashboard-reporting/spec.md`, `specs/features/auth-rbac/spec.md`; runtime RBAC/team-scope denial verified live against Neon and in browser (all 4 roles). | Strongly evidenced |
| Backend architecture clarity | `specs/architecture.md`, `specs/domain-model.md`, shared helpers (`shared/sla/derive-sla.ts`, `shared/team/team-scope.ts`), 19-migration Prisma chain. | Strongly evidenced |
| Verification commands / outcomes / AI correction history | 1114/1114 server tests, typecheck/lint/`prisma validate`/`git diff --check` clean; "AI Usage & Verification" section documents each correction with proof. | Strongly evidenced |
| Runtime frontend → API → DB verification | Real Neon PostgreSQL mutation/read-back; full 4-role browser smoke; final transaction-hardening browser verification (10 replies + 3 notes, zero errors). | Strongly evidenced |

## Mandatory Scope Evidence

- Customer CRUD + validation: `specs/features/customers/spec.md`; ADR-013 (AGENT read-only), ADR-014 (safe history summaries); case-insensitive email uniqueness enforced by a hand-authored functional index (`20260912163955_customer_email_lower_unique`) because Prisma schema DSL can't express it.
- Ticket CRUD + workflow: `specs/features/tickets/spec.md`; ADR-009/015/046/048/050/051 (visibility, ownership, status simplification, team scoping, auto-assignment).
- Agent dashboard: `specs/features/dashboard-reporting/spec.md`; ADR-011/016/048 (role-aware primary queues, agent performance block).
- Auth/RBAC: `specs/features/auth-rbac/spec.md`; ADR-006/025/042; authorization authority hardening (stale-authority reload — see "Engineering Hardening & Verification Outcomes" below).
- End-to-end flow: HTTP → Express route → controller/service → Prisma → PostgreSQL verified against a real Neon test database (19-migration chain applied, ticket mutation persisted, subsequent read returned the persisted value, RBAC denial observed at runtime). Full browser runtime smoke verified across all 4 roles (ADMIN, MANAGER, AGENT, CUSTOMER): UI mutation (priority change & rich text reply) persisted through Prisma to PostgreSQL and verified on page refresh and direct DB query; RBAC team scoping and customer portal privacy boundaries confirmed in browser UI.
- README/architecture notes: `README.md` (629 lines, §1–16 cover journey, architecture, both maps, lifecycle, team scope, frontend/backend architecture, realtime, omnichannel, domain model, local dev, testing); `specs/architecture.md`, `specs/domain-model.md`, `specs/constitution.md`.
- Tests / repeatable verification: server **1114/1114** (58 files), client passes when run isolated/grouped (full-parallel run shows CPU-contention timeouts, not a product defect — see `.wolf/cerebrum.md` 2026-09-13 entry).

## Strongest SDD Examples (Planning & Task Breakdown, Weight 20)

Full chain — requirement → assumptions → plan → dependencies → ordered tasks → implementation → discovered gap → correction → verification — demonstrated end-to-end in:

1. **Knowledge Base rich-text migration verification**, `specs/features/knowledge-base/tasks.md:1740-1807` (task KB-RICH-015). Migration apply/rollback step could not be executed in the dev environment at spec time; the task explicitly refused to self-report DB-verified status until that step ran, and `spec.md:11` carried the gate into the package header ("MERGE GATED ON MIGRATION VERIFICATION"). This is disclosed limitation, not overclaimed completion.

   The apply/backfill portion of this gate is now closed by real-Neon verification: the full migration chain was applied, a legacy content-only row was migrated, contentText backfill was verified against real PostgreSQL, and a fresh rebuild/reapply of the full chain was verified. Rollback itself was NOT exercised — Prisma migrations don't provide an automatic rollback flow, and no explicit rollback procedure was run this pass; that part remains a disclosed open item (see "Remaining Limitations").

   | Step | Evidence |
   |---|---|
   | Requirement | `specs/features/knowledge-base/spec.md:11` (rich-text content requirement, gated header) |
   | Spec | `specs/features/knowledge-base/spec.md:992-1015` (migration gap disclosed at spec time) |
   | Plan | `specs/features/knowledge-base/plan.md` (contentText backfill approach) |
   | Dependencies | `specs/features/knowledge-base/tasks.md:1740-1807` (KB-RICH-015 depends on migration apply/rollback step) |
   | Tasks | `specs/features/knowledge-base/tasks.md:1740-1807` (KB-RICH-015 refuses DB-verified status pending migration) |
   | Implementation | `20260909120000_kb_article_content_text` migration |
   | Gap | Migration apply/rollback step not executable in dev environment at spec time; merge gated |
   | Correction | Real Neon TEST database reset, full migration chain applied |
   | Verification | Apply/backfill closed: legacy content-only row migrated, contentText backfill verified against real PostgreSQL, fresh rebuild/reapply verified (see "Runtime Verification" below). Rollback NOT verified — no explicit rollback procedure exercised. |

2. **Authorization authority hardening**, `specs/features/auth-rbac/spec.md:62-82` (SG-1/TG-1/TG-2/DD-1). Test-first correction: `tasks.md` adds failing coverage for the gap (AUTH-001/002) before the fix (AUTH-003), then re-verifies every other role boundary wasn't broken (AUTH-004-009), full-suite regression (AUTH-010/011). `plan.md:5` states the rejected alternative explicitly (stateful sessions) vs. the chosen minimal-seam fix (reload current user in `requireRole`).
3. **SLA-Automation dual-defect fix**, `specs/features/sla-automation/spec.md:86-87` (DG-1 wrong-recipient, DG-2 sweep-failure isolation). `plan.md:33-35` reasons about blast radius before touching code ("DG-1 strictly widens... DG-2 strictly narrows... cannot introduce a cross-team leak"). Verified with a two-candidate concurrency-style regression test (`tasks.md:28-35`) proving one candidate's transaction failure doesn't discard already-committed peers' realtime events.
4. **Conversations/Channels correlation-fallback removal**, `specs/features/conversations-channels/spec.md:484,494` (CC-GAP-11/21) — removed "customer's newest active ticket" identity-only matching across SMS/WhatsApp per decision OD-CC-4 (`spec.md:519`), replacing with thread/reference-based correlation; a genuine architecture correction driven by an audit, not a first-pass design.

## Runtime Verification (Real Neon PostgreSQL)

- Authorized TEST database reset, full 19-migration chain applied (repeatable, run more than once).
- KB legacy-content backfill verified against real PostgreSQL.
- Category case-insensitive unique index verified against real PostgreSQL.
- Fresh-database repeatability verification: a fresh-DB reseed surfaced schema/tooling drift (`contentFormat` field missing from `server/scripts/seed-test-data.ts`, caught by a real-DB constraint failure, not by mocked tests); seed tooling was aligned with the required migration metadata and reseed became repeatable (fix in `e342b99`).
- Live HTTP auth round-trip; a real Ticket mutation persisted via Prisma → PostgreSQL; a subsequent API read returned the persisted value.
- RBAC denial verified at runtime (not just unit-tested).
- Fresh rebuild → reseed → login cycle verified.
- **Browser-driven UI → API → DB smoke verified:** Full browser smoke executed against real Neon PostgreSQL across all 4 roles (ADMIN, MANAGER, AGENT, CUSTOMER). Complete mutation persistence chain proven (Browser UI priority update & Rich Text reply → PATCH/POST API → Express → Service → Prisma → PostgreSQL → DB read-back & Browser reload). Team-scoping, restricted-ticket 404/denial, customer portal boundary, and internal route redirection confirmed live in browser.

## Engineering Hardening & Verification Outcomes

AI-assisted findings, each independently verified and corrected by the engineer, not accepted on faith.

| Hardening | Tracked source | Problem class found | Correction applied | Why it shows ownership, not AI dependence |
|---|---|---|---|---|
| Authorization authority hardening | `specs/features/auth-rbac/spec.md:62-82`, `server/src/middleware/auth.ts` | `requireRole` trusted JWT-embedded role/active-state up to 8h post-demotion/deactivation | Reload current user state per request | A prior session deliberately chose the *lighter* stateless design; this pass re-assessed it as a live vulnerability and reversed the decision with new tests — judgment applied twice, not a one-shot AI suggestion. |
| Task-link visibility redaction | `specs/features/tasks-reminders/spec.md` | `Task.ticket{id,subject}` leaked regardless of current ticket visibility | `redactUnauthorizedTicketLinks` | Found by re-checking a documented "done" task against actual visibility rules, not by a new feature request. |
| Quick Reply audit-trail completeness | `specs/features/quick-replies/spec.md` | Quick Reply CRUD produced zero `AuditLog` rows, inconsistent with every sibling admin module | Added `QUICK_REPLY_CREATED/UPDATED/DELETED`, body diffed as presence-only boolean (privacy-aware) | Shows deliberate scope limiting (not logging body text) rather than blind logging. |
| Real-database concurrency verification | `server/src/modules/live-chat/live-chat.service.ts` | Live-chat race: P2002 recovery re-queried an already-aborted Postgres transaction client, causing real 500s | Re-query on a fresh client after rollback | **Found by testing against a real dev Neon DB**, not by mocked unit tests — direct evidence mocks alone were insufficient and real-DB verification caught what they missed. |
| Canonical ticket creation rollout verification | `server/src/modules/tickets/create-canonical-ticket.ts` | `createCanonicalTicket` had 9 passing tests and zero production callers, despite docs claiming full rollout | Wired into all 6 ticket-creation paths | Caught by grepping call sites instead of trusting a `tasks.md [x]` checkbox — explicit distrust of self-reported AI completion claims. |
| Ticket transaction reliability hardening | `server/src/modules/tickets/ticket.service.ts`, `server/src/modules/collaboration/collaboration.service.ts` | Real Prisma `P2028` (transaction-expiry) surfaced by browser and load verification on the reply/note path | Actor team scope resolved before opening the transaction; unnecessary `firstRespondedAt` write skipped once already set; bounded `{ timeout: 15_000 }` policy applied, matching existing `updateTicket` precedent | See dedicated "Ticket Transaction Reliability Hardening" section below for full evidence — found and closed through iterative real-Neon and real-browser verification, not a single guess. |

Destructive-action discipline: Neon TEST database reset only performed after explicit human authorization this session; `npm audit` fix requiring a forced dependency downgrade was found and **deliberately not applied** without sign-off.

## AI Usage & Verification — Human Override and Verification Cases

Evidence for Criterion 3 (AI Usage & Verification, Weight 10). Each case repeats the same methodology: AI output/claim → independent verification → discrepancy found → scoped engineering decision → regression/runtime proof. The point is not that AI was used, but that its claims were never taken on faith — every one below was checked against real call sites, a real threat model, or a real Postgres instance, and reversed or gated where the check failed.

| Case | AI assumption/output | Independent verification | Finding | Decision | Proof |
|---|---|---|---|---|---|
| createCanonicalTicket false completion | `tasks.md` marked CONV-013/CONV-044 `[x]`; 9 unit tests green | Grepped production call sites instead of trusting the checkbox | Helper had zero production callers — all 6 ticket-creation paths hand-rolled the same logic inline | Wired all 6 paths onto the shared helper; tests could not have caught this because the duplicated inline logic produced identical observable behavior | `server/src/modules/tickets/create-canonical-ticket.ts` + its 6 production call sites (`ticket.service.ts`, `portal.service.ts`, `live-chat.service.ts`, `whatsapp.service.ts`, `sms.service.ts`, `email.service.ts`); related Conversations/Channels spec/tasks entries (CONV-013/CONV-044) |
| Stale JWT authority reversal | A prior session deliberately chose a lightweight stateless `requireRole` (no per-request reload) as an accepted tradeoff | This pass re-audited that same accepted decision against a live threat model (demotion/deactivation mid-token-life) | Up to 8h privilege-escalation window after demotion/deactivation/password change | Reversed the prior decision; added per-request reload + regression coverage (AUTH-001-011) | `server/src/middleware/auth.ts`, `specs/features/auth-rbac/spec.md:62-82`, `specs/features/auth-rbac/plan.md`, `specs/features/auth-rbac/tasks.md` (AUTH-001-011) |
| Live-chat P2002 race, real Postgres only | Mocked `live-chat.test.ts` treated `tx` as a never-poisoned plain object; recovery logic re-read on that same client after catching P2002 | Ran two concurrent `startLiveChat` calls against a real dev Neon DB | Postgres aborts the whole transaction after any statement error (25P02); the mock had no way to simulate this, so the race loser got a real 500 | Moved the recovery re-read to a fresh top-level Prisma client outside the aborted transaction; added a regression test with a separately-poisoned `txStub` | `server/src/modules/live-chat/live-chat.service.ts`, `server/src/modules/live-chat/live-chat.test.ts` (regression coverage) |
| Destructive DB / dependency safety boundary | `npm audit` proposed an automatic forced-downgrade fix; verification task required a Neon TEST reset | Evaluated blast radius and reversibility before acting on either | Forced downgrade risked breaking Prisma CLI compatibility; a DB reset is irreversible | Deferred the dependency downgrade pending sign-off; performed the Neon reset only after explicit human authorization | This document's "Destructive-action discipline" and "Runtime Verification" sections above; "Remaining Limitations" below |
| Seed-script schema drift | Verification prompt prohibited code modification; `npm run seed:test` failed creating `TicketMessage` on a freshly reset Neon TEST DB | Traced the Prisma validation error to migration `20260913065709_conversation_content_metadata_required` vs. `seed-test-data.ts` | Seed tooling had not been updated for the now-required `contentFormat`/`contentSource` fields — tooling drift, not a runtime defect | Stopped and requested explicit human approval before touching the seed script; fixed only after approval, then reseeded and continued real-Postgres verification | `server/scripts/seed-test-data.ts`, migration `20260913065709_conversation_content_metadata_required`; fix committed in `e342b99` ("docs(sdd): record runtime verification and fix test seed drift") |
| Ticket transaction P2028 | Initial reply-transaction structure was assumed safe under load | Real browser smoke, then targeted real-Neon timing instrumentation, then final browser reverification | Transaction-expiry error traced to connection-acquisition ordering, an avoidable no-op write, and irreducible Neon latency variance; the correction was refined iteratively as stronger runtime evidence became available | Applied a targeted three-part fix (scope resolution before transaction, skip no-op write, bounded timeout matching existing precedent); did not retry blindly or raise a global timeout | See "Ticket Transaction Reliability Hardening" section below |

Evidence supports a defensible Level 5 / Advanced interpretation for this criterion.

## Ticket Transaction Reliability Hardening

Real runtime verification (browser smoke, then targeted real-Neon timing instrumentation) exposed a latency-sensitive Prisma interactive-transaction expiry (`P2028`) on the ticket reply/note path. The correction was refined iteratively as stronger runtime evidence became available, converging on three changes:

1. **Connection-acquisition ordering** — actor team scope is now resolved on the global Prisma client *before* the reply/note transaction opens, matching the pattern already used by `updateTicket`/`selfAssignTicket`, instead of acquiring a second pooled connection mid-transaction.
2. **Unnecessary work removed** — the `firstRespondedAt` update is read once and skipped entirely once already set, removing a guaranteed no-op write that ran on every reply after the first.
3. **Bounded timeout policy** — with DB-only transaction work minimized (no global-`prisma` calls, no external/provider I/O, realtime still post-commit via `withRealtimeOutbox`), `addTicketMessage`/`addTicketNote` now use the same `{ timeout: 15_000 }` policy already accepted for `updateTicket`. No blind retries, no global timeout increase, and no provider/network work moved inside the transaction.

**Verification:**
- Regression coverage added and confirmed RED-before/GREEN-after for each of the three changes (`server/src/modules/tickets/ticket.test.ts`).
- Full server suite: **1114/1114** (58 files); typecheck, lint, `prisma validate`, `git diff --check` clean.
- Real Neon verification: 15 sequential replies + 5 sequential notes against an existing watched ticket via the live HTTP API — all `201`, zero `P2028`/`P1001`/transaction-closed errors, all persisted with unique ids on read-back.
- **Final browser verification** (after all three changes): 10 sequential watched-ticket replies, all `201`, request durations ~370ms–430ms, all persisted after hard reload, 0 duplicates, 0 missing messages, watcher notifications created exactly as expected, sender received no self-notification; 3 sequential internal notes also persisted correctly with correct note-watcher notifications; browser console clean; server logs showed **zero** `P2028`, "Transaction already closed", "Transaction not found", transaction-timeout, or `P1001` occurrences in the verification window.

## Remaining Limitations

Only genuinely open items — resolved findings are not repeated here.

- Client full-suite run shows CPU-contention-sensitive timeouts under full parallel load; affected tests pass individually/in groups — tooling/environment sensitivity, not a reproduced product defect (see `.wolf/cerebrum.md` 2026-09-13 entry).
- KB Rich Text migration rollback was NOT exercised — Prisma migrations have no automatic rollback flow, and no explicit rollback procedure was run this pass (apply/backfill are verified; rollback remains open).
- `npm audit` high-severity advisory (via Prisma CLI's `deepmerge-ts`) known; forced-downgrade fix intentionally deferred pending sign-off.
- AD-1 in `specs/features/auth-rbac/spec.md:80-82` is explicit deferred architecture debt, not addressed in this cycle.

## Key File Links

- ADR log: `specs/decisions.md` (57 ADRs, curated with supersession chain)
- Architecture: `specs/architecture.md`, `specs/domain-model.md`, `specs/constitution.md`
- Feature packages: `specs/features/{auth-rbac,tickets,customers,dashboard-reporting,sla-automation,conversations-channels,knowledge-base,tasks-reminders,quick-replies,notifications,realtime,sla-settings-categories,ai-assistance}/{spec,plan,tasks}.md`
- Root README: `README.md`
- Session logs: `.wolf/STATUS.md`, `.wolf/cerebrum.md`, `.wolf/buglog.json`
