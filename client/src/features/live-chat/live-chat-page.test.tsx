import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  departments: vi.fn(),
  start: vi.fn(),
  send: vi.fn(),
  detail: vi.fn(),
  attachList: vi.fn(),
  attachUpload: vi.fn(),
  status: vi.fn(),
  refetch: vi.fn(),
  startMutate: vi.fn(),
  sendMutate: vi.fn(),
  uploadMutate: vi.fn(),
}));

vi.mock("./live-chat-hooks", () => ({
  liveChatKeys: { root: ["portal", "live-chat"], departments: ["portal", "live-chat", "departments"] },
  useLiveChat: mocks.bootstrap,
  useLiveChatDepartments: mocks.departments,
  useStartLiveChat: mocks.start,
  useSendLiveChatMessage: mocks.send,
}));
vi.mock("@/features/portal/portal-hooks", () => ({ usePortalTicket: mocks.detail }));
vi.mock("@/features/attachments/attachment-hooks", () => ({
  usePortalTicketAttachments: mocks.attachList,
  useUploadPortalTicketAttachment: mocks.attachUpload,
}));
vi.mock("@/features/realtime/realtime-status", () => ({ useRealtimeStatus: mocks.status }));

import { LiveChatPage } from "./live-chat-page";

const message = (over: Partial<{ id: string; body: string; kind: "CUSTOMER" | "SUPPORT" }> = {}) => ({
  id: over.id ?? "m1",
  body: over.body ?? "Hello there",
  createdAt: "2026-08-25T10:00:00Z",
  author: { id: "a", name: "x", kind: over.kind ?? "CUSTOMER" },
});

const chat = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "chat-12345678",
  subject: "Live chat",
  status: "OPEN" as const,
  category: null,
  createdAt: "2026-08-25T10:00:00Z",
  updatedAt: "2026-08-25T11:00:00Z",
  description: "Live chat session started from the customer portal.",
  messages: [message({ id: "c1", body: "I need help", kind: "CUSTOMER" }), message({ id: "s1", body: "Happy to help", kind: "SUPPORT" })],
  feedbackEligible: false,
  feedback: null,
  ...over,
});

const renderPage = () => render(<MemoryRouter initialEntries={["/portal/live-chat"]}><LiveChatPage /></MemoryRouter>);

