import { Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ticketFindFirst: vi.fn(),
  ticketUpdate: vi.fn(),
  ticketMessageFindFirst: vi.fn(),
  ticketMessageCreate: vi.fn(),
  customerFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  attachmentFindMany: vi.fn(),
  attachmentFindUnique: vi.fn(),
  attachmentCreate: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    ticket: { findFirst: mocks.ticketFindFirst, update: mocks.ticketUpdate },
    ticketMessage: { findFirst: mocks.ticketMessageFindFirst, create: mocks.ticketMessageCreate },
    customer: { findUnique: mocks.customerFindUnique },
    user: { findUnique: mocks.userFindUnique },
    attachment: {
      findMany: mocks.attachmentFindMany,
      findUnique: mocks.attachmentFindUnique,
      create: mocks.attachmentCreate,
    },
  },
}));

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";
import { env } from "../../config/env.js";
import { __setAttachmentStorageForTests } from "./attachment-storage.js";
import { createMemoryStorage, type MemoryStorage } from "./memory-storage.js";
import { MAX_ATTACHMENT_BYTES } from "./attachment.constants.js";

const token = (id: string, role: Role) => createAccessToken({ id, role });
const adminToken = token("admin-1", Role.ADMIN);
const managerToken = token("c6fd0a01a46ed4545f0a5e774", Role.MANAGER);
const agentToken = token("c6ff3b3bd11c44cac620c43d5", Role.AGENT);
const otherAgentToken = token("agent-2", Role.AGENT);
const customerToken = token("cef143082689b8d74098b24fb", Role.CUSTOMER);
const auth = (value: string) => ({ Authorization: `Bearer ${value}` });

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
const TXT = Buffer.from("hello world, this is a plain text attachment.\n");
const HTML = Buffer.from("<!doctype html><script>alert(1)</script>");
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

let storage: MemoryStorage;

const attach = (
  req: request.Test,
  buffer: Buffer,
  options: { filename?: string; contentType?: string } = {},
) => req.attach("file", buffer, { filename: options.filename ?? "file.png", contentType: options.contentType ?? "image/png" });

const createdRow = (over: Record<string, unknown> = {}) => ({
  id: "c20864c4631c6b45febd49bfc",
  fileName: "file.png",
  mimeType: "image/png",
  createdAt: new Date("2026-08-26T12:00:00.000Z"),
  ticketId: "c737ce60fccf9da889f4605c0",
  messageId: null,
  customerId: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  storage = createMemoryStorage();
  __setAttachmentStorageForTests(storage);
  mocks.userFindUnique.mockResolvedValue({ passwordChangedAt: null });
  mocks.attachmentFindMany.mockResolvedValue([]);
  mocks.attachmentCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    ...createdRow(),
    ...data,
  }));
});

// ---------------------------------------------------------------------------
// 1-2 auth boundary
// ---------------------------------------------------------------------------

