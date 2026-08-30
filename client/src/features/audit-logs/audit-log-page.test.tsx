import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/lib/i18n";
import { changeAppLanguage } from "@/lib/i18n";
import { AuditLogPage } from "./audit-log-page";
import type { AuditLogList } from "./audit-log.types";

const mockUseAuditLogs = vi.fn();
const mockUseAgents = vi.fn();

vi.mock("./audit-log-hooks", () => ({
  useAuditLogs: (filters: unknown) => mockUseAuditLogs(filters),
}));

vi.mock("@/features/tickets/ticket-hooks", () => ({
  useAgents: () => mockUseAgents(),
}));

const sampleLogs: AuditLogList = {
  data: [
    {
      id: "log-1",
      action: "USER_ROLE_CHANGED",
      entityType: "USER",
      entityId: "usr_101",
      actor: { id: "usr_admin", name: "Bahaa Youssof", email: "bahaa@example.com" },
      changes: {
        role: { from: "AGENT", to: "MANAGER" },
      },
      metadata: { reason: "Promoted to lead" },
      ipAddress: "192.168.1.10",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0",
      createdAt: "2026-08-29T14:45:00.000Z",
    },
    {
      id: "log-2",
      action: "TICKET_ESCALATED",
      entityType: "TICKET",
      entityId: "tkt_500",
      actor: null,
      changes: {
        status: { from: "IN_PROGRESS", to: "ESCALATED" },
      },
      metadata: {},
      ipAddress: null,
      userAgent: null,
      createdAt: "2026-08-29T15:00:00.000Z",
    },
    {
      id: "log-3",
      action: "CUSTOMER_UPDATED",
      entityType: "CUSTOMER",
      entityId: "cust_77",
      actor: { id: "usr_agent", name: "Sara Ahmed", email: "sara@example.com" },
      changes: {
        phone: { from: "+201200000000", to: "+201100000000" },
        name: { from: "Old Name", to: "New Name" },
        email: { from: "old@example.com", to: "new@example.com" },
      },
      metadata: {},
      ipAddress: "10.0.0.5",
      userAgent: "Mozilla/5.0 Firefox/130.0",
      createdAt: "2026-08-29T16:20:00.000Z",
    },
  ],
  meta: {
    page: 1,
    limit: 15,
    total: 3,
    totalPages: 1,
  },
};

const sampleAgents = [
  { id: "usr_admin", name: "Bahaa Youssof", email: "bahaa@example.com" },
  { id: "usr_agent", name: "Sara Ahmed", email: "sara@example.com" },
];

describe("AuditLogPage", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await changeAppLanguage("en");
    mockUseAgents.mockReturnValue({
      data: sampleAgents,
      isLoading: false,
    });
    mockUseAuditLogs.mockReturnValue({
      data: sampleLogs,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  function renderPage(initialEntry = "/audit-logs") {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <AuditLogPage />
      </MemoryRouter>
    );
  }

  it("renders page header and filter controls", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Audit Logs", level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText("Review important administrative and security changes across the CRM.")
    ).toBeInTheDocument();

    expect(screen.getAllByPlaceholderText("Search by action, entity, actor, or ID…").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Action" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Entity type" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Actor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Date range" })).toBeInTheDocument();
  });

  it("opens mobile filter Sheet when clicking Filters button", async () => {
    renderPage();

    const filtersButton = screen.getByRole("button", { name: "Filters" });
    fireEvent.click(filtersButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const doneButton = screen.getByRole("button", { name: "Done" });
    expect(doneButton).toBeInTheDocument();
    fireEvent.click(doneButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("renders populated audit log rows correctly with human and system actors", () => {
    renderPage();

    // Human actor
    expect(screen.getAllByText("Bahaa Youssof").length).toBeGreaterThan(0);
    expect(screen.getAllByText("bahaa@example.com").length).toBeGreaterThan(0);

    // System actor
    expect(screen.getAllByText("System").length).toBeGreaterThan(0);

    // Entity IDs
    expect(screen.getAllByText("#usr_101").length).toBeGreaterThan(0);
    expect(screen.getAllByText("#tkt_500").length).toBeGreaterThan(0);

    // Change diff values
    expect(screen.getAllByText("AGENT").length).toBeGreaterThan(0);
    expect(screen.getAllByText("MANAGER").length).toBeGreaterThan(0);

    // Context column is removed from table rows
    expect(screen.queryByText("192.168.1.10")).not.toBeInTheDocument();
  });

  it("displays +2 more for records with 3 changes", () => {
    renderPage();

    expect(screen.getAllByText("+2 more").length).toBeGreaterThan(0);
  });

  it("opens details Sheet drawer when clicking view details button", async () => {
    renderPage();

    const viewButtons = screen.getAllByRole("button", { name: "View details" });
    fireEvent.click(viewButtons[0]);

    // Sheet drawer content
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("USER_ROLE_CHANGED")).toBeInTheDocument();
    expect(screen.getByText("Property Changes")).toBeInTheDocument();
    expect(screen.getByText("Request Context")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.10")).toBeInTheDocument();
    expect(screen.getByText("Promoted to lead")).toBeInTheDocument();

    // Close button
    const closeButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("renders active filter chips and handles filter clearing", async () => {
    renderPage("/audit-logs?search=admin&action=USER_ROLE_CHANGED");

    expect(screen.getByText("Active filters:")).toBeInTheDocument();
    expect(screen.getByText('Search: “admin”')).toBeInTheDocument();
    expect(screen.getByText("Action: User role changed")).toBeInTheDocument();

    const clearAllButton = screen.getByRole("button", { name: "Clear all" });
    fireEvent.click(clearAllButton);

    await waitFor(() => {
      expect(screen.queryByText("Active filters:")).not.toBeInTheDocument();
    });
  });

  it("renders loading skeleton state while fetching", () => {
    mockUseAuditLogs.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders error state with retry action", async () => {
    const mockRefetch = vi.fn();
    mockUseAuditLogs.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });

    renderPage();

    expect(screen.getByText("Couldn’t load audit logs")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong while loading audit activity.")).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryButton);

    expect(mockRefetch).toHaveBeenCalled();
  });

  it("renders empty state when no audit logs exist", () => {
    mockUseAuditLogs.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 15, total: 0, totalPages: 0 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getAllByText("No audit activity yet").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Administrative and security changes will appear here.").length).toBeGreaterThan(0);
  });

  it("renders filtered empty state when filters match nothing", () => {
    mockUseAuditLogs.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 15, total: 0, totalPages: 0 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage("/audit-logs?search=nonexistent");

    expect(screen.getAllByText("No audit activity matches your filters").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Try changing your search or filters.").length).toBeGreaterThan(0);
  });

  it("queries 15 records per page by default", () => {
    renderPage();
    expect(mockUseAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 15 }));
  });

  it("handles pagination page changes", () => {
    mockUseAuditLogs.mockReturnValue({
      data: {
        data: sampleLogs.data,
        meta: { page: 1, limit: 15, total: 45, totalPages: 3 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    const nextButton = screen.getByRole("button", { name: "Next" });
    expect(nextButton).toBeEnabled();
    fireEvent.click(nextButton);
  });

  it("renders correctly in Arabic locale", async () => {
    await changeAppLanguage("ar");
    renderPage();

    expect(screen.getByRole("heading", { name: "سجلات التدقيق", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "الإجراء" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "نوع الكيان" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "المنفذ" })).toBeInTheDocument();
    expect(screen.getAllByText("النظام").length).toBeGreaterThan(0);
  });
});
