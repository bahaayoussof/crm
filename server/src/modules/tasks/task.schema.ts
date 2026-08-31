import { z } from "zod";
import { databaseIdSchema, hasAtLeastOneField } from "../../shared/validation/common.schema.js";
import { paginationFields } from "../../shared/validation/pagination.schema.js";

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
export const createTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Title must be at least 2 characters")
      .max(200, "Title must be 200 characters or fewer"),
    description: z
      .string()
      .trim()
      .max(2000, "Description must be 2,000 characters or fewer")
      .optional(),
    dueAt: z.iso.datetime({ message: "dueAt must be a valid ISO datetime" }).optional(),
    assigneeId: databaseIdSchema.optional(),
    ticketId: databaseIdSchema.optional(),
  })
  .strict();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Title must be at least 2 characters")
      .max(200, "Title must be 200 characters or fewer")
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Description must be 2,000 characters or fewer")
      .nullable()
      .optional(),
    status: z.enum(["OPEN", "DONE"]).optional(),
    dueAt: z.iso
      .datetime({ message: "dueAt must be a valid ISO datetime" })
      .nullable()
      .optional(),
    assigneeId: databaseIdSchema.optional(),
    ticketId: databaseIdSchema.nullable().optional(),
  })
  .strict()
  .refine(hasAtLeastOneField, {
    message: "At least one field must be provided",
  });

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

// ---------------------------------------------------------------------------
// List query
// ---------------------------------------------------------------------------
export const listTasksQuerySchema = z
  .object({
    status: z.enum(["OPEN", "DONE"]).optional(),
    assigneeId: databaseIdSchema.optional(),
    ticketId: databaseIdSchema.optional(),
    search: z.string().trim().max(200).optional(),
    ...paginationFields(15, 50),
  })
  .strict();

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

// ---------------------------------------------------------------------------
// ID param
// ---------------------------------------------------------------------------
export const taskIdParamSchema = z.object({ id: databaseIdSchema }).strict();
export type TaskIdParam = z.infer<typeof taskIdParamSchema>;
