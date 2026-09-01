import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, findMany: mocks.userFindMany },
  },
}));

import {
  assertAgentAssignableToTicket,
  assertManagerTicketAccess,
  resolveActorTeamId,
  resolveActorTeamScope,
  teamScopedAgentWhere,
  teamScopedTicketWhere,
  ticketOperationalRecipientIds,
  MATCH_NOTHING,
} from "./team-scope.js";
import { AppError } from "../errors/app-error.js";

const ADMIN = { userId: "admin-1", role: Role.ADMIN };
const MANAGER = { userId: "mgr-1", role: Role.MANAGER };
const AGENT = { userId: "agt-1", role: Role.AGENT };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveActorTeamId", () => {
  it("returns null for ADMIN without touching the database", async () => {
    expect(await resolveActorTeamId(ADMIN)).toBeNull();
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("returns a MANAGER's LED team (managedTeam) over their membership team", async () => {
    mocks.userFindUnique.mockResolvedValue({ teamId: "membership-team", managedTeam: { id: "led-team" } });
    expect(await resolveActorTeamId(MANAGER)).toBe("led-team");
  });

  it("returns an AGENT's membership team", async () => {
    mocks.userFindUnique.mockResolvedValue({ teamId: "team-a", managedTeam: null });
    expect(await resolveActorTeamId(AGENT)).toBe("team-a");
  });

  it("returns null when the MANAGER/AGENT has no team (mis-provisioned)", async () => {
    mocks.userFindUnique.mockResolvedValue({ teamId: null, managedTeam: null });
    expect(await resolveActorTeamId(MANAGER)).toBeNull();
    expect(await resolveActorTeamId(AGENT)).toBeNull();
  });

  it("returns null when the user row is missing", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    expect(await resolveActorTeamId(MANAGER)).toBeNull();
  });
});

describe("resolveActorTeamScope", () => {
  it("is undefined for ADMIN (no team narrowing)", async () => {
    expect(await resolveActorTeamScope(ADMIN)).toBeUndefined();
  });

  it("is { teamId } for MANAGER / AGENT", async () => {
    mocks.userFindUnique.mockResolvedValue({ teamId: "team-a", managedTeam: null });
    expect(await resolveActorTeamScope(AGENT)).toEqual({ teamId: "team-a" });
  });

  it("is { teamId: null } for a MANAGER with no team (caller treats as match-nothing)", async () => {
    mocks.userFindUnique.mockResolvedValue({ teamId: null, managedTeam: null });
    expect(await resolveActorTeamScope(MANAGER)).toEqual({ teamId: null });
  });
});

describe("teamScopedTicketWhere", () => {
  it("is empty for ADMIN and AGENT (their scope is layered elsewhere)", () => {
    expect(teamScopedTicketWhere(ADMIN, null)).toEqual({});
    expect(teamScopedTicketWhere(AGENT, "team-a")).toEqual({});
  });

  it("restricts a MANAGER to their team", () => {
    expect(teamScopedTicketWhere(MANAGER, "team-a")).toEqual({ teamId: "team-a" });
  });

  it("matches nothing for a MANAGER with no team", () => {
    expect(teamScopedTicketWhere(MANAGER, null)).toEqual(MATCH_NOTHING);
  });
});

describe("teamScopedAgentWhere", () => {
  it("is every active agent for ADMIN", () => {
    expect(teamScopedAgentWhere(ADMIN, null)).toEqual({ role: Role.AGENT, isActive: true });
  });

  it("is the team's active agents for a MANAGER", () => {
    expect(teamScopedAgentWhere(MANAGER, "team-a")).toEqual({ role: Role.AGENT, isActive: true, teamId: "team-a" });
  });

  it("matches nothing for a MANAGER with no team", () => {
    expect(teamScopedAgentWhere(MANAGER, null)).toEqual({ id: { in: [] } });
  });
});

describe("assertManagerTicketAccess", () => {
  it("is a no-op for ADMIN and AGENT", () => {
    expect(() => assertManagerTicketAccess(ADMIN, null, "team-b")).not.toThrow();
    expect(() => assertManagerTicketAccess(AGENT, "team-a", "team-b")).not.toThrow();
  });

  it("allows a MANAGER to reach their own team's ticket", () => {
    expect(() => assertManagerTicketAccess(MANAGER, "team-a", "team-a")).not.toThrow();
  });

  it("404s a MANAGER on another team's ticket (no existence leak)", () => {
    try {
      assertManagerTicketAccess(MANAGER, "team-a", "team-b");
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(404);
      expect((error as AppError).code).toBe("TICKET_NOT_FOUND");
    }
  });

  it("404s a MANAGER with no team, and on an unrouted ticket", () => {
    expect(() => assertManagerTicketAccess(MANAGER, null, "team-a")).toThrow(AppError);
    expect(() => assertManagerTicketAccess(MANAGER, "team-a", null)).toThrow(AppError);
  });
});

describe("assertAgentAssignableToTicket", () => {
  it("allows same-team assignment", () => {
    expect(() => assertAgentAssignableToTicket("team-a", "team-a")).not.toThrow();
  });

  it("allows an unrouted ticket to adopt the agent's team", () => {
    expect(() => assertAgentAssignableToTicket(null, "team-a")).not.toThrow();
  });

  it("rejects a cross-team assignment with 409 CROSS_TEAM_ASSIGNMENT", () => {
    try {
      assertAgentAssignableToTicket("team-a", "team-b");
      throw new Error("expected throw");
    } catch (error) {
      expect((error as AppError).statusCode).toBe(409);
      expect((error as AppError).code).toBe("CROSS_TEAM_ASSIGNMENT");
    }
  });

  it("rejects an agent with no team with 409 AGENT_HAS_NO_TEAM", () => {
    try {
      assertAgentAssignableToTicket("team-a", null);
      throw new Error("expected throw");
    } catch (error) {
      expect((error as AppError).statusCode).toBe(409);
      expect((error as AppError).code).toBe("AGENT_HAS_NO_TEAM");
    }
  });
});

describe("ticketOperationalRecipientIds", () => {
  const db = { user: { findMany: mocks.userFindMany } } as never;

  it("routed ticket → ADMINs + that team's manager + the assigned agent", async () => {
    mocks.userFindMany.mockResolvedValue([{ id: "admin-1" }, { id: "mgr-a" }, { id: "agent-x" }]);
    const ids = await ticketOperationalRecipientIds(db, { teamId: "team-a", assignedAgentId: "agent-x" });
    expect(ids).toEqual(["admin-1", "mgr-a", "agent-x"]);
    const where = mocks.userFindMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { role: Role.ADMIN },
      { role: Role.MANAGER, managedTeam: { id: "team-a" } },
      { id: "agent-x" },
    ]);
  });

  it("UNROUTED ticket (teamId null) → NEVER includes any manager clause", async () => {
    mocks.userFindMany.mockResolvedValue([{ id: "admin-1" }]);
    await ticketOperationalRecipientIds(db, { teamId: null });
    const where = mocks.userFindMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ role: Role.ADMIN }]);
  });

  it("honours excludeUserId", async () => {
    mocks.userFindMany.mockResolvedValue([]);
    await ticketOperationalRecipientIds(db, { teamId: "team-a", excludeUserId: "mgr-a" });
    expect(mocks.userFindMany.mock.calls[0][0].where.id).toEqual({ not: "mgr-a" });
  });
});
