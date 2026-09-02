import { apiClient } from "@/services/api-client";
import type { ApiEnvelope } from "@/features/auth/auth.types";
import type { LiveChat, LiveChatBootstrap } from "./live-chat.types";

/** Resumable live chat for the authenticated customer, or `null`. */
export const getLiveChat = async (): Promise<LiveChatBootstrap> =>
  (await apiClient.get<ApiEnvelope<LiveChatBootstrap>>("/portal/live-chat")).data.data;

/** Resume the active live chat or start a new one. Always returns the chat. */
export const startLiveChat = async (): Promise<LiveChat> =>
  (await apiClient.post<ApiEnvelope<LiveChat>>("/portal/live-chat", {})).data.data;
