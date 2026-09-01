import { Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  ticketFindFirst: vi.fn(),
  watcherFindMany: vi.fn(),
  watcherCreateMany: vi.fn(),
  watcherDeleteMany: vi.fn(),
  watcherCount: vi.fn(),
  watcherFindFirst: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    user: { findMany: mocks.userFindMany, findUnique: mocks.userFindUnique },
    ticket: { findFirst: mocks.ticketFindFirst },
    ticketWatcher: {
      findMany: mocks.watcherFindMany,
      createMany: mocks.watcherCreateMany,
      deleteMany: mocks.watcherDeleteMany,
      count: mocks.watcherCount,
      findFirst: mocks.watcherFindFirst,
    },
  },
}));

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";
import {
  applyNoteMentions,
  notifyWatchers,
  parseMentions,
} from "./collaboration.service.js";

const auth = (role: Role, id = role.toLowerCase()) => ({
  Authorization: `Bearer ${createAccessToken({ id, role })}`,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindMany.mockResolvedValue([]);
  mocks.userFindUnique.mockResolvedValue({ teamId: null, managedTeam: null });
  mocks.ticketFindFirst.mockResolvedValue({ id: "c737ce60fccf9da889f4605c0" });
  mocks.watcherFindMany.mockResolvedValue([]);
  mocks.watcherCreateMany.mockResolvedValue({ count: 1 });
  mocks.watcherDeleteMany.mockResolvedValue({ count: 1 });
  mocks.watcherCount.mockResolvedValue(0);
  mocks.watcherFindFirst.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// parseMentions — pure
// ---------------------------------------------------------------------------
describe("parseMentions", () => {
  it("extracts a single mention", () => {
    expect(parseMentions("hi @[Ahmed Hassan](usr_123) please look")).toEqual([
      { userId: "usr_123", name: "Ahmed Hassan" },
    ]);
  });

  it("extracts multiple mentions in order", () => {
    expect(parseMentions("@[A](u1) and @[B B](u2)")).toEqual([
      { userId: "u1", name: "A" },
      { userId: "u2", name: "B B" },
    ]);
  });

  it("deduplicates a repeated user id (first name wins)", () => {
    expect(parseMentions("@[Ann](u1) ... @[Ann again](u1)")).toEqual([
      { userId: "u1", name: "Ann" },
    ]);
  });

  it("keeps names containing spaces and punctuation", () => {
    expect(parseMentions("@[Dr. Mona El-Sayed](u9)")).toEqual([
      { userId: "u9", name: "Dr. Mona El-Sayed" },
    ]);
  });

  it("ignores malformed tokens", () => {
    expect(parseMentions("@Ahmed @[NoId] @[](u1) @[Name](  ) plain @ [x](y)")).toEqual([]);
  });

  it("returns [] for a body with no mentions", () => {
    expect(parseMentions("just a normal internal note")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GET /api/users/mentionable
// ---------------------------------------------------------------------------
describe("GET /api/users/mentionable", () => {
  it("rejects unauthenticated and CUSTOMER callers", async () => {
    expect((await request(app).get("/api/users/mentionable")).status).toBe(401);
    expect((await request(app).get("/api/users/mentionable").set(auth(Role.CUSTOMER))).status).toBe(403);
  });

  it.each([Role.ADMIN, Role.MANAGER, Role.AGENT])("allows %s and returns active internal users only", async (role) => {
    mocks.userFindMany.mockResolvedValue([{ id: "u1", name: "Ann", email: "ann@x.com" }]);
    const response = await request(app).get("/api/users/mentionable").set(auth(role));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([{ id: "u1", name: "Ann", email: "ann@x.com" }]);
    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true, role: { in: [Role.ADMIN, Role.MANAGER, Role.AGENT] } }),
        take: 10,
        select: { id: true, name: true, email: true },
      }),
    );
  });

  it("adds a name/email OR filter when search is provided", async () => {
    await request(app).get("/api/users/mentionable?search=mona").set(auth(Role.AGENT));
    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "mona", mode: "insensitive" } },
            { email: { contains: "mona", mode: "insensitive" } },
          ],
        }),
      }),
    );
  });

  it("rejects an unknown query parameter", async () => {
    expect((await request(app).get("/api/users/mentionable?role=ADMIN").set(auth(Role.AGENT))).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Ticket watcher endpoints
// ---------------------------------------------------------------------------
describe("ticket watcher endpoints", () => {
  it("rejects CUSTOMER on every watcher route", async () => {
    for (const call of [
      request(app).get("/api/tickets/c737ce60fccf9da889f4605c0/watchers"),
      request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/watchers"),
      request(app).delete("/api/tickets/c737ce60fccf9da889f4605c0/watchers/me"),
    ]) {
      expect((await call.set(auth(Role.CUSTOMER))).status).toBe(403);
    }
  });

  it("returns 404 when the ticket is not visible to the caller", async () => {
    mocks.ticketFindFirst.mockResolvedValue(null);
    expect((await request(app).get("/api/tickets/ce564b4081d7a9ea4b00dada5/watchers").set(auth(Role.AGENT))).status).toBe(404);
    expect((await request(app).post("/api/tickets/ce564b4081d7a9ea4b00dada5/watchers").set(auth(Role.AGENT))).status).toBe(404);
    expect((await request(app).delete("/api/tickets/ce564b4081d7a9ea4b00dada5/watchers/me").set(auth(Role.AGENT))).status).toBe(404);
  });

  it("scopes the visibility check to AGENT assigned-or-own-team-unassigned tickets", async () => {
    // feature/team-based-manager-scope: the AGENT's unassigned reach is narrowed
    // to their own team.
    mocks.userFindUnique.mockResolvedValue({ teamId: "team-1", managedTeam: null });
    await request(app).get("/api/tickets/c737ce60fccf9da889f4605c0/watchers").set(auth(Role.AGENT, "agent-1"));
    expect(mocks.ticketFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "c737ce60fccf9da889f4605c0",
          OR: [{ assignedAgentId: "agent-1" }, { assignedAgentId: null, teamId: "team-1" }],
        },
      }),
    );
  });

  it("lists watchers with a safe user projection", async () => {
    mocks.watcherFindMany.mockResolvedValue([
      { id: "w1", createdAt: new Date(), user: { id: "u1", name: "Ann", email: "ann@x.com" } },
    ]);
    const response = await request(app).get("/api/tickets/c737ce60fccf9da889f4605c0/watchers").set(auth(Role.MANAGER));
    expect(response.status).toBe(200);
    expect(response.body.data[0].user).toEqual({ id: "u1", name: "Ann", email: "ann@x.com" });
    expect(mocks.watcherFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ticketId: "c737ce60fccf9da889f4605c0" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    );
  });

  it("self-watch is idempotent (skipDuplicates) and reports the current state", async () => {
    mocks.watcherCount.mockResolvedValue(3);
    mocks.watcherFindFirst.mockResolvedValue({ id: "w1" });
    const response = await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/watchers").set(auth(Role.AGENT, "ccfad431af89dd48c0fe73ace"));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ watching: true, watcherCount: 3 });
    expect(mocks.watcherCreateMany).toHaveBeenCalledWith({
      data: [{ ticketId: "c737ce60fccf9da889f4605c0", userId: "ccfad431af89dd48c0fe73ace" }],
      skipDuplicates: true,
    });
  });

  it("self-unwatch succeeds even when no watcher row exists", async () => {
    mocks.watcherDeleteMany.mockResolvedValue({ count: 0 });
    mocks.watcherCount.mockResolvedValue(0);
    const response = await request(app).delete("/api/tickets/c737ce60fccf9da889f4605c0/watchers/me").set(auth(Role.AGENT, "ccfad431af89dd48c0fe73ace"));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ watching: false, watcherCount: 0 });
    expect(mocks.watcherDeleteMany).toHaveBeenCalledWith({ where: { ticketId: "c737ce60fccf9da889f4605c0", userId: "ccfad431af89dd48c0fe73ace" } });
  });

  // feature/team-based-manager-scope — watchers of another team's ticket are unreachable by direct id
  it("team-scopes the visibility check for a MANAGER (404 on another team's ticket)", async () => {
    mocks.userFindUnique.mockResolvedValue({ teamId: "team-1", managedTeam: { id: "team-1" } });
    mocks.ticketFindFirst.mockResolvedValue(null); // team-scoped where excludes it
    const response = await request(app).get("/api/tickets/c737ce60fccf9da889f4605c0/watchers").set(auth(Role.MANAGER));
    expect(response.status).toBe(404);
    expect(mocks.ticketFindFirst.mock.calls[0][0].where).toMatchObject({ id: "c737ce60fccf9da889f4605c0", teamId: "team-1" });
  });
});

