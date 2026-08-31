import type { QueryClient } from "@tanstack/react-query";
import { ticketKeys } from "@/features/tickets/ticket-hooks";
import { notificationKeys } from "@/features/notifications/notification-hooks";
import { portalKeys } from "@/features/portal/portal-hooks";
import type { RealtimeEvent } from "./realtime.types";

/**
 * Map a realtime event onto targeted TanStack Query invalidations. Reuses the
 * existing query-key factories — no parallel key formats. Invalidation is
 * deliberately narrow: never invalidate the whole cache for one event.
 *
 * Role-aware: a CUSTOMER (Customer Portal) session owns a separate set of query
 * keys (`portalKeys`) from the internal CRM (`ticketKeys` / `notificationKeys`),
 * so events are routed onto the portal keys for that role. The server already
 * withholds internal-only signals from a customer connection; the extra guards
 * here are defence in depth in case such an event ever reaches the client.
 *
 * Duplicate events are harmless — invalidate/refetch is idempotent (§28), so no
 * client-side dedupe is needed.
 */
export function handleRealtimeEvent(queryClient: QueryClient, event: RealtimeEvent, role?: string): void {
  const isCustomer = role === "CUSTOMER";

  switch (event.type) {
    case "ticket.message.created": {
      if (isCustomer) {
        // Never let an internal note touch portal state, even if one leaked here.
        if (event.visibility === "internal") return;
        void queryClient.invalidateQueries({ queryKey: portalKeys.ticket(event.ticketId) });
        void queryClient.invalidateQueries({ queryKey: portalKeys.tickets() });
        return;
      }
      // The open conversation refetches; ticket lists may reorder (updatedAt).
      void queryClient.invalidateQueries({ queryKey: ticketKeys.detail(event.ticketId) });
      void queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
      return;
    }
    case "ticket.updated": {
      if (isCustomer) {
        void queryClient.invalidateQueries({ queryKey: portalKeys.ticket(event.ticketId) });
        void queryClient.invalidateQueries({ queryKey: portalKeys.tickets() });
        void queryClient.invalidateQueries({ queryKey: portalKeys.overview });
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ticketKeys.detail(event.ticketId) });
      void queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      return;
    }
    case "notification.created":
    case "notification.read": {
      // The Customer Portal has no notification centre — these are internal only.
      if (isCustomer) return;
      void queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
      return;
    }
  }
}
