import { afterEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/services/api-client", () => ({ apiClient: client }));

import {
  downloadAttachment,
  getTicketAttachments,
  uploadPortalTicketAttachment,
  uploadTicketAttachment,
} from "./attachment-api";

afterEach(() => vi.clearAllMocks());

describe("attachment upload request", () => {
  it("sends FormData and clears the inherited JSON Content-Type so the browser sets the multipart boundary", async () => {
    client.post.mockResolvedValue({ data: { data: { id: "a1" } } });
    const file = new File([new Uint8Array(4)], "x.png", { type: "image/png" });
    await uploadTicketAttachment("ticket-1", file);

    const [url, body, config] = client.post.mock.calls[0]!;
    expect(url).toBe("/tickets/ticket-1/attachments");
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file")).toBeInstanceOf(File);
    expect(config.headers["Content-Type"]).toBeUndefined();
    expect("Content-Type" in config.headers).toBe(true); // explicitly set to undefined, not merged as JSON
  });

  it("targets the portal endpoint for portal uploads", async () => {
    client.post.mockResolvedValue({ data: { data: { id: "a1" } } });
    await uploadPortalTicketAttachment("ticket-1", new File(["x"], "n.txt", { type: "text/plain" }));
    expect(client.post.mock.calls[0]![0]).toBe("/portal/tickets/ticket-1/attachments");
  });
});

describe("attachment list / download requests", () => {
  it("requests the list without body transforms", async () => {
    client.get.mockResolvedValue({ data: { data: [{ id: "a1" }] } });
    await getTicketAttachments("ticket-1");
    expect(client.get).toHaveBeenCalledWith("/tickets/ticket-1/attachments");
  });

  it("downloads as a Blob and derives the filename from Content-Disposition (RFC 5987 first)", async () => {
    client.get.mockResolvedValue({
      data: new Blob(["bytes"]),
      headers: { "content-disposition": "attachment; filename=\"fallback.pdf\"; filename*=UTF-8''%D8%AA%D9%82%D8%B1%D9%8A%D8%B1.pdf" },
    });
    const result = await downloadAttachment("a1", "server.pdf");
    expect(client.get).toHaveBeenCalledWith("/attachments/a1/download", { responseType: "blob" });
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.fileName).toBe("تقرير.pdf");
  });

  it("falls back to the ascii filename, then the provided default", async () => {
    client.get.mockResolvedValueOnce({ data: new Blob([""]), headers: { "content-disposition": "attachment; filename=\"plain.txt\"" } });
    expect((await downloadAttachment("a1", "d.txt")).fileName).toBe("plain.txt");
    client.get.mockResolvedValueOnce({ data: new Blob([""]), headers: {} });
    expect((await downloadAttachment("a1", "d.txt")).fileName).toBe("d.txt");
  });
});
