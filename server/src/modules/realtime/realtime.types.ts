import type { Role } from "@prisma/client";
import type { Response } from "express";

/**
 * Realtime event contract (server -> client).
 *
 * These are deliberately small "something you can see changed" signals — never
 * full domain records. The frontend reacts by invalidating/refetching the
 * matching TanStack Query, so the database + REST APIs stay the source of truth.
 *
 * Keep this union in sync with `client/src/features/realtime/realtime.types.ts`.
 */
export type RealtimeEvent =
  | {
      type: "ticket.message.created";
      ticketId: string;
      messageId: string;
      /** "internal" = internal note (staff only); "public" = customer-visible message. */
      visibility: "public" | "internal";
    }
  | {
      type: "ticket.updated";
      ticketId: string;
    }
  | {
      type: "notification.created";
      /** Present when the id is known at emit time; the frontend only needs to refetch. */
      notificationId: string | null;
    }
  | {
      type: "notification.read";
      notificationId: string;
    };

/**
 * Who is allowed to know an event happened. Resolved against the connected
 * subscribers by `realtime.service.ts` — never serialized to the wire.
 */
export type RealtimeAudience =
  | {
      scope: "ticket";
      ticketId: string;
      /** Snapshot at emit time — drives AGENT visibility (assigned-or-unassigned). */
      assignedAgentId: string | null;
    }
  | {
      scope: "user";
      userId: string;
    };

export interface RoutedRealtimeEvent {
  event: RealtimeEvent;
  audience: RealtimeAudience;
}

export interface RealtimeSubscriber {
  id: string;
  userId: string;
  role: Role;
  response: Response;
}
