import { apiClient } from "@/services/api-client";
import type { ApiEnvelope } from "@/features/auth/auth.types";
import type { LiveChat, LiveChatBootstrap, LiveChatDepartment } from "./live-chat.types";

/** Resumable live chat for the authenticated customer, or `null`. */
export const getLiveChat = async (): Promise<LiveChatBootstrap> =>
  (await apiClient.get<ApiEnvelope<LiveChatBootstrap>>("/portal/live-chat")).data.data;

/** Departments the customer may route a new live chat to (active + has an active team). */
export const getLiveChatDepartments = async (): Promise<LiveChatDepartment[]> =>
  (await apiClient.get<ApiEnvelope<LiveChatDepartment[]>>("/portal/live-chat/departments")).data.data;

/**
 * Resume the active live chat, or start a new one routed to `departmentId`.
 * Always returns the chat.
 */
export const startLiveChat = async (departmentId: string): Promise<LiveChat> =>
  (await apiClient.post<ApiEnvelope<LiveChat>>("/portal/live-chat", { departmentId })).data.data;
