import { TicketStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The service takes an explicit `db` (transaction client), so the tests drive a
// hand-built fake. The prisma module is still mocked because
// audit-log/notification services import it at load time.
vi.mock("../../config/prisma.js", () => ({ prisma: {} }));

import {
  autoAssignTicket,
  findBestAgentForTeam,
  getAgentActiveWorkload,
  getEligibleTeamAgents,
} from "./assignment.service.js";

type AgentRow = { id: string; name: string };

function makeDb(options: {
  agents?: AgentRow[];
  workload?: Record<string, number>;
  updateCount?: number;
} = {}) {
  const agents = options.agents ?? [];
  const workload = options.workload ?? {};
  const calls = {
    userFindMany: vi.fn(async () => agents.map((a) => ({ id: a.id, name: a.name }))),
    ticketGroupBy: vi.fn(async () =>
      Object.entries(workload).map(([assignedAgentId, count]) => ({
        assignedAgentId,
        _count: { _all: count },
      })),
    ),
    ticketUpdateMany: vi.fn(async () => ({ count: options.updateCount ?? 1 })),
    historyCreate: vi.fn(async () => ({})),
    auditCreate: vi.fn(async () => ({})),
    notificationCreateMany: vi.fn(async () => ({ count: 1 })),
  };
  const db = {
    user: { findMany: calls.userFindMany },
    ticket: { groupBy: calls.ticketGroupBy, updateMany: calls.ticketUpdateMany },
    ticketHistory: { create: calls.historyCreate },
    auditLog: { create: calls.auditCreate },
    notification: { createMany: calls.notificationCreateMany },
  } as never;
  return { db, calls };
}

const agent = (id: string): AgentRow => ({ id, name: `Agent ${id}` });

describe("assignment engine — least-loaded eligible agent within the ticket team", () => {
  beforeEach(() => vi.clearAllMocks());

  it("selects the agent with the fewest active tickets", async () => {
    const { db } = makeDb({
      agents: [agent("a"), agent("b"), agent("c")],
      workload: { a: 7, b: 2, c: 4 },
    });
    const best = await findBestAgentForTeam(db, "team-1");
    expect(best?.id).toBe("b");
  });

  it("breaks a workload tie deterministically by agent id, stable across runs", async () => {
    const build = () => makeDb({ agents: [agent("b"), agent("a")], workload: { a: 2, b: 2 } });
    const first = await findBestAgentForTeam(build().db, "team-1");
    const second = await findBestAgentForTeam(build().db, "team-1");
    expect(first?.id).toBe("a");
    expect(second?.id).toBe("a");
  });

  it("scopes candidates to the ticket's team — the query always carries the team id, role AGENT, and isActive", async () => {
    const { db, calls } = makeDb({ agents: [agent("a")], workload: { a: 0 } });
    await getEligibleTeamAgents(db, "team-A");
    expect(calls.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ role: "AGENT", isActive: true, teamId: "team-A" }) }),
    );
  });

  it("ranks an agent with no active tickets as workload 0", async () => {
    const { db } = makeDb({ agents: [agent("a"), agent("b")], workload: { b: 4 } });
    const ranked = await getEligibleTeamAgents(db, "team-1");
    expect(ranked.map((r) => [r.id, r.activeWorkload])).toEqual([
      ["a", 0],
      ["b", 4],
    ]);
  });

  it("getAgentActiveWorkload returns 0 for every requested agent with no rows", async () => {
    const { db } = makeDb({ workload: {} });
    const map = await getAgentActiveWorkload(db, ["a", "b"]);
    expect([map.get("a"), map.get("b")]).toEqual([0, 0]);
  });
});

describe("autoAssignTicket — guards and canonical side effects", () => {
  beforeEach(() => vi.clearAllMocks());

  const base = {
    ticketId: "ticket-1",
    teamId: "team-1",
    assignedAgentId: null as string | null,
    status: TicketStatus.OPEN,
  };

  it("assigns the least-loaded agent and writes history, audit, and a notification", async () => {
    const { db, calls } = makeDb({ agents: [agent("a"), agent("b")], workload: { a: 5, b: 1 } });
    const outcome = await autoAssignTicket(db, base);
    expect(outcome).toEqual({ assignedAgentId: "b", agentName: "Agent b" });
    expect(calls.ticketUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "ticket-1", assignedAgentId: null, teamId: "team-1" }),
        data: { assignedAgentId: "b" },
      }),
    );
    expect(calls.historyCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actorUserId: null, action: "AUTO_ASSIGNMENT", oldValue: null, newValue: "Agent b" }) }),
    );
    expect(calls.auditCreate).toHaveBeenCalled();
    expect(calls.notificationCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [expect.objectContaining({ userId: "b", type: "TICKET_AUTO_ASSIGNED" })] }),
    );
  });

  it("does nothing when the ticket already has an assignee (existing assignment preserved)", async () => {
    const { db, calls } = makeDb({ agents: [agent("a")], workload: { a: 0 } });
    const outcome = await autoAssignTicket(db, { ...base, assignedAgentId: "someone" });
    expect(outcome).toBeNull();
    expect(calls.userFindMany).not.toHaveBeenCalled();
    expect(calls.ticketUpdateMany).not.toHaveBeenCalled();
  });

  it("does nothing when the ticket has no team (never infers a team)", async () => {
    const { db, calls } = makeDb({ agents: [agent("a")], workload: { a: 0 } });
    const outcome = await autoAssignTicket(db, { ...base, teamId: null });
    expect(outcome).toBeNull();
    expect(calls.userFindMany).not.toHaveBeenCalled();
  });

  it.each([TicketStatus.RESOLVED, TicketStatus.CLOSED])("does nothing for a terminal ticket (%s)", async (status) => {
    const { db, calls } = makeDb({ agents: [agent("a")], workload: { a: 0 } });
    const outcome = await autoAssignTicket(db, { ...base, status });
    expect(outcome).toBeNull();
    expect(calls.ticketUpdateMany).not.toHaveBeenCalled();
  });

  it("does nothing (no error) when the team has no eligible active agent", async () => {
    const { db, calls } = makeDb({ agents: [] });
    const outcome = await autoAssignTicket(db, base);
    expect(outcome).toBeNull();
    expect(calls.ticketUpdateMany).not.toHaveBeenCalled();
    expect(calls.historyCreate).not.toHaveBeenCalled();
  });

  it("writes no history/audit/notification when a concurrent write won the guarded update", async () => {
    const { db, calls } = makeDb({ agents: [agent("a")], workload: { a: 0 }, updateCount: 0 });
    const outcome = await autoAssignTicket(db, base);
    expect(outcome).toBeNull();
    expect(calls.historyCreate).not.toHaveBeenCalled();
    expect(calls.auditCreate).not.toHaveBeenCalled();
    expect(calls.notificationCreateMany).not.toHaveBeenCalled();
  });

  it("never selects an agent from another team — cross-team agents are excluded by the query, so an empty team result is a no-op", async () => {
    // team-A ticket, but findMany(teamId: 'team-A') returns nothing because every
    // agent belongs to team-B.
    const { db, calls } = makeDb({ agents: [] });
    const outcome = await autoAssignTicket(db, { ...base, teamId: "team-A" });
    expect(outcome).toBeNull();
    expect(calls.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ teamId: "team-A" }) }),
    );
  });
});
