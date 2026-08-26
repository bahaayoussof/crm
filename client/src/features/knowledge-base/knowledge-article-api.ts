import { apiClient } from "@/services/api-client";
import type { ApiEnvelope } from "@/features/auth/auth.types";
import type { KnowledgeArticleFormValues } from "./knowledge-article.schemas";
import type { KnowledgeArticleDetail, KnowledgeArticleFilters, KnowledgeArticleListResponse } from "./knowledge-article.types";

function toPayload(values: KnowledgeArticleFormValues) {
  const category = values.category.trim();
  return { title: values.title.trim(), content: values.content.trim(), status: values.status, category: category ? category : null };
}

export async function getKnowledgeArticles(filters: KnowledgeArticleFilters) {
  const response = await apiClient.get<KnowledgeArticleListResponse>("/knowledge-articles", { params: filters });
  return response.data;
}

export async function getKnowledgeArticle(id: string) {
  const response = await apiClient.get<ApiEnvelope<KnowledgeArticleDetail>>(`/knowledge-articles/${id}`);
  return response.data.data;
}

export async function createKnowledgeArticle(values: KnowledgeArticleFormValues) {
  const response = await apiClient.post<ApiEnvelope<KnowledgeArticleDetail>>("/knowledge-articles", toPayload(values));
  return response.data.data;
}

export async function updateKnowledgeArticle(id: string, values: KnowledgeArticleFormValues) {
  const response = await apiClient.patch<ApiEnvelope<KnowledgeArticleDetail>>(`/knowledge-articles/${id}`, toPayload(values));
  return response.data.data;
}

export async function deleteKnowledgeArticle(id: string) {
  await apiClient.delete(`/knowledge-articles/${id}`);
}
