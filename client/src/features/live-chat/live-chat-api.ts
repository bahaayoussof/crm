import { apiClient } from "@/services/api-client";
import type { ApiEnvelope } from "@/features/auth/auth.types";
import type { LiveChat, LiveChatBootstrap, LiveChatDepartment } from "./live-chat.types";
import { getLiveChatSessionKey } from "./live-chat-session";

/** The live chat owned by this browser session's key, or `null`. */
export const getLiveChat = async (): Promise<LiveChatBootstrap> =>
  (await apiClient.get<ApiEnvelope<LiveChatBootstrap>>("/portal/live-chat", { params: { sessionKey: getLiveChatSessionKey() } })).data.data;

/** Departments the customer may route a new live chat to (active + has an active team). */
export const getLiveChatDepartments = async (): Promise<LiveChatDepartment[]> =>
  (await apiClient.get<ApiEnvelope<LiveChatDepartment[]>>("/portal/live-chat/departments")).data.data;

/**
 * Resume the chat owned by the current session key, or start a new one routed
 * to `departmentId`. Always sends the opaque `sessionKey` — the server never
 * selects a ticket by customer identity alone (CONV-026).
 */
export const startLiveChat = async (departmentId?: string): Promise<LiveChat> =>
  (await apiClient.post<ApiEnvelope<LiveChat>>("/portal/live-chat", { departmentId, sessionKey: getLiveChatSessionKey() })).data.data;

/**
 * End an active live chat (`active -> RESOLVED`). The body is empty — the server
 * owns the transition. Returns the resolved chat detail.
 */
export const endLiveChat = async (ticketId: string): Promise<LiveChat> =>
  (await apiClient.post<ApiEnvelope<LiveChat>>(`/portal/live-chat/${ticketId}/end`)).data.data;