describe("attachment auth boundary", () => {
  it("rejects unauthenticated internal requests with 401", async () => {
    expect((await request(app).get("/api/tickets/c737ce60fccf9da889f4605c0/attachments")).status).toBe(401);
    expect((await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments")).status).toBe(401);
    expect((await request(app).get("/api/attachments/c20864c4631c6b45febd49bfc/download")).status).toBe(401);
    expect((await request(app).get("/api/customers/c21d120906fd394b11c7a5ea3/attachments")).status).toBe(401);
  });

  it("rejects CUSTOMER from every internal attachment route with 403", async () => {
    expect((await request(app).get("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(customerToken))).status).toBe(403);
    expect((await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(customerToken))).status).toBe(403);
    expect((await request(app).get("/api/customers/c21d120906fd394b11c7a5ea3/attachments").set(auth(customerToken))).status).toBe(403);
    expect((await request(app).post("/api/customers/c21d120906fd394b11c7a5ea3/attachments").set(auth(customerToken))).status).toBe(403);
    expect((await request(app).get("/api/attachments/c20864c4631c6b45febd49bfc/download").set(auth(customerToken))).status).toBe(403);
  });

  it("rejects internal roles from the Portal attachment routes with 403", async () => {
    expect((await request(app).get("/api/portal/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(agentToken))).status).toBe(403);
    expect((await request(app).get("/api/portal/attachments/c20864c4631c6b45febd49bfc/download").set(auth(adminToken))).status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 3-8 internal ticket upload + visibility
// ---------------------------------------------------------------------------

describe("internal ticket attachment upload", () => {
  it.each([
    ["ADMIN", adminToken],
    ["MANAGER", managerToken],
  ] as const)("lets %s upload a ticket attachment", async (_role, value) => {
    mocks.ticketFindFirst.mockResolvedValue({ id: "c737ce60fccf9da889f4605c0", status: "OPEN", assignedAgentId: "agent-9" });
    const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(value)), PNG);
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ fileName: "file.png", mimeType: "image/png", ticketId: "c737ce60fccf9da889f4605c0", messageId: null, customerId: null });
    expect(response.body.data).not.toHaveProperty("storageKey");
    expect(mocks.attachmentCreate).toHaveBeenCalledTimes(1);
    expect(storage.size()).toBe(1);
  });

  it("lets the assigned AGENT upload a ticket attachment", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: "c737ce60fccf9da889f4605c0", status: "OPEN", assignedAgentId: "c6ff3b3bd11c44cac620c43d5" });
    const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(agentToken)), PDF, { filename: "r.pdf", contentType: "application/pdf" });
    expect(response.status).toBe(201);
    expect(response.body.data.mimeType).toBe("application/pdf");
  });

  it("rejects an AGENT uploading to an unassigned ticket with 403", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: "c737ce60fccf9da889f4605c0", status: "OPEN", assignedAgentId: null });
    const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(agentToken)), PNG);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(mocks.attachmentCreate).not.toHaveBeenCalled();
    expect(storage.size()).toBe(0);
  });

  it("rejects an AGENT uploading to another AGENT's ticket with 403", async () => {
    // ticket visibility hides another agent's ticket -> findFirst returns null -> 404
    mocks.ticketFindFirst.mockResolvedValue(null);
    const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(otherAgentToken)), PNG);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  it("applies ticket visibility to listing (hidden ticket -> 404)", async () => {
    mocks.ticketFindFirst.mockResolvedValue(null);
    const response = await request(app).get("/api/tickets/cc4de162214816a2dd8ee3ec6/attachments").set(auth(agentToken));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  it("lists ticket-level and message-level attachments once each", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: "c737ce60fccf9da889f4605c0", status: "OPEN", assignedAgentId: null });
    mocks.attachmentFindMany.mockResolvedValue([
      createdRow({ id: "cf55ff16f66f43360266b95db", messageId: null }),
      createdRow({ id: "a2", messageId: "c3a0de37932e8b19746f20b22" }),
    ]);
    const response = await request(app).get("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(adminToken));
    expect(response.status).toBe(200);
    expect(response.body.data.map((a: { id: string }) => a.id)).toEqual(["cf55ff16f66f43360266b95db", "a2"]);
    const where = mocks.attachmentFindMany.mock.calls[0]?.[0].where;
    expect(where).toEqual({ OR: [{ ticketId: "c737ce60fccf9da889f4605c0", messageId: null }, { message: { ticketId: "c737ce60fccf9da889f4605c0" } }] });
  });
});

// ---------------------------------------------------------------------------
// 9-11 customer-profile attachments
// ---------------------------------------------------------------------------

