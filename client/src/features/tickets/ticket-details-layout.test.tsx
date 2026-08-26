import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  useTicket: vi.fn(), useCategories: vi.fn(), useAgents: vi.fn(), useUpdateTicket: vi.fn(),
  useCreateTicketMessage: vi.fn(), useCreateTicketNote: vi.fn(), useAuth: vi.fn(),
  useTicketAttachments: vi.fn(),
}));

vi.mock("./ticket-hooks", () => ({
  useTicket: mocks.useTicket, useCategories: mocks.useCategories, useAgents: mocks.useAgents,
  useUpdateTicket: mocks.useUpdateTicket, useCreateTicketMessage: mocks.useCreateTicketMessage, useCreateTicketNote: mocks.useCreateTicketNote,
}));
vi.mock("@/features/auth/auth-state", () => ({ useAuth: mocks.useAuth }));
vi.mock("@/features/attachments/attachment-hooks", () => ({
  useTicketAttachments: mocks.useTicketAttachments,
  useUploadTicketAttachment: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
}));
vi.mock("@/features/quick-replies/quick-reply-picker", () => ({ QuickReplyPicker: () => null }));

import { TicketDetailPage } from "./ticket-detail-page";

const LONG_URL = `https://example.com/a/${"segment-".repeat(40)}resource?token=${"x".repeat(200)}`;
const LONG_UNBROKEN = "supercalifragilistic".repeat(30);
const MSG_MARKER = "MARKER_LONG_MESSAGE_BODY";
const LONG_MESSAGE = `${MSG_MARKER} with a link ${LONG_URL}\n${"line ".repeat(4).trim()}\n`.concat(Array.from({ length: 14 }, (_, i) => `paragraph ${i} of a genuinely long customer message`).join("\n"));
const LONG_FILENAME = `evidence-${"very-long-section-".repeat(12)}final.pdf`;

/** The message-body <p> that holds the long message (avoids ambiguous full-text matches). */
const longBody = () => screen.getByText(new RegExp(MSG_MARKER), { selector: "p" });
const longBubble = () => longBody().closest("article") as HTMLElement;

