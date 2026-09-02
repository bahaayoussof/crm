/**
 * Regression coverage for the two QA-seed data-integrity fixes
 * (fix/qa-seed-data-integrity):
 *
 *   1. Team seeding is idempotent — repeated runs reuse the canonical Teams via
 *      the `departmentId + name` unique key and rebind them to the freshly
 *      seeded Manager, instead of a blind `team.create` that collides on
 *      `Team_departmentId_name_key`.
 *   2. Customer-authored TicketMessages are attributed to the ticket owner's own
 *      portal User — never `portalCustomerUsers[0]` or another customer.
 *
 * These exercise the pure helpers only; the full seed still runs against a live
 * database (see docs/24 — live repeated re-seed NOT EXECUTED, no disposable DB).
 */
import { describe, expect, it } from "vitest";

import { SEED_COUNTS, SEED_TEAM_DEFS, buildTeamUpsertArgs, resolveMessageAuthorId, seedTicketChannel } from "./seed-test-data.js";

describe("buildTeamUpsertArgs — Team seed idempotency", () => {
  it("keys the write on the Team unique constraint (departmentId + name), not a blind create", () => {
    const args = buildTeamUpsertArgs({ departmentId: "dept-1", name: "Billing Support", managerId: "mgr-new" });

    expect(args.where).toEqual({
      departmentId_name: { departmentId: "dept-1", name: "Billing Support" },
    });
    // CREATE only runs when no row matches the unique key (clean DB / first run).
    expect(args.create).toMatchObject({
      name: "Billing Support",
      departmentId: "dept-1",
      managerId: "mgr-new",
      isActive: true,
    });
  });

  it("rebinds a reused Team to the freshly seeded Manager on re-run (manager rebinding)", () => {
    // Run N+1: the prior seed Manager was deleted in STEP 2 cleanup; the
    // `Team.managerId` FK is ON DELETE SET NULL, so the surviving Team row has
    // `managerId = null`. The UPDATE branch must point it at the new Manager.
    const args = buildTeamUpsertArgs({ departmentId: "dept-1", name: "Payments Desk", managerId: "mgr-run2" });

    expect(args.update).toEqual({ managerId: "mgr-run2", isActive: true });
  });

  it("defines exactly 5 canonical Teams with unique (department, name) keys", () => {
    expect(SEED_TEAM_DEFS).toHaveLength(5);

    const keys = SEED_TEAM_DEFS.map((d) => `${d.department}::${d.name}`);
    expect(new Set(keys).size).toBe(5);

    // "Customer Support" holds two teams on purpose (cross-team isolation fixture).
    expect(SEED_TEAM_DEFS.filter((d) => d.department === "Customer Support")).toHaveLength(2);
  });
});

describe("resolveMessageAuthorId — customer message ownership", () => {
  const STAFF = "agent-staff-1";

  it("uses the ticket customer's OWN portal user for a customer turn", () => {
    // Customer A → userId A, Customer B → userId B, ticket belongs to Customer B.
    expect(
      resolveMessageAuthorId({ isCustomerTurn: true, customerUserId: "user-B", staffAuthorId: STAFF }),
    ).toBe("user-B");
  });

  it("never borrows another customer's identity when the ticket customer has no portal user", () => {
    const author = resolveMessageAuthorId({
      isCustomerTurn: true,
      customerUserId: null,
      staffAuthorId: STAFF,
    });

    // Support-authored fallback (Option A) — NOT portalCustomerUsers[0].
    expect(author).toBe(STAFF);
  });

  it("always attributes a support turn to staff, even for a portal customer's ticket", () => {
    expect(
      resolveMessageAuthorId({ isCustomerTurn: false, customerUserId: "user-B", staffAuthorId: STAFF }),
    ).toBe(STAFF);
  });
});

describe("seedTicketChannel — deterministic channel distribution (docs/25 Bug 2)", () => {
  const mix = Array.from({ length: SEED_COUNTS.tickets }, (_, i) => seedTicketChannel(i))
    .reduce<Record<string, number>>((acc, channel) => ({ ...acc, [channel]: (acc[channel] ?? 0) + 1 }), {});

  it("produces a non-zero count for every channel, SMS included", () => {
    for (const channel of ["WEB", "EMAIL", "WHATSAPP", "SMS", "LIVE_CHAT"]) {
      expect(mix[channel] ?? 0).toBeGreaterThan(0);
    }
  });

  it("keeps the total at exactly SEED_COUNTS.tickets and the legacy WEB/EMAIL/WHATSAPP split", () => {
    expect(Object.values(mix).reduce((a, b) => a + b, 0)).toBe(SEED_COUNTS.tickets);
    expect(mix.WEB).toBe(195);
    expect(mix.EMAIL).toBe(116);
    expect(mix.WHATSAPP).toBe(38);
    expect(mix.SMS + mix.LIVE_CHAT).toBe(38);
  });

  it("is a pure function of the index (deterministic, no PRNG)", () => {
    expect(seedTicketChannel(9)).toBe(seedTicketChannel(9));
    expect(seedTicketChannel(9)).toBe("SMS");
    expect(seedTicketChannel(19)).toBe("LIVE_CHAT");
  });
});
