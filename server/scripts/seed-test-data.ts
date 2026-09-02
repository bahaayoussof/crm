/**
 * Comprehensive Test Dataset Generator for Pagination, Filtering, Search & Table QA.
 *
 * Designed for:
 * - Realistic volume across all entities
 * - Multi-page verification for all tables (Users, Customers, Tickets, Tasks, KB, Quick Replies, Audit Logs)
 * - Deterministic output via seeded PRNG (no uncontrolled random data)
 * - Safe idempotency: cleanly cleans prior seed records before re-inserting
 * - Production safety: strictly blocked when NODE_ENV === "production"
 * - Preserves existing production/admin accounts (e.g. bahaa@crm.com, whatsapp-inbound)
 *
 * Usage from server directory:
 *   npx tsx scripts/seed-test-data.ts
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import {
  Channel,
  KnowledgeArticleStatus,
  Prisma,
  PrismaClient,
  Role,
  TaskStatus,
  TicketPriority,
  TicketStatus,
} from "@prisma/client";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../src/modules/audit-logs/audit-log.constants.js";

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production") {
  throw new Error("seed-test-data is a development helper and must not run with NODE_ENV=production");
}

// ---------------------------------------------------------------------------
// Deterministic Seeded PRNG (Mulberry32)
// ---------------------------------------------------------------------------
function createRng(seed = 42) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createRng(20260830);

function randomInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// Generates a date in the past [0, maxDaysAgo] with a bias towards recent days
function randomRecentDate(base: Date, maxDaysAgo = 180): Date {
  const factor = Math.pow(rng(), 1.7); // bias towards 0 (more recent)
  const msAgo = factor * maxDaysAgo * 86_400_000;
  return new Date(base.getTime() - msAgo);
}

// ---------------------------------------------------------------------------
// Identifier & Domain conventions
// ---------------------------------------------------------------------------
const SEED_EMAIL_DOMAIN = "crm.local";
const SEED_CUST_DOMAIN = "testcrm.io";
const DEFAULT_PASSWORD = "password123";

// ---------------------------------------------------------------------------
// Realistic Data Pools
// ---------------------------------------------------------------------------
const FIRST_NAMES = [
  "Liam", "Noah", "Oliver", "James", "Elijah", "William", "Henry", "Lucas", "Benjamin", "Theodore",
  "Mateo", "Alexander", "Daniel", "Samuel", "Sebastian", "Jack", "Aiden", "Owen", "Gabriel", "Carter",
  "Emma", "Olivia", "Charlotte", "Amelia", "Sophia", "Isabella", "Ava", "Mia", "Evelyn", "Harper",
  "Luna", "Camila", "Gianna", "Elizabeth", "Eleanor", "Ella", "Abigail", "Avery", "Scarlett", "Emily",
  "Tariq", "Kareem", "Ziad", "Omar", "Youssef", "Ahmed", "Mahmoud", "Mostafa", "Rami", "Khaled",
  "Faris", "Sami", "Hani", "Nabil", "Hamza", "Adel", "Bassam", "Marwan", "Waleed", "Hassan",
  "Layla", "Nour", "Yasmin", "Mariam", "Salma", "Dina", "Rana", "Huda", "Fatima", "Reem",
  "Maya", "Sarah", "Lina", "Mona", "Zeina", "Jana", "Amina", "Nadia", "Soraya", "Farida",
] as const;

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
  "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
  "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
  "Mansoor", "Al-Fassi", "Kabbani", "Haddad", "Najjar", "Boulos", "Khoury", "Al-Sayed", "Tamer", "Darwish",
  "Sabbagh", "Zahrani", "Ghanem", "Qasim", "Badawi", "Masri", "Shami", "Halabi", "Obeid", "Sayegh",
  "Barakat", "Attia", "Soliman", "Nasser", "Fahmy", "Gouda", "Allam", "Metwally", "Shawky", "Gabr",
] as const;

const PHONE_PREFIXES = [
  "+2010", "+2011", "+2012", "+2015", // Egypt
  "+96650", "+96655", "+96658",       // Saudi Arabia
  "+97150", "+97152", "+97155",       // UAE
  "+1202", "+1312", "+1415", "+1646", // USA
  "+4477", "+4478", "+4479",          // UK
] as const;

const TICKET_SUBJECT_TEMPLATES = [
  // Authentication & Access
  "Unable to log into customer portal",
  "Password reset verification link expired",
  "Two-Factor Authentication (2FA) SMS not received",
  "Account temporarily locked after failed logins",
  "SSO integration throwing SAML response error",
  "Session abruptly disconnecting during form submission",
  "User role permissions not applying correctly",
  // Billing & Payment
  "Invoice discrepancy for monthly subscription",
  "Credit card charged twice for annual license",
  "Payment gateway returned transaction code 4002",
  "Requesting VAT invoice and tax exemption certificate",
  "Subscription auto-renewal cancellation request",
  "Refund requested for duplicate charge",
  "Cannot update billing payment method on file",
  "Wire transfer payment proof submission",
  // Shipping & Orders
  "Order tracking status has not updated in 7 days",
  "Shipment damaged in transit - photos attached",
  "Incorrect item delivered in order shipment",
  "Requesting address change before courier dispatch",
  "Customs clearance documentation required",
  "Delivery courier marked package delivered but not received",
  // Technical & Application
  "API endpoint returning 504 Gateway Timeout",
  "File attachment upload fails with size error",
  "Mobile app crashes when opening ticket conversation",
  "Data table export missing column headers",
  "Search filter not returning Arabic character matches",
  "Webhook notifications failing SSL handshake",
  "Dashboard chart metrics not updating in real time",
  "Rich text editor formatting lost on message submit",
  // Products & Feature Requests
  "Question about multi-department routing capabilities",
  "Feature request: custom SLA rules per customer tier",
  "Inquiry regarding WhatsApp business channel setup",
  "Requesting technical demo for enterprise migration",
  "Knowledge Base article feedback on API keys",
  "Clarification on data retention and backup schedule",
] as const;

const SAMPLE_PARAGRAPHS = [
  "Hello Support Team, I am writing regarding an issue I encountered recently. Could you please investigate and advise on the resolution?",
  "Thank you for looking into this. I have verified the details on my end and followed the troubleshooting steps, but the problem persists.",
  "Here are the specific details of the error encountered: the operation timed out after approximately 30 seconds and displayed an alert.",
  "We have escalated this internally and our engineering team is reviewing the system logs to identify the root cause.",
  "Please find the requested information. Let me know if you need any additional diagnostic logs or screenshots.",
  "I appreciate the prompt response. The suggested solution worked seamlessly and the service has been restored.",
  "We have applied the configuration update and monitored the results over the past few hours. Everything appears stable now.",
] as const;

// ---------------------------------------------------------------------------
// Team & conversation seed helpers (pure — unit-tested in
// scripts/seed-test-data.helpers.test.ts)
// ---------------------------------------------------------------------------
/**
 * Canonical seeded Teams. `departmentId + name` is the `Team` unique key, so the
 * seed upserts on it (see {@link buildTeamUpsertArgs}) instead of blind-creating.
 * Repeated runs therefore reuse these five rows rather than colliding on
 * `Team_departmentId_name_key`. "Customer Support" intentionally holds TWO teams
 * so cross-team isolation can be verified inside a single department.
 */
