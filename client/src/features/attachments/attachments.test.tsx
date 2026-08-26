import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const axiosError = (code: string, status = 422) =>
  new AxiosError("request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data: { error: { code } },
    statusText: "",
    headers: {},
    config: {} as never,
  });

const api = vi.hoisted(() => ({
  getTicketAttachments: vi.fn(),
  getCustomerAttachments: vi.fn(),
  getPortalTicketAttachments: vi.fn(),
  uploadTicketAttachment: vi.fn(),
  uploadMessageAttachment: vi.fn(),
  uploadCustomerAttachment: vi.fn(),
  uploadPortalTicketAttachment: vi.fn(),
  downloadAttachment: vi.fn(),
  downloadPortalAttachment: vi.fn(),
}));
vi.mock("./attachment-api", () => api);

import { AttachmentPanel, AttachmentRows, MessageAttachmentList } from "./attachment-ui";
import {
  attachmentKeys,
  useUploadCustomerAttachment,
  useUploadPortalTicketAttachment,
  useUploadTicketAttachment,
} from "./attachment-hooks";

const MB = 1024 * 1024;
const file = (name = "diagram.png", type = "image/png", bytes = 12) => new File([new Uint8Array(bytes)], name, { type });

const items = [
  { id: "a1", fileName: "quarterly-report.pdf", mimeType: "application/pdf", createdAt: "2026-08-26T12:00:00.000Z" },
  { id: "a2", fileName: "شهادة الدفع.pdf", mimeType: "application/pdf", createdAt: "2026-08-26T13:00:00.000Z" },
];

function uploadStub(isPending = false) {
  return { mutateAsync: vi.fn().mockResolvedValue({}), isPending };
}

const panelProps = (over: Record<string, unknown> = {}) => ({
  attachments: items,
  isLoading: false,
  isError: false,
  onRetry: vi.fn(),
  scope: "internal" as const,
  locale: "en",
  canUpload: true,
  upload: uploadStub(),
  ...over,
});