// ---------------------------------------------------------------------------
// applyNoteMentions / notifyWatchers — transaction helpers
// ---------------------------------------------------------------------------
function fakeTx() {
  return {
    user: { findMany: vi.fn().mockResolvedValue([]) },
    ticketMention: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    ticketWatcher: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    notification: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
}

describe("applyNoteMentions", () => {
  const baseInput = {
    ticketId: "c737ce60fccf9da889f4605c0",
    noteId: "cea503d892f34f0298079b79d",
    authorUserId: "author-1",
    authorName: "Sara",
    ticketSubject: "Login broken",
  };

  it("resolves only active internal users, drops the author, and writes mention rows + notifications + watchers", async () => {
    const tx = fakeTx();
    tx.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
    const result = await applyNoteMentions(tx as never, {
      ...baseInput,
      body: "@[U1](u1) @[U2](u2) @[Me](author-1) @[Ghost](ghost)",
    });
    expect(result).toEqual(["u1", "u2"]);
    // author-1 is filtered out before the DB lookup
    expect(tx.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["u1", "u2", "ghost"] },
          isActive: true,
          role: { in: [Role.ADMIN, Role.MANAGER, Role.AGENT] },
        }),
      }),
    );
    expect(tx.ticketMention.createMany).toHaveBeenCalledWith({
      data: [
        { noteId: "cea503d892f34f0298079b79d", mentionedUserId: "u1", ticketId: "c737ce60fccf9da889f4605c0" },
        { noteId: "cea503d892f34f0298079b79d", mentionedUserId: "u2", ticketId: "c737ce60fccf9da889f4605c0" },
      ],
      skipDuplicates: true,
    });
    // author + mentioned users are auto-watched
    expect(tx.ticketWatcher.createMany).toHaveBeenCalledWith({
      data: [
        { ticketId: "c737ce60fccf9da889f4605c0", userId: "author-1" },
        { ticketId: "c737ce60fccf9da889f4605c0", userId: "u1" },
        { ticketId: "c737ce60fccf9da889f4605c0", userId: "u2" },
      ],
      skipDuplicates: true,
    });
    expect(tx.notification.createMany).toHaveBeenCalledTimes(1);
    const notifyArg = tx.notification.createMany.mock.calls[0][0];
    expect(notifyArg.data).toHaveLength(2);
    expect(notifyArg.data[0]).toMatchObject({ userId: "u1", type: "TICKET_MENTION", ticketId: "c737ce60fccf9da889f4605c0" });
  });

  it("still auto-watches the author when there are no mentions and writes nothing else", async () => {
    const tx = fakeTx();
    const result = await applyNoteMentions(tx as never, { ...baseInput, body: "no mentions here" });
    expect(result).toEqual([]);
    expect(tx.user.findMany).not.toHaveBeenCalled();
    expect(tx.ticketMention.createMany).not.toHaveBeenCalled();
    expect(tx.notification.createMany).not.toHaveBeenCalled();
    expect(tx.ticketWatcher.createMany).toHaveBeenCalledWith({
      data: [{ ticketId: "c737ce60fccf9da889f4605c0", userId: "author-1" }],
      skipDuplicates: true,
    });
  });
});

