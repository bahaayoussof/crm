import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  useTickets: vi.fn(), useTicket: vi.fn(), useCategories: vi.fn(), useAgents: vi.fn(), useCreateTicket: vi.fn(), useUpdateTicket: vi.fn(), useClaimTicket: vi.fn(), useCreateTicketMessage: vi.fn(), useCreateTicketNote: vi.fn(), useCustomers: vi.fn(), useAuth: vi.fn(),
  create: vi.fn(), update: vi.fn(), claim: vi.fn(), createMessage: vi.fn(), createNote: vi.fn(), refetch: vi.fn(),
  departments: [] as unknown[], teams: [] as unknown[],
}));
vi.mock("./ticket-hooks", () => ({ useTickets: mocks.useTickets, useTicket: mocks.useTicket, useCategories: mocks.useCategories, useAgents: mocks.useAgents, useCreateTicket: mocks.useCreateTicket, useUpdateTicket: mocks.useUpdateTicket, useClaimTicket: mocks.useClaimTicket, useCreateTicketMessage: mocks.useCreateTicketMessage, useCreateTicketNote: mocks.useCreateTicketNote }));
vi.mock("@/features/customers/customer-hooks", () => ({ useCustomers: mocks.useCustomers }));
vi.mock("@/features/organization/organization-hooks", () => ({ useDepartmentOptions: () => ({ data: mocks.departments }), useBranchOptions: () => ({ data: [] }), useTeamOptions: () => ({ data: mocks.teams }) }));
vi.mock("@/features/auth/auth-state", () => ({ useAuth: mocks.useAuth }));
vi.mock("@/features/attachments/attachment-hooks", () => ({
  useTicketAttachments: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useUploadTicketAttachment: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
}));
vi.mock("@/features/quick-replies/quick-reply-picker", () => ({ QuickReplyPicker: () => null }));
vi.mock("@/features/collaboration/mention-textarea", () => ({
  MentionTextarea: (props: { id: string; value: string; disabled?: boolean; ariaDescribedBy?: string; onChange: (v: string) => void }) => (
    <textarea id={props.id} value={props.value} disabled={props.disabled} aria-describedby={props.ariaDescribedBy} onChange={(event) => props.onChange(event.target.value)} />
  ),
}));
vi.mock("@/features/collaboration/watch-toggle", () => ({ WatchToggle: () => null }));
vi.mock("@/features/ai-assistant/ai-assistant-panel", () => ({ AiAssistantPanel: () => null }));
// Page-wiring tests: a plain-textarea stand-in for the Lexical reply editor.
// The editor's own behaviour is covered in quick-reply-composer.test.tsx.
vi.mock("./ticket-reply-editor", async () => {
  const React = await import("react");
  const TicketReplyEditor = React.forwardRef(function TicketReplyEditor(
    props: { id: string; ariaLabel: string; ariaDescribedBy?: string; disabled?: boolean; onTextChange?: (v: string) => void },
    ref: React.ForwardedRef<unknown>,
  ) {
    const [value, setValue] = React.useState("");
    React.useImperativeHandle(ref, () => ({
      hasText: () => value.trim().length > 0,
      getPlainText: () => value,
      getHtml: () => value,
      insertText: (t: string) => { setValue((v) => v + t); props.onTextChange?.(value + t); return "inserted"; },
      replaceText: (t: string) => { setValue(t); props.onTextChange?.(t); return "inserted"; },
      focus: () => {},
      clear: () => { setValue(""); props.onTextChange?.(""); },
    }), [value, props]);
    return React.createElement("textarea", {
      id: props.id, "aria-label": props.ariaLabel, "aria-describedby": props.ariaDescribedBy,
      disabled: props.disabled, value,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => { setValue(e.target.value); props.onTextChange?.(e.target.value); },
    });
  });
  return { TicketReplyEditor };
});

import { TicketDetailPage } from "./ticket-detail-page";
import { TicketFormPage } from "./ticket-form-page";
import { TicketListPage } from "./ticket-list-page";

