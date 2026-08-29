import { apiClient } from "@/services/api-client";
import type {
  AiCategorySuggestionResponse,
  AiKbSuggestionsResponse,
  AiLocale,
  AiSuggestedReplyResponse,
  AiSummaryResponse,
} from "./ai-assistant.types";

/**
 * Request an on-demand ticket summary. The client sends only the action (+ an
 * optional strict locale) — the backend builds all AI context itself.
 */
export async function requestTicketSummary(ticketId: string, locale?: AiLocale) {
  return (
    await apiClient.post<{ data: AiSummaryResponse }>(`/tickets/${ticketId}/ai`, {
      action: "SUMMARY",
      ...(locale ? { locale } : {}),
    })
  ).data.data;
}

/**
 * Request an on-demand customer-facing draft reply. Body is just the action —
 * no conversation, notes, customer object, locale, or free-form text. The reply
 * language is decided server-side from the customer's own messages.
 */
export async function requestTicketSuggestedReply(ticketId: string) {
  return (
    await apiClient.post<{ data: AiSuggestedReplyResponse }>(`/tickets/${ticketId}/ai`, {
      action: "SUGGEST_REPLY",
    })
  ).data.data;
}

/**
 * Request an on-demand category suggestion. The backend loads the active-category
 * candidate list itself and re-validates the returned id against it; the client
 * sends only the action.
 */
export async function requestTicketClassification(ticketId: string) {
  return (
    await apiClient.post<{ data: AiCategorySuggestionResponse }>(`/tickets/${ticketId}/ai`, {
      action: "CLASSIFY",
    })
  ).data.data;
}

/**
 * Request ranked Knowledge Base suggestions. The backend retrieves the PUBLISHED
 * candidate articles itself and filters the AI's returned ids against them; the
 * client sends only the action.
 */
export async function requestTicketKbSuggestions(ticketId: string) {
  return (
    await apiClient.post<{ data: AiKbSuggestionsResponse }>(`/tickets/${ticketId}/ai`, {
      action: "KB_SUGGESTIONS",
    })
  ).data.data;
}
