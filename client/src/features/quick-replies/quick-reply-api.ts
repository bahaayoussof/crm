import { apiClient } from "@/services/api-client";
import type { ApiEnvelope } from "@/features/auth/auth.types";
import type { QuickReplyFormValues } from "./quick-reply.schemas";
import type { QuickReply, QuickReplyFilters, QuickReplyListResponse } from "./quick-reply.types";

function toPayload(values: QuickReplyFormValues) {
  return { title: values.title.trim(), body: values.body.trim() };
}

export async function getQuickReplies(filters: QuickReplyFilters) {
  const response = await apiClient.get<QuickReplyListResponse>("/quick-replies", { params: filters });
  return response.data;
}

export async function getQuickReply(id: string) {
  const response = await apiClient.get<ApiEnvelope<QuickReply>>(`/quick-replies/${id}`);
  return response.data.data;
}

export async function createQuickReply(values: QuickReplyFormValues) {
  const response = await apiClient.post<ApiEnvelope<QuickReply>>("/quick-replies", toPayload(values));
  return response.data.data;
}

export async function updateQuickReply(id: string, values: QuickReplyFormValues) {
  const response = await apiClient.patch<ApiEnvelope<QuickReply>>(`/quick-replies/${id}`, toPayload(values));
  return response.data.data;
}

export async function deleteQuickReply(id: string) {
  await apiClient.delete(`/quick-replies/${id}`);
}
