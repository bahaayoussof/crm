import { z } from "zod";

export const notificationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    read: z.enum(["true", "false"]).optional(),
  })
  .strict();

export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
