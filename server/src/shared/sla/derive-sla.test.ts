import { TicketStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { deriveSla } from "./derive-sla.js";

const now = new Date("2026-08-26T12:00:00.000Z");
const base = {
  status: TicketStatus.OPEN,
  firstResponseDueAt: null,
  firstRespondedAt: null,
  resolutionDueAt: null,
  resolvedAt: null,
  closedAt: null,
};
const minutes = (value: number) => new Date(now.getTime() + value * 60_000);

describe("deriveSla", () => {
  it("returns NOT_CONFIGURED with no effective target when no deadline applies", () => {
    expect(deriveSla(base, now)).toEqual({ slaState: "NOT_CONFIGURED", effectiveSlaDueAt: null, effectiveSlaTarget: null });
  });

  it.each([
    [61, "ON_TRACK"],
    [60, "AT_RISK"],
    [30, "AT_RISK"],
    [0, "BREACHED"],
    [-1, "BREACHED"],
  ] as const)("derives first-response state at %s minutes", (offset, state) => {
    expect(deriveSla({ ...base, firstResponseDueAt: minutes(offset) }, now)).toEqual({
      slaState: state,
      effectiveSlaDueAt: minutes(offset).toISOString(),
      effectiveSlaTarget: "FIRST_RESPONSE",
    });
  });

  it.each([[61, "ON_TRACK"], [60, "AT_RISK"], [-1, "BREACHED"]] as const)("derives resolution state at %s minutes", (offset, state) => {
    expect(deriveSla({ ...base, firstRespondedAt: minutes(-10), resolutionDueAt: minutes(offset) }, now)).toEqual({
      slaState: state,
      effectiveSlaDueAt: minutes(offset).toISOString(),
      effectiveSlaTarget: "RESOLUTION",
    });
  });

  it("switches from completed first response to resolution", () => {
    expect(deriveSla({ ...base, firstResponseDueAt: minutes(-10), firstRespondedAt: minutes(-20), resolutionDueAt: minutes(120) }, now).effectiveSlaTarget).toBe("RESOLUTION");
  });

  it("selects the earlier applicable deadline", () => {
    expect(deriveSla({ ...base, firstResponseDueAt: minutes(30), resolutionDueAt: minutes(20) }, now).effectiveSlaTarget).toBe("RESOLUTION");
  });

  it("prefers first response when applicable deadlines tie", () => {
    expect(deriveSla({ ...base, firstResponseDueAt: minutes(30), resolutionDueAt: minutes(30) }, now).effectiveSlaTarget).toBe("FIRST_RESPONSE");
  });

  it("returns MET after a configured first response when no resolution target remains", () => {
    expect(deriveSla({ ...base, firstResponseDueAt: minutes(-10), firstRespondedAt: minutes(-20) }, now)).toEqual({ slaState: "MET", effectiveSlaDueAt: null, effectiveSlaTarget: null });
  });

  it.each([
    [{ status: TicketStatus.RESOLVED }, "resolved status"],
    [{ status: TicketStatus.CLOSED }, "closed status"],
    [{ resolvedAt: minutes(-1) }, "resolved timestamp"],
    [{ closedAt: minutes(-1) }, "closed timestamp"],
  ])("returns MET for terminal tickets using $1", (terminal) => {
    expect(deriveSla({ ...base, ...terminal, firstResponseDueAt: minutes(-10) }, now)).toEqual({ slaState: "MET", effectiveSlaDueAt: null, effectiveSlaTarget: null });
  });

  it("serializes the effective deadline as an ISO string", () => {
    expect(deriveSla({ ...base, firstResponseDueAt: minutes(61) }, now).effectiveSlaDueAt).toBe("2026-08-26T13:01:00.000Z");
  });
});
