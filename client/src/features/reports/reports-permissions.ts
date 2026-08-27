import type { Role } from "@/features/auth/auth.types";

export function canViewReports(role: Role) {
  return role === "ADMIN" || role === "MANAGER";
}
