import { describe, expect, it } from "vitest";
import {
  validateConversationContent,
  CONVERSATION_CONTENT_MAX_CHARS,
  LIVE_CHAT_CONTENT_MAX_CHARS,
  RICH_CONTENT_SERIALIZED_MAX_CHARS,
} from "./conversation-content.js";

describe("validateConversationContent", () => {
  it("rejects content whose plain-text projection is empty (plain text)", () => {
    const result = validateConversationContent({ raw: "   \n\t  ", format: "PLAIN_TEXT", source: "SMS" });
    expect(result).toEqual({ ok: false, reason: "EMPTY_MESSAGE" });
  });

  // CONV-056 — a PLAIN_TEXT body containing literal markup (SMS/WhatsApp/plain
  // Email inbound) is never interpreted or stripped; it is stored byte-for-byte
  // as plain text so the client renders it as visible literal text, not markup.
  it.each(["EMAIL", "SMS", "WHATSAPP"] as const)(
    "%s: a PLAIN_TEXT body with literal <strong>/<a> markup is preserved verbatim, never sanitized/stripped",
    (source) => {
      const raw = 'Call <strong>now</strong> or visit <a href="http://x">link</a>';
      const result = validateConversationContent({ raw, format: "PLAIN_TEXT", source });
      expect(result).toEqual({ ok: true, plainText: raw, contentFormat: "PLAIN_TEXT", contentSource: source });
    },
  );

  it("rejects content whose plain-text projection is empty after sanitization (rich)", () => {
    const result = validateConversationContent({ raw: "<script>alert(1)</script>", format: "SANITIZED_HTML", source: "STAFF" });
    expect(result).toEqual({ ok: false, reason: "EMPTY_MESSAGE" });
  });

  it("accepts a 20,000-char plain text body and rejects 20,001", () => {
    const ok = validateConversationContent({ raw: "a".repeat(CONVERSATION_CONTENT_MAX_CHARS), format: "PLAIN_TEXT", source: "EMAIL" });
    expect(ok.ok).toBe(true);
    const tooLong = validateConversationContent({ raw: "a".repeat(CONVERSATION_CONTENT_MAX_CHARS + 1), format: "PLAIN_TEXT", source: "EMAIL" });
    expect(tooLong).toEqual({ ok: false, reason: "MESSAGE_TOO_LONG" });
  });

  it("accepts a 50,000-char serialized rich payload pre-sanitize and rejects oversize", () => {
    const body = `<p>${"a".repeat(RICH_CONTENT_SERIALIZED_MAX_CHARS - 7)}</p>`;
    expect(body.length).toBe(RICH_CONTENT_SERIALIZED_MAX_CHARS);
    const ok = validateConversationContent({ raw: body, format: "SANITIZED_HTML", source: "STAFF" });
    expect(ok.ok).toBe(false); // plain-text projection exceeds 20,000 semantic max
    expect((ok as { reason: string }).reason).toBe("MESSAGE_TOO_LONG");

    const oversize = validateConversationContent({ raw: `<p>${"a".repeat(RICH_CONTENT_SERIALIZED_MAX_CHARS)}</p>`, format: "SANITIZED_HTML", source: "STAFF" });
    expect(oversize).toEqual({ ok: false, reason: "CONTENT_TOO_LARGE" });
  });

  it("enforces the Live Chat 2,000-char boundary independently of the 20,000 default", () => {
    const ok = validateConversationContent({ raw: "a".repeat(LIVE_CHAT_CONTENT_MAX_CHARS), format: "PLAIN_TEXT", source: "LIVE_CHAT" });
    expect(ok.ok).toBe(true);
    const tooLong = validateConversationContent({ raw: "a".repeat(LIVE_CHAT_CONTENT_MAX_CHARS + 1), format: "PLAIN_TEXT", source: "LIVE_CHAT" });
    expect(tooLong).toEqual({ ok: false, reason: "MESSAGE_TOO_LONG" });
    // The same length is fine for a non-Live-Chat source.
    const otherSource = validateConversationContent({ raw: "a".repeat(LIVE_CHAT_CONTENT_MAX_CHARS + 1), format: "PLAIN_TEXT", source: "PORTAL" });
    expect(otherSource.ok).toBe(true);
  });

  it("returns declared contentFormat/contentSource on success", () => {
    const result = validateConversationContent({ raw: "hello", format: "PLAIN_TEXT", source: "WHATSAPP" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contentFormat).toBe("PLAIN_TEXT");
      expect(result.contentSource).toBe("WHATSAPP");
      expect(result.plainText).toBe("hello");
    }
  });

  it("sanitizes rich HTML and returns both projections", () => {
    const result = validateConversationContent({ raw: "<p>Hello <b>world</b></p>", format: "SANITIZED_HTML", source: "PORTAL" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sanitizedHtml).toContain("<b>world</b>");
      expect(result.plainText).toBe("Hello world");
    }
  });
});
