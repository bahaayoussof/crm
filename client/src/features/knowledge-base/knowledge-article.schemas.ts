import { z } from "zod";

export const knowledgeArticleFormSchema = z.object({
  title: z.string().trim().min(3, "knowledgeBase.validation.title").max(200, "knowledgeBase.validation.titleMax"),
  content: z.string().trim().min(1, "knowledgeBase.validation.content").max(50_000, "knowledgeBase.validation.contentMax"),
  category: z.string().trim().max(100, "knowledgeBase.validation.categoryMax"),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

export type KnowledgeArticleFormValues = z.input<typeof knowledgeArticleFormSchema>;
