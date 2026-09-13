import { describe, expect, it, vi } from "vitest";
import { resolveCustomerByPhone } from "./resolve-customer-by-phone.js";

function makeTx(matches: { id: string }[]) {
  return { customer: { findMany: vi.fn().mockResolvedValue(matches) } } as never;
}

describe("resolveCustomerByPhone — CONV-015 (OD-CC-6)", () => {
  it("returns { kind: 'none' } on zero matches", async () => {
    const result = await resolveCustomerByPhone(makeTx([]), "+14155550199", { id: true });
    expect(result).toEqual({ kind: "none" });
  });

  it("returns { kind: 'none' } for an unnormalizable phone without querying the DB", async () => {
    const tx = makeTx([]);
    const result = await resolveCustomerByPhone(tx, "", { id: true });
    expect(result).toEqual({ kind: "none" });
    expect((tx as { customer: { findMany: ReturnType<typeof vi.fn> } }).customer.findMany).not.toHaveBeenCalled();
  });

  it("returns { kind: 'one' } on exactly one match", async () => {
    const result = await resolveCustomerByPhone(makeTx([{ id: "c1" }]), "+14155550199", { id: true });
    expect(result).toEqual({ kind: "one", customer: { id: "c1" } });
  });

  it("returns { kind: 'ambiguous' } with count + correlationId, no candidate ids, on 2+ matches", async () => {
    const result = await resolveCustomerByPhone(makeTx([{ id: "cust-alpha-fixture" }, { id: "cust-beta-fixture" }]), "+14155550199", { id: true });
    expect(result.kind).toBe("ambiguous");
    if (result.kind === "ambiguous") {
      expect(result.candidateCount).toBe(2);
      expect(typeof result.correlationId).toBe("string");
      expect(result.correlationId.length).toBeGreaterThan(0);
      // No candidate customer id leaks into the ambiguous result shape — only
      // kind/count/correlationId are present.
      expect(Object.keys(result).sort()).toEqual(["candidateCount", "correlationId", "kind"]);
    }
    expect(JSON.stringify(result)).not.toContain("cust-alpha-fixture");
    expect(JSON.stringify(result)).not.toContain("cust-beta-fixture");
  });

  it("queries across normalized/digits-only/raw legacy phone forms", async () => {
    const tx = makeTx([{ id: "c1" }]);
    await resolveCustomerByPhone(tx, "+14155550199", { id: true });
    const args = (tx as { customer: { findMany: ReturnType<typeof vi.fn> } }).customer.findMany.mock.calls[0][0];
    expect(args.where.OR).toHaveLength(3);
  });
});
