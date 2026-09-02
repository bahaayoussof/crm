import { z } from "zod";

/**
 * `POST /api/portal/live-chat` takes no body — the customer identity comes from
 * auth and the channel is fixed server-side. A strict empty object rejects any
 * attempt to smuggle `customerId`, `channel`, `status`, etc.
 */
export const liveChatStartSchema = z.object({}).strict();

export type LiveChatStartInput = z.infer<typeof liveChatStartSchema>;
