import { z } from "zod";

export const feedbackParamsSchema = z.object({ id: z.string().trim().min(1) }).strict();

export const submitFeedbackSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();

export type FeedbackParams = z.infer<typeof feedbackParamsSchema>;
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
