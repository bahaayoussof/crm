import { createContext, useContext } from "react";
import type { LoginValues, RegistrationValues } from "./auth.schemas";
import type { AuthUser } from "./auth.types";

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (values: LoginValues) => Promise<AuthUser>;
  register: (values: RegistrationValues) => Promise<AuthUser>;
  logout: () => void;
}

/** TanStack Query key for the authenticated user (`GET /auth/me`). Shared so
 *  password / profile mutations can refresh the current-user cache. */
export const AUTH_QUERY_KEY = ["auth", "me"] as const;

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
