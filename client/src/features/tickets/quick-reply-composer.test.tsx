import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({ getQuickReplies: vi.fn(), createMessage: vi.fn(), createNote: vi.fn() }));

vi.mock("@/features/quick-replies/quick-reply-api", () => ({
  getQuickReplies: mocks.getQuickReplies,
  getQuickReply: vi.fn(),
  createQuickReply: vi.fn(),
  updateQuickReply: vi.fn(),
  deleteQuickReply: vi.fn(),
}));
vi.mock("./ticket-hooks", () => ({
  useCreateTicketMessage: () => ({ mutateAsync: mocks.createMessage, isPending: false }),
  useCreateTicketNote: () => ({ mutateAsync: mocks.createNote, isPending: false }),
}));
vi.mock("@/features/attachments/attachment-ui", () => ({ MessageAttachmentList: () => null, ConversationAttachmentBand: () => null }));

import { TicketConversation } from "./ticket-conversation";

const qr = (id: string, title: string, body: string) => ({
  id, title, body,
  createdAt: "2026-08-26T10:00:00.000Z", updatedAt: "2026-08-26T10:00:00.000Z",
  createdBy: { id: "admin-1", name: "Admin", role: "ADMIN" },
});

const ALL = [
  qr("qr-greeting", "Greeting", "Hello and welcome to our support team."),
  qr("qr-refund", "Billing help", "Your refund request will be processed within five days."),
  qr("qr-hours", "Working hours", "Our support hours are 9am to 6pm on weekdays."),
];

const listResponse = (data: typeof ALL) => ({ data, meta: { page: 1, limit: 10, total: data.length, totalPages: 1 } });

function defaultSearch({ search }: { search?: string }) {
  const term = String(search ?? "").toLowerCase();
  const data = term ? ALL.filter((r) => r.title.toLowerCase().includes(term) || r.body.toLowerCase().includes(term)) : ALL.slice(0, 10);
  return Promise.resolve(listResponse(data));
}

function renderConversation(props: Partial<React.ComponentProps<typeof TicketConversation>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={client}>
      <TicketConversation ticketId="ticket-1" items={[]} canMutate {...props} />
    </QueryClientProvider>,
  );
  return { ...result, client };
}

const trigger = () => screen.getByRole("button", { name: "Insert quick reply" });
const combobox = () => screen.getByRole("combobox", { name: "Quick reply" });
const replyBox = () => screen.getByLabelText("Public reply") as HTMLTextAreaElement;

function openPicker() {
  fireEvent.click(trigger());
  return combobox();
}

function setDraft(value: string, caretStart = value.length, caretEnd = caretStart) {
  const textarea = replyBox();
  fireEvent.change(textarea, { target: { value } });
  textarea.setSelectionRange(caretStart, caretEnd);
}

async function openAndPick(name: RegExp) {
  openPicker();
  const option = await screen.findByRole("option", { name });
  fireEvent.click(option);
}

