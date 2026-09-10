import DOMPurify from "dompurify";

/**
 * Client-side re-sanitizing config for Knowledge Base article bodies.
 *
 * The server (`sanitizeArticleHtml` in `server/src/shared/rich-text`) produces
 * the only trusted stored representation. This runs again on render as
 * defense-in-depth against a pre-enhancement plain-text row or any unexpected
 * markup — the exact model the ticket `MessageBody` render guard uses. The V1
 * allowlist is the reply set plus two heading levels; nothing else survives.
 */
export const ARTICLE_ALLOWED_TAGS = [
  "p",
  "br",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "a",
];

const ARTICLE_SAFE_URI = /^(?:https?:|mailto:)/i;

/** Cheap "is this HTML or legacy plain text?" sniff — matches any opening/closing
 * tag from the V1 allowlist. Reliable here because the server normalizes every
 * saved body to well-formed sanitized HTML (always at least `<p>…</p>`), and
 * every not-yet-re-edited row is plain text. A false positive still renders
 * safely through the sanitizer; a false negative renders as preformatted text. */
export const LOOKS_LIKE_ARTICLE_HTML =
  /<(?:\/?)(?:p|br|h2|h3|ul|ol|li|b|strong|i|em|u|a)\b[^>]*>/i;

if (typeof window !== "undefined" && typeof DOMPurify.addHook === "function") {
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.nodeName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });
}

/** Re-sanitize server article HTML to the V1 allowlist before it is injected. */
export function sanitizeArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ARTICLE_ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOWED_URI_REGEXP: ARTICLE_SAFE_URI,
  });
}
