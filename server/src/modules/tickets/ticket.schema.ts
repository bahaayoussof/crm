import { Channel, TicketPriority, TicketStatus } from "@prisma/client";
import { z } from "zod";

const nullableId = z.preprocess((value) => value === "" ? null : value, z.string().trim().min(1).nullable().optional());

export const ticketListQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  categoryId: z.string().trim().min(1).optional(),
  assignedAgentId: z.string().trim().min(1).optional(),
  customerId: z.string().trim().min(1).optional(),
}).strict();

export const ticketParamsSchema = z.object({ id: z.string().trim().min(1) }).strict();

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(1).max(20_000),
  customerId: z.string().trim().min(1),
  priority: z.nativeEnum(TicketPriority).default(TicketPriority.MEDIUM),
  channel: z.nativeEnum(Channel).default(Channel.WEB),
  categoryId: nullableId,
  assignedAgentId: nullableId,
  departmentId: nullableId,
  branchId: nullableId,
}).strict();

export const updateTicketSchema = z.object({
  subject: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(1).max(20_000).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  categoryId: nullableId,
  assignedAgentId: nullableId,
  departmentId: nullableId,
  branchId: nullableId,
}).strict().refine((value) => Object.keys(value).length > 0, { message: "At least one ticket field is required" });

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
