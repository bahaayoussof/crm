import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------
const idSchema = z.string().trim().min(1);

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
    assigneeId: idSchema.optional(),
    ticketId: idSchema.optional(),
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
    assigneeId: idSchema.optional(),
    ticketId: idSchema.nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

// ---------------------------------------------------------------------------
// List query
// ---------------------------------------------------------------------------
export const listTasksQuerySchema = z
  .object({
    status: z.enum(["OPEN", "DONE"]).optional(),
    assigneeId: idSchema.optional(),
    ticketId: idSchema.optional(),
    search: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(15),
  })
  .strict();

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

// ---------------------------------------------------------------------------
// ID param
// ---------------------------------------------------------------------------
export const taskIdParamSchema = z.object({ id: idSchema }).strict();
export type TaskIdParam = z.infer<typeof taskIdParamSchema>;
