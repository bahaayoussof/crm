import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  requestTicketSummary: vi.fn(),
  requestTicketSuggestedReply: vi.fn(),
  requestTicketClassification: vi.fn(),
  requestTicketKbSuggestions: vi.fn(),
}));
vi.mock("./ai-assistant-api", () => ({
  requestTicketSummary: mocks.requestTicketSummary,
  requestTicketSuggestedReply: mocks.requestTicketSuggestedReply,
  requestTicketClassification: mocks.requestTicketClassification,
  requestTicketKbSuggestions: mocks.requestTicketKbSuggestions,
}));

import { useState } from "react";
import { AiAssistantPanel } from "./ai-assistant-panel";
import type { CategoryApplyApi, ReplyInsertionApi } from "./ai-assistant.types";

const SUMMARY = {
  action: "SUMMARY" as const,
  promptVersion: "v1",
  result: {
    issue: "Reset links expire immediately after generation.",
    timeline: ["Customer reported the failure.", "Two fresh links expired on click."],
    currentState: "Awaiting technical investigation.",
    recommendedNextAction: "Check the reset-token TTL configuration.",
  },
};

/** An error shaped like an Axios error carrying a structured backend code. */
const apiError = (code: string) =>
  Object.assign(new Error(code), {
    isAxiosError: true,
    response: { status: 500, data: { error: { code, message: "OpenRouter said something raw" } } },
  });

const REPLY = { action: "SUGGEST_REPLY" as const, promptVersion: "v1", result: { reply: "Thanks for the details — we are checking the reset-token settings now." } };

const CLASSIFY = {
  action: "CLASSIFY" as const,
  promptVersion: "v1",
  result: { categoryId: "cat-auth", categoryName: "Authentication", confidence: 0.91, reason: "The ticket concerns password reset links." },
};

const KB = {
  action: "KB_SUGGESTIONS" as const,
  promptVersion: "v1",
  result: {
    articles: [
      { id: "kb-1", title: "Password Reset Troubleshooting", excerpt: "Steps for expired links", relevance: 0.92, reason: "Directly covers expired reset links." },
      { id: "kb-2", title: "Login Troubleshooting Checklist", excerpt: "Common auth failures", relevance: 0.5, reason: "Covers common authentication failures." },
    ],
  },
};

function makeReplyInsertion(overrides: Partial<ReplyInsertionApi> = {}): ReplyInsertionApi {
  return {
    hasReplyText: vi.fn(() => false),
    insertSuggestedReply: vi.fn(() => "inserted" as const),
    ...overrides,
  };
}

function makeCategoryApply(): CategoryApplyApi & { apply: ReturnType<typeof vi.fn> } {
  return { apply: vi.fn().mockResolvedValue({}) };
}

function renderPanel(
  replyInsertion?: ReplyInsertionApi,
  extra: {
    currentCategoryId?: string | null;
    categoryApply?: CategoryApplyApi;
    /** Leave the drawer closed (for launcher-only assertions). Defaults to open. */
    openDrawer?: boolean;
  } = {},
) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  // The panel is controlled by the page (header "AI Assistant" button). This
  // harness stands in for that trigger.
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open AI
        </button>
        <AiAssistantPanel
          open={open}
          onClose={() => setOpen(false)}
          ticketId="ticket-1"
          replyInsertion={replyInsertion}
          currentCategoryId={extra.currentCategoryId}
          categoryApply={extra.categoryApply}
        />
      </>
    );
  }
  const utils = render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  // Open the drawer so the existing action assertions operate on the workspace.
  if (extra.openDrawer !== false) fireEvent.click(screen.getByRole("button", { name: "Open AI" }));
  return { ...utils, invalidateSpy };
}

beforeEach(async () => {
  await changeAppLanguage("en");
  vi.clearAllMocks();
  mocks.requestTicketSummary.mockResolvedValue(SUMMARY);
  mocks.requestTicketSuggestedReply.mockResolvedValue(REPLY);
  mocks.requestTicketClassification.mockResolvedValue(CLASSIFY);
  mocks.requestTicketKbSuggestions.mockResolvedValue(KB);
});
afterEach(cleanup);

