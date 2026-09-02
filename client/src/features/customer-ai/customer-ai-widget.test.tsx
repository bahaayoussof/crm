import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const hooks = vi.hoisted(() => ({ chatMutate: vi.fn(), handoffMutate: vi.fn(), chatError: undefined as unknown }));
const live = vi.hoisted(() => ({
  bootstrap: { data: null as unknown, refetch: vi.fn() },
  end: { mutateAsync: vi.fn(), isPending: false, isError: false },
  send: { mutate: vi.fn(), isPending: false, isError: false },
  detail: { data: undefined as unknown },
}));

vi.mock("./customer-ai-hooks", () => ({
  useCustomerAiChat: () => ({ mutate: hooks.chatMutate, isPending: false, isError: Boolean(hooks.chatError), error: hooks.chatError }),
  useCustomerAiHandoff: () => ({ mutate: hooks.handoffMutate, isPending: false, isSuccess: false, isError: false }),
}));
vi.mock("@/features/live-chat/live-chat-hooks", () => ({
  liveChatKeys: { root: ["portal", "live-chat"], departments: ["portal", "live-chat", "departments"] },
  useLiveChat: () => live.bootstrap,
  useEndLiveChat: () => live.end,
  useSendLiveChatMessage: () => live.send,
}));
vi.mock("@/features/portal/portal-hooks", () => ({ usePortalTicket: () => live.detail }));

import { CustomerAiWidget } from "./customer-ai-widget";

const liveChat = (over: Record<string, unknown> = {}) => ({
  id: "chat-1234", subject: "Live chat", status: "OPEN", category: null,
  createdAt: "2026-08-25T10:00:00Z", updatedAt: "2026-08-25T11:00:00Z", description: "",
  messages: [{ id: "m1", body: "I need help", createdAt: "2026-08-25T10:00:00Z", author: { id: "c", name: "You", kind: "CUSTOMER" } }],
  feedbackEligible: false, feedback: null, ...over,
});

function Navigation() {
  const navigate = useNavigate();
  return <button onClick={() => navigate("/portal/tickets")}>Requests</button>;
}

function renderWidget(initialEntry = "/portal") {
  return render(<MemoryRouter initialEntries={[initialEntry]}><Navigation /><Routes><Route path="*" element={<CustomerAiWidget />} /></Routes></MemoryRouter>);
}

function openWidget() {
  fireEvent.click(screen.getByRole("button", { name: "Open AI Support" }));
  return document.querySelector("section[aria-label]") as HTMLElement;
}

