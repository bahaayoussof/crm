import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  useTicket: vi.fn(), useCategories: vi.fn(), useAgents: vi.fn(), useUpdateTicket: vi.fn(),
  useCreateTicketMessage: vi.fn(), useCreateTicketNote: vi.fn(), useAuth: vi.fn(),
  useTicketAttachments: vi.fn(),
  useUploadTicketAttachment: vi.fn(),
}));

vi.mock("./ticket-hooks", () => ({
  useTicket: mocks.useTicket, useCategories: mocks.useCategories, useAgents: mocks.useAgents,
  useUpdateTicket: mocks.useUpdateTicket, useCreateTicketMessage: mocks.useCreateTicketMessage, useCreateTicketNote: mocks.useCreateTicketNote,
}));
vi.mock("@/features/auth/auth-state", () => ({ useAuth: mocks.useAuth }));
vi.mock("@/features/attachments/attachment-hooks", () => ({
  useTicketAttachments: mocks.useTicketAttachments,
  useUploadTicketAttachment: mocks.useUploadTicketAttachment,
}));
vi.mock("@/features/quick-replies/quick-reply-picker", () => ({ QuickReplyPicker: () => null }));
// The @mention typeahead needs a QueryClient; its behaviour is covered elsewhere.
vi.mock("./ticket-mention-plugin", () => ({ TicketMentionPlugin: () => null }));
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
  mocks.useUploadTicketAttachment.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
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

  it("puts the AI Assistant trigger in the ticket header", () => {
    renderDetail();
    const trigger = screen.getByRole("button", { name: "AI Assistant" });
    expect(trigger.closest("header")).not.toBeNull();
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
    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
  });

  it("gives the desktop conversation column most of the viewport height", () => {
    const { container } = renderDetail();
    const leftColumn = (container.querySelector("div.grid") as HTMLElement).firstElementChild as HTMLElement;
    expect(leftColumn.className).toMatch(/lg:h-\[calc\(100dvh-2rem\)\]/);
    expect(leftColumn.className).toMatch(/lg:overflow-hidden/);
  });

  it("bounds the public reply editor so a long draft cannot swallow the message area", () => {
    const { container } = renderDetail();
    const reply = container.querySelector("#conversation-reply") as HTMLElement;
    expect(reply).toBeTruthy();
    // comfortable floor, hard ceiling, then the editor scrolls its own content
    expect(reply.className).toMatch(/min-h-\[7rem\]/);
    expect(reply.className).toMatch(/max-h-60/);
    expect(reply.className).toMatch(/overflow-y-auto/);
  });

  it("gives consecutive messages breathing room", () => {
    renderDetail();
    const list = screen.getByRole("list", { name: "Ticket conversation timeline" });
    expect(list.className).toMatch(/space-y-4/);
  });

  it("wraps long unbroken content in the message body, subject, description, activity, and customer email", () => {
    renderDetail();
    expect(longBody().className).toMatch(/\[overflow-wrap:anywhere\]/);
    expect(longBody().className).toMatch(/whitespace-pre-wrap/);

    expect(screen.getByRole("heading", { level: 1 }).className).toMatch(/\[overflow-wrap:anywhere\]/);
    // Description and Activity are lower-workspace tabs — open each before asserting.
    fireEvent.click(screen.getByRole("tab", { name: "Description" }));
    expect(screen.getByText(baseTicket.description, { selector: "p" }).className).toMatch(/\[overflow-wrap:anywhere\]/);
    fireEvent.click(screen.getByRole("tab", { name: /^Activity/ }));
    expect(screen.getByText(/NEW-/, { selector: "p" }).className).toMatch(/\[overflow-wrap:anywhere\]/);
    const email = screen.getByText(baseTicket.customer.email, { selector: "bdi" });
    expect(email.closest("p")?.className).toMatch(/\[overflow-wrap:anywhere\]/);
  });

  it("keeps a long filename inside its row: truncated with the full value in title, actions still reachable", () => {
    renderDetail();
    fireEvent.click(screen.getByRole("tab", { name: /^Attachments/ }));
    const name = screen.getByTitle(LONG_FILENAME);
    expect(name.className).toMatch(/truncate/);
    expect(name.closest("li")).toContainElement(screen.getByRole("button", { name: "Download attachment" }));
  });

  it("keeps activity timestamps on their own non-wrapping line, separate from the actor/change line", () => {
    renderDetail();
    fireEvent.click(screen.getByRole("tab", { name: /^Activity/ }));
    const activitySection = screen.getByRole("tab", { name: /^Activity/ }).closest("section") as HTMLElement;
    const time = activitySection.querySelector("li time") as HTMLElement;
    expect(time).toBeTruthy();
    expect(time.className).toMatch(/whitespace-nowrap/);
    expect(time.className).toMatch(/shrink-0/);
    const row = time.closest("li") as HTMLElement;
    const change = within(row).getByText(/NEW-/);
    expect(change).not.toContainElement(time);
  });
});