export const SEED_TEAM_DEFS = [
  { name: "Billing Support", department: "Customer Support", managerIndex: 0 },
  { name: "Technical Support", department: "Customer Support", managerIndex: 1 },
  { name: "Field Operations", department: "Field Services", managerIndex: 2 },
  { name: "Onboarding Squad", department: "Onboarding", managerIndex: 3 },
  { name: "Payments Desk", department: "Billing Operations", managerIndex: 4 },
] as const;

/**
 * Prisma `team.upsert` args keyed on the `Team` unique constraint
 * (`departmentId` + `name`). The seed must be re-runnable: STEP 2 cleanup deletes
 * seed *Users* (managers included) but never Teams, and the `Team.managerId` FK
 * is `ON DELETE SET NULL`, so a prior run leaves the Team row in place with
 * `managerId = null`. The UPDATE branch re-points it at the freshly created
 * Manager and refreshes `isActive`; the CREATE branch only runs on a clean DB.
 */
export function buildTeamUpsertArgs(input: {
  departmentId: string;
  name: string;
  managerId: string;
}) {
  const { departmentId, name, managerId } = input;
  return {
    where: { departmentId_name: { departmentId, name } },
    create: { name, departmentId, managerId, isActive: true },
    update: { managerId, isActive: true },
    select: { id: true, name: true, departmentId: true },
  } as const;
}

/**
 * Resolves the author for a seeded `TicketMessage`.
 *
 * A customer-authored message must be attributed to the authenticated portal
 * `User` of THIS ticket's own customer — never `portalCustomerUsers[0]` or any
 * other unrelated account. When the ticket's customer has no portal `User` (the
 * common case: only 5 of 185 seed customers have login accounts), the customer
 * turn is emitted as support-authored history instead (Option A). This keeps the
 * message volume and cadence deterministic while guaranteeing every
 * customer-authored row is relationally valid.
 */
export function resolveMessageAuthorId(input: {
  isCustomerTurn: boolean;
  customerUserId: string | null;
  staffAuthorId: string;
}): string {
  const { isCustomerTurn, customerUserId, staffAuthorId } = input;
  if (isCustomerTurn && customerUserId) return customerUserId;
  return staffAuthorId;
}

// ---------------------------------------------------------------------------
// Seed Data Counts (Intentionally non-round to test pagination & last-page QA)
// ---------------------------------------------------------------------------
export const SEED_COUNTS = {
  adminUsers: 3,
  managerUsers: 5,
  agentUsers: 35,      // 33 active, 2 inactive
  portalCustomers: 5,  // Authenticated customer users
  customers: 185,      // Non-round (185 customers = 10 pages at 20/page)
  tickets: 387,        // Non-round (387 tickets = 20 pages at 20/page)
  tasks: 107,          // Non-round (107 tasks = 6 pages at 20/page)
  knowledgeArticles: 63, // Non-round (63 articles = 4 pages at 20/page)
  quickReplies: 47,    // Non-round (47 replies = 3 pages at 20/page)
  auditLogs: 412,      // Non-round (412 logs = 21 pages at 20/page)
  notifications: 85,   // Multi-user read/unread
};

