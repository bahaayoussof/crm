import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/lib/i18n";
import type { AuthUser } from "@/features/auth/auth.types";
import { Sidebar } from "./sidebar";

const adminUser: AuthUser = {
  id: "u-admin",
  name: "Bahaa Youssof",
  email: "bahaa@example.com",
  role: "ADMIN",
  customer: null,
};

const agentUser: AuthUser = {
  id: "u-agent",
  name: "Agent User",
  email: "agent@example.com",
  role: "AGENT",
  customer: null,
};

const customerUser: AuthUser = {
  id: "u-customer",
  name: "Ahmed Customer",
  email: "ahmed@example.com",
  role: "CUSTOMER",
  customer: { id: "c-1", name: "Ahmed Customer", email: "ahmed@example.com", phone: null },
};

function renderSidebar(props: {
  user?: AuthUser | null;
  audience?: "internal" | "customer";
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onLogout?: () => void;
}) {
  return render(
    <BrowserRouter>
      <Sidebar
        user={props.user ?? adminUser}
        audience={props.audience ?? "internal"}
        collapsed={props.collapsed ?? false}
        onToggleCollapsed={props.onToggleCollapsed ?? vi.fn()}
        onLogout={props.onLogout ?? vi.fn()}
      />
    </BrowserRouter>
  );
}

describe("Sidebar component", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("dir", "ltr");
    document.documentElement.setAttribute("lang", "en");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders expanded sidebar with brand, section headers, search, and user profile", () => {
    renderSidebar({ collapsed: false });

    // Brand
    expect(screen.getByText("Customer Support CRM")).toBeInTheDocument();

    // Section headers
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
    expect(screen.getByText("Management")).toBeInTheDocument();

    // Base nav items
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tickets" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Customers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Knowledge Base" })).toBeInTheDocument();

    // Admin nav items
    expect(screen.getByRole("link", { name: "Reports" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quick Replies" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");

    // Profile card
    expect(screen.getByText("Bahaa Youssof")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();

    // Collapse toggle button
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  it("is a full-height flex column so page content cannot stretch it", () => {
    const { container } = renderSidebar({ collapsed: false });
    const aside = container.querySelector("aside")!;
    expect(aside.className).toMatch(/lg:h-full/);
    expect(aside.className).toMatch(/lg:min-h-0/);
    expect(aside.className).toMatch(/lg:flex-col/);
  });

  it("keeps the nav as the only scroll region, with brand and profile pinned outside it", () => {
    const { container } = renderSidebar({ collapsed: false });
    const aside = container.querySelector("aside")!;
    const nav = aside.querySelector("nav")!;
    // nav absorbs overflow internally
    expect(nav.className).toMatch(/overflow-y-auto/);
    expect(nav.className).toMatch(/min-h-0/);
    expect(nav.className).toMatch(/flex-1/);
    // brand is a pinned sibling, not inside the scroll region
    const brand = screen.getByText("Customer Support CRM");
    expect(nav.contains(brand)).toBe(false);
    // profile/account footer is a pinned sibling, not inside the scroll region
    const profile = container.querySelector("[data-sidebar-profile]")!;
    expect(profile).toBeTruthy();
    expect(profile.className).toMatch(/shrink-0/);
    expect(nav.contains(profile)).toBe(false);
    expect(nav.compareDocumentPosition(profile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the profile/account footer pinned outside the scroll region when collapsed", () => {
    const { container } = renderSidebar({ collapsed: true });
    const nav = container.querySelector("aside nav")!;
    const profile = container.querySelector("[data-sidebar-profile]")!;
    expect(profile.className).toMatch(/shrink-0/);
    expect(nav.contains(profile)).toBe(false);
  });

  it("renders compact navigation rail when collapsed", () => {
    renderSidebar({ collapsed: true });

    // Brand title is hidden in collapsed mode
    expect(screen.queryByText("Customer Support CRM")).not.toBeInTheDocument();

    // Section headers are hidden in collapsed mode
    expect(screen.queryByText("Main")).not.toBeInTheDocument();
    expect(screen.queryByText("Support")).not.toBeInTheDocument();

    // Expand toggle button is present
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();

    // Collapsed user avatar button
    expect(screen.getByRole("button", { name: "Bahaa Youssof" })).toBeInTheDocument();
  });

  it("triggers onToggleCollapsed when collapse button is clicked", () => {
    const onToggle = vi.fn();

    renderSidebar({ collapsed: false, onToggleCollapsed: onToggle });

    const toggleButton = screen.getByRole("button", { name: "Collapse sidebar" });
    fireEvent.click(toggleButton);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("opens portalled user menu and handles logout in expanded mode", () => {
    const onLogout = vi.fn();

    renderSidebar({ collapsed: false, onLogout });

    // Open user menu
    const profileTrigger = screen.getByRole("button", { name: /Bahaa Youssof/i });
    fireEvent.click(profileTrigger);

    // Menu panel should show email and logout action
    expect(screen.getByText("bahaa@example.com")).toBeInTheDocument();
    const logoutBtn = screen.getByRole("menuitem", { name: "Log out" });
    expect(logoutBtn).toBeInTheDocument();

    fireEvent.click(logoutBtn);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("opens portalled user menu and handles logout in collapsed mode", () => {
    const onLogout = vi.fn();

    renderSidebar({ collapsed: true, onLogout });

    // Open user menu via avatar
    const avatarTrigger = screen.getByRole("button", { name: "Bahaa Youssof" });
    fireEvent.click(avatarTrigger);

    // Menu panel is portalled
    expect(screen.getByText("bahaa@example.com")).toBeInTheDocument();
    const logoutBtn = screen.getByRole("menuitem", { name: "Log out" });
    fireEvent.click(logoutBtn);

    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("respects RBAC visibility for AGENT role", () => {
    renderSidebar({ user: agentUser, collapsed: false });

    // AGENT sees base items
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tickets" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Customers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Knowledge Base" })).toBeInTheDocument();

    // AGENT cannot see Management items
    expect(screen.queryByText("Management")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Reports" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Quick Replies" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("renders only customer-safe navigation for the customer audience", () => {
    renderSidebar({ user: customerUser, audience: "customer", collapsed: false });

    // Customer-facing items only
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/portal");
    expect(screen.getByRole("link", { name: "My Requests" })).toHaveAttribute("href", "/portal/tickets");
    expect(screen.getByRole("link", { name: "New Request" })).toHaveAttribute("href", "/portal/tickets/new");
    expect(screen.getByRole("link", { name: "Help Center" })).toHaveAttribute("href", "/portal/knowledge-base");

    // No internal CRM routes leak into the customer sidebar
    for (const name of ["Dashboard", "Tickets", "Customers", "Knowledge Base", "Reports", "Quick Replies", "Users", "Settings"]) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByText("Management")).not.toBeInTheDocument();
    expect(screen.queryByText("Main")).not.toBeInTheDocument();

    // Shared shell behavior is preserved (collapse control + user menu)
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ahmed Customer/i })).toBeInTheDocument();
  });
});