const ticket = {
  id: "ticket-12345678", subject: "Payment failed", description: "The customer's card was rejected.", status: "IN_PROGRESS", priority: "HIGH", channel: "WEB",
  firstResponseDueAt: "2026-08-25T09:00:00.000Z", firstRespondedAt: null, resolutionDueAt: "2026-08-26T08:00:00.000Z", resolvedAt: null, closedAt: null,
  slaState: "BREACHED" as const, effectiveSlaDueAt: "2026-08-25T09:00:00.000Z", effectiveSlaTarget: "FIRST_RESPONSE" as const,
  createdAt: "2026-08-25T08:00:00.000Z", updatedAt: "2026-08-25T08:30:00.000Z",
  customer: { id: "customer-1", name: "Ahmed Mohamed", email: "ahmed@example.com", phone: "+201000000000", createdAt: "2026-08-20T08:00:00.000Z" },
  assignedAgent: { id: "agent-1", name: "Mariam Hassan", email: "mariam@example.com" }, category: { id: "category-1", name: "Billing" }, department: null, branch: null,
  history: [{ id: "history-1", action: "STATUS_CHANGED", oldValue: "OPEN", newValue: "IN_PROGRESS", createdAt: "2026-08-25T08:30:00.000Z", actor: { id: "admin-1", name: "Admin", role: "ADMIN" } }],
  conversation: [],
};
const listTicket = { ...ticket, customer: { id: ticket.customer.id, name: ticket.customer.name, email: ticket.customer.email } };

