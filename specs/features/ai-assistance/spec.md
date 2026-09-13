# AI Assistance — Spec

## Status

**Implemented + verified on SDD branch** (`chore/sdd-foundation`, 2026-09-13,
committed). Brownfield discovery of two already-shipped, already
well-hardened modules (`server/src/modules/{ai,customer-ai}`,
`client/src/features/{ai-assistant,customer-ai}`) that had no dedicated SDD
package (previously listed in `specs/features/README.md` under "Implemented
in code, no dedicated SDD package"). **No confirmed security, privacy,
correctness, or unsafe-rendering defect was found** — this pass is
documentation-only; zero production code was changed. Server 1102/1102,
client 840/840 tests pass; `tsc`/`eslint` clean both sides. See `tasks.md`
for the exact verification evidence and task ledger.

## Purpose

AI Assistance is a suggestion-only enhancement layer over two independent
surfaces:

1. **Internal Ticket AI** (`POST /api/tickets/:id/ai`) — four on-demand,
   read-only actions (`SUMMARY`, `SUGGEST_REPLY`, `CLASSIFY`,
   `KB_SUGGESTIONS`) available to ADMIN/MANAGER/AGENT on a ticket they can
   already see.
2. **Customer AI Chatbot** (`POST /api/portal/ai/{chat,handoff}`) — a
   KB-grounded, published-article-only support assistant for authenticated
   CUSTOMER portal users, with an explicit escalation ("handoff") path that
   creates a normal Portal ticket.

Both are recommendation/drafting tools. Neither surface mutates a ticket,
sends a customer-facing message, or changes application state on its own —
every "use this" action (insert reply, apply category, open article, create
a handoff ticket) is a separate, explicit, already-RBAC'd application
action.

## Scope

- Prompt/context construction for both AI surfaces.
- Provider adapter (`AiProvider` interface, `OpenRouterProvider`,
  `MockAiProvider`) and provider-failure normalization.
- AI-specific request validation (Zod), output validation (Zod +
  candidate-id re-validation), and AI-specific rate limiting.
- AI-specific authorization: reuse of `ticketVisibilityWhere` for internal
  AI, PUBLISHED-only retrieval for both KB-grounding paths.
- Frontend AI Assistant drawer (Ticket Details) and Customer AI floating
  widget: loading/pending/error/empty states, explicit insert/apply/handoff
  actions, disclaimers.

## Out of Scope

- Ticket lifecycle, status/priority/assignment mutation — owned by
  `specs/features/tickets/`.
- Knowledge Base article lifecycle (draft/publish/edit) — owned by
  `specs/features/knowledge-base/`. AI only **consumes** PUBLISHED content.
- Realtime/SSE transport — owned by `specs/features/realtime/`. AI has no
  realtime event of its own.
- Live Chat / conversation channel transport — owned by
  `specs/features/conversations-channels/`. The customer widget's "Talk to
  a person" escalation reuses the existing Live Chat bootstrap; AI does not
  own that flow.
- Auth/session/JWT mechanics — owned by `specs/features/auth-rbac/`. AI
  routes consume `requireAuth`/`requireRole`, they do not define them.
- Vector database / embeddings / RAG platform, custom model hosting, token
  accounting/billing, a prompt-management or evaluation platform,
  conversation-memory persistence, autonomous multi-step agent workflows,
  speculative model switching — **none exist in this repository and none
  are built by this pass** (see Deferred Scope).

## Actors

| Actor | Internal Ticket AI | Customer AI Chatbot |
|---|---|---|
| ADMIN | Full — any ticket it can see (i.e. all) | No route exists for staff |
| MANAGER | Team-scoped — same visibility as `GET /api/tickets/:id` | No route exists for staff |
| AGENT | Own-team/assigned-scoped — same visibility as `GET /api/tickets/:id` | No route exists for staff |
| CUSTOMER | `403 FORBIDDEN` — router-level `requireRole` block | Full — own conversation only, authenticated, no persistence server-side |
| Unauthenticated | `401 AUTHENTICATION_REQUIRED` | `401 AUTHENTICATION_REQUIRED` (portal router requires auth) |

## AI Capability Matrix

All four internal actions and the customer chatbot share one invariant:
**read-only with respect to the ticket/KB domain** — none of them writes a
`Ticket`, `Message`, `Note`, or `KnowledgeArticle` row. `handoff` is the one
exception and it writes only a **new** ticket via the existing, unrelated
Portal ticket-creation path (not an AI-owned write).

| Capability | Actor | Input | Output | Data sources | Mutating? | Human confirmation | Provider call |
|---|---|---|---|---|---|---|---|
| `SUMMARY` | ADMIN/MANAGER/AGENT | `{ action: "SUMMARY", locale? }` | `{ issue, timeline[], currentState, recommendedNextAction }` | ticket fields, public messages, internal notes (all from `buildTicketAiContext`) | No | N/A — internal-only display, agent reads it, no insertion | Yes |
| `SUGGEST_REPLY` | ADMIN/MANAGER/AGENT | `{ action: "SUGGEST_REPLY" }` | `{ reply }` (≤5000 chars) | ticket fields, public messages, internal notes (delimited private block) | No (drafts only) | **Yes** — "Insert into Reply" is a separate click; Send Reply is the existing composer action, itself another click | Yes |
| `CLASSIFY` | ADMIN/MANAGER/AGENT | `{ action: "CLASSIFY" }` | `{ categoryId, categoryName, confidence, reason }` | ticket fields, recent public messages (last 12), active `Category` list | No | **Yes** — "Apply Category" routes through the normal `useUpdateTicket({ categoryId })` mutation, its own RBAC | Yes |
| `KB_SUGGESTIONS` | ADMIN/MANAGER/AGENT | `{ action: "KB_SUGGESTIONS" }` | `{ articles: [{ id, title, excerpt, relevance, reason }] }` (≤5) | ticket fields, recent public messages (last 12), up to 10 PUBLISHED KB candidates (keyword `contains` retrieval) | No | N/A — "Open Article" is plain navigation, no insertion | Yes (skipped entirely if zero DB candidates) |
| Customer AI chat | CUSTOMER (authenticated) | `{ message, history[≤8], locale }` | `{ answer, confidence, suggestedArticles[], canHandoff }` | up to 8 PUBLISHED KB articles matched by keyword, bounded conversation history | No | N/A — answer is shown directly; handoff is a separate explicit click | Yes (skipped, fails closed, if zero PUBLISHED candidates) |
| Customer AI handoff | CUSTOMER (authenticated) | `{ message, history[≤8] }` | new Portal ticket `{ id, ... }` | client-tracked conversation transcript only | **Yes** — creates one Ticket | **Yes** — explicit "Talk to a person" / handoff button click | No (no provider call; reuses `portal.service.createTicket`) |

Not implemented and not claimed anywhere in this repo: sentiment analysis,
next-best-action recommendation beyond `SUGGEST_REPLY`'s single "recommended
next action" text field, auto-escalation without a customer click,
tone-rewrite, or any AI-to-live-chat handoff that bypasses the customer's
own action.

## Role / Permission Matrix

Server-authoritative in both modules; the frontend only hides UI it cannot
use.

| Action | ADMIN | MANAGER | AGENT | CUSTOMER |
|---|---|---|---|---|
| `POST /api/tickets/:id/ai` (any action) | any ticket | own team (`ticketVisibilityWhere`) | own/unassigned-own-team (`ticketVisibilityWhere`) | `403 FORBIDDEN` at router (`ticketRouter` mounts under `requireAuth` + role checks upstream of `/:id/ai`) |
| `POST /api/portal/ai/chat` | n/a (no route) | n/a | n/a | own conversation only, `requireAuth, requireRole(CUSTOMER), requireFreshToken` |
| `POST /api/portal/ai/handoff` | n/a | n/a | n/a | creates a ticket bound to the caller's own `Customer` record only (`customerIdFor(userId)`), same as every other Portal ticket-creation path |

Verified server-side, not just frontend-hidden — confirmed in
`server/src/modules/ai/ai.test.ts` ("rejects unauthenticated callers",
"rejects CUSTOMER", the team-scope tests) and by inspection of
`portal.routes.ts` (router-level `requireRole(Role.CUSTOMER)` gates
`ai/chat` and `ai/handoff` before the handler runs — there is no per-route
override that would weaken it).

**Is customer AI a separate surface?** Yes, by construction, not just by
policy: `client/src/features/ai-assistant/ai-portal-isolation.test.ts` is a
structural guard asserting no `client/src/features/portal/*` source file
imports the internal `ai-assistant` feature at all (not just "is not
rendered"). Server-side, `customer-ai.service.ts` never imports
`ai-context.service.ts`, `ai-prompts.ts`, or any ticket/note/watcher
Prisma model — it only imports `getAiProvider` (the shared provider
adapter/factory) and `portal.service.createTicket`. The two modules share
only the provider abstraction and the normalized `AiProviderError` type.

**Can customer AI access internal-only data?** No — confirmed by
`buildCustomerAiContext` (`server/src/modules/customer-ai/customer-ai-context.ts`):
its Prisma `select` is `{ id, title, category, contentText }` on
`knowledgeArticle` only, `where.status = PUBLISHED` always, and there is no
code path from `chat`/`handoff` into `prisma.ticket`, `prisma.note`,
`prisma.user`, `prisma.auditLog`, or any other model. Regression test:
`customer-ai.test.ts` asserts the outgoing prompt does not match
`/internalNotes|watchers|auditLog|assignee|firstResponseDueAt/i`.

**Server-side enforcement, not just frontend hiding?** Yes for both
surfaces — see the Role/Permission Matrix above; every row is enforced by
Express middleware (`requireAuth`, `requireRole`) or a Prisma `where`
predicate (`ticketVisibilityWhere`, `status: PUBLISHED`), never by a client
check alone.

## Context / Data Exposure Policy

### Internal Ticket AI (`ai-context.service.ts`)

`buildTicketAiContext` is the single place ticket data enters an AI prompt.
Deliberately **excluded** from every action's context, always: customer
email/phone (`customer: { select: { name: true } }` only), assignee, SLA
internal fields (`firstResponseDueAt`, etc.), watchers, ticket
history/audit rows, attachments, any id other than the ticket's own
reference.

Per-action minimization (`CONTEXT_OPTIONS` in `ai.service.ts`):

| Action | Internal notes | Public message limit |
|---|---|---|
| `SUMMARY` | full | 50 (`MAX_MESSAGES`) |
| `SUGGEST_REPLY` | full, but only inside `<PRIVATE_INTERNAL_CONTEXT>` with an explicit non-disclosure instruction | 50 |
| `CLASSIFY` | **none** — dropped from the context object entirely, not just unrendered | 12 (`RECENT_PUBLIC_MESSAGES`) |
| `KB_SUGGESTIONS` | **none** | 12 |

Hard ceilings so a large ticket cannot blow the provider window or leak
disproportionate data: 50 messages, 25 000 total conversation characters,
4 000 characters per message/note body — oldest notes dropped first, then
oldest messages, keeping the latest exchange; a `truncated` flag is
returned when this happens (not currently surfaced in the UI — see
Discovered Gaps).

Staff replies are stored as sanitized HTML and are flattened to plain text
(`replyHtmlToPlainText`) before entering the prompt — the model never
receives raw HTML markup. Customer inbound messages are already plain text.

### Customer AI Chatbot (`customer-ai-context.ts`)

Sources are **only** `PUBLISHED` `KnowledgeArticle` rows, up to 8
(`MAX_CUSTOMER_AI_ARTICLES`), matched by a bilingual (en/ar) keyword
`contains` search over `title`/`contentText`/`category`. Projection is
`{ id, title, category, contentText }` — `contentText` is the KB module's
own derived plain-text projection (never raw rich-text HTML; confirmed by
the KB module's `RT-6.2` invariant, reused here). Conversation history sent
to the provider is capped at 8 turns and length-capped per turn (2000
chars, Zod `.strict()`), and the customer's own prior "assistant" turns are
explicitly labeled `PREVIOUS_ASSISTANT` and instructed to be treated as
untrusted data — a customer who tampers with client-side history state
cannot smuggle new instructions past the system prompt (see Trust
Boundaries).

**No article body over-exposure:** `KB_SUGGESTIONS` (internal) and the
customer chatbot both send only `id`/`title`/`excerpt` to the model for
ranking/selection, not the full article body — confirmed by a dedicated
test (`ai.test.ts` "sends only id/title/excerpt to the model, not the full
article body").

**No secrets ever reach the provider:** `AI_API_KEY` is read once in
`ai.config.ts`/`openrouter-provider.ts` and used only as the outbound
`Authorization` header value to OpenRouter itself — it is never
interpolated into a prompt, logged, or echoed in any response. Verified by
source inspection (no `apiKey`/`AI_API_KEY` reference anywhere in
`ai-prompts.ts`, `ai-context.service.ts`, `customer-ai-context.ts`, or any
`.test.ts` fixture/log assertion).

## Ticket AI Behavior

`POST /api/tickets/:id/ai` — request schema `aiActionSchema` (`{ action:
enum, locale?: "en"|"ar" }`, `.strict()` — unknown fields rejected). Route
chain: `aiRateLimit → validateParams → validateBody → runAiAction`
(`ticket.routes.ts:32`), itself under the ticket router's
`requireAuth`/role gating.

**Authorization ordering (proven, not assumed):** `runTicketAiAction`
(`ai.service.ts`) calls `buildTicketAiContext(ticketId, actor, options)`
before any provider work. Inside it, `resolveActorTeamScope(actor)`
resolves the caller's team **first**, and the single `prisma.ticket.findFirst`
call embeds `ticketVisibilityWhere(actor, team)` directly in its `where`
clause — there is no "fetch ticket, then check visibility in application
code" step and no separate unscoped fetch anywhere in the path. A ticket
outside the actor's visibility returns `404 TICKET_NOT_FOUND` with **zero**
data ever leaving the database query — the exact same predicate and 404
semantics as `GET /api/tickets/:id`, confirmed by five dedicated access-
control tests in `ai.test.ts` (unauthenticated → 401, CUSTOMER → 403,
invisible ticket → 404, AGENT own-team-only `OR` clause, MANAGER
team-scoped 404 on a foreign team).

**Response shape:** `{ data: { action, promptVersion, result } }`. `result`
is always the Zod-parsed, schema-stripped output — provider metadata,
rationale fields the model invents, or any extra key never reaches the
client (`aiSummarySchema`/`aiSuggestedReplySchema`/`aiClassificationSchema`/
`aiKbSuggestionsSchema`, all `.object(...)` with no passthrough).

**Rate limiting:** `aiRateLimit` — 20 actions / authenticated user / 10
minutes, in-memory fixed window (`middleware/rate-limit.ts`), same
single-instance-only limitation the rest of the repo already documents for
its other rate limiters (not an AI-specific gap).

**Mutation proof (PROVEN, not asserted):** `runTicketAiAction` and every
function it calls (`buildTicketAiContext`, `dispatch`, all four action
branches) perform **zero** Prisma write calls — grep-verified: the only
Prisma calls anywhere in `ai.service.ts`, `ai-context.service.ts`,
`ai-kb-candidates.ts` are `findFirst`/`findMany` (reads). No `ticket.update`,
`message.create`, `note.create`, `category.update`, or any write model
call exists in the module. The controller (`ai.controller.ts`) does nothing
but call `runTicketAiAction` and return its result — it never calls
`updateTicket`, `createReply`, or any other mutation service. Every
"apply"/"insert"/"send" step the frontend offers goes through a **separate,
independent, already-RBAC'd** mutation:
- "Apply Category" → `useUpdateTicket({ categoryId })` (Tickets' own PATCH,
  own RBAC — `categoryApply` is only passed to `AiAssistantPanel` when
  `canManage` is true).
- "Insert into Reply" → writes into the **local composer draft only**
  (`replyInsertion.insertSuggestedReply`); no network call happens until
  the user separately clicks the existing Send Reply button.
- "Open Article" → plain client-side navigation (`<Link>`), no mutation.

## Customer AI Behavior

Mounted under `portalRouter`, which applies `requireAuth,
requireRole(Role.CUSTOMER), requireFreshToken` to **every** route including
`/ai/chat` and `/ai/handoff` (`portal.routes.ts:22-25`) — there is no
anonymous/unauthenticated customer AI path in this repository, despite the
UI reading as a generic "support chatbot." `customerAiRateLimit` (20/user/10min,
same pattern as the internal limiter) additionally guards `/ai/chat`.

**Identity binding:** `chat` takes no user-identifying input at all (its
schema has no `customerId`/`userId` field — rejected by `.strict()` if
sent) and is stateless server-side; `handoff` receives `userId` from
`request.auth.userId` (never from the request body) and resolves the
`Customer` row via `customerIdFor(userId)` inside the existing
`portal.service.createTicket` — a customer cannot create a handoff ticket
under a different customer's identity.

**Conversation persistence:** none server-side. The conversation lives only
in React state in `CustomerAiWidget` for the life of the mounted widget
(survives Portal route navigation, lost on page reload) — there is no
`AiInteraction`/chat-session table in the schema. `history` is round-tripped
by the client and re-validated (`.strict()`, max 8 items, `role: "user" |
"assistant"` only — `"system"` rejected) on every request.

**KB grounding:** identical mechanism to internal `KB_SUGGESTIONS` (keyword
`contains`, PUBLISHED-only), independently implemented in
`customer-ai-context.ts` (not a shared function with the internal path —
see "Discovered Gaps" for the acknowledged, not-a-defect duplication).

**Escalation to Live Chat / ticket:** two independent escalation paths,
neither auto-triggered:
1. **Handoff to a ticket** (`canHandoff`, `POST /api/portal/ai/handoff`) —
   surfaced whenever `confidence < 0.55` or zero KB candidates matched;
   always requires an explicit customer button click. Creates one ordinary
   Portal ticket (`subject`, `description` = conversation transcript,
   `channel: WEB`, unassigned/unrouted like every other Portal-created
   ticket) via the canonical `createTicket` path — no AI-specific ticket
   field, no bypass of the normal creation flow.
2. **"Talk to a person" → Live Chat** — a UI-only channel switch inside
   `CustomerAiWidget` (`setChannel("live")`); it does not call any AI
   endpoint. Live Chat's own start/resume flow (owned by
   `specs/features/conversations-channels/`) takes over from there.

**Fail-closed behavior:** if `buildCustomerAiContext` returns zero
candidates, `chat` returns a canned "I don't have enough reliable
information…" answer (localized en/ar) with `confidence: 0, canHandoff:
true` **without calling the provider at all** — confirmed by test ("fails
closed without calling the provider when no published source matches").

**Rate limiting / provider failure fallback:** same normalized error
mapping as internal AI (`AI_NOT_CONFIGURED` → 503, `AI_TIMEOUT` → 504,
`AI_PROVIDER_RATE_LIMITED` → 503, anything else → 502
`AI_GENERATION_FAILED`), plus the CRM's own `customerAiRateLimit` → 429.

## Knowledge Base Grounding

Both grounding paths (internal `KB_SUGGESTIONS`, customer `chat`) query
`status: PUBLISHED` **unconditionally** — there is no parameter, ticket
field, or customer input that can widen this. Regression coverage: `ai.test.ts`
"pins the candidate query to PUBLISHED even when the ticket asks for
drafts" (a prompt-injection-style attempt inside the ticket description is
proven not to change the Prisma `where` clause). DRAFT/ARCHIVED articles
are structurally unreachable from either AI path — confirmed by inspecting
`listKbCandidates` and `buildCustomerAiContext`, both of which hardcode
`KnowledgeArticleStatus.PUBLISHED` in their `where`.

Article content is always the KB module's own derived plain-text
projection (`contentText`/`deriveExcerpt`, owned by
`knowledge-article.service.ts`) — never raw rich-text HTML — so no
markup-injection surface exists in either grounding path.

**No matching article:** internal `KB_SUGGESTIONS` returns `200 {
articles: [] }` without a provider call (0 DB candidates ⇒ empty result,
proven not-an-error by dedicated test and UI copy "No relevant articles
found"). Customer chat instead returns the fail-closed canned answer
described above (a UI/product difference between the two surfaces — see
Cross-Feature Ownership Boundaries; both are read-only and both avoid an
unnecessary provider call).

**AI never authors, edits, or publishes a KB article** — that is entirely
owned by `specs/features/knowledge-base/`; AI is a consumer only, in both
directions of the boundary (never triggers KB writes, never receives
DRAFT/internal KB metadata).

## Human-in-the-Loop Rules

**Invariant (verified, see "Ticket AI Behavior" mutation proof above): no
AI-generated content can silently perform a privileged mutation.** Every
internal action is suggestion/draft-only; every "use this" step is a
separate click through an existing, independently-RBAC'd mutation path
(ticket-update for category, the ordinary composer+Send for a reply,
plain navigation for a KB article).

The one path where AI output **does** cause a write is customer handoff —
and that write (`createTicket`) is not AI-authored data reaching the
database as ticket state; it is a plain support-ticket creation the
customer explicitly requested, with the AI conversation only supplying
descriptive text in the ticket body. No status/priority/assignment/SLA
field is AI-derived; all are the Portal's existing defaults
(`OPEN`/`MEDIUM`/unassigned/unrouted), identical to a manually-typed Portal
ticket.

There is **no existing auto-escalation** for customer AI beyond the
customer's own click — no confidence threshold auto-creates a ticket, no
timeout auto-hands-off. `canHandoff` only *offers* the button.

## Trust / Hallucination Boundaries

- **AI text is never used as an authorization input.** Neither module
  reads any AI output to decide what a user may see or do; every
  visibility/permission decision is made before context is built
  (see "Authorization ordering" above) using server-owned predicates only.
- **AI output never builds a raw DB query.** `CLASSIFY`'s `categoryId` and
  `KB_SUGGESTIONS`/`chat`'s article ids are looked up by exact match
  against a server-fetched candidate `Map`/list, never interpolated into a
  Prisma filter or raw SQL.
- **IDs/enums from the model are always re-validated before use:**
  `CLASSIFY` rejects (`502 AI_GENERATION_FAILED`) any `categoryId` not in
  the server-fetched active-category list, and always returns the
  server's own `categoryName`, never the model's; `KB_SUGGESTIONS`/`chat`
  silently drop any article id outside the candidate set and re-attach
  `title`/`excerpt`/`category` from the database record, never from the
  model. Six dedicated "invented id" tests cover this across both modules.
- **Structured outputs are schema-validated server-side, always** — a
  provider `response_format` request is advisory only; the paired Zod
  schema (`ai.schema.ts`, `customer-ai.schema.ts`) is the sole source of
  truth, with unknown keys stripped rather than passed through. A shape
  mismatch is a normalized `502`, never a partial/best-effort pass-through.
- **User/ticket/KB text cannot override system security rules.** The base
  system prompt (`BASE_SECURITY_PROMPT`) explicitly states that everything
  inside a data block is untrusted data, that instruction-, role-label-,
  or delimiter-looking text inside it is still data, and that the model
  must never reveal internal instructions/secrets/metadata or claim to
  perform an action. Every value interpolated into a data block is passed
  through `neutralizeDelimiters` so it cannot spoof block boundaries. This
  is a **prompt-level mitigation, not a guarantee** — it reduces prompt-
  injection risk but does not eliminate the underlying trust boundary
  between "text an LLM reads" and "instructions it should follow"; the
  system's actual safety net is that AI output can never bypass
  server-side re-validation (ids) or server-side RBAC (mutations), so even
  a successful injection cannot escalate privilege or leak data the model
  wasn't given. Documented as an accepted risk boundary, not "solved" —
  12+ prompt-injection regression tests across both modules assert the
  data stays inert, but no claim of complete immunity is made.
- **Intentional risk boundary:** `SUMMARY`/`SUGGEST_REPLY` output is
  free-form model text (not schema-constrained beyond string
  length/shape). The system prompt instructs the model not to fabricate
  facts/policies/timelines, but nothing server-side fact-checks the
  generated prose against ticket data — an agent reviewing a summary or a
  suggested reply is the actual correctness backstop, by design (human
  confirmation before any customer-facing send).

## Rate Limiting / Abuse Controls

| Surface | Limit | Scope | Store |
|---|---|---|---|
| `POST /tickets/:id/ai` | 20 / 10 min | per authenticated `userId` | in-memory fixed window, single-instance |
| `POST /portal/ai/chat` | 20 / 10 min | per authenticated `userId` | in-memory fixed window, single-instance |
| `POST /portal/ai/handoff` | none | — | — |
| Provider request | `AI_TIMEOUT_MS` (default 20000ms) per attempt, one bounded retry on 429 only if the wait fits the remaining budget | — | — |

**Can an authenticated user trigger unbounded provider calls?** No for
`chat`/ticket actions (rate-limited as above). **Yes, narrowly, for
`handoff`** — it has no dedicated rate limit, but it makes **zero provider
calls** (it only writes a ticket via the existing Portal creation path), so
"unbounded provider calls" does not apply to it; the exposure is instead
"unbounded ticket creation," which is the same exposure the ordinary `POST
/portal/tickets` endpoint already carries repo-wide (no rate limit on
manual Portal ticket creation either) — not an AI-specific gap, so not
fixed here (see Discovered Gaps, deferred).

Per-request input size is bounded by each schema (`message`/`history`
item ≤2000 chars, ≤8 history items; ticket-side context capped at 25 000
chars / 50 messages as above) — no unbounded prompt size is reachable from
user input on either surface.

## Provider Failure Behavior

Every vendor-specific detail (HTTP status, OpenRouter's own `error.code`/
`message`/`metadata.raw`) is normalized inside `OpenRouterProvider` into one
of five `AiProviderErrorReason`s (`TIMEOUT`, `PROVIDER_UNREACHABLE`,
`PROVIDER_REJECTED`, `RATE_LIMITED`, `INVALID_OUTPUT`) before it ever
leaves the adapter. Both service layers map these to controlled app errors:

| Provider condition | HTTP | Code | Client-visible detail |
|---|---|---|---|
| No `AI_PROVIDER`/`AI_API_KEY`/`AI_MODEL` configured | 503 | `AI_NOT_CONFIGURED` | generic message only |
| Request exceeds `AI_TIMEOUT_MS` | 504 | `AI_TIMEOUT` | generic message only |
| Provider 429 (after the one bounded retry) | 503 | `AI_PROVIDER_RATE_LIMITED` | `retryAfterSeconds` only, if known |
| Any other non-2xx / in-body error / malformed or empty JSON | 502 | `AI_GENERATION_FAILED` | generic message only |
| Output fails Zod validation | 502 | `AI_GENERATION_FAILED` | generic message only |

**No leakage, proven:** `ai.test.ts` explicitly asserts the raw provider
detail (e.g. a model name, `"OpenRouter"`, `"429"`) never appears anywhere
in `JSON.stringify(response.body)` for a rejected/rate-limited request;
`openrouter-provider.test.ts` separately asserts the thrown
`AiProviderError.message` never contains the upstream provider name or its
raw error payload. A safe, structural-only diagnostic (`status`, `code`,
`type`, `provider_name`, a clipped `message`/`raw`) is logged
server-side only (`console.error`/`console.warn`), never returned to the
client.

## Rendering / XSS Safety

Both surfaces render all AI-derived text as **plain React text nodes**
(`{value}` / `{article.title}` / `{item.content}`), never
`dangerouslySetInnerHTML` — confirmed by a repo-wide grep across
`client/src/features/ai-assistant/` and `client/src/features/customer-ai/`
returning zero matches. There is no markdown/rich-text rendering path for
AI output anywhere in this repo — `whitespace-pre-wrap` CSS handles
newlines, not an HTML renderer. Since React escapes all interpolated text
by default, no DOMPurify/sanitize-html step is needed or present for AI
output specifically (distinct from ticket message/note bodies, which *are*
sanitized HTML — that boundary is owned by Tickets, not AI, and AI already
flattens those bodies to plain text before they even reach a prompt, see
Context / Data Exposure Policy).

## Logging / Privacy

- **Structured, per-call server log** (one `console.info` line per ticket
  AI action): `action`, `ticketId`, `userId`, `provider`, `model`,
  `latencyMs`, `ok` — never the prompt, the response body, or the API key.
- **Provider-adapter diagnostic** (`console.info` on request, `console.error`
  on rejection): shape-only (message count, schema name,
  `response_format` type) on the request side; HTTP status + OpenRouter's
  own error code/type/provider-name + a **clipped** (≤400/600 char) copy of
  OpenRouter's own error message/raw payload on the rejection side — never
  the outbound prompt or the API key.
- **No full-conversation logging anywhere** — neither module logs the
  ticket context, the customer conversation, or the model's answer text.
- **No AI-specific audit log (`AuditLog`) row is written for any AI
  action**, by design — confirmed intentional (not an oversight) by a
  dedicated regression test in both `ai.test.ts` and `customer-ai.test.ts`
  ("retrieves KB candidates … without writing an audit row" /
  "AI grounding retrieval reads PUBLISHED KB only — never audited"). This
  matches the read-only nature of every AI action; the one mutating
  action (`handoff` → `createTicket`) is **not** independently audited by
  Portal ticket creation either (`portal.service.ts` comment: "Portal
  creation stays unaudited (OD-3)") — a pre-existing, already-accepted
  Portal/Tickets characteristic, not something introduced or changed by
  AI.
- **Secrets:** `AI_API_KEY` never appears in logs, prompts, responses, or
  test fixtures — confirmed by source inspection (see Context / Data
  Exposure Policy).

## API Behavior

### `POST /api/tickets/:id/ai`

- Auth: `requireAuth` + role gate upstream in `ticket.routes.ts` (ADMIN/
  MANAGER/AGENT only; CUSTOMER/unauthenticated rejected before the handler).
- Rate limit: `aiRateLimit` (20/10min/user) — first in the middleware
  chain, before body validation.
- Body: `{ action: "SUMMARY"|"SUGGEST_REPLY"|"CLASSIFY"|"KB_SUGGESTIONS",
  locale?: "en"|"ar" }`, `.strict()`.
- Success: `200 { data: { action, promptVersion, result } }`.
- Errors: `401`, `403`, `404 TICKET_NOT_FOUND`, `400` (validation), `422
  AI_NO_CANDIDATES` (CLASSIFY only, zero active categories), `429
  RATE_LIMITED`, `502 AI_GENERATION_FAILED`, `503 AI_NOT_CONFIGURED`, `503
  AI_PROVIDER_RATE_LIMITED`, `504 AI_TIMEOUT`.

### `POST /api/portal/ai/chat`

- Auth: portal-router-level `requireAuth, requireRole(CUSTOMER),
  requireFreshToken`.
- Rate limit: `customerAiRateLimit` (20/10min/user).
- Body: `{ message: string(1-2000), history?: {role,content}[≤8],
  locale?: "en"|"ar" }`, `.strict()`.
- Success: `200 { data: { answer, confidence, suggestedArticles[],
  canHandoff } }`.
- Errors: `401`, `400`, `429`, plus the same provider-error family as
  above (no `AI_NO_CANDIDATES` — zero candidates is a normal `200`
  fail-closed answer, not an error).

### `POST /api/portal/ai/handoff`

- Auth: same portal-router gate as `chat`.
- No dedicated rate limit (see Rate Limiting).
- Body: `{ message: string(1-2000), history?: {role,content}[≤8] }`,
  `.strict()`.
- Success: `201 { data: <Ticket> }` (canonical Portal ticket shape).
- No provider call — creation failure modes are whatever
  `portal.service.createTicket` already defines (owned by Tickets/Portal,
  not AI).

## Frontend Behavior

- **Internal AI Assistant** (`AiAssistantPanel`) — on-demand only: opening
  the drawer fires no request; each of the four actions is its own
  independent `useMutation`, result kept in mutation state only (never
  written into the ticket TanStack Query cache), so a generated
  summary/reply/category/KB result can never be mistaken for persisted
  ticket data and surviving drawer close/reopen requires no re-request.
  Each action card is a real `<button>` that is itself the pending
  indicator (disabled + spinner + loading label while pending), which
  structurally prevents a duplicate in-flight request for the same action.
  Errors render a safe, localized message (`getAiErrorMessage`, mapping
  only a known code allowlist — any unmapped code/network failure falls
  back to a generic string) plus a `role="alert"` region and a Retry
  button; one action's error never clears another's already-rendered
  result (verified by explicit tests). `AI_NOT_CONFIGURED` renders a
  dedicated "unavailable" panel state instead of an error. RTL/Arabic:
  `SUMMARY` accepts the app's current language as a strict `locale` enum;
  text fields render with the existing app-wide RTL/`dir="auto"`
  conventions (no AI-specific i18n defect found).
- **Customer AI widget** (`CustomerAiWidget`) — a non-modal floating panel
  (no backdrop/focus-trap; the underlying Portal page stays fully
  interactive) with a persistent disclosure line (`customerAi.disclosure`)
  above the conversation. Send is disabled while a message is pending
  (`chat.isPending`) and the composer clears immediately on submit, with a
  local "thinking" status row; a failed send preserves the drafted text
  (`failedMessage`) behind an explicit Retry button rather than silently
  discarding it. AI answers, article suggestions (as router `<Link>`s to
  the internal-safe portal KB route), and the "Talk to a person"/handoff
  actions are all rendered as clearly separate, explicit controls — no
  automatic channel switch or ticket creation ever happens without a
  click. Auto-grows a bounded textarea; caps input at 2000 chars
  client-side (matching the server schema).
- Neither surface ever auto-sends AI-generated text as a customer-facing
  message or ticket update without the corresponding separate confirm
  click described above.

## Security Edge Cases

| Case | Behavior | Verified by |
|---|---|---|
| CUSTOMER calls `/tickets/:id/ai` | `403 FORBIDDEN` | existing test |
| Unauthenticated calls either AI surface | `401 AUTHENTICATION_REQUIRED` | existing tests |
| AGENT/MANAGER runs AI on a ticket outside their visibility | `404 TICKET_NOT_FOUND` (no existence leak, identical to `GET /api/tickets/:id`) | existing tests |
| Ticket/customer message content contains a prompt-injection attempt ("ignore previous instructions", fake `SYSTEM:`/delimiter text) | kept inside its untrusted data block, delimiter-neutralized, never followed | 6+ dedicated tests across `SUMMARY`/`SUGGEST_REPLY`/`CLASSIFY`/`KB_SUGGESTIONS` |
| Model invents a `categoryId`/article id not in the server candidate list | rejected (`502`) or silently dropped, never trusted | existing tests |
| Model returns a well-formed-but-wrong-shape JSON payload | `502 AI_GENERATION_FAILED` via Zod | existing tests |
| Model output includes extra/leak-attempt fields (`rationale`, `_provider`, `usage`) | stripped by the Zod schema, never reach the client | existing test ("returns only the Zod-validated reply string") |
| Ticket description explicitly asks the KB retrieval to include DRAFT/ARCHIVED articles | Prisma `where.status` stays pinned to `PUBLISHED` regardless | existing test |
| Customer tampers with client-side `history` to inject a fake `"system"` role message | rejected by `.strict()` enum validation (`role: "user"\|"assistant"` only) | existing test |
| Customer sends `customerId`/other extra body field | rejected — schema is `.strict()` | existing test |
| Provider returns an out-of-range `confidence`/`relevance` | rejected (`502`) via Zod `.min(0).max(1)` | existing tests |
| Provider rejects/times out/rate-limits | normalized, no raw provider text/secrets ever reach the client | existing tests, both modules |
| Zero KB candidates for either grounding path | internal: `200 { articles: [] }`, no provider call; customer: fail-closed canned answer, no provider call | existing tests |

## Discovered Gaps

No confirmed security, privacy, correctness, or unsafe-rendering defect was
found in either AI module during this pass. The items below are
architecture-debt/documentation/UX observations, explicitly **not**
fast-tracked per the brownfield brief (no invented behavior, no redesign of
working code):

- **DG-1 (architecture debt, not a leak):** KB keyword-candidate retrieval
  is implemented **twice**, independently — `ai-kb-candidates.ts`
  (internal, includes ticket category in the `OR`) and
  `customer-ai-context.ts` (customer, includes a small Arabic stopword
  list the internal version lacks). Both are correctly PUBLISHED-only and
  both are independently tested, so this is not a security risk, just
  duplicated logic that a future consolidation could unify behind one
  shared retrieval helper. Deferred — not a correctness/security issue,
  and the fast-track brief explicitly excludes a RAG/retrieval platform
  rewrite.
- **DG-2 (UX polish, deferred):** `AiTicketContext.truncated` (set when
  message/character limits drop part of the conversation) is computed and
  returned internally but never surfaced anywhere in the ticket AI
  response schema or the frontend UI — an agent has no visible signal that
  a `SUMMARY`/`SUGGEST_REPLY` was generated from a truncated view of a very
  long ticket. Not a security or correctness defect (the AI still only
  ever sees authorized data, just possibly less of it); a future pass
  could surface it as a small caption. Deferred as UX polish.
- **DG-3 (architecture debt, pre-existing, not AI-specific):** `POST
  /api/portal/ai/handoff` has no dedicated rate limit, unlike `chat`. It
  makes no provider call (so it cannot be used to exhaust AI provider
  quota), but an authenticated customer could call it repeatedly to create
  many Portal tickets. This mirrors the **already-unrated** `POST
  /portal/tickets` endpoint itself (manual Portal ticket creation has no
  rate limit anywhere in this repository) — not a defect introduced or
  unique to AI, and adding one here alone (without addressing Portal
  ticket creation generally) would be an inconsistent, narrow fix. Deferred
  — flagged for whichever future pass addresses Portal-wide creation
  rate-limiting, not fast-tracked here per the brief's "don't build a new
  billing/quota platform" guidance and because it is not an AI-owned
  boundary.
- **DG-4 (documented, not a bug):** the in-memory rate limiters
  (`aiRateLimit`, `customerAiRateLimit`) are single-instance only, the same
  documented limitation as every other rate limiter in this repository
  (`middleware/rate-limit.ts`'s own doc comment). Not AI-specific,
  consistent with the rest of the app, not fixed here.
- **DG-5 (documented, not a bug):** internal `KB_SUGGESTIONS` and the
  customer chatbot use plain DB `contains` keyword search, not vector/
  semantic retrieval — both `docs/11-ai-features.md` and inline code
  comments already flag this as the known MVP limitation with an explicit
  future upgrade path (embeddings/pgvector/RAG). Explicitly out of scope
  for this fast-track pass (see Deferred Scope) and already accurately
  documented — no doc correction needed.
- **No stale `docs/` claim found.** `docs/11-ai-features.md` was read in
  full against the actual code (endpoint shape, context minimization per
  action, error codes, rate limits, security model, frontend behavior) and
  found to be accurate — no correction was needed or made this pass.

## Deferred Scope

Per the fast-track brief's explicit defer list — none of the following
exist in this repository, and none is invented or scaffolded here:

- Vector database / embeddings / RAG platform migration (KB retrieval stays
  keyword `contains`, as already documented).
- Custom model hosting; the only concrete adapter remains OpenRouter.
- Token accounting / billing / usage-quota platform.
- Prompt-management or evaluation platform.
- Conversation-memory / chat-session persistence for the customer widget
  (still browser-state-only, lost on reload).
- Speculative model switching or multi-model routing.
- Autonomous multi-step agent workflows (every AI action remains a single
  request/response, human-triggered).
- New AI capabilities (sentiment scoring, tone rewrite, auto-triage
  routing, next-best-action beyond the existing `SUGGEST_REPLY`
  recommendation field) — none exist and none are added.
- Consolidating the two independent KB-candidate retrieval
  implementations (DG-1) — deferred, not a defect.
- Rate-limiting `POST /portal/ai/handoff` or Portal ticket creation
  generally (DG-3) — deferred to a future Portal-scoped pass.

## Acceptance Criteria

1. Given a CUSTOMER token, `POST /api/tickets/:id/ai` returns `403
   FORBIDDEN`. ✓ (existing test)
2. Given an AGENT whose visibility does not include the target ticket,
   `POST /api/tickets/:id/ai` returns `404 TICKET_NOT_FOUND` and no
   provider call is made. ✓ (existing test — provider handler throws if
   invoked)
3. Given `CLASSIFY` runs and the provider returns a `categoryId` absent
   from the active-category candidate list, the response is `502
   AI_GENERATION_FAILED`, never the invented id. ✓ (existing test)
4. Given `KB_SUGGESTIONS`/customer `chat` runs and the provider returns an
   article id absent from the PUBLISHED candidate set, that id is silently
   dropped from the response. ✓ (existing tests, both modules)
5. Given any ticket AI action, the ticket, its messages, its notes, and its
   category are byte-for-byte unchanged after the call (no write path
   exists). ✓ (source-inspection-verified — no Prisma write call in
   `ai.service.ts`/`ai-context.service.ts`/`ai-kb-candidates.ts`; no
   regression test asserts this directly, since there is nothing to
   assert against — see `tasks.md` AI-002 for the exact inspection record)
6. Given zero PUBLISHED KB candidates match, both `KB_SUGGESTIONS` (200,
   empty array) and customer `chat` (fail-closed canned answer) return
   without ever calling the AI provider. ✓ (existing tests, both modules)
7. Given a provider timeout/rejection/rate-limit, the client response never
   contains the upstream provider name, raw error payload, model
   identifier from the failure, or the API key. ✓ (existing tests, both
   modules + the adapter's own test)
8. Given a customer sends a chat message with a spoofed `"system"`-role
   history entry, the request is rejected by schema validation before
   reaching the service. ✓ (existing test)
9. No `client/src/features/portal/*` source file imports the internal
   `ai-assistant` feature. ✓ (existing structural test,
   `ai-portal-isolation.test.ts`)
10. No AI-derived text is ever rendered via `dangerouslySetInnerHTML` in
    either AI feature directory. ✓ (source-inspection-verified this pass —
    repo-wide grep, zero matches)

## Cross-Feature Ownership Boundaries

| Neighbour | AI Assistance **owns** | AI Assistance **depends on** |
|---|---|---|
| Tickets | The `POST /tickets/:id/ai` request/response contract, prompt/context construction, provider interaction, AI-specific output validation | `ticketVisibilityWhere`/`resolveActorTeamScope` (authorization), `replyHtmlToPlainText` (context flattening), `useUpdateTicket` (category apply), the reply composer (insertion target) — none of these are redefined or duplicated here |
| Knowledge Base | AI-specific candidate retrieval query shape (keyword `contains`, PUBLISHED-only) and ranking prompt, for both grounding paths | `deriveExcerpt`/`contentText` (plain-text projection), the KB article model and its `PUBLISHED` status semantics, the internal `/knowledge-base/:id` route (navigation target) |
| Conversations/Channels | Nothing | The Live Chat bootstrap/start/resume flow the customer widget's "Talk to a person" switches into |
| Realtime | Nothing — no AI-specific SSE event exists | Nothing directly (AI responses are plain HTTP request/response) |
| Auth/RBAC | Nothing — AI adds no new role or permission concept | `requireAuth`/`requireRole`/`requireFreshToken` middleware, JWT-embedded actor identity |
| Customers/Portal | The `/portal/ai/{chat,handoff}` contract and the customer-AI context boundary itself | `portal.service.createTicket` (handoff), `customerIdFor` (identity binding), the Portal router's auth gate |