describe("CustomerAiWidget", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    hooks.chatError = undefined;
    live.bootstrap = { data: null, refetch: vi.fn() };
    live.end = { mutateAsync: vi.fn().mockResolvedValue(liveChat({ status: "RESOLVED" })), isPending: false, isError: false };
    live.send = { mutate: vi.fn(), isPending: false, isError: false };
    live.detail = { data: undefined };
    await changeAppLanguage("en");
  });
  afterEach(cleanup);

  it("anchors the launcher and open panel to the physical bottom-right with the increased desktop height", () => {
    renderWidget();
    expect(screen.getByRole("button", { name: "Open AI Support" })).toHaveClass("fixed", "right-4", "lg:right-6");
    const panel = openWidget();
    expect(panel).toHaveClass("fixed", "sm:right-4", "sm:bottom-4", "sm:w-[400px]");
    expect(panel).toHaveClass("sm:h-[680px]"); // increased desktop height
    expect(panel).toHaveClass("sm:max-h-[calc(100dvh-2rem)]", "max-h-[calc(100dvh-1.5rem)]"); // still viewport bounded
    expect(panel.className).not.toMatch(/(^|\s)(sm:)?end-/);
  });

  it("is non-modal in AI mode: no backdrop, no dialog role, page stays interactive", () => {
    renderWidget();
    openWidget();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("region", { name: "AI Support" })).not.toHaveAttribute("aria-modal");
    expect(document.querySelector(".backdrop-blur-xs, .bg-black\\/40")).toBeNull();
    expect(document.body).not.toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Requests" })).toBeEnabled();
  });

  it("X only minimizes the widget and never ends a chat", () => {
    live.bootstrap = { data: liveChat(), refetch: vi.fn() };
    renderWidget();
    openWidget();
    expect(screen.getByRole("button", { name: /End chat/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close AI Support" }));
    expect(document.querySelector("section[aria-label]")).toBeNull();
    expect(live.end.mutateAsync).not.toHaveBeenCalled();
    // reopen: the live conversation is still active
    openWidget();
    expect(screen.getByRole("button", { name: /End chat/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Type your message/i)).toBeInTheDocument();
  });

  it("shows End chat only for an active Live Chat, not in AI-only mode", () => {
    renderWidget();
    openWidget();
    expect(screen.queryByRole("button", { name: /End chat/i })).toBeNull();
    cleanup();

    live.bootstrap = { data: liveChat(), refetch: vi.fn() };
    renderWidget();
    openWidget();
    expect(screen.getByRole("region", { name: "Live Chat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /End chat/i })).toBeInTheDocument();
  });

  it("does not show End chat for a terminal (resolved) bootstrap chat", () => {
    live.bootstrap = { data: liveChat({ status: "RESOLVED" }), refetch: vi.fn() };
    renderWidget();
    openWidget();
    expect(screen.queryByRole("button", { name: /End chat/i })).toBeNull();
    expect(screen.getByLabelText(/Describe what you need help with/i)).toBeInTheDocument(); // falls back to AI
  });

  it("End chat opens the shared confirmation; Cancel keeps the conversation active", () => {
    live.bootstrap = { data: liveChat(), refetch: vi.fn() };
    renderWidget();
    openWidget();
    fireEvent.click(screen.getByRole("button", { name: /End chat/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("End this chat?");
    fireEvent.click(screen.getByRole("button", { name: "Keep chatting" }));
    expect(live.end.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Type your message/i)).toBeInTheDocument();
  });

  it("Confirm ends via the existing Live Chat end flow, then shows the ended state with Start new chat", async () => {
    live.bootstrap = { data: liveChat(), refetch: vi.fn() };
    renderWidget();
    openWidget();
    fireEvent.click(screen.getByRole("button", { name: /End chat/i }));
    // the destructive confirm action inside the dialog
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "End chat" }));
    await waitFor(() => expect(live.end.mutateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("This chat has ended")).toBeInTheDocument());
    expect(screen.queryByLabelText(/Type your message/i)).toBeNull(); // composer gone
    expect(screen.getByRole("button", { name: "Start new chat" })).toBeInTheDocument();
  });

  it("submits the existing AI flow and preserves conversation across portal navigation", () => {
    hooks.chatMutate.mockImplementation((_input, callbacks) => callbacks.onSuccess({ answer: "Use the reset form.", confidence: 0.9, canHandoff: false, suggestedArticles: [] }));
    renderWidget();
    openWidget();
    fireEvent.change(screen.getByLabelText(/Describe what you need help with/i), { target: { value: "Reset password" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(hooks.chatMutate).toHaveBeenCalledWith(expect.objectContaining({ message: "Reset password", history: [], locale: "en" }), expect.any(Object));
    fireEvent.click(screen.getByRole("button", { name: "Requests" }));
    expect(screen.getByText("Use the reset form.")).toBeInTheDocument();
  });

  it("renders grounded article links and preserves human handoff", () => {
    hooks.chatMutate.mockImplementation((_input, callbacks) => callbacks.onSuccess({
      answer: "I am not fully sure.", confidence: 0.2, canHandoff: true,
      suggestedArticles: [{ id: "published-1", title: "Password help", category: "Account", excerpt: "Safe steps" }],
    }));
    renderWidget();
    openWidget();
    fireEvent.change(screen.getByLabelText(/Describe what you need help with/i), { target: { value: "Help" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("link", { name: "Password help" })).toHaveAttribute("href", "/portal/knowledge-base/published-1");
    fireEvent.click(screen.getByRole("button", { name: "Talk to support" }));
    expect(hooks.handoffMutate).toHaveBeenCalledWith(expect.objectContaining({ message: "Help" }));
  });

  it("renders a single-row composer with an icon-only send button", () => {
    renderWidget();
    openWidget();
    const input = screen.getByLabelText(/Describe what you need help with/i);
    const send = screen.getByRole("button", { name: "Send" });
    expect(input.closest("form")).toContainElement(send);
    expect(input.tagName).toBe("TEXTAREA");
    expect(send).toHaveTextContent("");
    expect(send.querySelector("svg")).not.toBeNull();
    expect(send).toBeDisabled();
    fireEvent.change(input, { target: { value: "Hi" } });
    expect(send).toBeEnabled();
  });

  it("auto-opens the compatibility URL, supports RTL, and keeps the panel bottom-right", async () => {
    hooks.chatError = { isAxiosError: true, response: { data: { error: { code: "RATE_LIMITED" } } } };
    await changeAppLanguage("ar");
    renderWidget("/portal?support=ai");
    const panel = screen.getByRole("region", { name: "الدعم بالذكاء الاصطناعي" });
    expect(document.documentElement.dir).toBe("rtl");
    expect(panel).toHaveClass("sm:right-4");
    expect(screen.getByRole("alert")).toHaveTextContent("طلبات الذكاء الاصطناعي");
    expect(screen.getByRole("button", { name: "التحدث مع الدعم" })).toBeInTheDocument();
  });

  it("keeps the mobile panel within the viewport width", () => {
    renderWidget();
    const panel = openWidget();
    expect(panel).toHaveClass("inset-x-3", "overflow-hidden");
    expect(panel.className).not.toMatch(/w-screen/);
  });
});
