import { apiClient } from "@/services/api-client";
import type { ApiEnvelope } from "@/features/auth/auth.types";
import type { PortalTicket } from "@/features/portal/portal.types";
import type { CustomerAiMessage, CustomerAiResponse } from "./customer-ai.types";

export const chatWithCustomerAi = async (input: { message: string; history: CustomerAiMessage[]; locale: "en" | "ar" }) =>
  (await apiClient.post<ApiEnvelope<CustomerAiResponse>>("/portal/ai/chat", input)).data.data;
export const handoffCustomerAi = async (input: { message: string; history: CustomerAiMessage[] }) =>
  (await apiClient.post<ApiEnvelope<PortalTicket>>("/portal/ai/handoff", input)).data.data;
