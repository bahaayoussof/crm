import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  useCustomers: vi.fn(), useCustomer: vi.fn(), useCustomerNotes: vi.fn(),
  useCreateCustomer: vi.fn(), useUpdateCustomer: vi.fn(), useDeleteCustomer: vi.fn(), useCreateCustomerNote: vi.fn(),
  createCustomer: vi.fn(), updateCustomer: vi.fn(), deleteCustomer: vi.fn(), createNote: vi.fn(),
}));

vi.mock("./customer-hooks", () => ({
  useCustomers: mocks.useCustomers, useCustomer: mocks.useCustomer, useCustomerNotes: mocks.useCustomerNotes,
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

describe("customer pages", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
    mocks.useCustomers.mockReturnValue({ isLoading: false, isError: false, data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }, refetch: vi.fn() });
    mocks.useCustomer.mockReturnValue({ isLoading: false, isError: false, data: customer });
    mocks.useCustomerNotes.mockReturnValue({ isLoading: false, isError: false, data: [{ id: "note-1", body: "Internal note text", createdAt: customer.updatedAt, author: { id: "admin-1", name: "Admin", role: "ADMIN" } }], refetch: vi.fn() });
    mocks.useCreateCustomer.mockReturnValue({ mutateAsync: mocks.createCustomer });
    mocks.useUpdateCustomer.mockReturnValue({ mutateAsync: mocks.updateCustomer });
    mocks.useDeleteCustomer.mockReturnValue({ mutateAsync: mocks.deleteCustomer, isPending: false });
    mocks.useCreateCustomerNote.mockReturnValue({ mutateAsync: mocks.createNote });
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

  it("renders representative customer list and detail UI in Arabic", async () => {
    await changeAppLanguage("ar");
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
  });
});

function renderAt(path: string, route: React.ReactNode) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>{route}</Routes></MemoryRouter>);
}
