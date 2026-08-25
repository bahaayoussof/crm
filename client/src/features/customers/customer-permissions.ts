import type { Role } from "@/features/auth/auth.types";

export function canManageCustomers(role: Role) {
  return role === "ADMIN" || role === "MANAGER";
}