describe("notifyWatchers", () => {
  it("excludes the actor and explicitly excluded ids, and dedupes the rest", async () => {
    const tx = fakeTx();
    tx.ticketWatcher.findMany.mockResolvedValue([
      { userId: "actor" },
      { userId: "already" },
      { userId: "w1" },
      { userId: "w1" },
    ]);
    await notifyWatchers(tx as never, {
      ticketId: "c737ce60fccf9da889f4605c0",
      actorUserId: "actor",
      type: "TICKET_WATCH_ACTIVITY",
      title: "t",
      message: "m",
      excludeUserIds: ["already"],
    });
    expect(tx.notification.createMany).toHaveBeenCalledTimes(1);
    const data = tx.notification.createMany.mock.calls[0][0].data;
    expect(data.map((d: { userId: string }) => d.userId)).toEqual(["w1"]);
  });

  it("writes nothing when every watcher is excluded", async () => {
    const tx = fakeTx();
    tx.ticketWatcher.findMany.mockResolvedValue([{ userId: "actor" }]);
    await notifyWatchers(tx as never, {
      ticketId: "c737ce60fccf9da889f4605c0",
      actorUserId: "actor",
      type: "TICKET_WATCH_ACTIVITY",
      title: "t",
      message: "m",
    });
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });
});
