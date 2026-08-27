import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ role: "ADMIN" as "ADMIN" | "MANAGER" | "AGENT" | "CUSTOMER" }));
vi.mock("@/features/auth/auth-state", () => ({
  useAuth: () => ({ user: { id: "user-1", name: "User", email: "user@example.com", role: mocks.role, customer: null } }),
}));

import { UserManageRoute } from "./user-manage-route";

function Location() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

describe("UserManageRoute", () => {
  afterEach(cleanup);

  it.each(["/users", "/users/new", "/users/u-1/edit"])("redirects non-admins away from %s", (path) => {
    mocks.role = "MANAGER";
    render(<MemoryRouter initialEntries={[path]}><Routes>
      <Route element={<UserManageRoute />}>
        <Route path="/users" element={<span>Admin view</span>} />
        <Route path="/users/new" element={<span>Admin view</span>} />
        <Route path="/users/:id/edit" element={<span>Admin view</span>} />
      </Route>
      <Route path="/dashboard" element={<Location />} />
    </Routes></MemoryRouter>);
    expect(screen.queryByText("Admin view")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
  });

  it("allows ADMIN to open the users workspace", () => {
    mocks.role = "ADMIN";
    render(<MemoryRouter initialEntries={["/users"]}><Routes>
      <Route element={<UserManageRoute />}><Route path="/users" element={<span>Admin view</span>} /></Route>
    </Routes></MemoryRouter>);
    expect(screen.getByText("Admin view")).toBeInTheDocument();
  });
});
