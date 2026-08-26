import type { Role } from "@/features/auth/auth.types";

export function canManageKnowledgeArticles(role: Role) {
  return role === "ADMIN" || role === "MANAGER";
}
