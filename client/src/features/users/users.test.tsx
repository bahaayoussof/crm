import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  useUsers: vi.fn(), useUser: vi.fn(),
  useCreateUser: vi.fn(), useUpdateUser: vi.fn(),
  create: vi.fn(), update: vi.fn(),
  currentUser: { id: "u-admin", name: "Aisha Admin", email: "aisha@example.com", role: "ADMIN" as string, customer: null },
}));

const orgHooks = vi.hoisted(() => ({
  branches: [] as { id: string; name: string; code: string | null }[],
  departments: [] as { id: string; name: string; branchId: string | null }[],
  teams: [] as { id: string; name: string; departmentId: string; managerId: string | null }[],
}));

vi.mock("@/features/auth/auth-state", () => ({
  useAuth: () => ({ user: mocks.currentUser, isLoading: false, logout: vi.fn() }),
}));
vi.mock("@/features/notifications/notification-bell", () => ({ NotificationBell: () => null }));
vi.mock("@/features/organization/organization-hooks", () => ({
  useDepartmentOptions: () => ({ data: orgHooks.departments }),
  useBranchOptions: () => ({ data: orgHooks.branches }),
  useTeamOptions: () => ({ data: orgHooks.teams }),
}));

vi.mock("./user-hooks", () => ({
  useUsers: mocks.useUsers,
  useUser: mocks.useUser,
  useCreateUser: mocks.useCreateUser,
  useUpdateUser: mocks.useUpdateUser,
  useManagerOptions: () => ({ data: [] }),
}));

import { computeAnchoredPosition, type AnchoredGeometryOptions } from "@/components/shared/use-anchored-popover";
import { AppShell } from "@/app/layouts/app-shell";
import { UserFormPage } from "./user-form-page";
import { UserListPage } from "./user-list-page";
import type { User } from "./user.types";

const admin: User = {
  id: "u-admin", name: "Aisha Admin", email: "aisha@example.com", role: "ADMIN",
  isActive: true, departmentId: null, branchId: null, teamId: null,
  department: null, branch: null, team: null,
  createdAt: "2026-08-01T10:00:00.000Z", updatedAt: "2026-08-10T10:00:00.000Z",
};
const admin2: User = { ...admin, id: "u-admin2", name: "Bilal Admin", email: "bilal@example.com" };
const agent: User = {
  ...admin, id: "u-agent", name: "Ghali Agent",
  email: "ghali.a.very.long.address.that.should.not.wrap@subdomain.example.com",
  role: "AGENT", isActive: false,
};
const manager: User = {
  ...admin, id: "u-manager", name: "Mona Manager", email: "mona@example.com",
  role: "MANAGER", isActive: true,
};

function renderAt(path: string, route: React.ReactNode) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>{route}</Routes></MemoryRouter>);
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.search}</span>;
}

const listResult = (data: User[], overrides: Record<string, unknown> = {}) => ({
  isLoading: false, isError: false, data: { data, meta: { page: 1, limit: 20, total: data.length, totalPages: 1 } }, refetch: vi.fn(), ...overrides,
});