describe("quick reply composer integration", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
    mocks.getQuickReplies.mockImplementation(defaultSearch);
    mocks.createMessage.mockResolvedValue({});
  });

  it("shows a collapsed trigger in authorized Reply mode with no permanent search input", () => {
    renderConversation();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("opens the searchable selector from the trigger", async () => {
    renderConversation();
    openPicker();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(combobox()).toBeInTheDocument();
    const greeting = await screen.findByRole("option", { name: /Greeting/ });
    expect(greeting).toHaveTextContent("Greeting");
    expect(greeting).toHaveTextContent("Hello and welcome to our support team.");
  });

  it("renders the dropdown through a portal on document.body, outside the Ticket Conversation card", async () => {
    renderConversation();
    openPicker();
    await screen.findByRole("option", { name: /Greeting/ });
    const panel = document.querySelector("[data-quick-reply-popover]") as HTMLElement;
    expect(panel).toBeInTheDocument();
    expect(panel.parentElement).toBe(document.body);
    expect(panel.className).toMatch(/\bfixed\b/);
    expect(panel.style.maxHeight).not.toBe("");
    const card = screen.getByRole("region", { name: "Conversation" });
    expect(card).not.toContainElement(panel);
    expect(card.className).toMatch(/overflow-hidden/); // the known clipping ancestor is untouched
    // listbox lives in the portalled panel, not in the card
    expect(panel).toContainElement(screen.getByRole("listbox"));
  });

  it("closes the selector on Escape and returns focus to the trigger", async () => {
    renderConversation();
    openPicker();
    await screen.findByRole("option", { name: /Greeting/ });
    fireEvent.keyDown(combobox(), { key: "Escape" });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it("closes on an outside pointer interaction", async () => {
    renderConversation();
    openPicker();
    await screen.findByRole("option", { name: /Greeting/ });
    fireEvent.pointerDown(replyBox());
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    // a pointer inside the panel does not close it
    openPicker();
    await screen.findByRole("option", { name: /Greeting/ });
    fireEvent.pointerDown(screen.getByRole("listbox"));
    expect(screen.getByRole("combobox", { name: "Quick reply" })).toBeInTheDocument();
  });

  it("searches quick replies by title through the backend list contract", async () => {
    renderConversation();
    openPicker();
    fireEvent.change(combobox(), { target: { value: "hours" } });
    await waitFor(() => expect(mocks.getQuickReplies).toHaveBeenCalledWith(expect.objectContaining({ search: "hours", page: 1, limit: 10 })));
    expect(await screen.findByRole("option", { name: /Working hours/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Greeting/ })).not.toBeInTheDocument();
  });

  it("searches quick replies by body text through the backend list contract", async () => {
    renderConversation();
    openPicker();
    fireEvent.change(combobox(), { target: { value: "refund request" } });
    await waitFor(() => expect(mocks.getQuickReplies).toHaveBeenCalledWith(expect.objectContaining({ search: "refund request" })));
    expect(await screen.findByRole("option", { name: /Billing help/ })).toBeInTheDocument();
  });

  it("shows the loading state while the search is in flight", async () => {
    mocks.getQuickReplies.mockReturnValue(new Promise(() => {}));
    renderConversation();
    openPicker();
    expect(await screen.findByText("Searching quick replies…")).toBeInTheDocument();
  });

  it("shows the empty state when no quick replies exist", async () => {
    mocks.getQuickReplies.mockResolvedValue(listResponse([]));
    renderConversation();
    openPicker();
    expect(await screen.findByText("No quick replies available.")).toBeInTheDocument();
  });

  it("shows a distinct no-results state for a non-matching search", async () => {
    renderConversation();
    openPicker();
    fireEvent.change(combobox(), { target: { value: "nothing matches this" } });
    expect(await screen.findByText("No quick replies match your search.")).toBeInTheDocument();
  });

  it("shows a non-blocking error state and leaves the composer usable", async () => {
    mocks.getQuickReplies.mockRejectedValue(new Error("boom"));
    renderConversation();
    setDraft("keep me");
    openPicker();
    expect(await screen.findByText("Unable to search quick replies. Try again.")).toBeInTheDocument();
    expect(combobox()).not.toBeDisabled();
    expect(replyBox().value).toBe("keep me");
    expect(mocks.createMessage).not.toHaveBeenCalled();
  });

  it("keyboard-selects a result and inserts it without submitting", async () => {
    renderConversation();
    setDraft("");
    const input = openPicker();
    await screen.findByRole("option", { name: /Greeting/ });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(replyBox().value).toBe("Hello and welcome to our support team."));
    expect(mocks.createMessage).not.toHaveBeenCalled();
  });

  it("inserts at the beginning of the draft, preserving the trailing text", async () => {
    renderConversation();
    setDraft("existing draft", 0, 0);
    await openAndPick(/Greeting/);
    await waitFor(() => expect(replyBox().value).toBe("Hello and welcome to our support team.\n\nexisting draft"));
    expect(replyBox().selectionStart).toBe("Hello and welcome to our support team.".length);
    expect(document.activeElement).toBe(replyBox());
  });

  it("inserts in the middle of the draft, preserving both sides", async () => {
    renderConversation();
    setDraft("aaabbb", 3, 3);
    await openAndPick(/Greeting/);
    await waitFor(() => expect(replyBox().value).toBe("aaa\n\nHello and welcome to our support team.\n\nbbb"));
    expect(replyBox().selectionStart).toBe(3 + 2 + "Hello and welcome to our support team.".length);
  });

  it("inserts at the end of the draft", async () => {
    renderConversation();
    setDraft("current note");
    await openAndPick(/Greeting/);
    await waitFor(() => expect(replyBox().value).toBe("current note\n\nHello and welcome to our support team."));
  });

  it("replaces the selected range without adding stray blank lines", async () => {
    renderConversation();
    setDraft("keep OLD keep", 5, 8);
    await openAndPick(/Greeting/);
    await waitFor(() => expect(replyBox().value).toBe("keep Hello and welcome to our support team. keep"));
    expect(replyBox().selectionStart).toBe(5 + "Hello and welcome to our support team.".length);
  });

  it("keeps the inserted draft editable", async () => {
    renderConversation();
    setDraft("start");
    await openAndPick(/Greeting/);
    await waitFor(() => expect(replyBox().value).toContain("Hello and welcome"));
    fireEvent.change(replyBox(), { target: { value: `${replyBox().value} extra` } });
    expect(replyBox().value).toContain("extra");
  });

  it("blocks insertion that would exceed the public-reply maximum length and keeps the draft", async () => {
    renderConversation();
    setDraft("a".repeat(19_999));
    await openAndPick(/Greeting/);
    expect(await screen.findByRole("alert")).toHaveTextContent("Inserting this quick reply would exceed the maximum reply length. Your draft is unchanged.");
    expect(replyBox().value).toBe("a".repeat(19_999));
    expect(mocks.createMessage).not.toHaveBeenCalled();
  });

  it("shows the localized Arabic length error", async () => {
    await changeAppLanguage("ar");
    renderConversation();
    const textarea = screen.getByLabelText("رد عام") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "ا".repeat(19_999) } });
    textarea.setSelectionRange(19_999, 19_999);
    fireEvent.click(screen.getByRole("button", { name: "إدراج رد سريع" }));
    fireEvent.click(await screen.findByRole("option", { name: /Greeting/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("إدراج هذا الرد السريع سيتجاوز الحد الأقصى لطول الرد. لم تتغيّر مسودتك.");
    expect(textarea.value).toBe("ا".repeat(19_999));
  });

  it("hides the trigger in Internal Note mode", () => {
    renderConversation();
    fireEvent.click(screen.getByRole("tab", { name: "Internal note" }));
    expect(screen.queryByRole("button", { name: "Insert quick reply" })).not.toBeInTheDocument();
  });

  it("hides the trigger when the agent cannot mutate the ticket", () => {
    renderConversation({ canMutate: false });
    expect(screen.queryByRole("button", { name: "Insert quick reply" })).not.toBeInTheDocument();
    expect(screen.getByText("This ticket must be assigned to you before you can reply or add a note.")).toBeInTheDocument();
  });

  it("lays out the composer footer with the trigger at the start and Send at the end", () => {
    renderConversation();
    const send = screen.getByRole("button", { name: "Send reply" });
    const footer = send.parentElement as HTMLElement;
    expect(footer).toContainElement(trigger());
    expect(footer.className).toMatch(/flex-col/);
    expect(footer.className).toMatch(/sm:flex-row/);
    expect(send.className).toMatch(/sm:ms-auto/);
    expect(send.className).toMatch(/sm:w-auto/);
  });

  it("keeps mobile composer actions full-width so they stack without overflow", () => {
    renderConversation();
    expect((trigger().parentElement as HTMLElement).className).toMatch(/w-full/);
    expect((trigger().parentElement as HTMLElement).className).toMatch(/sm:w-auto/);
    expect(trigger().className).toMatch(/w-full/);
  });

  it("renders the Arabic trigger and RTL selector", async () => {
    await changeAppLanguage("ar");
    renderConversation();
    fireEvent.click(screen.getByRole("button", { name: "إدراج رد سريع" }));
    expect(screen.getByRole("combobox", { name: "رد سريع" })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
  });

  it("keeps quick replies beyond the first page reachable through search", async () => {
    const many = Array.from({ length: 12 }, (_, index) => qr(`qr-${index}`, `Reply ${String.fromCharCode(65 + index)}`, `Body ${index}`));
    const zebra = qr("qr-zebra", "Zebra escalation", "Escalate to the zebra team immediately.");
    mocks.getQuickReplies.mockImplementation(({ search }: { search?: string }) => {
      const term = String(search ?? "").toLowerCase();
      if (!term) return Promise.resolve(listResponse(many.slice(0, 10)));
      const pool = [...many, zebra].filter((r) => r.title.toLowerCase().includes(term) || r.body.toLowerCase().includes(term));
      return Promise.resolve(listResponse(pool));
    });
    renderConversation();
    setDraft("");
    openPicker();
    await screen.findByRole("option", { name: /Reply A/ });
    expect(screen.queryByRole("option", { name: /Zebra escalation/ })).not.toBeInTheDocument();
    fireEvent.change(combobox(), { target: { value: "zebra" } });
    const option = await screen.findByRole("option", { name: /Zebra escalation/ });
    fireEvent.click(option);
    await waitFor(() => expect(replyBox().value).toBe("Escalate to the zebra team immediately."));
  });
});

describe("quick reply picker is absent from the Customer Portal", () => {
  it("no Portal source file references the quick replies feature", () => {
    const dir = join(process.cwd(), "src/features/portal");
    const offenders = readdirSync(dir)
      .filter((name) => /\.(ts|tsx)$/.test(name))
      .filter((name) => /quick-repl|QuickReply/.test(readFileSync(join(dir, name), "utf8")));
    expect(offenders).toEqual([]);
  });
});
