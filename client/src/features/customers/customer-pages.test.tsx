import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  useCustomers: vi.fn(), useCustomer: vi.fn(), useCustomerNotes: vi.fn(), useCustomerTickets: vi.fn(),
  useCreateCustomer: vi.fn(), useUpdateCustomer: vi.fn(), useDeleteCustomer: vi.fn(), useCreateCustomerNote: vi.fn(),
  createCustomer: vi.fn(), updateCustomer: vi.fn(), deleteCustomer: vi.fn(), createNote: vi.fn(),
  role: "ADMIN" as "ADMIN" | "MANAGER" | "AGENT",
}));

vi.mock("@/features/auth/auth-state", () => ({
  useAuth: () => ({ user: { id: "user-1", name: "User", email: "user@example.com", role: mocks.role, customer: null }, isLoading: false }),
}));

vi.mock("./customer-hooks", () => ({
  useCustomers: mocks.useCustomers, useCustomer: mocks.useCustomer, useCustomerNotes: mocks.useCustomerNotes, useCustomerTickets: mocks.useCustomerTickets,
  useCreateCustomer: mocks.useCreateCustomer, useUpdateCustomer: mocks.useUpdateCustomer,
  useDeleteCustomer: mocks.useDeleteCustomer, useCreateCustomerNote: mocks.useCreateCustomerNote,
}));

import { CustomerDetailPage } from "./customer-detail-page";
import { CustomerFormPage } from "./customer-form-page";
import { CustomerListPage } from "./customer-list-page";

const customer = {
  id: "customer-1", name: "Ahmed Mohamed", email: "ahmed@example.com", phone: "+201000000000",
  createdAt: "2026-08-20T10:00:00.000Z", updatedAt: "2026-08-24T10:00:00.000Z", user: null, attachments: [],
  supportSummary: { openTicketCount: 0, totalTicketCount: 0, lastInteractionAt: "2026-08-24T10:00:00.000Z" },
};

const listCustomer = {
  id: customer.id, name: customer.name, email: customer.email, phone: customer.phone,
  createdAt: customer.createdAt, updatedAt: customer.updatedAt,
  openTicketCount: 2, totalTicketCount: 5, lastInteractionAt: customer.updatedAt,
};

const customerTicket = {
  id: "ticket-1", subject: "Payment failed", status: "OPEN", priority: "HIGH", channel: "WEB",
  firstResponseDueAt: null, firstRespondedAt: null, resolutionDueAt: null,
  createdAt: customer.createdAt, updatedAt: customer.updatedAt,
  customer: { id: customer.id, name: customer.name, email: customer.email }, assignedAgent: null, category: null,
};