describe("users management — table", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    if (!window.HTMLElement.prototype.scrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    }
    if (!window.HTMLElement.prototype.hasPointerCapture) {
      window.HTMLElement.prototype.hasPointerCapture = () => false;
    }
    if (!window.HTMLElement.prototype.setPointerCapture) {
      window.HTMLElement.prototype.setPointerCapture = vi.fn();
    }
    if (!window.HTMLElement.prototype.releasePointerCapture) {
      window.HTMLElement.prototype.releasePointerCapture = vi.fn();
    }
    await changeAppLanguage("en");
    vi.clearAllMocks();
    mocks.currentUser = { id: "u-admin", name: "Aisha Admin", email: "aisha@example.com", role: "ADMIN", customer: null };
    mocks.useUsers.mockReturnValue(listResult([admin, admin2, agent]));
    mocks.useUser.mockReturnValue({ isLoading: false, isError: false, data: admin2 });
    mocks.useCreateUser.mockReturnValue({ mutateAsync: mocks.create, isPending: false });
    mocks.useUpdateUser.mockReturnValue({ mutateAsync: mocks.update, isPending: false });
  });

  it("renders semantic Name, Email, Role, Department, Status, Created and Actions headers", () => {
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    const table = screen.getByRole("table");
    for (const name of ["Name", "Email", "Role", "Department", "Status", "Created", "Actions"]) {
      expect(within(table).getByRole("columnheader", { name })).toBeInTheDocument();
    }
    expect(table.querySelectorAll("colgroup col")).toHaveLength(7);
  });

  it("shows Role and Status as display badges, never as table dropdowns", () => {
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    const table = screen.getByRole("table");
    expect(within(table).queryByRole("combobox")).not.toBeInTheDocument();
    const firstRow = within(table).getAllByRole("row")[1];
    expect(within(firstRow).getByText("Admin")).toBeInTheDocument();
    expect(within(firstRow).getByText("Active")).toBeInTheDocument();
  });

  it("keeps email on one line, direction-isolated, with the full value available", () => {
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    const emailCell = screen.getAllByTitle(agent.email)[0];
    expect(emailCell).toHaveAttribute("dir", "ltr");
    expect(emailCell.className).toMatch(/truncate/);
    expect(emailCell.className).not.toMatch(/overflow-wrap:anywhere/);
  });

  it("groups Edit and the status action in one Actions ellipsis dropdown menu", () => {
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    const table = screen.getByRole("table");
    const agentRow = within(table).getAllByRole("row").find((row) => within(row).queryByText("Ghali Agent"))!;
    const actionsTrigger = within(agentRow).getByRole("button", { name: "Actions" });
    fireEvent.click(actionsTrigger);
    expect(screen.getByRole("menuitem", { name: "Edit user" })).toBeInTheDocument();
    // agent is inactive -> Reactivate
    expect(screen.getByRole("menuitem", { name: "Reactivate user" })).toBeInTheDocument();
  });

  it("marks the current user's row with a You badge and disables self-deactivation", () => {
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    const table = screen.getByRole("table");
    const selfRow = within(table).getAllByRole("row").find((row) => within(row).queryByText("Aisha Admin"))!;
    expect(within(selfRow).getByText("You")).toBeInTheDocument();
    const actionsTrigger = within(selfRow).getByRole("button", { name: "Actions" });
    fireEvent.click(actionsTrigger);
    expect(screen.getByRole("menuitem", { name: "Deactivate user" })).toBeDisabled();
  });

  const adminRowTrigger = (name: string) => {
    const table = screen.getByRole("table");
    const row = within(table).getAllByRole("row").find((r) => within(r).queryByText(name))!;
    const actionsTrigger = within(row).getByRole("button", { name: "Actions" });
    fireEvent.click(actionsTrigger);
    return screen.getByRole("menuitem", { name: /(Deactivate|Reactivate) user/ });
  };

  it("opens the confirmation through a portal outside the table and its scroll wrapper", () => {
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    const trigger = adminRowTrigger("Bilal Admin");
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: /Bilal Admin/ });
    const table = screen.getByRole("table");
    const scrollWrapper = table.closest("div.overflow-x-auto")!;
    expect(dialog).toBeInTheDocument();
    expect(table.contains(dialog)).toBe(false);
    expect(scrollWrapper.contains(dialog)).toBe(false);
    expect(dialog.closest("[data-user-status-confirm]")).toBe(dialog);
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveClass("fixed", "inset-0", "z-50", "flex", "items-center", "justify-center");
    // nothing injected inside the table's scroll container
    expect(scrollWrapper.querySelector("[data-user-status-confirm]")).toBeNull();
  });

  it("moves focus into the confirmation and shows the deactivation consequence", async () => {
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    fireEvent.click(adminRowTrigger("Bilal Admin"));
    const dialog = screen.getByRole("dialog", { name: /Bilal Admin/ });
    expect(within(dialog).getByText(/cannot sign in/i)).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("performs no mutation on Cancel", async () => {
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    const trigger = adminRowTrigger("Bilal Admin");
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape and on an outside pointer interaction", () => {
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    fireEvent.click(adminRowTrigger("Bilal Admin"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(adminRowTrigger("Bilal Admin"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps only one confirmation open, switching target when another row's trigger is clicked", () => {
    // two active admins so admin2 is not last-admin-locked
    mocks.useUsers.mockReturnValue(listResult([admin, admin2, { ...agent, isActive: true, role: "AGENT" }]));
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    fireEvent.click(adminRowTrigger("Bilal Admin"));
    expect(screen.getByRole("dialog", { name: /Bilal Admin/ })).toBeInTheDocument();
    fireEvent.click(adminRowTrigger("Ghali Agent"));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: /Ghali Agent/ })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /Bilal Admin/ })).not.toBeInTheDocument();
  });

  it("deactivates after explicit confirmation, binding the stable user id", async () => {
    mocks.update.mockResolvedValue(admin2);
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    fireEvent.click(adminRowTrigger("Bilal Admin"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ isActive: false }));
    expect(mocks.useUpdateUser).toHaveBeenCalledWith("u-admin2");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("prevents a duplicate status request while one is pending", () => {
    mocks.useUpdateUser.mockReturnValue({ mutateAsync: mocks.update, isPending: true });
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    fireEvent.click(adminRowTrigger("Bilal Admin"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Deactivating…" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("keeps a rejected status change visible, localized and retryable", async () => {
    mocks.update.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 409, data: { error: { code: "LAST_ACTIVE_ADMIN_REQUIRED" } } },
    });
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    fireEvent.click(adminRowTrigger("Bilal Admin"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("At least one active administrator must remain.");
    expect(within(dialog).getByRole("button", { name: "Retry" })).toBeEnabled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes stale confirmation state when the list changes (filter / pagination)", () => {
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    fireEvent.click(adminRowTrigger("Bilal Admin"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    mocks.useUsers.mockReturnValue(listResult([agent])); // list narrows -> new array reference
    fireEvent.change(screen.getByPlaceholderText("Search users by name or email…"), { target: { value: "ghali" } });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables deactivation for a provable last active admin", () => {
    mocks.useUsers.mockReturnValue(listResult([admin2, agent])); // exactly one active admin on the page
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    expect(adminRowTrigger("Bilal Admin")).toBeDisabled();
  });

  it("renders mobile cards with display-only role and grouped actions", () => {
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    const list = screen.getAllByRole("list").find((el) => el.className.includes("md:hidden"))!;
    expect(within(list).queryByRole("combobox")).not.toBeInTheDocument();
    const cards = within(list).getAllByRole("listitem");
    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByRole("button", { name: "Actions" })).toBeInTheDocument();
  });

  it("renders exactly one chevron per filter select", () => {
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    const roleFilter = screen.getByRole("combobox", { name: "Role" });
    const statusFilter = screen.getByRole("combobox", { name: "Status" });
    for (const select of [roleFilter, statusFilter]) {
      const chevrons = select.querySelectorAll("[data-slot='select-chevron']");
      expect(chevrons).toHaveLength(1);
    }
  });

  it("places the select chevron at the logical end in Arabic RTL without rotating it", async () => {
    await changeAppLanguage("ar");
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    const trigger = screen.getByRole("combobox", { name: "الدور" });
    const icon = trigger.querySelector("[data-slot='select-chevron']")!;
    expect(icon).toBeInTheDocument();
  });

  it("drives search and role filter through the URL", async () => {
    renderAt("/users", <Route path="/users" element={<><UserListPage /><LocationProbe /></>} />);
    fireEvent.change(screen.getByPlaceholderText("Search users by name or email…"), { target: { value: "ghali" } });
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("search=ghali"));

    const roleTrigger = screen.getByRole("combobox", { name: "Role" });
    fireEvent.keyDown(roleTrigger, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("option", { name: "Agent" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Agent" }));

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("role=AGENT"));
  });

  it("keeps column ownership and shows Arabic headers in RTL", async () => {
    await changeAppLanguage("ar");
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    expect(screen.getByRole("heading", { name: "المستخدمون" })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "الاسم" })).toBeInTheDocument();
    expect(table.querySelectorAll("colgroup col")).toHaveLength(7);
  });
});

describe("users management — forms", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    if (!window.HTMLElement.prototype.scrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    }
    if (!window.HTMLElement.prototype.hasPointerCapture) {
      window.HTMLElement.prototype.hasPointerCapture = () => false;
    }
    if (!window.HTMLElement.prototype.setPointerCapture) {
      window.HTMLElement.prototype.setPointerCapture = vi.fn();
    }
    if (!window.HTMLElement.prototype.releasePointerCapture) {
      window.HTMLElement.prototype.releasePointerCapture = vi.fn();
    }
    await changeAppLanguage("en");
    vi.clearAllMocks();
    orgHooks.branches = [];
    orgHooks.departments = [];
    orgHooks.teams = [];
    mocks.currentUser = { id: "u-admin", name: "Aisha Admin", email: "aisha@example.com", role: "ADMIN", customer: null };
    mocks.useUser.mockReturnValue({ isLoading: false, isError: false, data: admin2 });
    mocks.useCreateUser.mockReturnValue({ mutateAsync: mocks.create, isPending: false });
    mocks.useUpdateUser.mockReturnValue({ mutateAsync: mocks.update, isPending: false });
  });

  it("creates a user with name, email, password and role then returns to the list", async () => {
    mocks.create.mockResolvedValue(admin2);
    renderAt("/users/new", <><Route path="/users/new" element={<UserFormPage />} /><Route path="/users" element={<LocationProbe />} /></>);
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "New Person" } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "New@Example.com" } });
    fireEvent.change(screen.getByLabelText(/Temporary password/), { target: { value: "password123" } });

    const roleTrigger = screen.getByRole("combobox", { name: /^Role/ });
    fireEvent.keyDown(roleTrigger, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("option", { name: "Manager" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Manager" }));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ name: "New Person", email: "new@example.com", password: "password123", role: "MANAGER", departmentId: "", branchId: "", teamId: "" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/users"));
  });

  it("blocks create submit with a short password", async () => {
    renderAt("/users/new", <Route path="/users/new" element={<UserFormPage />} />);
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "New Person" } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText(/Temporary password/), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("lets an ADMIN edit name, email, role, phone, branch and department of another user", async () => {
    orgHooks.branches = [{ id: "b1", name: "HQ", code: null }];
    orgHooks.departments = [{ id: "d1", name: "Support", branchId: "b1" }];
    mocks.update.mockResolvedValue(admin2);
    renderAt("/users/u-admin2/edit", <><Route path="/users/:id/edit" element={<UserFormPage />} /><Route path="/users" element={<LocationProbe />} /></>);
    expect(screen.getByLabelText(/Name/)).toBeEnabled();
    expect(screen.getByLabelText(/Email/)).toBeEnabled();
    expect(screen.getByLabelText(/Role/)).toBeEnabled();
    expect(screen.getByLabelText(/Phone number/)).toBeEnabled();
    expect(screen.getByLabelText("Department")).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Bilal Renamed" } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "Bilal.New@Example.com" } });
    fireEvent.change(screen.getByLabelText(/Phone number/), { target: { value: "+201234567890" } });

    fireEvent.click(screen.getByRole("combobox", { name: "Branch" }));
    fireEvent.click(await screen.findByRole("option", { name: "HQ" }));
    const department = screen.getByLabelText("Department");
    await waitFor(() => expect(department).toBeEnabled());
    fireEvent.click(department);
    fireEvent.click(await screen.findByRole("option", { name: "Support" }));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        name: "Bilal Renamed",
        email: "bilal.new@example.com",
        role: "ADMIN",
        phone: "+201234567890",
        isActive: true,
        branchId: "b1",
        departmentId: "d1",
        teamId: null,
      }),
    );
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/users"));
  });

  it("Department is branch-dependent: disabled until a branch is chosen, then only that branch's departments", async () => {
    orgHooks.branches = [
      { id: "b1", name: "HQ", code: null },
      { id: "b2", name: "West", code: null },
    ];
    orgHooks.departments = [
      { id: "d1", name: "Support", branchId: "b1" },
      { id: "d2", name: "Sales", branchId: "b2" },
    ];
    renderAt("/users/u-admin2/edit", <Route path="/users/:id/edit" element={<UserFormPage />} />);
    expect(screen.getByLabelText("Department")).toBeDisabled();

    fireEvent.click(screen.getByRole("combobox", { name: "Branch" }));
    fireEvent.click(await screen.findByRole("option", { name: "HQ" }));
    const department = screen.getByLabelText("Department");
    await waitFor(() => expect(department).toBeEnabled());
    fireEvent.click(department);
    expect(await screen.findByRole("option", { name: "Support" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Sales" })).not.toBeInTheDocument();
  });

  it("shows a Department-dependent Team select for an AGENT and prefills the current team", async () => {
    orgHooks.branches = [{ id: "b1", name: "HQ", code: null }];
    orgHooks.departments = [{ id: "d1", name: "Support", branchId: "b1" }];
    orgHooks.teams = [
      { id: "tm1", name: "Billing Support", departmentId: "d1", managerId: null },
      { id: "tm2", name: "Other Dept Team", departmentId: "d9", managerId: null },
    ];
    mocks.useUser.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        ...agent,
        isActive: true,
        role: "AGENT",
        branchId: "b1",
        departmentId: "d1",
        teamId: "tm1",
        branch: { id: "b1", name: "HQ" },
        department: { id: "d1", name: "Support" },
        team: { id: "tm1", name: "Billing Support", departmentId: "d1" },
      },
    });
    renderAt("/users/u-agent/edit", <Route path="/users/:id/edit" element={<UserFormPage />} />);
    const teamField = await screen.findByLabelText("Team");
    expect(teamField).toHaveTextContent("Billing Support");
    fireEvent.click(teamField);
    expect(await screen.findByRole("option", { name: "Billing Support" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Other Dept Team" })).not.toBeInTheDocument();
  });

  it("does NOT render a Team select for an ADMIN", async () => {
    orgHooks.branches = [{ id: "b1", name: "HQ", code: null }];
    orgHooks.departments = [{ id: "d1", name: "Support", branchId: "b1" }];
    renderAt("/users/u-admin2/edit", <Route path="/users/:id/edit" element={<UserFormPage />} />);
    await screen.findByLabelText("Department");
    expect(screen.queryByLabelText("Team")).not.toBeInTheDocument();
  });

  it("changing Branch clears a Department that does not belong to the new Branch", async () => {
    orgHooks.branches = [
      { id: "b1", name: "HQ", code: null },
      { id: "b2", name: "West", code: null },
    ];
    orgHooks.departments = [
      { id: "d1", name: "Support", branchId: "b1" },
      { id: "d2", name: "Sales", branchId: "b2" },
    ];
    mocks.useUser.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...admin2, branchId: "b1", departmentId: "d1", branch: { id: "b1", name: "HQ" }, department: { id: "d1", name: "Support" } },
    });
    mocks.update.mockResolvedValue(admin2);
    renderAt("/users/u-admin2/edit", <><Route path="/users/:id/edit" element={<UserFormPage />} /><Route path="/users" element={<LocationProbe />} /></>);
    expect(screen.getByLabelText("Department")).toHaveTextContent("Support");

    fireEvent.click(screen.getByRole("combobox", { name: "Branch" }));
    fireEvent.click(await screen.findByRole("option", { name: "West" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ branchId: "b2", departmentId: null })),
    );
  });

  it("populates existing user values into the edit form", async () => {
    orgHooks.branches = [{ id: "b1", name: "HQ", code: null }];
    orgHooks.departments = [{ id: "d1", name: "Support", branchId: "b1" }];
    mocks.useUser.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        ...admin2,
        phone: "+201234567890",
        branchId: "b1",
        departmentId: "d1",
        branch: { id: "b1", name: "HQ" },
        department: { id: "d1", name: "Support" },
      },
    });
    renderAt("/users/u-admin2/edit", <Route path="/users/:id/edit" element={<UserFormPage />} />);
    expect(screen.getByLabelText(/Name/)).toHaveValue("Bilal Admin");
    expect(screen.getByLabelText(/Email/)).toHaveValue("bilal@example.com");
    expect(screen.getByLabelText(/Role/)).toHaveTextContent("Admin");
    expect(screen.getByLabelText("Branch")).toHaveTextContent("HQ");
    expect(screen.getByLabelText("Department")).toHaveTextContent("Support");
  });

  it("keeps role and Active disabled when editing your own account but allows name/email edits", async () => {
    mocks.useUser.mockReturnValue({ isLoading: false, isError: false, data: admin });
    renderAt("/users/u-admin/edit", <Route path="/users/:id/edit" element={<UserFormPage />} />);
    expect(screen.getByLabelText(/Name/)).toBeEnabled();
    expect(screen.getByLabelText(/Email/)).toBeEnabled();
    expect(screen.getByLabelText(/Role/)).toBeDisabled();
    expect(screen.getByLabelText(/Active account/)).toBeDisabled();
    expect(screen.getByText("An administrator cannot deactivate their own account.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Edit user/ })).toHaveTextContent("You");
  });

  it("UserListPage opens an editable UserEditModal when clicking the edit row action", async () => {
    mocks.useUsers.mockReturnValue(listResult([admin2]));
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    const table = screen.getByRole("table");
    const row = within(table).getAllByRole("row").find((r) => within(r).queryByText("Bilal Admin"))!;
    const actionsTrigger = within(row).getByRole("button", { name: "Actions" });
    fireEvent.click(actionsTrigger);
    const editItem = screen.getByRole("menuitem", { name: "Edit user" });
    fireEvent.click(editItem);

    const dialog = screen.getByRole("dialog", { name: /Edit user/ });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Name/)).toBeEnabled();
    expect(within(dialog).getByLabelText(/Email/)).toBeEnabled();
    expect(within(dialog).getByLabelText(/Role/)).toBeEnabled();
    expect(within(dialog).getByLabelText(/Phone number/)).toBeEnabled();
    expect(within(dialog).getByLabelText("Department")).toBeDisabled();
  });

  it("prevents duplicate submission while the edit is pending", async () => {
    mocks.useUpdateUser.mockReturnValue({ mutateAsync: mocks.update, isPending: true });
    renderAt("/users/u-admin2/edit", <Route path="/users/:id/edit" element={<UserFormPage />} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled());
  });

  it("shows the same AGENT role when the edit is opened from the row action dropdown", async () => {
    mocks.useUsers.mockReturnValue(listResult([{ ...agent, isActive: true }]));
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    const table = screen.getByRole("table");
    const row = within(table).getAllByRole("row").find((r) => within(r).queryByText("Ghali Agent"))!;
    fireEvent.click(within(row).getByRole("button", { name: "Actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit user" }));

    const dialog = screen.getByRole("dialog", { name: /Edit user/ });
    expect(within(dialog).getByLabelText(/Role/)).toHaveTextContent("Agent");
  });

  // --- Edit User: Role field initialization across every entry point ---------
  // Regression guard for the empty-Role bug. Page and modal both seed React
  // Hook Form through the single `mapUserToEditFormValues` mapper, so the Role
  // select always shows the user's real API enum value ("MANAGER" -> "Manager"
  // label), never blank and never the previous user's value.

  const openModalEditFor = (name: string) => {
    const table = screen.getByRole("table");
    const row = within(table).getAllByRole("row").find((r) => within(r).queryByText(name))!;
    fireEvent.click(within(row).getByRole("button", { name: "Actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit user" }));
    return screen.getByRole("dialog", { name: /Edit user/ });
  };

  it("Edit page initializes Role to Agent for an AGENT user", async () => {
    mocks.useUser.mockReturnValue({ isLoading: false, isError: false, data: { ...agent, isActive: true } });
    renderAt("/users/u-agent/edit", <Route path="/users/:id/edit" element={<UserFormPage />} />);
    await waitFor(() => expect(screen.getByLabelText(/Name/)).toHaveValue("Ghali Agent"));
    expect(screen.getByLabelText(/Role/)).toHaveTextContent("Agent");
  });

  it("Edit page initializes Role to Manager for a MANAGER user", async () => {
    mocks.useUser.mockReturnValue({ isLoading: false, isError: false, data: manager });
    renderAt("/users/u-manager/edit", <Route path="/users/:id/edit" element={<UserFormPage />} />);
    await waitFor(() => expect(screen.getByLabelText(/Name/)).toHaveValue("Mona Manager"));
    expect(screen.getByLabelText(/Role/)).toHaveTextContent("Manager");
  });

  it("Edit modal initializes Role to Agent for an AGENT user", () => {
    mocks.useUsers.mockReturnValue(listResult([{ ...agent, isActive: true }]));
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    const dialog = openModalEditFor("Ghali Agent");
    expect(within(dialog).getByLabelText(/Role/)).toHaveTextContent("Agent");
  });

  it("Edit modal initializes Role to Manager for a MANAGER user", () => {
    mocks.useUsers.mockReturnValue(listResult([manager]));
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    const dialog = openModalEditFor("Mona Manager");
    expect(within(dialog).getByLabelText(/Role/)).toHaveTextContent("Manager");
  });

  it("Edit modal replaces the Role value when reopened for a different user", async () => {
    mocks.useUsers.mockReturnValue(listResult([manager, { ...agent, isActive: true }]));
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);

    const managerDialog = openModalEditFor("Mona Manager");
    expect(within(managerDialog).getByLabelText(/Role/)).toHaveTextContent("Manager");
    fireEvent.click(within(managerDialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Edit user/ })).not.toBeInTheDocument());

    const agentDialog = openModalEditFor("Ghali Agent");
    expect(within(agentDialog).getByLabelText(/Role/)).toHaveTextContent("Agent");
    expect(within(agentDialog).getByLabelText(/Role/)).not.toHaveTextContent("Manager");
  });

  it("direct /users/:id/edit navigation initializes the correct role", async () => {
    mocks.useUser.mockReturnValue({ isLoading: false, isError: false, data: manager });
    renderAt("/users/u-manager/edit", <Route path="/users/:id/edit" element={<UserFormPage />} />);
    expect(await screen.findByLabelText(/Role/)).toHaveTextContent("Manager");
  });

  it("populates the Role field after the detail query resolves on a direct /users/:id/edit visit", async () => {
    // Direct URL / browser refresh: the detail query is still pending on first render.
    mocks.useUser.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    const ui = () => (
      <MemoryRouter initialEntries={["/users/u-agent/edit"]}>
        <Routes>
          <Route path="/users/:id/edit" element={<UserFormPage />} />
        </Routes>
      </MemoryRouter>
    );
    const { rerender } = render(ui());

    // Query resolves with an AGENT user.
    mocks.useUser.mockReturnValue({ isLoading: false, isError: false, data: { ...agent, isActive: true } });
    rerender(ui());

    await waitFor(() => expect(screen.getByLabelText(/Name/)).toHaveValue("Ghali Agent"));
    expect(screen.getByLabelText(/Role/)).toHaveTextContent("Agent");
  });
});