beforeEach(async () => {
  await changeAppLanguage("en");
  vi.clearAllMocks();
  Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:mock"), configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(cleanup);

// ---------------------------------------------------------------------------
// Upload visibility (1-6)
// ---------------------------------------------------------------------------

describe("attachment upload visibility", () => {
  it("shows the upload control when canUpload is true (ADMIN/MANAGER/assigned AGENT)", () => {
    render(<AttachmentPanel {...panelProps()} />);
    expect(screen.getByLabelText("Select file")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload attachment" })).toBeInTheDocument();
  });

  it("shows a read-only disabled reason instead of the control for an unassigned AGENT", () => {
    render(
      <AttachmentPanel
        {...panelProps({ canUpload: false, upload: undefined, disabledReason: "This ticket must be assigned to you before you can upload an attachment." })}
      />,
    );
    expect(screen.queryByLabelText("Select file")).not.toBeInTheDocument();
    expect(screen.getByText(/must be assigned to you/)).toBeInTheDocument();
    // existing attachments still render for read/download
    expect(screen.getByText("quarterly-report.pdf")).toBeInTheDocument();
  });

  it("omits the upload control entirely when canUpload is false and no reason is given (AGENT on customer profile)", () => {
    render(<AttachmentPanel {...panelProps({ canUpload: false, upload: undefined })} />);
    expect(screen.queryByLabelText("Select file")).not.toBeInTheDocument();
    expect(screen.getByText("quarterly-report.pdf")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Rendering & containment (7-9)
// ---------------------------------------------------------------------------

describe("attachment list rendering", () => {
  it("renders existing attachments with type and date", () => {
    render(<AttachmentPanel {...panelProps()} />);
    expect(screen.getByText("quarterly-report.pdf")).toBeInTheDocument();
    expect(screen.getAllByText(/application\/pdf/).length).toBeGreaterThan(0);
  });

  it("keeps filenames contained with directional isolation", () => {
    const { container } = render(<AttachmentPanel {...panelProps()} />);
    const arabicName = screen.getByText("شهادة الدفع.pdf");
    expect(arabicName.tagName).toBe("BDI");
    expect(arabicName).toHaveAttribute("dir", "auto");
    expect(container.querySelector("p.truncate")).not.toBeNull();
  });

  it("shows the accepted types and the maximum size", () => {
    render(<AttachmentPanel {...panelProps()} />);
    expect(screen.getByText(/Accepted types/)).toBeInTheDocument();
    expect(screen.getByText(/Maximum size: 4 MiB/)).toBeInTheDocument();
  });

  it("shows a localized empty state", () => {
    render(<AttachmentPanel {...panelProps({ attachments: [] })} />);
    expect(screen.getByText("No attachments yet.")).toBeInTheDocument();
  });

  it("shows a retryable load error without dropping the panel", () => {
    render(<AttachmentPanel {...panelProps({ isError: true, attachments: undefined })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load attachments.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  });
});

// ---------------------------------------------------------------------------
// Client-side validation (10-11)
// ---------------------------------------------------------------------------

describe("attachment upload client validation", () => {
  it("rejects an unsupported file type before any request", () => {
    const upload = uploadStub();
    render(<AttachmentPanel {...panelProps({ upload })} />);
    fireEvent.change(screen.getByLabelText("Select file"), { target: { files: [file("tool.exe", "application/x-msdownload")] } });
    expect(screen.getByRole("alert")).toHaveTextContent("This file type is not allowed.");
    expect(screen.getByRole("button", { name: "Upload attachment" })).toBeDisabled();
    expect(upload.mutateAsync).not.toHaveBeenCalled();
  });

  it("rejects a file larger than 4 MiB before any request", () => {
    const upload = uploadStub();
    render(<AttachmentPanel {...panelProps({ upload })} />);
    fireEvent.change(screen.getByLabelText("Select file"), { target: { files: [file("big.pdf", "application/pdf", 4 * MB + 10)] } });
    expect(screen.getByRole("alert")).toHaveTextContent(/exceeds the maximum size/);
    expect(upload.mutateAsync).not.toHaveBeenCalled();
  });

  it("rejects an empty file", () => {
    render(<AttachmentPanel {...panelProps()} />);
    fireEvent.change(screen.getByLabelText("Select file"), { target: { files: [file("empty.txt", "text/plain", 0)] } });
    expect(screen.getByRole("alert")).toHaveTextContent("The file is empty.");
  });
});

// ---------------------------------------------------------------------------
// Upload flow (12-14)
// ---------------------------------------------------------------------------

describe("attachment upload flow", () => {
  it("prevents duplicate submissions while pending", () => {
    render(<AttachmentPanel {...panelProps({ upload: uploadStub(true) })} />);
    expect(screen.getByRole("button", { name: "Uploading…" })).toBeDisabled();
  });

  it("preserves the current list and shows a localized error on upload failure", async () => {
    const upload = { mutateAsync: vi.fn().mockRejectedValue(new Error("boom")), isPending: false };
    render(<AttachmentPanel {...panelProps({ upload })} />);
    fireEvent.change(screen.getByLabelText("Select file"), { target: { files: [file()] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload attachment" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Unable to upload the attachment."));
    expect(screen.getByText("quarterly-report.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("maps a backend INVALID_UPLOAD rejection to its localized string", async () => {
    const upload = { mutateAsync: vi.fn().mockRejectedValue(axiosError("INVALID_UPLOAD")), isPending: false };
    render(<AttachmentPanel {...panelProps({ upload })} />);
    fireEvent.change(screen.getByLabelText("Select file"), { target: { files: [file()] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload attachment" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("The upload must contain only the selected file. Try again."));
  });

  it("clears the selection and confirms success after a successful upload", async () => {
    const upload = uploadStub();
    render(<AttachmentPanel {...panelProps({ upload })} />);
    fireEvent.change(screen.getByLabelText("Select file"), { target: { files: [file()] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload attachment" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Attachment uploaded."));
    expect(upload.mutateAsync).toHaveBeenCalledTimes(1);
  });
});

describe("attachment mutation cache invalidation", () => {
  function harness() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    return { spy, wrapper };
  }

  it("invalidates only the ticket attachment query after a ticket upload", async () => {
    api.uploadTicketAttachment.mockResolvedValue({ id: "a3" });
    const { spy, wrapper } = harness();
    const { result } = renderHook(() => useUploadTicketAttachment("ticket-1"), { wrapper });
    await result.current.mutateAsync(file());
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: attachmentKeys.ticket("ticket-1") }));
    expect(spy.mock.calls.some(([arg]) => JSON.stringify((arg as { queryKey?: unknown }).queryKey) === JSON.stringify(["dashboard"]))).toBe(false);
  });

  it("invalidates the customer attachment query and the customer detail after a customer upload", async () => {
    api.uploadCustomerAttachment.mockResolvedValue({ id: "a3" });
    const { spy, wrapper } = harness();
    const { result } = renderHook(() => useUploadCustomerAttachment("cust-1"), { wrapper });
    await result.current.mutateAsync(file());
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: attachmentKeys.customer("cust-1") }));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["customers", "detail", "cust-1"] });
  });

  it("invalidates only the portal ticket attachment query after a portal upload (no ticket/overview refetch)", async () => {
    api.uploadPortalTicketAttachment.mockResolvedValue({ id: "a3" });
    const { spy, wrapper } = harness();
    const { result } = renderHook(() => useUploadPortalTicketAttachment("ticket-1"), { wrapper });
    await result.current.mutateAsync(file());
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: attachmentKeys.portalTicket("ticket-1") }));
    expect(spy.mock.calls.some(([arg]) => JSON.stringify((arg as { queryKey?: unknown }).queryKey) === JSON.stringify(["portal", "overview"]))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Download (15-17)
// ---------------------------------------------------------------------------

describe("attachment download", () => {
  it("uses the authenticated API request and revokes the object URL", async () => {
    api.downloadAttachment.mockResolvedValue({ blob: new Blob(["x"]), fileName: "quarterly-report.pdf" });
    render(<AttachmentRows attachments={items} scope="internal" locale="en" />);
    fireEvent.click(within(screen.getByText("quarterly-report.pdf").closest("li")!).getByRole("button", { name: "Download attachment" }));
    await waitFor(() => expect(api.downloadAttachment).toHaveBeenCalledWith("a1", "quarterly-report.pdf"));
    expect(URL.createObjectURL).toHaveBeenCalled();
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock"));
  });

  it("uses the portal endpoint when scope is portal", async () => {
    api.downloadPortalAttachment.mockResolvedValue({ blob: new Blob(["x"]), fileName: "f.pdf" });
    render(<AttachmentRows attachments={[items[0]!]} scope="portal" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Download attachment" }));
    await waitFor(() => expect(api.downloadPortalAttachment).toHaveBeenCalled());
    expect(api.downloadAttachment).not.toHaveBeenCalled();
  });

  it("prevents duplicate pending downloads (icon button disables while pending)", async () => {
    let resolve!: (v: unknown) => void;
    api.downloadAttachment.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<AttachmentRows attachments={[items[0]!]} scope="internal" locale="en" />);
    const button = screen.getByRole("button", { name: "Download attachment" });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    fireEvent.click(button);
    expect(api.downloadAttachment).toHaveBeenCalledTimes(1);
    resolve({ blob: new Blob(["x"]), fileName: "f.pdf" });
  });

  it("shows a localized error when the download fails", async () => {
    api.downloadAttachment.mockRejectedValue(new Error("network"));
    render(<AttachmentRows attachments={[items[0]!]} scope="internal" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Download attachment" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Unable to download the attachment."));
  });
});

// ---------------------------------------------------------------------------
// Message attachments (18)
// ---------------------------------------------------------------------------

describe("message attachments", () => {
  it("renders the filename plus Preview + Download icon actions, and nothing when empty", () => {
    const { rerender, container } = render(<MessageAttachmentList attachments={[items[0]!]} scope="internal" />);
    expect(screen.getByText("quarterly-report.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview attachment" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download attachment" })).toBeInTheDocument();
    expect(screen.queryByText("Download attachment")).not.toBeInTheDocument(); // icon-only, no visible text
    rerender(<MessageAttachmentList attachments={[]} scope="internal" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("message-attachment Preview downloads through the authenticated API and renders an image blob", async () => {
    api.downloadAttachment.mockResolvedValue({ blob: new Blob([new Uint8Array(2)], { type: "image/png" }), fileName: "shot.png" });
    render(<MessageAttachmentList attachments={[{ ...items[0]!, mimeType: "image/png", fileName: "shot.png" }]} scope="internal" />);
    fireEvent.click(screen.getByRole("button", { name: "Preview attachment" }));
    await waitFor(() => expect(api.downloadAttachment).toHaveBeenCalled());
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByRole("img")).toHaveAttribute("src", "blob:mock");
  });
});

// ---------------------------------------------------------------------------
// Preview action & dialog
// ---------------------------------------------------------------------------

describe("attachment preview", () => {
  const row = (over: Partial<{ id: string; fileName: string; mimeType: string; createdAt: string }> = {}) =>
    [{ id: "p1", fileName: "diagram.png", mimeType: "image/png", createdAt: items[0]!.createdAt, ...over }];

  it("the normal row shows no visible Download text but keeps the localized accessible name and title", () => {
    render(<AttachmentRows attachments={items} scope="internal" locale="en" />);
    expect(screen.queryByText("Download attachment")).not.toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Download attachment" });
    expect(buttons[0]).toHaveAttribute("title", "Download attachment");
    expect(screen.getAllByRole("button", { name: "Preview attachment" })[0]).toHaveAttribute("title", "Preview attachment");
  });

  it("decorative SVG icons are hidden from assistive technology", () => {
    const { container } = render(<AttachmentRows attachments={row()} scope="internal" locale="en" />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    svgs.forEach((svg) => expect(svg).toHaveAttribute("aria-hidden", "true"));
  });

  it("image Preview requests the authenticated Blob and shows it via an object URL", async () => {
    api.downloadAttachment.mockResolvedValue({ blob: new Blob([new Uint8Array(3)], { type: "image/png" }), fileName: "diagram.png" });
    render(<AttachmentRows attachments={row()} scope="internal" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Preview attachment" }));
    await waitFor(() => expect(api.downloadAttachment).toHaveBeenCalledWith("p1", "diagram.png"));
    const dialog = await screen.findByRole("dialog");
    const img = within(dialog).getByRole("img");
    expect(img).toHaveAttribute("src", "blob:mock");
    expect(img).toHaveAttribute("alt", "diagram.png");
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("PDF Preview embeds the authenticated Blob URL with a localized fallback note", async () => {
    api.downloadAttachment.mockResolvedValue({ blob: new Blob([new Uint8Array(3)], { type: "application/pdf" }), fileName: "report.pdf" });
    render(<AttachmentRows attachments={row({ fileName: "report.pdf", mimeType: "application/pdf" })} scope="internal" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Preview attachment" }));
    const dialog = await screen.findByRole("dialog");
    const frame = dialog.querySelector("iframe");
    expect(frame).toHaveAttribute("src", "blob:mock");
    expect(frame).toHaveAttribute("title", "report.pdf");
    expect(within(dialog).getByText(/If the PDF does not appear/)).toBeInTheDocument();
  });

  it("text Preview renders escaped plain text and never as HTML", async () => {
    api.downloadAttachment.mockResolvedValue({
      blob: new Blob(["line one\n<b>not bold</b> & <script>x</script>"], { type: "text/plain" }),
      fileName: "notes.txt",
    });
    render(<AttachmentRows attachments={row({ fileName: "notes.txt", mimeType: "text/plain" })} scope="internal" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Preview attachment" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.querySelector("pre")).not.toBeNull());
    const pre = dialog.querySelector("pre")!;
    expect(pre.textContent).toContain("<b>not bold</b>");
    expect(pre.querySelector("b")).toBeNull();
    expect(pre.querySelector("script")).toBeNull();
  });

  it("unsupported MIME shows a localized Preview-unavailable state with Download still available", async () => {
    api.downloadAttachment.mockResolvedValue({ blob: new Blob([new Uint8Array(3)], { type: "application/zip" }), fileName: "bundle.zip" });
    render(<AttachmentRows attachments={row({ fileName: "bundle.zip", mimeType: "application/zip" })} scope="internal" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Preview attachment" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Preview unavailable for this file type.")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: /download/i }).length).toBeGreaterThan(0);
  });

  it("Preview failure shows a localized error and Retry without closing the dialog", async () => {
    api.downloadAttachment.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ blob: new Blob([new Uint8Array(3)], { type: "image/png" }), fileName: "diagram.png" });
    render(<AttachmentRows attachments={row()} scope="internal" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Preview attachment" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("Unable to load the preview."));
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry preview" }));
    await waitFor(() => expect(within(dialog).getByRole("img")).toHaveAttribute("src", "blob:mock"));
    expect(screen.getByRole("dialog")).toBeInTheDocument(); // never auto-closed
  });

  it("Preview does not trigger a download", async () => {
    api.downloadAttachment.mockResolvedValue({ blob: new Blob([new Uint8Array(3)], { type: "image/png" }), fileName: "diagram.png" });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");
    render(<AttachmentRows attachments={row()} scope="internal" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Preview attachment" }));
    await screen.findByRole("dialog");
    expect(clickSpy).not.toHaveBeenCalled(); // no <a download> synthesized
  });

  it("Download stays available inside the preview dialog and uses the authenticated request", async () => {
    api.downloadAttachment.mockResolvedValue({ blob: new Blob([new Uint8Array(3)], { type: "image/png" }), fileName: "diagram.png" });
    render(<AttachmentRows attachments={row()} scope="internal" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Preview attachment" }));
    const dialog = await screen.findByRole("dialog");
    api.downloadAttachment.mockClear();
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Download attachment" })[0]!);
    await waitFor(() => expect(api.downloadAttachment).toHaveBeenCalledWith("p1", "diagram.png"));
  });

  it("closing the dialog revokes the object URL and returns focus to the Preview button", async () => {
    api.downloadAttachment.mockResolvedValue({ blob: new Blob([new Uint8Array(3)], { type: "image/png" }), fileName: "diagram.png" });
    render(<AttachmentRows attachments={row()} scope="internal" locale="en" />);
    const trigger = screen.getByRole("button", { name: "Preview attachment" });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close preview" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    expect(document.activeElement).toBe(trigger);
  });

  it("Escape closes the dialog", async () => {
    api.downloadAttachment.mockResolvedValue({ blob: new Blob([new Uint8Array(3)], { type: "image/png" }), fileName: "diagram.png" });
    render(<AttachmentRows attachments={row()} scope="internal" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Preview attachment" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("previewing a different file revokes the previous object URL", async () => {
    api.downloadAttachment.mockResolvedValue({ blob: new Blob([new Uint8Array(3)], { type: "image/png" }), fileName: "x.png" });
    render(<AttachmentRows attachments={items.map((a) => ({ ...a, mimeType: "image/png" }))} scope="internal" locale="en" />);
    const previews = screen.getAllByRole("button", { name: "Preview attachment" });
    fireEvent.click(previews[0]!);
    await screen.findByRole("dialog");
    (URL.revokeObjectURL as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(previews[1]!);
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock"));
  });

  it("unmount revokes the object URL", async () => {
    api.downloadAttachment.mockResolvedValue({ blob: new Blob([new Uint8Array(3)], { type: "image/png" }), fileName: "x.png" });
    const view = render(<AttachmentRows attachments={row()} scope="internal" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Preview attachment" }));
    await screen.findByRole("dialog");
    (URL.revokeObjectURL as ReturnType<typeof vi.fn>).mockClear();
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("Portal Preview uses the Portal download endpoint", async () => {
    api.downloadPortalAttachment.mockResolvedValue({ blob: new Blob([new Uint8Array(3)], { type: "image/png" }), fileName: "x.png" });
    render(<AttachmentRows attachments={row()} scope="portal" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Preview attachment" }));
    await waitFor(() => expect(api.downloadPortalAttachment).toHaveBeenCalledWith("p1", "diagram.png"));
    expect(api.downloadAttachment).not.toHaveBeenCalled();
  });

  it("localizes the Preview and Close labels in Arabic", async () => {
    await changeAppLanguage("ar");
    api.downloadAttachment.mockResolvedValue({ blob: new Blob([new Uint8Array(3)], { type: "image/png" }), fileName: "x.png" });
    render(<AttachmentRows attachments={row()} scope="internal" locale="ar" />);
    fireEvent.click(screen.getByRole("button", { name: "معاينة المرفق" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "إغلاق المعاينة" })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Portal projection safety (19-23)
// ---------------------------------------------------------------------------

describe("portal attachments", () => {
  it("renders owned-ticket attachments and an upload control for an eligible ticket", () => {
    render(<AttachmentPanel {...panelProps({ scope: "portal" })} />);
    expect(screen.getByText("quarterly-report.pdf")).toBeInTheDocument();
    expect(screen.getByLabelText("Select file")).toBeInTheDocument();
  });

  it("hides the upload control and explains the restriction for a CLOSED ticket", () => {
    render(
      <AttachmentPanel
        {...panelProps({ scope: "portal", canUpload: false, upload: undefined, disabledReason: "This request is closed and no longer accepts new attachments." })}
      />,
    );
    expect(screen.queryByLabelText("Select file")).not.toBeInTheDocument();
    expect(screen.getByText(/closed and no longer accepts/)).toBeInTheDocument();
  });

  it("renders only safe fields — no storage key or internal context leaks into the DOM", () => {
    const { container } = render(<AttachmentPanel {...panelProps({ scope: "portal" })} />);
    expect(container.textContent).not.toMatch(/storageKey|attachments\/|ticketId|customerId/);
  });
});

// ---------------------------------------------------------------------------
// Localization & RTL (24-27)
// ---------------------------------------------------------------------------

describe("attachment localization", () => {
  it("renders English copy", () => {
    render(<AttachmentPanel {...panelProps()} />);
    expect(screen.getByRole("heading", { name: "Attachments" })).toBeInTheDocument();
  });

  it("renders Arabic copy and keeps long filenames directionally isolated under RTL", async () => {
    await changeAppLanguage("ar");
    render(<AttachmentPanel {...panelProps({ locale: "ar" })} />);
    expect(screen.getByRole("heading", { name: "المرفقات" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "رفع مرفق" })).toBeInTheDocument();
    const name = screen.getByText("شهادة الدفع.pdf");
    expect(name.tagName).toBe("BDI");
    expect(name).toHaveAttribute("dir", "auto");
  });
});