describe("customer-profile attachments", () => {
  it.each([
    ["ADMIN", adminToken],
    ["MANAGER", managerToken],
  ] as const)("lets %s upload a customer attachment", async (_role, value) => {
    mocks.customerFindUnique.mockResolvedValue({ id: "c21d120906fd394b11c7a5ea3" });
    const response = await attach(request(app).post("/api/customers/c21d120906fd394b11c7a5ea3/attachments").set(auth(value)), TXT, { filename: "note.txt", contentType: "text/plain" });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ mimeType: "text/plain", customerId: "c21d120906fd394b11c7a5ea3", ticketId: null, messageId: null });
  });

  it("rejects an AGENT uploading a customer attachment with 403", async () => {
    const response = await attach(request(app).post("/api/customers/c21d120906fd394b11c7a5ea3/attachments").set(auth(agentToken)), TXT, { filename: "note.txt", contentType: "text/plain" });
    expect(response.status).toBe(403);
    expect(mocks.attachmentCreate).not.toHaveBeenCalled();
  });

  it("lets an AGENT list and download a customer attachment", async () => {
    mocks.customerFindUnique.mockResolvedValue({ id: "c21d120906fd394b11c7a5ea3" });
    mocks.attachmentFindMany.mockResolvedValue([createdRow({ id: "cf55ff16f66f43360266b95db", ticketId: null, customerId: "c21d120906fd394b11c7a5ea3" })]);
    const list = await request(app).get("/api/customers/c21d120906fd394b11c7a5ea3/attachments").set(auth(agentToken));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    storage.seed("attachments/key-c", TXT, "text/plain");
    mocks.attachmentFindUnique.mockResolvedValue({ fileName: "note.txt", mimeType: "text/plain", storageKey: "attachments/key-c", ticketId: null, messageId: null, customerId: "c21d120906fd394b11c7a5ea3" });
    const download = await request(app).get("/api/attachments/cf55ff16f66f43360266b95db/download").set(auth(agentToken));
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toContain("text/plain");
  });
});

// ---------------------------------------------------------------------------
// 12-13 message context
// ---------------------------------------------------------------------------

describe("message attachment context", () => {
  it("requires the message to belong to the supplied ticket", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: "c737ce60fccf9da889f4605c0", status: "OPEN", assignedAgentId: null });
    mocks.ticketMessageFindFirst.mockResolvedValue(null); // message not found under ticket-1
    const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/messages/c46f5cd580bbd93276726cf7e/attachments").set(auth(adminToken)), PNG);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("MESSAGE_NOT_FOUND");
    const where = mocks.ticketMessageFindFirst.mock.calls[0]?.[0].where;
    expect(where).toEqual({ id: "c46f5cd580bbd93276726cf7e", ticketId: "c737ce60fccf9da889f4605c0" });
  });

  it("rejects attaching to another user's message with 403 for ADMIN too", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: "c737ce60fccf9da889f4605c0", status: "OPEN", assignedAgentId: null });
    mocks.ticketMessageFindFirst.mockResolvedValue({ id: "c3a0de37932e8b19746f20b22", authorUserId: "someone-else" });
    const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/messages/c3a0de37932e8b19746f20b22/attachments").set(auth(adminToken)), PNG);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(mocks.attachmentCreate).not.toHaveBeenCalled();
  });

  it("lets the author attach to their own message", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: "c737ce60fccf9da889f4605c0", status: "OPEN", assignedAgentId: "c6ff3b3bd11c44cac620c43d5" });
    mocks.ticketMessageFindFirst.mockResolvedValue({ id: "c3a0de37932e8b19746f20b22", authorUserId: "c6ff3b3bd11c44cac620c43d5" });
    const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/messages/c3a0de37932e8b19746f20b22/attachments").set(auth(agentToken)), PNG);
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ ticketId: "c737ce60fccf9da889f4605c0", messageId: "c3a0de37932e8b19746f20b22" });
  });
});

// ---------------------------------------------------------------------------
// 14-22 upload validation
// ---------------------------------------------------------------------------

