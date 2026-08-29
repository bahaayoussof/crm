# AI Features

AI is an enhancement layer, not a dependency for the core CRM.

## Priority

### P2
1. Ticket summary
2. Suggested reply
3. Automatic categorization
4. Suggested knowledge-base solution

### P3
5. AI chatbot

## Provider

No provider is fixed.

Provider integration must be isolated behind an application service so the rest of the CRM does not depend directly on one vendor SDK.

Example conceptual interface:

```ts
interface AiAssistant {
  summarizeTicket(input: TicketContext): Promise<string>;
  suggestReply(input: TicketContext): Promise<string>;
  categorizeTicket(input: TicketContext): Promise<string>;
}
```

## Safety and UX

- AI output is a suggestion.
- Agents review suggested replies before sending.
- Do not automatically change ticket category or send a customer response without explicit product approval.
- If provider access is unavailable, the rest of the CRM must continue to work.

## Implementation (`feature/ai-assistant`, ADR-034)

### Endpoint

```text
POST /api/tickets/:id/ai      body: { "action": "SUMMARY" | "SUGGEST_REPLY" | "CLASSIFY" | "KB_SUGGESTIONS", "locale"?: "en" | "ar" }
```

Internal roles only (`ADMIN` / `MANAGER` / `AGENT`); `CUSTOMER` and unauthenticated callers are rejected at the router. The client sends only `{ action }` (plus an optional strict `locale` enum) — never messages, notes, customer data, or free-form text. The backend authenticates, applies the **same ticket-visibility rule as `GET /api/tickets/:id`** (`ticketVisibilityWhere`), builds the AI context itself, calls the provider, validates the structured output with Zod, and returns `{ data: { action, promptVersion, result } }`. This endpoint never mutates the ticket, sends a message, or changes state — every "use this" action (insert reply, apply category, open article) is a separate explicit user action through the existing paths.

### Provider

`AiService → AiProvider interface → OpenRouterProvider → model from AI_MODEL`. First concrete adapter: **OpenRouter** (`https://openrouter.ai`) via native `fetch`, no SDK. Initial development/demo model: `z-ai/glm-5.2:free` (not assumed permanent; an unavailable model returns a normalized provider error, never a silent swap). All OpenRouter-specific HTTP details (endpoint, auth header, optional attribution headers, message format, `response_format`, model param, response parsing, HTTP error mapping, timeout/abort) live only in `OpenRouterProvider`. Prompts and business logic are provider-independent. `MockAiProvider` (deterministic, offline) backs the tests.

### Configuration

```env
AI_PROVIDER=openrouter
AI_API_KEY=
AI_MODEL=z-ai/glm-5.2:free
AI_TIMEOUT_MS=20000
```

All optional. When `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` are not all set — or `AI_PROVIDER` names a vendor with no adapter — the endpoint returns `503 AI_NOT_CONFIGURED`, the rest of the CRM is unaffected, and startup never fails (`AI_PROVIDER` is a free string in env; `ai.config.ts` decides support and logs a one-line diagnostic for an unknown value). Keys are server-side only and never appear in source, tests, fixtures, logs, or docs.

### Context each action receives (minimized per action)

- **Common base:** ticket reference, subject, description, status, category name, created/updated timestamps; customer **display name only** (never email or phone); public messages (`authorType` CUSTOMER|AGENT, body, createdAt). Limits: 50 messages, 25 000 conversation characters, 4 000 characters per body. Description is always kept; oldest notes then oldest messages are dropped to fit; `truncated` is flagged.
- **SUMMARY** — base + internal notes (allowed; output is internal-only).
- **SUGGEST_REPLY** — base + internal notes, but only inside a clearly delimited `<PRIVATE_INTERNAL_CONTEXT>` block with an explicit non-disclosure instruction.
- **CLASSIFY** — subject, description, **recent** public conversation (last 12), + the server-loaded list of active categories (`id :: name`). **No internal notes** (dropped from the context object, not just unrendered). The returned id is re-validated server-side and the name is taken from the server record.
- **KB_SUGGESTIONS** — subject, description, **recent** public conversation (last 12), + up to 10 **PUBLISHED** KB articles retrieved by the existing `contains` search over subject/description keywords + category. **No internal notes.** The model may only rank/subset those ids; unknown ids are dropped and titles/excerpts come from the server record. If retrieval finds nothing, the endpoint returns `200 { articles: [] }` without calling the provider. No vector store (MVP); future upgrade path: embeddings / pgvector / RAG.

