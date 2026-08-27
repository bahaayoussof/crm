import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  sla: vi.fn(),
  agents: vi.fn(),
  tickets: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("./reports-hooks", () => ({
  useReportsOverview: mocks.overview,
  useSlaReports: mocks.sla,
  useAgentReports: mocks.agents,
  useTicketReports: mocks.tickets,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ data, children }: { data: unknown; children: React.ReactNode }) => <div data-chart={JSON.stringify(data)}>{children}</div>,
  Bar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import { ReportsPage } from "./reports-page";

const overviewData = {
  range: { from: "2026-07-28T00:00:00.000Z", to: "2026-08-27T00:00:00.000Z" }, timezone: "UTC", generatedAt: "2026-08-27T12:00:00.000Z",
  kpis: {
    createdTickets: 42, resolvedTickets: 30, slaCompliancePct: 80, averageFirstResponseMinutes: 75,
    satisfaction: { averageRating: 3.75, responseCount: 4 },
  },
  ticketVolume: [
    { date: "2026-08-01", created: 3, resolved: 1 },
    { date: "2026-08-02", created: 2, resolved: 4 },
  ],
  statusDistribution: [{ status: "OPEN", count: 7 }, { status: "RESOLVED", count: 5 }],
  satisfaction: { averageRating: 3.75, responseCount: 4, distribution: [
    { rating: 1, count: 0 }, { rating: 2, count: 1 }, { rating: 3, count: 0 }, { rating: 4, count: 2 }, { rating: 5, count: 1 },
  ] },
};

const slaData = {
  range: overviewData.range, timezone: "UTC", generatedAt: overviewData.generatedAt,
  firstResponse: { met: 8, breached: 2, pending: 1, total: 11, compliancePct: 80 },
  resolution: { met: 6, breached: 4, pending: 0, total: 10, compliancePct: 60 },
  byPriority: [
    { priority: "HIGH", firstResponseMet: 3, firstResponseBreached: 1, resolutionMet: 2, resolutionBreached: 2, compliancePct: 75 },
  ],
  averageFirstResponseMinutes: 75, averageResolutionMinutes: 640,
};

const agentData = {
  range: overviewData.range, timezone: "UTC", generatedAt: overviewData.generatedAt,
  agents: [
    { agentId: "a1", agentName: "Alice", assigned: 12, resolved: 9, open: 3, slaMet: 8, slaBreached: 2, slaMetPct: 80, averageFirstResponseMinutes: 45 },
    { agentId: "a2", agentName: "Bob", assigned: 4, resolved: 4, open: 0, slaMet: 0, slaBreached: 0, slaMetPct: null, averageFirstResponseMinutes: null },
  ],
};

const ticketData = {
  range: overviewData.range, timezone: "UTC", generatedAt: overviewData.generatedAt,
  totals: { created: 42, resolved: 30, open: 12 },
  volume: overviewData.ticketVolume,
  byStatus: overviewData.statusDistribution,
  byPriority: [
    { priority: "LOW", created: 5, resolved: 4 },
    { priority: "MEDIUM", created: 20, resolved: 15 },
    { priority: "HIGH", created: 12, resolved: 8 },
    { priority: "URGENT", created: 5, resolved: 3 },
  ],
  byCategory: [
    { categoryId: "c1", categoryName: "Billing", created: 25 },
    { categoryId: null, categoryName: null, created: 17 },
  ],
};

function ok<T>(data: T) {
  return { isLoading: false, isError: false, data, refetch: mocks.refetch };
}

beforeEach(async () => {
  await changeAppLanguage("en");
  vi.clearAllMocks();
  mocks.overview.mockReturnValue(ok(overviewData));
  mocks.sla.mockReturnValue(ok(slaData));
  mocks.agents.mockReturnValue(ok(agentData));
  mocks.tickets.mockReturnValue(ok(ticketData));
});
afterEach(cleanup);

function renderPage(entry = "/reports") {
  return render(<MemoryRouter initialEntries={[entry]}><ReportsPage /></MemoryRouter>);
}

describe("ReportsPage", () => {
  it("renders a structured loading state", () => {
    mocks.overview.mockReturnValue({ isLoading: true });
    renderPage();
    expect(screen.getByLabelText("Loading…")).toBeInTheDocument();
  });

  it("renders a page-level error with retry", () => {
    mocks.overview.mockReturnValue({ isLoading: false, isError: true, refetch: mocks.refetch });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });

  it("shows KPI figures from real data", () => {
    renderPage();
    const kpis = screen.getByLabelText("Report highlights");
    expect(within(kpis).getByText("42")).toBeInTheDocument();
    expect(within(kpis).getByText("30")).toBeInTheDocument();
    expect(within(kpis).getByText("80%")).toBeInTheDocument();
    expect(within(kpis).getByText("1 h 15 min")).toBeInTheDocument();
    expect(within(kpis).getByText("3.75 / 5")).toBeInTheDocument();
  });

  it("passes the ticket volume series into the chart", () => {
    renderPage();
    const chart = screen.getByTestId("volume-chart").querySelector("[data-chart]");
    expect(chart?.getAttribute("data-chart")).toContain('"created":3');
    expect(chart?.getAttribute("data-chart")).toContain('"resolved":4');
  });

  it("passes the status distribution into the status chart", () => {
    renderPage();
    const chart = screen.getByTestId("status-chart").querySelector("[data-chart]");
    expect(chart?.getAttribute("data-chart")).toContain('"label":"Open"');
    expect(chart?.getAttribute("data-chart")).toContain('"count":7');
  });

  it("renders the agent performance table", () => {
    renderPage();
    expect(screen.getAllByText("Alice").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Bob").length).toBeGreaterThanOrEqual(1);
    const row = screen.getAllByText("Alice")[0].closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("80%")).toBeInTheDocument();
  });

  it("renders SLA compliance and satisfaction breakdown", () => {
    renderPage();
    expect(screen.getByText("First response")).toBeInTheDocument();
    expect(screen.getByText("Resolution")).toBeInTheDocument();
    const satisfaction = screen.getByRole("heading", { name: "Customer satisfaction" }).closest("section") as HTMLElement;
    expect(within(satisfaction).getByText("Average 3.75 out of 5 from 4 responses.")).toBeInTheDocument();
  });

  it("applies a quick range preset to the URL and re-queries", () => {
    renderPage();
    mocks.overview.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
    const lastCall = mocks.overview.mock.calls.at(-1)?.[0];
    expect(lastCall).toHaveProperty("from");
    expect(lastCall).toHaveProperty("to");
  });

  it("reads an explicit range from the URL", () => {
    renderPage("/reports?from=2026-08-01T00:00:00.000Z&to=2026-08-10T00:00:00.000Z");
    expect(mocks.overview).toHaveBeenLastCalledWith({ from: "2026-08-01T00:00:00.000Z", to: "2026-08-10T00:00:00.000Z" });
  });

  it("shows an inline section fallback when a secondary report fails", () => {
    mocks.agents.mockReturnValue({ isLoading: false, isError: true, refetch: mocks.refetch });
    renderPage();
    expect(screen.getByText("This section could not be loaded.")).toBeInTheDocument();
    fireEvent.click(within(screen.getByText("Agent performance").closest("section") as HTMLElement).getByRole("button", { name: "Retry" }));
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it("localizes to Arabic and sets RTL direction", async () => {
    await changeAppLanguage("ar");
    renderPage();
    expect(screen.getByRole("heading", { name: "التقارير", level: 1 })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
  });
});