describe("upload validation", () => {
  beforeEach(() => {
    mocks.ticketFindFirst.mockResolvedValue({ id: "c737ce60fccf9da889f4605c0", status: "OPEN", assignedAgentId: null });
  });

  it("accepts a request whose only part is the file", async () => {
    const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(adminToken)), PNG);
    expect(response.status).toBe(201);
    const data = mocks.attachmentCreate.mock.calls[0]?.[0].data;
    expect(data.storageKey).toMatch(/^attachments\/[0-9a-f-]{36}$/);
    expect(data.ticketId).toBe("c737ce60fccf9da889f4605c0");
  });

  it("rejects a request with no file part", async () => {
    const response = await request(app)
      .post("/api/tickets/c737ce60fccf9da889f4605c0/attachments")
      .set(auth(adminToken))
      .set("Content-Type", "multipart/form-data; boundary=EMPTYBOUNDARY")
      .send("--EMPTYBOUNDARY--\r\n");
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("NO_FILE");
  });

  it("rejects a file sent under an unexpected field name", async () => {
    const response = await request(app)
      .post("/api/tickets/c737ce60fccf9da889f4605c0/attachments")
      .set(auth(adminToken))
      .attach("document", PNG, { filename: "file.png", contentType: "image/png" });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("NO_FILE");
  });

  it("rejects multiple files in one request", async () => {
    const response = await request(app)
      .post("/api/tickets/c737ce60fccf9da889f4605c0/attachments")
      .set(auth(adminToken))
      .attach("file", PNG, { filename: "a.png", contentType: "image/png" })
      .attach("file", PNG, { filename: "b.png", contentType: "image/png" });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("MULTIPLE_FILES");
    expect(mocks.attachmentCreate).not.toHaveBeenCalled();
  });

  it("rejects an empty file", async () => {
    const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(adminToken)), Buffer.alloc(0), { filename: "empty.txt", contentType: "text/plain" });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("EMPTY_FILE");
  });

  it("rejects a file larger than 4 MiB with FILE_TOO_LARGE", async () => {
    const big = Buffer.alloc(MAX_ATTACHMENT_BYTES + 512, 0x41);
    const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(adminToken)), big, { filename: "big.txt", contentType: "text/plain" });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("FILE_TOO_LARGE");
    expect(storage.size()).toBe(0);
  });

  it("rejects an unsupported MIME type by content", async () => {
    const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(adminToken)), EXE, { filename: "tool.png", contentType: "image/png" });
    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
  });

  it("rejects MIME spoofing (HTML body claimed as text/plain)", async () => {
    const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(adminToken)), HTML, { filename: "notes.txt", contentType: "text/plain" });
    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
  });

  it("stores the detected type, not the client-claimed type", async () => {
    const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(adminToken)), PNG, { filename: "x.pdf", contentType: "application/pdf" });
    expect(response.status).toBe(201);
    expect(response.body.data.mimeType).toBe("image/png");
  });

  it("normalizes an unsafe filename (strips path traversal)", async () => {
    const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(adminToken)), PDF, { filename: "../../../etc/passwd.pdf", contentType: "application/pdf" });
    expect(response.status).toBe(201);
    expect(response.body.data.fileName).toBe("passwd.pdf");
  });

  it("generates unpredictable, server-derived storage keys", async () => {
    await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(adminToken)), PNG);
    await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(adminToken)), PNG);
    const keys = mocks.attachmentCreate.mock.calls.map((c) => c[0].data.storageKey);
    expect(keys[0]).toMatch(/^attachments\/[0-9a-f-]{36}$/);
    expect(keys[1]).toMatch(/^attachments\/[0-9a-f-]{36}$/);
    expect(keys[0]).not.toBe(keys[1]);
  });
});

// ---------------------------------------------------------------------------
// Multipart textual-field rejection (no field is silently ignored)
// ---------------------------------------------------------------------------

