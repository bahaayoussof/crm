import { createContext, useContext } from "react";
import type { RealtimeConnectionStatus } from "./realtime.types";

/**
 * Connection status of the one app-level realtime SSE stream. `"connecting"`
 * until a client exists (also the value when realtime is disabled / logged out).
 * Provided by `RealtimeProvider`; read by surfaces that show a live-connection
 * indicator (e.g. Customer Portal Live Chat).
 */
export const RealtimeStatusContext = createContext<RealtimeConnectionStatus>("connecting");

export function useRealtimeStatus(): RealtimeConnectionStatus {
  return useContext(RealtimeStatusContext);
}
