import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";
import { TicketReplyEditor, type TicketReplyEditorHandle } from "./ticket-reply-editor";

function setup(props: Partial<React.ComponentProps<typeof TicketReplyEditor>> = {}) {
  const ref = createRef<TicketReplyEditorHandle>();
  render(
    <TicketReplyEditor
      ref={ref}
      id="conversation-reply"
      ariaLabel="Reply to customer"
      ariaDescribedBy="conversation-reply-help"
      placeholder="Type your reply…"
      {...props}
    />,
  );
  return ref;
}

const editorEl = () => screen.getByLabelText("Reply to customer") as HTMLElement;

describe("TicketReplyEditor", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
  });

  it("renders a contenteditable region with a formatting toolbar", () => {
    setup();
    const el = editorEl();
    expect(el.getAttribute("contenteditable")).toBe("true");
    expect(el).toHaveAttribute("role", "textbox");
    for (const name of ["Bold", "Italic", "Underline", "Bulleted list", "Numbered list", "Link", "Undo", "Redo"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("exposes plain text and serialized HTML through the imperative handle", () => {
    const ref = setup();
    expect(ref.current!.hasText()).toBe(false);
    act(() => ref.current!.insertText("Hello team"));
    expect(ref.current!.getPlainText()).toBe("Hello team");
    expect(ref.current!.hasText()).toBe(true);
    const html = ref.current!.getHtml();
    expect(html).toMatch(/^<p/);
    expect(html).toContain("Hello team");
  });

  it("replaceText swaps the whole draft; clear empties it", () => {
    const ref = setup();
    act(() => ref.current!.insertText("first"));
    act(() => ref.current!.replaceText("second"));
    expect(ref.current!.getPlainText()).toBe("second");
    act(() => ref.current!.clear());
    expect(ref.current!.getPlainText()).toBe("");
    expect(ref.current!.hasText()).toBe(false);
  });

  it("rejects an insertion that would exceed the plain-text limit and leaves the draft untouched", () => {
    const ref = setup();
    act(() => ref.current!.insertText("keep"));
    let outcome: string | undefined;
    act(() => {
      outcome = ref.current!.insertText("x".repeat(20_000));
    });
    expect(outcome).toBe("too-long");
    expect(ref.current!.getPlainText()).toBe("keep");
  });

  it("applies Bold from the toolbar to newly typed text", () => {
    const ref = setup();
    act(() => ref.current!.focus());
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    act(() => ref.current!.insertText("strong words"));
    const html = ref.current!.getHtml();
    expect(html).toMatch(/<(strong|b)[^>]*>[\s\S]*strong words/);
  });

  it("inserts a bulleted list from the toolbar", () => {
    const ref = setup();
    act(() => ref.current!.focus());
    fireEvent.click(screen.getByRole("button", { name: "Bulleted list" }));
    act(() => ref.current!.insertText("point one"));
    const html = ref.current!.getHtml();
    expect(html).toMatch(/<ul[^>]*>/);
    expect(html).toMatch(/<li[^>]*>[\s\S]*point one/);
  });

  it("goes read-only when disabled", () => {
    setup({ disabled: true });
    expect(editorEl().getAttribute("contenteditable")).toBe("false");
    expect(screen.getByRole("button", { name: "Bold" })).toBeDisabled();
  });

  it("localizes the toolbar in Arabic", async () => {
    await changeAppLanguage("ar");
    setup({ ariaLabel: "الرد على العميل" });
    expect(screen.getByRole("button", { name: "غامق" })).toBeInTheDocument();
  });
});