// ---------------------------------------------------------------------------
// Master Seed Runner
// ---------------------------------------------------------------------------
export async function seedTestData() {
  console.log("\n=======================================================");
  console.log("  CRM COMPREHENSIVE TEST DATA GENERATOR");
  console.log("=======================================================\n");

  const now = new Date();
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  // -------------------------------------------------------------------------
  // STEP 1: Define Categories
  // -------------------------------------------------------------------------
  console.log("[1/10] Upserting Categories...");
  const categoryDefs = [
    { name: "Billing & Payments", description: "Invoicing, refunds, payment gateway issues, and subscription billing" },
    { name: "Technical Support", description: "Software bugs, application crashes, performance issues, and error codes" },
    { name: "Account & Security", description: "Login issues, password resets, 2FA configuration, and access permissions" },
    { name: "Product & Features", description: "General product questions, feature requests, and usage guidance" },
    { name: "Shipping & Delivery", description: "Order tracking, delivery delays, carrier issues, and address corrections" },
    { name: "Returns & Exchanges", description: "Product returns, RMA requests, warranty claims, and damaged shipments" },
    { name: "Onboarding & Setup", description: "New account onboarding, initial configuration, and team setup" },
    { name: "Integrations & API", description: "REST API, webhook integration, third-party connectors, and SSO" },
    { name: "Mobile Application", description: "iOS and Android app specific inquiries, crashes, and sync issues" },
    { name: "General Inquiries", description: "Miscellaneous questions and general customer service" },
  ];

  const categories: { id: string; name: string }[] = [];
  for (const def of categoryDefs) {
    const cat = await prisma.category.upsert({
      where: { name: def.name },
      create: { name: def.name, description: def.description, isActive: true },
      update: { description: def.description, isActive: true },
      select: { id: true, name: true },
    });
    categories.push(cat);
  }
  console.log(`  ✓ ${categories.length} Categories ready.`);

  // SLA rules — one active rule per priority (used by ticket creation / SLA
  // automation). Idempotent on the unique `priority`.
  const slaDefs = [
    { priority: TicketPriority.URGENT, firstResponseMinutes: 15, resolutionMinutes: 240 },
    { priority: TicketPriority.HIGH, firstResponseMinutes: 60, resolutionMinutes: 1440 },
    { priority: TicketPriority.MEDIUM, firstResponseMinutes: 120, resolutionMinutes: 2880 },
    { priority: TicketPriority.LOW, firstResponseMinutes: 240, resolutionMinutes: 5760 },
  ];
  for (const def of slaDefs) {
    await prisma.slaRule.upsert({
      where: { priority: def.priority },
      create: { ...def, isActive: true },
      update: { firstResponseMinutes: def.firstResponseMinutes, resolutionMinutes: def.resolutionMinutes, isActive: true },
    });
  }
  console.log(`  ✓ ${slaDefs.length} SLA rules ready.`);

  // -------------------------------------------------------------------------
  // STEP 1b: Branches & Departments (organizational entities). Idempotent by
  // name; not tied to seed-user ids, so they persist across re-seeds and their
  // ids stay stable. Assigned to staff users and a subset of tickets below.
  // -------------------------------------------------------------------------
  console.log("[1b/10] Upserting Branches & Departments...");
  const branchDefs = [
    { name: "Headquarters", code: "HQ", address: "100 Central Plaza, Metro City" },
    { name: "North Regional Office", code: "NRO", address: "22 Pine Avenue, Northgate" },
    { name: "West Coast Hub", code: "WCH", address: "9 Harbor Blvd, Bayside" },
    { name: "Remote / Distributed", code: "RMT", address: null },
  ];
  const branches: { id: string; name: string }[] = [];
  for (const def of branchDefs) {
    const row = await prisma.branch.upsert({
      where: { name: def.name },
      create: { name: def.name, code: def.code, address: def.address, isActive: true },
      update: { code: def.code, address: def.address, isActive: true },
      select: { id: true, name: true },
    });
    branches.push(row);
  }
  const branchByName = new Map(branches.map((b) => [b.name, b.id]));

  const departmentDefs: { name: string; description: string; branch: string | null }[] = [
    { name: "Customer Support", description: "First-line customer support queue", branch: "Headquarters" },
    { name: "Technical Support", description: "Escalated technical troubleshooting", branch: "Headquarters" },
    { name: "Billing Operations", description: "Invoicing, refunds and payment disputes", branch: "Headquarters" },
    { name: "Field Services", description: "On-site installation and repair", branch: "North Regional Office" },
    { name: "Sales Engineering", description: "Pre-sales and integration support", branch: "West Coast Hub" },
    { name: "Onboarding", description: "New account onboarding and setup", branch: "West Coast Hub" },
    { name: "Quality Assurance", description: "Support quality review", branch: "Remote / Distributed" },
    { name: "Escalations", description: "Cross-branch escalation handling", branch: null },
  ];
  const departments: { id: string; name: string; branchId: string | null }[] = [];
  for (const def of departmentDefs) {
    const branchId = def.branch ? branchByName.get(def.branch) ?? null : null;
    const existing = await prisma.department.findFirst({ where: { name: def.name }, select: { id: true } });
    const row = existing
      ? await prisma.department.update({
          where: { id: existing.id },
          data: { description: def.description, branchId, isActive: true },
          select: { id: true, name: true, branchId: true },
        })
      : await prisma.department.create({
          data: { name: def.name, description: def.description, branchId, isActive: true },
          select: { id: true, name: true, branchId: true },
        });
    departments.push(row);
  }
  console.log(`  ✓ ${branches.length} Branches and ${departments.length} Departments ready.`);

  // -------------------------------------------------------------------------
  // STEP 2: Clean up previous seed data (Child-first for FK safety)
  // -------------------------------------------------------------------------
  console.log("[2/10] Cleaning prior test seed records (idempotent reset)...");

  const SEED_USER_EMAILS = [
    "admin1@crm.local", "admin2@crm.local", "admin3@crm.local", "bahaa@crm.com",
    ...Array.from({ length: 5 }, (_, i) => `manager${i + 1}@crm.local`),
    ...Array.from({ length: 35 }, (_, i) => `agent${i + 1}@crm.local`),
    "portal.customer@crm.local",
    "portal.customer2@crm.local",
    "portal.customer3@crm.local",
    "portal.customer4@crm.local",
    "portal.customer5@crm.local",
  ];

  // Find previous seed users and customers
  const priorSeedUsers = await prisma.user.findMany({
    where: { email: { in: SEED_USER_EMAILS } },
    select: { id: true },
  });
  const priorSeedUserIds = priorSeedUsers.map((u) => u.id);

  const priorSeedCustomers = await prisma.customer.findMany({
    where: { email: { endsWith: `@${SEED_CUST_DOMAIN}` } },
    select: { id: true },
  });
  // Also include portal customers
  const priorPortalCustomers = await prisma.customer.findMany({
    where: { email: { in: ["portal.customer@crm.local", "portal.customer2@crm.local", "portal.customer3@crm.local", "portal.customer4@crm.local", "portal.customer5@crm.local"] } },
    select: { id: true },
  });
  const priorSeedCustomerIds = [...priorSeedCustomers.map((c) => c.id), ...priorPortalCustomers.map((c) => c.id)];

  if (priorSeedCustomerIds.length > 0 || priorSeedUserIds.length > 0) {
    // Find tickets belonging to seed customers
    const priorTickets = await prisma.ticket.findMany({
      where: { customerId: { in: priorSeedCustomerIds } },
      select: { id: true },
    });
    const priorTicketIds = priorTickets.map((t) => t.id);

    // Delete in child-first dependency order
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: priorSeedUserIds } },
          { entityType: "TICKET", entityId: { in: priorTicketIds } },
          { entityType: "CUSTOMER", entityId: { in: priorSeedCustomerIds } },
          { entityType: "USER", entityId: { in: priorSeedUserIds } },
        ],
      },
    });

    await prisma.notification.deleteMany({
      where: {
        OR: [
          { userId: { in: priorSeedUserIds } },
          { ticketId: { in: priorTicketIds } },
        ],
      },
    });

    await prisma.ticketMention.deleteMany({
      where: {
        OR: [
          { ticketId: { in: priorTicketIds } },
          { mentionedUserId: { in: priorSeedUserIds } },
        ],
      },
    });

    await prisma.ticketWatcher.deleteMany({
      where: {
        OR: [
          { ticketId: { in: priorTicketIds } },
          { userId: { in: priorSeedUserIds } },
        ],
      },
    });

    await prisma.feedback.deleteMany({
      where: {
        OR: [
          { ticketId: { in: priorTicketIds } },
          { customerId: { in: priorSeedCustomerIds } },
        ],
      },
    });

    await prisma.attachment.deleteMany({
      where: {
        OR: [
          { ticketId: { in: priorTicketIds } },
          { customerId: { in: priorSeedCustomerIds } },
        ],
      },
    });

    await prisma.ticketMessage.deleteMany({
      where: { ticketId: { in: priorTicketIds } },
    });

    await prisma.ticketNote.deleteMany({
      where: { ticketId: { in: priorTicketIds } },
    });

    await prisma.ticketHistory.deleteMany({
      where: { ticketId: { in: priorTicketIds } },
    });

    await prisma.customerNote.deleteMany({
      where: { customerId: { in: priorSeedCustomerIds } },
    });

    await prisma.task.deleteMany({
      where: {
        OR: [
          { creatorId: { in: priorSeedUserIds } },
          { assigneeId: { in: priorSeedUserIds } },
          { ticketId: { in: priorTicketIds } },
        ],
      },
    });

    await prisma.knowledgeArticle.deleteMany({
      where: { createdById: { in: priorSeedUserIds } },
    });

    await prisma.quickReply.deleteMany({
      where: { createdById: { in: priorSeedUserIds } },
    });

    await prisma.ticket.deleteMany({
      where: { id: { in: priorTicketIds } },
    });

    await prisma.customer.deleteMany({
      where: { id: { in: priorSeedCustomerIds } },
    });

    await prisma.user.deleteMany({
      where: { id: { in: priorSeedUserIds } },
    });

    console.log(`  ✓ Purged prior seed data (${priorTickets.length} tickets, ${priorSeedCustomers.length} customers, ${priorSeedUsers.length} users).`);
  } else {
    console.log("  ✓ No prior test seed records found. Clean slate.");
  }

  // -------------------------------------------------------------------------
  // STEP 3: Seed Internal Users (Admin, Manager, Agent) & Portal Customers
  // -------------------------------------------------------------------------
  console.log("[3/10] Seeding Users (Admins, Managers, Agents, Portal Customers)...");
  
  const adminUsers: { id: string; name: string; email: string; role: Role }[] = [];
  const managerUsers: { id: string; name: string; email: string; role: Role }[] = [];
  const agentUsers: { id: string; name: string; email: string; role: Role; isActive: boolean }[] = [];
  const portalCustomerUsers: { id: string; name: string; email: string; role: Role }[] = [];

  // Admins
  const adminDefs = [
    { name: "Sarah Connor", email: `admin1@${SEED_EMAIL_DOMAIN}` },
    { name: "Omar Farooq", email: `admin2@${SEED_EMAIL_DOMAIN}` },
    { name: "Elena Rostova", email: `admin3@${SEED_EMAIL_DOMAIN}` },
  ];
  for (const def of adminDefs) {
    const user = await prisma.user.create({
      data: { name: def.name, email: def.email, passwordHash, role: Role.ADMIN, isActive: true },
      select: { id: true, name: true, email: true, role: true },
    });
    adminUsers.push(user);
  }

  // Convenience ADMIN for manual QA (short credentials — dev only; the password
  // is bcrypt-hashed here just like every other seed account, never plaintext).
  const bahaa = await prisma.user.create({
    data: {
      name: "Bahaa",
      email: "bahaa@crm.com",
      passwordHash: await bcrypt.hash("123", 12),
      role: Role.ADMIN,
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true },
  });
  adminUsers.push(bahaa);

  // Managers
  const managerDefs = [
    { name: "Marcus Vance", email: `manager1@${SEED_EMAIL_DOMAIN}` },
    { name: "Maya Lin", email: `manager2@${SEED_EMAIL_DOMAIN}` },
    { name: "Tariq Al-Mansoor", email: `manager3@${SEED_EMAIL_DOMAIN}` },
    { name: "Chloe Dubois", email: `manager4@${SEED_EMAIL_DOMAIN}` },
    { name: "David Kim", email: `manager5@${SEED_EMAIL_DOMAIN}` },
  ];
  for (const def of managerDefs) {
    const user = await prisma.user.create({
      data: { name: def.name, email: def.email, passwordHash, role: Role.MANAGER, isActive: true },
      select: { id: true, name: true, email: true, role: true },
    });
    managerUsers.push(user);
  }

  // Agents (35 total: 33 active, 2 inactive)
  for (let i = 1; i <= SEED_COUNTS.agentUsers; i++) {
    const firstName = FIRST_NAMES[(i * 3) % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(i * 5) % LAST_NAMES.length];
    const name = `${firstName} ${lastName}`;
    const email = `agent${i}@${SEED_EMAIL_DOMAIN}`;
    const isActive = i <= 33; // Agents 34 & 35 are inactive for status filter testing
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: Role.AGENT, isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    agentUsers.push(user);
  }

  // Portal Customers (5 authenticated customer users)
  const portalDefs = [
    { name: "Layla Hassan (VIP Customer)", email: `portal.customer@${SEED_EMAIL_DOMAIN}` },
    { name: "Jonathan Miller (Enterprise)", email: `portal.customer2@${SEED_EMAIL_DOMAIN}` },
    { name: "Amina Idris (Frequent Buyer)", email: `portal.customer3@${SEED_EMAIL_DOMAIN}` },
    { name: "Robert Novak (Partner)", email: `portal.customer4@${SEED_EMAIL_DOMAIN}` },
    { name: "Sofia Rossi (Consumer)", email: `portal.customer5@${SEED_EMAIL_DOMAIN}` },
  ];
  for (const def of portalDefs) {
    const user = await prisma.user.create({
      data: { name: def.name, email: def.email, passwordHash, role: Role.CUSTOMER, isActive: true },
      select: { id: true, name: true, email: true, role: true },
    });
    portalCustomerUsers.push(user);
  }

  const allStaffUsers = [...adminUsers, ...managerUsers, ...agentUsers];

  // -------------------------------------------------------------------------
  // STEP 3b: Teams (feature/team-based-manager-scope)
  //
  //   Department ─▶ Team ─▶ { Manager, Agents, Tickets }
  //
  // V1 invariants: exactly one Team per Manager, one Team per Agent. Every agent
  // (active and inactive) is placed in a team; every manager both belongs to and
  // manages exactly one team. "Customer Support" deliberately holds TWO teams so
  // cross-team isolation can be verified inside a single department
  // (Billing Support vs Technical Support).
  // -------------------------------------------------------------------------
  const deptByName = new Map(departments.map((d) => [d.name, d]));
  const teamPlan = SEED_TEAM_DEFS.map((def) => ({
    name: def.name,
    department: def.department,
    manager: managerUsers[def.managerIndex],
  }));

  // Idempotent Team seeding. STEP 2 cleanup deletes the seed Users (managers
  // included) but NOT Teams; the `Team.managerId` FK is `ON DELETE SET NULL`, so
  // on a re-run each canonical Team row still exists with `managerId = null`.
  // Upserting on the `Team` unique key (`departmentId` + `name`) reuses that row
  // and rebinds it to the Manager created moments ago in STEP 3 — no
  // `Team_departmentId_name_key` collision, no duplicate Teams, and unrelated
  // real Teams are never touched.
  const teams: { id: string; name: string; departmentId: string; branchId: string | null; managerId: string }[] = [];
  for (const plan of teamPlan) {
    const dept = deptByName.get(plan.department)!;
    const team = await prisma.team.upsert(
      buildTeamUpsertArgs({ departmentId: dept.id, name: plan.name, managerId: plan.manager.id }),
    );
    teams.push({ ...team, branchId: dept.branchId, managerId: plan.manager.id });
  }

  // staffOrg / teamOfUser: department + branch + team for every manager and agent,
  // always internally consistent (the team's department, that department's branch)
  // so SLA auto-assignment eligibility and the ticket/team/department checks match.
  const staffOrg = new Map<string, { departmentId: string; branchId: string | null }>();
  const teamOfUser = new Map<string, { teamId: string; departmentId: string; branchId: string | null }>();

  for (let m = 0; m < managerUsers.length; m++) {
    const team = teams[m];
    await prisma.user.update({
      where: { id: managerUsers[m].id },
      data: { teamId: team.id, departmentId: team.departmentId, branchId: team.branchId },
    });
    staffOrg.set(managerUsers[m].id, { departmentId: team.departmentId, branchId: team.branchId });
    teamOfUser.set(managerUsers[m].id, { teamId: team.id, departmentId: team.departmentId, branchId: team.branchId });
  }

  const AGENTS_PER_TEAM = Math.ceil(agentUsers.length / teams.length);
  for (let a = 0; a < agentUsers.length; a++) {
    const team = teams[Math.min(Math.floor(a / AGENTS_PER_TEAM), teams.length - 1)];
    await prisma.user.update({
      where: { id: agentUsers[a].id },
      data: { teamId: team.id, departmentId: team.departmentId, branchId: team.branchId },
    });
    staffOrg.set(agentUsers[a].id, { departmentId: team.departmentId, branchId: team.branchId });
    teamOfUser.set(agentUsers[a].id, { teamId: team.id, departmentId: team.departmentId, branchId: team.branchId });
  }

  console.log(`  ✓ Seeded ${allStaffUsers.length} staff users (4 Admins incl. bahaa@crm.com, 5 Managers, 35 Agents [33 active, 2 inactive]) and 5 Portal Customer users.`);
  console.log(`  ✓ Created ${teams.length} Teams; every Manager and Agent has an explicit team.`);

  // -------------------------------------------------------------------------
  // STEP 4: Seed Customers (185 records)
  // -------------------------------------------------------------------------
  console.log(`[4/10] Seeding ${SEED_COUNTS.customers} Customers with varied metadata...`);
  const customers: { id: string; name: string; email: string; userId: string | null }[] = [];

  for (let i = 0; i < SEED_COUNTS.customers; i++) {
    let name: string;
    let email: string;
    let userId: string | null = null;

    if (i < portalCustomerUsers.length) {
      // First 5 customers are linked to the authenticated portal customer users
      name = portalCustomerUsers[i].name;
      email = portalCustomerUsers[i].email;
      userId = portalCustomerUsers[i].id;
    } else {
      const firstName = FIRST_NAMES[(i * 7) % FIRST_NAMES.length];
      const lastName = LAST_NAMES[(i * 11) % LAST_NAMES.length];
      name = `${firstName} ${lastName}`;
      const slug = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}`;
      email = `${slug}@${SEED_CUST_DOMAIN}`;
    }

    const prefix = PHONE_PREFIXES[i % PHONE_PREFIXES.length];
    const phoneDigits = String(1000000 + ((i * 1234567) % 8999999));
    const phone = `${prefix}${phoneDigits}`;
    const createdAt = randomRecentDate(now, 300);

    const cust = await prisma.customer.create({
      data: { name, email, phone, userId, createdAt, updatedAt: createdAt },
      select: { id: true, name: true, email: true, userId: true },
    });
    customers.push(cust);
  }
  console.log(`  ✓ ${customers.length} Customers seeded.`);

  // -------------------------------------------------------------------------
  // STEP 5: Seed Tickets (387 records)
  // -------------------------------------------------------------------------
  console.log(`[5/10] Seeding ${SEED_COUNTS.tickets} Tickets across statuses, priorities, channels...`);

  // Primary agent for targeted RBAC test queries
  const primaryAgent = agentUsers[0]; // agent1@crm.local

  const tickets: {
    id: string;
    subject: string;
    status: TicketStatus;
    priority: TicketPriority;
    customerId: string;
    assignedAgentId: string | null;
    createdAt: Date;
  }[] = [];

  for (let i = 0; i < SEED_COUNTS.tickets; i++) {
    // Determine customer:
    // Ensure portal customer 0 (Layla Hassan) gets 27 tickets (tests portal pagination!)
    // Ensure portal customer 1 (Jonathan Miller) gets 23 tickets (tests portal pagination!)
    // Ensure portal customer 2 (Amina Idris) gets 14 tickets
    let customer = customers[i % customers.length];
    if (i < 27) {
      customer = customers[0]; // Layla Hassan (VIP Customer) -> 27 tickets
    } else if (i < 50) {
      customer = customers[1]; // Jonathan Miller -> 23 tickets
    } else if (i < 64) {
      customer = customers[2]; // Amina Idris -> 14 tickets
    }

    // Status distribution
    let status: TicketStatus;
    if (i % 6 === 0) status = TicketStatus.OPEN;
    else if (i % 6 === 1) status = TicketStatus.IN_PROGRESS;
    else if (i % 6 === 2) status = TicketStatus.WAITING_CUSTOMER;
    else if (i % 6 === 3) status = TicketStatus.RESOLVED;
    else if (i % 6 === 4) status = TicketStatus.CLOSED;
    else status = TicketStatus.ESCALATED;

    // Priority distribution
    let priority: TicketPriority;
    if (i % 10 === 0) priority = TicketPriority.URGENT;
    else if (i % 10 <= 3) priority = TicketPriority.HIGH;
    else if (i % 10 <= 7) priority = TicketPriority.MEDIUM;
    else priority = TicketPriority.LOW;

    // Channel distribution
    let channel: Channel;
    if (i % 10 <= 4) channel = Channel.WEB;
    else if (i % 10 <= 7) channel = Channel.EMAIL;
    else if (i % 10 === 8) channel = Channel.WHATSAPP;
    else channel = i % 2 === 0 ? Channel.SMS : Channel.LIVE_CHAT;

    // Assignment distribution
    let assignedAgentId: string | null = null;
    if (status !== TicketStatus.OPEN) {
      if (i % 8 === 0) {
        assignedAgentId = null; // Unassigned in progress/open
      } else if (i % 5 === 0) {
        assignedAgentId = primaryAgent.id; // Assign to Alex Rivera for RBAC testing
      } else {
        const agent = agentUsers[i % agentUsers.length];
        assignedAgentId = agent.isActive ? agent.id : agentUsers[1].id;
      }
    }

    const category = categories[i % categories.length];
    const baseSubject = TICKET_SUBJECT_TEMPLATES[i % TICKET_SUBJECT_TEMPLATES.length];
    const subject = `${baseSubject} [Ref-${1000 + i}]`;
    const description = `<p>${SAMPLE_PARAGRAPHS[i % SAMPLE_PARAGRAPHS.length]}</p><p>Issue reference code: <code>TKT-${1000 + i}</code>. Customer account ID: ${customer.id}.</p>`;

    const createdAt = randomRecentDate(now, 180);

    // SLA snapshots
    const firstResponseMins = priority === TicketPriority.URGENT ? 15 : priority === TicketPriority.HIGH ? 60 : 120;
    const resolutionMins = priority === TicketPriority.URGENT ? 240 : priority === TicketPriority.HIGH ? 1440 : 2880;
    const firstResponseDueAt = new Date(createdAt.getTime() + firstResponseMins * 60_000);
    const resolutionDueAt = new Date(createdAt.getTime() + resolutionMins * 60_000);

    let firstRespondedAt: Date | null = null;
    let resolvedAt: Date | null = null;
    let closedAt: Date | null = null;

    if (status !== TicketStatus.OPEN) {
      firstRespondedAt = new Date(createdAt.getTime() + Math.min(firstResponseMins * 0.5, 45) * 60_000);
    }
    if (status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED) {
      resolvedAt = new Date(createdAt.getTime() + Math.min(resolutionMins * 0.7, 1200) * 60_000);
    }
    if (status === TicketStatus.CLOSED && resolvedAt) {
      closedAt = new Date(resolvedAt.getTime() + 86_400_000);
    }

    const updatedAt = closedAt ?? resolvedAt ?? firstRespondedAt ?? createdAt;

    // Team ownership (feature/team-based-manager-scope) — EXPLICIT, never inferred
    // from the assigned agent at read time:
    //   - assigned ticket   → the assignee's team (so ticket.teamId === agent.teamId,
    //                          the invariant the assignment API enforces)
    //   - unassigned ticket → round-robin a team, so every manager has an own-team
    //                          unassigned queue to work
    //   - every 13th unassigned ticket stays unrouted (teamId = null) to exercise
    //                          the ADMIN-only "not yet routed to a team" path
    // department/branch always follow the owning team for consistency.
    let ticketTeamId: string | null = null;
    let ticketDepartmentId: string | null = null;
    let ticketBranchId: string | null = null;
    const assigneeTeam = assignedAgentId ? teamOfUser.get(assignedAgentId) : undefined;
    if (assigneeTeam) {
      ticketTeamId = assigneeTeam.teamId;
      ticketDepartmentId = assigneeTeam.departmentId;
      ticketBranchId = assigneeTeam.branchId;
    } else if (i % 13 !== 0) {
      const team = teams[i % teams.length];
      ticketTeamId = team.id;
      ticketDepartmentId = team.departmentId;
      ticketBranchId = team.branchId;
    }

    const ticket = await prisma.ticket.create({
      data: {
        subject,
        description,
        status,
        priority,
        channel,
        customerId: customer.id,
        assignedAgentId,
        categoryId: category.id,
        departmentId: ticketDepartmentId,
        branchId: ticketBranchId,
        teamId: ticketTeamId,
        firstResponseDueAt,
        firstRespondedAt,
        resolutionDueAt,
        resolvedAt,
        closedAt,
        createdAt,
        updatedAt,
      },
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        customerId: true,
        assignedAgentId: true,
        createdAt: true,
      },
    });
    tickets.push(ticket);
  }
  console.log(`  ✓ ${tickets.length} Tickets seeded.`);

  // -------------------------------------------------------------------------
  // STEP 6: Seed Ticket Messages & Internal Notes
  // -------------------------------------------------------------------------
  console.log("[6/10] Seeding Ticket Conversations (Messages & Internal Notes)...");
  let messageCount = 0;
  let noteCount = 0;

  // Ticket customer → that customer's authenticated portal User (or null). Used
  // to attribute customer-authored messages to the RIGHT account — never a
  // universal `portalCustomerUsers[0]` fallback.
  const customerUserById = new Map(customers.map((c) => [c.id, c.userId] as const));

  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];
    // Distribution of message count:
    // Some tickets with 1-2, many with 3-6, some with 10+
    let count: number;
    if (i < 25) count = randomInt(10, 14); // Extended conversation
    else if (i < 100) count = randomInt(4, 7);
    else if (i < 280) count = randomInt(2, 4);
    else count = 1;

    // Only this ticket's own customer account may author a "customer" turn.
    const ticketCustomerUserId = customerUserById.get(t.customerId) ?? null;
    const staffAuthor = t.assignedAgentId
      ? agentUsers.find((a) => a.id === t.assignedAgentId) ?? agentUsers[0]
      : agentUsers[0];

    let lastTime = t.createdAt.getTime();

    for (let m = 0; m < count; m++) {
      lastTime += randomInt(5, 60) * 60_000;
      const msgTime = new Date(lastTime);
      const isCustomer = m % 2 === 0;
      const authorUserId = resolveMessageAuthorId({
        isCustomerTurn: isCustomer,
        customerUserId: ticketCustomerUserId,
        staffAuthorId: staffAuthor.id,
      });
      const body = `<p>${SAMPLE_PARAGRAPHS[(i + m) % SAMPLE_PARAGRAPHS.length]}</p>`;

      await prisma.ticketMessage.create({
        data: {
          ticketId: t.id,
          authorUserId,
          body,
          createdAt: msgTime,
        },
      });
      messageCount++;
    }

    // Add TicketHistory entry
    await prisma.ticketHistory.create({
      data: {
        ticketId: t.id,
        actorUserId: staffAuthor.id,
        action: "TICKET_CREATED",
        newValue: t.status,
        createdAt: t.createdAt,
      },
    });

    // Add Internal Notes to ~35% of tickets
    if (i % 3 === 0) {
      const noteAuthor = managerUsers[i % managerUsers.length];
      const mentionAgent = agentUsers[(i + 1) % agentUsers.length];
      const noteBody = `<p>Internal Note: Reviewing customer background. @[${mentionAgent.name}](${mentionAgent.id}) please review logs if issue reoccurs.</p>`;

      const note = await prisma.ticketNote.create({
        data: {
          ticketId: t.id,
          authorUserId: noteAuthor.id,
          body: noteBody,
          createdAt: new Date(t.createdAt.getTime() + 15 * 60_000),
        },
      });
      noteCount++;

      // Create TicketMention
      await prisma.ticketMention.create({
        data: {
          noteId: note.id,
          mentionedUserId: mentionAgent.id,
          ticketId: t.id,
          createdAt: note.createdAt,
        },
      });

      // Create TicketWatcher
      await prisma.ticketWatcher.create({
        data: {
          ticketId: t.id,
          userId: mentionAgent.id,
          createdAt: note.createdAt,
        },
      });
    }

    // Add Feedback to eligible resolved/closed tickets for portal customers
    if ((t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED) && i < 40) {
      const rating = (i % 5) + 1;
      const comment = rating >= 4
        ? "Excellent service, resolved quickly and thoroughly!"
        : "Took multiple follow-ups, but the outcome was acceptable.";
      await prisma.feedback.create({
        data: {
          ticketId: t.id,
          customerId: t.customerId,
          rating,
          comment,
          createdAt: new Date(t.createdAt.getTime() + 120 * 60_000),
        },
      });
    }
  }
  console.log(`  ✓ Seeded ${messageCount} Messages, ${noteCount} Internal Notes & Mentions.`);

  // -------------------------------------------------------------------------
  // STEP 7: Seed Tasks & Reminders (107 records)
  // -------------------------------------------------------------------------
  console.log(`[7/10] Seeding ${SEED_COUNTS.tasks} Tasks across statuses and assignees...`);
  const taskTitles = [
    "Verify customer invoice tax calculation",
    "Investigate recurring 504 gateway timeout on webhook endpoint",
    "Schedule onboarding check-in call with enterprise account",
    "Review damaged shipment photo proof and issue replacement RMA",
    "Update documentation on Single Sign-On (SSO) configuration",
    "Follow up with courier regarding delayed tracking updates",
    "Audit agent queue load distribution for high-priority queue",
    "Check customer refund status in payment processor dashboard",
    "Perform quarterly security credential and 2FA compliance check",
    "Draft knowledge base guide for mobile application biometric login",
  ];

  for (let i = 0; i < SEED_COUNTS.tasks; i++) {
    const title = `${taskTitles[i % taskTitles.length]} #${i + 1}`;
    const description = `Operational task item generated for validation and queue testing. Priority ref: Task-${100 + i}.`;
    const status = i < 70 ? TaskStatus.OPEN : TaskStatus.DONE;

    // Overdue vs upcoming
    let dueAt: Date | null = null;
    if (i % 4 === 0) {
      dueAt = new Date(now.getTime() - randomInt(1, 20) * 86_400_000); // Overdue
    } else if (i % 4 === 1) {
      dueAt = new Date(now.getTime() + randomInt(1, 14) * 86_400_000); // Upcoming
    }

    const creator = (i % 2 === 0 ? adminUsers[0] : managerUsers[0]);
    const assignee = agentUsers[i % agentUsers.length];
    const ticketId = i % 2 === 0 && tickets[i] ? tickets[i].id : null;
    const createdAt = randomRecentDate(now, 90);

    await prisma.task.create({
      data: {
        title,
        description,
        status,
        dueAt,
        creatorId: creator.id,
        assigneeId: assignee.id,
        ticketId,
        createdAt,
        updatedAt: createdAt,
      },
    });
  }
  console.log(`  ✓ Seeded ${SEED_COUNTS.tasks} Tasks.`);

  // -------------------------------------------------------------------------
  // STEP 8: Seed Knowledge Base Articles (63 records)
  // -------------------------------------------------------------------------
  console.log(`[8/10] Seeding ${SEED_COUNTS.knowledgeArticles} Knowledge Base Articles...`);
  const kbThemes = [
    { title: "How to configure Two-Factor Authentication (2FA)", cat: "Account & Security" },
    { title: "Resolving common payment gateway timeout errors", cat: "Billing & Payments" },
    { title: "Troubleshooting mobile application push notifications", cat: "Mobile Application" },
    { title: "Guide to setting up webhook endpoints and HMAC verification", cat: "Integrations & API" },
    { title: "Understanding subscription tiers, limits, and billing cycles", cat: "Billing & Payments" },
    { title: "Returning damaged goods and initiating RMA replacements", cat: "Returns & Exchanges" },
    { title: "Best practices for agent ticket assignment and escalation", cat: "Onboarding & Setup" },
    { title: "Exporting analytical reports to Excel and CSV formats", cat: "Product & Features" },
    { title: "Managing customer profiles and contact synchronization", cat: "General Inquiries" },
  ];

  for (let i = 0; i < SEED_COUNTS.knowledgeArticles; i++) {
    const theme = kbThemes[i % kbThemes.length];
    const title = `${theme.title} (Part ${Math.floor(i / kbThemes.length) + 1})`;
    const content = `Comprehensive documentation for ${theme.title}. This article outlines configuration parameters, troubleshooting checklists, and standard operating procedures for customer support engineers.\n\nSection 1: Overview\nDetailed operational instructions...\n\nSection 2: Verification\nConfirm configuration using the built-in diagnostic tools.`;
    const status = i < 48 ? KnowledgeArticleStatus.PUBLISHED : KnowledgeArticleStatus.DRAFT;
    const author = (i % 2 === 0 ? adminUsers[0] : managerUsers[0]);
    const createdAt = randomRecentDate(now, 120);

    await prisma.knowledgeArticle.create({
      data: {
        title,
        content,
        category: theme.cat,
        status,
        createdById: author.id,
        createdAt,
        updatedAt: createdAt,
      },
    });
  }
  console.log(`  ✓ Seeded ${SEED_COUNTS.knowledgeArticles} Knowledge Articles.`);

  // -------------------------------------------------------------------------
  // STEP 9: Seed Quick Replies (47 records)
  // -------------------------------------------------------------------------
  console.log(`[9/10] Seeding ${SEED_COUNTS.quickReplies} Quick Replies...`);
  const qrTemplates = [
    { title: "Greeting - First Contact Welcome", body: "Hello! Thank you for reaching out to our support team. How can we assist you today?" },
    { title: "Greeting - VIP Client Welcome", body: "Welcome back! As a valued VIP partner, your inquiry has been prioritized. How may we assist?" },
    { title: "Billing - Invoice Copy Sent", body: "We have generated a fresh PDF copy of your requested invoice and sent it to your registered email address." },
    { title: "Billing - Refund Processed (3-5 Days)", body: "Your refund request has been approved and processed. Funds typically reflect within 3 to 5 business days." },
    { title: "Technical - Clear Browser Cache & Cookies", body: "Please try clearing your browser cache and cookies, or test the action in an incognito window." },
    { title: "Technical - HAR Network Logs Request", body: "Could you please record and provide a browser network HAR log while reproducing this issue?" },
    { title: "Account - Password Reset Link Sent", body: "A secure one-time password reset link has been dispatched to your email on file." },
    { title: "Shipping - Carrier Investigation Opened", body: "We have contacted the courier service to initiate a formal package investigation. Expect updates within 24h." },
    { title: "Closing - Issue Resolved Confirmation", body: "We are glad to have resolved this for you! Please let us know if there is anything else we can assist with." },
  ];

  for (let i = 0; i < SEED_COUNTS.quickReplies; i++) {
    const tpl = qrTemplates[i % qrTemplates.length];
    const title = `${tpl.title} [v${Math.floor(i / qrTemplates.length) + 1}]`;
    const body = `${tpl.body} (Reference snippet #${i + 1})`;
    const author = (i % 2 === 0 ? adminUsers[0] : managerUsers[0]);
    const createdAt = randomRecentDate(now, 90);

    await prisma.quickReply.create({
      data: {
        title,
        body,
        createdById: author.id,
        createdAt,
        updatedAt: createdAt,
      },
    });
  }
  console.log(`  ✓ Seeded ${SEED_COUNTS.quickReplies} Quick Replies.`);

  // -------------------------------------------------------------------------
  // STEP 10: Seed Audit Logs (412 records) & In-App Notifications (85 records)
  // -------------------------------------------------------------------------
  console.log(`[10/10] Seeding ${SEED_COUNTS.auditLogs} Audit Logs & ${SEED_COUNTS.notifications} Notifications...`);

  const auditActionsList = [
    AUDIT_ACTIONS.TICKET_CREATED,
    AUDIT_ACTIONS.TICKET_STATUS_CHANGED,
    AUDIT_ACTIONS.TICKET_ASSIGNED,
    AUDIT_ACTIONS.TICKET_PRIORITY_CHANGED,
    AUDIT_ACTIONS.TICKET_CATEGORY_CHANGED,
    AUDIT_ACTIONS.TICKET_CLOSED,
    AUDIT_ACTIONS.USER_CREATED,
    AUDIT_ACTIONS.USER_UPDATED,
    AUDIT_ACTIONS.USER_ROLE_CHANGED,
    AUDIT_ACTIONS.CUSTOMER_CREATED,
    AUDIT_ACTIONS.CUSTOMER_UPDATED,
  ];

  for (let i = 0; i < SEED_COUNTS.auditLogs; i++) {
    const action = auditActionsList[i % auditActionsList.length];
    let entityType: string;
    let entityId: string | null = null;
    let changes: Record<string, { from?: unknown; to?: unknown }> | undefined;

    if (action.startsWith("TICKET")) {
      entityType = AUDIT_ENTITY_TYPES.TICKET;
      entityId = tickets[i % tickets.length].id;
      changes = { status: { from: "OPEN", to: "IN_PROGRESS" } };
    } else if (action.startsWith("USER")) {
      entityType = AUDIT_ENTITY_TYPES.USER;
      entityId = agentUsers[i % agentUsers.length].id;
      changes = { role: { from: "AGENT", to: "MANAGER" } };
    } else {
      entityType = AUDIT_ENTITY_TYPES.CUSTOMER;
      entityId = customers[i % customers.length].id;
      changes = { name: { from: "Old Name", to: "Updated Customer Name" } };
    }

    const actor = i % 10 === 0 ? null : (i % 2 === 0 ? adminUsers[0] : managerUsers[0]);
    const createdAt = randomRecentDate(now, 150);

    await prisma.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        action,
        entityType,
        entityId,
        metadata: {
          actorType: actor ? "USER" : "SYSTEM",
          ...(changes ? { changes: changes as Prisma.InputJsonObject } : {}),
          isSeed: true,
          source: "seed-test-qa",
        } as Prisma.InputJsonObject,
        ipAddress: i % 2 === 0 ? "192.168.1.100" : "10.0.0.45",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CRM-Test-Runner/1.0",
        createdAt,
      },
    });
  }

  // Notifications
  const notificationTypes = [
    "TICKET_ASSIGNED",
    "TICKET_AUTO_ASSIGNED",
    "SLA_BREACH_ESCALATION",
    "TICKET_MENTION",
    "TICKET_WATCH_ACTIVITY",
    "TASK_ASSIGNED",
    "TASK_REMINDER",
  ];

  for (let i = 0; i < SEED_COUNTS.notifications; i++) {
    const type = notificationTypes[i % notificationTypes.length];
    const targetUser = i % 4 === 0 ? adminUsers[0] : i % 4 === 1 ? managerUsers[0] : agentUsers[i % agentUsers.length];
    const ticket = tickets[i % tickets.length];
    const readAt = i % 2 === 0 ? new Date(now.getTime() - randomInt(1, 48) * 3600_000) : null;
    const createdAt = randomRecentDate(now, 30);

    await prisma.notification.create({
      data: {
        userId: targetUser.id,
        type,
        title: `Notification: ${type.replace(/_/g, " ")}`,
        message: `Activity update regarding ticket #${ticket.id} (${ticket.subject})`,
        ticketId: ticket.id,
        readAt,
        createdAt,
      },
    });
  }
  console.log(`  ✓ Seeded ${SEED_COUNTS.auditLogs} Audit Logs and ${SEED_COUNTS.notifications} Notifications.`);

  // -------------------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------------------
  console.log("\n=======================================================");
  console.log("  SEED COMPLETED SUCCESSFULLY!");
  console.log("=======================================================");
  console.log("\nEntity Counts in Database:");
  console.log("-------------------------------------------------------");
  console.log(`Users:              ${await prisma.user.count()} (Staff + Customer users)`);
  console.log(`Customers:          ${await prisma.customer.count()}`);
  console.log(`Tickets:            ${await prisma.ticket.count()}`);
  console.log(`Ticket Messages:    ${await prisma.ticketMessage.count()}`);
  console.log(`Ticket Notes:       ${await prisma.ticketNote.count()}`);
  console.log(`Categories:         ${await prisma.category.count()}`);
  console.log(`Branches:           ${await prisma.branch.count()}`);
  console.log(`Departments:        ${await prisma.department.count()}`);
  console.log(`Teams:              ${await prisma.team.count()}`);
  console.log(`Tasks:              ${await prisma.task.count()}`);
  console.log(`Knowledge Articles: ${await prisma.knowledgeArticle.count()}`);
  console.log(`Quick Replies:      ${await prisma.quickReply.count()}`);
  console.log(`Audit Logs:         ${await prisma.auditLog.count()}`);
  console.log(`Notifications:      ${await prisma.notification.count()}`);
  console.log(`Feedback:           ${await prisma.feedback.count()}`);
  console.log("-------------------------------------------------------");
  console.log("\nTest Credentials (password for all seed accounts: password123):");
  console.log("-------------------------------------------------------");
  console.log(`ADMIN:     bahaa@crm.com  (Bahaa — organization-wide)   [password: 123]`);
  console.log(`ADMIN:     admin1@${SEED_EMAIL_DOMAIN}  (Sarah Connor — organization-wide)`);
  console.log(`MANAGER:   manager1@${SEED_EMAIL_DOMAIN}  (Marcus Vance — manages "Billing Support")`);
  console.log(`MANAGER2:  manager2@${SEED_EMAIL_DOMAIN}  (Maya Lin — manages "Technical Support")`);
  console.log(`AGENT:     agent1@${SEED_EMAIL_DOMAIN}  (member of "Billing Support")`);
  console.log(`AGENT-B:   agent8@${SEED_EMAIL_DOMAIN}  (member of "Technical Support")`);
  console.log(`CUSTOMER:  portal.customer@${SEED_EMAIL_DOMAIN}  (Layla Hassan - 27 tickets)`);
  console.log(`CUSTOMER2: portal.customer2@${SEED_EMAIL_DOMAIN}  (Jonathan Miller - 23 tickets)`);
  console.log("=======================================================\n");
}

if (process.argv[1]?.endsWith("seed-test-data.ts") || process.argv[1]?.endsWith("seed-test-data.js")) {
  seedTestData()
    .catch((err) => {
      console.error("Seed execution failed:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
