import { z } from "zod";

export const ticketFormSchema = z.object({
  customerId: z.string().min(1, "tickets.validation.customer"),
  subject: z.string().trim().min(3, "tickets.validation.subject").max(200, "tickets.validation.subjectMax"),
  description: z.string().trim().min(1, "tickets.validation.description").max(20_000, "tickets.validation.descriptionMax"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  categoryId: z.string().min(1, "tickets.validation.category"),
  assignedAgentId: z.string().optional(),
  // feature/team-based-manager-scope — explicit Department → Team routing (ADMIN).
  departmentId: z.string().optional(),
  teamId: z.string().optional(),
});
export type TicketFormValues = z.infer<typeof ticketFormSchema>;
