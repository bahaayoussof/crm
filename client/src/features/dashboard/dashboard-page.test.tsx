import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({ useDashboard: vi.fn(), useAuth: vi.fn(), refetch: vi.fn() }));
vi.mock("./dashboard-hooks", () => ({ useDashboardOverview: mocks.useDashboard }));
vi.mock("../auth/auth-state", () => ({ useAuth: mocks.useAuth }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, BarChart: ({ data, children }: { data: unknown; children: React.ReactNode }) => <div data-chart={JSON.stringify(data)}>{children}</div>,
  Bar: () => null, CartesianGrid: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null,
}));

import { DashboardPage } from "./dashboard-page";

const ticket = { id: "ticket-12345678", subject: "Payment failed", status: "OPEN" as const, priority: "URGENT" as const, updatedAt: "2026-08-25T10:00:00.000Z", effectiveSlaDueAt: "2026-08-25T11:00:00.000Z", slaState: "BREACHED" as const, customer: { id: "c-1", name: "Ahmed" }, assignedAgent: { id: "a-1", name: "Mariam" } };
const data = { metrics: { openTickets: 12, assignedToMe: 4, unassignedTickets: 3, slaAtRisk: 2, slaBreached: 1, resolvedToday: 5, waitingCustomer: 6 }, statusDistribution: [{ status: "OPEN" as const, count: 7 }], needsAttention: [ticket], recentTickets: [ticket], generatedAt: "2026-08-25T12:00:00.000Z" };

describe("DashboardPage", () => {
  afterEach(cleanup);
  beforeEach(async () => { await changeAppLanguage("en"); vi.clearAllMocks(); mocks.useAuth.mockReturnValue({ user: { id: "agent-1", role: "AGENT" } }); mocks.useDashboard.mockReturnValue({ isLoading: false, isError: false, data, refetch: mocks.refetch }); });

  it("renders its structured loading state", () => { mocks.useDashboard.mockReturnValue({ isLoading: true }); renderPage(); expect(screen.getByLabelText("Loading…")).toBeInTheDocument(); });
  it("renders an error and retries", () => { mocks.useDashboard.mockReturnValue({ isLoading: false, isError: true, refetch: mocks.refetch }); renderPage(); fireEvent.click(screen.getByRole("button", { name: "Retry" })); expect(mocks.refetch).toHaveBeenCalledOnce(); });
  it("shows real AGENT metrics and omits unsupported filter links", () => { renderPage(); const metrics = screen.getByLabelText("Dashboard metrics"); expect(within(metrics).getByText("Assigned to me")).toBeInTheDocument(); expect(within(metrics).getByText("4")).toBeInTheDocument(); expect(within(metrics).queryByText("Open tickets")).not.toBeInTheDocument(); expect(screen.getAllByRole("link").every((link) => !link.getAttribute("href")?.includes("sla"))).toBe(true); });
  it("shows ADMIN metrics without reinterpreting assigned-to-me", () => { mocks.useAuth.mockReturnValue({ user: { id: "admin-1", role: "ADMIN" } }); renderPage(); const metrics = screen.getByLabelText("Dashboard metrics"); expect(within(metrics).getByText("Open tickets")).toBeInTheDocument(); expect(within(metrics).getByText("Unassigned tickets")).toBeInTheDocument(); expect(screen.queryByText("Assigned to me")).not.toBeInTheDocument(); });
  it("maps chart data, renders both ticket sections, and links ticket details", () => { const view = renderPage(); expect(screen.getByTestId("status-chart").querySelector("[data-chart]")?.getAttribute("data-chart")).toContain('"label":"Open"'); expect(screen.getAllByText("Payment failed").length).toBeGreaterThanOrEqual(2); expect(view.container.querySelectorAll('a[href="/tickets/ticket-12345678"]').length).toBeGreaterThanOrEqual(2); expect(view.container.querySelector('[dir="ltr"]')).toBeInTheDocument(); });
  it("renders independent empty section and distribution states", () => { mocks.useDashboard.mockReturnValue({ isLoading: false, isError: false, data: { ...data, statusDistribution: [], needsAttention: [], recentTickets: [] }, refetch: mocks.refetch }); renderPage(); expect(screen.getByText("No ticket status data yet.")).toBeInTheDocument(); expect(screen.getByText("No visible tickets currently need attention.")).toBeInTheDocument(); expect(screen.getByText("No recent visible tickets.")).toBeInTheDocument(); });
  it("localizes Arabic and preserves document RTL", async () => { await changeAppLanguage("ar"); renderPage(); expect(screen.getByRole("heading", { name: "لوحة دعم العملاء" })).toBeInTheDocument(); expect(screen.getByText("تحتاج إلى اهتمام")).toBeInTheDocument(); expect(document.documentElement).toHaveAttribute("dir", "rtl"); expect(within(screen.getAllByRole("link", { name: /#12345678/ })[0]).queryByText(/#12345678/)).toBeInTheDocument(); });
});

function renderPage() { return render(<MemoryRouter><DashboardPage /></MemoryRouter>); }