describe("multipart field rejection", () => {
  beforeEach(() => {
    mocks.ticketFindFirst.mockResolvedValue({ id: "c737ce60fccf9da889f4605c0", status: "OPEN", assignedAgentId: null });
  });

  const send = (field: string, value: string) =>
    request(app)
      .post("/api/tickets/c737ce60fccf9da889f4605c0/attachments")
      .set(auth(adminToken))
      .field(field, value)
      .attach("file", PNG, { filename: "file.png", contentType: "image/png" });

  it.each([
    ["storageKey", "attachments/attacker-controlled"],
    ["ticketId", "cac751ad4df09c6e36c91dafe"],
    ["messageId", "msg-evil"],
    ["customerId", "cust-evil"],
    ["mimeType", "application/x-msdownload"],
    ["fileName", "override.txt"],
    ["createdAt", "2000-01-01T00:00:00.000Z"],
  ] as const)("rejects the reserved field %s with 422 INVALID_ATTACHMENT_CONTEXT", async (field, value) => {
    const putSpy = vi.spyOn(storage, "put");
    const response = await send(field, value);
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("INVALID_ATTACHMENT_CONTEXT");
    expect(JSON.stringify(response.body)).not.toContain(value); // submitted value never echoed
    expect(putSpy).not.toHaveBeenCalled();
    expect(mocks.attachmentCreate).not.toHaveBeenCalled();
    expect(storage.size()).toBe(0);
  });

  it("rejects an unknown text field with 422 INVALID_UPLOAD", async () => {
    const putSpy = vi.spyOn(storage, "put");
    const response = await send("note", "please store this too");
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("INVALID_UPLOAD");
    expect(JSON.stringify(response.body)).not.toContain("please store this too");
    expect(putSpy).not.toHaveBeenCalled();
    expect(mocks.attachmentCreate).not.toHaveBeenCalled();
  });

  it("returns exactly one response and does not hang when a field is rejected", async () => {
    const response = await send("storageKey", "x");
    expect(response.status).toBe(422); // resolves; supertest would time out on a hang
    expect(typeof response.body.error.code).toBe("string");
  });

  it("still succeeds for a request whose only part is the file", async () => {
    const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(adminToken)), PNG);
    expect(response.status).toBe(201);
    expect(mocks.attachmentCreate).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 23-26 safe responses + provider/db failure + cleanup
// ---------------------------------------------------------------------------

describe("failure handling and safe responses", () => {
  beforeEach(() => {
    mocks.ticketFindFirst.mockResolvedValue({ id: "c737ce60fccf9da889f4605c0", status: "OPEN", assignedAgentId: null });
  });

  it("never exposes storageKey or provider URLs in list or upload responses", async () => {
    mocks.attachmentFindMany.mockResolvedValue([createdRow({ id: "cf55ff16f66f43360266b95db" })]);
    const list = await request(app).get("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(adminToken));
    const upload = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(adminToken)), PNG);
    for (const body of [list.body, upload.body]) {
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain("storageKey");
      expect(serialized).not.toContain("attachments/");
      expect(serialized).not.toContain("blob.vercel-storage.com");
      expect(serialized.toLowerCase()).not.toContain("blob_read_write_token");
    }
  });

  it("returns 503 STORAGE_UNAVAILABLE when no storage is configured", async () => {
    __setAttachmentStorageForTests(null); // clear the in-memory test adapter
    const savedToken = env.BLOB_READ_WRITE_TOKEN;
    env.BLOB_READ_WRITE_TOKEN = undefined; // simulate an unconfigured deployment
    try {
      const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(adminToken)), PNG);
      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe("STORAGE_UNAVAILABLE");
      expect(mocks.attachmentCreate).not.toHaveBeenCalled();
    } finally {
      env.BLOB_READ_WRITE_TOKEN = savedToken;
    }
  });

  it("creates no database metadata when the provider upload fails", async () => {
    storage.failNext("put", new Error("provider exploded"));
    const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(adminToken)), PNG);
    expect(response.status).toBe(500);
    expect(mocks.attachmentCreate).not.toHaveBeenCalled();
  });

  it("attempts provider cleanup when database creation fails", async () => {
    mocks.attachmentCreate.mockRejectedValueOnce(new Error("db write failed"));
    const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(adminToken)), PNG);
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("ATTACHMENT_UPLOAD_FAILED");
    expect(storage.size()).toBe(0); // cleanup removed the orphan
  });

  it("handles cleanup failure without exposing secrets", async () => {
    mocks.attachmentCreate.mockRejectedValueOnce(new Error("db write failed"));
    storage.failNext("remove", new Error("cleanup boom"));
    const response = await attach(request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(adminToken)), PNG);
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("ATTACHMENT_UPLOAD_FAILED");
    expect(JSON.stringify(response.body)).not.toContain("boom");
    expect(JSON.stringify(response.body)).not.toContain("db write failed");
  });
});

// ---------------------------------------------------------------------------
// 27-29 + item 6 — download security
// ---------------------------------------------------------------------------

