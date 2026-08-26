import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  useQuickReplies: vi.fn(), useQuickReply: vi.fn(),
  useCreateQuickReply: vi.fn(), useUpdateQuickReply: vi.fn(), useDeleteQuickReply: vi.fn(),
  create: vi.fn(), update: vi.fn(), remove: vi.fn(),
  role: "ADMIN" as "ADMIN" | "MANAGER" | "AGENT",
}));

vi.mock("@/features/auth/auth-state", () => ({
  useAuth: () => ({ user: { id: "user-1", name: "User", email: "user@example.com", role: mocks.role, customer: null }, isLoading: false, logout: vi.fn() }),
}));

vi.mock("./quick-reply-hooks", () => ({
  useQuickReplies: mocks.useQuickReplies,
  useQuickReply: mocks.useQuickReply,
  useCreateQuickReply: mocks.useCreateQuickReply,
  useUpdateQuickReply: mocks.useUpdateQuickReply,
  useDeleteQuickReply: mocks.useDeleteQuickReply,
}));

import { AppShell } from "@/app/layouts/app-shell";
import { QuickReplyFormPage } from "./quick-reply-form-page";
import { QuickReplyListPage } from "./quick-reply-list-page";
import { QuickReplyPicker } from "./quick-reply-picker";

const longTitle = "How to reset an account when the recovery email keeps bouncing and the customer cannot reach the login screen at all";
const longUnbroken = "supercalifragilisticexpialidocious".repeat(6);
const greeting = {
  id: "qr-1", title: "Warm greeting", body: "Hello, thanks for reaching out to support.",
  createdAt: "2026-08-20T10:00:00.000Z", updatedAt: "2026-08-25T10:00:00.000Z",
  createdBy: { id: "admin-1", name: "Admin User", role: "ADMIN" as const },
};
const refund = { ...greeting, id: "qr-2", title: "Refund steps", body: "Line one.\nLine two." };
const longRow = { ...greeting, id: "qr-3", title: longTitle, body: `A normal but very long reply body that keeps going ${longUnbroken}` };

function renderAt(path: string, route: React.ReactNode) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>{route}</Routes></MemoryRouter>);
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.search}</span>;
}

const listResult = (data: typeof greeting[], overrides: Record<string, unknown> = {}) => ({
  isLoading: false, isError: false, data: { data, meta: { page: 1, limit: 20, total: data.length, totalPages: 1 } }, refetch: vi.fn(), ...overrides,
});

