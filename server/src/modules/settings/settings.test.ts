import { Role, TicketPriority } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), categoryFindMany: vi.fn(), categoryFindUnique: vi.fn(), categoryCreate: vi.fn(), categoryUpdate: vi.fn(), slaFindMany: vi.fn(), slaUpsert: vi.fn() }));
vi.mock("../../config/prisma.js", () => ({ prisma: {
  user: { findUnique: mocks.user }, category: { findMany: mocks.categoryFindMany, findUnique: mocks.categoryFindUnique, create: mocks.categoryCreate, update: mocks.categoryUpdate },
  slaRule: { findMany: mocks.slaFindMany, upsert: mocks.slaUpsert },
} }));
import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";
const token = (role: Role, id = role.toLowerCase()) => createAccessToken({ id, role });
const auth = (role: Role) => ({ Authorization: `Bearer ${token(role)}` });

describe("settings API", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user.mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve({ role: where.id.toUpperCase() as Role, isActive: true })); mocks.categoryFindMany.mockResolvedValue([]); mocks.categoryFindUnique.mockResolvedValue({ id: "c1" }); mocks.categoryCreate.mockResolvedValue({ id: "c1", name: "Billing", description: null, isActive: true }); mocks.categoryUpdate.mockResolvedValue({ id: "c1", name: "Billing", description: null, isActive: false }); mocks.slaFindMany.mockResolvedValue([]); mocks.slaUpsert.mockResolvedValue({ id: "s1", priority: TicketPriority.HIGH, firstResponseMinutes: 60, resolutionMinutes: 240, isActive: true }); });
  it("requires authentication", async () => expect((await request(app).get("/api/settings/categories")).status).toBe(401));
  it.each([Role.MANAGER, Role.AGENT, Role.CUSTOMER])("rejects %s", async (role) => expect((await request(app).get("/api/settings/categories").set(auth(role))).status).toBe(403));
  it("lists active and inactive categories for ADMIN", async () => { mocks.categoryFindMany.mockResolvedValue([{ id: "a", isActive: true }, { id: "b", isActive: false }]); const response = await request(app).get("/api/settings/categories?search=bill").set(auth(Role.ADMIN)); expect(response.status).toBe(200); expect(response.body.data).toHaveLength(2); expect(mocks.categoryFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { name: { contains: "bill", mode: "insensitive" } } })); });
  it("creates and trims a category", async () => { const response = await request(app).post("/api/settings/categories").set(auth(Role.ADMIN)).send({ name: "  Billing  ", description: "  invoices " }); expect(response.status).toBe(201); expect(mocks.categoryCreate).toHaveBeenCalledWith(expect.objectContaining({ data: { name: "Billing", description: "invoices" } })); });
  it("updates activation without deleting", async () => { const response = await request(app).patch("/api/settings/categories/c1").set(auth(Role.ADMIN)).send({ isActive: false }); expect(response.status).toBe(200); expect(mocks.categoryUpdate).toHaveBeenCalled(); });
  it.each([{ name: "" }, { name: "x" }, { name: "ok", unknown: true }])("rejects invalid category input", async (body) => expect((await request(app).post("/api/settings/categories").set(auth(Role.ADMIN)).send(body)).status).toBe(400));
  it("lists SLA rules", async () => { const response = await request(app).get("/api/settings/sla-rules").set(auth(Role.ADMIN)); expect(response.status).toBe(200); });
  it("upserts one priority rule", async () => { const response = await request(app).put("/api/settings/sla-rules/HIGH").set(auth(Role.ADMIN)).send({ firstResponseMinutes: 60, resolutionMinutes: 240, isActive: true }); expect(response.status).toBe(200); expect(mocks.slaUpsert).toHaveBeenCalledWith(expect.objectContaining({ where: { priority: "HIGH" }, update: expect.objectContaining({ isActive: true }) })); });
  it.each([["INVALID", 60, 240], ["LOW", 0, 240], ["LOW", 60, 30], ["LOW", 60, 525601]])("rejects invalid SLA settings", async (priority, first, resolution) => expect((await request(app).put(`/api/settings/sla-rules/${priority}`).set(auth(Role.ADMIN)).send({ firstResponseMinutes: first, resolutionMinutes: resolution, isActive: true })).status).toBe(400));
});
