import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ role: "AGENT" as "ADMIN" | "MANAGER" | "AGENT" | "CUSTOMER" }));
vi.mock("@/features/auth/auth-state", () => ({
  useAuth: () => ({ user: { id: "user-1", name: "User", email: "user@example.com", role: mocks.role, customer: null } }),
}));

import { ReportsRoute } from "./reports-route";

function Location() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

describe("ReportsRoute", () => {
  afterEach(cleanup);

  it("redirects AGENT away from /reports to the dashboard", () => {
    mocks.role = "AGENT";
    render(<MemoryRouter initialEntries={["/reports"]}><Routes>
      <Route element={<ReportsRoute />}><Route path="/reports" element={<span>Reports view</span>} /></Route>
      <Route path="/dashboard" element={<Location />} />
    </Routes></MemoryRouter>);
    expect(screen.queryByText("Reports view")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
  });

  it.each(["ADMIN", "MANAGER"] as const)("allows %s to open reports", (role) => {
    mocks.role = role;
    render(<MemoryRouter initialEntries={["/reports"]}><Routes>
      <Route element={<ReportsRoute />}><Route path="/reports" element={<span>Reports view</span>} /></Route>
    </Routes></MemoryRouter>);
    expect(screen.getByText("Reports view")).toBeInTheDocument();
  });
});
