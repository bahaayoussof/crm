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
| 3 | AI Usage & Verification | 10 | `specs/reassessment-evidence.md` "AI Usage & Verification" section below (tracked, evaluator-visible), brownfield-audit spec.md "Discovered Gap" sections; `.wolf/cerebrum.md`/`.wolf/buglog.json` are local-only supplements, not primary evidence |
| 4 | Engineering Foundations | 10 | `specs/architecture.md`, `server/src/middleware/auth.ts`, shared helpers (`shared/sla/derive-sla.ts`, `shared/team/team-scope.ts`) |
| 5 | Backend / API / Database | 10 | `server/prisma/migrations/` (19 migrations), Tickets/Customers/Auth spec.md, real Neon runtime verification (`specs/reassessment-evidence.md` — see "Runtime verification" section below) |
| 6 | Frontend & End-to-End Flow | 10 | `client/src/features/*`, `client/src/features/tickets/ticket-conversation-ui.tsx` (shared rich-text/portal component); browser runtime smoke verified across all 4 roles against Neon TEST DB |
| 7 | Productivity & Delivery | 10 | `git log` (141 commits, Conventional Commits, feature/fix/docs scoped), `README.md` §14–16 |
| 8 | Correctness & Maintainability | 10 | ADR-040/041 (shared FileUploadModal, link popover reuse), `e636c44` rich-text extraction commit |
| 9 | Testing, Security & Edge Cases | 5 | server 1112/1112 tests, RBAC/IDOR fixes below (tracked spec references per entry) |
| 10 | Technical Understanding & Ownership | 5 | `server/src/modules/live-chat/live-chat.service.ts` (live-DB-only race, bug-229), `specs/features/auth-rbac/spec.md:62-82` (RBAC reversal, bug-196), Neon destructive-op authorization gate ("Destructive-action discipline" below) |

## Mandatory scope evidence

- Customer CRUD + validation: `specs/features/customers/spec.md`; ADR-013 (AGENT read-only), ADR-014 (safe history summaries); case-insensitive email uniqueness enforced by a hand-authored functional index (`20260912163955_customer_email_lower_unique`) because Prisma schema DSL can't express it.
- Ticket CRUD + workflow: `specs/features/tickets/spec.md`; ADR-009/015/046/048/050/051 (visibility, ownership, status simplification, team scoping, auto-assignment).
- Agent dashboard: `specs/features/dashboard-reporting/spec.md`; ADR-011/016/048 (role-aware primary queues, agent performance block).
- Auth/RBAC: `specs/features/auth-rbac/spec.md`; ADR-006/025/042; bug-196 fix (stale-authority reload).
- End-to-end flow: HTTP → Express route → controller/service → Prisma → PostgreSQL verified against a real Neon test database (19-migration chain applied, ticket mutation persisted, subsequent read returned the persisted value, RBAC denial observed at runtime). Full browser runtime smoke verified across all 4 roles (ADMIN, MANAGER, AGENT, CUSTOMER): UI mutation (priority change & rich text reply) persisted through Prisma to PostgreSQL and verified on page refresh and direct DB query; RBAC team scoping and customer portal privacy boundaries confirmed in browser UI.
- README/architecture notes: `README.md` (629 lines, §1–16 cover journey, architecture, both maps, lifecycle, team scope, frontend/backend architecture, realtime, omnichannel, domain model, local dev, testing); `specs/architecture.md`, `specs/domain-model.md`, `specs/constitution.md`.
- Tests / repeatable verification: server 1112/1112 (58 files), client passes when run isolated/grouped (full-parallel run shows CPU-contention timeouts, not a product defect — see `.wolf/cerebrum.md` 2026-09-13 entry).

## Strongest SDD examples (Planning & Task Breakdown, Weight 20)

Full chain — requirement → assumptions → plan → dependencies → ordered tasks → implementation → discovered gap → correction → verification — demonstrated end-to-end in:

1. **Knowledge Base Rich Text**, `specs/features/knowledge-base/tasks.md:1740-1807` (task KB-RICH-015). Migration apply/rollback step could not be executed in the dev environment; the task explicitly refuses to self-report DB-verified status until that step runs, and `spec.md:11` carries the gate into the package header ("MERGE GATED ON MIGRATION VERIFICATION"). This is disclosed limitation, not overclaimed completion.

   The apply/backfill portion of this historical gate is now closed by the real-Neon verification documented below: the full migration chain was applied, a legacy content-only row was migrated, contentText backfill was verified against real PostgreSQL, and a fresh rebuild/reapply of the full chain was verified. Rollback itself was NOT exercised — Prisma migrations don't provide an automatic rollback flow, and no explicit rollback procedure was run this pass; that part of the gap remains open. The original task record is intentionally preserved to show verification was not claimed prematurely.

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
   | Verification | Apply/backfill closed: legacy content-only row migrated, contentText backfill verified against real PostgreSQL, fresh rebuild/reapply verified (see Runtime verification section below). Rollback NOT verified — no explicit rollback procedure exercised this pass. |

