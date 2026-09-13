import { z } from "zod";
import { databaseIdSchema } from "../../shared/validation/common.schema.js";

/**
 * CONV-022/026 — Live Chat start/resume is keyed ONLY by a bounded opaque
 * `sessionKey` the client widget generates and persists for that browser
 * session/conversation lifecycle (CONV-050). Customer identity never selects
 * a different session's ticket — a fresh `sessionKey` always creates a fresh
 * ticket regardless of any existing active chat for that customer.
 */
export const liveChatSessionKeySchema = z.string().trim().min(16).max(128);

/**
 * `POST /api/portal/live-chat` accepts the opaque session key (required, both
 * for a create and a resume) plus the routing input for a brand-new chat: the
 * Department the customer wants to reach. The customer identity comes from
 * authentication and the channel is forced to `LIVE_CHAT` server-side.
 * `.strict()` rejects any attempt to smuggle `customerId`, `teamId`,
 * `managerId`, `assignedAgentId`, `channel`, `status`, `priority`, …
 *
 * `departmentId` is OPTIONAL at the schema layer — it is used only when
 * `sessionKey` does not correlate to an existing resumable ticket (a create);
 * on resume it is ignored (a chat is never re-routed). It becomes REQUIRED in
 * the service for the create path (`DEPARTMENT_REQUIRED` otherwise).
 */
export const liveChatStartSchema = z.object({ sessionKey: liveChatSessionKeySchema, departmentId: databaseIdSchema.optional() }).strict();

export type LiveChatStartInput = z.infer<typeof liveChatStartSchema>;

/** `GET /api/portal/live-chat?sessionKey=...` — resume lookup only; no customer-identity fallback. */
export const liveChatGetQuerySchema = z.object({ sessionKey: liveChatSessionKeySchema.optional() });

export type LiveChatGetQuery = z.infer<typeof liveChatGetQuerySchema>;

/**
 * `POST /api/portal/live-chat/:ticketId/end` — the ticket comes from the path.
 * The body carries nothing: the server decides the transition (`active ->
 * RESOLVED`). No `status` / `customerId` / `teamId` / `channel` is accepted.
 */
export const liveChatEndParamsSchema = z.object({ ticketId: databaseIdSchema });

export type LiveChatEndParams = z.infer<typeof liveChatEndParamsSchema>;
