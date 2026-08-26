import type { Role } from "@/features/auth/auth.types";

export interface QuickReplyAuthor {
  id: string;
  name: string;
  role: Role;
}

export interface QuickReply {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  createdBy: QuickReplyAuthor;
}

export interface QuickReplyFilters {
  page: number;
  limit: number;
  search: string;
}

export interface QuickReplyListResponse {
  data: QuickReply[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
