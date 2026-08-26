import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ role: "AGENT" as "ADMIN" | "MANAGER" | "AGENT" | "CUSTOMER" }));
vi.mock("@/features/auth/auth-state", () => ({
  useAuth: () => ({ user: { id: "user-1", name: "User", email: "user@example.com", role: mocks.role, customer: null } }),
}));

import { QuickReplyManageRoute } from "./quick-reply-manage-route";

function Location() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

describe("QuickReplyManageRoute", () => {
  afterEach(cleanup);

  it.each(["/quick-replies", "/quick-replies/new", "/quick-replies/qr-1/edit"])("redirects AGENT away from %s to the dashboard", (path) => {
    mocks.role = "AGENT";
    render(<MemoryRouter initialEntries={[path]}><Routes>
      <Route element={<QuickReplyManageRoute />}>
        <Route path="/quick-replies" element={<span>Manager view</span>} />
        <Route path="/quick-replies/new" element={<span>Manager view</span>} />
        <Route path="/quick-replies/:id/edit" element={<span>Manager view</span>} />
      </Route>
      <Route path="/dashboard" element={<Location />} />
    </Routes></MemoryRouter>);
    expect(screen.queryByText("Manager view")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
  });

  it.each(["ADMIN", "MANAGER"] as const)("allows %s to open the quick replies workspace", (role) => {
    mocks.role = role;
    render(<MemoryRouter initialEntries={["/quick-replies"]}><Routes>
      <Route element={<QuickReplyManageRoute />}><Route path="/quick-replies" element={<span>Manager view</span>} /></Route>
    </Routes></MemoryRouter>);
    expect(screen.getByText("Manager view")).toBeInTheDocument();
  });
});