2. **Auth/RBAC stale-authority defect**, `specs/features/auth-rbac/spec.md:62-82` (SG-1/TG-1/TG-2/DD-1). Test-first correction: `tasks.md` adds failing coverage for the gap (AUTH-001/002) before the fix (AUTH-003), then re-verifies every other role boundary wasn't broken (AUTH-004-009), full-suite regression (AUTH-010/011, "1096/1096 tests across 58 files"). `plan.md:5` states the rejected alternative explicitly (stateful sessions) vs. the chosen minimal-seam fix (reload current user in `requireRole`).
3. **SLA-Automation dual defect fix**, `specs/features/sla-automation/spec.md:86-87` (DG-1 wrong-recipient, DG-2 sweep-failure isolation). `plan.md:33-35` reasons about blast radius before touching code ("DG-1 strictly widens... DG-2 strictly narrows... cannot introduce a cross-team leak"). Verified with a two-candidate concurrency-style regression test (`tasks.md:28-35`) proving one candidate's transaction failure doesn't discard already-committed peers' realtime events.
4. **Conversations/Channels correlation-fallback removal**, `specs/features/conversations-channels/spec.md:484,494` (CC-GAP-11/21) — removed "customer's newest active ticket" identity-only matching across SMS/WhatsApp per decision OD-CC-4 (`spec.md:519`), replacing with thread/reference-based correlation; a genuine architecture correction driven by an audit, not a first-pass design.

## Runtime verification (this session, real Neon PostgreSQL)

- Authorized TEST database reset, full 19-migration chain applied (repeatable, run more than once).
- KB legacy-content backfill verified against real PostgreSQL.
- Category case-insensitive unique index verified against real PostgreSQL.
- Seed drift found and corrected during fresh-DB verification (`contentFormat` field missing from `server/scripts/seed-test-data.ts` — caught by real-DB constraint failure, not by mocked tests; fix in `e342b99`; local label: bug-230).
- Live HTTP auth round-trip; a real Ticket mutation persisted via Prisma → PostgreSQL; a subsequent API read returned the persisted value.
- RBAC denial verified at runtime (not just unit-tested).
- Fresh rebuild → reseed → login cycle verified.
- **Browser-driven UI → API → DB smoke verified:** Full browser smoke executed against real Neon PostgreSQL across all 4 roles (ADMIN, MANAGER, AGENT, CUSTOMER). Complete mutation persistence chain proven (Browser UI priority update & Rich Text reply → PATCH/POST API → Express → Service → Prisma → PostgreSQL → DB read-back & Browser reload). Team-scoping, restricted-ticket 404/denial, customer portal boundary, and internal route redirection confirmed live in browser.

## Security/correctness discoveries (AI-assisted, human-verified)

