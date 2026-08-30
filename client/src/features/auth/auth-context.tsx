import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type PropsWithChildren, useEffect, useState } from "react";
import { getCurrentUserRequest, loginRequest, registerRequest } from "./auth-api";
import { clearAuthToken, getAuthToken, setAuthToken } from "./auth-token";
import type { AuthResponse } from "./auth.types";
import { AUTH_QUERY_KEY, AuthContext } from "./auth-state";

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(getAuthToken);
  const hasToken = Boolean(token);
  const currentUser = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: getCurrentUserRequest,
    enabled: hasToken,
    retry: false,
  });

  const establishSession = (session: AuthResponse) => {
    setAuthToken(session.token);
    setToken(session.token);
    queryClient.setQueryData(AUTH_QUERY_KEY, session.user);
    return session.user;
  };

  const logout = () => {
    clearAuthToken();
    setToken(null);
    queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY });
  };

  useEffect(() => {
    const handleUnauthorized = () => logout();
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  });

  return (
    <AuthContext.Provider
      value={{
        user: hasToken ? currentUser.data ?? null : null,
        isLoading: hasToken && currentUser.isLoading,
        login: async (values) => establishSession(await loginRequest(values)),
        register: async (values) => establishSession(await registerRequest(values)),
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
