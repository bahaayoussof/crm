import { useEffect, useLayoutEffect, useRef } from "react";

// Auto-scroll behaviour for the shared bounded conversation. Lives in the shared
// conversation layer so both the internal Ticket Details view and the Customer
// Portal ticket view get identical behaviour without duplicating logic.
//
// Rules (see the Final UX Polish brief):
//  - initial load  -> jump straight to the latest message
//  - user scrolled up to read history -> leave them alone
//  - new message while the reader is near the bottom -> follow it
//  - the local user sent a message -> always reveal it
// Scroll position only: nothing here ever moves keyboard focus.

// Small tolerance instead of exact equality so sub-pixel rounding, a partially
// visible last row, or a short composer resize still counts as "at the bottom".
const NEAR_BOTTOM_THRESHOLD_PX = 120;

function scrollToLatest(el: HTMLElement, behavior: ScrollBehavior) {
  if (typeof el.scrollTo === "function") {
    el.scrollTo({ top: el.scrollHeight, behavior });
  } else {
    // jsdom / very old engines: no smooth scrolling, just pin to the bottom.
    el.scrollTop = el.scrollHeight;
  }
}

export function useConversationAutoScroll<T extends HTMLElement>({
  itemCount,
  sendToken = 0,
}: {
  /** Number of messages currently rendered in the timeline. */
  itemCount: number;
  /** Increment this whenever the local user successfully sends a message. */
  sendToken?: number;
}) {
  const containerRef = useRef<T | null>(null);
  const nearBottomRef = useRef(true);
  const initializedRef = useRef(false);
  const prevCountRef = useRef(0);
  const prevSendTokenRef = useRef(sendToken);

  // Keep a live read of whether the viewport is parked near the bottom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      nearBottomRef.current = distance < NEAR_BOTTOM_THRESHOLD_PX;
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    return () => el.removeEventListener("scroll", update);
  }, []);

  // Initial load: the first time the conversation has any messages, land on the
  // newest one with no animation. Runs before paint so there is no visible jump.
  useLayoutEffect(() => {
    if (initializedRef.current) return;
    const el = containerRef.current;
    if (!el || itemCount === 0) return;
    initializedRef.current = true;
    prevCountRef.current = itemCount;
    scrollToLatest(el, "auto");
    nearBottomRef.current = true;
  }, [itemCount]);

  // The local user just sent something — always bring it into view.
  useEffect(() => {
    if (prevSendTokenRef.current === sendToken) return;
    prevSendTokenRef.current = sendToken;
    const el = containerRef.current;
    if (!el || !initializedRef.current) return;
    scrollToLatest(el, "smooth");
    nearBottomRef.current = true;
  }, [sendToken]);

  // A new message arrived (from anyone). Follow it only if the reader was
  // already at the bottom; never yank them out of older history.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !initializedRef.current) return;
    const grew = itemCount > prevCountRef.current;
    prevCountRef.current = itemCount;
    if (grew && nearBottomRef.current) scrollToLatest(el, "smooth");
  }, [itemCount]);

  return containerRef;
}