describe("AiAssistantPanel", () => {
  it("renders the AI Assistant workspace with a Summarize action once opened", () => {
    renderPanel();
    const dialog = screen.getByRole("dialog", { name: "AI Assistant" });
    expect(within(dialog).getByRole("button", { name: "Summarize Ticket" })).toBeInTheDocument();
  });

  it("makes no AI request on mount or when the drawer opens", () => {
    renderPanel();
    expect(mocks.requestTicketSummary).not.toHaveBeenCalled();
    expect(mocks.requestTicketSuggestedReply).not.toHaveBeenCalled();
    expect(mocks.requestTicketClassification).not.toHaveBeenCalled();
    expect(mocks.requestTicketKbSuggestions).not.toHaveBeenCalled();
  });

  it("sends exactly one SUMMARY request when Summarize is clicked", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Summarize Ticket" }));
    await waitFor(() => expect(screen.getByText("AI Summary")).toBeInTheDocument());
    expect(mocks.requestTicketSummary).toHaveBeenCalledTimes(1);
    expect(mocks.requestTicketSummary).toHaveBeenCalledWith("ticket-1", "en");
  });

  it("shows a loading state and blocks duplicate requests while pending", async () => {
    mocks.requestTicketSummary.mockReturnValue(new Promise(() => {}));
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Summarize Ticket" }));
    expect(await screen.findByText("Summarizing ticket…")).toBeInTheDocument();
    // the trigger is gone while pending, so it cannot be clicked again
    expect(screen.queryByRole("button", { name: "Summarize Ticket" })).not.toBeInTheDocument();
    expect(mocks.requestTicketSummary).toHaveBeenCalledTimes(1);
  });

  it("renders the structured summary, not raw JSON", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Summarize Ticket" }));
    await screen.findByText("AI Summary");
    expect(screen.getByText("Issue")).toBeInTheDocument();
    expect(screen.getByText(SUMMARY.result.issue)).toBeInTheDocument();
    expect(screen.getByText("Customer reported the failure.")).toBeInTheDocument();
    expect(screen.getByText("Two fresh links expired on click.")).toBeInTheDocument();
    expect(screen.getByText(SUMMARY.result.currentState)).toBeInTheDocument();
    expect(screen.getByText(SUMMARY.result.recommendedNextAction)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('"issue":');
  });

  it("re-runs SUMMARY when Regenerate is clicked", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Summarize Ticket" }));
    await screen.findByText("AI Summary");
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    await waitFor(() => expect(mocks.requestTicketSummary).toHaveBeenCalledTimes(2));
  });

  it("never writes the summary into any query cache", async () => {
    const { invalidateSpy } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Summarize Ticket" }));
    await screen.findByText("AI Summary");
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("shows a safe localized error and a Retry action, never raw provider text", async () => {
    mocks.requestTicketSummary.mockRejectedValue(apiError("AI_GENERATION_FAILED"));
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Summarize Ticket" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The AI request could not be completed. Try again.");
    expect(document.body.textContent).not.toContain("OpenRouter");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders a dedicated unavailable state for AI_NOT_CONFIGURED", async () => {
    mocks.requestTicketSummary.mockRejectedValue(apiError("AI_NOT_CONFIGURED"));
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Summarize Ticket" }));
    expect(await screen.findByText("AI assistant unavailable")).toBeInTheDocument();
    expect(screen.getByText("AI features are not configured for this workspace.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("handles RATE_LIMITED with a clear message", async () => {
    mocks.requestTicketSummary.mockRejectedValue(apiError("RATE_LIMITED"));
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Summarize Ticket" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Too many AI requests. Wait a few minutes and try again.");
  });

  it("shows a retryable message for AI_PROVIDER_RATE_LIMITED", async () => {
    mocks.requestTicketSummary.mockRejectedValue(apiError("AI_PROVIDER_RATE_LIMITED"));
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Summarize Ticket" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The AI provider is temporarily busy. Please try again shortly.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("falls back to a generic message for an unknown/network failure", async () => {
    mocks.requestTicketSummary.mockRejectedValue(new Error("network down"));
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Summarize Ticket" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong. Try again.");
  });

  it("requests an Arabic summary when the app language is Arabic", async () => {
    await changeAppLanguage("ar");
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "تلخيص التذكرة" }));
    await waitFor(() => expect(mocks.requestTicketSummary).toHaveBeenCalledWith("ticket-1", "ar"));
    await changeAppLanguage("en");
  });

  it("makes no Suggested Reply request on mount", () => {
    renderPanel(makeReplyInsertion());
    expect(mocks.requestTicketSuggestedReply).not.toHaveBeenCalled();
  });
});

