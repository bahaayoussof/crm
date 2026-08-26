import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext, type AuthContextValue } from "@/features/auth/auth-state";
import { ProtectedRoute } from "@/app/router/protected-route";
import { changeAppLanguage } from "@/lib/i18n";
import { PortalShell } from "./portal-ui";

const customer = { id: "customer-user", name: "Ahmed", email: "ahmed@example.com", role: "CUSTOMER" as const, customer: { id: "customer", name: "Ahmed", email: "ahmed@example.com", phone: null } };
const auth: AuthContextValue = { user: customer, isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() };

describe("Portal shell routing", () => {
  afterEach(cleanup);
  beforeEach(async () => { await changeAppLanguage("en"); vi.clearAllMocks(); });

  it.each([
    ["/portal", "Home"],
    ["/portal/tickets", "My Requests"],
    ["/portal/tickets/new", "New Request"],
    ["/portal/tickets/ticket-1", "My Requests"],
  ])("activates only the expected navigation item at %s", (path, activeLabel) => {
    renderPortal(path);
    expect(screen.getAllByTestId("portal-header")).toHaveLength(1);
    expect(screen.queryByText("Customer Support CRM")).not.toBeInTheDocument();
    const current = screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(activeLabel);
  });

  it("keeps the customer Portal outside the internal application shell", () => {
    renderPortal("/portal/tickets/new");
    expect(screen.getByRole("banner")).toHaveAttribute("data-testid", "portal-header");
    expect(screen.getByRole("navigation", { name: "Portal navigation" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();
  });

  it("redirects an internal role away from customer routes", () => {
    const internalAuth = { ...auth, user: { ...customer, role: "AGENT" as const, customer: null } };
    render(<AuthContext.Provider value={internalAuth}><MemoryRouter initialEntries={["/portal"]}><Routes><Route element={<ProtectedRoute audience="customer" />}><Route path="/portal" element={<PortalShell />} /></Route><Route path="/dashboard" element={<h1>Internal dashboard</h1>} /></Routes></MemoryRouter></AuthContext.Provider>);
    expect(screen.getByRole("heading", { name: "Internal dashboard" })).toBeInTheDocument();
    expect(screen.queryByTestId("portal-header")).not.toBeInTheDocument();
  });
});

function renderPortal(path: string) {
  return render(<AuthContext.Provider value={auth}><MemoryRouter initialEntries={[path]}><Routes><Route element={<ProtectedRoute audience="customer" />}><Route path="/portal" element={<PortalShell />}><Route index element={<h1>Portal home content</h1>} /><Route path="tickets" element={<h1>Requests content</h1>} /><Route path="tickets/new" element={<h1>New request content</h1>} /><Route path="tickets/:id" element={<h1>Request detail content</h1>} /></Route></Route></Routes></MemoryRouter></AuthContext.Provider>);
}
