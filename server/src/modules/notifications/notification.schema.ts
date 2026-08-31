import { z } from "zod";
import { databaseIdSchema } from "../../shared/validation/common.schema.js";
import { paginationFields } from "../../shared/validation/pagination.schema.js";

export const notificationQuerySchema = z
  .object({
    ...paginationFields(20, 50),
    read: z.enum(["true", "false"]).optional(),
  })
  .strict();

export type NotificationQuery = z.infer<typeof notificationQuerySchema>;

export const notificationParamsSchema = z.object({ id: databaseIdSchema }).strict();
