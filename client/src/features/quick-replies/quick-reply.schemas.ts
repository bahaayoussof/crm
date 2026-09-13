import { z } from "zod";
import { replyHtmlHasVisibleText, stripReplyHtmlToPlainText } from "@/lib/rich-text/reply-html";

// `body` is the Rich Input's serialized HTML (or a legacy plain-text row not yet
// re-edited). The transport bound gives markup headroom over the 5,000-char
// readable-text ceiling — the real limits (non-empty, <= 5,000 visible chars)
// are checked against the flattened plain text below, mirroring the Knowledge
// Base article body pattern.
const RICH_BODY_MAX = 20_000;
const BODY_TEXT_MAX = 5_000;

export const quickReplyFormSchema = z.object({
  title: z.string().trim().min(2, "quickReplies.validation.title").max(120, "quickReplies.validation.titleMax"),
  body: z
    .string()
    .max(RICH_BODY_MAX, "quickReplies.validation.bodyMax")
    .superRefine((value, ctx) => {
      if (!replyHtmlHasVisibleText(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quickReplies.validation.body" });
        return;
      }
      if (stripReplyHtmlToPlainText(value).trim().length > BODY_TEXT_MAX) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quickReplies.validation.bodyMax" });
      }
    }),
});

export type QuickReplyFormValues = z.input<typeof quickReplyFormSchema>;
