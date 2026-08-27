import type { Role } from "@/features/auth/auth.types";

// docs/18 §15 — user administration is ADMIN only; MANAGER access is not granted.
export function canManageUsers(role: Role) {
  return role === "ADMIN";
}
