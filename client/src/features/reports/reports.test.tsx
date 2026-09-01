import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";
import enTranslations from "@/locales/en/translation.json";
import arTranslations from "@/locales/ar/translation.json";
import { shortenCategoryLabel } from "./components/ticket-breakdown/breakdown-chart";

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

vi.mock("@/features/organization/organization-hooks", () => ({
  useDepartmentOptions: () => ({ data: [{ id: "dep-1", name: "Engineering" }] }),
  useBranchOptions: () => ({ data: [{ id: "br-1", name: "HQ" }] }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ data, children }: { data: unknown; children: React.ReactNode }) => (
    <div data-chart={JSON.stringify(data)}>{children}</div>
  ),
  Bar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ data, children }: { data: unknown; children?: React.ReactNode }) => (
    <div data-chart={JSON.stringify(data)}>{children}</div>
  ),
  Cell: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import {
  ReportsLayout,
  ReportsOverviewPage,
  ReportsSlaPage,
  ReportsAgentsPage,
  ReportsTicketsPage,
} from "./reports-page";

const overviewData = {
  range: { from: "2026-07-28T00:00:00.000Z", to: "2026-08-27T00:00:00.000Z" },
  timezone: "UTC" as const,
  generatedAt: "2026-08-27T12:00:00.000Z",
  kpis: {
    createdTickets: 42,
    resolvedTickets: 30,
    slaCompliancePct: 80,
    averageFirstResponseMinutes: 75,
    satisfaction: { averageRating: 3.75, responseCount: 4 },
  },
  volume: [
    { date: "2026-08-01", created: 3, resolved: 1 },
    { date: "2026-08-02", created: 2, resolved: 4 },
  ],
  ticketVolume: [
    { date: "2026-08-01", created: 3, resolved: 1 },
    { date: "2026-08-02", created: 2, resolved: 4 },
  ],
  statusDistribution: [
    { status: "OPEN" as const, count: 7 },
    { status: "RESOLVED" as const, count: 5 },
  ],
  satisfaction: {
    averageRating: 3.75,
    responseCount: 4,
    distribution: [
      { rating: 1, count: 0 },
      { rating: 2, count: 1 },
      { rating: 3, count: 0 },
      { rating: 4, count: 2 },
      { rating: 5, count: 1 },
    ],
  },
};

const slaData = {
  range: overviewData.range,
  timezone: "UTC" as const,
  generatedAt: overviewData.generatedAt,
  firstResponse: { met: 8, breached: 2, pending: 1, total: 11, compliancePct: 80 },
  resolution: { met: 6, breached: 4, pending: 0, total: 10, compliancePct: 60 },
  byPriority: [
    {
      priority: "HIGH" as const,
      firstResponseMet: 3,
      firstResponseBreached: 1,
      resolutionMet: 2,
      resolutionBreached: 2,
      compliancePct: 75,
    },
  ],
  averageFirstResponseMinutes: 75,
  averageResolutionMinutes: 640,
};

const agentData = {
  range: overviewData.range,
  timezone: "UTC" as const,
  generatedAt: overviewData.generatedAt,
  agents: [
    {
      agentId: "a1",
      agentName: "Alice",
      assigned: 12,
      resolved: 9,
      open: 3,
      slaMet: 8,
      slaBreached: 2,
      slaMetPct: 80,
      averageFirstResponseMinutes: 45,
    },
    {
      agentId: "a2",
      agentName: "Bob",
      assigned: 4,
      resolved: 4,
      open: 0,
      slaMet: 0,
      slaBreached: 0,
      slaMetPct: null,
      averageFirstResponseMinutes: null,
    },
  ],
  pagination: {
    page: 1,
    limit: 15,
    total: 2,
    totalPages: 1,
  },
};

const ticketData = {
  range: overviewData.range,
  timezone: "UTC" as const,
  generatedAt: overviewData.generatedAt,
  totals: { created: 42, resolved: 30, open: 12 },
  volume: overviewData.volume,
  byStatus: [
    { status: "OPEN" as const, created: 7, resolved: 5 },
    { status: "RESOLVED" as const, created: 5, resolved: 5 },
  ],
  byPriority: [
    { priority: "LOW" as const, created: 5, resolved: 4 },
    { priority: "MEDIUM" as const, created: 20, resolved: 15 },
    { priority: "HIGH" as const, created: 12, resolved: 8 },
    { priority: "URGENT" as const, created: 5, resolved: 3 },
  ],
  byCategory: [
    { categoryId: "c1", categoryName: "Billing", created: 25, resolved: 20 },
    { categoryId: "c2", categoryName: "استفسارات إعداد حساب العميل الطويلة", created: 8, resolved: 6 },
    { categoryId: null, categoryName: null, created: 17, resolved: 10 },
  ],
  byChannel: [
    { channel: "WEB", created: 30, resolved: 20 },
    { channel: "EMAIL", created: 12, resolved: 10 },
  ],
};

