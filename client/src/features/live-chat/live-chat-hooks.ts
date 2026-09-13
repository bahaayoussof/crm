import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalKeys } from "@/features/portal/portal-hooks";
import { replyPortalTicket } from "@/features/portal/portal-api";
import * as api from "./live-chat-api";
import type { LiveChat } from "./live-chat.types";
import { rotateLiveChatSessionKey } from "./live-chat-session";

export const liveChatKeys = {
  /** The resume-or-null bootstrap query. */
  root: ["portal", "live-chat"] as const,
  /** Routable departments for the start screen. */
  departments: ["portal", "live-chat", "departments"] as const,
};

/**
 * The Live Chat bootstrap: the customer's resumable LIVE_CHAT ticket, or `null`.
 * Once a chat exists the page also subscribes to `usePortalTicket(chat.id)` for
 * the canonical message history — that key is what realtime invalidates, so the
 * conversation stays live and the database stays authoritative.
 */
export const useLiveChat = () =>
  useQuery({ queryKey: liveChatKeys.root, queryFn: api.getLiveChat, retry: false });

/**
 * Departments the customer may route a new live chat to. Only fetched on the
 * start screen (no resumable chat); the server already filters to active
 * departments that have an active team.
 */
export const useLiveChatDepartments = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: liveChatKeys.departments,
    queryFn: api.getLiveChatDepartments,
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });

/**
 * If the current session key already belongs to a RESOLVED/CLOSED chat, the
 * server rejects it with `409 LIVE_CHAT_SESSION_ENDED` (CONV-026) instead of
 * silently resuming the old ticket. The client rotates to a brand-new session
 * key and retries exactly once — that always starts a fresh chat.
 */
async function startLiveChatWithSessionRotation(departmentId?: string): Promise<LiveChat> {
  try {
    return await api.startLiveChat(departmentId);
  } catch (error) {
    const code = axios.isAxiosError(error) ? (error.response?.data?.error?.code as string | undefined) : undefined;
    if (code !== "LIVE_CHAT_SESSION_ENDED") throw error;
    rotateLiveChatSessionKey();
    return api.startLiveChat(departmentId);
  }
}

export function useStartLiveChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (departmentId?: string) => startLiveChatWithSessionRotation(departmentId),
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
 * End the current live chat (`active -> RESOLVED`). The server owns the
 * transition; realtime `ticket.updated` reaches the staff side. We seed the
 * canonical ticket cache with the resolved detail and refetch the portal
 * surfaces + the bootstrap (which then returns `null`, so the page falls back to
 * Department selection — a RESOLVED chat is never resumed).
 */
export function useEndLiveChat(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.endLiveChat(ticketId),
    onSuccess: async (chat: LiveChat) => {
      // The current session key now owns a terminal (RESOLVED) ticket — rotate
      // proactively so the next "start a new chat" doesn't need a 409 round trip.
      rotateLiveChatSessionKey();
      qc.setQueryData(portalKeys.ticket(ticketId), chat);
      await Promise.all([
        qc.invalidateQueries({ queryKey: portalKeys.ticket(ticketId) }),
        qc.invalidateQueries({ queryKey: liveChatKeys.root }),
        qc.invalidateQueries({ queryKey: portalKeys.overview }),
        qc.invalidateQueries({ queryKey: portalKeys.tickets() }),
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
