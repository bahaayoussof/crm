import { z } from "zod";

/** Query for the mentionable-users lookup (`GET /api/users/mentionable`). */
export const mentionableQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
  })
  .strict();

export type MentionableQuery = z.infer<typeof mentionableQuerySchema>;
