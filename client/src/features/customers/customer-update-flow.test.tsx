import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { changeAppLanguage } from "@/lib/i18n";

const apiMocks = vi.hoisted(() => ({
  createCustomer: vi.fn(),
  createCustomerNote: vi.fn(),
  deleteCustomer: vi.fn(),
  getCustomer: vi.fn(),
  getCustomerNotes: vi.fn(),
  getCustomers: vi.fn(),
  updateCustomer: vi.fn(),
}));

vi.mock("./customer-api", () => apiMocks);

import { CustomerDetailPage } from "./customer-detail-page";
import { CustomerFormPage } from "./customer-form-page";
import { customerKeys } from "./customer-hooks";
import type { CustomerDetail, CustomerRecord } from "./customer.types";

const initialCustomer: CustomerDetail = {
  id: "customer-1",
  name: "Ahmed Mohamed",
  email: "ahmed@example.com",
  phone: "+201000000000",
  createdAt: "2026-08-20T10:00:00.000Z",
  updatedAt: "2026-08-24T10:00:00.000Z",
  user: null,
  attachments: [],
  supportSummary: {
    openTicketCount: 3,
    totalTicketCount: 7,
    lastInteractionAt: "2026-08-24T10:00:00.000Z",
  },
};

describe("customer update flow", () => {
  afterEach(cleanup);

  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
    apiMocks.getCustomerNotes.mockResolvedValue([]);
  });

  it("refetches full customer detail before navigating after a partial PATCH response", async () => {
    const updatedCustomer: CustomerDetail = {
      ...initialCustomer,
      name: "Ahmed Youssef",
      updatedAt: "2026-08-24T11:00:00.000Z",
    };
    const patchResponse: CustomerRecord = {
      id: updatedCustomer.id,
      name: updatedCustomer.name,
      email: updatedCustomer.email,
      phone: updatedCustomer.phone,
      createdAt: updatedCustomer.createdAt,
      updatedAt: updatedCustomer.updatedAt,
    };
    apiMocks.getCustomer.mockResolvedValueOnce(initialCustomer).mockResolvedValue(updatedCustomer);
    apiMocks.updateCustomer.mockResolvedValue(patchResponse);
    const queryClient = renderCustomerFlow();

    const nameInput = await screen.findByLabelText("Name");
    await waitFor(() => expect(nameInput).toHaveValue(initialCustomer.name));
    fireEvent.change(nameInput, { target: { value: updatedCustomer.name } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/customers\/customer-1$/), { timeout: 3000 });
    expect(screen.getByRole("heading", { name: updatedCustomer.name })).toBeInTheDocument();
    const summary = screen.getByRole("heading", { name: "Support summary" }).closest("section");
    expect(summary).not.toBeNull();
    expect(within(summary as HTMLElement).getByText("3")).toBeInTheDocument();
    expect(apiMocks.updateCustomer).toHaveBeenCalledWith("customer-1", expect.objectContaining({ name: updatedCustomer.name }));
    expect(apiMocks.getCustomer.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(queryClient.getQueryData(customerKeys.detail("customer-1"))).toEqual(updatedCustomer);
  });

  it("keeps the edit form and entered values when the update fails", async () => {
    apiMocks.getCustomer.mockResolvedValue(initialCustomer);
    apiMocks.updateCustomer.mockRejectedValue(new Error("Update failed"));
    renderCustomerFlow();

    const nameInput = await screen.findByLabelText("Name");
    await waitFor(() => expect(nameInput).toHaveValue(initialCustomer.name));
    fireEvent.change(nameInput, { target: { value: "Unsaved customer name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(apiMocks.updateCustomer).toHaveBeenCalledOnce());
    expect(screen.getByTestId("location")).toHaveTextContent("/customers/customer-1/edit");
    expect(nameInput).toHaveValue("Unsaved customer name");
  });
});

function renderCustomerFlow() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/customers/customer-1/edit"]}>
        <LocationProbe />
        <Routes>
          <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}
