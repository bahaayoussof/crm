import { z } from "zod";
import { TICKET_CHANNELS } from "./ticket.types";

export const ticketFormSchema = z.object({
  customerId: z.string().min(1, "tickets.validation.customer"),
  subject: z.string().trim().min(3, "tickets.validation.subject").max(200, "tickets.validation.subjectMax"),
  description: z.string().trim().min(1, "tickets.validation.description").max(20_000, "tickets.validation.descriptionMax"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  // The Channel select only ever offers TICKET_CREATE_CHANNELS, but an
  // existing ticket being edited can carry any TicketChannel (e.g. LIVE_CHAT)
  // and the edit form hydrates this field even though it never renders or
  // submits it — validate against the full set so editing such a ticket
  // doesn't fail silently.
  channel: z.enum(TICKET_CHANNELS),
  categoryId: z.string().min(1, "tickets.validation.category"),
  assignedAgentId: z.string().optional(),
  // feature/team-based-manager-scope — explicit Department → Team routing (ADMIN).
  departmentId: z.string().optional(),
  teamId: z.string().optional(),
});
export type TicketFormValues = z.infer<typeof ticketFormSchema>;