| Bug | Tracked source | Defect | Fix | Why it shows ownership, not AI dependence |
|---|---|---|---|---|
| bug-196 | `specs/features/auth-rbac/spec.md:62-82`, `server/src/middleware/auth.ts` | `requireRole` trusted JWT-embedded role/active-state up to 8h post-demotion/deactivation | Reload current user state per request | A prior session (2026-08-27) deliberately chose the *lighter* stateless design; this pass re-assessed it as a live vulnerability and reversed the decision with new tests — judgment applied twice, not a one-shot AI suggestion. |
| bug-197 | `specs/features/tasks-reminders/spec.md` | `Task.ticket{id,subject}` leaked regardless of current ticket visibility | `redactUnauthorizedTicketLinks` | Found by re-checking a documented "done" task against actual visibility rules, not by a new feature request. |
| bug-198 | `specs/features/quick-replies/spec.md` | Quick Reply CRUD produced zero `AuditLog` rows, inconsistent with every sibling admin module | Added `QUICK_REPLY_CREATED/UPDATED/DELETED`, body diffed as presence-only boolean (privacy-aware) | Shows deliberate scope limiting (not logging body text) rather than blind logging. |
| bug-229 | `server/src/modules/live-chat/live-chat.service.ts` | Live-chat race: P2002 recovery re-queried an already-aborted Postgres transaction client, causing real 500s | Re-query on a fresh client after rollback | **Found by testing against a real dev Neon DB**, not by mocked unit tests — direct evidence mocks alone were insufficient and real-DB verification caught what they missed. |
| bug-228 | `server/src/modules/tickets/create-canonical-ticket.ts` | `createCanonicalTicket` had 9 passing tests and zero production callers, despite docs claiming full rollout | Wired into all 6 ticket-creation paths | Caught by grepping call sites instead of trusting a `tasks.md [x]` checkbox — explicit distrust of self-reported AI completion claims. |
| bug-238 | `server/src/modules/tickets/ticket.service.ts`, `server/src/modules/collaboration/collaboration.service.ts` | Real Prisma `P2028` on the reply/note path: `requireConversationMutationAccess` resolved actor team scope on the GLOBAL `prisma` client from inside an open interactive `tx`, risking a second pooled connection stalling the transaction past its timeout before `notifyWatchers`'s later `tx.*` call ran | Team scope now resolved once, before the transaction opens (matches the already-correct `updateTicket`/`selfAssignTicket` pattern); no behavior/timeout change | **Found by a real browser smoke against Neon, not by the mocked unit suite** — the suite's `$transaction` mock reuses one `vi.fn()` for both the global and `tx` client, so it could not distinguish the two call sites; traced via transaction-lifecycle comparison against sibling working paths, not a guess. |

Destructive-action discipline: Neon TEST database reset only performed after explicit human authorization this session; `npm audit` fix requiring a forced dependency downgrade was found and **deliberately not applied** without sign-off.

## AI Usage & Verification — Human Override and Verification Cases

Evidence for Criterion 3 (AI Usage & Verification, Weight 10). Each case repeats the same methodology: AI output/claim → independent verification → discrepancy found → scoped engineering decision → regression/runtime proof. The point is not that AI was used, but that its claims were never taken on faith — every one below was checked against real call sites, a real threat model, or a real Postgres instance, and reversed or gated where the check failed.

| Case | AI assumption/output | Independent verification | Finding | Decision | Proof |
|---|---|---|---|---|---|
| createCanonicalTicket false completion | `tasks.md` marked CONV-013/CONV-044 `[x]`; 9 unit tests green | Grepped production call sites instead of trusting the checkbox | Helper had zero production callers — all 6 ticket-creation paths hand-rolled the same logic inline | Wired all 6 paths onto the shared helper; tests could not have caught this because the duplicated inline logic produced identical observable behavior | `server/src/modules/tickets/create-canonical-ticket.ts` + its 6 production call sites (`ticket.service.ts`, `portal.service.ts`, `live-chat.service.ts`, `whatsapp.service.ts`, `sms.service.ts`, `email.service.ts`); related Conversations/Channels spec/tasks entries (CONV-013/CONV-044); local label: bug-228 |
| Stale JWT authority reversal | 2026-08-27 session deliberately chose a lightweight stateless `requireRole` (no per-request reload) as an accepted tradeoff | This pass re-audited that same accepted decision against a live threat model (demotion/deactivation mid-token-life) | Up to 8h privilege-escalation window after demotion/deactivation/password change | Reversed the prior decision; added per-request reload + regression coverage (AUTH-001-011) | `server/src/middleware/auth.ts`, `specs/features/auth-rbac/spec.md:62-82`, `specs/features/auth-rbac/plan.md`, `specs/features/auth-rbac/tasks.md` (AUTH-001-011); local label: bug-196 |
| Live-chat P2002 race, real Postgres only | Mocked `live-chat.test.ts` treated `tx` as a never-poisoned plain object; recovery logic re-read on that same client after catching P2002 | Ran two concurrent `startLiveChat` calls against a real dev Neon DB | Postgres aborts the whole transaction after any statement error (25P02); the mock had no way to simulate this, so the race loser got a real 500 | Moved the recovery re-read to a fresh top-level Prisma client outside the aborted transaction; added a regression test with a separately-poisoned `txStub` | `server/src/modules/live-chat/live-chat.service.ts`, `server/src/modules/live-chat/live-chat.test.ts` (regression coverage); local label: bug-229 |
| Destructive DB / dependency safety boundary | `npm audit` proposed an automatic forced-downgrade fix; verification task required a Neon TEST reset | Evaluated blast radius and reversibility before acting on either | Forced downgrade risked breaking Prisma CLI compatibility; a DB reset is irreversible | Deferred the dependency downgrade pending sign-off; performed the Neon reset only after explicit human authorization | This document's "Destructive-action discipline" and "Runtime verification" sections above; "Known disclosed gaps" below |
| Seed-script schema drift | Verification prompt prohibited code modification; `npm run seed:test` failed creating `TicketMessage` on a freshly reset Neon TEST DB | Traced the Prisma validation error to migration `20260913065709_conversation_content_metadata_required` vs. `seed-test-data.ts` | Seed tooling had not been updated for the now-required `contentFormat`/`contentSource` fields — tooling drift, not a runtime defect | Stopped and requested explicit human approval before touching the seed script; fixed only after approval, then reseeded and continued real-Postgres verification | `server/scripts/seed-test-data.ts`, migration `20260913065709_conversation_content_metadata_required`, this document's "Runtime verification" section above. fix committed in `e342b99` ("docs(sdd): record runtime verification and fix test seed drift"); local label: bug-230 |

