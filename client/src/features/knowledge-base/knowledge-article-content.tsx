import {
  LOOKS_LIKE_ARTICLE_HTML,
  sanitizeArticleHtml,
} from "@/lib/rich-text/article-html";

/**
 * The single safe renderer for a Knowledge Base article body, shared by the
 * internal detail view and the customer portal detail view.
 *
 * - Rich (server-sanitized HTML) → re-sanitize on the client, then inject.
 * - Legacy plain text (never re-edited) → the pre-enhancement
 *   `whitespace-pre-wrap` text path, byte-for-byte unchanged.
 *
 * Raw/untrusted HTML never reaches the DOM directly — only sanitizer output.
 */
export function ArticleContent({ content, className }: { content: string; className?: string }) {
  const base = `break-words text-sm leading-7 text-foreground ${className ?? ""}`.trim();

  if (LOOKS_LIKE_ARTICLE_HTML.test(content)) {
    return (
      <div
        dir="auto"
        className={`${base} [&_a]:text-primary [&_a]:underline [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2:first-child]:mt-0 [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:ms-5 [&_ol]:list-decimal [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:ms-5 [&_ul]:list-disc`}
        // Server sanitizes on write; re-sanitized here as defense-in-depth.
        dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(content) }}
      />
    );
  }

  return (
    <div dir="auto" className={`${base} whitespace-pre-wrap`}>
      {content}
    </div>
  );
}
