import { AsyncLocalStorage } from "node:async_hooks";
import { publish } from "./realtime.service.js";
import type { RoutedRealtimeEvent } from "./realtime.types.js";

/**
 * Transaction-safe event publication.
 *
 * Events must only reach clients AFTER the database work that produced them has
 * committed — otherwise the frontend refetches and sees stale data (§27).
 *
 * `withRealtimeOutbox(fn)` opens a per-call buffer. Any `emit*` made while `fn`
 * runs (including deep inside a `prisma.$transaction` callback) is queued, and
 * flushed only once `fn` resolves. If `fn` throws (transaction rolled back), the
 * buffer is discarded and nothing is published.
 *
 * Outside an outbox scope `emit*` publishes immediately — safe for callers that
 * are already past their commit.
 */
const outbox = new AsyncLocalStorage<RoutedRealtimeEvent[]>();

export async function withRealtimeOutbox<T>(fn: () => Promise<T>): Promise<T> {
  const buffer: RoutedRealtimeEvent[] = [];
  const result = await outbox.run(buffer, fn);
  for (const routed of buffer) {
    try {
      publish(routed);
    } catch (error) {
      console.error("realtime: publish failed for a buffered event", error);
    }
  }
  return result;
}

function enqueue(routed: RoutedRealtimeEvent) {
  const buffer = outbox.getStore();
  if (buffer) {
    buffer.push(routed);
    return;
  }
  try {
    publish(routed);
  } catch (error) {
    console.error("realtime: immediate publish failed", error);
  }
}

// --- typed emit helpers ---------------------------------------------------

export function emitTicketMessageCreated(params: {
  ticketId: string;
  messageId: string;
  assignedAgentId: string | null;
  /** Owning portal customer — server-side audience context only, never on the wire. */
  customerId: string | null;
  /** Owning team — MANAGER/AGENT realtime team scope. `null` = unrouted (ADMIN only). */
  teamId?: string | null;
  visibility: "public" | "internal";
}) {
  enqueue({
    event: {
      type: "ticket.message.created",
      ticketId: params.ticketId,
      messageId: params.messageId,
      visibility: params.visibility,
    },
    audience: {
      scope: "ticket",
      ticketId: params.ticketId,
      assignedAgentId: params.assignedAgentId,
      customerId: params.customerId,
      teamId: params.teamId ?? null,
      visibility: params.visibility,
    },
  });
}

export function emitTicketUpdated(params: {
  ticketId: string;
  assignedAgentId: string | null;
  /** Owning portal customer — server-side audience context only, never on the wire. */
  customerId: string | null;
  /** Owning team — MANAGER/AGENT realtime team scope. `null` = unrouted (ADMIN only). */
  teamId?: string | null;
}) {
  enqueue({
    event: { type: "ticket.updated", ticketId: params.ticketId },
    audience: {
      scope: "ticket",
      ticketId: params.ticketId,
      assignedAgentId: params.assignedAgentId,
      customerId: params.customerId,
      teamId: params.teamId ?? null,
    },
  });
}

/** One `notification.created` per recipient — each routed only to that user. */
export function emitNotificationCreated(recipientUserIds: readonly string[], notificationId: string | null = null) {
  for (const userId of new Set(recipientUserIds)) {
    if (!userId) continue;
    enqueue({
      event: { type: "notification.created", notificationId },
      audience: { scope: "user", userId },
    });
  }
}

export function emitNotificationRead(userId: string, notificationId: string) {
  enqueue({
    event: { type: "notification.read", notificationId },
    audience: { scope: "user", userId },
  });
}
