import type { LexicalEditor } from "lexical";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  CLEAR_HISTORY_COMMAND,
} from "lexical";
import { $generateNodesFromDOM } from "@lexical/html";

/**
 * Tag set the public-reply / Quick Reply Lexical editor can produce (bold,
 * italic, underline, lists, links) — identical to the server's
 * `REPLY_HTML_SANITIZE_OPTIONS` allowlist (`server/src/shared/rich-text/reply-html.ts`).
 * No headings: this is the reply-composer surface, not the Knowledge Base editor.
 */
export const REPLY_ALLOWED_TAGS = ["p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li", "a"];

/** Cheap "is this HTML or legacy plain text?" sniff, same model as the Knowledge
 * Base `LOOKS_LIKE_ARTICLE_HTML` — reliable because the server normalizes every
 * saved body to well-formed sanitized HTML, and every not-yet-re-edited row is
 * plain text. A false positive still renders safely through the sanitizer/parser;
 * a false negative renders as preformatted text. */
export const LOOKS_LIKE_REPLY_HTML = /<(?:\/?)(?:p|br|b|strong|i|em|u|ul|ol|li|a)\b[^>]*>/i;

/** Flatten reply HTML (or pass through legacy plain text unchanged) to a plain
 * string for previews/search — table rows, the Quick Reply picker result list,
 * etc. Never used for anything security-sensitive; the server owns sanitization. */
export function stripReplyHtmlToPlainText(value: string): string {
  if (!value || !LOOKS_LIKE_REPLY_HTML.test(value)) return value;
  const dom = new DOMParser().parseFromString(value, "text/html");
  return (dom.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** True when the value carries visible text once markup is stripped — an
 * editor-produced empty paragraph (`<p></p>`) is not "content". */
export function replyHtmlHasVisibleText(value: string): boolean {
  return stripReplyHtmlToPlainText(value).trim().length > 0;
}

/** Hydrate a reply-style Lexical editor from a stored body: rich sanitized HTML,
 * or a legacy plain-text body (split into paragraphs on blank lines, single
 * newlines kept as line breaks). Mirrors the Knowledge Base article editor's
 * `hydrate()` for the reply tag set — shared by the ticket reply/note composer
 * and the Quick Reply editor so there is one hydration implementation. */
export function hydrateReplyHtml(editor: LexicalEditor, value: string): void {
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();

      if (value && LOOKS_LIKE_REPLY_HTML.test(value)) {
        const dom = new DOMParser().parseFromString(value, "text/html");
        const nodes = $generateNodesFromDOM(editor, dom);
        if (nodes.length) {
          root.append(...nodes);
        } else {
          root.append($createParagraphNode());
        }
      } else {
        const blocks = (value ?? "").split(/\n{2,}/);
        for (const block of blocks) {
          const paragraph = $createParagraphNode();
          const lines = block.split(/\r?\n/);
          lines.forEach((line, index) => {
            if (index > 0) paragraph.append($createLineBreakNode());
            if (line) paragraph.append($createTextNode(line));
          });
          root.append(paragraph);
        }
        if (root.getChildrenSize() === 0) root.append($createParagraphNode());
      }
    },
    { discrete: true },
  );
  editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
}
