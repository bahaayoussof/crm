import { type PropsWithChildren, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/features/auth/auth-token";
import { useAuth } from "@/features/auth/auth-state";
import { createRealtimeClient } from "./realtime-client";
import { handleRealtimeEvent } from "./realtime-event-handler";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
const REALTIME_URL = `${API_URL.replace(/\/$/, "")}/realtime/events`;

/**
 * Maintains exactly one application-level SSE connection for any authenticated
 * user, and routes every event to `handleRealtimeEvent`.
 *
 * - One connection per browser tab (not per ticket page).
 * - Internal roles (ADMIN/MANAGER/AGENT) and CUSTOMER (Customer Portal) all
 *   connect; the server scopes what each connection receives. The event handler
 *   maps events onto the right query keys per role.
 * - No connection when logged out.
 * - Recreated when the signed-in user changes (login / logout / account switch);
 *   torn down on unmount. A failed connection never breaks the app — REST +
 *   TanStack Query keep working.
 */
export function RealtimeProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const role = user?.role ?? null;

  useEffect(() => {
    if (!userId || !role) return;

    let client: { close: () => void } | null = null;
    try {
      client = createRealtimeClient({
        url: REALTIME_URL,
        getToken: getAuthToken,
        onEvent: (event) => handleRealtimeEvent(queryClient, event, role),
      });
    } catch (error) {
      // Realtime is an enhancement — never let it break the app shell.
      if (import.meta.env.DEV) console.warn("realtime: failed to start", error);
      return;
    }

    // A 401 anywhere in the app clears the token and fires this — drop the stream.
    const onUnauthorized = () => client?.close();
    window.addEventListener("auth:unauthorized", onUnauthorized);

    return () => {
      window.removeEventListener("auth:unauthorized", onUnauthorized);
      client?.close();
    };
  }, [userId, role, queryClient]);

  return <>{children}</>;
}