describe("quick replies management", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
    mocks.role = "ADMIN";
    mocks.useQuickReplies.mockReturnValue(listResult([greeting, refund]));
    mocks.useQuickReply.mockReturnValue({ isLoading: false, isError: false, data: greeting });
    mocks.useCreateQuickReply.mockReturnValue({ mutateAsync: mocks.create, isPending: false });
    mocks.useUpdateQuickReply.mockReturnValue({ mutateAsync: mocks.update, isPending: false });
    mocks.useDeleteQuickReply.mockReturnValue({ mutateAsync: mocks.remove, isPending: false });
  });

  it("shows structured loading, error-retry, and empty states", () => {
    mocks.useQuickReplies.mockReturnValueOnce(listResult([], { isLoading: true, data: undefined }));
    const loading = renderAt("/quick-replies", <Route path="/quick-replies" element={<QuickReplyListPage />} />);
    expect(screen.getByLabelText("Loading…")).toBeInTheDocument();
    loading.unmount();

    const refetch = vi.fn();
    mocks.useQuickReplies.mockReturnValueOnce(listResult([], { isError: true, data: undefined, refetch }));
    const errored = renderAt("/quick-replies", <Route path="/quick-replies" element={<QuickReplyListPage />} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
    errored.unmount();

    mocks.useQuickReplies.mockReturnValueOnce(listResult([]));
    renderAt("/quick-replies", <Route path="/quick-replies" element={<QuickReplyListPage />} />);
    expect(screen.getByText("No quick replies yet.")).toBeInTheDocument();
  });

  it("renders the desktop table with Title, Reply text, Updated, and Actions headers", () => {
    renderAt("/quick-replies", <Route path="/quick-replies" element={<QuickReplyListPage />} />);
    const table = screen.getByRole("table");
    for (const name of ["Title", "Reply text", "Updated", "Actions"]) {
      expect(within(table).getByRole("columnheader", { name })).toBeInTheDocument();
    }
    expect(table.querySelectorAll("colgroup col")).toHaveLength(4);
  });

  it("renders row search through the URL", async () => {
    renderAt("/quick-replies", <><Route path="/quick-replies" element={<><QuickReplyListPage /><LocationProbe /></>} /></>);
    expect(screen.getAllByText("Warm greeting").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByPlaceholderText("Search quick replies by title or text…"), { target: { value: "refund" } });
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("search=refund"));
  });

  it("groups Edit and Delete icon controls inside one Actions cell with accessible names", () => {
    renderAt("/quick-replies", <Route path="/quick-replies" element={<QuickReplyListPage />} />);
    const table = screen.getByRole("table");
    const firstRow = within(table).getAllByRole("row")[1];
    const cells = within(firstRow).getAllByRole("cell");
    const actionsCell = cells[cells.length - 1];
    expect(within(actionsCell).getByRole("link", { name: "Edit quick reply" })).toHaveAttribute("href", "/quick-replies/qr-1/edit");
    expect(within(actionsCell).getByRole("button", { name: "Delete quick reply" })).toBeInTheDocument();
    // Updated stays in its own earlier cell
    expect(within(cells[2]).getByText(/2026/)).toBeInTheDocument();
  });

  it("constrains long Title and Reply text while keeping the full values accessible", () => {
    mocks.useQuickReplies.mockReturnValue(listResult([longRow]));
    renderAt("/quick-replies", <Route path="/quick-replies" element={<QuickReplyListPage />} />);
    const titleLink = screen.getAllByRole("link", { name: longTitle })[0];
    expect(titleLink).toHaveAttribute("title", longTitle);
    expect(titleLink.className).toMatch(/line-clamp-2/);
    expect(titleLink.className).toMatch(/break-words/);

    const preview = screen.getAllByTitle(longRow.body)[0];
    expect(preview.className).toMatch(/line-clamp-2/);
    expect(preview.className).toMatch(/overflow-wrap:anywhere/);
  });

  it("requires confirmation to delete and restores focus on cancel", () => {
    renderAt("/quick-replies", <Route path="/quick-replies" element={<QuickReplyListPage />} />);
    const firstRow = within(screen.getByRole("table")).getAllByRole("row")[1];
    const deleteTrigger = within(firstRow).getByRole("button", { name: "Delete quick reply" });

    fireEvent.click(deleteTrigger);
    const dialog = within(firstRow).getByRole("dialog", { name: /Warm greeting/ });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(within(firstRow).queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteTrigger).toHaveFocus();
  });

  it("deletes after explicit confirmation", async () => {
    renderAt("/quick-replies", <Route path="/quick-replies" element={<QuickReplyListPage />} />);
    const firstRow = within(screen.getByRole("table")).getAllByRole("row")[1];
    fireEvent.click(within(firstRow).getByRole("button", { name: "Delete quick reply" }));
    fireEvent.click(within(firstRow).getByRole("button", { name: "Confirm delete" }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("qr-1"));
  });

  it("prevents a duplicate delete request while one is pending", () => {
    mocks.useDeleteQuickReply.mockReturnValue({ mutateAsync: mocks.remove, isPending: true });
    renderAt("/quick-replies", <Route path="/quick-replies" element={<QuickReplyListPage />} />);
    const firstRow = within(screen.getByRole("table")).getAllByRole("row")[1];
    fireEvent.click(within(firstRow).getByRole("button", { name: "Delete quick reply" }));
    expect(within(firstRow).getByRole("button", { name: "Deleting…" })).toBeDisabled();
  });

  it("keeps a failed deletion visible and retryable", async () => {
    mocks.remove.mockRejectedValueOnce(new Error("boom"));
    renderAt("/quick-replies", <Route path="/quick-replies" element={<QuickReplyListPage />} />);
    const firstRow = within(screen.getByRole("table")).getAllByRole("row")[1];
    fireEvent.click(within(firstRow).getByRole("button", { name: "Delete quick reply" }));
    fireEvent.click(within(firstRow).getByRole("button", { name: "Confirm delete" }));
    expect(await within(firstRow).findByRole("alert")).toHaveTextContent("Unable to delete the quick reply.");
    expect(within(firstRow).getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it("renders mobile cards alongside the desktop table", () => {
    renderAt("/quick-replies", <Route path="/quick-replies" element={<QuickReplyListPage />} />);
    // one Delete control per row in the table plus one per mobile card = 4 for 2 rows
    expect(screen.getAllByRole("button", { name: "Delete quick reply" })).toHaveLength(4);
    expect(screen.getAllByRole("link", { name: "Edit quick reply" })).toHaveLength(4);
    expect(screen.getAllByRole("link", { name: "Warm greeting" }).length).toBeGreaterThanOrEqual(2);
  });

  it("creates a quick reply with only title and body then returns to the list", async () => {
    mocks.create.mockResolvedValue(greeting);
    renderAt("/quick-replies/new", <><Route path="/quick-replies/new" element={<QuickReplyFormPage />} /><Route path="/quick-replies" element={<LocationProbe />} /></>);
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: "Warm greeting" } });
    fireEvent.change(screen.getByLabelText(/Reply text/), { target: { value: "Hello there." } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ title: "Warm greeting", body: "Hello there." }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/quick-replies"));
  });

  it("blocks submit with an invalid title", async () => {
    renderAt("/quick-replies/new", <Route path="/quick-replies/new" element={<QuickReplyFormPage />} />);
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText(/Reply text/), { target: { value: "Body" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Title must be at least 2 characters")).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("loads existing values when editing and sends the edit", async () => {
    mocks.update.mockResolvedValue(greeting);
    renderAt("/quick-replies/qr-1/edit", <><Route path="/quick-replies/:id/edit" element={<QuickReplyFormPage />} /><Route path="/quick-replies" element={<LocationProbe />} /></>);
    await waitFor(() => expect((screen.getByLabelText(/Title/) as HTMLInputElement).value).toBe("Warm greeting"));
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: "Warmer greeting" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ title: "Warmer greeting", body: greeting.body }));
  });

  it("keeps the same column ownership in Arabic RTL", async () => {
    await changeAppLanguage("ar");
    renderAt("/quick-replies", <Route path="/quick-replies" element={<QuickReplyListPage />} />);
    expect(screen.getByRole("heading", { name: "الردود السريعة" })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "العنوان" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "إجراءات" })).toBeInTheDocument();
    expect(table.querySelectorAll("colgroup col")).toHaveLength(4);
    const firstRow = within(table).getAllByRole("row")[1];
    expect(within(firstRow).getByRole("button", { name: "حذف رد سريع" })).toBeInTheDocument();
  });
});

