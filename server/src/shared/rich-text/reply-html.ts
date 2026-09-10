import sanitizeHtml from "sanitize-html";

/**
 * Server-authoritative sanitizer for user-authored public-reply HTML.
 *
 * The Ticket Details reply composer (Lexical) emits a small, fixed set of
 * support-desk formatting: emphasis, lists, and links. Everything else — styles,
 * classes, ids, scripts, event handlers, media, iframes, data URIs — is dropped.
 * This is the only place reply markup is trusted; the client editor is a
 * convenience, never the security boundary.
 */
export const REPLY_HTML_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["b", "strong", "i", "em", "u", "p", "br", "ul", "ol", "li", "a"],
  // `rel`/`target` are added by the transform below and must be allow-listed here
  // or the attribute filter (which runs after transforms) would strip them.
  allowedAttributes: { a: ["href", "rel", "target"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs) => ({
      tagName: "a",
      attribs: { ...attribs, rel: "noopener noreferrer nofollow", target: "_blank" },
    }),
  },
};

/**
 * Server-authoritative sanitizer for user-authored Knowledge Base article HTML.
 *
 * Identical trust model and `a` handling to {@link REPLY_HTML_SANITIZE_OPTIONS};
 * the article editor additionally offers two heading levels (`h2` section, `h3`
 * sub-section — the article page owns the `h1`). Everything outside this small
 * V1 allowlist (images, tables, code blocks, styles, classes, ids, scripts,
 * event handlers, iframes, data URIs) is discarded, text preserved.
 */
export const ARTICLE_HTML_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  ...REPLY_HTML_SANITIZE_OPTIONS,
  allowedTags: [...(REPLY_HTML_SANITIZE_OPTIONS.allowedTags as string[]), "h2", "h3"],
};

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/**
 * Flatten reply/article HTML to a single plain-text string for consumers that
 * must never receive markup: WhatsApp outbound delivery, the AI prompt context,
 * and the Knowledge Base `contentText` search/excerpt projection. Block
 * boundaries, headings, and `<br>` become newlines; entities are decoded.
 *
 * Headings never occur in reply HTML, so adding `</h1>`…`</h6>` to the block
 * boundary set leaves every existing reply/ notes/ email/ AI-context result
 * byte-identical.
 */
export function replyHtmlToPlainText(input: string): string {
  const withBreaks = input
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|ul|ol|h[1-6])\s*>/gi, "\n");
  const stripped = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} });
  return stripped
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (match) => NAMED_ENTITIES[match] ?? match)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Flatten sanitized Knowledge Base article HTML to human-readable plain text.
 * Alias of {@link replyHtmlToPlainText} — one deterministic HTML→text transform
 * for search, excerpts, and AI grounding. */
export const articleHtmlToPlainText = replyHtmlToPlainText;

/** Sanitize reply HTML to the support-reply allowlist. Returns "" when the input
 * carries no visible text (markup-only or whitespace-only) so callers can reject
 * an effectively empty message. */
export function sanitizeReplyHtml(input: string): string {
  const clean = sanitizeHtml(input, REPLY_HTML_SANITIZE_OPTIONS).trim();
  return replyHtmlToPlainText(clean) ? clean : "";
}

/** Sanitize Knowledge Base article HTML to the V1 article allowlist (reply set
 * plus `h2`/`h3`). Returns "" when the sanitized value carries no visible text
 * so the caller can reject an effectively empty body. */
export function sanitizeArticleHtml(input: string): string {
  const clean = sanitizeHtml(input, ARTICLE_HTML_SANITIZE_OPTIONS).trim();
  return articleHtmlToPlainText(clean) ? clean : "";
}
