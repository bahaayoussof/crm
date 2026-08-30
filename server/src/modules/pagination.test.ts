/**
 * Automated Pagination & Table QA Tests across Backend Modules
 *
 * Verifies:
 * - 1-based pagination offset calculation: skip = (page - 1) * limit
 * - Non-divisible total / totalPages calculation (remainder on last page)
 * - Empty state total = 0 -> totalPages = 0
 * - Search query filter applied to both records query and total count query
 * - Field filters applied to both records query and total count query
 * - RBAC authorization scoping: total and totalPages calculated AFTER authorization filters
 */
import { Role, TicketPriority, TicketStatus } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  userCount: vi.fn(),
  userFindUnique: vi.fn(),
  customerFindMany: vi.fn(),
  customerCount: vi.fn(),
  ticketFindMany: vi.fn(),
  ticketCount: vi.fn(),
  taskFindMany: vi.fn(),
  taskCount: vi.fn(),
  kbFindMany: vi.fn(),
  kbCount: vi.fn(),
  qrFindMany: vi.fn(),
  qrCount: vi.fn(),
  auditFindMany: vi.fn(),
  auditCount: vi.fn(),
  portalFindMany: vi.fn(),
  portalCount: vi.fn(),
  customerFindUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../config/prisma.js", () => ({
  prisma: {
    user: {
      findMany: mocks.userFindMany,
      count: mocks.userCount,
      findUnique: mocks.userFindUnique,
      findFirst: mocks.userFindUnique,
    },
    customer: {
      findMany: mocks.customerFindMany,
      count: mocks.customerCount,
      findUnique: mocks.customerFindUnique,
    },
    ticket: {
      findMany: mocks.ticketFindMany,
      count: mocks.ticketCount,
      groupBy: vi.fn().mockResolvedValue([]),
    },
    task: { findMany: mocks.taskFindMany, count: mocks.taskCount },
    knowledgeArticle: { findMany: mocks.kbFindMany, count: mocks.kbCount },
    quickReply: { findMany: mocks.qrFindMany, count: mocks.qrCount },
    auditLog: { findMany: mocks.auditFindMany, count: mocks.auditCount },
    $transaction: mocks.transaction,
  },
}));

import { app } from "../app.js";
import { createAccessToken } from "./auth/auth-token.js";

const adminToken = createAccessToken({ id: "admin-1", role: Role.ADMIN });
const managerToken = createAccessToken({ id: "manager-1", role: Role.MANAGER });
const agentToken = createAccessToken({ id: "agent-1", role: Role.AGENT });
const portalToken = createAccessToken({ id: "portal-cust-1", role: Role.CUSTOMER });

const auth = (token = adminToken) => ({ Authorization: `Bearer ${token}` });

