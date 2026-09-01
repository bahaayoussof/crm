import { Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ userFindMany: vi.fn(), userFindUnique: vi.fn() }));

vi.mock("../../config/prisma.js", () => ({
  prisma: { user: { findMany: mocks.userFindMany, findUnique: mocks.userFindUnique } },
}));

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";

const auth = (id: string, role: Role) => ({ Authorization: `Bearer ${createAccessToken({ id, role })}` });
const TEAM = "cteamaaaaaaaaaaaaaaaaaaaa1";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindMany.mockResolvedValue([]);
  mocks.userFindUnique.mockResolvedValue({ teamId: TEAM, managedTeam: { id: TEAM } });
});

describe("GET /api/users/agents — team scope (feature/team-based-manager-scope)", () => {
  it("returns every active agent for ADMIN when no teamId is given", async () => {
    await request(app).get("/api/users/agents").set(auth("admin-1", Role.ADMIN));
    expect(mocks.userFindMany.mock.calls[0][0].where).toEqual({ role: Role.AGENT, isActive: true });
  });

  it("honours ?teamId for an ADMIN", async () => {
    await request(app).get(`/api/users/agents?teamId=${TEAM}`).set(auth("admin-1", Role.ADMIN));
    expect(mocks.userFindMany.mock.calls[0][0].where).toMatchObject({ role: Role.AGENT, isActive: true, teamId: TEAM });
  });

  it("forces a MANAGER to their own team and ignores a client-supplied teamId", async () => {
    await request(app).get("/api/users/agents?teamId=cattacker0000000000000000").set(auth("mgr-1", Role.MANAGER));
    expect(mocks.userFindMany.mock.calls[0][0].where).toMatchObject({ role: Role.AGENT, isActive: true, teamId: TEAM });
  });

  it("returns nothing for a MANAGER with no team (never org-wide)", async () => {
    mocks.userFindUnique.mockResolvedValue({ teamId: null, managedTeam: null });
    await request(app).get("/api/users/agents").set(auth("mgr-2", Role.MANAGER));
    expect(mocks.userFindMany.mock.calls[0][0].where.teamId).toBe("__no_team__");
  });

  it("rejects CUSTOMER and unauthenticated callers", async () => {
    expect((await request(app).get("/api/users/agents")).status).toBe(401);
    expect((await request(app).get("/api/users/agents").set(auth("c-1", Role.CUSTOMER))).status).toBe(403);
  });
});
