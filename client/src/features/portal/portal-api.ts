import { apiClient } from "@/services/api-client";
import type { ApiEnvelope } from "@/features/auth/auth.types";
import type { PortalCategory, PortalFilters, PortalMessage, PortalOverview, PortalTicket, PortalTicketDetail, PortalTicketPage } from "./portal.types";
export const getPortalOverview = async () => (await apiClient.get<ApiEnvelope<PortalOverview>>("/portal/overview")).data.data;
export const getPortalCategories = async () => (await apiClient.get<ApiEnvelope<PortalCategory[]>>("/portal/categories")).data.data;
export const getPortalTickets = async (filters: PortalFilters) => (await apiClient.get<PortalTicketPage>("/portal/tickets", { params: filters })).data;
export const getPortalTicket = async (id: string) => (await apiClient.get<ApiEnvelope<PortalTicketDetail>>(`/portal/tickets/${id}`)).data.data;
export const createPortalTicket = async (body: { subject: string; description: string; categoryId?: string | null }) => (await apiClient.post<ApiEnvelope<PortalTicket>>("/portal/tickets", body)).data.data;
export const replyPortalTicket = async ({ id, body }: { id: string; body: string }) => (await apiClient.post<ApiEnvelope<PortalMessage>>(`/portal/tickets/${id}/messages`, { body })).data.data;