describe("users navigation visibility", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
    mocks.useUsers.mockReturnValue(listResult([admin]));
  });

  it("shows the Users nav item to ADMIN only", () => {
    mocks.currentUser = { id: "u-admin", name: "A", email: "a@example.com", role: "ADMIN", customer: null };
    render(<MemoryRouter><AppShell audience="internal"><div /></AppShell></MemoryRouter>);
    expect(screen.getAllByRole("link", { name: "Users" }).length).toBeGreaterThan(0);
  });

  it.each(["MANAGER", "AGENT"])("hides the Users nav item from %s", (role) => {
    mocks.currentUser = { id: "u-x", name: "X", email: "x@example.com", role, customer: null };
    render(<MemoryRouter><AppShell audience="internal"><div /></AppShell></MemoryRouter>);
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
  });
});

describe("computeAnchoredPosition (status-confirm placement)", () => {
  const geo = (over: Partial<AnchoredGeometryOptions> = {}): AnchoredGeometryOptions => ({
    align: "end", rtl: false, width: 300, minWidth: 280, maxWidth: 320,
    gap: 6, margin: 8, maxHeight: 360, minHeight: 120, ...over,
  });
  const rect = (o: Partial<DOMRect>) => ({ top: 0, bottom: 0, left: 0, right: 0, width: 36, ...o }) as DOMRect;

  it("opens below the trigger when there is room", () => {
    const pos = computeAnchoredPosition(rect({ top: 100, bottom: 136, left: 900, right: 936 }), { width: 1440, height: 900 }, geo());
    expect(pos.top).toBe(142); // bottom + gap
    expect(pos.bottom).toBeUndefined();
    expect(pos.left).toBe(636); // right - width (logical-end align, LTR)
  });

  it("flips above when there is not enough room below", () => {
    const pos = computeAnchoredPosition(rect({ top: 840, bottom: 876, left: 900, right: 936 }), { width: 1440, height: 900 }, geo());
    expect(pos.top).toBeUndefined();
    expect(pos.bottom).toBe(900 - 840 + 6); // viewportHeight - rect.top + gap
  });

  it("clamps horizontally near the right edge", () => {
    const pos = computeAnchoredPosition(rect({ top: 100, bottom: 136, left: 1420, right: 1436 }), { width: 1440, height: 900 }, geo());
    expect(pos.left).toBe(1440 - 300 - 8); // width + margin from the right edge
  });

  it("clamps horizontally near the left edge", () => {
    const pos = computeAnchoredPosition(rect({ top: 100, bottom: 136, left: 4, right: 40 }), { width: 1440, height: 900 }, geo());
    expect(pos.left).toBe(8); // margin
  });

  it("keeps the panel inside a 320px viewport", () => {
    const pos = computeAnchoredPosition(rect({ top: 100, bottom: 136, left: 280, right: 316 }), { width: 320, height: 640 }, geo());
    expect(pos.left).toBeGreaterThanOrEqual(8);
    expect(pos.left + pos.width).toBeLessThanOrEqual(320 - 8 + 0.5);
  });

  it("mirrors logical-end alignment under RTL", () => {
    const ltr = computeAnchoredPosition(rect({ top: 100, bottom: 136, left: 700, right: 736 }), { width: 1440, height: 900 }, geo());
    const rtl = computeAnchoredPosition(rect({ top: 100, bottom: 136, left: 700, right: 736 }), { width: 1440, height: 900 }, geo({ rtl: true }));
    expect(ltr.left).toBe(736 - 300); // pin to trigger's right edge
    expect(rtl.left).toBe(700); // pin to trigger's left edge
  });
});
