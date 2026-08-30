import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext, type AuthContextValue } from "@/features/auth/auth-state";
import { ProtectedRoute } from "@/app/router/protected-route";
import { changeAppLanguage } from "@/lib/i18n";

const customer = {
  id: "customer-user",
  name: "Ahmed",
  email: "ahmed@example.com",
  role: "CUSTOMER" as const,
  customer: { id: "customer", name: "Ahmed", email: "ahmed@example.com", phone: null },
};
const auth: AuthContextValue = { user: customer, isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() };

const CUSTOMER_NAV = [
  ["Overview", "/portal"],
  ["My Requests", "/portal/tickets"],
  ["New Request", "/portal/tickets/new"],
  ["Help Center", "/portal/knowledge-base"],
  ["Profile", "/portal/profile"],
] as const;

const INTERNAL_ONLY_NAV = ["Dashboard", "Tickets", "Customers", "Knowledge Base", "Reports", "Users", "Settings"];

describe("Portal shell routing", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
  });

  it("renders the customer Portal inside the shared application shell", () => {
    renderPortal("/portal");

    // Shared shell: the same primary navigation landmark as the internal CRM
    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(nav).toBeInTheDocument();

    // Customer-safe items are present with the real Portal routes
    for (const [label, href] of CUSTOMER_NAV) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  it("never exposes internal CRM navigation to a CUSTOMER", () => {
    renderPortal("/portal/tickets");
    for (const name of INTERNAL_ONLY_NAV) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
  });

  it.each([
    ["/portal", ["Overview"]],
    ["/portal/tickets", ["My Requests"]],
    // `/portal/tickets/new` has its own nav item — the parent "My Requests" must NOT also light up
    ["/portal/tickets/new", ["New Request"]],
    // ticket detail has no dedicated nav item — the section parent stays active
    ["/portal/tickets/ticket-1", ["My Requests"]],
    ["/portal/knowledge-base", ["Help Center"]],
    ["/portal/knowledge-base/article-1", ["Help Center"]],
  ])("marks exactly the expected active navigation item at %s", (path, expected) => {
    renderPortal(path);
    const active = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
      .map((link) => link.textContent?.trim());
    expect(active).toEqual(expected);
  });

  it("redirects an internal role away from customer routes", () => {
    const internalAuth = { ...auth, user: { ...customer, role: "AGENT" as const, customer: null } };
    render(
      <AuthContext.Provider value={internalAuth}>
        <MemoryRouter initialEntries={["/portal"]}>
          <Routes>
            <Route element={<ProtectedRoute audience="customer" />}>
              <Route path="/portal" element={<h1>Portal home content</h1>} />
            </Route>
            <Route path="/dashboard" element={<h1>Internal dashboard</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.getByRole("heading", { name: "Internal dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();
  });
});

function renderPortal(path: string) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<ProtectedRoute audience="customer" />}>
            <Route path="/portal" element={<h1>Portal home content</h1>} />
            <Route path="/portal/tickets" element={<h1>Requests content</h1>} />
            <Route path="/portal/tickets/new" element={<h1>New request content</h1>} />
            <Route path="/portal/tickets/:id" element={<h1>Request detail content</h1>} />
            <Route path="/portal/knowledge-base" element={<h1>Help center content</h1>} />
            <Route path="/portal/knowledge-base/:id" element={<h1>Help article content</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
