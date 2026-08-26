import type { Role } from "@/features/auth/auth.types";

export function canManageQuickReplies(role: Role) {
  return role === "ADMIN" || role === "MANAGER";
}
