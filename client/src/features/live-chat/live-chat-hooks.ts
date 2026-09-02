import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalKeys } from "@/features/portal/portal-hooks";
import { replyPortalTicket } from "@/features/portal/portal-api";
import * as api from "./live-chat-api";
import type { LiveChat } from "./live-chat.types";

export const liveChatKeys = {
  /** The resume-or-null bootstrap query. */
  root: ["portal", "live-chat"] as const,
};

/**
 * The Live Chat bootstrap: the customer's resumable LIVE_CHAT ticket, or `null`.
 * Once a chat exists the page also subscribes to `usePortalTicket(chat.id)` for
 * the canonical message history — that key is what realtime invalidates, so the
 * conversation stays live and the database stays authoritative.
 */
export const useLiveChat = () =>
  useQuery({ queryKey: liveChatKeys.root, queryFn: api.getLiveChat, retry: false });

export function useStartLiveChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.startLiveChat,
    onSuccess: async (chat: LiveChat) => {
      qc.setQueryData(liveChatKeys.root, chat);
      await Promise.all([
        qc.invalidateQueries({ queryKey: portalKeys.ticket(chat.id) }),
        qc.invalidateQueries({ queryKey: portalKeys.tickets() }),
        qc.invalidateQueries({ queryKey: portalKeys.overview }),
      ]);
    },
  });
}

/**
 * Send a customer message on the live chat. Reuses the canonical portal reply
 * endpoint (`POST /portal/tickets/:id/messages`) — no live-chat-specific message
 * path. Refetches the canonical history + the bootstrap after the write commits.
 */
export function useSendLiveChatMessage(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => replyPortalTicket({ id: ticketId, body }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: portalKeys.ticket(ticketId) }),
        qc.invalidateQueries({ queryKey: liveChatKeys.root }),
        qc.invalidateQueries({ queryKey: portalKeys.overview }),
      ]);
    },
  });
}
