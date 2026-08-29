import { useMutation } from "@tanstack/react-query";
import {
  requestTicketClassification,
  requestTicketKbSuggestions,
  requestTicketSuggestedReply,
  requestTicketSummary,
} from "./ai-assistant-api";
import type {
  AiCategorySuggestionResponse,
  AiKbSuggestionsResponse,
  AiLocale,
  AiSuggestedReplyResponse,
  AiSummaryResponse,
} from "./ai-assistant.types";

/**
 * User-triggered ticket summary. It is a mutation, not a query — the result lives
 * in mutation state only and is never written into the ticket query cache, so a
 * summary can never be mistaken for persisted ticket data. Calling `mutate()`
 * again (Regenerate) simply re-runs SUMMARY; it triggers no ticket mutation,
 * invalidation, or notification.
 */
export function useTicketAiSummary(ticketId: string, locale?: AiLocale) {
  return useMutation<AiSummaryResponse, unknown, void>({
    mutationKey: ["ai", "summary", ticketId],
    mutationFn: () => requestTicketSummary(ticketId, locale),
  });
}

/**
 * User-triggered customer-facing draft reply. Same contract as the summary hook:
 * result stays in mutation state, never the ticket query cache; generating or
 * regenerating it triggers no ticket mutation, invalidation, message, or
 * notification. Inserting the draft is a separate explicit user action.
 */
export function useTicketAiSuggestedReply(ticketId: string) {
  return useMutation<AiSuggestedReplyResponse, unknown, void>({
    mutationKey: ["ai", "suggested-reply", ticketId],
    mutationFn: () => requestTicketSuggestedReply(ticketId),
  });
}

/**
 * User-triggered category suggestion. Result stays in mutation state; it never
 * writes the ticket query cache and never applies the category. Applying is a
 * separate explicit action through the normal ticket-update mutation.
 */
export function useTicketAiClassification(ticketId: string) {
  return useMutation<AiCategorySuggestionResponse, unknown, void>({
    mutationKey: ["ai", "classification", ticketId],
    mutationFn: () => requestTicketClassification(ticketId),
  });
}

/**
 * User-triggered KB suggestions. Result stays in mutation state; it never writes
 * the ticket query cache. Opening an article is normal router navigation.
 */
export function useTicketAiKbSuggestions(ticketId: string) {
  return useMutation<AiKbSuggestionsResponse, unknown, void>({
    mutationKey: ["ai", "kb-suggestions", ticketId],
    mutationFn: () => requestTicketKbSuggestions(ticketId),
  });
}