### Structured output

Each action sends a plain JSON Schema to the provider **and** validates the parsed result with a paired Zod schema server-side. Zod is authoritative; unknown keys are stripped. A mismatch → `502 AI_GENERATION_FAILED`.

| Action | Result shape |
|--------|--------------|
| `SUMMARY` | `{ issue, timeline: string[≤8], currentState, recommendedNextAction }` |
| `SUGGEST_REPLY` | `{ reply }` (≤5000 chars) |
| `CLASSIFY` | `{ categoryId, categoryName, confidence 0..1, reason }` — `categoryId` guaranteed to exist |
| `KB_SUGGESTIONS` | `{ articles: [{ id, title, excerpt, relevance 0..1, reason }] }` (≤5, all real published candidates) |

### Security

- **Prompt injection:** a shared base system prompt declares all ticket/message/note/candidate content untrusted data, never instructions; instructions inside it are not followed; system prompts/secrets/internal data are never revealed. Ticket content is always inside delimited data blocks, and every user-derived value is run through a delimiter-neutralizer (`</PUBLIC_CONVERSATION>` → `[PUBLIC_CONVERSATION]`) so it cannot spoof the prompt structure. The base prompt also states that delimiter-, tag-, role-label- (`SYSTEM:` …) or instruction-looking text inside a data block is still data.
- **Internal-note leakage:** SUGGEST_REPLY puts notes only in a `<PRIVATE_INTERNAL_CONTEXT>` block with an explicit non-disclosure rule; the server returns exactly the validated `{ reply }` string and never copies notes into it.
- **Candidate-id validation:** CLASSIFY and KB_SUGGESTIONS re-validate every id against the server-owned list after generation.
- **Human approval:** AI never sends a reply, never applies a category, never changes a ticket. Those remain explicit user actions on the existing mutation/composer/KB paths.

### Language policy

