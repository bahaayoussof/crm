import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  useTasks: vi.fn(),
  useTask: vi.fn(),
  useCreateTask: vi.fn(),
  useUpdateTask: vi.fn(),
  useDeleteTask: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  role: "ADMIN" as "ADMIN" | "MANAGER" | "AGENT",
  userId: "admin-1",
}));

vi.mock("@/features/auth/auth-state", () => ({
  useAuth: () => ({
    user: { id: mocks.userId, name: "User", email: "user@example.com", role: mocks.role, customer: null },
    isLoading: false,
    logout: vi.fn(),
  }),
}));
vi.mock("@/features/tickets/ticket-hooks", () => ({
  useAgents: () => ({ data: [{ id: "agent-2", name: "Mariam Hassan", email: "m@example.com" }] }),
}));
vi.mock("./task-hooks", () => ({
  useTasks: mocks.useTasks,
  useTask: mocks.useTask,
  useCreateTask: mocks.useCreateTask,
  useUpdateTask: mocks.useUpdateTask,
  useDeleteTask: mocks.useDeleteTask,
}));

import { TaskDetailPage } from "./task-detail-page";
import { TaskFormPage } from "./task-form-page";
import { TaskListPage } from "./task-list-page";
import type { Task } from "./task.types";

const PAST = "2026-08-20T10:00:00.000Z";
const FUTURE = "2999-01-01T10:00:00.000Z";

const baseTask: Task = {
  id: "task-1",
  title: "Follow up with customer",
  description: "Call them about the refund.",
  status: "OPEN",
  dueAt: FUTURE,
  remindedAt: null,
  ticketId: null,
  creatorId: "admin-1",
  assigneeId: "admin-1",
  createdAt: PAST,
  updatedAt: PAST,
  creator: { id: "admin-1", name: "Admin User" },
  assignee: { id: "admin-1", name: "Admin User" },
  ticket: null,
};

const listResult = (data: (typeof baseTask)[], overrides: Record<string, unknown> = {}) => ({
  isLoading: false,
  isError: false,
  data: { data, meta: { page: 1, limit: 20, total: data.length, totalPages: 1 } },
  refetch: vi.fn(),
  ...overrides,
});

function renderAt(path: string, route: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {route}
        <Route path="/dashboard" element={<span data-testid="dashboard" />} />
      </Routes>
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.search}</span>;
}