const baseTicket = {
  id: "ticket-98765432",
  subject: `Payment failed for ${LONG_UNBROKEN}`,
  description: `Steps to reproduce with a very long url ${LONG_URL} and ${LONG_UNBROKEN}`,
  status: "IN_PROGRESS", priority: "HIGH", channel: "WEB",
  firstResponseDueAt: null, firstRespondedAt: null, resolutionDueAt: null, resolvedAt: null, closedAt: null,
  slaState: "NOT_CONFIGURED" as const, effectiveSlaDueAt: null, effectiveSlaTarget: null,
  createdAt: "2026-08-25T08:00:00.000Z", updatedAt: "2026-08-25T08:30:00.000Z",
  customer: { id: "customer-1", name: "Ahmed Mohamed", email: `ahmed.${"x".repeat(60)}@really-long-domain-name-example.com`, phone: "+201000000000", createdAt: "2026-08-20T08:00:00.000Z" },
  assignedAgent: { id: "agent-1", name: "Mariam Hassan", email: "mariam@example.com" },
  category: { id: "category-1", name: "Billing" }, department: null, branch: null,
  history: [{ id: "history-1", action: "STATUS_CHANGED", oldValue: `OLD-${LONG_UNBROKEN}`, newValue: `NEW-${LONG_UNBROKEN}`, createdAt: "2026-08-25T08:30:00.000Z", actor: { id: "admin-1", name: "Admin", role: "ADMIN" } }],
  conversation: [
    { id: "message-short", kind: "PUBLIC_MESSAGE", body: "Thanks, that is resolved now.", createdAt: "2026-08-25T09:00:00.000Z", author: { id: "customer-1", name: "Ahmed Mohamed", role: "CUSTOMER" } },
    { id: "message-long", kind: "PUBLIC_MESSAGE", body: LONG_MESSAGE, createdAt: "2026-08-25T09:05:00.000Z", author: { id: "agent-1", name: "Mariam Hassan", role: "AGENT" } },
    { id: "note-1", kind: "INTERNAL_NOTE", body: "Private investigation notes.", createdAt: "2026-08-25T09:10:00.000Z", author: { id: "admin-1", name: "Admin", role: "ADMIN" } },
  ],
};

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={[`/tickets/${baseTicket.id}`]}>
      <Routes><Route path="/tickets/:id" element={<TicketDetailPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe("Ticket Details long-content containment", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en"); vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({ user: { id: "admin-1", name: "Admin", email: "admin@example.com", role: "ADMIN" } });
    mocks.useTicket.mockReturnValue({ isLoading: false, isError: false, data: baseTicket });
    mocks.useCategories.mockReturnValue({ data: [{ id: "category-1", name: "Billing" }] });
    mocks.useAgents.mockReturnValue({ data: [{ id: "agent-1", name: "Mariam Hassan", email: "mariam@example.com" }] });
    mocks.useUpdateTicket.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.useCreateTicketMessage.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.useCreateTicketNote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.useTicketAttachments.mockReturnValue({
      data: [{ id: "att-1", fileName: LONG_FILENAME, mimeType: "application/pdf", createdAt: "2026-08-25T09:00:00.000Z", messageId: null }],
      isLoading: false, isError: false, refetch: vi.fn(),
    });
  });

  it("gives the two Ticket Details columns min-w-0 so intrinsic content cannot widen the grid", () => {
    const { container } = renderDetail();
    const grid = container.querySelector(".grid.gap-6") as HTMLElement;
    expect(grid).toBeTruthy();
    const columns = Array.from(grid.children) as HTMLElement[];
    expect(columns).toHaveLength(2);
    for (const column of columns) expect(column.className).toMatch(/min-w-0/);
  });

  it("wraps long unbroken content in the message body, description, subject, history, and customer email", () => {
    renderDetail();
    expect(longBody().className).toMatch(/\[overflow-wrap:anywhere\]/);
    expect(longBody().className).toMatch(/whitespace-pre-wrap/); // newlines preserved

    expect(screen.getByRole("heading", { level: 1 }).className).toMatch(/\[overflow-wrap:anywhere\]/);
    expect(screen.getByText(baseTicket.description, { selector: "p" }).className).toMatch(/\[overflow-wrap:anywhere\]/);
    expect(screen.getByText(/NEW-/, { selector: "p" }).className).toMatch(/\[overflow-wrap:anywhere\]/);
    const email = screen.getByText(baseTicket.customer.email, { selector: "bdi" });
    expect(email.closest("p")?.className).toMatch(/\[overflow-wrap:anywhere\]/);
  });

  it("keeps a long filename inside its row: truncated with the full value in title, actions still reachable", () => {
    renderDetail();
    const name = screen.getByTitle(LONG_FILENAME);
    expect(name.className).toMatch(/truncate/);
    expect(name.closest("li")).toContainElement(screen.getByRole("button", { name: "Download attachment" }));
  });

  it("keeps history timestamps on their own non-wrapping line, separate from the description", () => {
    const { container } = renderDetail();
    const historyHeading = screen.getByRole("heading", { name: "History" });
    const historySection = historyHeading.closest("section") as HTMLElement;
    const time = historySection.querySelector("li time") as HTMLElement;
    expect(time).toBeTruthy();
    expect(time.className).toMatch(/whitespace-nowrap/);
    expect(time.className).toMatch(/shrink-0/);
    // the row's action title and its timestamp sit in a flex header, not inside the description paragraph
    const row = time.closest("li") as HTMLElement;
    const description = within(row).getByText(/NEW-/);
    expect(description).not.toContainElement(time);
    expect(container.querySelector("time")).toBeTruthy();
  });
});

