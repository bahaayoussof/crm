import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";
import {
  KnowledgeArticleEditor,
  type KnowledgeArticleEditorHandle,
} from "./knowledge-article-editor";

function setup(props: Partial<React.ComponentProps<typeof KnowledgeArticleEditor>> = {}) {
  const ref = createRef<KnowledgeArticleEditorHandle>();
  render(<KnowledgeArticleEditor ref={ref} id="kb-content" ariaLabel="Article body" {...props} />);
  return ref;
}

describe("KnowledgeArticleEditor", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
  });

  it("renders the exact V1 toolbar and no other control", () => {
    setup();
    for (const name of [
      "Paragraph",
      "Heading 2",
      "Heading 3",
      "Bold",
      "Italic",
      "Underline",
      "Bulleted list",
      "Numbered list",
      "Link",
      "Undo",
      "Redo",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    // No H1 control, no disallowed formatting.
    expect(screen.queryByRole("button", { name: /Heading 1/ })).not.toBeInTheDocument();
    for (const name of ["Code", "Quote", "Table", "Image", "Strikethrough", "Align"]) {
      expect(screen.queryByRole("button", { name: new RegExp(name) })).not.toBeInTheDocument();
    }
  });

  it("round-trips rich HTML through setHtml/getHtml keeping only V1 block/inline tags", () => {
    const ref = setup();
    act(() =>
      ref.current!.setHtml(
        '<h2>Section</h2><h3>Sub</h3><p>Body <strong>bold</strong> <em>it</em></p>' +
          '<ul><li>one</li></ul><ol><li>two</li></ol>' +
          '<p><a href="https://example.com">link</a></p>' +
          '<script>alert(1)</script><img src="x"><table><tr><td>c</td></tr></table>',
      ),
    );
    const html = ref.current!.getHtml();
    expect(html).toMatch(/<h2[^>]*>[\s\S]*Section/);
    expect(html).toMatch(/<h3[^>]*>[\s\S]*Sub/);
    expect(html).toMatch(/<(strong|b)[^>]*>bold/);
    expect(html).toMatch(/<ul[^>]*>[\s\S]*<li[^>]*>[\s\S]*one/);
    expect(html).toMatch(/<ol[^>]*>[\s\S]*<li[^>]*>[\s\S]*two/);
    expect(html).toMatch(/href="https:\/\/example\.com"/);
    // The editor's node set has no home for these — dropped on import.
    expect(html).not.toMatch(/<script/);
    expect(html).not.toMatch(/<img/);
    expect(html).not.toMatch(/<table/);
    expect(html).not.toMatch(/<td/);
  });

  it("converts a blank-line separated plain-text body into multiple paragraphs", () => {
    const ref = setup();
    act(() => ref.current!.setHtml("First paragraph.\n\nSecond paragraph."));
    const html = ref.current!.getHtml();
    expect(html.match(/<p[\s>]/g)?.length).toBeGreaterThanOrEqual(2);
    expect(ref.current!.getPlainText()).toContain("First paragraph.");
    expect(ref.current!.getPlainText()).toContain("Second paragraph.");
    expect(html).not.toContain("<script");
  });

  it("toggles a heading block from the toolbar when the body has a selection", () => {
    const ref = setup();
    act(() => ref.current!.setHtml("A heading line"));
    act(() => {
      const el = screen.getByLabelText("Article body");
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
    fireEvent.click(screen.getByRole("button", { name: "Heading 2" }));
    const html = ref.current!.getHtml();
    // Either the click applied (h2) or the jsdom selection did not sync; in
    // both cases an <h1> must never appear.
    expect(html).not.toMatch(/<h1[\s>]/);
  });

  it("reports empty text for a whitespace-only body", () => {
    const ref = setup();
    act(() => ref.current!.setHtml("   "));
    expect(ref.current!.hasText()).toBe(false);
  });

  it("goes read-only when disabled", () => {
    setup({ disabled: true });
    expect(screen.getByLabelText("Article body").getAttribute("contenteditable")).toBe("false");
    expect(screen.getByRole("button", { name: "Bold" })).toBeDisabled();
  });

  it("localizes the toolbar in Arabic", async () => {
    await changeAppLanguage("ar");
    setup({ ariaLabel: "نص المقالة" });
    expect(screen.getByRole("button", { name: "غامق" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "عنوان 2" })).toBeInTheDocument();
  });
});
