import type { ZodType } from "zod";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { TicketActor } from "../tickets/ticket-visibility.js";
import {
  buildTicketAiContext,
  RECENT_PUBLIC_MESSAGES,
  type AiContextOptions,
} from "./ai-context.service.js";
import type { AiLocale } from "./ai.schema.js";
import { listKbCandidates } from "./ai-kb-candidates.js";
import { AiNotConfiguredError, AiProviderError, getAiProvider } from "./ai-provider.js";
import {
  AI_JSON_SCHEMAS,
  aiClassificationSchema,
  aiKbSuggestionsSchema,
  aiSuggestedReplySchema,
  aiSummarySchema,
} from "./ai.schema.js";
import {
  AI_PROMPT_VERSION,
  buildClassificationPrompt,
  buildKbRankingPrompt,
  buildSuggestedReplyPrompt,
  buildSummaryPrompt,
} from "./ai-prompts.js";
import type { AiAction, AiProvider, AiTicketContext } from "./ai.types.js";

function resolveProvider(): AiProvider {
  try {
    return getAiProvider();
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      throw new AppError(503, "AI_NOT_CONFIGURED", "The AI assistant is not configured");
    }
    throw error;
  }
}

function providerErrorToAppError(error: AiProviderError): AppError {
  if (error.reason === "TIMEOUT") {
    return new AppError(504, "AI_TIMEOUT", "The AI request timed out");
  }
  if (error.reason === "RATE_LIMITED") {
    // Retryable: the provider is temporarily busy, not a hard generation failure.
    const retryAfterSeconds =
      typeof error.retryAfterSeconds === "number" && error.retryAfterSeconds > 0
        ? Math.ceil(error.retryAfterSeconds)
        : undefined;
    return new AppError(
      503,
      "AI_PROVIDER_RATE_LIMITED",
      "The AI provider is temporarily busy",
      retryAfterSeconds === undefined ? undefined : { retryAfterSeconds },
    );
  }
  return new AppError(502, "AI_GENERATION_FAILED", "The AI request could not be completed");
}

/** Zod-validate provider output. A shape mismatch is a normalized failure, never
 * passed through to the client. */
function parseOrFail<T>(schema: ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new AppError(502, "AI_GENERATION_FAILED", "The AI returned data in an unexpected format");
  }
  return result.data;
}

export interface AiActionResponse {
  action: AiAction;
  promptVersion: string;
  result: unknown;
}

export interface AiActionOptions {
  /** Output language for SUMMARY. Ignored by the other actions. */
  locale?: AiLocale;
}

/**
 * Per-action context minimization. SUMMARY / SUGGEST_REPLY may use internal notes
 * (SUGGEST_REPLY only inside the private, non-disclosable block); CLASSIFY and
 * KB_SUGGESTIONS never receive internal notes and only need the recent exchange.
 */
const CONTEXT_OPTIONS: Record<AiAction, AiContextOptions> = {
  SUMMARY: { internalNotes: "full" },
  SUGGEST_REPLY: { internalNotes: "full" },
  CLASSIFY: { internalNotes: "none", publicMessageLimit: RECENT_PUBLIC_MESSAGES },
  KB_SUGGESTIONS: { internalNotes: "none", publicMessageLimit: RECENT_PUBLIC_MESSAGES },
};

/**
 * Run one AI action for a ticket. The controller passes only `{ ticketId, action,
 * actor, options }`; every byte of AI context is assembled here from authorized
 * data, minimized per action.
 */
