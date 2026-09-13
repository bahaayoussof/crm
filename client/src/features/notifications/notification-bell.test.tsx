import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "@/lib/i18n";
import { NotificationBell } from "./notification-bell";

const mocks = vi.hoisted(() => ({
  markAll: vi.fn(),
  markOne: vi.fn(),
}));

vi.mock("./notification-hooks", () => ({
  useUnreadCount: () => ({ data: { data: { count: 3 } } }),
  useNotifications: () => ({
    data: {
      data: [
        {
          id: "n1",
          type: "TICKET_ASSIGNED",
          title: "New ticket assigned",
          message: "You have been assigned ticket #T-1",
          ticketId: "T-1",
          taskId: null,
          readAt: null,
          createdAt: new Date().toISOString(),
        },
        {
          id: "n2",
          type: "TASK_ASSIGNED",
          title: "Task assigned to you",
          message: "You have been assigned a task: Follow up",
          ticketId: null,
          taskId: "task-1",
          readAt: null,
          createdAt: new Date().toISOString(),
        },
        {
          id: "n3",
          type: "SYSTEM_ANNOUNCEMENT",
          title: "System notice",
          message: "No specific destination",
          ticketId: null,
          taskId: null,
          readAt: null,
          createdAt: new Date().toISOString(),
        },
        {
          id: "n4",
          type: "TICKET_ASSIGNED",
          title: "Already read ticket",
          message: "You have been assigned ticket #T-2",
          ticketId: "T-2",
          taskId: null,
          readAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
      meta: { page: 1, limit: 20, total: 4, totalPages: 1 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useMarkNotificationRead: () => ({ mutate: mocks.markOne, isPending: false, variables: undefined }),
  useMarkAllRead: () => ({ mutate: mocks.markAll, isPending: false }),
}));

function renderBell() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<NotificationBell />} />
        <Route path="/tickets/:id" element={<div>Ticket detail stub</div>} />
        <Route path="/tasks/:id" element={<div>Task detail stub</div>} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("NotificationBell", () => {
  it("shows the unread count and opens the portalled list", () => {
    renderBell();
    const trigger = screen.getByRole("button", { name: /3 unread/i });
    expect(trigger).toHaveTextContent("3");
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByText("New ticket assigned")).toBeInTheDocument();
  });

  it("marks a Ticket notification read and navigates to Ticket Details when clicked", () => {
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: /3 unread/i }));
    const rows = screen.getAllByRole("option");
    fireEvent.click(rows[0]!.querySelector("button")!);
    expect(mocks.markOne).toHaveBeenCalledWith("n1");
    expect(screen.getByText("Ticket detail stub")).toBeInTheDocument();
  });

  it("marks a Task notification read and navigates to the Task (dead click regression — NOTIF-GAP-1)", () => {
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: /3 unread/i }));
    const rows = screen.getAllByRole("option");
    // n2 is the task notification — its first (and only actionable) button navigates.
    fireEvent.click(rows[1]!.querySelector("button")!);
    expect(mocks.markOne).toHaveBeenCalledWith("n2");
    expect(screen.getByText("Task detail stub")).toBeInTheDocument();
  });

  it("renders a notification with neither ticketId nor taskId as non-interactive (no navigation)", () => {
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: /3 unread/i }));
    const rows = screen.getAllByRole("option");
    const n3Row = rows[2]!;
    expect(screen.getByText("System notice")).toBeInTheDocument();
    // No navigate button inside — only a possible mark-as-read button (unread).
    const buttons = n3Row.querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute("aria-label", "Mark as read");
  });

  it("marks a notification read via the explicit per-row control without navigating", () => {
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: /3 unread/i }));
    const rows = screen.getAllByRole("option");
    const markReadButton = screen.getAllByRole("button", { name: "Mark as read" })[0]!;
    expect(rows[0]!.contains(markReadButton)).toBe(true);
    fireEvent.click(markReadButton);
    expect(mocks.markOne).toHaveBeenCalledWith("n1");
    // Dropdown stays open — no navigation occurred.
    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.queryByText("Ticket detail stub")).not.toBeInTheDocument();
  });

  it("re-clicking an already-read Ticket notification still navigates without re-marking read", () => {
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: /3 unread/i }));
    const rows = screen.getAllByRole("option");
    fireEvent.click(rows[3]!.querySelector("button")!);
    expect(mocks.markOne).not.toHaveBeenCalled();
    expect(screen.getByText("Ticket detail stub")).toBeInTheDocument();
  });

  it("does not mark anything read merely by opening the dropdown", () => {
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: /3 unread/i }));
    expect(mocks.markOne).not.toHaveBeenCalled();
    expect(mocks.markAll).not.toHaveBeenCalled();
  });

  it("supports marking every notification read", () => {
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: /3 unread/i }));
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    expect(mocks.markAll).toHaveBeenCalledOnce();
  });
});