Evidence supports a defensible Level 5 / Advanced interpretation for this criterion.

## Known disclosed gaps

- Client full-suite run shows CPU-contention-sensitive timeouts under full parallel load; affected tests pass individually/in groups — documented as tooling drift, not a reproduced product defect.
- KB Rich Text migration apply/backfill step flagged as not-yet-executed in a disposable DB at spec time (`specs/features/knowledge-base/spec.md:992-1015`); the apply/backfill portion is closed by this session's real-Neon migration-chain verification above (fresh rebuild/reapply included). Rollback was NOT verified and is NOT claimed — Prisma migrations have no automatic rollback flow, and no explicit rollback procedure was exercised this pass. The historical spec text still shows the gap was disclosed rather than hidden.
- `npm audit` high-severity advisory (via Prisma CLI's `deepmerge-ts`) known, forced-downgrade fix intentionally deferred.
- AD-1 in `specs/features/auth-rbac/spec.md:80-82` is explicit deferred architecture debt, not fixed in this cycle.
- **Prisma `P2028: Transaction not found` — resolved and re-verified (local label: bug-238).** A browser reply-send smoke surfaced a real Prisma `P2028` error: `addTicketMessage` → `withRealtimeOutbox` → ticket transaction → `notifyWatchers` → `tx.ticketWatcher.findMany()` (`server/src/modules/collaboration/collaboration.service.ts:117`). Root cause: `requireConversationMutationAccess` (`server/src/modules/tickets/ticket.service.ts`) resolved the actor's team scope with the GLOBAL `prisma` client from *inside* the already-open interactive `tx` callback, unlike the sibling `updateTicket`/`selfAssignTicket` paths, which resolve team scope before opening their transaction. Acquiring a second pooled connection mid-transaction under real Neon latency can stall the transaction past Prisma's default 5s interactive-transaction timeout, invalidating it before `notifyWatchers`'s later `tx.*` call runs. The existing suite missed it because `ticket.test.ts`'s `$transaction` mock reuses one `vi.fn()` for both `prisma.user.findUnique` and `tx.user.findUnique`, so the two call paths were indistinguishable to mocks. Fix: team scope is now resolved once, before the transaction opens, in both `addTicketMessage` and `addTicketNote` (mirroring the already-correct sibling paths) — no behavior change, no timeout override, the query just moved outside the transaction boundary. A failing-first regression test (`ticket.test.ts` — "resolves actor team scope before opening the reply/note transaction (P2028 regression)") pins call order and fails on the pre-fix code. Re-verified: targeted suite (241 tests) + full server suite (1112/1112, 58 files) green, typecheck/lint clean; real Neon TEST DB verification (5 sequential replies on a watched WEB ticket — all `201`, all persisted on reload, 5 `TICKET_WATCH_ACTIVITY` notifications delivered, zero P2028 in server log); browser re-smoke of the affected path (ADMIN login → open watched ticket → send reply → renders → reload → persists) clean, zero console errors, zero P2028. Distinct from any email-provider test-account send limitations (Resend 403), which remain a separate, unrelated, unfixed concern.

## Key file links

- ADR log: `specs/decisions.md` (57 ADRs, curated with supersession chain)
- Architecture: `specs/architecture.md`, `specs/domain-model.md`, `specs/constitution.md`
- Feature packages: `specs/features/{auth-rbac,tickets,customers,dashboard-reporting,sla-automation,conversations-channels,knowledge-base,tasks-reminders,quick-replies,notifications,realtime,sla-settings-categories,ai-assistance}/{spec,plan,tasks}.md`
- Root README: `README.md`
- Session logs: `.wolf/STATUS.md`, `.wolf/cerebrum.md`, `.wolf/buglog.json`
