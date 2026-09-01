import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ role: "AGENT" as "ADMIN" | "MANAGER" | "AGENT" | "CUSTOMER" }));
vi.mock("@/features/auth/auth-state", () => ({
  useAuth: () => ({ user: { id: "user-1", name: "User", email: "user@example.com", role: mocks.role, customer: null } }),
}));

import { ManagerRoute } from "./manager-route";

function Location() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

function renderAt(path = "/manager") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ManagerRoute />}>
          <Route path="/manager" element={<span>Manager console</span>} />
        </Route>
        <Route path="/dashboard" element={<Location />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ManagerRoute", () => {
  afterEach(cleanup);

  it.each(["AGENT", "CUSTOMER"] as const)("redirects %s to the dashboard", (role) => {
    mocks.role = role;
    renderAt();
    expect(screen.queryByText("Manager console")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
  });

  it.each(["MANAGER", "ADMIN"] as const)("admits %s", (role) => {
    mocks.role = role;
    renderAt();
    expect(screen.getByText("Manager console")).toBeInTheDocument();
  });
});
