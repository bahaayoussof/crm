import { z } from "zod";
export const portalTicketSchema = z.object({ subject: z.string().trim().min(3).max(200), categoryId: z.string().optional(), description: z.string().trim().min(1).max(20_000) });
export type PortalTicketForm = z.infer<typeof portalTicketSchema>;
export const portalFeedbackSchema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(2000).optional() });
export type PortalFeedbackForm = z.infer<typeof portalFeedbackSchema>;
