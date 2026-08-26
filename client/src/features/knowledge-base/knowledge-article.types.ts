import type { Role } from "@/features/auth/auth.types";

export type KnowledgeArticleStatus = "DRAFT" | "PUBLISHED";

export interface KnowledgeArticleAuthor {
  id: string;
  name: string;
  role: Role;
}

export interface KnowledgeArticleListItem {
  id: string;
  title: string;
  category: string | null;
  status: KnowledgeArticleStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: KnowledgeArticleAuthor;
}

export interface KnowledgeArticleDetail extends KnowledgeArticleListItem {
  content: string;
}

export interface KnowledgeArticleFilters {
  page: number;
  limit: number;
  search: string;
  status?: KnowledgeArticleStatus;
  category?: string;
}

export interface KnowledgeArticleListResponse {
  data: KnowledgeArticleListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