describe("download security", () => {
  it("returns safe headers for an authorized download", async () => {
    storage.seed("attachments/key-1", PNG, "image/png");
    mocks.attachmentFindUnique.mockResolvedValue({ fileName: "diagram.png", mimeType: "image/png", storageKey: "attachments/key-1", ticketId: "c737ce60fccf9da889f4605c0", messageId: null, customerId: null });
    mocks.ticketFindFirst.mockResolvedValue({ id: "c737ce60fccf9da889f4605c0" });
    const response = await request(app).get("/api/attachments/c20864c4631c6b45febd49bfc/download").set(auth(adminToken));
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("image/png");
    expect(response.headers["content-disposition"]).toMatch(/^attachment; filename=/);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });

  it("authorizes before any storage retrieval (hidden ticket -> 404, get untouched)", async () => {
    const getSpy = vi.spyOn(storage, "get");
    const headSpy = vi.spyOn(storage, "head");
    mocks.attachmentFindUnique.mockResolvedValue({ fileName: "x.png", mimeType: "image/png", storageKey: "attachments/key-1", ticketId: "ticket-9", messageId: null, customerId: null });
    mocks.ticketFindFirst.mockResolvedValue(null); // not visible to this agent
    const response = await request(app).get("/api/attachments/c20864c4631c6b45febd49bfc/download").set(auth(agentToken));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ATTACHMENT_NOT_FOUND");
    expect(headSpy).not.toHaveBeenCalled();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it("returns a structured 404 for a missing attachment record", async () => {
    mocks.attachmentFindUnique.mockResolvedValue(null);
    const response = await request(app).get("/api/attachments/cffa63583dfa6706b87d284b8/download").set(auth(adminToken));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ATTACHMENT_NOT_FOUND");
  });

  it("returns ATTACHMENT_NOT_FOUND (no provider detail) when the stored object is missing", async () => {
    const getSpy = vi.spyOn(storage, "get");
    mocks.attachmentFindUnique.mockResolvedValue({ fileName: "x.png", mimeType: "image/png", storageKey: "attachments/gone", ticketId: "c737ce60fccf9da889f4605c0", messageId: null, customerId: null });
    mocks.ticketFindFirst.mockResolvedValue({ id: "c737ce60fccf9da889f4605c0" });
    const response = await request(app).get("/api/attachments/c20864c4631c6b45febd49bfc/download").set(auth(adminToken));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ATTACHMENT_NOT_FOUND");
    expect(getSpy).not.toHaveBeenCalled(); // head failed first
  });

  it("rejects a stored object larger than 4 MiB and never reads its bytes", async () => {
    const getSpy = vi.spyOn(storage, "get");
    storage.seed("attachments/huge", Buffer.alloc(MAX_ATTACHMENT_BYTES + 10, 0x41), "text/plain");
    mocks.attachmentFindUnique.mockResolvedValue({ fileName: "huge.txt", mimeType: "text/plain", storageKey: "attachments/huge", ticketId: "c737ce60fccf9da889f4605c0", messageId: null, customerId: null });
    mocks.ticketFindFirst.mockResolvedValue({ id: "c737ce60fccf9da889f4605c0" });
    const response = await request(app).get("/api/attachments/c20864c4631c6b45febd49bfc/download").set(auth(adminToken));
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("FILE_TOO_LARGE");
    expect(getSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 30-36 Customer Portal
// ---------------------------------------------------------------------------

describe("Customer Portal attachments", () => {
  beforeEach(() => {
    mocks.customerFindUnique.mockResolvedValue({ id: "portal-cust-1" });
  });

  it("lets a CUSTOMER upload to an owned non-closed ticket without creating a message or reopening", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: "c737ce60fccf9da889f4605c0", status: "RESOLVED" });
    const response = await attach(request(app).post("/api/portal/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(customerToken)), PDF, { filename: "receipt.pdf", contentType: "application/pdf" });
    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({
      id: expect.any(String),
      fileName: "receipt.pdf",
      mimeType: "application/pdf",
      createdAt: expect.any(String),
      messageId: null,
    });
    expect(response.body.data).not.toHaveProperty("ticketId");
    expect(response.body.data).not.toHaveProperty("customerId");
    expect(response.body.data).not.toHaveProperty("storageKey");
    expect(mocks.ticketUpdate).not.toHaveBeenCalled();
    expect(mocks.ticketMessageCreate).not.toHaveBeenCalled();
  });

  it("rejects a CUSTOMER uploading to another customer's ticket with 404 TICKET_NOT_FOUND", async () => {
    mocks.ticketFindFirst.mockResolvedValue(null); // ownership query (id + customerId) misses
    const response = await attach(request(app).post("/api/portal/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(customerToken)), PDF, { filename: "x.pdf", contentType: "application/pdf" });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("TICKET_NOT_FOUND");
    const where = mocks.ticketFindFirst.mock.calls[0]?.[0].where;
    expect(where).toEqual({ id: "c737ce60fccf9da889f4605c0", customerId: "portal-cust-1" });
  });

  it("rejects a CUSTOMER uploading to a CLOSED ticket with 409 TICKET_CLOSED", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: "c737ce60fccf9da889f4605c0", status: "CLOSED" });
    const response = await attach(request(app).post("/api/portal/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(customerToken)), PDF, { filename: "x.pdf", contentType: "application/pdf" });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("TICKET_CLOSED");
    expect(mocks.attachmentCreate).not.toHaveBeenCalled();
  });

  it("lists owned-ticket attachments with a minimal projection", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: "c737ce60fccf9da889f4605c0" });
    mocks.attachmentFindMany.mockResolvedValue([
      { id: "cf55ff16f66f43360266b95db", fileName: "f.pdf", mimeType: "application/pdf", createdAt: new Date("2026-08-26T12:00:00.000Z"), messageId: null },
    ]);
    const response = await request(app).get("/api/portal/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(customerToken));
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toEqual({ id: "cf55ff16f66f43360266b95db", fileName: "f.pdf", mimeType: "application/pdf", createdAt: "2026-08-26T12:00:00.000Z", messageId: null });
    const select = mocks.attachmentFindMany.mock.calls[0]?.[0].select;
    expect(select).not.toHaveProperty("storageKey");
    expect(select).not.toHaveProperty("ticketId");
    expect(select).not.toHaveProperty("customerId");
  });

  it("rejects a CUSTOMER downloading another customer's attachment with 404", async () => {
    mocks.attachmentFindUnique.mockResolvedValue({
      fileName: "x.pdf",
      mimeType: "application/pdf",
      storageKey: "attachments/key",
      customerId: null,
      ticket: { customerId: "another-customer" },
      message: null,
    });
    const response = await request(app).get("/api/portal/attachments/c20864c4631c6b45febd49bfc/download").set(auth(customerToken));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ATTACHMENT_NOT_FOUND");
  });

  it("rejects a CUSTOMER accessing a customer-profile attachment through the Portal with 404", async () => {
    mocks.attachmentFindUnique.mockResolvedValue({
      fileName: "x.pdf",
      mimeType: "application/pdf",
      storageKey: "attachments/key",
      customerId: "portal-cust-1",
      ticket: null,
      message: null,
    });
    const response = await request(app).get("/api/portal/attachments/c20864c4631c6b45febd49bfc/download").set(auth(customerToken));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ATTACHMENT_NOT_FOUND");
  });

  it("lets a CUSTOMER download an owned-ticket attachment", async () => {
    storage.seed("attachments/owned", PDF, "application/pdf");
    mocks.attachmentFindUnique.mockResolvedValue({
      fileName: "receipt.pdf",
      mimeType: "application/pdf",
      storageKey: "attachments/owned",
      customerId: null,
      ticket: { customerId: "portal-cust-1" },
      message: null,
    });
    const response = await request(app).get("/api/portal/attachments/c20864c4631c6b45febd49bfc/download").set(auth(customerToken));
    expect(response.status).toBe(200);
    expect(response.headers["content-disposition"]).toContain("attachment;");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("requires a linked customer profile", async () => {
    mocks.customerFindUnique.mockResolvedValue(null);
    const response = await request(app).get("/api/portal/tickets/c737ce60fccf9da889f4605c0/attachments").set(auth(customerToken));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CUSTOMER_PROFILE_REQUIRED");
  });
});
