import { apiClient } from "@/services/api-client";
import type { AgentOption, TicketCategory, TicketConversationItem, TicketConversationValues, TicketCreateValues, TicketDetail, TicketFilters, TicketListItem, TicketListResponse, TicketMessageResult, TicketUpdateValues } from "./ticket.types";

export async function getTickets(filters: TicketFilters) { return (await apiClient.get<TicketListResponse>("/tickets", { params: filters })).data; }
export async function getTicket(id: string) { return (await apiClient.get<{ data: TicketDetail }>(`/tickets/${id}`)).data.data; }
export async function createTicket(values: TicketCreateValues) { return (await apiClient.post<{ data: TicketListItem }>("/tickets", values)).data.data; }
export async function updateTicket(id: string, values: TicketUpdateValues) { return (await apiClient.patch<{ data: TicketListItem }>(`/tickets/${id}`, values)).data.data; }
export async function getCategories() { return (await apiClient.get<{ data: TicketCategory[] }>("/categories")).data.data; }
export async function getAgents(teamId?: string) {
  return (
    await apiClient.get<{ data: AgentOption[] }>("/users/agents", { params: teamId ? { teamId } : undefined })
  ).data.data;
}
export async function createTicketMessage(id: string, values: TicketConversationValues) { return (await apiClient.post<{ data: TicketMessageResult }>(`/tickets/${id}/messages`, values)).data.data; }
export async function createTicketNote(id: string, values: TicketConversationValues) { return (await apiClient.post<{ data: TicketConversationItem }>(`/tickets/${id}/notes`, values)).data.data; }
