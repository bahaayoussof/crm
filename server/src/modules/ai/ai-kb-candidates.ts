import { KnowledgeArticleStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { deriveExcerpt } from "../knowledge-base/knowledge-article.service.js";
import type { AiTicketContext } from "./ai.types.js";

/** Upper bound on candidates handed to the model for ranking. */
export const MAX_KB_CANDIDATES = 10;

const STOPWORDS = new Set(
  "the a an and or to of in on for is are was were be been being with without have has had this that these those from your you our their there here what when where which while cannot could would should about into over than then them they will your yours".split(
    " ",
  ),
);

/** Cheap keyword extraction from subject + description (no NLP dependency). */
export function extractKeywords(ctx: AiTicketContext): string[] {
  const source = `${ctx.ticket.subject} ${ctx.ticket.description}`.toLowerCase();
  const words = source.match(/[\p{L}\p{N}]{4,}/gu) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of words) {
    if (STOPWORDS.has(word) || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= 8) break;
  }
  return out;
}

export interface KbCandidate {
  id: string;
  title: string;
  excerpt: string;
}

/**
 * Retrieve a small set of plausible PUBLISHED articles using the existing DB
 * `contains` search (MVP — no vector store; see ADR-034 / ADR-020). Only these
 * ids may appear in the AI's ranked result; the AI never invents ids.
 */
export async function listKbCandidates(ctx: AiTicketContext): Promise<KbCandidate[]> {
  const keywords = extractKeywords(ctx);
  const or: Prisma.KnowledgeArticleWhereInput[] = [];
  for (const keyword of keywords) {
    or.push({ title: { contains: keyword, mode: "insensitive" } });
    or.push({ content: { contains: keyword, mode: "insensitive" } });
  }
  if (ctx.ticket.category) {
    or.push({ category: { contains: ctx.ticket.category.name, mode: "insensitive" } });
  }

  const rows = await prisma.knowledgeArticle.findMany({
    where: {
      status: KnowledgeArticleStatus.PUBLISHED,
      ...(or.length > 0 ? { OR: or } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: MAX_KB_CANDIDATES,
    select: { id: true, title: true, content: true },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    excerpt: deriveExcerpt(row.content),
  }));
}
