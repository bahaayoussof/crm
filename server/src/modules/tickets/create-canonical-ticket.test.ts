import { beforeEach, describe, expect, it, vi } from "vitest";
import { TicketStatus } from "@prisma/client";
import { createCanonicalTicket } from "./create-canonical-ticket.js";

vi.mock("../audit-logs/audit-log.service.js", () => ({ createAuditLog: vi.fn() }));
vi.mock("../assignment/assignment.service.js", () => ({ autoAssignTicket: vi.fn() }));

import { createAuditLog } from "../audit-logs/audit-log.service.js";
import { autoAssignTicket } from "../assignment/assignment.service.js";

function makeTx(ticket: Record<string, unknown>) {
  const historyCreate = vi.fn();
  const ticketCreate = vi.fn().mockResolvedValue(ticket);
  const findUniqueOrThrow = vi.fn().mockResolvedValue(ticket);
  return {
    tx: { ticket: { create: ticketCreate, findUniqueOrThrow }, ticketHistory: { create: historyCreate } } as never,
    ticketCreate,
    historyCreate,
    findUniqueOrThrow,
  };
}

const BASE_TICKET = { id: "t1", subject: "s", status: TicketStatus.OPEN, priority: "MEDIUM", channel: "WEB", teamId: null, assignedAgentId: null, customerId: "c1" };

describe("createCanonicalTicket — CONV-013 (OD-CC-7 six creation contexts)", () => {
  beforeEach(() => vi.clearAllMocks());

  const contexts: { name: string; actorId: string | null }[] = [
    { name: "staff/manual", actorId: "staff-1" },
    { name: "Portal", actorId: null },
    { name: "Email", actorId: null },
    { name: "SMS", actorId: null },
    { name: "WhatsApp", actorId: null },
    { name: "Live Chat", actorId: null },
  ];

  for (const context of contexts) {
    it(`writes exactly one TICKET_CREATED AuditLog + one TicketHistory row for ${context.name} (actorId=${context.actorId})`, async () => {
      vi.clearAllMocks();
      const { tx, historyCreate } = makeTx(BASE_TICKET);
      const result = await createCanonicalTicket({ tx, data: { subject: "s", description: "d", customerId: "c1" } as never, actorId: context.actorId });

      expect(historyCreate).toHaveBeenCalledTimes(1);
      expect(historyCreate).toHaveBeenCalledWith({ data: { ticketId: "t1", actorUserId: context.actorId, action: "TICKET_CREATED", newValue: TicketStatus.OPEN } });

      expect(createAuditLog).toHaveBeenCalledTimes(1);
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: context.actorId, action: "TICKET_CREATED", entityType: "TICKET", entityId: "t1" }),
        tx,
      );
      expect(result.ticketId).toBe("t1");
    });
  }

  it("does not auto-assign when autoAssign is false", async () => {
    const { tx } = makeTx({ ...BASE_TICKET, teamId: "team-1" });
    await createCanonicalTicket({ tx, data: {} as never, actorId: null });
    expect(autoAssignTicket).not.toHaveBeenCalled();
  });

  it("auto-assigns when autoAssign is true, no explicit assignee, and a team is set", async () => {
    vi.mocked(autoAssignTicket).mockResolvedValue({ assignedAgentId: "agent-9" } as never);
    const { tx } = makeTx({ ...BASE_TICKET, teamId: "team-1" });
    const result = await createCanonicalTicket({ tx, data: { teamId: "team-1" } as never, actorId: null, autoAssign: true });
    expect(autoAssignTicket).toHaveBeenCalledTimes(1);
    expect(result.assignedAgentId).toBe("agent-9");
  });

  it("never auto-assigns when the request explicitly chose an assignee", async () => {
    // Guarded on `data.assignedAgentId` (the request), not the created row's
    // `ticket.assignedAgentId` — a caller's mocked/stale `select` echo must
    // never re-trigger auto-assignment for an explicitly-assigned request.
    const { tx } = makeTx({ ...BASE_TICKET, teamId: "team-1", assignedAgentId: "agent-1" });
    const result = await createCanonicalTicket({ tx, data: { assignedAgentId: "agent-1" } as never, actorId: null, autoAssign: true });
    expect(autoAssignTicket).not.toHaveBeenCalled();
    expect(result.assignedAgentId).toBe("agent-1");
  });

  it("refetches the ticket with the caller's merged select after auto-assignment", async () => {
    vi.mocked(autoAssignTicket).mockResolvedValue({ assignedAgentId: "agent-9" } as never);
    const { tx, ticketCreate, findUniqueOrThrow } = makeTx({ ...BASE_TICKET, teamId: "team-1" });
    findUniqueOrThrow.mockResolvedValue({ ...BASE_TICKET, teamId: "team-1", assignedAgentId: "agent-9" });
    const result = await createCanonicalTicket({ tx, data: { teamId: "team-1" } as never, actorId: null, autoAssign: true, select: { subject: true } });
    expect(findUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(result.ticket.assignedAgentId).toBe("agent-9");
    expect(ticketCreate).toHaveBeenCalledTimes(1);
  });

  it("defaults TicketHistory.actorUserId to actorId when historyActorId is not given", async () => {
    const { tx, historyCreate } = makeTx(BASE_TICKET);
    await createCanonicalTicket({ tx, data: {} as never, actorId: "staff-1" });
    expect(historyCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorUserId: "staff-1" }) }));
  });

  it("uses historyActorId for TicketHistory while AuditLog stays on the actorless actorId (Portal/Live Chat divergence)", async () => {
    const { tx, historyCreate } = makeTx(BASE_TICKET);
    await createCanonicalTicket({ tx, data: {} as never, actorId: null, historyActorId: "customer-user-1" });
    expect(historyCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorUserId: "customer-user-1" }) }));
    expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ actorId: null }), tx);
  });

  it("returns the merged-select ticket record even without auto-assignment", async () => {
    const { tx } = makeTx({ ...BASE_TICKET, emailThreadToken: "tok" });
    const result = await createCanonicalTicket({ tx, data: {} as never, actorId: null, select: { emailThreadToken: true } });
    expect(result.ticket).toMatchObject({ id: "t1", emailThreadToken: "tok" });
  });
});
