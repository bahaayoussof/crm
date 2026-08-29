// feature/ai-assistant — internal agent-assistance. Phase 2: Ticket Summary only.

export type AiSummaryResult = {
  issue: string;
  timeline: string[];
  currentState: string;
  recommendedNextAction: string;
};

export type AiActionResponse<T = unknown> = {
  action: "SUMMARY" | "SUGGEST_REPLY" | "CLASSIFY" | "KB_SUGGESTIONS";
  promptVersion: string;
  result: T;
};

export type AiSummaryResponse = AiActionResponse<AiSummaryResult>;

export type AiSuggestedReplyResult = {
  reply: string;
};

export type AiSuggestedReplyResponse = AiActionResponse<AiSuggestedReplyResult>;

export type AiCategorySuggestionResult = {
  categoryId: string;
  categoryName: string;
  confidence: number;
  reason: string;
};

export type AiCategorySuggestionResponse = AiActionResponse<AiCategorySuggestionResult>;

export type AiKbSuggestion = {
  id: string;
  title: string;
  excerpt: string;
  relevance: number;
  reason: string;
};

export type AiKbSuggestionsResult = {
  articles: AiKbSuggestion[];
};

export type AiKbSuggestionsResponse = AiActionResponse<AiKbSuggestionsResult>;

/**
 * Narrow adapter the AI panel uses to apply a suggested category. Backed by the
 * normal ticket-update mutation — the AI feature never issues its own update.
 */
export type CategoryApplyApi = {
  apply: (categoryId: string) => Promise<unknown>;
};

/** Strict output-language enum accepted by the backend (never a free-form hint). */
export type AiLocale = "en" | "ar";

export type ReplyInsertMode = "cursor" | "replace";
export type ReplyInsertOutcome = "inserted" | "too-long" | "unavailable";

/**
 * The minimal bridge the AI panel uses to push a draft into the existing public
 * reply composer. Backed by `TicketWorkspaceHandle` — the panel never touches
 * the composer's DOM or internal state.
 */
export type ReplyInsertionApi = {
  hasReplyText: () => boolean;
  insertSuggestedReply: (text: string, mode: ReplyInsertMode) => ReplyInsertOutcome;
};