describe("Ticket Details conversation rows and long-message disclosure", () => {
  afterEach(cleanup);
  beforeEach(async () => { await changeAppLanguage("en"); vi.clearAllMocks(); baseMocks(); });

  it("aligns customer messages to the start and staff replies + internal notes to the end (chat bubbles)", () => {
    renderDetail();
    const customerRow = screen.getByText("Thanks, that is resolved now.", { selector: "p" }).closest("li") as HTMLElement;
    const staffRow = longBubble().closest("li") as HTMLElement;
    const noteRow = screen.getByText("Private investigation notes.", { selector: "p" }).closest("li") as HTMLElement;
    expect(customerRow.className).toMatch(/justify-start/);
    expect(staffRow.className).toMatch(/justify-end/);
    expect(noteRow.className).toMatch(/justify-end/);
    const staffArticle = longBubble();
    expect(staffArticle.className).toMatch(/sm:max-w-\[62%\]/);
    expect(staffArticle.className).not.toMatch(/flex-1/);
  });

  it("does not offer Show more for a short message", () => {
    renderDetail();
    const shortBubble = screen.getByText("Thanks, that is resolved now.", { selector: "p" }).closest("article") as HTMLElement;
    expect(within(shortBubble).queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
  });

  it("renders a staff reply's stored HTML as formatted text and strips anything unsafe", () => {
    mocks.useTicket.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        ...baseTicket,
        conversation: [
          {
            id: "m-html",
            kind: "PUBLIC_MESSAGE",
            createdAt: "2026-08-25T09:20:00.000Z",
            author: { id: "agent-1", name: "Mariam Hassan", role: "AGENT" },
            body:
              '<p>Hello <strong>Ahmed</strong></p><ul><li>step one</li></ul>' +
              '<script>alert(1)</script><a href="javascript:evil()">bad</a>',
          },
        ],
      },
    });
    renderDetail();
    const bubble = screen.getByText("step one").closest("article") as HTMLElement;
    expect(bubble.querySelector("strong")?.textContent).toBe("Ahmed");
    expect(bubble.querySelector("li")?.textContent).toBe("step one");
    expect(bubble.querySelector("script")).toBeNull();
    expect(bubble.innerHTML).not.toMatch(/javascript:/i);
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

  it("renders an internal note's sanitized HTML with @mention tokens as chips (no raw id, no script)", () => {
    mocks.useTicket.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        ...baseTicket,
        conversation: [
          {
            id: "note-html",
            kind: "INTERNAL_NOTE",
            createdAt: "2026-08-25T09:30:00.000Z",
            author: { id: "admin-1", name: "Admin", role: "ADMIN" },
            body: '<p>Please review <strong>this</strong> @[Ann Lee](user-9)</p><script>alert(1)</script>',
          },
        ],
      },
    });
    renderDetail();
    const note = screen.getByText(/Please review/).closest("article") as HTMLElement;
    expect(note.querySelector("strong")?.textContent).toBe("this");
    expect(within(note).getByText("@Ann Lee")).toBeInTheDocument();
    expect(note.textContent).not.toMatch(/user-9|@\[/);
    expect(note.querySelector("script")).toBeNull();
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
    // the lower workspace owns both the Attach file trigger and the Attachments tab
    const attach = screen.getByRole("button", { name: "Attach file" });
    const send = screen.getByRole("button", { name: "Reply" });
    expect(attach.closest("section")).toBe(send.closest("section"));
    // sidebar is a pure context panel — no attachments, no file input, no attachment actions
    const sidebar = screen.getByRole("heading", { name: "Ticket details" }).closest("aside") as HTMLElement;
    expect(sidebar.querySelector('input[type="file"]')).toBeNull();
    expect(within(sidebar).queryByRole("tab", { name: /^Attachments/ })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole("button", { name: "Download attachment" })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole("button", { name: "Preview attachment" })).not.toBeInTheDocument();
    // ticket-level attachments live in the lower-workspace Attachments tab (main column)
    fireEvent.click(screen.getByRole("tab", { name: /^Attachments/ }));
    const filename = screen.getByTitle(LONG_FILENAME);
    expect(filename.closest("aside")).toBeNull();
    expect(filename.className).toMatch(/truncate/);
    expect(within(filename.closest("li") as HTMLElement).getByRole("button", { name: "Download attachment" })).toBeInTheDocument();
    expect(within(filename.closest("li") as HTMLElement).getByRole("button", { name: "Preview attachment" })).toBeInTheDocument();
  });

  it("opens the shared FileUploadModal on Attach file click; Cancel closes modal and restores conversation", async () => {
    renderDetail();
    expect(screen.queryByRole("dialog", { name: /upload file|select file/i })).not.toBeInTheDocument();

    const attachButton = screen.getByRole("button", { name: "Attach file" });
    fireEvent.click(attachButton);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Drag and drop your file here")).toBeInTheDocument();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    fireEvent.change(input, {
      target: { files: [new File(["x".repeat(2048)], "evidence.pdf", { type: "application/pdf" })] },
    });

    expect(await screen.findByTitle("evidence.pdf")).toBeInTheDocument();
    const upload = screen.getByRole("button", { name: "Upload" });
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(upload.parentElement).toBe(cancel.parentElement);

    fireEvent.click(cancel);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Ticket conversation timeline" })).toBeInTheDocument();
  });

  it("shows a themed selected-file card in FileUploadModal with a contained filename, metadata, and a Remove action", async () => {
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "Attach file" }));

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const longName = `azm_squad_customer_support_crm_super_long_filename_v12_final.pdf`;
    fireEvent.change(input, { target: { files: [new File(["x".repeat(40 * 1024)], longName, { type: "application/pdf" })] } });

    const name = await screen.findByTitle(longName);
    expect(name.className).toMatch(/truncate/);
    expect(screen.getByText((content) => content.includes("40 KB"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove file" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove file" }));
    expect(screen.queryByTitle(longName)).not.toBeInTheDocument();
  });

  it("keeps the Reply composer footer as a start/end row that stacks on mobile", () => {
    renderDetail();
    const send = screen.getByRole("button", { name: "Reply" });
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

describe("Ticket Details right rail & lower workspace", () => {
  afterEach(cleanup);
  beforeEach(async () => { await changeAppLanguage("en"); vi.clearAllMocks(); baseMocks(); });

  it("keeps the right rail to Ticket details and SLA only", () => {
    renderDetail();
    const rail = screen.getByRole("heading", { name: "Ticket details" }).closest("aside") as HTMLElement;
    expect(within(rail).getByRole("combobox", { name: "Status" })).toBeVisible();
    expect(within(rail).getByRole("heading", { name: "SLA" })).toBeVisible();
    // everything else has left the rail
    expect(within(rail).queryByRole("heading", { name: "Customer" })).not.toBeInTheDocument();
    expect(within(rail).queryByRole("heading", { name: "AI Assistant" })).not.toBeInTheDocument();
    expect(within(rail).queryByRole("button", { name: /^Activity/ })).not.toBeInTheDocument();
    expect(within(rail).queryByRole("button", { name: /^Description/ })).not.toBeInTheDocument();
    expect(within(rail).queryByRole("button", { name: /^Followers/ })).not.toBeInTheDocument();
    expect(within(rail).queryByText("Ticket metadata")).not.toBeInTheDocument();
    expect(within(rail).queryByRole("button", { name: /merge/i })).not.toBeInTheDocument();
    expect(within(rail).queryByRole("button", { name: /duplicate/i })).not.toBeInTheDocument();
  });

  it("shows Followers in the context summary strip, not the rail", () => {
    mocks.useTicket.mockReturnValue({
      isLoading: false, isError: false,
      data: { ...baseTicket, watcherCount: 3, viewerIsWatching: false },
    });
    renderDetail();
    const rail = screen.getByRole("heading", { name: "Ticket details" }).closest("aside") as HTMLElement;
    expect(within(rail).queryByText("Followers")).not.toBeInTheDocument();
    expect(screen.getByText("Followers")).toBeInTheDocument(); // summary strip cell label
  });

  it("renders ticket-level attachments as a compact grid in the Attachments tab", () => {
    renderDetail();
    fireEvent.click(screen.getByRole("tab", { name: /^Attachments/ }));
    const grid = screen.getByTitle(LONG_FILENAME).closest("ul") as HTMLElement;
    expect(grid.className).toMatch(/grid/);
    const card = screen.getByTitle(LONG_FILENAME).closest("li") as HTMLElement;
    expect(within(card).getByRole("button", { name: "Download attachment" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Preview attachment" })).toBeInTheDocument();
  });

  it("shows only the first 3 attachments in the Attachments tab with a View all / Show less toggle", () => {
    const files = Array.from({ length: 5 }, (_, i) => ({
      id: `att-${i}`, fileName: `file-${i}.pdf`, mimeType: "application/pdf",
      createdAt: "2026-08-25T09:00:00.000Z", messageId: null,
    }));
    mocks.useTicketAttachments.mockReturnValue({ data: files, isLoading: false, isError: false, refetch: vi.fn() });
    renderDetail();
    fireEvent.click(screen.getByRole("tab", { name: /^Attachments/ }));
    expect(screen.getByTitle("file-0.pdf")).toBeInTheDocument();
    expect(screen.getByTitle("file-2.pdf")).toBeInTheDocument();
    expect(screen.queryByTitle("file-3.pdf")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View all" }));
    expect(screen.getByTitle("file-4.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.queryByTitle("file-3.pdf")).not.toBeInTheDocument();
  });

  it("builds the rail as separate bordered cards (Ticket details + SLA)", () => {
    renderDetail();
    const railStack = screen.getByRole("heading", { name: "Ticket details" }).closest("section")!
      .parentElement as HTMLElement;
    expect(railStack.className).toMatch(/space-y-3/);
    for (const name of ["Ticket details", "SLA"]) {
      const card = screen.getByRole("heading", { name }).closest("section") as HTMLElement;
      expect(card.className).toMatch(/rounded-lg/);
      expect(card.className).toMatch(/border/);
      expect(card.className).toMatch(/bg-card/);
    }
  });

  it("gives the Reply tab a heading, a rich-text toolbar, a bounded editor, and an Attach + Reply footer", () => {
    renderDetail();
    expect(screen.getByText("Reply to customer")).toBeInTheDocument();
    expect(screen.getByText("This response is visible to the customer.")).toBeInTheDocument();
    // Lexical toolbar — Reply and Internal note share the same one, so there are two.
    expect(screen.getAllByRole("button", { name: "Bold" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: "Bulleted list" }).length).toBeGreaterThanOrEqual(1);
    const reply = document.querySelector("#conversation-reply") as HTMLElement;
    expect(reply.getAttribute("contenteditable")).toBe("true");
    expect(reply.className).toMatch(/min-h-\[7rem\]/);
    expect(reply.className).toMatch(/max-h-60/);
    const send = screen.getByRole("button", { name: "Reply" });
    const footer = send.parentElement as HTMLElement;
    expect(footer.className).toMatch(/border-t/);
    expect(footer).toContainElement(screen.getByRole("button", { name: "Attach file" }));
  });

  it("keeps the conversation viewport mounted when opening FileUploadModal, and closes on Cancel", async () => {
    renderDetail();
    expect(screen.getByRole("list", { name: "Ticket conversation timeline" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Attach file" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    // Conversation remains in place
    expect(screen.getByRole("list", { name: "Ticket conversation timeline" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Attach file" })).toBeInTheDocument();
  });

  it("closes the upload modal and preserves conversation after a successful upload", async () => {
    mocks.useUploadTicketAttachment.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ success: true }),
      isPending: false,
    });
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "Attach file" }));

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x".repeat(2048)], "note.pdf", { type: "application/pdf" })] } });

    fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("list", { name: "Ticket conversation timeline" })).toBeInTheDocument();
  });

  it("keeps the context rail as a page-grid sibling of the conversation workspace, not inside it", () => {
    const { container } = renderDetail();
    const grid = container.querySelector("div.grid") as HTMLElement;
    const [mainColumn, railColumn] = Array.from(grid.children) as HTMLElement[];
    const conversation = screen.getByRole("region", { name: "Conversation" });
    const ticketDetails = screen.getByRole("heading", { name: "Ticket details" });
    expect(mainColumn).toContainElement(conversation);
    expect(railColumn).toContainElement(ticketDetails);
    expect(mainColumn).not.toContainElement(ticketDetails);
    expect(conversation).not.toContainElement(ticketDetails);
    // rail is not stretched by the conversation row
    expect(grid.className).toMatch(/lg:items-start/);
    expect(railColumn.className).toMatch(/lg:self-start/);
  });
});
