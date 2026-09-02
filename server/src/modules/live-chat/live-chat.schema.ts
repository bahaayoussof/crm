import { z } from "zod";
import { databaseIdSchema } from "../../shared/validation/common.schema.js";

/**
 * `POST /api/portal/live-chat` accepts ONLY the routing input the customer must
 * choose for a brand-new chat: the Department they want to reach. The customer
 * identity comes from authentication and the channel is forced to `LIVE_CHAT`
 * server-side. `.strict()` rejects any attempt to smuggle `customerId`,
 * `teamId`, `managerId`, `assignedAgentId`, `channel`, `status`, `priority`, …
 *
 * `departmentId` is OPTIONAL at the schema layer so a customer who already has
 * an active chat can POST with no body and simply resume it (the field is
 * ignored on resume — a chat is never re-routed). It becomes REQUIRED in the
 * service for the create path (`DEPARTMENT_REQUIRED` otherwise).
 */
export const liveChatStartSchema = z.object({ departmentId: databaseIdSchema.optional() }).strict();

export type LiveChatStartInput = z.infer<typeof liveChatStartSchema>;
