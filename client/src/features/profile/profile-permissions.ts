import type { Role } from "@/features/auth/auth.types";

export interface ProfileEditPermissions {
  canEditName: boolean;
  canEditEmail: boolean;
  canEditPhone: boolean;
  isRestricted: boolean;
}

/**
 * Single source of truth for client-side profile edit capabilities.
 * - ADMIN / CUSTOMER: can edit name, email, phone (full edit dialog)
 * - MANAGER / AGENT: can edit phone only (presentation-only name/email rows, edit-phone dialog)
 */
export function getProfileEditPermissions(role: Role): ProfileEditPermissions {
  switch (role) {
    case "ADMIN":
    case "CUSTOMER":
      return {
        canEditName: true,
        canEditEmail: true,
        canEditPhone: true,
        isRestricted: false,
      };
    case "MANAGER":
    case "AGENT":
    default:
      return {
        canEditName: false,
        canEditEmail: false,
        canEditPhone: true,
        isRestricted: true,
      };
  }
}
