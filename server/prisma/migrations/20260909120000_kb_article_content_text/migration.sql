-- KB-RICH-002: additive, non-destructive plain-text projection column for
-- Knowledge Base article bodies. Nullable, no default, no index.
-- AlterTable
ALTER TABLE "KnowledgeArticle" ADD COLUMN     "contentText" TEXT;

-- Backfill: at launch every existing row's `content` is plain text (BC-1),
-- so the projection is a straight copy. `content` is never rewritten.
UPDATE "KnowledgeArticle" SET "contentText" = "content";
