import { z } from "zod";

export const taskFormSchema = z.object({
  title: z.string().trim().min(2, "tasks.validation.title").max(200, "tasks.validation.titleMax"),
  description: z.string().trim().max(2000, "tasks.validation.descriptionMax"),
  dueAt: z.string().trim(),
  status: z.enum(["OPEN", "DONE"]),
  assigneeId: z.string().trim(),
});

export type TaskFormValues = z.input<typeof taskFormSchema>;
