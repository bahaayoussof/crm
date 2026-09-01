import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";
import type { AuthUser } from "@/features/auth/auth.types";
import { getNavigationSections, getFlatNavItems } from "@/app/layouts/nav-config";
import { getRoleHome } from "@/features/auth/auth-routing";

const mocks = vi.hoisted(() => ({ useOverview: vi.fn(), refetch: vi.fn() }));
vi.mock("./manager-hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./manager-hooks")>();
  return { ...actual, useManagerOverview: mocks.useOverview };
});

import { ManagerOverviewPage } from "./manager-overview-page";

const overview = {
  meta: { visibility: "TEAM" as const, teamName: "Billing Support" },
  needsAttention: [
    { key: "slaBreached" as const, count: 3, ticketFilter: "sla=breached" },
    { key: "slaAtRisk" as const, count: 5, ticketFilter: "sla=at_risk" },
    { key: "escalated" as const, count: 2, ticketFilter: "status=ESCALATED" },
    { key: "unassignedUrgent" as const, count: 1, ticketFilter: "assignee=unassigned&priority=URGENT" },
  ],
  kpis: {
    openTickets: 42,
    unassigned: 7,
    resolvedToday: 9,
    slaCompliancePct: 88,
    avgFirstResponseMinutes: 45,
    avgResolutionMinutes: 320,
  },
  teamWorkload: [
    { agentId: "a1", agentName: "Alice", openAssigned: 8, inProgress: 3, waitingCustomer: 1, atRisk: 2, resolvedToday: 4 },
    { agentId: "a2", agentName: "Bob", openAssigned: 2, inProgress: 0, waitingCustomer: 0, atRisk: 0, resolvedToday: 1 },
  ],
  priorityWork: [
    {
      id: "ticket-abcdefgh",
      subject: "Refund not processed",
      status: "ESCALATED" as const,
      priority: "URGENT" as const,
      updatedAt: "2026-09-01T09:00:00.000Z",
      effectiveSlaDueAt: null,
      slaState: "BREACHED" as const,
      customer: { id: "c1", name: "Ahmed" },
      assignedAgent: { id: "a1", name: "Alice" },
    },
  ],
  generatedAt: "2026-09-01T12:00:00.000Z",
};

const managerUser: AuthUser = { id: "m1", name: "Manager", email: "m@example.com", role: "MANAGER", customer: null };

function renderOverview() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/manager"]}>
        <ManagerOverviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Manager navigation", () => {
  it("shows the focused Manager console nav and hides admin-only sections", () => {
    const items = getFlatNavItems(getNavigationSections(managerUser, "internal"));
    const keys = items.map((item) => item.key);
    expect(keys).toEqual(["overview", "tickets", "team", "knowledgeBase", "tasks", "reports"]);
    const overviewItem = items.find((item) => item.key === "overview");
    expect(overviewItem?.to).toBe("/manager");
    expect(items.find((item) => item.key === "team")?.to).toBe("/manager/team");
    for (const hidden of ["customers", "quickReplies", "users", "auditLogs", "settings"]) {
      expect(keys).not.toContain(hidden);
    }
  });

  it("sends MANAGER home to the console", () => {
    expect(getRoleHome("MANAGER")).toBe("/manager");
    expect(getRoleHome("ADMIN")).toBe("/dashboard");
  });
});

describe("ManagerOverviewPage", () => {
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
    mocks.useOverview.mockReturnValue({ isLoading: false, isError: false, data: overview, refetch: mocks.refetch });
  });
  afterEach(cleanup);

  it("renders the structured loading state", () => {
    mocks.useOverview.mockReturnValue({ isLoading: true });
    renderOverview();
    expect(screen.getByLabelText("Loading…")).toBeInTheDocument();
  });

  it("renders an error with a working retry", () => {
    mocks.useOverview.mockReturnValue({ isLoading: false, isError: true, refetch: mocks.refetch });
    renderOverview();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });

  it("shows Needs Attention counts that deep-link into the filtered ticket queue", () => {
    renderOverview();
    const breached = screen.getByRole("link", { name: /SLA breached/i });
    expect(breached).toHaveAttribute("href", "/tickets?sla=breached");
    expect(within(breached).getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Escalated/i })).toHaveAttribute("href", "/tickets?status=ESCALATED");
  });

  it("renders team workload rows linking to the agent detail view", () => {
    renderOverview();
    // Alice is rendered twice (desktop table + mobile card); both link to the detail view.
    const aliceLinks = screen.getAllByRole("link", { name: "Alice" });
    expect(aliceLinks.length).toBeGreaterThan(0);
    for (const link of aliceLinks) expect(link).toHaveAttribute("href", "/manager/team/a1");
  });

  it("renders operational KPIs on the Operations tab", () => {
    renderOverview();
    fireEvent.click(screen.getByRole("tab", { name: "Operations" }));
    expect(screen.getByText("Open tickets")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();
  });

  it("lists priority work with a link to the ticket on the Operations tab", () => {
    renderOverview();
    fireEvent.click(screen.getByRole("tab", { name: "Operations" }));
    expect(screen.getByRole("link", { name: "Refund not processed" })).toHaveAttribute("href", "/tickets/ticket-abcdefgh");
  });

  it("keeps Team Overview (Needs Attention + Team Workload) as the default tab", () => {
    renderOverview();
    expect(screen.getByRole("tab", { name: "Team Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: /SLA breached/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Alice" }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Open tickets")).not.toBeInTheDocument();
  });

  // feature/team-based-manager-scope
  it("shows the manager's team name in the page context", () => {
    renderOverview();
    expect(screen.getByText(/Billing Support/)).toBeInTheDocument();
  });

  it("renders an informational empty state (no tabs) for a manager with no team", () => {
    mocks.useOverview.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...overview, meta: { visibility: "TEAM" as const, teamName: null } },
      refetch: mocks.refetch,
    });
    renderOverview();
    expect(screen.getByText("No team assigned")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Team Overview" })).not.toBeInTheDocument();
  });
});
