import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  useMentionableUsers: vi.fn(),
  useWatchTicket: vi.fn(),
  useUnwatchTicket: vi.fn(),
  watch: vi.fn(),
  unwatch: vi.fn(),
}));

vi.mock("./collaboration-hooks", () => ({
  useMentionableUsers: mocks.useMentionableUsers,
  useTicketWatchers: vi.fn(),
  useWatchTicket: mocks.useWatchTicket,
  useUnwatchTicket: mocks.useUnwatchTicket,
}));

import { MentionTextarea } from "./mention-textarea";
import { renderMentions } from "./render-mentions";
import { WatchToggle } from "./watch-toggle";

const USERS = [
  { id: "usr_1", name: "Ahmed Hassan", email: "ahmed@example.com" },
  { id: "usr_2", name: "Mona Ali", email: "mona@example.com" },
];

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(async () => {
  await changeAppLanguage("en");
  vi.clearAllMocks();
  mocks.useMentionableUsers.mockReturnValue({ data: USERS, isLoading: false, isError: false });
  mocks.watch.mockResolvedValue({ watching: true, watcherCount: 1 });
  mocks.unwatch.mockResolvedValue({ watching: false, watcherCount: 0 });
  mocks.useWatchTicket.mockReturnValue({ mutateAsync: mocks.watch, isPending: false });
  mocks.useUnwatchTicket.mockReturnValue({ mutateAsync: mocks.unwatch, isPending: false });
});
afterEach(cleanup);

// ---------------------------------------------------------------------------
// renderMentions
// ---------------------------------------------------------------------------
describe("renderMentions", () => {
  it("renders @[Name](id) as @Name and never shows the id", () => {
    render(<div data-testid="body">{renderMentions("Please check @[Ahmed Hassan](usr_123) now")}</div>);
    const body = screen.getByTestId("body");
    expect(body).toHaveTextContent("Please check @Ahmed Hassan now");
    expect(body.textContent).not.toContain("usr_123");
    expect(body.querySelector("[data-mention]")).toHaveTextContent("@Ahmed Hassan");
  });

  it("passes plain text through unchanged", () => {
    render(<div data-testid="b">{renderMentions("just a normal note")}</div>);
    expect(screen.getByTestId("b")).toHaveTextContent("just a normal note");
  });
});

// ---------------------------------------------------------------------------
// MentionTextarea
// ---------------------------------------------------------------------------
function ControlledMention() {
  const [value, setValue] = useState("");
  return (
    <>
      <label htmlFor="note">Internal note</label>
      <MentionTextarea id="note" value={value} onChange={setValue} className="input" />
      <output data-testid="value">{value}</output>
    </>
  );
}

const field = () => screen.getByLabelText("Internal note") as HTMLTextAreaElement;
async function typeMention() {
  const el = field();
  fireEvent.change(el, { target: { value: "hey @ah", selectionStart: 7 } });
  return waitFor(() => expect(screen.getByRole("listbox", { name: "People you can mention" })).toBeInTheDocument());
}

describe("MentionTextarea", () => {
  it("opens the picker when an @token is typed and lists results", async () => {
    wrap(<ControlledMention />);
    await typeMention();
    expect(screen.getByRole("option", { name: /Ahmed Hassan/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Mona Ali/ })).toBeInTheDocument();
  });

  it("inserts @[Name](id) on Enter and closes the picker", async () => {
    wrap(<ControlledMention />);
    await typeMention();
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(screen.getByTestId("value")).toHaveTextContent("hey @[Ahmed Hassan](usr_1)");
    expect(screen.queryByRole("listbox", { name: "People you can mention" })).not.toBeInTheDocument();
  });

  it("navigates results with ArrowDown before selecting", async () => {
    wrap(<ControlledMention />);
    await typeMention();
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(screen.getByTestId("value")).toHaveTextContent("hey @[Mona Ali](usr_2)");
  });

  it("selects a result with the mouse", async () => {
    wrap(<ControlledMention />);
    await typeMention();
    fireEvent.click(screen.getByRole("option", { name: /Mona Ali/ }));
    expect(screen.getByTestId("value")).toHaveTextContent("@[Mona Ali](usr_2)");
  });

  it("closes on Escape without inserting", async () => {
    wrap(<ControlledMention />);
    await typeMention();
    fireEvent.keyDown(field(), { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("listbox", { name: "People you can mention" })).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("value")).toHaveTextContent("hey @ah");
  });

  it("shows a no-results state", async () => {
    mocks.useMentionableUsers.mockReturnValue({ data: [], isLoading: false, isError: false });
    wrap(<ControlledMention />);
    await typeMention();
    expect(screen.getByText("No matching people")).toBeInTheDocument();
  });

  it("shows a loading state", async () => {
    mocks.useMentionableUsers.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    wrap(<ControlledMention />);
    await typeMention();
    expect(screen.getByText("Searching people…")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// WatchToggle
// ---------------------------------------------------------------------------
describe("WatchToggle", () => {
  it("renders the Follow state with the watcher count", () => {
    wrap(<WatchToggle ticketId="t1" watching={false} watcherCount={2} />);
    expect(screen.getByRole("button", { name: "Follow" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("2 following")).toBeInTheDocument();
  });

  it("renders the Following state when the viewer watches", () => {
    wrap(<WatchToggle ticketId="t1" watching watcherCount={1} />);
    expect(screen.getByRole("button", { name: "Following" })).toHaveAttribute("aria-pressed", "true");
  });

  it("calls watch when following and unwatch when already following", async () => {
    const { rerender } = wrap(<WatchToggle ticketId="t1" watching={false} watcherCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    await waitFor(() => expect(mocks.watch).toHaveBeenCalledTimes(1));

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <WatchToggle ticketId="t1" watching watcherCount={1} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Following" }));
    await waitFor(() => expect(mocks.unwatch).toHaveBeenCalledTimes(1));
  });

  it("disables the button while a mutation is pending", () => {
    mocks.useWatchTicket.mockReturnValue({ mutateAsync: mocks.watch, isPending: true });
    wrap(<WatchToggle ticketId="t1" watching={false} watcherCount={0} />);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("surfaces an error when the mutation rejects", async () => {
    mocks.watch.mockRejectedValueOnce(new Error("boom"));
    wrap(<WatchToggle ticketId="t1" watching={false} watcherCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not update your follow status. Try again.");
  });
});