describe("Ticket Details conversation bubbles and long-message disclosure", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en"); vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({ user: { id: "admin-1", name: "Admin", email: "admin@example.com", role: "ADMIN" } });
    mocks.useTicket.mockReturnValue({ isLoading: false, isError: false, data: baseTicket });
    mocks.useCategories.mockReturnValue({ data: [] });
    mocks.useAgents.mockReturnValue({ data: [] });
    mocks.useUpdateTicket.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.useCreateTicketMessage.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.useCreateTicketNote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.useTicketAttachments.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
  });

  it("renders messages as width-bounded bubbles with logical side alignment", () => {
    renderDetail();
    const shortBubble = screen.getByText("Thanks, that is resolved now.", { selector: "p" }).closest("article") as HTMLElement;
    const staffBubble = longBubble();
    for (const bubble of [shortBubble, staffBubble]) {
      expect(bubble.className).toMatch(/max-w-\[min\(85%,46rem\)\]/);
      expect(bubble.className).toMatch(/min-w-0/);
    }
    expect((shortBubble.closest("li") as HTMLElement).className).toMatch(/justify-start/); // customer
    expect((staffBubble.closest("li") as HTMLElement).className).toMatch(/justify-end/); // staff public reply
  });

  it("does not offer Show more for a short message", () => {
    renderDetail();
    const shortBubble = screen.getByText("Thanks, that is resolved now.", { selector: "p" }).closest("article") as HTMLElement;
    expect(within(shortBubble).queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
  });

  it("progressively discloses a genuinely long message without discarding content", () => {
    renderDetail();
    const staffBubble = longBubble();
    const toggle = within(staffBubble).getByRole("button", { name: "Show more" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // full text is already in the DOM (line-clamped, not truncated)
    expect(longBody()).toBeInTheDocument();
    expect(longBody().className).toMatch(/line-clamp-\[10\]/);

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(longBody().className).not.toMatch(/line-clamp/);
    expect(within(staffBubble).getByRole("button", { name: "Show less" })).toBeInTheDocument();

    fireEvent.click(within(staffBubble).getByRole("button", { name: "Show less" }));
    expect(within(staffBubble).getByRole("button", { name: "Show more" })).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps Internal Notes explicitly distinguishable with a non-color label", () => {
    renderDetail();
    const noteBubble = screen.getByText("Private investigation notes.", { selector: "p" }).closest("article") as HTMLElement;
    expect(within(noteBubble).getByText("Internal note")).toBeInTheDocument();
    expect(within(noteBubble).queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
    // the public reply keeps its own explicit label
    const staffBubble = longBubble();
    expect(within(staffBubble).getByText("Visible to customer")).toBeInTheDocument();
  });

  it("localizes Show more / Show less in Arabic and keeps RTL", async () => {
    await changeAppLanguage("ar");
    renderDetail();
    const staffBubble = longBubble();
    fireEvent.click(within(staffBubble).getByRole("button", { name: "عرض المزيد" }));
    expect(within(staffBubble).getByRole("button", { name: "عرض أقل" })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
  });
});

describe("Ticket Details responsive action sizing", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en"); vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({ user: { id: "admin-1", name: "Admin", email: "admin@example.com", role: "ADMIN" } });
    mocks.useTicket.mockReturnValue({ isLoading: false, isError: false, data: baseTicket });
    mocks.useCategories.mockReturnValue({ data: [{ id: "category-1", name: "Billing" }] });
    mocks.useAgents.mockReturnValue({ data: [{ id: "agent-1", name: "Mariam Hassan", email: "mariam@example.com" }] });
    mocks.useUpdateTicket.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.useCreateTicketMessage.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.useCreateTicketNote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.useTicketAttachments.mockReturnValue({
      data: [{ id: "att-1", fileName: "note.pdf", mimeType: "application/pdf", createdAt: "2026-08-25T09:00:00.000Z", messageId: null }],
      isLoading: false, isError: false, refetch: vi.fn(),
    });
  });

  it("makes Save changes, Upload attachment, and Send reply content-sized on desktop (button-primary → full width only on mobile)", () => {
    renderDetail();
    for (const name of ["Save changes", "Upload attachment", "Send reply"]) {
      const button = screen.getByRole("button", { name });
      expect(button.className).toMatch(/\bbutton-primary\b/); // mobile: full width via component class
      expect(button.className).toMatch(/sm:w-auto/); // desktop: content-sized
    }
  });

  it("keeps the Send reply / Insert quick reply composer footer as a start/end row that stacks on mobile", () => {
    renderDetail();
    const send = screen.getByRole("button", { name: "Send reply" });
    const footer = send.parentElement as HTMLElement;
    expect(footer.className).toMatch(/flex-col/);
    expect(footer.className).toMatch(/sm:flex-row/);
    expect(send.className).toMatch(/sm:ms-auto/);
  });

  it("lays Manage Ticket fields out in a responsive two-column grid that collapses in the narrow sidebar", () => {
    renderDetail();
    const status = screen.getByLabelText("Status");
    const grid = status.closest("div.grid") as HTMLElement;
    expect(grid.className).toMatch(/sm:grid-cols-2/);
    expect(grid.className).toMatch(/xl:grid-cols-1/);
    expect(within(grid).getByLabelText("Priority")).toBeInTheDocument();
    expect(within(grid).getByLabelText("Category")).toBeInTheDocument();
    expect(within(grid).getByLabelText("Assigned agent")).toBeInTheDocument();
  });

  it("keeps attachment row actions grouped and reachable next to a filename", () => {
    renderDetail();
    const row = screen.getByTitle("note.pdf").closest("li") as HTMLElement;
    expect(within(row).getByRole("button", { name: "Preview attachment" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Download attachment" })).toBeInTheDocument();
  });

  it("keeps Arabic labels and RTL for the action controls", async () => {
    await changeAppLanguage("ar");
    renderDetail();
    expect(screen.getByRole("button", { name: "حفظ التغييرات" }).className).toMatch(/sm:w-auto/);
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
  });
});
