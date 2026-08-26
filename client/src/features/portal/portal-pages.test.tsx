import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({ overview: vi.fn(), tickets: vi.fn(), detail: vi.fn(), categories: vi.fn(), create: vi.fn(), reply: vi.fn(), auth: vi.fn(), refetch: vi.fn(), mutate: vi.fn() }));
vi.mock("./portal-hooks", () => ({ usePortalOverview: mocks.overview, usePortalTickets: mocks.tickets, usePortalTicket: mocks.detail, usePortalCategories: mocks.categories, useCreatePortalTicket: mocks.create, useReplyPortalTicket: mocks.reply }));
vi.mock("@/features/auth/auth-state", () => ({ useAuth: mocks.auth }));
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
  });
  it("shows overview metrics and responsive recent requests", () => { renderPage(<PortalHomePage />); expect(screen.getByRole("heading", { name: "Welcome, Ahmed" })).toBeInTheDocument(); expect(screen.getByText("Waiting for You")).toBeInTheDocument(); expect(screen.getAllByText("Payment help")).toHaveLength(2); expect(screen.getByRole("table")).toBeInTheDocument(); });
  it("renders loading and retry states", () => { mocks.overview.mockReturnValue({ isLoading: true }); const view = renderPage(<PortalHomePage />); expect(screen.getByText(/Loading your support overview/)).toBeInTheDocument(); view.unmount(); mocks.overview.mockReturnValue({ isError: true, refetch: mocks.refetch }); renderPage(<PortalHomePage />); fireEvent.click(screen.getByRole("button", { name: "Retry" })); expect(mocks.refetch).toHaveBeenCalled(); });
  it("owns filters in the URL and renders no results", () => { mocks.tickets.mockReturnValue({ data: { data: [], meta: { page: 1, totalPages: 0 } } }); renderPage(<PortalTicketsPage />, "/portal/tickets?search=missing&status=RESOLVED"); expect(screen.getByDisplayValue("missing")).toBeInTheDocument(); expect(screen.getByDisplayValue("Resolved")).toBeInTheDocument(); expect(screen.getByText("No requests match your search or filter.")).toBeInTheDocument(); });
  it("renders visible accessible creation controls and only Portal fields", () => { renderPage(<PortalNewTicketPage />); expect(screen.getByLabelText("Subject")).toHaveClass("input"); expect(screen.getByLabelText(/Category/)).toHaveClass("input"); expect(screen.getByLabelText("Description")).toHaveClass("input"); expect(screen.queryByText(/priority|assignee/i)).not.toBeInTheDocument(); });
  it("keeps required validation associated with the fields", async () => { renderPage(<PortalNewTicketPage />); fireEvent.click(screen.getByRole("button", { name: "Create New Request" })); await waitFor(() => expect(screen.getByText(/Subject must be/)).toBeInTheDocument()); expect(screen.getByLabelText("Subject")).toHaveAttribute("aria-invalid", "true"); expect(screen.getByLabelText("Description")).toHaveAccessibleDescription(/Description is required/); });
  it("preserves failed form values and prevents repeated pending submission", () => { mocks.create.mockReturnValue({ mutateAsync: mocks.mutate, isPending: true, isError: true }); renderPage(<PortalNewTicketPage />); fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Payment problem" } }); fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Still failing" } }); expect(screen.getByLabelText("Subject")).toHaveValue("Payment problem"); expect(screen.getByLabelText("Description")).toHaveValue("Still failing"); expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled(); expect(screen.getByText(/content has been preserved/)).toBeInTheDocument(); });
  it("shows safe authors and preserves a failed reply", () => {
    mocks.detail.mockReturnValue({ data: { ...ticket, status: "RESOLVED", description: "Details", messages: [{ id: "m", body: "We can help", createdAt: ticket.updatedAt, author: { id: "a", name: "Mariam", kind: "SUPPORT" } }] } });
    mocks.reply.mockReturnValue({ mutateAsync: mocks.mutate, isPending: false, isError: true }); renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    expect(screen.getByText("Support")).toBeInTheDocument(); expect(screen.getByText("Replying will reopen this request.")).toBeInTheDocument();
    const field = screen.getByRole("textbox"); fireEvent.change(field, { target: { value: "Still broken" } }); expect(field).toHaveValue("Still broken"); expect(screen.getByText(/message has been preserved/)).toBeInTheDocument();
  });
  it("never renders internal SLA state, target, or deadlines even if present in the payload", () => {
    mocks.detail.mockReturnValue({ data: { ...ticket, status: "OPEN", description: "Details", messages: [], slaState: "BREACHED", effectiveSlaTarget: "FIRST_RESPONSE", effectiveSlaDueAt: "2026-08-25T09:00:00Z", firstResponseDueAt: "2026-08-25T09:00:00Z", firstRespondedAt: null, resolutionDueAt: "2026-08-26T09:00:00Z" } });
    const { container } = renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678");
    for (const text of [/SLA/i, /Breached/i, /At risk/i, /On track/i, /First response due/i, /Resolution due/i, /Effective deadline/i]) expect(screen.queryByText(text)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/BREACHED|FIRST_RESPONSE/);
  });
  it("hides closed composer and localizes RTL", async () => { await changeAppLanguage("ar"); mocks.detail.mockReturnValue({ data: { ...ticket, status: "CLOSED", description: "Details", messages: [] } }); renderPage(<PortalTicketDetailPage />, "/portal/tickets/ticket-12345678"); expect(screen.getByText("هذا الطلب مغلق ولم يعد يقبل الردود.")).toBeInTheDocument(); expect(screen.queryByRole("button", { name: "إرسال الرد" })).not.toBeInTheDocument(); expect(document.documentElement).toHaveAttribute("dir", "rtl"); expect(document.querySelector('bdi[dir="ltr"]')).toBeInTheDocument(); });
});
function renderPage(element: React.ReactNode, path = "/portal") { return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/portal/*" element={element}/></Routes></MemoryRouter>); }
