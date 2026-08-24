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

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
