import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ticketKeys } from "@/features/tickets/ticket-hooks";
import { getMentionableUsers, getTicketWatchers, unwatchTicket, watchTicket } from "./collaboration-api";

export const collaborationKeys = {
  all: ["collaboration"] as const,
  mentionable: (search: string) => [...collaborationKeys.all, "mentionable", search] as const,
  watchers: (ticketId: string) => [...collaborationKeys.all, "watchers", ticketId] as const,
};

export function useMentionableUsers(search: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: collaborationKeys.mentionable(search),
    queryFn: () => getMentionableUsers(search),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useTicketWatchers(ticketId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: collaborationKeys.watchers(ticketId),
    queryFn: () => getTicketWatchers(ticketId),
    enabled: (options?.enabled ?? true) && Boolean(ticketId),
  });
}

function useWatchMutation(ticketId: string, mutationFn: (id: string) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => mutationFn(ticketId),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ticketKeys.detail(ticketId) }),
        client.invalidateQueries({ queryKey: collaborationKeys.watchers(ticketId) }),
      ]);
    },
  });
}

export const useWatchTicket = (ticketId: string) => useWatchMutation(ticketId, watchTicket);
export const useUnwatchTicket = (ticketId: string) => useWatchMutation(ticketId, unwatchTicket);
