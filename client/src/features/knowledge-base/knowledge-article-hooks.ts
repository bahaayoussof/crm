import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalKeys } from "@/features/portal/portal-hooks";
import { createKnowledgeArticle, deleteKnowledgeArticle, getKnowledgeArticle, getKnowledgeArticles, updateKnowledgeArticle } from "./knowledge-article-api";
import type { KnowledgeArticleFormValues } from "./knowledge-article.schemas";
import type { KnowledgeArticleFilters } from "./knowledge-article.types";

export const knowledgeArticleKeys = {
  all: ["knowledge-articles"] as const,
  lists: () => [...knowledgeArticleKeys.all, "list"] as const,
  list: (filters: KnowledgeArticleFilters) => [...knowledgeArticleKeys.lists(), filters] as const,
  details: () => [...knowledgeArticleKeys.all, "detail"] as const,
  detail: (id: string) => [...knowledgeArticleKeys.details(), id] as const,
};

export const useKnowledgeArticles = (filters: KnowledgeArticleFilters) =>
  useQuery({ queryKey: knowledgeArticleKeys.list(filters), queryFn: () => getKnowledgeArticles(filters) });

export const useKnowledgeArticle = (id: string) =>
  useQuery({ queryKey: knowledgeArticleKeys.detail(id), queryFn: () => getKnowledgeArticle(id), enabled: Boolean(id), retry: false });

function useInvalidateKnowledgeArticles() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: knowledgeArticleKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: knowledgeArticleKeys.details() }),
    queryClient.invalidateQueries({ queryKey: portalKeys.knowledgeArticles() }),
  ]);
}

export function useCreateKnowledgeArticle() {
  const invalidate = useInvalidateKnowledgeArticles();
  return useMutation({ mutationFn: createKnowledgeArticle, onSuccess: () => invalidate() });
}

export function useUpdateKnowledgeArticle(id: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateKnowledgeArticles();
  return useMutation({
    mutationFn: (values: KnowledgeArticleFormValues) => updateKnowledgeArticle(id, values),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: knowledgeArticleKeys.detail(id) }),
        invalidate(),
      ]);
    },
  });
}

export function useDeleteKnowledgeArticle() {
  const invalidate = useInvalidateKnowledgeArticles();
  return useMutation({ mutationFn: deleteKnowledgeArticle, onSuccess: () => invalidate() });
}
