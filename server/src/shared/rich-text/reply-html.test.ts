import { describe, expect, it } from "vitest";
import {
  articleHtmlToPlainText,
  sanitizeArticleHtml,
  sanitizeReplyHtml,
  replyHtmlToPlainText,
} from "./reply-html.js";

describe("sanitizeReplyHtml (unchanged reply behavior)", () => {
  it("keeps the reply allowlist and forces safe link rel/target", () => {
    const clean = sanitizeReplyHtml('<p>Hi <b>there</b></p><a href="https://example.com">link</a>');
    expect(clean).toContain("<b>there</b>");
    expect(clean).toContain('rel="noopener noreferrer nofollow"');
    expect(clean).toContain('target="_blank"');
  });

  it("strips scripts, handlers, styles, media and unsafe hrefs", () => {
    const clean = sanitizeReplyHtml(
      '<p onclick="x()">t</p><script>alert(1)</script><img src="x"><a href="javascript:alert(1)">x</a>',
    );
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("<img");
    expect(clean).not.toContain("javascript:");
    expect(clean).toContain("t");
  });

  it("does not keep h2/h3 (reply set has no headings)", () => {
    expect(sanitizeReplyHtml("<h2>Title</h2><p>body</p>")).not.toContain("<h2");
  });

  it("returns '' for markup-only / whitespace-only input", () => {
    expect(sanitizeReplyHtml("  <p></p> ")).toBe("");
  });
});

describe("replyHtmlToPlainText (unchanged reply flattening)", () => {
  it("flattens paragraphs, lists and breaks to newlines and decodes entities", () => {
    expect(replyHtmlToPlainText("<p>a</p><ul><li>b</li><li>c</li></ul>")).toBe("a\nb\nc");
    expect(replyHtmlToPlainText("x&amp;y<br>z")).toBe("x&y\nz");
  });
});

describe("sanitizeArticleHtml", () => {
  it("keeps h2/h3 plus the reply set", () => {
    const clean = sanitizeArticleHtml(
      "<h2>Section</h2><h3>Sub</h3><p>Body <strong>bold</strong></p><ul><li>item</li></ul><ol><li>one</li></ol>",
    );
    expect(clean).toContain("<h2>Section</h2>");
    expect(clean).toContain("<h3>Sub</h3>");
    expect(clean).toContain("<strong>bold</strong>");
    expect(clean).toContain("<ul><li>item</li></ul>");
    expect(clean).toContain("<ol><li>one</li></ol>");
  });

  it("drops script, event handlers, img, iframe, style and class", () => {
    const clean = sanitizeArticleHtml(
      '<h2 class="danger" style="color:red" onclick="x()">Title</h2>' +
        '<script>alert(1)</script><iframe src="https://evil"></iframe>' +
        '<img src="x" onerror="y()"><p>safe text</p>',
    );
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("<iframe");
    expect(clean).not.toContain("<img");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("class=");
    expect(clean).not.toContain("style=");
    expect(clean).toContain("Title");
    expect(clean).toContain("safe text");
  });

  it("drops javascript:/data: links but keeps http/https/mailto and forces safe rel/target", () => {
    const clean = sanitizeArticleHtml(
      '<p><a href="javascript:alert(1)">x</a> <a href="data:text/html,x">y</a> ' +
        '<a href="https://example.com">ok</a> <a href="mailto:a@b.com">mail</a></p>',
    );
    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("data:text/html");
    expect(clean).toContain('href="https://example.com"');
    expect(clean).toContain('href="mailto:a@b.com"');
    expect(clean).toContain('rel="noopener noreferrer nofollow"');
    expect(clean).toContain('target="_blank"');
  });

  it("returns '' when the sanitized value has no visible text", () => {
    expect(sanitizeArticleHtml("  <p></p> ")).toBe("");
    expect(sanitizeArticleHtml("<script>alert(1)</script>")).toBe("");
  });
});

describe("articleHtmlToPlainText", () => {
  it("flattens headings and lists to readable multi-line text with no tags/entities", () => {
    const text = articleHtmlToPlainText("<h2>A</h2><p>b</p><ul><li>c</li><li>d</li></ul>");
    expect(text).toBe("A\nb\nc\nd");
    expect(text).not.toMatch(/[<>]/);
    expect(text).not.toContain("&");
  });

  it("is the same transform as replyHtmlToPlainText for heading-free input", () => {
    const input = "<p>hello</p><ul><li>x</li></ul>";
    expect(articleHtmlToPlainText(input)).toBe(replyHtmlToPlainText(input));
  });
});
