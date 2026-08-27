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

function renderSidebar(props: {
  user?: AuthUser | null;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onLogout?: () => void;
}) {
  return render(
    <BrowserRouter>
      <Sidebar
        user={props.user ?? adminUser}
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

    // Profile card
    expect(screen.getByText("Bahaa Youssof")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();

    // Collapse toggle button
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
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
  });
});
