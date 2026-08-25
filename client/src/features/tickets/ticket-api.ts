import { apiClient } from "@/services/api-client";
import type { AgentOption, TicketCategory, TicketCreateValues, TicketDetail, TicketFilters, TicketListItem, TicketListResponse, TicketUpdateValues } from "./ticket.types";

export async function getTickets(filters: TicketFilters) { return (await apiClient.get<TicketListResponse>("/tickets", { params: filters })).data; }
export async function getTicket(id: string) { return (await apiClient.get<{ data: TicketDetail }>(`/tickets/${id}`)).data.data; }
export async function createTicket(values: TicketCreateValues) { return (await apiClient.post<{ data: TicketListItem }>("/tickets", values)).data.data; }
export async function updateTicket(id: string, values: TicketUpdateValues) { return (await apiClient.patch<{ data: TicketListItem }>(`/tickets/${id}`, values)).data.data; }
export async function getCategories() { return (await apiClient.get<{ data: TicketCategory[] }>("/categories")).data.data; }
export async function getAgents() { return (await apiClient.get<{ data: AgentOption[] }>("/users/agents")).data.data; }
