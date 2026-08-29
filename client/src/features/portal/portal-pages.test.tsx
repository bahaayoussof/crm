import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({ overview: vi.fn(), tickets: vi.fn(), detail: vi.fn(), categories: vi.fn(), create: vi.fn(), reply: vi.fn(), feedback: vi.fn(), auth: vi.fn(), refetch: vi.fn(), mutate: vi.fn(), attachList: vi.fn(), attachUpload: vi.fn(), uploadFn: vi.fn() }));
vi.mock("./portal-hooks", () => ({ usePortalOverview: mocks.overview, usePortalTickets: mocks.tickets, usePortalTicket: mocks.detail, usePortalCategories: mocks.categories, useCreatePortalTicket: mocks.create, useReplyPortalTicket: mocks.reply, useSubmitPortalFeedback: mocks.feedback }));
vi.mock("@/features/auth/auth-state", () => ({ useAuth: mocks.auth }));
vi.mock("@/features/attachments/attachment-hooks", () => ({
  usePortalTicketAttachments: mocks.attachList,
  useUploadPortalTicketAttachment: mocks.attachUpload,
}));
import { PortalHomePage, PortalNewTicketPage, PortalTicketDetailPage, PortalTicketsPage } from "./portal-pages";

const ticket = { id: "ticket-12345678", subject: "Payment help", status: "OPEN" as const, category: { id: "cat", name: "Billing" }, createdAt: "2026-08-25T10:00:00Z", updatedAt: "2026-08-25T11:00:00Z" };
describe("portal pages", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en"); vi.clearAllMocks(); mocks.auth.mockReturnValue({ user: { name: "Ahmed" } });
    mocks.overview.mockReturnValue({ data: { counts: { open: 2, waitingForYou: 1, resolved: 3 }, recentTickets: [ticket] } });
    mocks.tickets.mockReturnValue({ data: { data: [ticket], meta: { page: 1, totalPages: 1 } } });
    mocks.categories.mockReturnValue({ data: [{ id: "cat", name: "Billing" }] });
    mocks.create.mockReturnValue({ mutateAsync: mocks.mutate, isPending: false });
    mocks.reply.mockReturnValue({ mutateAsync: mocks.mutate, isPending: false });
    mocks.feedback.mockReturnValue({ mutateAsync: mocks.mutate, isPending: false });
    mocks.attachList.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: mocks.refetch });
    mocks.uploadFn.mockResolvedValue({});
    mocks.attachUpload.mockReturnValue({ mutateAsync: mocks.uploadFn, isPending: false });
  });
  it("shows overview metrics and responsive recent requests", () => { renderPage(<PortalHomePage />); expect(screen.getByRole("heading", { name: "Welcome, Ahmed" })).toBeInTheDocument(); expect(screen.getByText("Waiting for You")).toBeInTheDocument(); expect(screen.getAllByText("Payment help")).toHaveLength(2); expect(screen.getByRole("table")).toBeInTheDocument(); });
  it("renders loading and retry states", () => { mocks.overview.mockReturnValue({ isLoading: true }); const view = renderPage(<PortalHomePage />); expect(screen.getByTestId("portal-overview-skeleton")).toBeInTheDocument(); view.unmount(); mocks.overview.mockReturnValue({ isError: true, refetch: mocks.refetch }); renderPage(<PortalHomePage />); fireEvent.click(screen.getByRole("button", { name: "Retry" })); expect(mocks.refetch).toHaveBeenCalled(); });
  it("owns search + status/priority/category filters in the URL and renders no results", () => {
    mocks.tickets.mockReturnValue({ data: { data: [], meta: { page: 1, totalPages: 0 } } });
    renderPage(<PortalTicketsPage />, "/portal/tickets?search=missing&status=RESOLVED&priority=HIGH&categoryId=cat");
    expect(screen.getByDisplayValue("missing")).toBeInTheDocument();
    // filters live in the shared filter popover
    fireEvent.click(screen.getByRole("button", { name: "Request filters" }));
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveTextContent("Resolved");
    expect(screen.getByRole("combobox", { name: "Priority" })).toHaveTextContent("High");
    expect(screen.getByRole("combobox", { name: "Category" })).toHaveTextContent("Billing");
    expect(screen.getByText("No requests match your search or filter.")).toBeInTheDocument();
    // the query is scoped server-side, never client-filtered
    expect(mocks.tickets).toHaveBeenCalledWith(expect.objectContaining({ status: "RESOLVED", priority: "HIGH", categoryId: "cat", page: 1, limit: 10 }));
  });

  it("renders the shared DataTable with customer-safe columns only", () => {
    mocks.tickets.mockReturnValue({ data: { data: [{ ...ticket, priority: "MEDIUM" }], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } } });
    renderPage(<PortalTicketsPage />, "/portal/tickets");
    expect(screen.getByRole("columnheader", { name: "Priority" })).toBeInTheDocument();
    expect(screen.getAllByText("Payment help").length).toBeGreaterThan(0);
    // internal-only columns never appear
    for (const name of ["Customer", "Assigned agent", "Channel", "SLA"]) {
      expect(screen.queryByRole("columnheader", { name })).not.toBeInTheDocument();
    }
  });
  it("renders visible accessible creation controls and only Portal fields", () => {
    renderPage(<PortalNewTicketPage />);
    expect(screen.getByLabelText("Subject")).toHaveClass("input");
    expect(screen.getByRole("combobox", { name: /Category/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toHaveClass("input");
    expect(screen.queryByText(/priority|assignee/i)).not.toBeInTheDocument();
  });
  it("keeps required validation associated with the fields", async () => { renderPage(<PortalNewTicketPage />); fireEvent.click(screen.getByRole("button", { name: "Create New Request" })); await waitFor(() => expect(screen.getByText(/Subject must be/)).toBeInTheDocument()); expect(screen.getByLabelText("Subject")).toHaveAttribute("aria-invalid", "true"); expect(screen.getByLabelText("Description")).toHaveAccessibleDescription(/Description is required/); });
  it("preserves failed form values and prevents repeated pending submission", () => { mocks.create.mockReturnValue({ mutateAsync: mocks.mutate, isPending: true, isError: true }); renderPage(<PortalNewTicketPage />); fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Payment problem" } }); fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Still failing" } }); expect(screen.getByLabelText("Subject")).toHaveValue("Payment problem"); expect(screen.getByLabelText("Description")).toHaveValue("Still failing"); expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled(); expect(screen.getByText(/content has been preserved/)).toBeInTheDocument(); });
  it("shows safe authors and preserves a failed reply", () => {
    mocks.detail.mockReturnValue({ data: { ...ticket, status: "RESOLVED", description: "Details", messages: [{ id: "m", body: "We can help", createdAt: ticket.updatedAt, author: { id: "a", name: "Mariam", kind: "SUPPORT" } }] } });
    mocks.reply.mockReturnValue({ mutateAsync: mocks.mutate, isPending: false, isError: true }); renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    expect(screen.getByText("Support Team")).toBeInTheDocument(); expect(screen.getByText("Replying will reopen this request.")).toBeInTheDocument();
    // The composer is the shared rich (contenteditable) editor; the failed-reply notice stays.
    expect((document.querySelector("#portal-reply") as HTMLElement).getAttribute("contenteditable")).toBe("true");
    expect(screen.getByText(/message has been preserved/)).toBeInTheDocument();
  });
  it("never renders internal SLA state, target, or deadlines even if present in the payload", () => {
    mocks.detail.mockReturnValue({ data: { ...ticket, status: "OPEN", description: "Details", messages: [], slaState: "BREACHED", effectiveSlaTarget: "FIRST_RESPONSE", effectiveSlaDueAt: "2026-08-25T09:00:00Z", firstResponseDueAt: "2026-08-25T09:00:00Z", firstRespondedAt: null, resolutionDueAt: "2026-08-26T09:00:00Z" } });
    const { container } = renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    for (const text of [/SLA/i, /Breached/i, /At risk/i, /On track/i, /First response due/i, /Resolution due/i, /Effective deadline/i]) expect(screen.queryByText(text)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/BREACHED|FIRST_RESPONSE/);
  });
  it("collects a rating and comment for an eligible resolved ticket and blocks submit until a rating is chosen", async () => {
    mocks.detail.mockReturnValue({ data: { ...ticket, status: "RESOLVED", description: "Details", messages: [], feedbackEligible: true, feedback: null } });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    fireEvent.click(screen.getByRole("button", { name: "Submit Feedback" }));
    expect(screen.getByText("Select a rating before submitting.")).toBeInTheDocument();
    expect(mocks.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("4 out of 5"));
    fireEvent.change(screen.getByLabelText("Additional comments (optional)"), { target: { value: "Fast and helpful" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit Feedback" }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ rating: 4, comment: "Fast and helpful" }));
  });
  it("renders submitted feedback read-only without a form", () => {
    mocks.detail.mockReturnValue({ data: { ...ticket, status: "CLOSED", description: "Details", messages: [], feedbackEligible: true, feedback: { rating: 5, comment: "Excellent", createdAt: ticket.updatedAt } } });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    expect(screen.getByText("Your feedback")).toBeInTheDocument();
    expect(screen.getByText("Excellent")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "5 out of 5" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit Feedback" })).not.toBeInTheDocument();
  });
  it("omits the feedback section for a ticket that is not eligible", () => {
    mocks.detail.mockReturnValue({ data: { ...ticket, status: "OPEN", description: "Details", messages: [], feedbackEligible: false, feedback: null } });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    expect(screen.queryByText("Rate your experience")).not.toBeInTheDocument();
  });
  it("hides closed composer and localizes RTL", async () => { await changeAppLanguage("ar"); mocks.detail.mockReturnValue({ data: { ...ticket, status: "CLOSED", description: "Details", messages: [] } }); renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678"); expect(screen.getByText("هذا الطلب مغلق ولم يعد يقبل الردود.")).toBeInTheDocument(); expect(screen.queryByRole("button", { name: "إرسال الرد" })).not.toBeInTheDocument(); expect(document.documentElement).toHaveAttribute("dir", "rtl"); expect(document.querySelector('bdi[dir="ltr"]')).toBeInTheDocument(); });
});

// Portal Ticket Details is refactored to share the internal Ticket Details visual
// language (bordered conversation card, side-aligned message bubbles, long-content
// containment, Show more disclosure, content-sized Send) while exposing only
// customer-safe data through the ownership-safe Portal APIs.
describe("portal ticket details shares the internal ticket design", () => {
  afterEach(cleanup);
  const LONG_URL = `https://example.com/${"segment-".repeat(40)}end?token=${"x".repeat(160)}`;
  const MARKER = "MARKER_PORTAL_LONG_MESSAGE";
  const longMessage = `${MARKER} ${LONG_URL}\n`.concat(
    Array.from({ length: 14 }, (_, i) => `paragraph ${i} of a long support reply`).join("\n"),
  );
  const detail = (overrides: Record<string, unknown> = {}) => ({
    ...ticket,
    description: `Repro with a long url ${LONG_URL}`,
    feedbackEligible: false,
    feedback: null,
    messages: [
      { id: "m1", body: "Hi, my card was charged twice.", createdAt: ticket.createdAt, author: { id: "c1", name: "Ahmed", kind: "CUSTOMER" } },
      { id: "m2", body: longMessage, createdAt: ticket.updatedAt, author: { id: "s1", name: "Mariam", kind: "SUPPORT" } },
    ],
    ...overrides,
  });
  const longBody = () => screen.getByText(new RegExp(MARKER), { selector: "p" });
  const bubble = (text: string) => screen.getByText(text, { selector: "p" }).closest("article") as HTMLElement;

  beforeEach(async () => {
    await changeAppLanguage("en"); vi.clearAllMocks(); mocks.auth.mockReturnValue({ user: { name: "Ahmed" } });
    mocks.reply.mockReturnValue({ mutateAsync: mocks.mutate, isPending: false });
    mocks.feedback.mockReturnValue({ mutateAsync: mocks.mutate, isPending: false });
  });

  it("renders the conversation inside the shared bordered card shell with a timeline list", () => {
    mocks.detail.mockReturnValue({ data: detail() });
    const { container } = renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    const list = screen.getByRole("list", { name: "Request conversation" });
    const card = list.closest("section.overflow-hidden.rounded-md.border") as HTMLElement;
    expect(card).toBeTruthy();
    expect(within(card).getByRole("heading", { name: "Conversation" })).toBeInTheDocument();
    expect(container.querySelector(".grid.gap-6")).toBeNull(); // no internal sidebar grid
  });

  it("aligns the customer's own messages to the end and support messages to the start (viewer-relative)", () => {
    mocks.detail.mockReturnValue({ data: detail() });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    const customer = bubble("Hi, my card was charged twice.");
    const support = longBody().closest("article") as HTMLElement;
    for (const b of [customer, support]) {
      expect(b.className).toMatch(/sm:max-w-\[62%\]/);
      expect(b.className).toMatch(/min-w-0/);
    }
    // Portal alignment is viewer-relative — opposite of the internal staff view.
    expect((customer.closest("li") as HTMLElement).className).toMatch(/justify-end/);
    expect((support.closest("li") as HTMLElement).className).toMatch(/justify-start/);
  });

  it("contains long unbroken message content and preserves newlines", () => {
    mocks.detail.mockReturnValue({ data: detail() });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    expect(longBody().className).toMatch(/\[overflow-wrap:anywhere\]/);
    expect(longBody().className).toMatch(/whitespace-pre-wrap/);
    // description card too
    expect(screen.getByText(/Repro with a long url/, { selector: "p" }).className).toMatch(/\[overflow-wrap:anywhere\]/);
  });

  it("progressively discloses a long message and keeps a short one fully visible", () => {
    mocks.detail.mockReturnValue({ data: detail() });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    expect(within(bubble("Hi, my card was charged twice.")).queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
    const support = longBody().closest("article") as HTMLElement;
    const toggle = within(support).getByRole("button", { name: "Show more" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(longBody().className).toMatch(/line-clamp-\[10\]/);
    fireEvent.click(toggle);
    expect(within(support).getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    expect(longBody().className).not.toMatch(/line-clamp/);
  });

  it("labels authors as You / Support Team and never exposes internal roles, notes, or controls", () => {
    mocks.detail.mockReturnValue({ data: detail({ status: "IN_PROGRESS", slaState: "BREACHED", priority: "URGENT" }) });
    const { container } = renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Support Team")).toBeInTheDocument();
    expect(screen.queryByText(/internal note/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/visible to customer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/quick repl/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /insert quick reply/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/manage ticket|assigned agent|priority|escalat/i)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/BREACHED|URGENT|SLA/);
  });

  it("gives the reply composer the shared rich editor + footer layout with a content-sized Reply on desktop", () => {
    mocks.detail.mockReturnValue({ data: detail({ status: "OPEN" }) });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    const send = screen.getByRole("button", { name: "Reply" });
    expect(send.className).toMatch(/\bbutton-primary\b/);
    expect(send.className).toMatch(/sm:w-auto/);
    expect(send.className).toMatch(/sm:ms-auto/);
    const footer = send.parentElement as HTMLElement;
    expect(footer.className).toMatch(/flex-col/);
    expect(footer.className).toMatch(/sm:flex-row/);
    expect(footer.className).toMatch(/border-t/);
    // shared Lexical editor (contenteditable), not a plain textarea
    const editor = document.querySelector("#portal-reply") as HTMLElement;
    expect(editor.getAttribute("contenteditable")).toBe("true");
    expect(editor.className).toMatch(/min-h-\[7rem\]/);
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
  });

  it("replaces the composer with a calm localized notice on a closed ticket", () => {
    mocks.detail.mockReturnValue({ data: detail({ status: "CLOSED" }) });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    const notice = screen.getByText("This request is closed and no longer accepts replies.");
    expect(notice.className).toMatch(/rounded-md/);
    expect(notice.className).toMatch(/border/);
    expect(screen.queryByRole("button", { name: "Send Reply" })).not.toBeInTheDocument();
  });

  it("shows the status as a bordered colour-coded badge like the internal view", () => {
    mocks.detail.mockReturnValue({ data: detail({ status: "WAITING_FOR_YOU" }) });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    const badge = screen.getByText("Waiting for you");
    expect(badge.className).toMatch(/\bborder\b/);
    expect(badge.className).not.toMatch(/bg-muted/);
  });

  it("wraps the attachments panel in the shared card treatment", () => {
    mocks.detail.mockReturnValue({ data: detail() });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    const heading = screen.getByRole("heading", { name: "Attachments" });
    const card = heading.closest("section.rounded-md.border.bg-card") as HTMLElement;
    expect(card).toBeTruthy();
  });

  it("keeps Arabic author labels and RTL", async () => {
    await changeAppLanguage("ar");
    mocks.detail.mockReturnValue({ data: detail() });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    expect(screen.getByText("أنت")).toBeInTheDocument();
    expect(screen.getByText("فريق الدعم")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
  });

  it("composes the shared TicketDetailHeader with only customer-safe content", () => {
    mocks.detail.mockReturnValue({ data: detail({ status: "IN_PROGRESS" }) });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    const header = screen.getByRole("heading", { level: 1, name: "Payment help" }).closest("header") as HTMLElement;
    expect(header).toBeTruthy();
    // shared header shell: back link + reference + status chip + customer-safe meta
    expect(within(header).getByRole("link", { name: "Back to My Requests" })).toHaveAttribute("href", "/portal/tickets");
    expect(within(header).getByText("#12345678")).toBeInTheDocument();
    expect(within(header).getByText("In progress")).toBeInTheDocument();
    // Category / Created / Updated moved to the customer-safe context strip (a sibling, not the header).
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
    // internal-only header affordances never appear
    expect(within(header).queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByText(/priority|channel|web|email|whatsapp|assignee|followers/i)).not.toBeInTheDocument();
  });

  it("excludes every internal-only Ticket Details section from the customer view", () => {
    mocks.detail.mockReturnValue({
      data: detail({ status: "IN_PROGRESS", slaState: "BREACHED", priority: "URGENT", assignedAgent: { id: "a", name: "Mariam" }, history: [{ id: "h", action: "ESCALATED" }] }),
    });
    const { container } = renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    // customer-safe sections ARE present
    expect(screen.getByRole("heading", { name: "Description" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Conversation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Attachments" })).toBeInTheDocument();
    // internal-only sections / controls / data are NOT
    for (const pattern of [
      /internal note/i, /add note/i, /manage ticket/i, /ticket properties/i, /assigned agent/i, /assignee/i,
      /watch|follow ticket|watcher/i, /mention/i, /\bactivity\b/i, /history/i, /\bSLA\b/i, /breached/i, /at risk/i,
      /on track/i, /first response due/i, /resolution due/i, /escalat/i, /save changes/i, /close ticket/i,
      /ai assistant/i, /summarize ticket/i, /ai summary/i, /suggest reply/i, /suggested reply/i, /insert into reply/i,
      /suggest category/i, /suggested category/i, /apply category/i, /ai confidence/i,
      /find solution/i, /suggested solutions/i, /open article/i, /relevance/i,
    ]) {
      expect(screen.queryByText(pattern)).not.toBeInTheDocument();
    }
    expect(container.textContent).not.toMatch(/BREACHED|URGENT|ESCALATED|FIRST_RESPONSE|Mariam/);
    // no internal two-column workspace grid
    expect(container.querySelector(".grid.gap-6")).toBeNull();
  });

  it("places the Attach file control in the composer card, next to the Reply button", () => {
    mocks.detail.mockReturnValue({ data: detail({ status: "OPEN" }) });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    const attach = screen.getByRole("button", { name: "Attach file" });
    const send = screen.getByRole("button", { name: "Reply" });
    // both live in the standalone composer card (not the Conversation card)
    const section = attach.closest("section") as HTMLElement;
    expect(section).toBe(send.closest("section"));
    expect(within(section).getByRole("heading", { name: "Reply" })).toBeInTheDocument();
    expect(within(section).queryByRole("heading", { name: "Conversation" })).not.toBeInTheDocument();
  });

  it("keeps the standalone Attachments card to existing files only — no upload controls", () => {
    mocks.detail.mockReturnValue({ data: detail({ status: "OPEN" }) });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    const card = screen.getByRole("heading", { name: "Attachments" }).closest("section") as HTMLElement;
    expect(within(card).queryByRole("button", { name: "Attach file" })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Upload" })).not.toBeInTheDocument();
    expect(within(card).queryByLabelText("Select file")).not.toBeInTheDocument();
    expect(within(card).getByText("No attachments yet.")).toBeInTheDocument();
  });

  it("opens the native picker on Attach file, then reveals the pre-filled uploader and uploads through the portal mutation", async () => {
    mocks.detail.mockReturnValue({ data: detail({ status: "OPEN" }) });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    const native = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(native).toBeTruthy();
    const file = new File(["hello"], "receipt.png", { type: "image/png" });
    fireEvent.change(native, { target: { files: [file] } });
    expect(await screen.findByTitle("receipt.png")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(mocks.uploadFn).toHaveBeenCalledWith(file));
  });

  it("hides the composer + Attach file on a closed request and shows the closed notice", () => {
    mocks.detail.mockReturnValue({ data: detail({ status: "CLOSED" }) });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    expect(screen.queryByRole("button", { name: "Attach file" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
    expect(screen.getByText("This request is closed and no longer accepts replies.")).toBeInTheDocument();
  });

  it("still renders existing ticket attachments with preview/download actions", () => {
    mocks.attachList.mockReturnValue({
      data: [{ id: "att-1", fileName: "invoice.pdf", mimeType: "application/pdf", createdAt: "2026-08-25T10:00:00Z", messageId: null }],
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    });
    mocks.detail.mockReturnValue({ data: detail({ status: "OPEN" }) });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    const card = screen.getByRole("heading", { name: "Attachments" }).closest("section") as HTMLElement;
    const row = within(card).getByText("invoice.pdf").closest("li") as HTMLElement;
    expect(within(row).getByRole("button", { name: "Preview attachment" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Download attachment" })).toBeInTheDocument();
  });

  it("gives the customer a public-only composer — no internal note or quick reply tools", () => {
    mocks.detail.mockReturnValue({ data: detail({ status: "OPEN" }) });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /quick repl/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/internal note/i)).not.toBeInTheDocument();
  });

  it("bounds only the conversation message viewport; the composer card scrolls with the page", () => {
    mocks.detail.mockReturnValue({ data: detail({ status: "OPEN" }) });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    const list = screen.getByRole("list", { name: "Request conversation" });
    const scrollRegion = list.closest(".overflow-y-auto") as HTMLElement;
    expect(scrollRegion).toBeTruthy();
    expect(scrollRegion.className).toMatch(/lg:flex-1/);
    const card = list.closest("section") as HTMLElement;
    expect(card.className).toMatch(/lg:flex\b/);
    expect(card.className).toMatch(/lg:h-full/);
    expect((card.parentElement as HTMLElement).className).toMatch(/lg:h-\[calc\(/);
    // the composer (a separate card) is entirely outside the bounded conversation card
    const send = screen.getByRole("button", { name: "Reply" });
    expect(card.contains(send)).toBe(false);
    expect(card.contains(screen.getByRole("button", { name: "Attach file" }))).toBe(false);
  });

  it("does not change the conversation card shell when the attachment uploader is toggled open", () => {
    mocks.detail.mockReturnValue({ data: detail({ status: "OPEN" }) });
    renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    const card = screen.getByRole("list", { name: "Request conversation" }).closest("section") as HTMLElement;
    const shellBefore = card.className;
    const native = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(native, { target: { files: [new File(["x"], "r.png", { type: "image/png" })] } });
    expect(screen.getByTitle("r.png")).toBeInTheDocument();
    expect(card.className).toBe(shellBefore);
  });
});
function renderPage(element: React.ReactNode, path = "/portal") { return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/portal/*" element={element}/></Routes></MemoryRouter>); }
