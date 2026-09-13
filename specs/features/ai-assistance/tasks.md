# AI Assistance — Tasks

Stable IDs use the feature's initials, `AI-NNN`. This is a fast-track
brownfield discovery/verification pass — no confirmed defect was found, so
there is no fix task. The ledger below is task-complete.

[x] AI-001 — Brownfield discovery: internal Ticket AI module
Goal: Read and document every file in `server/src/modules/ai/` and
`client/src/features/ai-assistant/` against the 20-section brief (capability
matrix, ownership boundaries, RBAC, context/data exposure, authorization
ordering, human-in-the-loop, prompt/grounding strategy, trust boundaries,
rendering safety, rate limiting, provider failure handling, logging/privacy,
KB grounding, API/frontend behavior, existing test coverage).
Affected files/area: `server/src/modules/ai/*.ts` (controller, service,
schema, context builder, prompts, provider adapter/factory, rate limit,
config, types, KB candidates), `client/src/features/ai-assistant/*.tsx|ts`.
Verification: source inspection of every listed file plus its paired test
file (`ai.test.ts`, `openrouter-provider.test.ts`, `ai-assistant.test.tsx`,
`ai-portal-isolation.test.ts`); cross-checked authorization ordering claim
by tracing `runTicketAiAction → buildTicketAiContext →
ticketVisibilityWhere` and confirming the Prisma `where` clause embeds the
predicate directly (no separate fetch-then-check step); cross-checked
"never mutates" claim by grepping the module for
`.create(`/`.update(`/`.delete(`/`.upsert(` (zero matches outside
`findFirst`/`findMany`); cross-checked "no XSS" claim by grepping
`client/src/features/ai-assistant/` for `dangerouslySetInnerHTML` (zero
matches).
Status: Complete. No defect found.

[x] AI-002 — Brownfield discovery: customer AI chatbot module
Goal: Read and document every file in `server/src/modules/customer-ai/`
and `client/src/features/customer-ai/`, with particular focus on the
CUSTOMER/anonymous trust boundary, KB-grounding data minimization,
handoff identity binding, and structural isolation from the internal AI
module.
Affected files/area: `server/src/modules/customer-ai/*.ts` (controller,
service, schema, context builder, rate limit), `client/src/features/
customer-ai/*.tsx|ts`, `server/src/modules/portal/portal.routes.ts` (auth
gate on the `/ai/*` routes).
Verification: source inspection of every listed file plus
`customer-ai.test.ts` and `customer-ai-widget.test.tsx`; confirmed
`portalRouter.use(requireAuth, requireRole(Role.CUSTOMER),
requireFreshToken)` applies to `/ai/chat` and `/ai/handoff` (no per-route
override, no anonymous path); confirmed `buildCustomerAiContext`'s Prisma
`select` is `{ id, title, category, contentText }` on
`knowledgeArticle` only with `where.status` hardcoded to `PUBLISHED`, and
that `chat`/`handoff` never import `prisma.ticket`/`note`/`user`/
`auditLog`; confirmed `handoff` derives the ticket owner from
`request.auth.userId` only (never a request-body field); confirmed the
structural isolation guard (`ai-portal-isolation.test.ts`) and, on the
server side, that `customer-ai.service.ts` imports only
`ai/ai-provider.js` (the shared adapter factory) from the internal `ai`
module — no context/prompt/schema import.
Status: Complete. No defect found.

[x] AI-003 — Cross-cutting security/privacy verification
Goal: Independently re-verify the highest-risk claims across both modules
that a documentation-only pass must not simply take on faith: authorization
ordering, prompt-injection containment, candidate-id re-validation,
provider-error no-leak, rate limiting, secrets handling, rendering safety.
Affected files/area: cross-cutting (both `ai` and `customer-ai` modules,
both server and client).
Verification: ran the full existing regression suite covering each claim
(see AI-004 for exact commands/counts) and manually re-derived three of the
riskier claims from source rather than trusting the tests alone: (1) traced
`AI_API_KEY` usage end-to-end (`env.ts` → `ai.config.ts` →
`openrouter-provider.ts` `Authorization` header) and confirmed it is never
interpolated into any prompt-builder function or log statement; (2) traced
every Prisma `select` in both context builders to confirm customer email/
phone, assignee, SLA fields, watchers, and internal notes are excluded by
construction (not filtered post-fetch) from every AI path that should
exclude them; (3) confirmed the one write path (`handoff` →
`portal.service.createTicket`) cannot be given an arbitrary `customerId`
— the schema has no such field and the service signature takes `userId`
positionally from `request.auth`.
Status: Complete. No defect found.

