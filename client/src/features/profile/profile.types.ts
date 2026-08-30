import type { Role } from "@/features/auth/auth.types";

/** Shared self-profile payload — internal `/auth/profile` and portal `/portal/profile`. */
export interface SelfProfile {
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  createdAt: string;
  passwordChangedAt: string | null;
}

/** The only fields the Edit Profile modal may change. */
export interface SelfProfileUpdate {
  name?: string;
  email?: string;
  phone?: string | null;
}
