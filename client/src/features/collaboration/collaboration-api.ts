import { apiClient } from "@/services/api-client";
import type { MentionableUser, TicketWatcher, WatchState } from "./collaboration.types";

export async function getMentionableUsers(search: string) {
  return (
    await apiClient.get<{ data: MentionableUser[] }>("/users/mentionable", {
      params: search ? { search } : undefined,
    })
  ).data.data;
}

export async function getTicketWatchers(ticketId: string) {
  return (await apiClient.get<{ data: TicketWatcher[] }>(`/tickets/${ticketId}/watchers`)).data.data;
}

export async function watchTicket(ticketId: string) {
  return (await apiClient.post<{ data: WatchState }>(`/tickets/${ticketId}/watchers`)).data.data;
}

export async function unwatchTicket(ticketId: string) {
  return (await apiClient.delete<{ data: WatchState }>(`/tickets/${ticketId}/watchers/me`)).data.data;
}