describe("Pagination & Table Query Contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindUnique.mockResolvedValue({ id: "admin-1", isActive: true, role: Role.ADMIN });
    mocks.transaction.mockImplementation(async (queries: Promise<unknown>[]) =>
      Promise.all(queries)
    );
  });

  describe("Users Pagination (/api/users)", () => {
    it("calculates correct skip, take, and non-divisible totalPages", async () => {
      mocks.userFindMany.mockResolvedValue([{ id: "u-1", name: "User 1" }]);
      mocks.userCount.mockResolvedValue(43); // 43 users with limit 20 = 3 pages (20, 20, 3)

      const response = await request(app)
        .get("/api/users?page=2&limit=20")
        .set(auth(adminToken));

      expect(response.status).toBe(200);
      expect(mocks.userFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 })
      );
      expect(response.body.meta).toEqual({
        page: 2,
        limit: 20,
        total: 43,
        totalPages: 3,
      });
    });

    it("handles empty results with total = 0 and totalPages = 0", async () => {
      mocks.userFindMany.mockResolvedValue([]);
      mocks.userCount.mockResolvedValue(0);

      const response = await request(app)
        .get("/api/users?page=1&limit=20")
        .set(auth(adminToken));

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });

    it("applies search and status filters to both records and count queries", async () => {
      mocks.userFindMany.mockResolvedValue([]);
      mocks.userCount.mockResolvedValue(0);

      await request(app)
        .get("/api/users?search=Sarah&status=active&role=AGENT")
        .set(auth(adminToken));

      const expectedWhere = expect.objectContaining({
        isActive: true,
        role: "AGENT",
        AND: [
          expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: "Sarah", mode: "insensitive" } },
              { email: { contains: "Sarah", mode: "insensitive" } },
            ]),
          }),
        ],
      });

      expect(mocks.userFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere })
      );
      expect(mocks.userCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere })
      );
    });
  });

  describe("Customers Pagination (/api/customers)", () => {
    it("calculates correct skip and totalPages for 185 customers", async () => {
      mocks.customerFindMany.mockResolvedValue([]);
      mocks.customerCount.mockResolvedValue(185); // 185 / 20 = 10 pages

      const response = await request(app)
        .get("/api/customers?page=10&limit=20")
        .set(auth(agentToken));

      expect(response.status).toBe(200);
      expect(mocks.customerFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 180, take: 20 })
      );
      expect(response.body.meta).toEqual({
        page: 10,
        limit: 20,
        total: 185,
        totalPages: 10,
      });
    });

    it("applies search filter across name, email, and phone to both queries", async () => {
      mocks.customerFindMany.mockResolvedValue([]);
      mocks.customerCount.mockResolvedValue(0);

      await request(app)
        .get("/api/customers?search=Layla")
        .set(auth(agentToken));

      const expectedWhere = expect.objectContaining({
        OR: [
          { name: { contains: "Layla", mode: "insensitive" } },
          { email: { contains: "Layla", mode: "insensitive" } },
          { phone: { contains: "Layla", mode: "insensitive" } },
        ],
      });

      expect(mocks.customerFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere })
      );
      expect(mocks.customerCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere })
      );
    });
  });

  describe("Tickets Pagination & RBAC Scoping (/api/tickets)", () => {
    it("ADMIN sees unscoped tickets and global total", async () => {
      mocks.ticketFindMany.mockResolvedValue([]);
      mocks.ticketCount.mockResolvedValue(387);

      const response = await request(app)
        .get("/api/tickets?page=1&limit=20")
        .set(auth(adminToken));

      expect(response.status).toBe(200);
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 387,
        totalPages: 20,
      });

      // Admin has no visibility restriction
      expect(mocks.ticketFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            OR: expect.arrayContaining([{ assignedAgentId: expect.anything() }]),
          }),
        })
      );
    });

    it("AGENT query scopes both findMany and count to assigned or unassigned tickets", async () => {
      mocks.ticketFindMany.mockResolvedValue([]);
      mocks.ticketCount.mockResolvedValue(85); // Agent 1 sees only 85 tickets

      const response = await request(app)
        .get("/api/tickets?page=1&limit=20")
        .set(auth(agentToken));

      expect(response.status).toBe(200);
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 85,
        totalPages: 5,
      });

      const agentScope = expect.objectContaining({
        OR: [{ assignedAgentId: "agent-1" }, { assignedAgentId: null }],
      });

      expect(mocks.ticketFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: agentScope })
      );
      expect(mocks.ticketCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: agentScope })
      );
    });

    it("applies status, priority, and category filters to both queries", async () => {
      mocks.ticketFindMany.mockResolvedValue([]);
      mocks.ticketCount.mockResolvedValue(12);

      await request(app)
        .get("/api/tickets?status=OPEN&priority=HIGH&categoryId=cat-1")
        .set(auth(adminToken));

      const expectedWhere = expect.objectContaining({
        status: TicketStatus.OPEN,
        priority: TicketPriority.HIGH,
        categoryId: "cat-1",
      });

      expect(mocks.ticketFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere })
      );
      expect(mocks.ticketCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere })
      );
    });
  });

  describe("Tasks Pagination & RBAC Scoping (/api/tasks)", () => {
    it("MANAGER sees all tasks without actor scoping", async () => {
      mocks.taskFindMany.mockResolvedValue([]);
      mocks.taskCount.mockResolvedValue(107);

      const response = await request(app)
        .get("/api/tasks?page=1&limit=20")
        .set(auth(managerToken));

      expect(response.status).toBe(200);
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 107,
        totalPages: 6,
      });
    });

    it("AGENT query scopes both findMany and count to created or assigned tasks", async () => {
      mocks.taskFindMany.mockResolvedValue([]);
      mocks.taskCount.mockResolvedValue(18);

      const response = await request(app)
        .get("/api/tasks?page=1&limit=20")
        .set(auth(agentToken));

      expect(response.status).toBe(200);
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 18,
        totalPages: 1,
      });

      const agentScope = expect.objectContaining({
        OR: [{ creatorId: "agent-1" }, { assigneeId: "agent-1" }],
      });

      expect(mocks.taskFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: agentScope })
      );
      expect(mocks.taskCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: agentScope })
      );
    });
  });

  describe("Customer Portal Tickets Pagination (/api/portal/tickets)", () => {
    it("enforces customer profile ownership on both queries and calculates multi-page meta", async () => {
      mocks.customerFindUnique.mockResolvedValue({ id: "cust-profile-1" });
      mocks.ticketFindMany.mockResolvedValue([
        {
          id: "t-1",
          subject: "Portal request",
          status: TicketStatus.OPEN,
          category: { id: "cat-1", name: "Billing" },
          priority: TicketPriority.HIGH,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      mocks.ticketCount.mockResolvedValue(27); // 27 tickets = 2 pages at limit 20

      const response = await request(app)
        .get("/api/portal/tickets?page=2&limit=20")
        .set(auth(portalToken));

      expect(response.status).toBe(200);
      expect(mocks.ticketFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
          where: expect.objectContaining({ customerId: "cust-profile-1" }),
        })
      );
      expect(mocks.ticketCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerId: "cust-profile-1" }),
        })
      );
      expect(response.body.meta).toEqual({
        page: 2,
        limit: 20,
        total: 27,
        totalPages: 2,
      });
    });
  });
});
