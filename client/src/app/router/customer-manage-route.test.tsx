import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ role: "AGENT" as "ADMIN" | "MANAGER" | "AGENT" }));
vi.mock("@/features/auth/auth-state", () => ({
  useAuth: () => ({ user: { id: "user-1", name: "User", email: "user@example.com", role: mocks.role, customer: null } }),
}));

import { CustomerManageRoute } from "./customer-manage-route";

function Location() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

describe("CustomerManageRoute", () => {
  afterEach(cleanup);

  it.each(["/customers/new", "/customers/customer-1/edit"])("redirects AGENT away from %s with replace navigation", (path) => {
    mocks.role = "AGENT";
    render(<MemoryRouter initialEntries={[path]}><Routes>
      <Route element={<CustomerManageRoute />}><Route path="/customers/new" element={<span>Form</span>} /><Route path="/customers/:id/edit" element={<span>Form</span>} /></Route>
      <Route path="/customers" element={<Location />} />
    </Routes></MemoryRouter>);
    expect(screen.queryByText("Form")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/customers");
  });

  it.each(["ADMIN", "MANAGER"] as const)("allows %s to open customer forms", (role) => {
    mocks.role = role;
    render(<MemoryRouter initialEntries={["/customers/new"]}><Routes><Route element={<CustomerManageRoute />}><Route path="/customers/new" element={<span>Form</span>} /></Route></Routes></MemoryRouter>);
    expect(screen.getByText("Form")).toBeInTheDocument();
  });
});
