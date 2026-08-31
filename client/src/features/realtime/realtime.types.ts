/**
 * Realtime event contract (server -> client). Mirror of
 * `server/src/modules/realtime/realtime.types.ts` — keep the two in sync.
 *
 * Events are "something changed" signals only. The handler reacts by
 * invalidating the matching TanStack Query; REST stays the source of truth.
 */
export type RealtimeEvent =
  | {
      type: "ticket.message.created";
      ticketId: string;
      messageId: string;
      visibility: "public" | "internal";
    }
  | {
      type: "ticket.updated";
      ticketId: string;
    }
  | {
      type: "notification.created";
      notificationId: string | null;
    }
  | {
      type: "notification.read";
      notificationId: string;
    };

export type RealtimeConnectionStatus = "connecting" | "open" | "reconnecting" | "closed";

/** Runtime guard — malformed frames are dropped, never thrown. */
export function parseRealtimeEvent(raw: unknown): RealtimeEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  switch (value.type) {
    case "ticket.message.created":
      return typeof value.ticketId === "string" && typeof value.messageId === "string"
        ? {
            type: "ticket.message.created",
            ticketId: value.ticketId,
            messageId: value.messageId,
            visibility: value.visibility === "internal" ? "internal" : "public",
          }
        : null;
    case "ticket.updated":
      return typeof value.ticketId === "string" ? { type: "ticket.updated", ticketId: value.ticketId } : null;
    case "notification.created":
      return {
        type: "notification.created",
        notificationId: typeof value.notificationId === "string" ? value.notificationId : null,
      };
    case "notification.read":
      return typeof value.notificationId === "string"
        ? { type: "notification.read", notificationId: value.notificationId }
        : null;
    default:
      return null;
  }
}