export async function runTicketAiAction(
  ticketId: string,
  action: AiAction,
  actor: TicketActor,
  options: AiActionOptions = {},
): Promise<AiActionResponse> {
  const provider = resolveProvider();
  const context = await buildTicketAiContext(ticketId, actor, CONTEXT_OPTIONS[action]);

  const startedAt = Date.now();
  let ok = false;
  try {
    const result = await dispatch(action, context, provider, options);
    ok = true;
    return { action, promptVersion: AI_PROMPT_VERSION, result };
  } catch (error) {
    if (error instanceof AiProviderError) {
      // Server-side diagnostic only — never the request body, prompt, or key.
      console.error(
        `[ai] provider error action=${action} ticket=${ticketId} reason=${error.reason}: ${error.message}`,
      );
      throw providerErrorToAppError(error);
    }
    throw error;
  } finally {
    console.info(
      `[ai] action=${action} ticket=${ticketId} user=${actor.userId} provider=${provider.name} model=${provider.model} latencyMs=${Date.now() - startedAt} ok=${ok}`,
    );
  }
}

async function dispatch(
  action: AiAction,
  context: AiTicketContext,
  provider: AiProvider,
  options: AiActionOptions,
): Promise<unknown> {
  switch (action) {
    case "SUMMARY": {
      const { system, prompt } = buildSummaryPrompt(context, { locale: options.locale });
      const raw = await provider.generateStructured({
        system,
        prompt,
        schema: AI_JSON_SCHEMAS.SUMMARY,
        schemaName: "ticket_summary",
      });
      return parseOrFail(aiSummarySchema, raw);
    }

    case "SUGGEST_REPLY": {
      const { system, prompt } = buildSuggestedReplyPrompt(context);
      const raw = await provider.generateStructured({
        system,
        prompt,
        schema: AI_JSON_SCHEMAS.SUGGEST_REPLY,
        schemaName: "suggested_reply",
      });
      return parseOrFail(aiSuggestedReplySchema, raw);
    }

    case "CLASSIFY": {
      const categories = await prisma.category.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
      if (categories.length === 0) {
        // Distinct from KB's normal "no matching articles" case: classification is
        // impossible with an empty candidate set and the schema requires a real
        // categoryId, so this is a genuine 422 rather than an empty result.
        throw new AppError(422, "AI_NO_CANDIDATES", "No categories are available to classify against");
      }
      const { system, prompt } = buildClassificationPrompt(context, categories);
      const raw = await provider.generateStructured({
        system,
        prompt,
        schema: AI_JSON_SCHEMAS.CLASSIFY,
        schemaName: "ticket_classification",
      });
      const parsed = parseOrFail(aiClassificationSchema, raw);
      // Re-validate the id against the server-owned list — schema shape passing is
      // not enough (the model may return a well-formed but invented id).
      const match = categories.find((category) => category.id === parsed.categoryId);
      if (!match) {
        throw new AppError(502, "AI_GENERATION_FAILED", "The AI returned an unknown category");
      }
      return {
        categoryId: match.id,
        categoryName: match.name, // trust the server list, not the model
        confidence: parsed.confidence,
        reason: parsed.reason,
      };
    }

    case "KB_SUGGESTIONS": {
      const candidates = await listKbCandidates(context);
      if (candidates.length === 0) return { articles: [] };
      const { system, prompt } = buildKbRankingPrompt(
        context,
        candidates.map((candidate) => ({
          id: candidate.id,
          title: candidate.title,
          excerpt: candidate.excerpt,
        })),
      );
      const raw = await provider.generateStructured({
        system,
        prompt,
        schema: AI_JSON_SCHEMAS.KB_SUGGESTIONS,
        schemaName: "kb_suggestions",
      });
      const parsed = parseOrFail(aiKbSuggestionsSchema, raw);
      const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      // Drop any id not in the candidate list; re-attach title/excerpt from the
      // server record so invented titles/content can never reach the client.
      const articles = parsed.articles
        .filter((article) => byId.has(article.id))
        .map((article) => {
          const candidate = byId.get(article.id)!;
          return {
            id: candidate.id,
            title: candidate.title,
            excerpt: candidate.excerpt,
            relevance: article.relevance,
            reason: article.reason,
          };
        });
      return { articles };
    }

    default: {
      const exhaustive: never = action;
      throw new AppError(400, "AI_INVALID_ACTION", `Unsupported AI action: ${String(exhaustive)}`);
    }
  }
}