describe("LiveChatPage", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
    mocks.bootstrap.mockReturnValue({ data: chat(), isLoading: false, isError: false, refetch: mocks.refetch });
    mocks.departments.mockReturnValue({
      data: [
        { id: "d1", name: "Billing" },
        { id: "d2", name: "Technical Support" },
      ],
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: mocks.refetch,
    });
    mocks.detail.mockReturnValue({ data: chat() });
    mocks.start.mockReturnValue({ mutate: mocks.startMutate, isPending: false, isError: false });
    mocks.send.mockReturnValue({ mutateAsync: mocks.sendMutate, isPending: false, isError: false });
    mocks.attachList.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: mocks.refetch });
    mocks.attachUpload.mockReturnValue({ mutateAsync: mocks.uploadMutate, isPending: false });
    mocks.status.mockReturnValue("open");
  });

  it("shows the loading skeleton", () => {
    mocks.bootstrap.mockReturnValue({ isLoading: true });
    renderPage();
    expect(screen.getByTestId("live-chat-skeleton")).toBeInTheDocument();
  });

  it("shows the load error with a retry", () => {
    mocks.bootstrap.mockReturnValue({ isError: true, refetch: mocks.refetch });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.refetch).toHaveBeenCalled();
  });

  const noChat = () =>
    mocks.bootstrap.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: mocks.refetch });

  it("shows the department start screen when there is no active chat", () => {
    noChat();
    renderPage();
    expect(screen.getByRole("heading", { name: "Start a live chat" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Department" })).toBeInTheDocument();
    // no internal CRM controls/metadata on the start screen
    expect(screen.queryByRole("combobox", { name: "Team" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Branch" })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/priority|\bsla\b|watcher|assigned to/i);
  });

  it("keeps Start disabled until a department is chosen, then submits the department id", async () => {
    noChat();
    renderPage();
    expect(screen.getByRole("button", { name: "Start live chat" })).toBeDisabled();

    fireEvent.click(screen.getByRole("combobox", { name: "Department" }));
    fireEvent.click(await screen.findByRole("option", { name: "Technical Support" }));

    const startButton = screen.getByRole("button", { name: "Start live chat" });
    await waitFor(() => expect(startButton).toBeEnabled());
    fireEvent.click(startButton);
    expect(mocks.startMutate).toHaveBeenCalledWith("d2");
  });

  it("shows the loading state while departments load and disables the selector", () => {
    noChat();
    mocks.departments.mockReturnValue({ isLoading: true, isError: false, isSuccess: false, refetch: mocks.refetch });
    renderPage();
    expect(screen.getByRole("combobox", { name: "Department" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Start live chat" })).toBeDisabled();
  });

  it("shows an unavailable message when there are no routable departments", () => {
    noChat();
    mocks.departments.mockReturnValue({ data: [], isLoading: false, isError: false, isSuccess: true, refetch: mocks.refetch });
    renderPage();
    expect(screen.getByText(/Live chat isn't available right now/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start live chat" })).toBeDisabled();
  });

  it("shows a departments load error with a retry", () => {
    noChat();
    mocks.departments.mockReturnValue({ isError: true, isLoading: false, isSuccess: false, refetch: mocks.refetch });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it("shows a pending start state", async () => {
    noChat();
    mocks.start.mockReturnValue({ mutate: mocks.startMutate, isPending: true, isError: false });
    renderPage();
    expect(screen.getByRole("button", { name: "Starting…" })).toBeDisabled();
  });

  it("keeps the start screen usable after a start error", () => {
    noChat();
    mocks.start.mockReturnValue({ mutate: mocks.startMutate, isPending: false, isError: true });
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't start the chat. Please try again.");
    expect(screen.getByRole("combobox", { name: "Department" })).toBeEnabled();
  });

  it("renders an active chat with viewer-relative bubbles and no internal metadata", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Live Chat" })).toBeInTheDocument();
    expect(screen.getByText("I need help")).toBeInTheDocument();
    expect(screen.getByText("Happy to help")).toBeInTheDocument();
    // customer bubble aligns to the end, support bubble to the start
    const you = screen.getByText("I need help").closest("li");
    const them = screen.getByText("Happy to help").closest("li");
    expect(you?.className).toContain("justify-end");
    expect(them?.className).toContain("justify-start");
    // never leaks internal-only ticket fields / metadata
    expect(document.body.textContent).not.toMatch(/assigned to|internal note|sla|watcher|escalat|priority/i);
  });

  it("keeps the send button disabled until a message is typed", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("shows the pending send state", () => {
    mocks.send.mockReturnValue({ mutateAsync: mocks.sendMutate, isPending: true, isError: false });
    renderPage();
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  });

  it("shows a send error for retry", () => {
    mocks.send.mockReturnValue({ mutateAsync: mocks.sendMutate, isPending: false, isError: true });
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Your message didn't send. Try again.");
  });

  it("surfaces the reconnecting connection state and banner", () => {
    mocks.status.mockReturnValue("reconnecting");
    renderPage();
    expect(screen.getAllByText("Reconnecting…").length).toBeGreaterThan(0);
    expect(screen.getByText(/Live updates are reconnecting/)).toBeInTheDocument();
  });

  it("shows the connected state with no banner when the stream is open", () => {
    renderPage();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.queryByText(/Live updates are reconnecting/)).not.toBeInTheDocument();
  });

  it("renders persisted history from the canonical query after remount", () => {
    // bootstrap is stale/empty; usePortalTicket is the source of truth
    mocks.bootstrap.mockReturnValue({ data: chat({ messages: [] }), isLoading: false, isError: false });
    mocks.detail.mockReturnValue({ data: chat({ messages: [message({ id: "p1", body: "Recovered after refresh", kind: "SUPPORT" })] }) });
    renderPage();
    expect(screen.getByText("Recovered after refresh")).toBeInTheDocument();
  });

  it("is read-only when the chat is closed", () => {
    mocks.bootstrap.mockReturnValue({ data: chat({ status: "CLOSED" }), isLoading: false, isError: false });
    mocks.detail.mockReturnValue({ data: chat({ status: "CLOSED" }) });
    renderPage();
    expect(screen.getByText(/This chat is closed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("warns that a resolved chat will reopen on reply", () => {
    mocks.bootstrap.mockReturnValue({ data: chat({ status: "RESOLVED" }), isLoading: false, isError: false });
    mocks.detail.mockReturnValue({ data: chat({ status: "RESOLVED" }) });
    renderPage();
    expect(screen.getByText(/Sending a message will reopen it/)).toBeInTheDocument();
  });

  it("renders Arabic + RTL", async () => {
    await changeAppLanguage("ar");
    renderPage();
    expect(screen.getByRole("heading", { name: "الدردشة المباشرة" })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
    await changeAppLanguage("en");
  });

  it("renders the start screen in Arabic + RTL", async () => {
    await changeAppLanguage("ar");
    noChat();
    renderPage();
    expect(screen.getByRole("heading", { name: "ابدأ دردشة مباشرة" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "القسم" })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
    await changeAppLanguage("en");
  });

  it("opens the attachment upload modal from the composer", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Attach file" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
