import { Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(),
  create: vi.fn(), update: vi.fn(), auditCreate: vi.fn(),
  deptFindUnique: vi.fn(), branchFindUnique: vi.fn(),
  // feature/team-based-manager-scope
  teamFindUnique: vi.fn(), teamUpdate: vi.fn(), teamUpdateMany: vi.fn(), ticketCount: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => {
  const department = { findUnique: mocks.deptFindUnique };
  const branch = { findUnique: mocks.branchFindUnique };
  const team = { findUnique: mocks.teamFindUnique, update: mocks.teamUpdate, updateMany: mocks.teamUpdateMany };
  const ticket = { count: mocks.ticketCount };
  return {
    prisma: {
      user: {
        findMany: mocks.findMany, count: mocks.count, findUnique: mocks.findUnique,
        findFirst: mocks.findFirst, create: mocks.create, update: mocks.update,
      },
      department,
      branch,
      team,
      ticket,
      $transaction: vi.fn(async (value: unknown) =>
        typeof value === "function"
          ? (value as (tx: {
              user: typeof mocks;
              department: typeof department;
              branch: typeof branch;
              team: typeof team;
              ticket: typeof ticket;
              auditLog: { create: typeof mocks.auditCreate };
            }) => unknown)({ user: mocks, department, branch, team, ticket, auditLog: { create: mocks.auditCreate } })
          : Promise.all(value as Promise<unknown>[])),
    },
  };
});

vi.mock("bcrypt", () => ({ default: { hash: vi.fn(async () => "hashed-password"), compare: vi.fn(async () => true) } }));

import bcrypt from "bcrypt";
import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";

const token = (id: string, role: Role) => createAccessToken({ id, role });
const adminToken = token("c90b1b286043f1b7612e423c7", Role.ADMIN);
const managerToken = token("c6fd0a01a46ed4545f0a5e774", Role.MANAGER);
const agentToken = token("agent-1", Role.AGENT);
const customerToken = token("ce83f10dcd2c68747c3f3ba14", Role.CUSTOMER);
const auth = (value: string) => ({ Authorization: `Bearer ${value}` });
const now = new Date("2026-08-27T12:00:00.000Z");

const adminRow = { id: "c90b1b286043f1b7612e423c7", name: "Admin User", email: "admin@example.com", role: Role.ADMIN, isActive: true, createdAt: now, updatedAt: now };
const agentRow = { id: "c52904c0e5ca009722ff46b3e", name: "Agent Nine", email: "agent9@example.com", role: Role.AGENT, isActive: true, createdAt: now, updatedAt: now };

// `requireActiveUser` resolves the caller via `prisma.user.findUnique`; the
// administration services use `findFirst`/`count`. Default the caller to an
// active ADMIN so route-guard checks pass unless a test overrides it.
function actorIsActiveAdmin() {
  mocks.findUnique.mockResolvedValue({ role: Role.ADMIN, isActive: true });
}

