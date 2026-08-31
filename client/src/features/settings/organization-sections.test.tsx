import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";

const hooks = vi.hoisted(() => ({
  adminDepartments: { isLoading: false, isError: false, data: undefined as unknown, refetch: vi.fn() },
  adminBranches: { isLoading: false, isError: false, data: undefined as unknown, refetch: vi.fn() },
  branchOptions: { data: [] as unknown[] },
  createDept: vi.fn(),
  updateDept: vi.fn(),
  deleteDept: vi.fn(),
  createBranch: vi.fn(),
  updateBranch: vi.fn(),
  deleteBranch: vi.fn(),
}));

vi.mock("@/features/organization/organization-hooks", () => ({
  useAdminDepartments: () => hooks.adminDepartments,
  useAdminBranches: () => hooks.adminBranches,
  useBranchOptions: () => hooks.branchOptions,
  useDepartmentOptions: () => ({ data: [] }),
  useCreateDepartment: () => ({ isPending: false, mutateAsync: hooks.createDept }),
  useUpdateDepartment: () => ({ isPending: false, mutateAsync: hooks.updateDept }),
  useDeleteDepartment: () => ({ isPending: false, mutateAsync: hooks.deleteDept }),
  useCreateBranch: () => ({ isPending: false, mutateAsync: hooks.createBranch }),
  useUpdateBranch: () => ({ isPending: false, mutateAsync: hooks.updateBranch }),
  useDeleteBranch: () => ({ isPending: false, mutateAsync: hooks.deleteBranch }),
}));

import { BranchesSection, DepartmentsSection } from "./organization-sections";

const listData = (rows: unknown[]) => ({
  data: rows,
  meta: { page: 1, limit: 15, total: rows.length, totalPages: 1 },
});

const department = {
  id: "d1",
  name: "Support",
  description: "Front line",
  isActive: true,
  branchId: null,
  branch: null,
  userCount: 4,
  ticketCount: 2,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
};

const branch = {
  id: "b1",
  name: "Head Office",
  code: "HQ",
  address: "1 Main St",
  isActive: true,
  departmentCount: 3,
  userCount: 6,
  ticketCount: 1,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
};

const renderDepartments = () => render(<MemoryRouter><DepartmentsSection /></MemoryRouter>);
const renderBranches = () => render(<MemoryRouter><BranchesSection /></MemoryRouter>);

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  hooks.adminDepartments = { isLoading: false, isError: false, data: listData([department]), refetch: vi.fn() };
  hooks.adminBranches = { isLoading: false, isError: false, data: listData([branch]), refetch: vi.fn() };
  hooks.branchOptions = { data: [{ id: "b1", name: "Head Office", code: "HQ" }] };
});

describe("DepartmentsSection", () => {
  it("renders a department row with its user count and status", () => {
    renderDepartments();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Support")).toBeInTheDocument();
    expect(within(table).getByText("4")).toBeInTheDocument();
    expect(within(table).getByText("settings.active")).toBeInTheDocument();
  });

  it("shows a localized empty state when there are no departments", () => {
    hooks.adminDepartments = { isLoading: false, isError: false, data: listData([]), refetch: vi.fn() };
    renderDepartments();
    expect(screen.getByText("settings.departments.empty")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows a no-results state while keeping the search field visible", async () => {
    hooks.adminDepartments = { isLoading: false, isError: false, data: listData([]), refetch: vi.fn() };
    renderDepartments();
    fireEvent.change(screen.getByPlaceholderText("settings.departments.search"), { target: { value: "zzz" } });
    expect(await screen.findByText("settings.departments.noResults")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("settings.departments.search")).toBeInTheDocument();
  });

  it("opens a blank create dialog and validates the name", async () => {
    renderDepartments();
    fireEvent.click(screen.getByRole("button", { name: "settings.departments.create" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "common.save" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("settings.departments.validation");
    expect(hooks.createDept).not.toHaveBeenCalled();
  });

  it("surfaces the delete conflict message on a 409 CONFLICT", async () => {
    const conflict = new axios.AxiosError("conflict");
    conflict.response = { data: { error: { code: "DEPARTMENT_IN_USE" } } } as never;
    hooks.deleteDept.mockRejectedValueOnce(conflict);
    renderDepartments();
    fireEvent.click(screen.getAllByRole("button", { name: "settings.actions" })[0]);
    fireEvent.click(await screen.findByText("settings.delete"));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "settings.delete" }));
    expect(await within(dialog).findByText("settings.departments.deleteConflict")).toBeInTheDocument();
  });
});

describe("BranchesSection", () => {
  it("renders a branch row with code and address", () => {
    renderBranches();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Head Office")).toBeInTheDocument();
    expect(within(table).getByText("HQ")).toBeInTheDocument();
    expect(within(table).getByText("1 Main St")).toBeInTheDocument();
  });

  it("shows a localized empty state", () => {
    hooks.adminBranches = { isLoading: false, isError: false, data: listData([]), refetch: vi.fn() };
    renderBranches();
    expect(screen.getByText("settings.branches.empty")).toBeInTheDocument();
  });

  it("submits a trimmed create payload", async () => {
    hooks.createBranch.mockResolvedValueOnce(branch);
    renderBranches();
    fireEvent.click(screen.getByRole("button", { name: "settings.branches.create" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "settings.branches.name" }), {
      target: { value: "  Downtown  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "common.save" }));
    await waitFor(() =>
      expect(hooks.createBranch).toHaveBeenCalledWith({ name: "Downtown", code: null, address: "" }),
    );
  });
});