describe("tasks workspace", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
    mocks.role = "ADMIN";
    mocks.userId = "admin-1";
    mocks.useTasks.mockReturnValue(listResult([baseTask]));
    mocks.useTask.mockReturnValue({ isLoading: false, isError: false, data: baseTask });
    mocks.useCreateTask.mockReturnValue({ mutateAsync: mocks.create, isPending: false });
    mocks.useUpdateTask.mockReturnValue({ mutateAsync: mocks.update, isPending: false });
    mocks.useDeleteTask.mockReturnValue({ mutateAsync: mocks.remove, isPending: false });
  });

  it("renders loading, error-retry, and empty states", () => {
    mocks.useTasks.mockReturnValueOnce(listResult([], { isLoading: true, data: undefined }));
    const { unmount } = renderAt("/tasks", <Route path="/tasks" element={<TaskListPage />} />);
    expect(screen.getByLabelText("Loading…")).toBeInTheDocument();
    unmount();

    const refetch = vi.fn();
    mocks.useTasks.mockReturnValueOnce(listResult([], { isError: true, data: undefined, refetch }));
    const errored = renderAt("/tasks", <Route path="/tasks" element={<TaskListPage />} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
    errored.unmount();

    mocks.useTasks.mockReturnValueOnce(listResult([]));
    renderAt("/tasks", <Route path="/tasks" element={<TaskListPage />} />);
    expect(screen.getByText("No tasks yet.")).toBeInTheDocument();
  });

  it("shows an overdue badge for a past-due open task", () => {
    mocks.useTasks.mockReturnValue(listResult([{ ...baseTask, dueAt: PAST }]));
    renderAt("/tasks", <Route path="/tasks" element={<TaskListPage />} />);
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
  });

  it("renders only the task title in the task column without secondary ticket reference text", () => {
    mocks.useTasks.mockReturnValue(
      listResult([
        {
          ...baseTask,
          ticketId: "ticket-123",
          ticket: { id: "ticket-123", subject: "Server connection issue" },
        },
      ]),
    );
    renderAt("/tasks", <Route path="/tasks" element={<TaskListPage />} />);
    expect(screen.getAllByRole("link", { name: "Follow up with customer" }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Linked ticket/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Server connection issue/i)).not.toBeInTheDocument();
  });

  it("passes the status filter into the query and URL", async () => {
    renderAt(
      "/tasks",
      <Route
        path="/tasks"
        element={
          <>
            <TaskListPage />
            <LocationProbe />
          </>
        }
      />,
    );
    // status select is the first combobox in the toolbar
    const [statusSelect] = screen.getAllByRole("combobox");
    fireEvent.click(statusSelect);
    fireEvent.click(await screen.findByRole("option", { name: "Done" }));
    await waitFor(() => expect(screen.getByTestId("location").textContent).toContain("status=DONE"));
  });

  it("hides the assignee filter from an AGENT", () => {
    mocks.role = "AGENT";
    mocks.userId = "agent-1";
    renderAt("/tasks", <Route path="/tasks" element={<TaskListPage />} />);
    // only the status select remains
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("lets an assignee toggle status from the row action", async () => {
    mocks.role = "AGENT";
    mocks.userId = "agent-9";
    mocks.useTasks.mockReturnValue(
      listResult([{ ...baseTask, creatorId: "admin-1", assigneeId: "agent-9" }]),
    );
    renderAt("/tasks", <Route path="/tasks" element={<TaskListPage />} />);
    const actionsButtons = screen.getAllByRole("button", { name: "Actions" });
    fireEvent.click(actionsButtons[0]);
    const toggleItem = screen.getByRole("menuitem", { name: "Mark done" });
    fireEvent.click(toggleItem);
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ status: "DONE" }));
  });

  it("does not offer edit or delete to an unrelated agent view", () => {
    mocks.role = "AGENT";
    mocks.userId = "agent-9";
    mocks.useTasks.mockReturnValue(
      listResult([{ ...baseTask, creatorId: "admin-1", assigneeId: "agent-9" }]),
    );
    renderAt("/tasks", <Route path="/tasks" element={<TaskListPage />} />);
    const actionsButtons = screen.getAllByRole("button", { name: "Actions" });
    fireEvent.click(actionsButtons[0]);
    expect(screen.queryByRole("menuitem", { name: "Edit task" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete task" })).not.toBeInTheDocument();
  });

  const openDeleteConfirm = (index = 0) => {
    const actionsButtons = screen.getAllByRole("button", { name: "Actions" });
    fireEvent.click(actionsButtons[index]);
    const deleteItem = screen.getByRole("menuitem", { name: "Delete task" });
    fireEvent.click(deleteItem);
  };

  it("confirms before deleting from the row", async () => {
    renderAt("/tasks", <Route path="/tasks" element={<TaskListPage />} />);
    openDeleteConfirm(0);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm delete" }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("task-1"));
  });

  it("portals the delete confirmation onto document.body, outside the table wrapper", () => {
    renderAt("/tasks", <Route path="/tasks" element={<TaskListPage />} />);
    openDeleteConfirm(0);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-task-delete-confirm");
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveClass("fixed", "inset-0", "z-50", "flex", "items-center", "justify-center");
    expect(dialog.closest(".overflow-x-auto")).toBeNull();
    // exactly one dialog even though desktop + mobile rows are both mounted in JSDOM
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("navigates to /tasks/new on Create task click and does not open a modal", () => {
    renderAt(
      "/tasks",
      <>
        <Route path="/tasks" element={<TaskListPage />} />
        <Route path="/tasks/new" element={<h1>New Task Page</h1>} />
      </>,
    );
    const createButton = screen.getByRole("link", { name: "Create task" });
    expect(createButton).toHaveAttribute("href", "/tasks/new");
    fireEvent.click(createButton);
    expect(screen.getByRole("heading", { name: "New Task Page" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("requests limit=15 by default for pagination", () => {
    renderAt("/tasks", <Route path="/tasks" element={<TaskListPage />} />);
    expect(mocks.useTasks).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 15,
      }),
    );
  });

  it("moves the open confirmation when a different row trigger is used", () => {
    mocks.useTasks.mockReturnValue(
      listResult([baseTask, { ...baseTask, id: "task-2", title: "Second task" }]),
    );
    renderAt("/tasks", <Route path="/tasks" element={<TaskListPage />} />);
    // order: desktop rows first, then mobile cards — re-query after each render
    openDeleteConfirm(0);
    expect(screen.getByRole("dialog")).toHaveTextContent("Follow up with customer");
    openDeleteConfirm(1);
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveTextContent("Second task");
  });

  it("builds a create payload with only the fields provided", async () => {
    renderAt(
      "/tasks/new",
      <Route
        path="/tasks/new"
        element={
          <>
            <TaskFormPage />
            <LocationProbe />
          </>
        }
      />,
    );
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: "New task" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ title: "New task" }));
  });

  it("restricts an assignee-only editor to the status field", async () => {
    mocks.role = "AGENT";
    mocks.userId = "agent-9";
    mocks.useTask.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...baseTask, creatorId: "admin-1", assigneeId: "agent-9" },
    });
    renderAt("/tasks/task-1/edit", <Route path="/tasks/:id/edit" element={<TaskFormPage />} />);
    expect(screen.getByText("You are the assignee on this task. You can change its status only.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Title/)).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ status: "OPEN" }));
  });

  it("sends title, description, dueAt and assignee when an admin edits", async () => {
    mocks.useTask.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...baseTask, dueAt: null },
    });
    renderAt("/tasks/task-1/edit", <Route path="/tasks/:id/edit" element={<TaskFormPage />} />);
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Follow up with customer",
          description: null,
          dueAt: null,
          status: "OPEN",
        }),
      ),
    );
  });

  it("renders the detail page with metadata and an edit link", () => {
    renderAt("/tasks/task-1", <Route path="/tasks/:id" element={<TaskDetailPage />} />);
    expect(screen.getByRole("heading", { name: "Follow up with customer" })).toBeInTheDocument();
    expect(screen.getByText("Call them about the refund.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit task" })).toHaveAttribute("href", "/tasks/task-1/edit");
  });

  it("shows a not-found panel when the detail query 404s", () => {
    mocks.useTask.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      error: { isAxiosError: true, response: { status: 404 } },
    });
    renderAt("/tasks/task-x", <Route path="/tasks/:id" element={<TaskDetailPage />} />);
    expect(screen.getByText("Task not found.")).toBeInTheDocument();
  });
});
