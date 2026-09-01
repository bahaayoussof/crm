import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTicket, createTicketMessage, createTicketNote, getAgents, getCategories, getTicket, getTickets, updateTicket } from "./ticket-api";
import type { TicketConversationValues, TicketCreateValues, TicketFilters, TicketUpdateValues } from "./ticket.types";

export const ticketKeys = {
  all: ["tickets"] as const,
  lists: () => [...ticketKeys.all, "list"] as const,
  list: (filters: TicketFilters) => [...ticketKeys.lists(), filters] as const,
  details: () => [...ticketKeys.all, "detail"] as const,
  detail: (id: string) => [...ticketKeys.details(), id] as const,
  categories: ["categories", "active"] as const,
  agents: ["users", "agents"] as const,
};
export const useTickets = (filters: TicketFilters) => useQuery({ queryKey: ticketKeys.list(filters), queryFn: () => getTickets(filters) });
export const useTicket = (id: string) => useQuery({ queryKey: ticketKeys.detail(id), queryFn: () => getTicket(id), enabled: Boolean(id), retry: false });
export const useCategories = () => useQuery({ queryKey: ticketKeys.categories, queryFn: getCategories });
export const useAgents = () => useQuery({ queryKey: ticketKeys.agents, queryFn: getAgents });
export function useCreateTicket() { const client = useQueryClient(); return useMutation({ mutationFn: (values: TicketCreateValues) => createTicket(values), onSuccess: () => client.invalidateQueries({ queryKey: ticketKeys.lists() }) }); }
/** Agent self-claim of an unassigned ticket from a list row. The backend
 * enforces "unassigned only" + "self only" atomically (409 on a lost race). */
export function useClaimTicket() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, agentId }: { id: string; agentId: string }) => updateTicket(id, { assignedAgentId: agentId }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ticketKeys.lists() }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
}
export function useUpdateTicket(id: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (values: TicketUpdateValues) => updateTicket(id, values), onSuccess: async () => {
    await Promise.all([client.invalidateQueries({ queryKey: ticketKeys.detail(id) }), client.invalidateQueries({ queryKey: ticketKeys.lists() }), client.invalidateQueries({ queryKey: ["dashboard"] }), client.invalidateQueries({ queryKey: ["customers"] })]);
  } });
}
function useConversationMutation(id: string, mutationFn: (id: string, values: TicketConversationValues) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (values: TicketConversationValues) => mutationFn(id, values), onSuccess: async () => {
    await Promise.all([client.invalidateQueries({ queryKey: ticketKeys.detail(id) }), client.invalidateQueries({ queryKey: ticketKeys.lists() })]);
  } });
}
export const useCreateTicketMessage = (id: string) => useConversationMutation(id, createTicketMessage);
export const useCreateTicketNote = (id: string) => useConversationMutation(id, createTicketNote);
