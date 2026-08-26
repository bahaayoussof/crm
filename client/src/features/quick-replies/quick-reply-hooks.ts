import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createQuickReply, deleteQuickReply, getQuickReplies, getQuickReply, updateQuickReply } from "./quick-reply-api";
import type { QuickReplyFormValues } from "./quick-reply.schemas";
import type { QuickReplyFilters } from "./quick-reply.types";

export const quickReplyKeys = {
  all: ["quick-replies"] as const,
  lists: () => [...quickReplyKeys.all, "list"] as const,
  list: (filters: QuickReplyFilters) => [...quickReplyKeys.lists(), filters] as const,
  details: () => [...quickReplyKeys.all, "detail"] as const,
  detail: (id: string) => [...quickReplyKeys.details(), id] as const,
};

export const useQuickReplies = (filters: QuickReplyFilters, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: quickReplyKeys.list(filters),
    queryFn: () => getQuickReplies(filters),
    enabled: options?.enabled ?? true,
  });

export const useQuickReply = (id: string) =>
  useQuery({ queryKey: quickReplyKeys.detail(id), queryFn: () => getQuickReply(id), enabled: Boolean(id), retry: false });

function useInvalidateQuickReplies() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: quickReplyKeys.all });
}

export function useCreateQuickReply() {
  const invalidate = useInvalidateQuickReplies();
  return useMutation({ mutationFn: createQuickReply, onSuccess: () => invalidate() });
}

export function useUpdateQuickReply(id: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateQuickReplies();
  return useMutation({
    mutationFn: (values: QuickReplyFormValues) => updateQuickReply(id, values),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: quickReplyKeys.detail(id) }),
        invalidate(),
      ]);
    },
  });
}

export function useDeleteQuickReply() {
  const invalidate = useInvalidateQuickReplies();
  return useMutation({ mutationFn: deleteQuickReply, onSuccess: () => invalidate() });
}
