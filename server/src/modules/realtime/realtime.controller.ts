import { Role } from "@prisma/client";
import type { RequestHandler } from "express";
import { prisma } from "../../config/prisma.js";
import { addSubscriber, removeSubscriber, RECONNECT_ADVICE_MS } from "./realtime.service.js";

/**
 * Establish an authenticated SSE stream: `GET /api/realtime/events`.
 *
 * Auth: the client consumes this with `fetch` + a `ReadableStream` reader (not
 * native `EventSource`) specifically so the existing `Authorization: Bearer
 * <jwt>` header rides along unchanged — no token in the URL, no cookie, no
 * second auth path. `requireAuth` on the route has already validated the JWT.
 *
 * All authenticated roles connect (ADMIN/MANAGER/AGENT and CUSTOMER). A CUSTOMER
 * connection is scoped server-side: its linked `Customer.id` is resolved once
 * here, and `canReceive` then routes only that customer's own public ticket
 * events to it.
 */
export const streamRealtimeEvents: RequestHandler = (request, response) => {
  const auth = request.auth;
  if (!auth) {
    response.status(401).json({ error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication is required" } });
    return;
  }

  response.status(200);
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no"); // defeat proxy buffering (nginx etc.)
  response.flushHeaders?.();

  // Keep the socket open indefinitely; don't let Node's default timeout kill it.
  request.socket.setKeepAlive(true);
  request.socket.setNoDelay(true);
  request.socket.setTimeout(0);

  // Reconnect advice + an initial comment so intermediaries flush the response.
  response.write(`retry: ${RECONNECT_ADVICE_MS}\n\n`);
  response.write(": connected\n\n");

  const subscriber = addSubscriber(auth.userId, auth.role, response);

  if (auth.role === Role.CUSTOMER) {
    // Resolve the portal customer account ONCE per connection (never per event).
    // Patched in place on the registered subscriber; until it resolves the
    // customer simply receives no ticket events (realtime is an enhancement).
    void prisma.customer
      .findUnique({ where: { userId: auth.userId }, select: { id: true } })
      .then((customer) => {
        subscriber.customerId = customer?.id ?? null;
      })
      .catch(() => {
        subscriber.customerId = null;
      });
  }

  const cleanup = () => {
    removeSubscriber(subscriber.id);
  };
  request.on("close", cleanup);
  request.on("error", cleanup);
  response.on("error", cleanup);
};
