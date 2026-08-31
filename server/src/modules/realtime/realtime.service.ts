import { randomUUID } from "node:crypto";
import { Role } from "@prisma/client";
import type { Response } from "express";
import type { RealtimeAudience, RealtimeSubscriber, RoutedRealtimeEvent } from "./realtime.types.js";

/**
 * SSE transport for realtime CRM events.
 *
 * This module owns every SSE protocol detail (framing, heartbeat, dead-socket
 * cleanup). Domain code never touches `response.write` — it calls the publisher
 * (`realtime.publisher.ts`), which routes here. Swapping SSE for WebSocket later
 * means replacing only this file + the controller.
 */

const HEARTBEAT_MS = 25_000;
/** Client is told to wait this long before reconnecting after a drop. */
export const RECONNECT_ADVICE_MS = 15_000;

const subscribers = new Map<string, RealtimeSubscriber>();
let eventSeq = 0;
let heartbeat: NodeJS.Timeout | null = null;

function startHeartbeat() {
  if (heartbeat) return;
  heartbeat = setInterval(() => {
    for (const subscriber of subscribers.values()) {
      writeRaw(subscriber, ": ping\n\n");
    }
  }, HEARTBEAT_MS);
  // Never keep the process alive just for the heartbeat.
  heartbeat.unref?.();
}

function stopHeartbeat() {
  if (heartbeat && subscribers.size === 0) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

function writeRaw(subscriber: RealtimeSubscriber, chunk: string) {
  try {
    subscriber.response.write(chunk);
  } catch {
    // Dead socket — drop it. A normal client disconnect is not logged noisily.
    removeSubscriber(subscriber.id);
    if (process.env.NODE_ENV !== "test") {
      console.warn(`realtime: dropped subscriber ${subscriber.id} after write error`);
    }
  }
}

export function addSubscriber(
  userId: string,
  role: Role,
  response: Response,
  customerId: string | null = null,
): RealtimeSubscriber {
  const subscriber: RealtimeSubscriber = { id: randomUUID(), userId, role, customerId, response };
  subscribers.set(subscriber.id, subscriber);
  startHeartbeat();
  return subscriber;
}

export function removeSubscriber(id: string) {
  subscribers.delete(id);
  stopHeartbeat();
}

/**
 * Does this connected subscriber get to know the event happened?
 *
 * Role-aware by design (§6): internal visibility mirrors `ticket-visibility.ts`
 * unchanged; CUSTOMER has its own path — portal ticket ownership + public events
 * only. The two never share a code branch.
 */
export function canReceive(
  subscriber: Pick<RealtimeSubscriber, "userId" | "role" | "customerId">,
  audience: RealtimeAudience,
): boolean {
  if (audience.scope === "user") {
    // User-scoped events are internal CRM notifications. The Customer Portal has
    // no notification system, so a CUSTOMER connection never receives these even
    // if a user id somehow collided.
    if (subscriber.role === Role.CUSTOMER) return false;
    return subscriber.userId === audience.userId;
  }

  // scope === "ticket"
  if (subscriber.role === Role.CUSTOMER) {
    // Portal realtime: own ticket only, public conversation only. Internal notes
    // (and any future internal-only ticket signal) are never routed to a customer.
    if (audience.visibility === "internal") return false;
    return subscriber.customerId !== null && subscriber.customerId === audience.customerId;
  }

  // Internal RBAC mirrors ticket-visibility.ts.
  if (subscriber.role === Role.ADMIN || subscriber.role === Role.MANAGER) return true;
  if (subscriber.role === Role.AGENT) {
    return audience.assignedAgentId === null || audience.assignedAgentId === subscriber.userId;
  }
  return false;
}

function frame(event: RoutedRealtimeEvent["event"], id: number): string {
  return `id: ${id}\nevent: crm-event\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * Best-effort broadcast. A slow or dead client never blocks or throws into the
 * caller — realtime delivery is an enhancement, never part of a domain
 * transaction's success path.
 */
export function publish(routed: RoutedRealtimeEvent) {
  const id = ++eventSeq;
  for (const subscriber of subscribers.values()) {
    if (canReceive(subscriber, routed.audience)) {
      writeRaw(subscriber, frame(routed.event, id));
    }
  }
}

// --- test helpers -----------------------------------------------------------
export function __resetRealtimeForTest() {
  for (const subscriber of subscribers.values()) {
    try {
      subscriber.response.end();
    } catch {
      /* ignore */
    }
  }
  subscribers.clear();
  eventSeq = 0;
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}
export function __subscribersForTest() {
  return [...subscribers.values()];
}