SUMMARY accepts an optional strict `locale` (`"en" | "ar"`) — a closed enum, never a free-form prompt string. When present the summary system prompt gets one `LANGUAGE:` directive; when absent, no directive (model default). The client sends the current application language. SUGGEST_REPLY has its own rule (reply in the customer's language); CLASSIFY/KB reasoning language is not currently pinned.

### Errors, rate limiting, timeout

`AI_NOT_CONFIGURED` (503), `AI_TIMEOUT` (504), `AI_PROVIDER_RATE_LIMITED` (503, retryable — provider/upstream HTTP 429; `Retry-After` header when known; the OpenRouter adapter already made one bounded retry inside `AI_TIMEOUT_MS`), `AI_GENERATION_FAILED` (502), `AI_NO_CANDIDATES` (422 — CLASSIFY only, zero active categories), `RATE_LIMITED` (429 — the CRM's own per-user AI limiter, distinct from the provider one). Raw provider errors, upstream provider names, and OpenRouter internals are never forwarded to the client; a safe server-side diagnostic (`status`, `code`, `type`, `provider_name`, clipped `message`/`raw`) is logged on a rejection. Per-request timeout via `AI_TIMEOUT_MS` (`AbortSignal.timeout`). Rate limit: 20 actions / user / 10 minutes (in-memory fixed-window; single-instance limitation documented). One structured server log line per call (`action`, `ticketId`, `userId`, `provider`, `model`, `latencyMs`, `ok`) — never the key or full conversation.

### Frontend (Phases 2–3 — Ticket Summary + Suggested Reply)

`client/src/features/ai-assistant/` — `useTicketAiSummary` and `useTicketAiSuggestedReply` (both `useMutation`; result in mutation state only, never the ticket query cache) drive an **AI Assistant** section in the internal Ticket Details sidebar (between "Follow ticket" and "Customer"). On-demand only: no AI request on page mount.

- **Summarize Ticket** — idle → pending (`role="status"` + skeleton) → structured summary (Issue / Timeline / Current State / Recommended Next Action) + **Regenerate** → error (`role="alert"` mapped message + **Retry**).
- **Suggest Reply** — idle → pending ("Generating reply…" + skeleton) → draft in a read-only block + **Insert into Reply** / **Regenerate** → error + **Retry**. The two actions are independent (a reply error never clears a rendered summary). Regenerate re-runs the action only; it never touches the composer, mutates the ticket, persists, or notifies.
- **Insert into Reply** bridges to the existing public reply composer via a two-method imperative handle on `TicketConversation` (`hasReplyText`, `insertSuggestedReply(text, "cursor" | "replace")`). One canonical caret-aware splice (`reply-insertion.ts` `spliceReply`) is shared with the Quick Reply picker. Empty composer → insert at cursor directly. Non-empty composer → an inline choice (Insert at cursor / Replace reply / Cancel); nothing changes without an explicit choice. Over `MAX_PUBLIC_REPLY_LENGTH` (20 000) → non-destructive "nothing was inserted" alert, draft preserved. Inserting focuses the composer (explicit user action); AI completion itself never moves focus. Sending stays entirely on the existing Send Reply button.
- **Suggest Category** — idle → pending ("Analyzing category…") → suggestion: category name + `AI confidence: High|Medium|Low` (bucketed from the numeric score — **High ≥ 0.75, Medium ≥ 0.45, Low < 0.45** — advisory, shown as text not colour) + reason + **Apply Category** / **Regenerate**. **Apply Category** goes through the normal `useUpdateTicket` mutation (`{ categoryId }`) — RBAC + cache refresh handled there; the AI endpoint never changes the category. Apply is shown only when the current user may edit the category (`canManage`) and the suggestion differs from the current category; if it already matches, a "already uses the suggested category" line replaces Apply. `AI_NO_CANDIDATES` (zero active categories) → a friendly line, no Retry.
- **Find Solution** (KB suggestions) — idle → pending ("Finding solutions…") → **Suggested Solutions**: a compact ≤5-row list, each with the article title, a short reason, a relevance label (`High|Medium|Low relevance`, same bucketing as confidence, via the shared `scoreLevel` helper), and **Open Article** — a router `<Link>` to the existing internal `/knowledge-base/:id` route (no duplicate viewer, no modal). An empty `articles` array (no DB candidates, or the AI found none useful) → a normal muted "No relevant articles found" line, **not an error**, Regenerate still available. Article ids never render as visible text. **Insert into Reply is deliberately not offered for KB** — the internal KB route is role-guarded and there is no customer-safe absolute article URL (see ADR-034 Phase 5). No vector search (MVP): keyword `contains` retrieval + AI re-ranking; future upgrade = embeddings / pgvector / RAG.
- `AI_NOT_CONFIGURED` (from any action) renders a dedicated "unavailable" panel. No `/capabilities` endpoint — the panel shows for internal roles and swaps to unavailable on `503`. The three actions keep independent state (one error never clears another's result).

### Status

Phases 1–6 implemented on `feature/ai-assistant`, uncommitted, automated-verified only (server suite **481**, client suite **510/510**, i18n **902/902**). Phase 1 = foundation + shared backend module + all four server actions. Phase 2 = action-specific context minimization + strict `locale` + Ticket Summary UI. Phase 3 = Suggested Reply UI + "Insert into Reply". Phase 4 = Suggested Category UI + "Apply Category" (via `useUpdateTicket`). Phase 5 = KB Suggestions UI + "Open Article" (existing internal KB route; KB→reply insertion deferred). Phase 6 = hardening/security audit (unknown-provider no longer crashes startup, prompt delimiter-neutralization, added regression coverage). No `AiInteraction` persistence in the MVP. No live OpenRouter call performed yet (no local key) — a real-key browser pass is the remaining developer step before commit.
