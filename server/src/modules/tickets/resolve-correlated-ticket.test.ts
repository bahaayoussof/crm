import { describe, expect, it, vi } from "vitest";
import { resolveCorrelatedTicket } from "./resolve-correlated-ticket.js";

describe("resolveCorrelatedTicket — CONV-014 (OD-CC-4)", () => {
  it("returns { kind: 'none' } when no reliable evidence is available (lookup finds nothing)", async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    const result = await resolveCorrelatedTicket({} as never, { providerThreadValue: "no-match" }, lookup);
    expect(result).toEqual({ kind: "none" });
  });

  it("returns the correlated ticket for valid thread evidence", async () => {
    const ticket = { id: "t1", status: "OPEN" };
    const lookup = vi.fn().mockResolvedValue(ticket);
    const result = await resolveCorrelatedTicket({} as never, { providerThreadValue: "thread-1" }, lookup);
    expect(result).toEqual({ kind: "correlated", ticket });
  });

  it("still returns a CLOSED correlated ticket — CLOSED-rejection is the caller's job, not this resolver's", async () => {
    const ticket = { id: "t1", status: "CLOSED" };
    const lookup = vi.fn().mockResolvedValue(ticket);
    const result = await resolveCorrelatedTicket({} as never, { ticketId: "t1" }, lookup);
    expect(result).toEqual({ kind: "correlated", ticket });
  });
});
