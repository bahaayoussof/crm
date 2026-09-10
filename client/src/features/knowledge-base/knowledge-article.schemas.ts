import { z } from "zod";

/** Readable-text length of the editor value — tags stripped, entities loosely
 * decoded, whitespace collapsed. The server enforces the authoritative bound
 * against its own sanitized flatten; this mirrors the intent for fast form
 * feedback and keeps the existing error-message keys. */
export function readableTextLength(html: string): number {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim().length;
}

export const knowledgeArticleFormSchema = z.object({
  title: z.string().trim().min(3, "knowledgeBase.validation.title").max(200, "knowledgeBase.validation.titleMax"),
  content: z
    .string()
    .refine((value) => readableTextLength(value) >= 1, "knowledgeBase.validation.content")
    .refine((value) => readableTextLength(value) <= 50_000, "knowledgeBase.validation.contentMax"),
  category: z.string().trim().max(100, "knowledgeBase.validation.categoryMax"),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

export type KnowledgeArticleFormValues = z.input<typeof knowledgeArticleFormSchema>;