describe("quick replies navigation visibility", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
    mocks.useQuickReplies.mockReturnValue(listResult([greeting]));
  });

  it.each(["ADMIN", "MANAGER"] as const)("shows the Quick Replies nav item to %s", (role) => {
    mocks.role = role;
    render(<MemoryRouter><AppShell audience="internal"><div /></AppShell></MemoryRouter>);
    expect(screen.getAllByRole("link", { name: "Quick Replies" }).length).toBeGreaterThan(0);
  });

  it("hides the Quick Replies nav item from AGENT", () => {
    mocks.role = "AGENT";
    render(<MemoryRouter><AppShell audience="internal"><div /></AppShell></MemoryRouter>);
    expect(screen.queryByRole("link", { name: "Quick Replies" })).not.toBeInTheDocument();
  });
});

describe("quick reply composer trigger and popover", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
  });

  const trigger = () => screen.getByRole("button", { name: "Insert quick reply" });
  const open = () => fireEvent.click(trigger());

  it("renders a collapsed trigger with no permanent search input", () => {
    mocks.useQuickReplies.mockReturnValue({ isLoading: false, isError: false, data: { data: [greeting], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } } });
    render(<QuickReplyPicker onSelect={vi.fn()} />);
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("opens a searchable listbox and marks the trigger expanded", () => {
    mocks.useQuickReplies.mockReturnValue({ isLoading: false, isError: false, data: { data: [greeting], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } } });
    const { container } = render(<QuickReplyPicker onSelect={vi.fn()} />);
    open();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("combobox", { name: "Quick reply" })).toBeInTheDocument();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    // popover content is portalled onto document.body, not inside the component subtree
    const panel = document.querySelector("[data-quick-reply-popover]") as HTMLElement;
    expect(panel.parentElement).toBe(document.body);
    expect(container).not.toContainElement(panel);
  });

  it("shows loading, empty, and non-blocking error states inside the popover", () => {
    mocks.useQuickReplies.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    const view = render(<QuickReplyPicker onSelect={vi.fn()} />);
    open();
    expect(screen.getByText("Searching quick replies…")).toBeInTheDocument();
    view.unmount();

    mocks.useQuickReplies.mockReturnValue({ isLoading: false, isError: false, data: { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } } });
    const empty = render(<QuickReplyPicker onSelect={vi.fn()} />);
    open();
    expect(screen.getByText("No quick replies available.")).toBeInTheDocument();
    empty.unmount();

    mocks.useQuickReplies.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    render(<QuickReplyPicker onSelect={vi.fn()} />);
    open();
    expect(screen.getByText("Unable to search quick replies. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Quick reply" })).not.toBeDisabled();
  });

  it("selects a result with the keyboard without submitting and closes on Escape", () => {
    mocks.useQuickReplies.mockReturnValue({ isLoading: false, isError: false, data: { data: [greeting, refund], meta: { page: 1, limit: 10, total: 2, totalPages: 1 } } });
    const onSelect = vi.fn();
    render(<QuickReplyPicker onSelect={onSelect} />);
    open();
    const combobox = screen.getByRole("combobox", { name: "Quick reply" });
    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    fireEvent.keyDown(combobox, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("Line one.\nLine two.");

    open();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Quick reply" }), { key: "Escape" });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });
});