describe("AiAssistantPanel — controlled drawer", () => {
  it("renders no dialog and no AI actions while closed", () => {
    renderPanel(makeReplyInsertion(), { categoryApply: makeCategoryApply(), openDrawer: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    for (const name of ["Summarize Ticket", "Suggest Reply", "Suggest Category", "Find Solution"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("opens when the page trigger fires and closes with the Close control", () => {
    renderPanel(makeReplyInsertion(), { openDrawer: false });
    fireEvent.click(screen.getByRole("button", { name: "Open AI" }));
    const dialog = screen.getByRole("dialog", { name: "AI Assistant" });
    expect(within(dialog).getByRole("button", { name: "Summarize Ticket" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close AI Assistant" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the workspace on Escape", () => {
    renderPanel();
    const dialog = screen.getByRole("dialog", { name: "AI Assistant" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps generated results when the drawer is closed and reopened", async () => {
    renderPanel(makeReplyInsertion());
    fireEvent.click(screen.getByRole("button", { name: "Summarize Ticket" }));
    await screen.findByText("AI Summary");
    expect(screen.getByText(SUMMARY.result.issue)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close AI Assistant" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open AI" }));
    // Result is still there — no re-request needed.
    expect(screen.getByText("AI Summary")).toBeInTheDocument();
    expect(screen.getByText(SUMMARY.result.issue)).toBeInTheDocument();
    expect(mocks.requestTicketSummary).toHaveBeenCalledTimes(1);
  });
});

describe("AiAssistantPanel — action grid", () => {
  it("renders the four actions as a 2-column card grid with descriptions", () => {
    renderPanel(makeReplyInsertion(), { categoryApply: makeCategoryApply() });
    const dialog = screen.getByRole("dialog", { name: "AI Assistant" });
    for (const name of ["Summarize Ticket", "Suggest Reply", "Suggest Category", "Find Solution"]) {
      expect(within(dialog).getByRole("button", { name })).toBeInTheDocument();
    }
    for (const text of [
      "Get a quick overview of the conversation.",
      "Draft a customer-facing response.",
      "Recommend the best ticket category.",
      "Find relevant Knowledge Base articles.",
    ]) {
      expect(within(dialog).getByText(text)).toBeInTheDocument();
    }
    const grid = within(dialog)
      .getByText("Get a quick overview of the conversation.")
      .closest("div.grid");
    expect(grid).toHaveClass("sm:grid-cols-2");
  });

  it("keeps the other action cards usable while one action is pending", async () => {
    mocks.requestTicketSummary.mockReturnValue(new Promise(() => {}));
    renderPanel(makeReplyInsertion(), { categoryApply: makeCategoryApply() });
    fireEvent.click(screen.getByRole("button", { name: "Summarize Ticket" }));
    expect(await screen.findByText("Summarizing ticket…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Summarizing ticket…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Suggest Reply" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Find Solution" })).toBeEnabled();
  });
});

describe("AiAssistantPanel — Suggested Reply", () => {
  const generate = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Suggest Reply" }));
    await screen.findByText("Suggested Reply");
  };

  it("shows the Suggest Reply action", () => {
    renderPanel(makeReplyInsertion());
    expect(screen.getByRole("button", { name: "Suggest Reply" })).toBeInTheDocument();
  });

  it("sends exactly one SUGGEST_REPLY request and blocks duplicates while pending", async () => {
    mocks.requestTicketSuggestedReply.mockReturnValue(new Promise(() => {}));
    renderPanel(makeReplyInsertion());
    fireEvent.click(screen.getByRole("button", { name: "Suggest Reply" }));
    expect(await screen.findByText("Generating reply…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suggest Reply" })).not.toBeInTheDocument();
    expect(mocks.requestTicketSuggestedReply).toHaveBeenCalledTimes(1);
  });

  it("renders the draft reply text, not raw JSON", async () => {
    renderPanel(makeReplyInsertion());
    await generate();
    expect(screen.getByText(REPLY.result.reply)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('"reply":');
  });

  it("Regenerate sends another request and does not touch the composer", async () => {
    const insertion = makeReplyInsertion();
    renderPanel(insertion);
    await generate();
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    await waitFor(() => expect(mocks.requestTicketSuggestedReply).toHaveBeenCalledTimes(2));
    expect(insertion.insertSuggestedReply).not.toHaveBeenCalled();
  });

  it("inserts directly at the cursor when the composer is empty", async () => {
    const insertion = makeReplyInsertion({ hasReplyText: vi.fn(() => false) });
    renderPanel(insertion);
    await generate();
    fireEvent.click(screen.getByRole("button", { name: "Insert into Reply" }));
    expect(insertion.insertSuggestedReply).toHaveBeenCalledTimes(1);
    expect(insertion.insertSuggestedReply).toHaveBeenCalledWith(REPLY.result.reply, "cursor");
    expect(screen.queryByText("Existing reply text detected.")).not.toBeInTheDocument();
  });

  it("prompts for a choice when the composer already has text; Cancel changes nothing", async () => {
    const insertion = makeReplyInsertion({ hasReplyText: vi.fn(() => true) });
    renderPanel(insertion);
    await generate();
    fireEvent.click(screen.getByRole("button", { name: "Insert into Reply" }));
    expect(screen.getByText("Existing reply text detected.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Existing reply text detected.")).not.toBeInTheDocument();
    expect(insertion.insertSuggestedReply).not.toHaveBeenCalled();
  });

  it("Insert at cursor uses the caret-aware mode", async () => {
    const insertion = makeReplyInsertion({ hasReplyText: vi.fn(() => true) });
    renderPanel(insertion);
    await generate();
    fireEvent.click(screen.getByRole("button", { name: "Insert into Reply" }));
    fireEvent.click(screen.getByRole("button", { name: "Insert at cursor" }));
    expect(insertion.insertSuggestedReply).toHaveBeenCalledWith(REPLY.result.reply, "cursor");
  });

  it("Replace reply requires the explicit Replace choice", async () => {
    const insertion = makeReplyInsertion({ hasReplyText: vi.fn(() => true) });
    renderPanel(insertion);
    await generate();
    fireEvent.click(screen.getByRole("button", { name: "Insert into Reply" }));
    fireEvent.click(screen.getByRole("button", { name: "Replace reply" }));
    expect(insertion.insertSuggestedReply).toHaveBeenCalledWith(REPLY.result.reply, "replace");
  });

  it("surfaces a too-long insertion as an alert and keeps the draft visible", async () => {
    const insertion = makeReplyInsertion({ insertSuggestedReply: vi.fn(() => "too-long" as const) });
    renderPanel(insertion);
    await generate();
    fireEvent.click(screen.getByRole("button", { name: "Insert into Reply" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The draft would make the reply too long. Nothing was inserted.");
    expect(screen.getByText(REPLY.result.reply)).toBeInTheDocument();
  });

  it("never invalidates any query when generating or inserting", async () => {
    const insertion = makeReplyInsertion();
    const { invalidateSpy } = renderPanel(insertion);
    await generate();
    fireEvent.click(screen.getByRole("button", { name: "Insert into Reply" }));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("hides Insert into Reply when no composer bridge is available", async () => {
    renderPanel(); // no replyInsertion (read-only / unassigned agent)
    await generate();
    expect(screen.queryByRole("button", { name: "Insert into Reply" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
  });

  it("keeps a successful Summary intact when Suggested Reply errors", async () => {
    mocks.requestTicketSuggestedReply.mockRejectedValue(apiError("AI_GENERATION_FAILED"));
    renderPanel(makeReplyInsertion());
    fireEvent.click(screen.getByRole("button", { name: "Summarize Ticket" }));
    await screen.findByText("AI Summary");
    fireEvent.click(screen.getByRole("button", { name: "Suggest Reply" }));
    await screen.findByRole("alert");
    expect(screen.getByText("AI Summary")).toBeInTheDocument();
    expect(screen.getByText(SUMMARY.result.issue)).toBeInTheDocument();
  });

  it("shows the unavailable panel when Suggested Reply hits AI_NOT_CONFIGURED", async () => {
    mocks.requestTicketSuggestedReply.mockRejectedValue(apiError("AI_NOT_CONFIGURED"));
    renderPanel(makeReplyInsertion());
    fireEvent.click(screen.getByRole("button", { name: "Suggest Reply" }));
    expect(await screen.findByText("AI assistant unavailable")).toBeInTheDocument();
  });
});

describe("AiAssistantPanel — Suggested Category", () => {
  const generate = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Suggest Category" }));
    await screen.findByText("Suggested Category");
  };

  it("shows the Suggest Category action and makes no request on mount", () => {
    renderPanel(undefined, { categoryApply: makeCategoryApply() });
    expect(screen.getByRole("button", { name: "Suggest Category" })).toBeInTheDocument();
    expect(mocks.requestTicketClassification).not.toHaveBeenCalled();
  });

  it("sends exactly one CLASSIFY request and blocks duplicates while pending", async () => {
    mocks.requestTicketClassification.mockReturnValue(new Promise(() => {}));
    renderPanel(undefined, { categoryApply: makeCategoryApply() });
    fireEvent.click(screen.getByRole("button", { name: "Suggest Category" }));
    expect(await screen.findByText("Analyzing category…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suggest Category" })).not.toBeInTheDocument();
    expect(mocks.requestTicketClassification).toHaveBeenCalledTimes(1);
  });

  it("renders the structured suggestion with name, confidence label and reason", async () => {
    renderPanel(undefined, { categoryApply: makeCategoryApply() });
    await generate();
    expect(screen.getByText("Authentication")).toBeInTheDocument();
    expect(screen.getByText("Reason")).toBeInTheDocument();
    expect(screen.getByText(CLASSIFY.result.reason)).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText(/AI confidence/i, { exact: false })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("cat-auth");
    expect(document.body.textContent).not.toContain('"confidence":');
  });

  it.each([
    [0.9, "High"],
    [0.5, "Medium"],
    [0.2, "Low"],
  ])("maps confidence %s to %s", async (confidence, label) => {
    mocks.requestTicketClassification.mockResolvedValue({ ...CLASSIFY, result: { ...CLASSIFY.result, confidence } });
    renderPanel(undefined, { categoryApply: makeCategoryApply() });
    await generate();
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("Regenerate re-requests CLASSIFY and never applies the category", async () => {
    const categoryApply = makeCategoryApply();
    renderPanel(undefined, { categoryApply });
    await generate();
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    await waitFor(() => expect(mocks.requestTicketClassification).toHaveBeenCalledTimes(2));
    expect(categoryApply.apply).not.toHaveBeenCalled();
  });

  it("Apply Category calls the ticket-update pathway with { categoryId } only on an explicit click", async () => {
    const categoryApply = makeCategoryApply();
    const { invalidateSpy } = renderPanel(undefined, { categoryApply });
    await generate();
    expect(categoryApply.apply).not.toHaveBeenCalled(); // generation alone never applies
    fireEvent.click(screen.getByRole("button", { name: "Apply Category" }));
    await waitFor(() => expect(categoryApply.apply).toHaveBeenCalledWith("cat-auth"));
    expect(categoryApply.apply).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).not.toHaveBeenCalled(); // the AI mutation never invalidates
    expect(await screen.findByText("Category applied.")).toBeInTheDocument();
  });

  it("blocks a duplicate apply while the first is pending", async () => {
    const categoryApply = { apply: vi.fn(() => new Promise(() => {})) };
    renderPanel(undefined, { categoryApply });
    await generate();
    const button = screen.getByRole("button", { name: "Apply Category" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(categoryApply.apply).toHaveBeenCalledTimes(1);
  });

  it("keeps the suggestion visible and shows an alert when apply fails", async () => {
    const categoryApply = { apply: vi.fn().mockRejectedValue(new Error("network")) };
    renderPanel(undefined, { categoryApply });
    await generate();
    fireEvent.click(screen.getByRole("button", { name: "Apply Category" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not apply the category. Try again.");
    expect(screen.getByText("Authentication")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply Category" })).toBeInTheDocument();
  });

  it("hides Apply and shows a message when the suggestion is already the current category", async () => {
    renderPanel(undefined, { categoryApply: makeCategoryApply(), currentCategoryId: "cat-auth" });
    await generate();
    expect(screen.queryByRole("button", { name: "Apply Category" })).not.toBeInTheDocument();
    expect(screen.getByText("This ticket already uses the suggested category.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
  });

  it("hides Apply entirely when the user cannot change the category", async () => {
    renderPanel(undefined, {}); // no categoryApply
    await generate();
    expect(screen.queryByRole("button", { name: "Apply Category" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
  });

  it("renders a friendly non-retry state for AI_NO_CANDIDATES", async () => {
    mocks.requestTicketClassification.mockRejectedValue(apiError("AI_NO_CANDIDATES"));
    renderPanel(undefined, { categoryApply: makeCategoryApply() });
    fireEvent.click(screen.getByRole("button", { name: "Suggest Category" }));
    expect(
      await screen.findByText("No active categories are available for AI classification."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("a CLASSIFY error does not erase a rendered Summary or Suggested Reply", async () => {
    mocks.requestTicketClassification.mockRejectedValue(apiError("AI_GENERATION_FAILED"));
    renderPanel(makeReplyInsertion(), { categoryApply: makeCategoryApply() });
    fireEvent.click(screen.getByRole("button", { name: "Summarize Ticket" }));
    await screen.findByText("AI Summary");
    fireEvent.click(screen.getByRole("button", { name: "Suggest Reply" }));
    await screen.findByText("Suggested Reply");
    fireEvent.click(screen.getByRole("button", { name: "Suggest Category" }));
    await screen.findByRole("alert");
    expect(screen.getByText("AI Summary")).toBeInTheDocument();
    expect(screen.getByText(REPLY.result.reply)).toBeInTheDocument();
  });
});

describe("AiAssistantPanel — KB Suggestions", () => {
  const generate = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Find Solution" }));
    await screen.findByText("Suggested Solutions");
  };

  it("shows the Find Solution action and makes no request on mount", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Find Solution" })).toBeInTheDocument();
    expect(mocks.requestTicketKbSuggestions).not.toHaveBeenCalled();
  });

  it("sends exactly one KB_SUGGESTIONS request and blocks duplicates while pending", async () => {
    mocks.requestTicketKbSuggestions.mockReturnValue(new Promise(() => {}));
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Find Solution" }));
    expect(await screen.findByText("Finding solutions…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Find Solution" })).not.toBeInTheDocument();
    expect(mocks.requestTicketKbSuggestions).toHaveBeenCalledTimes(1);
  });

  it("renders the ranked articles in backend order with an Open Article link to the KB route", async () => {
    renderPanel();
    await generate();
    const titles = screen.getAllByText(/Troubleshooting/);
    expect(titles[0]).toHaveTextContent("Password Reset Troubleshooting");
    const links = screen.getAllByRole("link", { name: "Open Article" });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/knowledge-base/kb-1");
    expect(links[1]).toHaveAttribute("href", "/knowledge-base/kb-2");
    expect(document.body.textContent).not.toContain("kb-1");
    expect(document.body.textContent).not.toContain('"articles":');
  });

  it("shows a relevance label per article", async () => {
    renderPanel();
    await generate();
    expect(screen.getByText("High relevance")).toBeInTheDocument();
    expect(screen.getByText("Medium relevance")).toBeInTheDocument();
  });

  it("renders a normal empty state (not an error) when no articles match", async () => {
    mocks.requestTicketKbSuggestions.mockResolvedValue({ ...KB, result: { articles: [] } });
    renderPanel();
    await generate();
    expect(
      screen.getByText("No relevant Knowledge Base articles were found for this ticket."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
  });

  it("Regenerate re-requests KB and touches neither the composer nor the category", async () => {
    const replyInsertion = makeReplyInsertion();
    const categoryApply = makeCategoryApply();
    renderPanel(replyInsertion, { categoryApply });
    await generate();
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    await waitFor(() => expect(mocks.requestTicketKbSuggestions).toHaveBeenCalledTimes(2));
    expect(replyInsertion.insertSuggestedReply).not.toHaveBeenCalled();
    expect(categoryApply.apply).not.toHaveBeenCalled();
  });

  it("never invalidates any query on KB generation", async () => {
    const { invalidateSpy } = renderPanel();
    await generate();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("shows a safe error with Retry and keeps other AI results intact", async () => {
    mocks.requestTicketKbSuggestions.mockRejectedValue(apiError("AI_GENERATION_FAILED"));
    renderPanel(makeReplyInsertion(), { categoryApply: makeCategoryApply() });
    fireEvent.click(screen.getByRole("button", { name: "Summarize Ticket" }));
    await screen.findByText("AI Summary");
    fireEvent.click(screen.getByRole("button", { name: "Suggest Reply" }));
    await screen.findByText("Suggested Reply");
    fireEvent.click(screen.getByRole("button", { name: "Suggest Category" }));
    await screen.findByText("Suggested Category");
    fireEvent.click(screen.getByRole("button", { name: "Find Solution" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The AI request could not be completed. Try again.");
    expect(screen.getByText("AI Summary")).toBeInTheDocument();
    expect(screen.getByText(REPLY.result.reply)).toBeInTheDocument();
    expect(screen.getByText("Authentication")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows the unavailable panel when KB hits AI_NOT_CONFIGURED", async () => {
    mocks.requestTicketKbSuggestions.mockRejectedValue(apiError("AI_NOT_CONFIGURED"));
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Find Solution" }));
    expect(await screen.findByText("AI assistant unavailable")).toBeInTheDocument();
  });
});
