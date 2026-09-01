import { Channel, TicketPriority, TicketStatus } from "@prisma/client";
import { z } from "zod";
import { databaseIdSchema, hasAtLeastOneField, nullableDatabaseIdSchema } from "../../shared/validation/common.schema.js";
import { paginationFields } from "../../shared/validation/pagination.schema.js";

export const ticketListQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  ...paginationFields(),
  // AGENT ticket lists are split into these two scopes only — there is no "all".
  // Any other value is a 400 VALIDATION_ERROR (no clamping). Ignored for
  // ADMIN/MANAGER, whose lists are never scope-narrowed.
  scope: z.enum(["mine", "unassigned"]).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  categoryId: databaseIdSchema.optional(),
  assignedAgentId: databaseIdSchema.optional(),
  // Operational shortcut used by the Manager Work Console "Needs Attention"
  // deep-links (and available to any ADMIN/MANAGER). Ignored for AGENT lists.
  assignee: z.enum(["unassigned"]).optional(),
  // SLA-state filter (derived, not stored). `breached` / `at_risk` mirror
  // `shared/sla/derive-sla.ts` via `shared/sla/sla-filter.ts`.
  sla: z.enum(["breached", "at_risk"]).optional(),
  customerId: databaseIdSchema.optional(),
  departmentId: databaseIdSchema.optional(),
  branchId: databaseIdSchema.optional(),
}).strict();

export const ticketParamsSchema = z.object({ id: databaseIdSchema }).strict();

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(1).max(20_000),
  customerId: databaseIdSchema,
  priority: z.nativeEnum(TicketPriority).default(TicketPriority.MEDIUM),
  // Proactively created tickets support these four channels only. LIVE_CHAT (and
  // any unknown value) is rejected with a 400 VALIDATION_ERROR — the CRM does not
  // originate live-chat conversations.
  channel: z.enum([Channel.WEB, Channel.EMAIL, Channel.WHATSAPP, Channel.SMS]).default(Channel.WEB),
  categoryId: nullableDatabaseIdSchema,
  assignedAgentId: nullableDatabaseIdSchema,
  departmentId: nullableDatabaseIdSchema,
  branchId: nullableDatabaseIdSchema,
  // Owning team (feature/team-based-manager-scope). Optional at the API — when
  // omitted and an assignee is given, the ticket adopts the assignee's team.
  teamId: nullableDatabaseIdSchema,
}).strict();

export const updateTicketSchema = z.object({
  subject: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(1).max(20_000).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  categoryId: nullableDatabaseIdSchema,
  assignedAgentId: nullableDatabaseIdSchema,
  departmentId: nullableDatabaseIdSchema,
  branchId: nullableDatabaseIdSchema,
  teamId: nullableDatabaseIdSchema,
}).strict().refine(hasAtLeastOneField, { message: "At least one ticket field is required" });

export const ticketConversationBodySchema = z.object({
  // Public replies arrive as sanitized-on-write HTML from the Lexical composer;
  // the ceiling has markup headroom over the 20k plain-text limit the client
  // enforces (docs/18 §16). Internal notes (same shape) stay well under this.
  body: z.string().trim().min(1).max(50_000),
}).strict();

export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;
export type TicketParams = z.infer<typeof ticketParamsSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type TicketConversationInput = z.infer<typeof ticketConversationBodySchema>;