describe("customer pages", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
    mocks.role = "ADMIN";
    mocks.useCustomers.mockReturnValue({ isLoading: false, isError: false, data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }, refetch: vi.fn() });
    mocks.useCustomer.mockReturnValue({ isLoading: false, isError: false, data: customer });
    mocks.useCustomerNotes.mockReturnValue({ isLoading: false, isError: false, data: [{ id: "note-1", body: "Internal note text", createdAt: customer.updatedAt, author: { id: "admin-1", name: "Admin", role: "ADMIN" } }], refetch: vi.fn() });
    mocks.useCreateCustomer.mockReturnValue({ mutateAsync: mocks.createCustomer });
    mocks.useUpdateCustomer.mockReturnValue({ mutateAsync: mocks.updateCustomer });
    mocks.useDeleteCustomer.mockReturnValue({ mutateAsync: mocks.deleteCustomer, isPending: false });
    mocks.useCreateCustomerNote.mockReturnValue({ mutateAsync: mocks.createNote });
    mocks.useCustomerTickets.mockReturnValue({ isLoading: false, isError: false, data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }, refetch: vi.fn() });
  });

  it("shows structured loading and distinguishes an empty customer list", () => {
    mocks.useCustomers.mockReturnValueOnce({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    const view = renderAt("/customers", <Route path="/customers" element={<CustomerListPage />} />);
    expect(screen.getByLabelText("Loading…")).toBeInTheDocument();
    view.unmount();
    renderAt("/customers", <Route path="/customers" element={<CustomerListPage />} />);
    expect(screen.getByText("No customers yet.")).toBeInTheDocument();
  });

  it("debounces backend search while preserving the search in the URL", async () => {
    renderAt("/customers", <Route path="/customers" element={<CustomerListPage />} />);
    fireEvent.change(screen.getByPlaceholderText("Search customers…"), { target: { value: "Ahmed" } });
    expect(screen.getByDisplayValue("Ahmed")).toBeInTheDocument();
    await waitFor(() => expect(mocks.useCustomers).toHaveBeenLastCalledWith(expect.objectContaining({ search: "Ahmed" })), { timeout: 1000 });
    expect(screen.getByText("No customers match “Ahmed”.")).toBeInTheDocument();
  });

  it("renders the server page through TanStack Table and preserves the mobile customer view", () => {
    mocks.useCustomers.mockReturnValue({ isLoading: false, isError: false, data: { data: [listCustomer], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, refetch: vi.fn() });
    const view = renderAt("/customers", <Route path="/customers" element={<CustomerListPage />} />);
    const table = screen.getByRole("table");

    expect(within(table).getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Open tickets" })).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: customer.name })).toHaveAttribute("href", "/customers/customer-1");
    expect(within(table).getByText("2")).toBeInTheDocument();
    expect(view.container.querySelectorAll('a[href="/customers/customer-1"]')).toHaveLength(2);
  });

  it("uses server pagination metadata and URL state for page navigation", async () => {
    mocks.useCustomers.mockReturnValue({ isLoading: false, isError: false, data: { data: [listCustomer], meta: { page: 2, limit: 20, total: 60, totalPages: 3 } }, refetch: vi.fn() });
    renderAt("/customers?search=Ahmed&page=2", <Route path="/customers" element={<CustomerListPage />} />);

    expect(mocks.useCustomers).toHaveBeenLastCalledWith({ search: "Ahmed", page: 2, limit: 20 });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(mocks.useCustomers).toHaveBeenLastCalledWith({ search: "Ahmed", page: 3, limit: 20 }));
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => expect(mocks.useCustomers).toHaveBeenLastCalledWith({ search: "Ahmed", page: 2, limit: 20 }));
  });

  it("validates the create form before mutation", async () => {
    mocks.useCustomer.mockReturnValue({ isLoading: false, isError: false, data: undefined });
    renderAt("/customers/new", <Route path="/customers/new" element={<CustomerFormPage />} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Name must be at least 2 characters")).toBeInTheDocument();
    expect(mocks.createCustomer).not.toHaveBeenCalled();
  });

  it("renders customer details and submits an internal note", async () => {
    renderAt("/customers/customer-1", <Route path="/customers/:id" element={<CustomerDetailPage />} />);
    expect(screen.getByRole("heading", { name: customer.name })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Notes" }));
    expect(screen.getByRole("tab", { name: "Notes" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Internal note text")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Internal note"), { target: { value: "Follow up tomorrow" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await waitFor(() => expect(mocks.createNote).toHaveBeenCalledWith({ body: "Follow up tomorrow" }));
  });

  it("keeps customer list and details read-only for AGENT", () => {
    mocks.role = "AGENT";
    mocks.useCustomers.mockReturnValue({ isLoading: false, isError: false, data: { data: [listCustomer], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, refetch: vi.fn() });
    const list = renderAt("/customers", <Route path="/customers" element={<CustomerListPage />} />);
    expect(screen.getByRole("link", { name: customer.name })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add customer" })).not.toBeInTheDocument();
    list.unmount();

    renderAt("/customers/customer-1?tab=notes", <Route path="/customers/:id" element={<CustomerDetailPage />} />);
    expect(screen.getByRole("heading", { name: customer.name })).toBeInTheDocument();
    expect(screen.getByText("Internal note text")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add note" })).not.toBeInTheDocument();
    expect(screen.getByText("Read-only customer access")).toBeInTheDocument();
  });

  it("loads and renders only the opened customer's authorized tickets for AGENT", () => {
    mocks.role = "AGENT";
    mocks.useCustomerTickets.mockReturnValue({ isLoading: false, isError: false, data: { data: [{ ...customerTicket, access: "FULL" }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, refetch: vi.fn() });
    renderAt("/customers/customer-1?tab=tickets", <Route path="/customers/:id" element={<CustomerDetailPage />} />);
    expect(mocks.useCustomerTickets).toHaveBeenCalledWith("customer-1", 1);
    expect(screen.getAllByRole("link", { name: "Payment failed" })).not.toHaveLength(0);
    expect(screen.queryByRole("link", { name: "Add customer" })).not.toBeInTheDocument();
  });

  it("links FULL summaries but keeps another-agent desktop row and mobile card non-interactive", () => {
    mocks.role = "AGENT";
    const records = [
      { ...customerTicket, id: "ticket-mine", subject: "Assigned to me", access: "FULL", assignedAgent: { id: "user-1", name: "User", email: "user@example.com" } },
      { ...customerTicket, id: "ticket-unassigned", subject: "Unassigned ticket", access: "FULL", assignedAgent: null },
      { ...customerTicket, id: "ticket-other", subject: "Other agent ticket", access: "SUMMARY_ONLY", assignedAgent: { id: "agent-2", name: "Other Agent", email: "other@example.com" } },
    ];
    mocks.useCustomerTickets.mockReturnValue({ isLoading: false, isError: false, data: { data: records, meta: { page: 1, limit: 20, total: 3, totalPages: 1 } }, refetch: vi.fn() });
    const view = renderAt("/customers/customer-1?tab=tickets", <Route path="/customers/:id" element={<CustomerDetailPage />} />);
    expect(view.container.querySelectorAll('a[href="/tickets/ticket-mine"]')).toHaveLength(2);
    expect(view.container.querySelectorAll('a[href="/tickets/ticket-unassigned"]')).toHaveLength(2);
    expect(view.container.querySelectorAll('a[href="/tickets/ticket-other"]')).toHaveLength(0);
    expect(screen.getAllByText("Read-only — assigned to another agent")).toHaveLength(2);
    expect(view.container.querySelectorAll("bdi[dir='ltr']").length).toBeGreaterThanOrEqual(6);
  });

  it.each(["ADMIN", "MANAGER"] as const)("links every customer-history summary for %s", (role) => {
    mocks.role = role;
    mocks.useCustomerTickets.mockReturnValue({ isLoading: false, isError: false, data: { data: [{ ...customerTicket, access: "FULL" }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, refetch: vi.fn() });
    const view = renderAt("/customers/customer-1?tab=tickets", <Route path="/customers/:id" element={<CustomerDetailPage />} />);
    expect(view.container.querySelectorAll('a[href="/tickets/ticket-1"]')).toHaveLength(2);
  });

  it("paginates customer history through its isolated hook", () => {
    mocks.useCustomerTickets.mockReturnValue({ isLoading: false, isError: false, data: { data: [{ ...customerTicket, access: "FULL" }], meta: { page: 1, limit: 20, total: 21, totalPages: 2 } }, refetch: vi.fn() });
    renderAt("/customers/customer-1?tab=tickets", <Route path="/customers/:id" element={<CustomerDetailPage />} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(mocks.useCustomerTickets).toHaveBeenLastCalledWith("customer-1", 2);
  });

  it("distinguishes no authorized customer tickets from a ticket request failure", () => {
    mocks.role = "AGENT";
    const empty = renderAt("/customers/customer-1?tab=tickets", <Route path="/customers/:id" element={<CustomerDetailPage />} />);
    expect(screen.getByText("This customer has no tickets.")).toBeInTheDocument();
    empty.unmount();

    const refetch = vi.fn();
    mocks.useCustomerTickets.mockReturnValue({ isLoading: false, isError: true, data: undefined, refetch });
    renderAt("/customers/customer-1?tab=tickets", <Route path="/customers/:id" element={<CustomerDetailPage />} />);
    expect(screen.getByText("Unable to load this customer's tickets.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it.each(["ADMIN", "MANAGER"] as const)("shows customer management actions for %s", (role) => {
    mocks.role = role;
    renderAt("/customers/customer-1?tab=notes", <Route path="/customers/:id" element={<CustomerDetailPage />} />);
    expect(screen.getByRole("link", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add note" })).toBeInTheDocument();
  });

  it("renders representative customer list and detail UI in Arabic", async () => {
    await changeAppLanguage("ar");
    mocks.role = "AGENT";
    mocks.useCustomers.mockReturnValue({ isLoading: false, isError: false, data: { data: [listCustomer], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, refetch: vi.fn() });
    const list = renderAt("/customers", <Route path="/customers" element={<CustomerListPage />} />);
    expect(screen.getByRole("heading", { name: "العملاء" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("البحث عن العملاء…")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("columnheader", { name: "الاسم" })).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("columnheader", { name: "آخر تفاعل" })).toBeInTheDocument();
    list.unmount();

    renderAt("/customers/customer-1", <Route path="/customers/:id" element={<CustomerDetailPage />} />);
    expect(screen.getByRole("tab", { name: "نظرة عامة" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "الملاحظات" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "إضافة عميل" })).not.toBeInTheDocument();
  });

  it("localizes restricted customer ticket summaries in Arabic RTL", async () => {
    await changeAppLanguage("ar");
    mocks.role = "AGENT";
    mocks.useCustomerTickets.mockReturnValue({ isLoading: false, isError: false, data: { data: [{ ...customerTicket, access: "SUMMARY_ONLY", assignedAgent: { id: "agent-2", name: "موظف آخر", email: "other@example.com" } }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, refetch: vi.fn() });
    const view = renderAt("/customers/customer-1?tab=tickets", <Route path="/customers/:id" element={<CustomerDetailPage />} />);
    expect(screen.getAllByText("للعرض فقط — مسندة إلى موظف آخر")).toHaveLength(2);
    expect(view.container.querySelectorAll('a[href="/tickets/ticket-1"]')).toHaveLength(0);
    expect(document.documentElement.dir).toBe("rtl");
  });
});

function renderAt(path: string, route: React.ReactNode) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>{route}</Routes></MemoryRouter>);
}
