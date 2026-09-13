# AI Assistance — Plan

This is a brownfield documentation pass with no confirmed defect, so this
plan records **what was reused/verified**, not a build plan for new
behavior. See `specs/features/README.md` for the spec/plan/tasks ownership
contract — this file records the implementation approach that is already
shipped and why nothing further was built.

## Existing implementation to reuse (already in place, not re-derived)

- **Provider seam:** `server/src/modules/ai/ai.types.ts` (`AiProvider`,
  `StructuredRequest`) + `ai-provider.ts` (cached factory, config-driven) +
  `openrouter-provider.ts` (the one concrete adapter) + `mock-provider.ts`
  (deterministic test double). Both `ai.service.ts` and
  `customer-ai.service.ts` consume the **same** `getAiProvider()` factory —
  this is the only shared code path between the two trust boundaries, by
  design (see spec's Cross-Feature Ownership Boundaries).
- **Authorization primitive:** `ticketVisibilityWhere` +
  `resolveActorTeamScope` (owned by Tickets) — reused verbatim, not
  reimplemented, inside `buildTicketAiContext`.
- **Rate limiting primitive:** `middleware/rate-limit.ts`'s generic
  `rateLimit()` factory — reused for both `aiRateLimit` and
  `customerAiRateLimit`, same in-memory fixed-window implementation the
  rest of the app already uses (e.g. auth login attempts).
- **KB plain-text projection:** `deriveExcerpt`/`contentText` (owned by
  Knowledge Base) — reused by both grounding paths so AI never touches raw
  rich-text HTML.
- **Rich-text flattening:** `replyHtmlToPlainText` (owned by the shared
  rich-text module) — reused to flatten staff replies/notes before they
  enter a ticket AI prompt.
- **Portal ticket creation:** `portal.service.createTicket` — reused
  as-is for handoff; AI adds no new ticket-creation code path.
- **Structured-output pattern:** JSON Schema handed to the provider +
  paired Zod schema validated server-side, unknown keys stripped — this
  pattern is already used consistently across all four ticket actions and
  the customer chat response; no new validation primitive was needed.

## Backend architecture (as-built)

```text
Ticket AI:   POST /tickets/:id/ai
             → aiRateLimit → validateParams → validateBody → ai.controller.runAction
             → ai.service.runTicketAiAction(ticketId, action, actor, options)
                 → ai-context.service.buildTicketAiContext   (authz + minimized context)
                 → ai-provider.getAiProvider()                (config → adapter)
                 → ai-prompts.build*Prompt(context, ...)      (per-action prompt)
                 → provider.generateStructured(...)           (OpenRouterProvider | Mock)
                 → ai.schema.<action>Schema.safeParse(...)    (validate + strip)
                 → [CLASSIFY/KB_SUGGESTIONS only] re-validate ids against
                   server-owned candidates (category list / KB candidates)
                 → { action, promptVersion, result }

Customer AI: POST /portal/ai/chat | /portal/ai/handoff
             → portalRouter (requireAuth, requireRole(CUSTOMER), requireFreshToken)
             → [chat only] customerAiRateLimit → validateBody
             → customer-ai.controller.{chat,handoff}
             → customer-ai.service.{chat,handoff}
                 chat:    buildCustomerAiContext(message)      (PUBLISHED-only KB retrieval)
                          → getAiProvider() → generateStructured(...)
                          → customerAiProviderResponseSchema.safeParse(...)
                          → filter articleIds against candidate set
                 handoff: portal.service.createTicket(...)     (no provider call)
```

Each layer's actual responsibility (file:function), matching the task
brief's requested map:

| Layer | File / function |
|---|---|
| Route + middleware | `ticket.routes.ts` (`aiRateLimit`, `validateParams`, `validateBody`) / `portal.routes.ts` (`requireAuth`, `requireRole`, `customerAiRateLimit`) |
| Controller (thin) | `ai.controller.ts#runAction` / `customer-ai.controller.ts#{chat,handoff}` |
| Authorized context builder | `ai-context.service.ts#buildTicketAiContext` / `customer-ai-context.ts#buildCustomerAiContext` |
| Prompt construction | `ai-prompts.ts#build{Summary,SuggestedReply,Classification,KbRanking}Prompt` / inline in `customer-ai.service.ts#chat` |
| Provider adapter | `openrouter-provider.ts#OpenRouterProvider` (behind `ai-provider.ts#getAiProvider`) |
| Output validation | `ai.schema.ts` / `customer-ai.schema.ts` (Zod) |
| Candidate re-validation | `ai.service.ts#dispatch` (CLASSIFY/KB_SUGGESTIONS branches) / `customer-ai.service.ts#chat` |
| Response | Controller returns the validated result as-is |

## Frontend architecture (as-built)

```text
Internal:  ticket-detail-page.tsx → AiAssistantPanel
             → useTicketAi{Summary,SuggestedReply,Classification,KbSuggestions}
               (ai-assistant-hooks.ts, independent useMutation per action)
             → ai-assistant-api.ts (thin axios POST wrappers)
             → AiSummary / AiSuggestedReply / AiCategorySuggestion / AiKbSuggestions
               (presentational, plain-text rendering, own loading/error/empty states)

Customer:  Portal shell → CustomerAiWidget (mounted once, global floating widget)
             → useCustomerAiChat / useCustomerAiHandoff (customer-ai-hooks.ts)
             → customer-ai-api.ts (thin axios POST wrappers)
             → SupportWidget (shared non-modal shell, also used for Live Chat)
```

Both hook layers keep AI results in `useMutation` state only — never
written into the TanStack Query cache for the ticket or any other entity —
which is the structural reason a generated AI result can never be
mistaken for persisted data or accidentally invalidate/refetch unrelated
UI.

## Context-building strategy

Context assembly is intentionally **duplicated, not shared**, between the
two modules (`ai-context.service.ts` vs `customer-ai-context.ts`) because
they draw from structurally different, non-overlapping data (an
authorized single ticket vs. an anonymous-to-the-query PUBLISHED KB
search) and enforce different authorization models (ticket visibility vs.
"published only, no visibility concept needed"). Merging them would blur
the trust boundary the two modules currently keep structurally separate
(reinforced by the `ai-portal-isolation.test.ts` guard) — not attempted.

Per-action minimization within the internal module (`CONTEXT_OPTIONS` in
`ai.service.ts`) is table-driven, not duplicated per action — adding a
future action means adding one entry, not writing new context-fetch code.

## Provider adapter strategy

One interface (`AiProvider`), one concrete adapter (`OpenRouterProvider`),
one test double (`MockAiProvider`), one cached factory
(`getAiProvider`/`ai-provider.ts`) shared by both modules. Adding a second
vendor means implementing `AiProvider` and adding one branch to the
factory's `if (config.provider === ...)` chain — nothing in
`ai.service.ts`, `customer-ai.service.ts`, or any prompt file would need
to change. This seam was verified by reading, not modified.

## Authorization / privacy strategy

- Internal: authorize **before** building context — `buildTicketAiContext`
  embeds `ticketVisibilityWhere` directly in the single Prisma query that
  loads ticket data; there is no separate "load, then check" step.
  Verified by source inspection and by the existing test suite's explicit
  team-scope/404 assertions (see `spec.md` "Authorization ordering").
- Customer: no per-request identity is even needed for `chat` (stateless,
  PUBLISHED-only query has no identity-scoped branch); `handoff` binds to
  `request.auth.userId` only, never a client-supplied id.
- Data minimization is enforced at the Prisma `select` level (not by
  filtering a larger fetched object afterward) in both context builders —
  a field that is never selected cannot leak via a future logging/error
  change either.
- No new authorization primitive was introduced; both modules consume
  existing ones (Tickets' visibility predicate, KB's `PUBLISHED` status
  gate, the portal router's role gate).

## Grounding strategy

Keyword `contains` search over `title`/`contentText`/`category`, capped
candidate count (10 internal / 8 customer), PUBLISHED-only, re-ranked (not
authored) by the model, with server-side re-validation of returned ids
against the candidate set. This is explicitly documented (both in
`docs/11-ai-features.md` and inline code comments) as an MVP choice with a
known upgrade path to embeddings/pgvector — reconfirmed accurate this pass,
not changed. See `specs/features/knowledge-base/spec.md` for the article
content/lifecycle model this grounding consumes.

## Output validation / sanitization strategy

- **Structural validation:** paired Zod schema per action/response shape,
  authoritative over the provider's own `response_format` request; unknown
  keys stripped, not merely ignored, so a provider-invented field can never
  reach the client even accidentally.
- **Semantic validation:** id-bearing fields (`categoryId`, KB article
  `id`s) are independently re-checked against a server-fetched candidate
  set after Zod validation succeeds — Zod alone would accept a
  well-formed-but-invented id, so this second check is not redundant.
- **Rendering sanitization:** not needed beyond React's default text
  escaping, because no AI output is ever rendered as HTML (verified this
  pass by grep — zero `dangerouslySetInnerHTML` in either AI feature
  directory). If a future change introduces markdown/rich rendering for AI
  output, it must reuse the existing `sanitizeReplyHtml`/DOMPurify
  boundary already owned by Tickets — not invent a new one.

## Testing strategy (existing coverage, audited this pass)

Already covers, per module:

- **Server (`ai.test.ts`, `openrouter-provider.test.ts`,
  `customer-ai.test.ts`):** unauthenticated/CUSTOMER-blocked, cross-team/
  invisible-ticket 404, per-action context minimization (internal notes
  present/absent, candidate scoping), prompt-injection containment
  (delimiter spoofing, instruction-following resistance) across all four
  actions, invented-id rejection (category + KB, both modules), provider
  failure normalization (timeout/reject/rate-limit/malformed-output) with
  no-leak assertions, rate limiting (limit hit + per-user bucket
  isolation), customer isolation (no ticket/note/watcher fields in the
  outgoing prompt, fail-closed with zero candidates, schema role
  restriction).
- **Client (`ai-assistant.test.tsx`, `ai-portal-isolation.test.ts`,
  `customer-ai-widget.test.tsx`):** no request on mount/open, exactly-one-
  request + duplicate-blocking per action, structured (not raw JSON)
  rendering, cache non-pollution, safe localized error mapping + Retry,
  `AI_NOT_CONFIGURED` unavailable state, independent per-action error
  isolation, insert-into-reply cursor/replace/cancel flows + too-long
  guard, apply-category gating by `canManage` + already-current state,
  structural portal-isolation guard, customer widget non-modal behavior,
  AI/Live-Chat channel switching without losing either conversation, RTL/
  compatibility-route behavior.

No test gaps were found that map to a genuine untested behavior claimed by
this spec — the "Tests" audit (task brief item 18) did not surface a
missing-coverage item worth adding. No new tests were written this pass.

## Verification strategy

Automated-test-verified: full server suite, full client suite, targeted
AI/customer-AI/Tickets/Knowledge-Base subsets, both `tsc --noEmit`, both
`eslint`, `git diff --check`. Source-inspection-verified: the "no Prisma
write call" mutation-safety claim (grep across the AI module for
`.create(`/`.update(`/`.delete(`/`.upsert(` — none found outside
read-only `findFirst`/`findMany`), the "no `dangerouslySetInnerHTML`"
rendering-safety claim, the "no AI_API_KEY in prompts/logs" secrets claim.
**Not** live-provider/runtime-verified — no real OpenRouter call was made;
this environment has no configured `AI_API_KEY` and the brief explicitly
disallows making one without the repo's own safe test/dev setup for it
(none exists — `MockAiProvider` is the only offline path, already exercised
by the full test suite). See `tasks.md` for the exact commands and counts.

## Confirmed-gap implementation plan

None. No security/RBAC/privacy/correctness/unsafe-rendering defect was
confirmed this pass, so there is no fix to plan or implement. (Contrast
with `specs/features/tasks-reminders/plan.md`'s TASKS-001, or this
branch's own Tickets/Customers/Knowledge-Base/SLA/Auth SDD passes, each of
which did fix one confirmed defect — this module was already built to the
same bar those passes brought the others to.)

## Risks / trade-offs (accepted, not changed)

- **Duplicated KB-candidate retrieval** (internal vs. customer) — a
  maintenance cost, not a correctness risk, since both are independently
  and correctly PUBLISHED-only. A future consolidation is reasonable but
  out of fast-track scope.
- **Prompt-injection mitigation is defense-in-depth, not a hard
  guarantee** — the actual safety net is server-side re-validation/RBAC
  after the model responds, not the system prompt's instructions to the
  model. This is stated explicitly in `spec.md` rather than implied.
- **`handoff` has no dedicated rate limit** — accepted because it makes no
  provider call and mirrors an already-unrated sibling endpoint
  (`POST /portal/tickets`); fixing it in isolation would be an
  inconsistent narrow patch rather than a considered Portal-wide decision.
- **In-memory, single-instance rate limiting** — a repo-wide characteristic
  (shared `rateLimit()` factory), not an AI-specific risk introduced here.
- **No live-provider verification performed** — acceptable for this pass
  per the brief's constraints; `MockAiProvider` plus the OpenRouter
  adapter's own dedicated HTTP-shape tests (`openrouter-provider.test.ts`)
  are the achievable substitute without a real API key in this
  environment.