function ok<T>(data: T) {
  return { isLoading: false, isError: false, isFetching: false, data, refetch: mocks.refetch };
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

function renderReportsApp(initialEntry = "/reports") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<ReportsLayout />}>
          <Route path="/reports" element={<ReportsOverviewPage />} />
          <Route path="/reports/sla" element={<ReportsSlaPage />} />
          <Route path="/reports/agents" element={<ReportsAgentsPage />} />
          <Route path="/reports/tickets" element={<ReportsTicketsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("Reports Redesign Information Architecture", () => {
  it("renders Overview by default with KPI figures and trends", () => {
    renderReportsApp("/reports");
    const kpis = screen.getByLabelText("Report highlights");
    expect(within(kpis).getByText("42")).toBeInTheDocument();
    expect(within(kpis).getByText("30")).toBeInTheDocument();
    expect(within(kpis).getByText("80%")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  });

  it("preserves global filters across sub-route tab navigation", () => {
    renderReportsApp("/reports?from=2026-08-01T00:00:00.000Z&to=2026-08-10T00:00:00.000Z&departmentId=dep-1");

    // Click SLA Performance tab
    const slaTab = screen.getByRole("tab", { name: "SLA Performance" });
    fireEvent.click(slaTab);

    // Verify SLA page rendered with global query params
    expect(mocks.sla).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-08-10T00:00:00.000Z",
        departmentId: "dep-1",
      })
    );
  });

  it("does not leak page-specific parameters from Agents to SLA", () => {
    renderReportsApp(
      "/reports/agents?from=2026-08-01T00:00:00.000Z&to=2026-08-10T00:00:00.000Z&search=alice&page=3&sortBy=resolved"
    );

    // Navigate to SLA tab
    const slaTab = screen.getByRole("tab", { name: "SLA Performance" });
    fireEvent.click(slaTab);

    // Verify SLA query only received global params
    const lastSlaCall = mocks.sla.mock.calls.at(-1)?.[0];
    expect(lastSlaCall).toHaveProperty("from", "2026-08-01T00:00:00.000Z");
    expect(lastSlaCall).not.toHaveProperty("search");
    expect(lastSlaCall).not.toHaveProperty("page");
    expect(lastSlaCall).not.toHaveProperty("sortBy");
  });

  it("renders Agent Performance DataTable with search and pagination", () => {
    renderReportsApp("/reports/agents");
    expect(screen.getByRole("tab", { name: "Agent Performance" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByPlaceholderText("Search agents…")).toBeInTheDocument();
    expect(screen.getAllByText("Alice").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Bob").length).toBeGreaterThanOrEqual(1);
  });

  it("resets page to 1 when searching agents", () => {
    renderReportsApp("/reports/agents?page=2");
    const searchInput = screen.getByPlaceholderText("Search agents…");
    fireEvent.change(searchInput, { target: { value: "alice" } });
    expect(mocks.agents).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search: "alice",
        page: 1,
      })
    );
  });

  it("renders the simplified Ticket Breakdown overview and categories views", () => {
    renderReportsApp("/reports/tickets");
    expect(screen.getByRole("tab", { name: "Ticket Breakdown" })).toHaveAttribute("aria-selected", "true");
    const breakdownTabs = within(screen.getByRole("tablist", { name: "Ticket breakdown" }));
    expect(breakdownTabs.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(breakdownTabs.getByRole("tab", { name: "Categories" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Priority" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Channel" })).not.toBeInTheDocument();
    expect(screen.getByTestId("breakdown-overview")).toHaveClass("items-stretch");
    const statusDonut = screen.getByTestId("breakdown-status-donut-chart");
    const channelDonut = screen.getByTestId("breakdown-channel-donut-chart");
    expect(statusDonut.closest("section")).toHaveClass("h-full");
    expect(channelDonut.closest("section")).toHaveClass("h-full");
    expect(statusDonut).toHaveClass("h-full");
    expect(channelDonut).toHaveClass("h-full");
    expect(statusDonut.querySelector("ul")).toHaveClass("mt-auto");
    expect(channelDonut.querySelector("ul")).toHaveClass("mt-auto");
    expect(screen.getByTestId("breakdown-bar-chart")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    fireEvent.click(breakdownTabs.getByRole("tab", { name: "Categories" }));
    expect(screen.getByPlaceholderText("Search categories…")).toBeInTheDocument();
    expect(screen.getByTestId("breakdown-category-horizontal-bar-chart")).toHaveAttribute("dir", "ltr");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    expect(screen.getByText("Billing")).toBeInTheDocument();
  });

  it("shortens category axis labels by grapheme in English and Arabic", () => {
    expect(shortenCategoryLabel("Customer onboarding questions", "en", 12)).toBe("Customer on…");
    expect(shortenCategoryLabel("استفسارات إعداد حساب العميل", "ar", 12)).toBe("استفسارات إ…");
  });

  it("only shows breakdown search and pagination controls when useful", () => {
    renderReportsApp("/reports/tickets");
    expect(screen.queryByPlaceholderText("Search categories…")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Categories" }));
    expect(screen.getByPlaceholderText("Search categories…")).toBeInTheDocument();
  });

  it("resets shared filters with reset button without losing current route", () => {
    renderReportsApp("/reports/sla?from=2026-08-01T00:00:00.000Z&to=2026-08-10T00:00:00.000Z");
    expect(screen.queryByText("Times shown in UTC")).not.toBeInTheDocument();
    const resetButton = screen.getByRole("button", { name: "Reset" });
    fireEvent.click(resetButton);
    expect(mocks.sla).toHaveBeenLastCalledWith({});
  });

  it("lets Date Range grow while keeping organization filters and Reset compact", () => {
    renderReportsApp("/reports?from=2026-09-01T00:00:00.000Z&to=2026-09-30T00:00:00.000Z");

    const dateRange = screen.getByRole("button", { name: "From – To" }).parentElement;
    expect(dateRange).toHaveClass("w-full", "sm:min-w-56", "sm:flex-[1_1_16rem]");
    const filters = screen.getByLabelText("Report filters");
    expect(filters.children[2]).toHaveClass("sm:w-52", "sm:flex-none");
    expect(filters.children[3]).toHaveClass("sm:w-52", "sm:flex-none");
    expect(screen.getByRole("button", { name: "Reset" })).toHaveClass("shrink-0", "px-3");
    expect(screen.getByText(/Sep 1.*30, 2026/)).toBeInTheDocument();
  });

  it("has 100% key parity between English and Arabic navigation and reports keys", () => {
    const enNav = Object.keys(enTranslations.navigation);
    const arNav = Object.keys(arTranslations.navigation);
    expect(enNav.sort()).toEqual(arNav.sort());

    const enReports = Object.keys(enTranslations.reports);
    const arReports = Object.keys(arTranslations.reports);
    expect(enReports.sort()).toEqual(arReports.sort());
  });

  it("localizes reports layout and sub-tabs in Arabic with RTL", async () => {
    await changeAppLanguage("ar");
    renderReportsApp("/reports/tickets?view=categories");
    const reportsNavigation = within(screen.getByRole("navigation", { name: "التقارير" }));
    expect(reportsNavigation.getByRole("tab", { name: "نظرة عامة" })).toBeInTheDocument();
    expect(reportsNavigation.getByRole("tab", { name: "أداء اتفاقية مستوى الخدمة" })).toBeInTheDocument();
    expect(reportsNavigation.getByRole("tab", { name: "أداء الوكلاء" })).toBeInTheDocument();
    expect(reportsNavigation.getByRole("tab", { name: "تفصيل التذاكر" })).toBeInTheDocument();
    const breakdownTabs = within(screen.getByRole("tablist", { name: "تفصيل التذاكر" }));
    expect(breakdownTabs.getByRole("tab", { name: "التصنيفات" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("breakdown-category-horizontal-bar-chart")).toHaveAttribute("dir", "ltr");
    expect(screen.getByRole("region", { name: "التصنيف" })).toBeInTheDocument();
    expect(screen.getByText("استفسارات إعداد حساب العميل الطويلة")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
  });
});
