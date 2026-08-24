import type { AuthUser } from "./auth.types";

export type ProtectedAudience = "internal" | "customer";
export const getRoleHome = (role: AuthUser["role"]) => role === "CUSTOMER" ? "/portal" : "/dashboard";

export function getProtectedRedirect(user: AuthUser | null, audience: ProtectedAudience) {
  if (!user) return "/login";
  if (audience === "customer" && user.role !== "CUSTOMER") return "/dashboard";
  if (audience === "internal" && user.role === "CUSTOMER") return "/portal";
  return null;
}
