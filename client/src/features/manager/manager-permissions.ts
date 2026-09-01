import type { Role } from "@/features/auth/auth.types";

/**
 * The Manager Work Console is MANAGER's primary experience. ADMIN keeps its own
 * dashboard but may still open the console for supervision/QA — mirrors how
 * `canViewReports` gates the nav item while `ReportsRoute` admits both roles.
 *
 * Frontend gating is presentation only. `/api/manager/*` enforces
 * `requireRole(ADMIN, MANAGER)` server-side and is the real boundary.
 */
export function canUseManagerConsole(role: Role): boolean {
  return role === "MANAGER" || role === "ADMIN";
}

/** Managers land on the console instead of the shared `/dashboard`. */
export function isManagerHomeRole(role: Role): boolean {
  return role === "MANAGER";
}
