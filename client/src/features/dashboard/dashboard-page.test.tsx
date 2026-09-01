import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({ useDashboard: vi.fn(), useAuth: vi.fn(), refetch: vi.fn() }));
vi.mock("./dashboard-hooks", () => ({ useDashboardOverview: mocks.useDashboard }));
vi.mock("../auth/auth-state", () => ({ useAuth: mocks.useAuth }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ data, children }: { data: unknown; children: React.ReactNode }) => <div data-chart={JSON.stringify(data)}>{children}</div>,
  Bar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ data, children }: { data: unknown; children: React.ReactNode }) => <div data-chart={JSON.stringify(data)}>{children}</div>,
  Area: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ data, children }: { data: unknown; children?: React.ReactNode }) => <div data-chart={JSON.stringify(data)}>{children}</div>,
  Cell: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import { DashboardPage } from "./dashboard-page";

const ticket = { id: "ticket-12345678", subject: "Payment failed", status: "OPEN" as const, priority: "URGENT" as const, updatedAt: "2026-08-25T10:00:00.000Z", effectiveSlaDueAt: "2026-08-25T11:00:00.000Z", slaState: "BREACHED" as const, customer: { id: "c-1", name: "Ahmed" }, assignedAgent: { id: "a-1", name: "Mariam" } };
const recentTicket = { ...ticket, id: "ticket-recent-87654321", subject: "Unassigned follow-up", assignedAgent: null };
const ticketActivity = [
  { date: "2026-08-24", opened: 2, resolved: 1 },
  { date: "2026-08-25", opened: 3, resolved: 4 },
];
const agentPerformance = { windowDays: 30, avgFirstResponseMinutes: 45, avgResolutionMinutes: 320, resolvedCount: 8, slaCompliancePct: 92, csat: { averageRating: 4.6, responseCount: 3 } };
const data = { metrics: { openTickets: 12, assignedToMe: 4, unassignedTickets: 3, slaAtRisk: 2, slaBreached: 1, resolvedToday: 5, waitingCustomer: 6 }, statusDistribution: [{ status: "OPEN" as const, count: 7 }], ticketActivity, primaryQueueType: "MY_ASSIGNED_TICKETS" as const, primaryTickets: [ticket], recentTickets: [recentTicket], agentPerformance, generatedAt: "2026-08-25T12:00:00.000Z" };

