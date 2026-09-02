import { useMutation, useQueryClient } from "@tanstack/react-query";
import { portalKeys } from "@/features/portal/portal-hooks";
import * as api from "./customer-ai-api";
export const useCustomerAiChat = () => useMutation({ mutationFn: api.chatWithCustomerAi });
export function useCustomerAiHandoff() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: api.handoffCustomerAi, onSuccess: async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: portalKeys.overview }), queryClient.invalidateQueries({ queryKey: portalKeys.tickets() })]);
  }});
}