describe("ticket pages", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en"); vi.clearAllMocks();
    mocks.departments = []; mocks.teams = [];
    mocks.useAuth.mockReturnValue({ user: { id: "admin-1", name: "Admin", email: "admin@example.com", role: "ADMIN" } });
    mocks.useTickets.mockReturnValue({ isLoading: false, isError: false, data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }, refetch: mocks.refetch });
    mocks.useTicket.mockReturnValue({ isLoading: false, isError: false, data: ticket });
    mocks.useCategories.mockReturnValue({ data: [{ id: "category-1", name: "Billing" }] }); mocks.useAgents.mockReturnValue({ data: [{ id: "agent-1", name: "Mariam Hassan", email: "mariam@example.com" }] });
    mocks.useCustomers.mockReturnValue({ isLoading: false, data: { data: [{ id: "customer-1", name: "Ahmed Mohamed", email: "ahmed@example.com" }], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } } });
    mocks.useCreateTicket.mockReturnValue({ mutateAsync: mocks.create }); mocks.useUpdateTicket.mockReturnValue({ mutateAsync: mocks.update, isPending: false });
    mocks.useClaimTicket.mockReturnValue({ mutate: mocks.claim, isPending: false, isError: false, error: null, variables: undefined });
    mocks.useCreateTicketMessage.mockReturnValue({ mutateAsync: mocks.createMessage, isPending: false }); mocks.useCreateTicketNote.mockReturnValue({ mutateAsync: mocks.createNote, isPending: false });
  });

  it("renders structured loading and a genuine empty state inside the table", () => {
    mocks.useTickets.mockReturnValueOnce({ isLoading: true, isError: false, data: undefined, refetch: mocks.refetch });
    const loading = renderAt("/tickets", <Route path="/tickets" element={<TicketListPage />} />); expect(screen.getByLabelText("loading")).toBeInTheDocument(); loading.unmount();
    renderAt("/tickets", <Route path="/tickets" element={<TicketListPage />} />);
    expect(screen.getAllByText("No tickets yet.")).toHaveLength(2);
    expect(within(screen.getByRole("table")).getByRole("columnheader", { name: "Customer" })).toBeInTheDocument();
  });

  it("navigates to /tickets/new on New Ticket click and does not open a modal", () => {
    renderAt(
      "/tickets",
      <>
        <Route path="/tickets" element={<TicketListPage />} />
        <Route path="/tickets/new" element={<h1>New Ticket Page</h1>} />
      </>,
    );
    const newButton = screen.getByRole("link", { name: /new ticket/i });
    expect(newButton).toHaveAttribute("href", "/tickets/new");
    fireEvent.click(newButton);
    expect(screen.getByRole("heading", { name: "New Ticket Page" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["/tickets?search=missing-id", "No tickets found for “missing-id”."],
    ["/tickets?status=WAITING_CUSTOMER", "No tickets with status “Waiting for customer”."],
    ["/tickets?priority=URGENT", "No tickets with priority “Urgent”."],
    ["/tickets?categoryId=category-1", "No tickets in category “Billing”."],
    ["/tickets?assignedAgentId=agent-1", "No tickets assigned to “Mariam Hassan”."],
    ["/tickets?status=OPEN&priority=URGENT", "No tickets match the current filters."],
  ])("keeps the table header for context-aware empty results at %s", (path, message) => {
    renderAt(path, <Route path="/tickets" element={<TicketListPage />} />);
    expect(screen.getAllByText(message)).toHaveLength(2);
    expect(within(screen.getByRole("table")).getByRole("columnheader", { name: "Ticket" })).toBeInTheDocument();
  });

  it("drives backend search and filters from URL state", async () => {
    renderAt("/tickets", <Route path="/tickets" element={<TicketListPage />} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "ticket-12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Filter options" }));

    const statusTrigger = screen.getByRole("combobox", { name: "Status" });
    fireEvent.keyDown(statusTrigger, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("option", { name: "Open" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Open" }));
    await waitFor(() => expect(mocks.useTickets).toHaveBeenLastCalledWith(expect.objectContaining({ search: "ticket-12345678", status: "OPEN" })), { timeout: 1000 });
  });

  it("clears search and filter URL state", async () => {
    renderAt("/tickets?search=missing-id&status=OPEN", <Route path="/tickets" element={<TicketListPage />} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(mocks.useTickets).toHaveBeenLastCalledWith(expect.objectContaining({ search: "", status: undefined })));
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("uses TanStack Table with server pagination", async () => {
    mocks.useTickets.mockReturnValue({ isLoading: false, isError: false, data: { data: [listTicket], meta: { page: 2, limit: 20, total: 60, totalPages: 3 } }, refetch: mocks.refetch });
    renderAt("/tickets?page=2", <Route path="/tickets" element={<TicketListPage />} />);
    expect(within(screen.getByRole("table")).getByRole("columnheader", { name: "Ticket" })).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("columnheader", { name: "Customer" })).toBeInTheDocument();
    expect(screen.getAllByTitle(ticket.id).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(mocks.useTickets).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 })));
  });

  it("validates ticket creation and preserves mutation boundaries", async () => {
    mocks.useTicket.mockReturnValue({ isLoading: false, isError: false, data: undefined });
    renderAt("/tickets/new", <Route path="/tickets/new" element={<TicketFormPage />} />);
    expect(screen.queryByLabelText("Find customer")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Customer" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create ticket" }));
    expect(await screen.findByText("Select a customer")).toBeInTheDocument(); expect(mocks.create).not.toHaveBeenCalled();
  });

  it("searches customers inside the combobox and selects a server result", async () => {
    mocks.useTicket.mockReturnValue({ isLoading: false, isError: false, data: undefined });
    renderAt("/tickets/new", <Route path="/tickets/new" element={<TicketFormPage />} />);
    const customerInput = screen.getByRole("combobox", { name: "Customer" });
    fireEvent.change(customerInput, { target: { value: "Ahmed" } });
    await waitFor(() => expect(mocks.useCustomers).toHaveBeenLastCalledWith({ search: "Ahmed", page: 1, limit: 10 }), { timeout: 1000 });
    fireEvent.click(screen.getByRole("option", { name: /Ahmed Mohamed/ }));
    expect(customerInput).toHaveValue("Ahmed Mohamed");
    expect(screen.getByText("ahmed@example.com")).toBeInTheDocument();
  });

  it("shows a localized empty customer-search state", () => {
    mocks.useTicket.mockReturnValue({ isLoading: false, isError: false, data: undefined });
    mocks.useCustomers.mockReturnValue({ isLoading: false, data: { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } } });
    renderAt("/tickets/new", <Route path="/tickets/new" element={<TicketFormPage />} />);
    fireEvent.focus(screen.getByRole("combobox", { name: "Customer" }));
    expect(screen.getByText("No customers match your search.")).toBeInTheDocument();
  });

  it("creates a ticket and navigates to details", async () => {
    mocks.useTicket.mockReturnValue({ isLoading: false, isError: false, data: undefined }); mocks.create.mockResolvedValue(listTicket);
    renderAt("/tickets/new", <><Route path="/tickets/new" element={<TicketFormPage />} /><Route path="/tickets/:id" element={<p>Created detail</p>} /></>);
    fireEvent.focus(screen.getByRole("combobox", { name: "Customer" }));
    fireEvent.click(screen.getByRole("option", { name: /Ahmed Mohamed/ }));
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Payment failed" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Card rejected" } });
    
    const categoryTrigger = screen.getByRole("combobox", { name: "Category" });
    fireEvent.keyDown(categoryTrigger, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("option", { name: "Billing" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Billing" }));

    fireEvent.click(screen.getByRole("button", { name: "Create ticket" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ customerId: "customer-1", priority: "MEDIUM", categoryId: "category-1" })));
    expect(await screen.findByText("Created detail")).toBeInTheDocument();
  });

  // feature/team-based-manager-scope
  it("ADMIN routes Department → Team → Agent, and the Agent select stays disabled until a Team is chosen", async () => {
    mocks.departments = [{ id: "dep-1", name: "Customer Support", branchId: "b1" }];
    mocks.teams = [
      { id: "team-1", name: "Billing Support", departmentId: "dep-1", managerId: null },
      { id: "team-9", name: "Other Dept Team", departmentId: "dep-9", managerId: null },
    ];
    mocks.useAgents.mockReturnValue({
      data: [{ id: "agent-1", name: "Mariam Hassan", email: "mariam@example.com", teamId: "team-1" }],
    });
    mocks.useTicket.mockReturnValue({ isLoading: false, isError: false, data: undefined });
    renderAt("/tickets/new", <Route path="/tickets/new" element={<TicketFormPage />} />);

    // Agent select disabled before a team is picked.
    expect(screen.getByLabelText("Assigned agent")).toBeDisabled();

    // Department → only its teams are offered.
    fireEvent.click(screen.getByRole("combobox", { name: "Department" }));
    fireEvent.click(await screen.findByRole("option", { name: "Customer Support" }));
    const teamSelect = screen.getByLabelText("Team");
    await waitFor(() => expect(teamSelect).toBeEnabled());
    fireEvent.click(teamSelect);
    expect(await screen.findByRole("option", { name: "Billing Support" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Other Dept Team" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Billing Support" }));

    // Team chosen → agent select becomes usable.
    await waitFor(() => expect(screen.getByLabelText("Assigned agent")).toBeEnabled());
  });

  it("keeps agent creation available while omitting assignee selection and payload", async () => {
    mocks.useAuth.mockReturnValue({ user: { id: "agent-1", name: "Agent", email: "agent@example.com", role: "AGENT" } });
    mocks.useTicket.mockReturnValue({ isLoading: false, isError: false, data: undefined }); mocks.create.mockResolvedValue(listTicket);
    renderAt("/tickets/new", <><Route path="/tickets/new" element={<TicketFormPage />} /><Route path="/tickets/:id" element={<p>Agent ticket detail</p>} /></>);
    expect(screen.queryByRole("combobox", { name: "Assigned agent" })).not.toBeInTheDocument();
    fireEvent.focus(screen.getByRole("combobox", { name: "Customer" }));
    fireEvent.click(screen.getByRole("option", { name: /Ahmed Mohamed/ }));
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Phone request" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Captured by agent" } });
    
    const categoryTrigger = screen.getByRole("combobox", { name: "Category" });
    fireEvent.keyDown(categoryTrigger, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("option", { name: "Billing" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Billing" }));

    fireEvent.click(screen.getByRole("button", { name: "Create ticket" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty("assignedAgentId"); expect(await screen.findByText("Agent ticket detail")).toBeInTheDocument();
  });

  it("renders details and localized operational history", () => {
    renderAt(`/tickets/${ticket.id}`, <Route path="/tickets/:id" element={<TicketDetailPage />} />);
    expect(screen.getByRole("heading", { name: ticket.subject })).toBeInTheDocument();
    expect(screen.getByText("Conversation")).toBeInTheDocument();
    // Description and Activity are lower-workspace tabs now.
    fireEvent.click(screen.getByRole("tab", { name: "Description" }));
    expect(screen.getByText(ticket.description)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /^Activity/ }));
    expect(screen.getByText("Status changed")).toBeInTheDocument();
  });

  it.each([
    ["ON_TRACK", "On track", "The active target is currently within its SLA window."],
    ["AT_RISK", "At risk", "The active target is due within 60 minutes."],
    ["BREACHED", "Breached", "The active target deadline has passed."],
    ["MET", "Target completed", "No active target remains for this completed SLA."],
    ["NOT_CONFIGURED", "Not configured", "No applicable SLA deadline is configured for this ticket."],
  ] as const)("renders the %s SLA state with explicit text", (slaState, label, explanation) => {
    mocks.useTicket.mockReturnValue({ isLoading: false, isError: false, data: { ...ticket, slaState, effectiveSlaDueAt: slaState === "MET" || slaState === "NOT_CONFIGURED" ? null : ticket.effectiveSlaDueAt, effectiveSlaTarget: slaState === "MET" || slaState === "NOT_CONFIGURED" ? null : ticket.effectiveSlaTarget } });
    renderAt(`/tickets/${ticket.id}`, <Route path="/tickets/:id" element={<TicketDetailPage />} />);
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByText(explanation)).toBeVisible();
  });

  it("shows effective and raw SLA target details with direction-safe dates", () => {
    mocks.useTicket.mockReturnValue({ isLoading: false, isError: false, data: { ...ticket, firstRespondedAt: "2026-08-25T08:45:00.000Z", effectiveSlaDueAt: ticket.resolutionDueAt, effectiveSlaTarget: "RESOLUTION", slaState: "ON_TRACK" } });
    const { container } = renderAt(`/tickets/${ticket.id}`, <Route path="/tickets/:id" element={<TicketDetailPage />} />);
    const sla = screen.getByRole("heading", { name: "SLA" }).closest("section");
    expect(sla).not.toBeNull();
    expect(within(sla as HTMLElement).getByText("Resolution")).toBeVisible();
    expect(within(sla as HTMLElement).getByText("Effective deadline")).toBeVisible();
    expect(within(sla as HTMLElement).getByText("First response due")).toBeVisible();
    expect(within(sla as HTMLElement).getByText("First response completed")).toBeVisible();
    expect(within(sla as HTMLElement).getByText("Resolution due")).toBeVisible();
    expect(container.querySelectorAll('bdi[dir="ltr"]').length).toBeGreaterThanOrEqual(5);
  });

  it("shows the first-response target and omits a fake deadline when none is effective", () => {
    const first = renderAt(`/tickets/${ticket.id}`, <Route path="/tickets/:id" element={<TicketDetailPage />} />);
    expect(screen.getByText("First response", { selector: "dd" })).toBeVisible();
    first.unmount();
    mocks.useTicket.mockReturnValue({ isLoading: false, isError: false, data: { ...ticket, slaState: "NOT_CONFIGURED", effectiveSlaDueAt: null, effectiveSlaTarget: null, firstResponseDueAt: null, resolutionDueAt: null } });
    renderAt(`/tickets/${ticket.id}`, <Route path="/tickets/:id" element={<TicketDetailPage />} />);
    expect(screen.queryByText("Effective deadline")).not.toBeInTheDocument();
    expect(screen.getByText("Not configured")).toBeVisible();
  });

  it("renders public messages and internal notes chronologically with explicit semantics", () => {
    mocks.useTicket.mockReturnValue({ isLoading: false, isError: false, data: { ...ticket, conversation: [
      { id: "message-1", kind: "PUBLIC_MESSAGE", body: "Customer-visible update", createdAt: "2026-08-25T09:00:00.000Z", author: { id: "agent-1", name: "Mariam Hassan", role: "AGENT" } },
      { id: "note-1", kind: "INTERNAL_NOTE", body: "Private investigation", createdAt: "2026-08-25T09:05:00.000Z", author: { id: "admin-1", name: "Admin", role: "ADMIN" } },
    ] } });
    renderAt(`/tickets/${ticket.id}`, <Route path="/tickets/:id" element={<TicketDetailPage />} />);
    expect(screen.getByText("Customer-visible update")).toBeInTheDocument(); expect(screen.getByText("Private investigation")).toBeInTheDocument();
    expect(screen.getByText("Visible to customer")).toBeInTheDocument(); expect(screen.getAllByText("Internal note").length).toBeGreaterThanOrEqual(2);
  });

  it("switches composer modes and clears only after successful submission", async () => {
    mocks.createMessage.mockResolvedValue({}); mocks.createNote.mockResolvedValue({});
    renderAt(`/tickets/${ticket.id}`, <Route path="/tickets/:id" element={<TicketDetailPage />} />);
    const reply = screen.getByLabelText("Reply to customer"); fireEvent.change(reply, { target: { value: "Public update" } }); fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    await waitFor(() => expect(mocks.createMessage).toHaveBeenCalledWith({ body: "Public update" })); expect(reply).toHaveValue("");
    fireEvent.click(screen.getByRole("tab", { name: "Internal note" })); const note = screen.getByLabelText("Internal note"); fireEvent.change(note, { target: { value: "Private context" } }); fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await waitFor(() => expect(mocks.createNote).toHaveBeenCalledWith({ body: "Private context" })); expect(note).toHaveValue("");
  });

  it("preserves composer content on localized failure and prevents pending duplicates", async () => {
    mocks.createMessage.mockRejectedValue(new Error("failure"));
    renderAt(`/tickets/${ticket.id}`, <Route path="/tickets/:id" element={<TicketDetailPage />} />);
    const reply = screen.getByLabelText("Reply to customer"); fireEvent.change(reply, { target: { value: "Keep this reply" } }); fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to send the reply."); expect(reply).toHaveValue("Keep this reply");
    cleanup(); mocks.useCreateTicketMessage.mockReturnValue({ mutateAsync: mocks.createMessage, isPending: true }); renderAt(`/tickets/${ticket.id}`, <Route path="/tickets/:id" element={<TicketDetailPage />} />);
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  });

  it("renders an accessible RTL conversation composer", async () => {
    await changeAppLanguage("ar"); renderAt(`/tickets/${ticket.id}`, <Route path="/tickets/:id" element={<TicketDetailPage />} />);
    const composerModes = screen.getByRole("tablist", { name: "وضع محرر الرسالة" });
    expect(within(composerModes).getByRole("tab", { name: "رد" })).toHaveAttribute("aria-selected", "true");
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
  });

  it("localizes SLA presentation in Arabic and preserves RTL date isolation", async () => {
    await changeAppLanguage("ar");
    const { container } = renderAt(`/tickets/${ticket.id}`, <Route path="/tickets/:id" element={<TicketDetailPage />} />);
    expect(screen.getByRole("heading", { name: "اتفاقية مستوى الخدمة" })).toBeVisible();
    expect(screen.getByText("تم تجاوز الموعد")).toBeVisible();
    expect(screen.getByText("الرد الأول", { selector: "dd" })).toBeVisible();
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
    expect(container.querySelector('bdi[dir="ltr"]')).not.toBeNull();
  });

  it("updates status and assignment through one safe mutation", async () => {
    mocks.update.mockResolvedValue(listTicket);
    renderAt(`/tickets/${ticket.id}`, <Route path="/tickets/:id" element={<TicketDetailPage />} />);
    
    const statusTrigger = screen.getByRole("combobox", { name: "Status" });
    fireEvent.keyDown(statusTrigger, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("option", { name: "Resolved" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Resolved" }));

    const agentTrigger = screen.getByRole("combobox", { name: "Assigned agent" });
    fireEvent.keyDown(agentTrigger, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("option", { name: "Unassigned" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Unassigned" }));

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ status: "RESOLVED", assignedAgentId: null }));
  });

  it("limits assigned-agent details to operational controls and confirms close", async () => {
    mocks.useAuth.mockReturnValue({ user: { id: "agent-1", name: "Agent", email: "agent@example.com", role: "AGENT" } });
    mocks.useTicket.mockReturnValue({ isLoading: false, isError: false, data: { ...ticket, status: "RESOLVED", resolvedAt: "2026-08-25T10:00:00.000Z" } });
    mocks.update.mockResolvedValue({ ...listTicket, status: "CLOSED" });
    renderAt(`/tickets/${ticket.id}`, <Route path="/tickets/:id" element={<TicketDetailPage />} />);
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Category" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Priority" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close ticket" }));
    expect(screen.getByText(/Closing is final/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm close" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ status: "CLOSED" }));
  });

  it("offers an agent a self-assign action on an unassigned ticket and keeps it otherwise read-only", async () => {
    mocks.useAuth.mockReturnValue({ user: { id: "agent-1", name: "Agent", email: "agent@example.com", role: "AGENT" } });
    mocks.useTicket.mockReturnValue({ isLoading: false, isError: false, data: { ...ticket, assignedAgent: null } });
    mocks.update.mockResolvedValue(listTicket);
    renderAt(`/tickets/${ticket.id}`, <Route path="/tickets/:id" element={<TicketDetailPage />} />);
    // No workflow editing, no other-agent assignee picker, reply disabled…
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Assigned agent" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reply" })).toBeDisabled();
    // …but a claim action that self-assigns via the update mutation.
    fireEvent.click(screen.getByRole("button", { name: "Assign to me" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ assignedAgentId: "agent-1" }));
  });

  it("gives an agent a My Tickets / Unassigned scope switcher (default My Tickets, no All)", () => {
    mocks.useAuth.mockReturnValue({ user: { id: "agent-1", name: "Agent", email: "agent@example.com", role: "AGENT" } });
    renderAt("/tickets", <Route path="/tickets" element={<TicketListPage />} />);
    const tablist = screen.getByRole("tablist", { name: "Ticket scope" });
    expect(within(tablist).getByRole("tab", { name: "My Tickets" })).toHaveAttribute("aria-selected", "true");
    expect(within(tablist).getByRole("tab", { name: "Unassigned" })).toHaveAttribute("aria-selected", "false");
    expect(within(tablist).queryByRole("tab", { name: /all/i })).not.toBeInTheDocument();
    // Default scope is sent to the backend as "mine".
    expect(mocks.useTickets).toHaveBeenLastCalledWith(expect.objectContaining({ scope: "mine" }));
  });

  it("switches an agent list to the Unassigned scope from the URL", () => {
    mocks.useAuth.mockReturnValue({ user: { id: "agent-1", name: "Agent", email: "agent@example.com", role: "AGENT" } });
    renderAt("/tickets?scope=unassigned", <Route path="/tickets" element={<TicketListPage />} />);
    expect(screen.getByRole("tab", { name: "Unassigned" })).toHaveAttribute("aria-selected", "true");
    expect(mocks.useTickets).toHaveBeenLastCalledWith(expect.objectContaining({ scope: "unassigned" }));
  });

  it("hides the scope switcher from admins but keeps the assignee filter", () => {
    renderAt("/tickets", <Route path="/tickets" element={<TicketListPage />} />);
    expect(screen.queryByRole("tablist", { name: "Ticket scope" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filter options" }));
    expect(within(screen.getByRole("dialog", { name: "Filters" })).getByText("Assigned agent")).toBeInTheDocument();
  });

  it("does not offer the assignee filter to an agent", () => {
    mocks.useAuth.mockReturnValue({ user: { id: "agent-1", name: "Agent", email: "agent@example.com", role: "AGENT" } });
    renderAt("/tickets", <Route path="/tickets" element={<TicketListPage />} />);
    fireEvent.click(screen.getByRole("button", { name: "Filter options" }));
    expect(within(screen.getByRole("dialog", { name: "Filters" })).queryByText("Assigned agent")).not.toBeInTheDocument();
  });

  it("contains long subject and customer values in separate accessible cells", () => {
    const longSubject = "A".repeat(250); const longEmail = `${"customer".repeat(20)}@example.com`;
    mocks.useTickets.mockReturnValue({ isLoading: false, isError: false, data: { data: [{ ...listTicket, subject: longSubject, customer: { ...listTicket.customer, name: "Long customer name ".repeat(10), email: longEmail } }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, refetch: mocks.refetch });
    renderAt("/tickets", <Route path="/tickets" element={<TicketListPage />} />);
    const table = screen.getByRole("table"); const subjectLink = within(table).getByRole("link", { name: longSubject }); expect(subjectLink.closest("td")).not.toBe(within(table).getByText(longEmail).closest("td")); expect(subjectLink).toHaveAttribute("title", longSubject); expect(within(table).getByText(longEmail).closest("bdi")).toHaveAttribute("dir", "ltr");
  });

  it("renders representative ticket UI in Arabic", async () => {
    await changeAppLanguage("ar"); mocks.useTickets.mockReturnValue({ isLoading: false, isError: false, data: { data: [listTicket], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, refetch: mocks.refetch });
    renderAt("/tickets", <Route path="/tickets" element={<TicketListPage />} />);
    expect(screen.getByRole("heading", { name: "التذاكر" })).toBeInTheDocument(); expect(within(screen.getByRole("table")).getByRole("columnheader", { name: "العميل" })).toBeInTheDocument(); expect(screen.getAllByText("قيد التنفيذ").length).toBeGreaterThan(0);
  });

  it("localizes filtered-empty messaging in Arabic", async () => {
    await changeAppLanguage("ar");
    renderAt("/tickets?status=WAITING_CUSTOMER", <Route path="/tickets" element={<TicketListPage />} />);
    expect(screen.getAllByText("لا توجد تذاكر بالحالة «بانتظار العميل».")).toHaveLength(2);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

function renderAt(path: string, routes: React.ReactNode) { return render(<MemoryRouter initialEntries={[path]}><Routes>{routes}</Routes></MemoryRouter>); }
