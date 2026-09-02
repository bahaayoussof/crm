import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const hooks = vi.hoisted(() => ({ chatMutate: vi.fn(), handoffMutate: vi.fn(), chatError: undefined as unknown }));
vi.mock("./customer-ai-hooks", () => ({
  useCustomerAiChat: () => ({ mutate: hooks.chatMutate, isPending: false, isError: Boolean(hooks.chatError), error: hooks.chatError }),
  useCustomerAiHandoff: () => ({ mutate: hooks.handoffMutate, isPending: false, isSuccess: false, isError: false }),
}));
import { CustomerAiWidget } from "./customer-ai-widget";

function Navigation() {
  const navigate = useNavigate();
  return <button onClick={() => navigate("/portal/tickets")}>Requests</button>;
}

function renderWidget(initialEntry = "/portal") {
  return render(<MemoryRouter initialEntries={[initialEntry]}><Navigation /><Routes><Route path="*" element={<CustomerAiWidget />} /></Routes></MemoryRouter>);
}

function openWidget() {
  fireEvent.click(screen.getByRole("button", { name: "Open AI Support" }));
  return screen.getByRole("region", { name: "AI Support" });
}

describe("CustomerAiWidget", () => {
  beforeEach(async () => { vi.clearAllMocks(); hooks.chatError = undefined; await changeAppLanguage("en"); });
  afterEach(cleanup);

  it("anchors the launcher and open panel to the physical bottom-right", () => {
    renderWidget();
    expect(screen.getByRole("button", { name: "Open AI Support" })).toHaveClass("fixed", "right-4", "lg:right-6");
    const panel = openWidget();
    expect(panel).toHaveClass("fixed", "sm:right-4", "sm:bottom-4", "sm:w-[400px]");
    // logical `end-*` would flip in RTL — must be physical `right-*`.
    expect(panel.className).not.toMatch(/(^|\s)(sm:)?end-/);
  });

  it("is non-modal: no backdrop, no dialog role, page stays interactive", () => {
    renderWidget();
    openWidget();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("region", { name: "AI Support" })).not.toHaveAttribute("aria-modal");
    expect(document.querySelector(".backdrop-blur-xs, .bg-black\\/40")).toBeNull();
    // nothing overlays / hides / inerts the rest of the page
    expect(document.body).not.toHaveAttribute("inert");
    expect(document.body).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("button", { name: "Requests" })).toBeEnabled();
  });

  it("closes back to the launcher without navigating away", () => {
    renderWidget("/portal/tickets");
    openWidget();
    fireEvent.click(screen.getByRole("button", { name: "Close AI Support" }));
    expect(screen.queryByRole("region", { name: "AI Support" })).toBeNull();
    const launcher = screen.getByRole("button", { name: "Open AI Support" });
    expect(launcher).toHaveFocus();
  });

  it("renders a single-row composer with an icon-only send button", () => {
    renderWidget();
    openWidget();
    const input = screen.getByLabelText(/Describe what you need help with/i);
    const send = screen.getByRole("button", { name: "Send" });
    const form = input.closest("form")!;
    expect(form).toHaveClass("flex");
    expect(form).toContainElement(send);
    expect(input.tagName).toBe("TEXTAREA");
    expect(send).toHaveTextContent(""); // icon only, accessible label supplies the name
    expect(send.querySelector("svg")).not.toBeNull();
    expect(send).toBeDisabled(); // empty draft
    fireEvent.change(input, { target: { value: "Hi" } });
    expect(send).toBeEnabled();
  });

  it("submits the existing flow and preserves conversation across portal navigation", () => {
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

  it("auto-opens the compatibility URL, supports RTL, and keeps the panel bottom-right", async () => {
    hooks.chatError = { isAxiosError: true, response: { data: { error: { code: "RATE_LIMITED" } } } };
    await changeAppLanguage("ar");
    renderWidget("/portal?support=ai");
    const panel = screen.getByRole("region", { name: "الدعم بالذكاء الاصطناعي" });
    expect(document.documentElement.dir).toBe("rtl");
    expect(panel).toHaveClass("sm:right-4"); // still physical right in RTL
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
