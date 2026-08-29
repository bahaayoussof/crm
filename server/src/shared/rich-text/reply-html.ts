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

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/**
 * Flatten reply HTML to a single plain-text string for consumers that must never
 * receive markup: WhatsApp outbound delivery and the AI prompt context. Block
 * boundaries and `<br>` become newlines; entities are decoded.
 */
export function replyHtmlToPlainText(input: string): string {
  const withBreaks = input
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|ul|ol)\s*>/gi, "\n");
  const stripped = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} });
  return stripped
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (match) => NAMED_ENTITIES[match] ?? match)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Sanitize reply HTML to the support-reply allowlist. Returns "" when the input
 * carries no visible text (markup-only or whitespace-only) so callers can reject
 * an effectively empty message. */
export function sanitizeReplyHtml(input: string): string {
  const clean = sanitizeHtml(input, REPLY_HTML_SANITIZE_OPTIONS).trim();
  return replyHtmlToPlainText(clean) ? clean : "";
}
