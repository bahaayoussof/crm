import { render, cleanup, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConversationAutoScroll } from "./use-conversation-auto-scroll";

// A tiny harness so the hook can own its ref exactly as it does in production.
function Harness({ itemCount, sendToken }: { itemCount: number; sendToken: number }) {
  const ref = useConversationAutoScroll<HTMLDivElement>({ itemCount, sendToken });
  return <div data-testid="scroll" ref={ref} />;
}

const SCROLL_HEIGHT = 1000;
const CLIENT_HEIGHT = 300;

function getScroller() {
  return document.querySelector<HTMLDivElement>('[data-testid="scroll"]')!;
}

let scrollToSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scrollToSpy = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    writable: true,
    value: scrollToSpy,
  });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      return SCROLL_HEIGHT;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      return CLIENT_HEIGHT;
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Move the viewport and fire the scroll event the hook listens for. */
function scrollTo(top: number) {
  const el = getScroller();
  el.scrollTop = top;
  act(() => {
    el.dispatchEvent(new Event("scroll"));
  });
}

describe("useConversationAutoScroll", () => {
  it("jumps to the latest message on initial load", () => {
    render(<Harness itemCount={5} sendToken={0} />);
    expect(scrollToSpy).toHaveBeenCalledWith({ top: SCROLL_HEIGHT, behavior: "auto" });
  });

  it("does not scroll on initial load when there are no messages yet", () => {
    render(<Harness itemCount={0} sendToken={0} />);
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("does NOT force-scroll for an incoming message while the reader is up in history", () => {
    const view = render(<Harness itemCount={5} sendToken={0} />);
    scrollToSpy.mockClear();
    scrollTo(0); // far from the bottom
    view.rerender(<Harness itemCount={6} sendToken={0} />);
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("follows an incoming message when the reader is near the bottom", () => {
    const view = render(<Harness itemCount={5} sendToken={0} />);
    scrollToSpy.mockClear();
    scrollTo(SCROLL_HEIGHT - CLIENT_HEIGHT - 20); // within the 120px threshold
    view.rerender(<Harness itemCount={6} sendToken={0} />);
    expect(scrollToSpy).toHaveBeenCalledWith({ top: SCROLL_HEIGHT, behavior: "smooth" });
  });

  it("scrolls to the newest message when the local user sends, even from up in history", () => {
    const view = render(<Harness itemCount={5} sendToken={0} />);
    scrollToSpy.mockClear();
    scrollTo(0); // reader is not near the bottom
    view.rerender(<Harness itemCount={6} sendToken={1} />);
    expect(scrollToSpy).toHaveBeenCalledWith({ top: SCROLL_HEIGHT, behavior: "smooth" });
  });

  it("ignores re-renders that do not change the message count (typing, pickers, theme…)", () => {
    const view = render(<Harness itemCount={5} sendToken={0} />);
    scrollToSpy.mockClear();
    scrollTo(0);
    view.rerender(<Harness itemCount={5} sendToken={0} />);
    view.rerender(<Harness itemCount={5} sendToken={0} />);
    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});