[x] AI-004 — Verification run (tests, typecheck, lint, diff hygiene)
Goal: Run the fast-track verification gate and record exact results.
Affected files/area: none (verification only — this pass changed no
production code).
Verification (exact commands and results, this session):
- `cd server && npx vitest run src/modules/ai src/modules/customer-ai
  src/modules/tickets src/modules/knowledge-base` → **307/307 passed**
  (9 test files).
- `cd client && npx vitest run src/features/ai-assistant
  src/features/customer-ai src/features/tickets src/features/portal` →
  **298/298 passed** (13 test files).
- `cd server && npx vitest run` (full suite) → **1102/1102 passed** (58
  test files).
- `cd client && npx vitest run` (full suite) → **840/840 passed** (68 test
  files).
- `cd server && npx tsc -p tsconfig.json --noEmit --pretty false` → clean,
  no output.
- `cd server && npx eslint .` → clean, no output.
- `cd client && npx tsc -b --pretty false` → clean, no output.
- `cd client && npx eslint .` → **0 errors**, 2 pre-existing warnings
  (`react-refresh/only-export-components` in
  `reports/components/ticket-breakdown/breakdown-chart.tsx` and
  `lib/theme-provider.tsx` — unrelated to AI, not touched this pass).
- `git diff --check` → clean (exit 0; one unrelated CRLF/LF advisory
  warning on `.wolf/memory.md`, not a conflict marker).
- **Not performed:** any live call to the real OpenRouter API — this
  environment has no configured `AI_API_KEY`/`AI_PROVIDER`/`AI_MODEL`, and
  the repo's only offline-safe test path (`MockAiProvider`) is already
  exercised by the suites above. No runtime/live-provider verification is
  claimed anywhere in `spec.md`/`plan.md` for this reason — every provider-
  behavior claim in those files is either automated-test-verified (via the
  mock provider and the OpenRouter adapter's own HTTP-shape unit tests,
  `openrouter-provider.test.ts`) or source-inspection-verified, never
  claimed as live-runtime-verified.
Status: Complete. All checks pass; no code was changed so no regression
risk was introduced by this pass itself.

[x] AI-005 — SDD artifacts + coverage matrix
Goal: Write `specs/features/ai-assistance/{spec.md,plan.md,tasks.md}` and
update `specs/features/README.md`'s Feature Coverage Matrix to add an "AI
Assistance" row, removing the module from the "implemented in code, no
dedicated SDD package" list.
Affected files/area: `specs/features/ai-assistance/spec.md`,
`specs/features/ai-assistance/plan.md`, `specs/features/ai-assistance/
tasks.md`, `specs/features/README.md`.
Verification: manual review against the format/conventions established by
`specs/features/tasks-reminders/`, `specs/features/tickets/`, and
`specs/features/README.md`'s ownership contract; cross-checked existing
cross-references from `specs/features/tickets/spec.md` (`POST /tickets/:id/ai`
row in its permission matrix, "AI Assistant panel" frontend section, ADR-034
reference) and `specs/features/knowledge-base/spec.md` (AI-grounding
sections, ADR-054 reference) to keep this package's Cross-Feature
Ownership Boundaries consistent with what its neighbours already claim
about AI, rather than contradicting them.
Status: Complete.

## Final verification state

Server 1102/1102, client 840/840, both `tsc`/`eslint` clean, `git diff
--check` clean. Zero production files changed by this pass — every task
above is discovery, verification, and documentation. No `AI-FOLLOWUP`
items are open; see `spec.md`'s Discovered Gaps / Deferred Scope for the
non-fast-tracked architecture-debt/UX observations recorded for a future
pass.
