import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import "@/lib/i18n";
import { NotificationBell } from "./notification-bell";

const mocks = vi.hoisted(() => ({
  markAll: vi.fn(),
  markOne: vi.fn(),
}));

vi.mock("./notification-hooks", () => ({
  useUnreadCount: () => ({ data: { data: { count: 2 } } }),
  useNotifications: () => ({
    data: {
      data: [
        {
          id: "n1",
          type: "TICKET_ASSIGNED",
          title: "New ticket assigned",
          message: "You have been assigned ticket #T-1",
          ticketId: "T-1",
          readAt: null,
          createdAt: new Date().toISOString(),
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useMarkNotificationRead: () => ({ mutate: mocks.markOne, isPending: false, variables: undefined }),
  useMarkAllRead: () => ({ mutate: mocks.markAll, isPending: false }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("NotificationBell", () => {
  it("shows the unread count and opens the portalled list", () => {
    render(<MemoryRouter><NotificationBell /></MemoryRouter>);
    const trigger = screen.getByRole("button", { name: /2 unread/i });
    expect(trigger).toHaveTextContent("2");
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByText("New ticket assigned")).toBeInTheDocument();
  });

  it("marks an item read when it is opened", () => {
    render(<MemoryRouter><NotificationBell /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /2 unread/i }));
    fireEvent.click(screen.getByRole("option").querySelector("button")!);
    expect(mocks.markOne).toHaveBeenCalledWith("n1");
  });

  it("supports marking every notification read", () => {
    render(<MemoryRouter><NotificationBell /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /2 unread/i }));
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    expect(mocks.markAll).toHaveBeenCalledOnce();
  });
});