describe("users administration API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorIsActiveAdmin();
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    mocks.teamFindUnique.mockResolvedValue(null);
    mocks.teamUpdate.mockResolvedValue({});
    mocks.teamUpdateMany.mockResolvedValue({ count: 0 });
    mocks.ticketCount.mockResolvedValue(0);
  });

  it("rejects unauthenticated requests on every admin route", async () => {
    expect((await request(app).get("/api/users")).status).toBe(401);
    expect((await request(app).get("/api/users/c2d711642b726b04401627ca9")).status).toBe(401);
    expect((await request(app).post("/api/users").send({})).status).toBe(401);
    expect((await request(app).patch("/api/users/c2d711642b726b04401627ca9").send({ name: "New" })).status).toBe(401);
  });

  it.each([["MANAGER", managerToken], ["AGENT", agentToken], ["CUSTOMER", customerToken]] as const)(
    "rejects %s from every admin user route", async (role, value) => {
      mocks.findUnique.mockResolvedValue({ role: Role[role], isActive: true });
      expect((await request(app).get("/api/users").set(auth(value))).status).toBe(403);
      expect((await request(app).get("/api/users/c2d711642b726b04401627ca9").set(auth(value))).status).toBe(403);
      expect((await request(app).post("/api/users").set(auth(value)).send({ name: "New User", email: "n@example.com", password: "password123", role: "AGENT" })).status).toBe(403);
      expect((await request(app).patch("/api/users/c2d711642b726b04401627ca9").set(auth(value)).send({ name: "New" })).status).toBe(403);
    });

  it("keeps the agents lookup open to every internal role and filters to active agents", async () => {
    mocks.findMany.mockResolvedValue([{ id: "c52904c0e5ca009722ff46b3e", name: "Agent Nine", email: "agent9@example.com" }]);
    const response = await request(app).get("/api/users/agents").set(auth(agentToken));
    expect(response.status).toBe(200);
    expect(mocks.findMany.mock.calls[0]?.[0].where).toEqual({ role: Role.AGENT, isActive: true });
    expect((await request(app).get("/api/users/agents").set(auth(customerToken))).status).toBe(403);
  });

  it("lists internal users with a safe projection", async () => {
    mocks.findMany.mockResolvedValue([adminRow, agentRow]);
    mocks.count.mockResolvedValue(2);
    const response = await request(app).get("/api/users").set(auth(adminToken));
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).not.toHaveProperty("passwordHash");
    const call = mocks.findMany.mock.calls[0]?.[0];
    expect(call.where.role).toEqual({ in: [Role.ADMIN, Role.MANAGER, Role.AGENT] });
    expect(call.orderBy).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
    expect(call.select).toEqual({
      id: true, name: true, email: true, role: true, isActive: true, phone: true,
      departmentId: true, branchId: true, teamId: true,
      department: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      team: { select: { id: true, name: true, departmentId: true } },
      createdAt: true, updatedAt: true,
    });
  });

  it("filters the list by role and status", async () => {
    await request(app).get("/api/users?role=AGENT&status=inactive").set(auth(adminToken));
    const where = mocks.findMany.mock.calls[0]?.[0].where;
    expect(where.role).toBe(Role.AGENT);
    expect(where.isActive).toBe(false);
  });

  it("searches case-insensitively across name and email", async () => {
    await request(app).get("/api/users?search=nine").set(auth(adminToken));
    const where = mocks.findMany.mock.calls[0]?.[0].where;
    expect(where.AND[0].OR).toEqual([
      { name: { contains: "nine", mode: "insensitive" } },
      { email: { contains: "nine", mode: "insensitive" } },
    ]);
  });

  it("rejects unknown query parameters and a CUSTOMER role filter", async () => {
    expect((await request(app).get("/api/users?sort=name").set(auth(adminToken))).status).toBe(400);
    expect((await request(app).get("/api/users?role=CUSTOMER").set(auth(adminToken))).status).toBe(400);
  });

  it("bounds and computes list pagination", async () => {
    expect((await request(app).get("/api/users?limit=500").set(auth(adminToken))).status).toBe(400);
    mocks.findMany.mockResolvedValue([adminRow]);
    mocks.count.mockResolvedValue(21);
    const response = await request(app).get("/api/users?page=2&limit=10").set(auth(adminToken));
    expect(response.body.meta).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
  });

  it("returns 404 for a missing or CUSTOMER user id", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const response = await request(app).get("/api/users/cffa63583dfa6706b87d284b8").set(auth(adminToken));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("USER_NOT_FOUND");
    expect(mocks.findFirst.mock.calls[0]?.[0].where).toEqual({ id: "cffa63583dfa6706b87d284b8", role: { in: [Role.ADMIN, Role.MANAGER, Role.AGENT] } });
  });

  it("creates a user with a hashed password and a server-trusted role", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue(agentRow);
    const response = await request(app).post("/api/users").set(auth(adminToken))
      .send({ name: "Agent Nine", email: "Agent9@Example.com", password: "password123", role: "AGENT" });
    expect(response.status).toBe(201);
    expect(bcrypt.hash).toHaveBeenCalledWith("password123", 12);
    const data = mocks.create.mock.calls[0]?.[0].data;
    expect(data).toEqual({ name: "Agent Nine", email: "agent9@example.com", passwordHash: "hashed-password", role: "AGENT" });
  });

  it("assigns a department and branch on create after validating both", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.deptFindUnique.mockResolvedValue({ id: "cee5922638edfee323b605a34", isActive: true, branchId: "c1e48e7f960a7daccd1e40c3d" });
    mocks.branchFindUnique.mockResolvedValue({ id: "c1e48e7f960a7daccd1e40c3d", isActive: true });
    mocks.create.mockResolvedValue({ ...agentRow, departmentId: "cee5922638edfee323b605a34", branchId: "c1e48e7f960a7daccd1e40c3d" });
    const response = await request(app).post("/api/users").set(auth(adminToken))
      .send({ name: "Agent Nine", email: "agent9@example.com", password: "password123", role: "AGENT", departmentId: "cee5922638edfee323b605a34", branchId: "c1e48e7f960a7daccd1e40c3d" });
    expect(response.status).toBe(201);
    expect(mocks.create.mock.calls[0]?.[0].data).toMatchObject({
      department: { connect: { id: "cee5922638edfee323b605a34" } },
      branch: { connect: { id: "c1e48e7f960a7daccd1e40c3d" } },
    });
  });

  it("rejects an inactive department assignment", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.deptFindUnique.mockResolvedValue({ id: "cee5922638edfee323b605a34", isActive: false, branchId: null });
    const response = await request(app).post("/api/users").set(auth(adminToken))
      .send({ name: "Agent Nine", email: "agent9@example.com", password: "password123", role: "AGENT", departmentId: "cee5922638edfee323b605a34" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_DEPARTMENT");
  });

  it("rejects a department that does not belong to the chosen branch", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.deptFindUnique.mockResolvedValue({ id: "cee5922638edfee323b605a34", isActive: true, branchId: "c57b014f58c8912a267809dbd" });
    mocks.branchFindUnique.mockResolvedValue({ id: "c1e48e7f960a7daccd1e40c3d", isActive: true });
    const response = await request(app).post("/api/users").set(auth(adminToken))
      .send({ name: "Agent Nine", email: "agent9@example.com", password: "password123", role: "AGENT", departmentId: "cee5922638edfee323b605a34", branchId: "c1e48e7f960a7daccd1e40c3d" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("DEPARTMENT_BRANCH_MISMATCH");
  });

  it("clears a user's department when departmentId is null", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "c52904c0e5ca009722ff46b3e", role: Role.AGENT, isActive: true, departmentId: "cee5922638edfee323b605a34", branchId: null });
    mocks.update.mockResolvedValue({ ...agentRow, departmentId: null });
    const response = await request(app).patch("/api/users/c52904c0e5ca009722ff46b3e").set(auth(adminToken)).send({ departmentId: null });
    expect(response.status).toBe(200);
    expect(mocks.update.mock.calls[0]?.[0].data).toEqual({ department: { disconnect: true } });
  });

  it("promotes another internal user to ADMIN", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "c52904c0e5ca009722ff46b3e", role: Role.AGENT, isActive: true });
    mocks.update.mockResolvedValue({ ...agentRow, role: Role.ADMIN });
    const response = await request(app).patch("/api/users/c52904c0e5ca009722ff46b3e").set(auth(adminToken)).send({ role: "ADMIN" });
    expect(response.status).toBe(200);
    expect(mocks.update.mock.calls[0]?.[0]).toMatchObject({ where: { id: "c52904c0e5ca009722ff46b3e" }, data: { role: "ADMIN" } });
  });

  it("lets an ADMIN edit name, email, phone, role, branch, department, and status of another user in one request", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "c52904c0e5ca009722ff46b3e", name: "Old Name", email: "old@example.com", phone: null, role: Role.AGENT, isActive: true, departmentId: null, branchId: null });
    mocks.branchFindUnique.mockResolvedValue({ id: "c1e48e7f960a7daccd1e40c3d", isActive: true });
    mocks.deptFindUnique.mockResolvedValue({ id: "cee5922638edfee323b605a34", isActive: true, branchId: "c1e48e7f960a7daccd1e40c3d" });
    mocks.update.mockResolvedValue({ ...agentRow, name: "New Name", email: "new@example.com", phone: "+442079460958", role: Role.MANAGER, isActive: false, departmentId: "cee5922638edfee323b605a34", branchId: "c1e48e7f960a7daccd1e40c3d" });
    const response = await request(app).patch("/api/users/c52904c0e5ca009722ff46b3e").set(auth(adminToken)).send({
      name: "  New Name  ", email: "New@Example.com", phone: "+44 20 7946 0958", role: "MANAGER", branchId: "c1e48e7f960a7daccd1e40c3d", departmentId: "cee5922638edfee323b605a34", isActive: false,
    });
    expect(response.status).toBe(200);
    expect(mocks.update.mock.calls[0]?.[0].data).toMatchObject({
      name: "New Name", email: "new@example.com", phone: "+442079460958", role: "MANAGER", isActive: false,
      branch: { connect: { id: "c1e48e7f960a7daccd1e40c3d" } }, department: { connect: { id: "cee5922638edfee323b605a34" } },
    });
  });

  it("lets an ADMIN update another user's phone with the shared phone validation", async () => {
    mocks.findFirst.mockResolvedValue({ id: "c52904c0e5ca009722ff46b3e", role: Role.AGENT, isActive: true, phone: null, departmentId: null, branchId: null });
    mocks.update.mockResolvedValue({ ...agentRow, phone: "+442079460958" });
    const ok = await request(app).patch("/api/users/c52904c0e5ca009722ff46b3e").set(auth(adminToken)).send({ phone: "+44 20 7946 0958" });
    expect(ok.status).toBe(200);
    expect(mocks.update.mock.calls[0]?.[0].data).toEqual({ phone: "+442079460958" });
    const bad = await request(app).patch("/api/users/c52904c0e5ca009722ff46b3e").set(auth(adminToken)).send({ phone: "12" });
    expect(bad.status).toBe(400);
  });

  it("still rejects an incompatible department/branch combination on update", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "c52904c0e5ca009722ff46b3e", role: Role.AGENT, isActive: true, departmentId: null, branchId: null });
    mocks.branchFindUnique.mockResolvedValue({ id: "c1e48e7f960a7daccd1e40c3d", isActive: true });
    mocks.deptFindUnique.mockResolvedValue({ id: "cee5922638edfee323b605a34", isActive: true, branchId: "c57b014f58c8912a267809dbd" });
    const response = await request(app).patch("/api/users/c52904c0e5ca009722ff46b3e").set(auth(adminToken)).send({ branchId: "c1e48e7f960a7daccd1e40c3d", departmentId: "cee5922638edfee323b605a34" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("DEPARTMENT_BRANCH_MISMATCH");
  });

  it("still rejects an inactive branch or department on update", async () => {
    mocks.findFirst.mockResolvedValue({ id: "c52904c0e5ca009722ff46b3e", role: Role.AGENT, isActive: true, departmentId: null, branchId: null });
    mocks.branchFindUnique.mockResolvedValue({ id: "c1e48e7f960a7daccd1e40c3d", isActive: false });
    const inactiveBranch = await request(app).patch("/api/users/c52904c0e5ca009722ff46b3e").set(auth(adminToken)).send({ branchId: "c1e48e7f960a7daccd1e40c3d" });
    expect(inactiveBranch.status).toBe(400);
    expect(inactiveBranch.body.error.code).toBe("INVALID_BRANCH");
    mocks.branchFindUnique.mockResolvedValue({ id: "c1e48e7f960a7daccd1e40c3d", isActive: true });
    mocks.deptFindUnique.mockResolvedValue({ id: "cee5922638edfee323b605a34", isActive: false, branchId: "c1e48e7f960a7daccd1e40c3d" });
    const inactiveDept = await request(app).patch("/api/users/c52904c0e5ca009722ff46b3e").set(auth(adminToken)).send({ branchId: "c1e48e7f960a7daccd1e40c3d", departmentId: "cee5922638edfee323b605a34" });
    expect(inactiveDept.status).toBe(400);
    expect(inactiveDept.body.error.code).toBe("INVALID_DEPARTMENT");
  });

  it.each([["AGENT", "MANAGER"], ["MANAGER", "AGENT"]] as const)(
    "changes another user from %s to %s", async (from, to) => {
      mocks.findFirst.mockResolvedValueOnce({ id: "c100e513d7cdce8179685d3f1", role: Role[from], isActive: true });
      mocks.update.mockResolvedValue({ ...agentRow, id: "c100e513d7cdce8179685d3f1", role: Role[to] });
      const response = await request(app).patch("/api/users/c100e513d7cdce8179685d3f1").set(auth(adminToken)).send({ role: to });
      expect(response.status).toBe(200);
      expect(mocks.update.mock.calls[0]?.[0].data).toEqual({ role: to });
    });

  it("rejects creating a CUSTOMER, an unknown field, or a weak password", async () => {
    expect((await request(app).post("/api/users").set(auth(adminToken)).send({ name: "X User", email: "x@example.com", password: "password123", role: "CUSTOMER" })).status).toBe(400);
    expect((await request(app).post("/api/users").set(auth(adminToken)).send({ name: "X User", email: "x@example.com", password: "password123", role: "AGENT", isActive: true })).status).toBe(400);
    expect((await request(app).post("/api/users").set(auth(adminToken)).send({ name: "X User", email: "x@example.com", password: "short", role: "AGENT" })).status).toBe(400);
  });

  it("returns 409 when the email is already registered", async () => {
    mocks.findFirst.mockResolvedValue({ id: "someone" });
    const response = await request(app).post("/api/users").set(auth(adminToken))
      .send({ name: "Dupe User", email: "admin@example.com", password: "password123", role: "MANAGER" });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("updates only the provided profile fields", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "c52904c0e5ca009722ff46b3e", role: Role.AGENT, isActive: true });
    mocks.update.mockResolvedValue({ ...agentRow, name: "Agent Nine Updated" });
    const response = await request(app).patch("/api/users/c52904c0e5ca009722ff46b3e").set(auth(adminToken)).send({ name: "Agent Nine Updated" });
    expect(response.status).toBe(200);
    expect(mocks.update.mock.calls[0]?.[0]).toMatchObject({ where: { id: "c52904c0e5ca009722ff46b3e" }, data: { name: "Agent Nine Updated" } });
    expect(mocks.update.mock.calls[0]?.[0].data).not.toHaveProperty("isActive");
    expect(mocks.update.mock.calls[0]?.[0].data).not.toHaveProperty("role");
  });

  it("rejects an empty or unknown-field update", async () => {
    expect((await request(app).patch("/api/users/c52904c0e5ca009722ff46b3e").set(auth(adminToken)).send({})).status).toBe(400);
    expect((await request(app).patch("/api/users/c52904c0e5ca009722ff46b3e").set(auth(adminToken)).send({ createdAt: now })).status).toBe(400);
    expect((await request(app).patch("/api/users/c52904c0e5ca009722ff46b3e").set(auth(adminToken)).send({ role: "CUSTOMER" })).status).toBe(400);
  });

  it("blocks an admin from changing their own role", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "c90b1b286043f1b7612e423c7", role: Role.ADMIN, isActive: true });
    const response = await request(app).patch("/api/users/c90b1b286043f1b7612e423c7").set(auth(adminToken)).send({ role: "MANAGER" });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("SELF_ROLE_CHANGE_FORBIDDEN");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("allows an admin to submit their own unchanged role alongside a profile edit", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "c90b1b286043f1b7612e423c7", role: Role.ADMIN, isActive: true });
    mocks.update.mockResolvedValue({ ...adminRow, name: "Admin Renamed" });
    const response = await request(app).patch("/api/users/c90b1b286043f1b7612e423c7").set(auth(adminToken)).send({ name: "Admin Renamed", role: "ADMIN" });
    expect(response.status).toBe(200);
  });

  it("blocks an admin from deactivating their own account", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "c90b1b286043f1b7612e423c7", role: Role.ADMIN, isActive: true });
    const response = await request(app).patch("/api/users/c90b1b286043f1b7612e423c7").set(auth(adminToken)).send({ isActive: false });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("SELF_DEACTIVATION_FORBIDDEN");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("blocks demoting the last active ADMIN", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "cbba86a1e179dc69b2ff4b913", role: Role.ADMIN, isActive: true });
    mocks.count.mockResolvedValue(0);
    const response = await request(app).patch("/api/users/cbba86a1e179dc69b2ff4b913").set(auth(adminToken)).send({ role: "MANAGER" });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("LAST_ACTIVE_ADMIN_REQUIRED");
    expect(mocks.count.mock.calls.at(-1)?.[0].where).toEqual({ role: Role.ADMIN, isActive: true, id: { not: "cbba86a1e179dc69b2ff4b913" } });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("blocks deactivating the last active ADMIN", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "cbba86a1e179dc69b2ff4b913", role: Role.ADMIN, isActive: true });
    mocks.count.mockResolvedValue(0);
    const response = await request(app).patch("/api/users/cbba86a1e179dc69b2ff4b913").set(auth(adminToken)).send({ isActive: false });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("LAST_ACTIVE_ADMIN_REQUIRED");
  });

  it("allows demoting or deactivating an ADMIN when another active ADMIN remains", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "cbba86a1e179dc69b2ff4b913", role: Role.ADMIN, isActive: true });
    mocks.count.mockResolvedValue(1);
    mocks.update.mockResolvedValue({ ...adminRow, id: "cbba86a1e179dc69b2ff4b913", role: Role.MANAGER });
    const response = await request(app).patch("/api/users/cbba86a1e179dc69b2ff4b913").set(auth(adminToken)).send({ role: "MANAGER" });
    expect(response.status).toBe(200);
    expect(mocks.update.mock.calls[0]?.[0].data).toEqual({ role: "MANAGER" });
  });

  it("does not run the last-admin check when demoting an already-inactive ADMIN", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "c10cdef74485b2f8af66409fd", role: Role.ADMIN, isActive: false });
    mocks.update.mockResolvedValue({ ...adminRow, id: "c10cdef74485b2f8af66409fd", role: Role.AGENT, isActive: false });
    const response = await request(app).patch("/api/users/c10cdef74485b2f8af66409fd").set(auth(adminToken)).send({ role: "AGENT" });
    expect(response.status).toBe(200);
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it("rejects an email update that collides with another user", async () => {
    mocks.findFirst
      .mockResolvedValueOnce({ id: "c52904c0e5ca009722ff46b3e", role: Role.AGENT, isActive: true })
      .mockResolvedValueOnce({ id: "c90b1b286043f1b7612e423c7" });
    const response = await request(app).patch("/api/users/c52904c0e5ca009722ff46b3e").set(auth(adminToken)).send({ email: "admin@example.com" });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("returns 404 when updating a missing user", async () => {
    mocks.findFirst.mockResolvedValueOnce(null);
    expect((await request(app).patch("/api/users/cffa63583dfa6706b87d284b8").set(auth(adminToken)).send({ name: "New name" })).status).toBe(404);
  });

  it("rejects a deactivated caller's token on the next request", async () => {
    mocks.findUnique.mockResolvedValue({ role: Role.ADMIN, isActive: false });
    const response = await request(app).get("/api/users").set(auth(adminToken));
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("ACCOUNT_DEACTIVATED");
  });

  it("uses the caller's current database role, not the stale JWT role", async () => {
    // JWT says ADMIN, database says the account was demoted to MANAGER.
    mocks.findUnique.mockResolvedValue({ role: Role.MANAGER, isActive: true });
    const response = await request(app).get("/api/users").set(auth(adminToken));
    expect(response.status).toBe(403);
  });

  it("does not leave a partial update when the write fails inside the transaction", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "c52904c0e5ca009722ff46b3e", role: Role.AGENT, isActive: true });
    mocks.update.mockRejectedValueOnce(new Error("write failed"));
    const response = await request(app).patch("/api/users/c52904c0e5ca009722ff46b3e").set(auth(adminToken)).send({ name: "Half Written" });
    expect(response.status).toBe(500);
  });
});
