import { KnowledgeArticleStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { deriveExcerpt } from "../knowledge-base/knowledge-article.service.js";

export const MAX_CUSTOMER_AI_ARTICLES = 8;

const STOPWORDS = new Set("the and for with this that from your you are can how what عند على إلى من في عن هذا هذه كيف هل مع".split(" "));

export interface CustomerAiArticle {
  id: string;
  title: string;
  category: string | null;
  content: string;
  excerpt: string;
}

export async function buildCustomerAiContext(message: string): Promise<CustomerAiArticle[]> {
  const terms = [...new Set((message.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])
    .filter((term) => !STOPWORDS.has(term)))].slice(0, 8);
  const or: Prisma.KnowledgeArticleWhereInput[] = terms.flatMap((term) => [
    { title: { contains: term, mode: "insensitive" as const } },
    // Human-readable projection only — no HTML markup reaches a model (RT-6.2).
    { contentText: { contains: term, mode: "insensitive" as const } },
    { category: { contains: term, mode: "insensitive" as const } },
  ]);
  const rows = await prisma.knowledgeArticle.findMany({
    where: { status: KnowledgeArticleStatus.PUBLISHED, ...(or.length ? { OR: or } : {}) },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: MAX_CUSTOMER_AI_ARTICLES,
    select: { id: true, title: true, category: true, contentText: true },
  });
  // `content` on the returned shape is the derived plain text, so the SOURCES
  // block in customer-ai.service never carries raw article HTML.
  return rows.map(({ contentText, ...row }) => {
    const content = contentText ?? "";
    return { ...row, content, excerpt: deriveExcerpt(content) };
  });
}
