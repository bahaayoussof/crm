import { type PropsWithChildren, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/features/auth/auth-token";
import { useAuth } from "@/features/auth/auth-state";
import { createRealtimeClient } from "./realtime-client";
import { handleRealtimeEvent } from "./realtime-event-handler";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
const REALTIME_URL = `${API_URL.replace(/\/$/, "")}/realtime/events`;

/**
 * Maintains exactly one application-level SSE connection for authenticated
 * internal users, and routes every event to `handleRealtimeEvent`.
 *
 * - One connection per browser tab (not per ticket page).
 * - CUSTOMER (portal) sessions get no connection — customer realtime is a
 *   documented follow-up.
 * - Recreated when the signed-in user changes (login / logout / account switch);
 *   torn down on unmount. A failed connection never breaks the app — REST +
 *   TanStack Query keep working.
 */
export function RealtimeProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const isInternal = Boolean(user && user.role !== "CUSTOMER");

  useEffect(() => {
    if (!isInternal || !userId) return;

    let client: { close: () => void } | null = null;
    try {
      client = createRealtimeClient({
        url: REALTIME_URL,
        getToken: getAuthToken,
        onEvent: (event) => handleRealtimeEvent(queryClient, event),
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
  }, [isInternal, userId, queryClient]);

  return <>{children}</>;
}
