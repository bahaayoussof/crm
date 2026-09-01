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
 * subscribers by `realtime.service.ts` — never serialized to the wire. This is
 * server-side authorization context: it may carry more than the SSE payload
 * (owning customer, visibility) precisely so per-event routing needs no extra
 * database query.
 */
export type RealtimeAudience =
  | {
      scope: "ticket";
      ticketId: string;
      /** Snapshot at emit time — drives AGENT visibility (assigned-or-unassigned). */
      assignedAgentId: string | null;
      /**
       * Owning portal customer (`Ticket.customerId`) at emit time. Drives CUSTOMER
       * portal-ownership routing — a customer is told about a ticket event only
       * when this matches their linked customer account. Never sent on the wire.
       */
      customerId: string | null;
      /**
       * Owning `Ticket.teamId` at emit time (feature/team-based-manager-scope).
       * Drives MANAGER team scope and the AGENT unassigned-queue team narrowing.
       * `null` for an unrouted ticket → only ADMIN internal subscribers receive it.
       * Never sent on the wire.
       */
      teamId: string | null;
      /**
       * Present for `ticket.message.created`. CUSTOMER subscribers receive the
       * event only when this is `"public"`; internal notes are never routed to a
       * customer connection.
       */
      visibility?: "public" | "internal";
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
  /**
   * For a CUSTOMER connection: the linked `Customer.id`, resolved once when the
   * stream is established (never per event). `null` until resolved, or when the
   * user has no linked customer profile — such a connection receives no ticket
   * events. Unused for internal roles.
   */
  customerId: string | null;
  /**
   * For a MANAGER / AGENT connection: the actor's team id, resolved once when
   * the stream is established (never per event). MANAGER receives ticket events
   * only for this team; AGENT's unassigned-queue events are narrowed to it.
   * `null` for ADMIN (org-wide) or a mis-provisioned user with no team.
   */
  teamId: string | null;
  response: Response;
}
