import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
vi.mock("@/features/collaboration/mention-textarea", () => ({
  MentionTextarea: (props: { id: string; value: string; disabled?: boolean; ariaDescribedBy?: string; onChange: (v: string) => void }) => (
    <textarea id={props.id} value={props.value} disabled={props.disabled} aria-describedby={props.ariaDescribedBy} onChange={(event) => props.onChange(event.target.value)} />
  ),
}));
vi.mock("@/features/collaboration/watch-toggle", () => ({ WatchToggle: () => null }));
// Real behavior is covered in features/ai-assistant/ai-assistant.test.tsx; here we
// only need a stand-in that proves the panel is placed in the internal sidebar.
vi.mock("@/features/ai-assistant/ai-assistant-panel", () => ({
  AiAssistantPanel: () => (
    <section>
      <h2>AI Assistant</h2>
    </section>
  ),
}));

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

function baseMocks() {
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
}

describe("Ticket Details workspace layout & long-content containment", () => {
  afterEach(cleanup);
  beforeEach(async () => { await changeAppLanguage("en"); vi.clearAllMocks(); baseMocks(); });

  it("lays out a two-column workspace with both columns min-w-0", () => {
    const { container } = renderDetail();
    const grid = container.querySelector("div.grid") as HTMLElement;
    expect(grid).toBeTruthy();
    const columns = Array.from(grid.children) as HTMLElement[];
    expect(columns).toHaveLength(2);
    for (const column of columns) expect(column.className).toMatch(/min-w-0/);
  });

  it("shows the internal-only AI Assistant section in the sidebar", () => {
    renderDetail();
    expect(screen.getByRole("heading", { name: "AI Assistant" })).toBeInTheDocument();
  });

  it("bounds the conversation into an internally scrollable message region (desktop only)", () => {
    renderDetail();
    // the message list lives inside a region that scrolls internally on lg, natural on mobile
    const list = screen.getByRole("list", { name: "Ticket conversation timeline" });
    const scroller = list.parentElement as HTMLElement;
    expect(scroller.className).toMatch(/overflow-y-auto/);
    expect(scroller.className).toMatch(/lg:min-h-0/);
    expect(scroller.className).toMatch(/lg:flex-1/);
    expect(scroller.className).not.toMatch(/max-h-\[/); // no mobile height cap — natural flow
    // all three fixture messages render inside that same region
    for (const text of ["Thanks, that is resolved now.", new RegExp(MSG_MARKER), "Private investigation notes."]) {
      expect(scroller).toContainElement(screen.getByText(text, { selector: "p" }));
    }
    // the section is a bounded flex column on lg and the composer stays queryable
    expect(list.closest("section")!.className).toMatch(/lg:flex-col/);
    expect(screen.getByRole("button", { name: "Send reply" })).toBeInTheDocument();
  });

  it("gives the desktop conversation column most of the viewport height", () => {
    const { container } = renderDetail();
    const leftColumn = (container.querySelector("div.grid") as HTMLElement).firstElementChild as HTMLElement;
    expect(leftColumn.className).toMatch(/lg:h-\[calc\(100dvh-2rem\)\]/);
    expect(leftColumn.className).toMatch(/lg:overflow-hidden/);
  });

  it("bounds the public reply textarea so a long draft cannot swallow the message area", () => {
    const { container } = renderDetail();
    const reply = container.querySelector("#conversation-reply") as HTMLTextAreaElement;
    expect(reply).toBeTruthy();
    // comfortable floor, hard ceiling, then the textarea scrolls its own content
    expect(reply.className).toMatch(/min-h-28/);
    expect(reply.className).toMatch(/max-h-56/);
    expect(reply.className).toMatch(/overflow-y-auto/);
    expect(reply.className).toMatch(/\[field-sizing:content\]/);
  });

  it("gives consecutive messages breathing room", () => {
    renderDetail();
    const list = screen.getByRole("list", { name: "Ticket conversation timeline" });
    expect(list.className).toMatch(/space-y-5/);
  });

  it("wraps long unbroken content in the message body, subject, description, activity, and customer email", () => {
    renderDetail();
    expect(longBody().className).toMatch(/\[overflow-wrap:anywhere\]/);
    expect(longBody().className).toMatch(/whitespace-pre-wrap/);

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

  it("keeps activity timestamps on their own non-wrapping line, separate from the actor/change line", () => {
    renderDetail();
    const activitySection = screen.getByRole("heading", { name: "Activity" }).closest("section") as HTMLElement;
    const time = activitySection.querySelector("li time") as HTMLElement;
    expect(time).toBeTruthy();
    expect(time.className).toMatch(/whitespace-nowrap/);
    expect(time.className).toMatch(/shrink-0/);
    const row = time.closest("li") as HTMLElement;
    const change = within(row).getByText(/NEW-/);
    expect(change).not.toContainElement(time);
  });
});

describe("Ticket Details conversation bubbles and long-message disclosure", () => {
  afterEach(cleanup);
  beforeEach(async () => { await changeAppLanguage("en"); vi.clearAllMocks(); baseMocks(); });

  it("renders messages as width-bounded bubbles with logical side alignment", () => {
    renderDetail();
    const shortBubble = screen.getByText("Thanks, that is resolved now.", { selector: "p" }).closest("article") as HTMLElement;
    const staffBubble = longBubble();
    for (const bubble of [shortBubble, staffBubble]) {
      expect(bubble.className).toMatch(/max-w-\[min\(85%,46rem\)\]/);
      expect(bubble.className).toMatch(/min-w-0/);
    }
    expect((shortBubble.closest("li") as HTMLElement).className).toMatch(/justify-start/);
    expect((staffBubble.closest("li") as HTMLElement).className).toMatch(/justify-end/);
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

describe("Ticket Details sidebar controls & responsive sizing", () => {
  afterEach(cleanup);
  beforeEach(async () => { await changeAppLanguage("en"); vi.clearAllMocks(); baseMocks(); });

  it("exposes the ticket properties as reusable select controls in the sidebar", () => {
    renderDetail();
    for (const name of ["Status", "Priority", "Category", "Assigned agent"]) {
      expect(screen.getByRole("combobox", { name })).toBeInTheDocument();
    }
  });

  it("hides Save changes until a property changes, then shows it content-sized on desktop", async () => {
    renderDetail();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();

    const statusTrigger = screen.getByRole("combobox", { name: "Status" });
    fireEvent.keyDown(statusTrigger, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("option", { name: "Resolved" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Resolved" }));

    const save = await screen.findByRole("button", { name: "Save changes" });
    expect(save.className).toMatch(/\bbutton-primary\b/);
    expect(save.className).toMatch(/sm:w-auto/);
  });

  it("keeps the whole attachment workflow in the main column and out of the sidebar", () => {
    renderDetail();
    // conversation column owns the Attach file trigger, next to the composer
    const attach = screen.getByRole("button", { name: "Attach file" });
    const send = screen.getByRole("button", { name: "Send reply" });
    expect(attach.closest("section")).toBe(send.closest("section"));
    // sidebar is a pure context panel — no attachments, no file input, no attachment actions
    const sidebar = screen.getByRole("heading", { name: "Ticket details" }).closest("aside") as HTMLElement;
    expect(sidebar.querySelector('input[type="file"]')).toBeNull();
    expect(within(sidebar).queryByRole("heading", { name: "Attachments" })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole("button", { name: "Add attachment" })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole("button", { name: "Download attachment" })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole("button", { name: "Preview attachment" })).not.toBeInTheDocument();
    // the ticket-level Attachments list renders below the composer in the main column
    const list = screen.getByRole("heading", { name: "Attachments" });
    expect(list.closest("aside")).toBeNull();
    const listSection = list.closest("section") as HTMLElement;
    const filename = screen.getByTitle(LONG_FILENAME);
    expect(listSection).toContainElement(filename);
    expect(filename.className).toMatch(/truncate/);
    expect(within(filename.closest("li") as HTMLElement).getByRole("button", { name: "Download attachment" })).toBeInTheDocument();
    expect(within(filename.closest("li") as HTMLElement).getByRole("button", { name: "Preview attachment" })).toBeInTheDocument();
  });

  it("reveals the uploader from Attach file and collapses it on Cancel", async () => {
    renderDetail();
    expect(screen.queryByRole("button", { name: "Upload" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Attach file" }));
    const choose = await screen.findByText("Choose file");
    const upload = screen.getByRole("button", { name: "Upload" });
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(choose).toBeInTheDocument();
    expect(upload.parentElement).toBe(cancel.parentElement); // Upload + Cancel one row
    fireEvent.click(cancel);
    expect(screen.queryByRole("button", { name: "Upload" })).not.toBeInTheDocument();
  });

  it("shows a themed selected-file card with a contained filename, metadata, and a Remove action", async () => {
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "Attach file" }));
    const input = (await screen.findByLabelText("Select file")) as HTMLInputElement;
    const longName = `azm_squad_customer_support_crm_super_long_filename_v12_final.pdf`;
    fireEvent.change(input, { target: { files: [new File(["x".repeat(40 * 1024)], longName, { type: "application/pdf" })] } });
    const name = await screen.findByTitle(longName);
    expect(name.className).toMatch(/truncate/);
    expect(screen.getByText(/PDF ·/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove file" }));
    expect(screen.queryByTitle(longName)).not.toBeInTheDocument();
  });

  it("keeps the Send reply composer footer as a start/end row that stacks on mobile", () => {
    renderDetail();
    const send = screen.getByRole("button", { name: "Send reply" });
    expect(send.className).toMatch(/\bbutton-primary\b/);
    expect(send.className).toMatch(/sm:w-auto/);
    const footer = send.parentElement as HTMLElement;
    expect(footer.className).toMatch(/flex-col/);
    expect(footer.className).toMatch(/sm:flex-row/);
    expect(send.className).toMatch(/sm:ms-auto/);
  });

  it("keeps Arabic labels and RTL for the sidebar controls", async () => {
    await changeAppLanguage("ar");
    renderDetail();
    expect(screen.getByRole("combobox", { name: "الحالة" })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
  });
});
