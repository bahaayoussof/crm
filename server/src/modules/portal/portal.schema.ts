import { z } from "zod";

export const portalStatuses = ["OPEN", "IN_PROGRESS", "WAITING_FOR_YOU", "RESOLVED", "CLOSED"] as const;
export const portalTicketParamsSchema = z.object({ id: z.string().trim().min(1) }).strict();
export const portalTicketListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).default(""),
  status: z.enum(portalStatuses).optional(),
}).strict();
export const portalCreateTicketSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(1).max(20_000),
  categoryId: z.string().trim().min(1).nullable().optional(),
}).strict();
export const portalReplySchema = z.object({ body: z.string().trim().min(1).max(20_000) }).strict();

export type PortalStatus = typeof portalStatuses[number];
export type PortalTicketParams = z.infer<typeof portalTicketParamsSchema>;
export type PortalTicketListQuery = z.infer<typeof portalTicketListSchema>;
export type PortalCreateTicketInput = z.infer<typeof portalCreateTicketSchema>;
export type PortalReplyInput = z.infer<typeof portalReplySchema>;
