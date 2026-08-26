import { z } from "zod";

export const quickReplyFormSchema = z.object({
  title: z.string().trim().min(2, "quickReplies.validation.title").max(120, "quickReplies.validation.titleMax"),
  body: z.string().trim().min(1, "quickReplies.validation.body").max(5_000, "quickReplies.validation.bodyMax"),
});

export type QuickReplyFormValues = z.input<typeof quickReplyFormSchema>;
