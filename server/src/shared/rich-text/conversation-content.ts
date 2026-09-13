import { sanitizeReplyHtml, replyHtmlToPlainText } from "./reply-html.js";
import { AppError } from "../errors/app-error.js";

/**
 * CONV-011 — one canonical server-owned content validation/size policy for
 * every conversation entry point (staff reply, internal note, Portal reply,
 * Email, SMS, WhatsApp inbound/outbound, Live Chat). Provider adapters and
 * services declare their `format`/`source`; they never reimplement length
 * rules or infer rendering from body markup.
 */

export type ConversationContentFormat = "PLAIN_TEXT" | "SANITIZED_HTML";
export type ConversationContentSource =
  | "STAFF"
  | "PORTAL"
  | "EMAIL"
  | "SMS"
  | "WHATSAPP"
  | "LIVE_CHAT"
  | "SYSTEM";

export type ConversationContentInput = {
  raw: string;
  format: ConversationContentFormat;
  source: ConversationContentSource;
};

export type ConversationContentRejectReason = "EMPTY_MESSAGE" | "CONTENT_TOO_LARGE" | "MESSAGE_TOO_LONG";

export type ConversationContentResult =
  | { ok: true; plainText: string; sanitizedHtml?: string; contentFormat: ConversationContentFormat; contentSource: ConversationContentSource }
  | { ok: false; reason: ConversationContentRejectReason };

/** Semantic max applied uniformly to every source except the compact Live Chat surface. */
export const CONVERSATION_CONTENT_MAX_CHARS = 20_000;
/** Live Chat's intentionally smaller composer limit, enforced server-side. */
export const LIVE_CHAT_CONTENT_MAX_CHARS = 2_000;
/** Rich-input serialized payload ceiling before sanitization (markup overhead headroom). */
export const RICH_CONTENT_SERIALIZED_MAX_CHARS = 50_000;

function codePointLength(value: string): number {
  return [...value].length;
}

function semanticMaxFor(source: ConversationContentSource): number {
  return source === "LIVE_CHAT" ? LIVE_CHAT_CONTENT_MAX_CHARS : CONVERSATION_CONTENT_MAX_CHARS;
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Validate and normalize conversation content declared for a specific
 * format/source. Never infers `SANITIZED_HTML` from markup shape — the
 * caller declares `format` from its own trusted write path.
 */
export function validateConversationContent(input: ConversationContentInput): ConversationContentResult {
  const normalized = normalizeLineEndings(input.raw);
  const max = semanticMaxFor(input.source);

  if (input.format === "SANITIZED_HTML") {
    if (normalized.length > RICH_CONTENT_SERIALIZED_MAX_CHARS) {
      return { ok: false, reason: "CONTENT_TOO_LARGE" };
    }
    const sanitizedHtml = sanitizeReplyHtml(normalized);
    const plainText = replyHtmlToPlainText(sanitizedHtml);
    if (!plainText) return { ok: false, reason: "EMPTY_MESSAGE" };
    const length = codePointLength(plainText);
    if (length < 1 || length > max) return { ok: false, reason: "MESSAGE_TOO_LONG" };
    return { ok: true, plainText, sanitizedHtml, contentFormat: input.format, contentSource: input.source };
  }

  const plainText = normalized.trim();
  if (!plainText) return { ok: false, reason: "EMPTY_MESSAGE" };
  const length = codePointLength(plainText);
  if (length > max) return { ok: false, reason: "MESSAGE_TOO_LONG" };
  return { ok: true, plainText, contentFormat: input.format, contentSource: input.source };
}

/** Same policy as {@link validateConversationContent}, throwing the shared
 * structured error on rejection instead of returning a discriminated result —
 * for call sites that want to fail fast. */
export function requireConversationContent(
  input: ConversationContentInput,
): Extract<ConversationContentResult, { ok: true }> {
  const result = validateConversationContent(input);
  if (result.ok) return result;
  if (result.reason === "EMPTY_MESSAGE") throw new AppError(422, "EMPTY_MESSAGE", "Message body is required");
  if (result.reason === "CONTENT_TOO_LARGE") throw new AppError(413, "CONTENT_TOO_LARGE", "Message payload is too large");
  throw new AppError(422, "MESSAGE_TOO_LONG", "Message exceeds the maximum allowed length");
}
