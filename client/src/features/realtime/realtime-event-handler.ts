import type { QueryClient } from "@tanstack/react-query";
import { ticketKeys } from "@/features/tickets/ticket-hooks";
import { notificationKeys } from "@/features/notifications/notification-hooks";
import type { RealtimeEvent } from "./realtime.types";

/**
 * Map a realtime event onto targeted TanStack Query invalidations. Reuses the
 * existing query-key factories — no parallel key formats. Invalidation is
 * deliberately narrow: never invalidate the whole cache for one event.
 *
 * Duplicate events are harmless — invalidate/refetch is idempotent (§28), so no
 * client-side dedupe is needed.
 */
export function handleRealtimeEvent(queryClient: QueryClient, event: RealtimeEvent): void {
  switch (event.type) {
    case "ticket.message.created": {
      // The open conversation refetches; ticket lists may reorder (updatedAt).
      void queryClient.invalidateQueries({ queryKey: ticketKeys.detail(event.ticketId) });
      void queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
      return;
    }
    case "ticket.updated": {
      void queryClient.invalidateQueries({ queryKey: ticketKeys.detail(event.ticketId) });
      void queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      return;
    }
    case "notification.created":
    case "notification.read": {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
      return;
    }
  }
}
