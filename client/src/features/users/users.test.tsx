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

vi.mock("@/features/auth/auth-state", () => ({
  useAuth: () => ({ user: mocks.currentUser, isLoading: false, logout: vi.fn() }),
}));
vi.mock("@/features/notifications/notification-bell", () => ({ NotificationBell: () => null }));

vi.mock("./user-hooks", () => ({
  useUsers: mocks.useUsers,
  useUser: mocks.useUser,
  useCreateUser: mocks.useCreateUser,
  useUpdateUser: mocks.useUpdateUser,
}));

import { computeAnchoredPosition, type AnchoredGeometryOptions } from "@/components/shared/use-anchored-popover";
import { AppShell } from "@/app/layouts/app-shell";
import { UserFormPage } from "./user-form-page";
import { UserListPage } from "./user-list-page";
import type { User } from "./user.types";

const admin: User = {
  id: "u-admin", name: "Aisha Admin", email: "aisha@example.com", role: "ADMIN",
  isActive: true, createdAt: "2026-08-01T10:00:00.000Z", updatedAt: "2026-08-10T10:00:00.000Z",
};
const admin2: User = { ...admin, id: "u-admin2", name: "Bilal Admin", email: "bilal@example.com" };
const agent: User = {
  ...admin, id: "u-agent", name: "Ghali Agent",
  email: "ghali.a.very.long.address.that.should.not.wrap@subdomain.example.com",
  role: "AGENT", isActive: false,
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

  it("renders semantic Name, Email, Role, Status, Created and Actions headers", () => {
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    const table = screen.getByRole("table");
    for (const name of ["Name", "Email", "Role", "Status", "Created", "Actions"]) {
      expect(within(table).getByRole("columnheader", { name })).toBeInTheDocument();
    }
    expect(table.querySelectorAll("colgroup col")).toHaveLength(6);
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

  it("groups Edit and the status action in one Actions cell with a non-shield icon", () => {
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    const table = screen.getByRole("table");
    const agentRow = within(table).getAllByRole("row").find((row) => within(row).queryByText("Ghali Agent"))!;
    const cells = within(agentRow).getAllByRole("cell");
    const actionsCell = cells[cells.length - 1];
    expect(within(actionsCell).getByRole("link", { name: "Edit user" })).toHaveAttribute("href", "/users/u-agent/edit");
    // agent is inactive -> Reactivate
    expect(within(actionsCell).getByRole("button", { name: "Reactivate user" })).toBeInTheDocument();
  });

  it("marks the current user's row with a You badge and hides self-deactivation", () => {
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    const table = screen.getByRole("table");
    const selfRow = within(table).getAllByRole("row").find((row) => within(row).queryByText("Aisha Admin"))!;
    expect(within(selfRow).getByText("You")).toBeInTheDocument();
    expect(within(selfRow).getByRole("button", { name: "Deactivate user" })).toBeDisabled();
  });

  const adminRowTrigger = (name: string) => {
    const table = screen.getByRole("table");
    const row = within(table).getAllByRole("row").find((r) => within(r).queryByText(name))!;
    return within(row).getByRole("button", { name: /(Deactivate|Reactivate) user/ });
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
    // trigger <-> panel association
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", dialog.id);
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

  it("performs no mutation on Cancel and restores focus to the trigger", async () => {
    renderAt("/users", <Route path="/users" element={<UserListPage />} />);
    const trigger = adminRowTrigger("Bilal Admin");
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
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
    expect(within(cards[0]).getByRole("link", { name: "Edit user" })).toBeInTheDocument();
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
    expect(table.querySelectorAll("colgroup col")).toHaveLength(6);
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
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ name: "New Person", email: "new@example.com", password: "password123", role: "MANAGER" }));
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

  it("edits another user: preloads role, submits it in the update payload", async () => {
    mocks.update.mockResolvedValue(admin2);
    renderAt("/users/u-admin2/edit", <><Route path="/users/:id/edit" element={<UserFormPage />} /><Route path="/users" element={<LocationProbe />} /></>);
    await waitFor(() => expect(screen.getByRole("combobox", { name: /^Role/ })).toHaveTextContent("Admin"));

    const roleTrigger = screen.getByRole("combobox", { name: /^Role/ });
    fireEvent.keyDown(roleTrigger, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("option", { name: "Manager" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Manager" }));

    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Bilal A." } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ name: "Bilal A.", email: "bilal@example.com", role: "MANAGER", isActive: true }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/users"));
  });

  it("makes Role read-only and Active disabled when editing your own account", async () => {
    mocks.useUser.mockReturnValue({ isLoading: false, isError: false, data: admin });
    renderAt("/users/u-admin/edit", <Route path="/users/:id/edit" element={<UserFormPage />} />);
    await waitFor(() => expect(screen.getByRole("combobox", { name: /^Role/ })).toBeDisabled());
    expect(screen.getByText("An administrator cannot change their own role.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Active account/)).toBeDisabled();
    expect(screen.getByText("An administrator cannot deactivate their own account.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Edit user/ })).toHaveTextContent("You");
  });

  it("surfaces a last-active-admin conflict from the server and preserves entered values", async () => {
    mocks.update.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 409, data: { error: { code: "LAST_ACTIVE_ADMIN_REQUIRED" } } },
    });
    renderAt("/users/u-admin2/edit", <Route path="/users/:id/edit" element={<UserFormPage />} />);
    await waitFor(() => expect(screen.getByRole("combobox", { name: /^Role/ })).toHaveTextContent("Admin"));

    const roleTrigger = screen.getByRole("combobox", { name: /^Role/ });
    fireEvent.keyDown(roleTrigger, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("option", { name: "Agent" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Agent" }));

    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Kept Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("At least one active administrator must remain.");
    expect((screen.getByLabelText(/Name/) as HTMLInputElement).value).toBe("Kept Name");
    expect(screen.getByRole("combobox", { name: /^Role/ })).toHaveTextContent("Agent");
  });

  it("prevents duplicate submission while the edit is pending", async () => {
    mocks.useUpdateUser.mockReturnValue({ mutateAsync: mocks.update, isPending: true });
    renderAt("/users/u-admin2/edit", <Route path="/users/:id/edit" element={<UserFormPage />} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled());
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