describe("DashboardPage", () => {
  afterEach(cleanup);
  beforeEach(async () => { await changeAppLanguage("en"); vi.clearAllMocks(); mocks.useAuth.mockReturnValue({ user: { id: "agent-1", role: "AGENT" } }); mocks.useDashboard.mockReturnValue({ isLoading: false, isError: false, data, refetch: mocks.refetch }); });

  it("renders its structured loading state", () => { mocks.useDashboard.mockReturnValue({ isLoading: true }); renderPage(); expect(screen.getByLabelText("Loading…")).toBeInTheDocument(); });
  it("renders an error and retries", () => { mocks.useDashboard.mockReturnValue({ isLoading: false, isError: true, refetch: mocks.refetch }); renderPage(); fireEvent.click(screen.getByRole("button", { name: "Retry" })); expect(mocks.refetch).toHaveBeenCalledOnce(); });
  it("shows personal AGENT KPIs and no organization-wide analytics", () => { renderPage(); const metrics = screen.getByLabelText("Dashboard metrics"); expect(within(metrics).getByText("Open tickets")).toBeInTheDocument(); expect(within(metrics).getByText("12")).toBeInTheDocument(); expect(within(metrics).getByText("Overdue")).toBeInTheDocument(); expect(within(metrics).queryByText("Unassigned tickets")).not.toBeInTheDocument(); expect(screen.queryByTestId("status-chart")).not.toBeInTheDocument(); expect(screen.queryByTestId("activity-chart")).not.toBeInTheDocument(); });
  it("renders the personal AGENT performance panel and omits it for ADMIN", () => {
    renderPage();
    expect(screen.getByText("My performance")).toBeInTheDocument();
    expect(screen.getByText("Tickets resolved")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    cleanup();
    mocks.useAuth.mockReturnValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.useDashboard.mockReturnValue({ isLoading: false, isError: false, data: { ...data, agentPerformance: undefined }, refetch: mocks.refetch });
    renderPage();
    expect(screen.queryByText("My performance")).not.toBeInTheDocument();
  });
  it("shows the role-aware primary heading", () => { renderPage(); expect(screen.getByRole("heading", { name: "Priority work queue" })).toBeInTheDocument(); for (const role of ["ADMIN", "MANAGER"]) { mocks.useAuth.mockReturnValue({ user: { id: role.toLowerCase(), role } }); const view = renderPage(); expect(screen.getByRole("heading", { name: "Needs attention" })).toBeInTheDocument(); view.unmount(); } });
  it("shows ADMIN metrics without reinterpreting assigned-to-me", () => { mocks.useAuth.mockReturnValue({ user: { id: "admin-1", role: "ADMIN" } }); renderPage(); const metrics = screen.getByLabelText("Dashboard metrics"); expect(within(metrics).getByText("Open tickets")).toBeInTheDocument(); expect(within(metrics).getByText("Unassigned tickets")).toBeInTheDocument(); expect(screen.queryByText("Assigned to me")).not.toBeInTheDocument(); });
  it("renders ADMIN charts, SLA health and linked ticket sections", () => {
    mocks.useAuth.mockReturnValue({ user: { id: "admin-1", role: "ADMIN" } });
    const view = renderPage();
    expect(screen.getByTestId("status-chart").querySelector("[data-chart]")?.getAttribute("data-chart")).toContain('"label":"Open"');
    expect(screen.getByTestId("activity-chart").querySelector("[data-chart]")?.getAttribute("data-chart")).toContain('"opened":3');
    const slaCard = screen.getByText("SLA health").closest("div[class*='rounded-lg']") as HTMLElement;
    expect(within(slaCard).getByText("75%")).toBeInTheDocument();
    expect(within(slaCard).getByText("On track")).toBeInTheDocument();
    expect(screen.getAllByText("Payment failed").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Unassigned follow-up").length).toBeGreaterThanOrEqual(2);
    expect(view.container.querySelectorAll('a[href="/tickets/ticket-12345678"]').length).toBe(2);
    expect(view.container.querySelectorAll('a[href="/tickets/ticket-recent-87654321"]').length).toBe(2);
  });
  it("renders each ticket ID in only its authoritative section", () => { const view = renderPage(); expect(view.container.querySelectorAll('[href="/tickets/ticket-12345678"]').length).toBe(2); expect(view.container.querySelectorAll('[href="/tickets/ticket-recent-87654321"]').length).toBe(2); });
  it("renders localized AGENT work-console empty states", () => { mocks.useDashboard.mockReturnValue({ isLoading: false, isError: false, data: { ...data, metrics: { ...data.metrics, openTickets: 0, slaBreached: 0, slaAtRisk: 0 }, primaryTickets: [], recentTickets: [] }, refetch: mocks.refetch }); renderPage(); expect(screen.getByText("No active tickets requiring SLA tracking.")).toBeInTheDocument(); expect(screen.getByText("No active tickets are currently assigned to you.")).toBeInTheDocument(); expect(screen.getByText("No recent visible tickets remain outside the primary queue.")).toBeInTheDocument(); });
  it("renders the ADMIN distribution empty state", () => { mocks.useAuth.mockReturnValue({ user: { id: "admin-1", role: "ADMIN" } }); mocks.useDashboard.mockReturnValue({ isLoading: false, isError: false, data: { ...data, statusDistribution: [], primaryTickets: [], recentTickets: [] }, refetch: mocks.refetch }); renderPage(); expect(screen.getByText("No ticket status data yet.")).toBeInTheDocument(); });
  it("does not crash on a stale legacy response and does not treat broad attention data as AGENT assigned work", () => { const legacy = { ...data, primaryTickets: undefined, needsAttention: [recentTicket] }; mocks.useDashboard.mockReturnValue({ isLoading: false, isError: false, data: legacy, refetch: mocks.refetch }); renderPage(); expect(screen.getByText("No active tickets are currently assigned to you.")).toBeInTheDocument(); expect(screen.getAllByText("Unassigned follow-up").length).toBeGreaterThanOrEqual(2); });
  it("uses legacy Needs Attention only as an ADMIN compatibility fallback", () => { mocks.useAuth.mockReturnValue({ user: { id: "admin-1", role: "ADMIN" } }); const legacy = { ...data, primaryTickets: undefined, needsAttention: [ticket], recentTickets: [ticket, recentTicket] }; mocks.useDashboard.mockReturnValue({ isLoading: false, isError: false, data: legacy, refetch: mocks.refetch }); const view = renderPage(); expect(screen.getAllByText("Payment failed").length).toBeGreaterThanOrEqual(2); expect(view.container.querySelectorAll('a[href="/tickets/ticket-12345678"]').length).toBe(2); expect(view.container.querySelectorAll('a[href="/tickets/ticket-recent-87654321"]').length).toBe(2); });
  it("keeps semantic desktop headers and bounded long values alongside mobile cards", () => { const longTicket = { ...ticket, subject: "A very long subject that must remain inside its own deliberately sized dashboard column", customer: { id: "c-long", name: "A very long customer organization name that cannot overlap the subject" } }; mocks.useDashboard.mockReturnValue({ isLoading: false, isError: false, data: { ...data, primaryTickets: [longTicket] }, refetch: mocks.refetch }); const view = renderPage(); expect(screen.getAllByRole("columnheader", { name: "Subject" }).length).toBe(2); expect(screen.getByRole("columnheader", { name: "Customer" })).toBeInTheDocument(); const tables = [...view.container.querySelectorAll("table")]; expect(tables.some((table) => table.classList.contains("min-w-[52rem]"))).toBe(true); expect(tables.some((table) => table.classList.contains("min-w-[68rem]"))).toBe(false); expect(screen.getAllByTitle(longTicket.subject).length).toBe(2); expect(screen.getAllByTitle(longTicket.customer.name).length).toBe(2); });
  it("localizes Arabic and preserves direction-safe ticket references", async () => { await changeAppLanguage("ar"); renderPage(); expect(screen.getByRole("heading", { name: "لوحة دعم العملاء" })).toBeInTheDocument(); expect(screen.getByText("التذاكر المفتوحة")).toBeInTheDocument(); expect(screen.getByText("أدائي")).toBeInTheDocument(); expect(document.documentElement).toHaveAttribute("dir", "rtl"); expect(screen.getAllByLabelText(/المعرّف ticket-12345678/)[0]).toHaveAttribute("dir", "ltr"); });
});

function renderPage() { return render(<MemoryRouter><DashboardPage /></MemoryRouter>); }
