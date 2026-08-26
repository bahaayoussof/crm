import { z } from "zod";
export const portalTicketSchema = z.object({ subject: z.string().trim().min(3).max(200), categoryId: z.string().optional(), description: z.string().trim().min(1).max(20_000) });
export type PortalTicketForm = z.infer<typeof portalTicketSchema>;
