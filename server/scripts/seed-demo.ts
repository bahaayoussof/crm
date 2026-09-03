/**
 * Public-demo seed.
 *
 * Layers the four fixed demo accounts and a set of hand-written, realistic
 * support scenarios on top of the full `seedTestData()` baseline, so the public
 * demo opens on a CRM that already looks alive: populated dashboard, reports with
 * 30 days of variation, multi-message ticket conversations, internal notes, SLA
 * state, tasks, notifications and CSAT.
 *
 * Safety: refuses to run unless `DEMO_MODE=true`. It is additive (upserts the
 * demo accounts, creates demo tickets) — it does NOT drop tables. Use
 * `npm run demo:reset` for a clean rebuild (that one also requires
 * `DATABASE_ENV=demo` and `DEMO_RESET_CONFIRM`).
 *
 * The shared `seedTestData()` refuses `NODE_ENV=production` UNLESS the process is
 * pointed at the isolated demo database (`DEMO_MODE=true` + `DATABASE_ENV=demo`),
 * so the Vercel-hosted demo can be reseeded even though its runtime
 * `NODE_ENV=production`.
 *
 * Env: loads `server/.env.demo` (isolated demo database + demo flags) before
 * anything else — see scripts/demo-env.ts. A missing / non-demo `.env.demo`
 * aborts with a clear message; there is no fall back to `server/.env`.
 */
import "./load-demo-env.js";
import "dotenv/config";
import { Channel, PrismaClient, Role, TicketPriority, TicketStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import { seedTestData } from "./seed-test-data.js";

const prisma = new PrismaClient();

function assertDemoEnv() {
  if (process.env.DEMO_MODE !== "true") {
    throw new Error("seed-demo refuses to run unless DEMO_MODE=true (public-demo database only).");
  }
}

/** Public, intentionally non-personal demo credentials. Documented in README / docs/26. */
const DEMO_PASSWORD = "Demo123!";
const DEMO_ACCOUNTS = {
  admin: { email: "admin@demo.local", name: "Demo Admin", role: Role.ADMIN },
  manager: { email: "manager@demo.local", name: "Demo Manager", role: Role.MANAGER },
  agent: { email: "agent@demo.local", name: "Demo Agent", role: Role.AGENT },
  customer: { email: "customer@demo.local", name: "Demo Customer", role: Role.CUSTOMER },
} as const;

const daysAgo = (n: number, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

interface DemoTurn {
  from: "customer" | "agent" | "note";
  body: string;
  /** minutes after the ticket createdAt */
  at: number;
}

interface DemoScenario {
  subject: string;
  description: string;
  channel: Channel;
  priority: TicketPriority;
  status: TicketStatus;
  openedDaysAgo: number;
  category: string;
  turns: DemoTurn[];
  csat?: { rating: number; comment?: string };
}

/**
 * Six realistic scenarios spread across the last ~26 days, every channel, every
 * priority and a spread of statuses. Conversations mix customer replies, staff
 * replies and internal notes.
 */
const SCENARIOS: DemoScenario[] = [
  {
    subject: "Payment authorization failed",
    description: "I'm trying to complete my payment but it keeps failing at the last step.",
    channel: Channel.WEB,
    priority: TicketPriority.HIGH,
    status: TicketStatus.IN_PROGRESS,
    openedDaysAgo: 2,
    category: "Billing & Payments",
    turns: [
      { from: "customer", body: "I'm trying to complete my payment but it keeps failing.", at: 0 },
      { from: "agent", body: "Thanks for contacting us. Are you seeing a specific error message?", at: 35 },
      { from: "customer", body: 'Yes, it says "Payment authorization failed."', at: 90 },
      { from: "note", body: "Customer attempted payment three times in 10 minutes. Check payment-provider logs before advising a retry.", at: 95 },
      { from: "agent", body: "We've identified the authorization issue on our side and are investigating it now. I'll update you within the hour.", at: 120 },
    ],
  },
  {
    subject: "Unable to access account after email change",
    description: "I changed my email yesterday and now I can't sign in with either address.",
    channel: Channel.EMAIL,
    priority: TicketPriority.URGENT,
    status: TicketStatus.WAITING_CUSTOMER,
    openedDaysAgo: 4,
    category: "Account & Security",
    turns: [
      { from: "customer", body: "I changed my email yesterday and now I can't sign in with either address.", at: 0 },
      { from: "agent", body: "I can help. For security, can you confirm the last four digits of the card on file and the approximate date you created the account?", at: 20 },
      { from: "note", body: "Identity not yet verified — do not reset credentials until the card check passes.", at: 22 },
    ],
  },
  {
    subject: "Refund status request for order #48213",
    description: "I returned my order 9 days ago and haven't seen the refund yet.",
    channel: Channel.WHATSAPP,
    priority: TicketPriority.MEDIUM,
    status: TicketStatus.RESOLVED,
    openedDaysAgo: 12,
    category: "Billing & Payments",
    turns: [
      { from: "customer", body: "I returned my order 9 days ago and haven't seen the refund yet.", at: 0 },
      { from: "agent", body: "Thanks for your patience. I can see the return was received on our side. Refunds take 5–10 business days to appear depending on your bank.", at: 60 },
      { from: "customer", body: "Understood. Can you confirm the amount?", at: 180 },
      { from: "agent", body: "The refund of $129.00 was issued today to your original payment method. You should see it within 3 business days.", at: 200 },
      { from: "customer", body: "Got it, thank you!", at: 900 },
    ],
    csat: { rating: 5, comment: "Quick and clear, thanks." },
  },
  {
    subject: "Delivery address update before dispatch",
    description: "I need to change the delivery address on my pending order.",
    channel: Channel.SMS,
    priority: TicketPriority.LOW,
    status: TicketStatus.CLOSED,
    openedDaysAgo: 18,
    category: "Product & Features",
    turns: [
      { from: "customer", body: "I need to change the delivery address on my pending order.", at: 0 },
      { from: "agent", body: "Happy to help. Please reply with the full new address including postal code.", at: 25 },
      { from: "customer", body: "12 Rue des Lilas, 75011 Paris, France.", at: 40 },
      { from: "agent", body: "Done — the order will ship to the new address. Tracking will update within 24 hours.", at: 55 },
    ],
    csat: { rating: 4 },
  },
  {
    subject: "Verification code not received",
    description: "The SMS verification code never arrives when I try to log in.",
    channel: Channel.LIVE_CHAT,
    priority: TicketPriority.HIGH,
    status: TicketStatus.ESCALATED,
    openedDaysAgo: 1,
    category: "Account & Security",
    turns: [
      { from: "customer", body: "The SMS verification code never arrives when I try to log in.", at: 0 },
      { from: "agent", body: "Sorry about that. Can you confirm the phone number on your account and your carrier?", at: 8 },
      { from: "customer", body: "+44 7700 900123, carrier is Vodafone UK.", at: 15 },
      { from: "note", body: "Second report from a UK Vodafone number today — possible upstream SMS routing issue. Escalating to platform team.", at: 20 },
    ],
  },
  {
    subject: "Mobile app crashes after login",
    description: "The Android app closes immediately after I sign in. Version 4.2.1.",
    channel: Channel.WEB,
    priority: TicketPriority.MEDIUM,
    status: TicketStatus.OPEN,
    openedDaysAgo: 6,
    category: "Technical Support",
    turns: [
      { from: "customer", body: "The Android app closes immediately after I sign in. Version 4.2.1.", at: 0 },
      { from: "agent", body: "Thanks for the report. Which device model and Android version are you on?", at: 45 },
      { from: "customer", body: "Pixel 7, Android 14.", at: 300 },
      { from: "note", body: "Repro confirmed on Pixel 7 / Android 14 with a large offline cache. Dev ticket APP-1188 opened.", at: 320 },
    ],
  },
];

async function upsertDemoUser(def: { email: string; name: string; role: Role }, passwordHash: string) {
  return prisma.user.upsert({
    where: { email: def.email },
    update: { name: def.name, role: def.role, isActive: true, passwordHash, passwordChangedAt: null },
    create: { email: def.email, name: def.name, role: def.role, isActive: true, passwordHash },
    select: { id: true, email: true, role: true },
  });
}

export async function seedDemo() {
  assertDemoEnv();
  console.log("\n=== PUBLIC DEMO SEED ===\n");

  // 1. Full baseline (users, customers, ~387 tickets, conversations, tasks, KB,
  //    notifications, audit logs, feedback). Deterministic RNG.
  await seedTestData();

  // 2. Fixed demo accounts (bcrypt-hashed exactly like every other account).
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const admin = await upsertDemoUser(DEMO_ACCOUNTS.admin, passwordHash);
  const manager = await upsertDemoUser(DEMO_ACCOUNTS.manager, passwordHash);
  const agent = await upsertDemoUser(DEMO_ACCOUNTS.agent, passwordHash);
  const customerUser = await upsertDemoUser(DEMO_ACCOUNTS.customer, passwordHash);

  // 3. Put the demo manager in charge of a real seeded team and the demo agent
  //    on the same team, so team-scoped views are populated for both.
  const team = await prisma.team.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, departmentId: true, managerId: true, department: { select: { branchId: true } } },
  });
  if (!team) throw new Error("demo seed: no team found after baseline seed");
  const branchId = team.department.branchId;

  // Move the previous manager to a plain member of the team (keeps invariants:
  // one manager per team, one team per manager).
  if (team.managerId && team.managerId !== manager.id) {
    await prisma.user.update({ where: { id: team.managerId }, data: { teamId: team.id } });
  }
  await prisma.team.update({ where: { id: team.id }, data: { managerId: manager.id } });
  await prisma.user.update({
    where: { id: manager.id },
    data: { teamId: team.id, departmentId: team.departmentId, branchId },
  });
  await prisma.user.update({
    where: { id: agent.id },
    data: { teamId: team.id, departmentId: team.departmentId, branchId },
  });

  // 4. Demo customer + its Customer profile row.
  const customer = await prisma.customer.upsert({
    where: { email: DEMO_ACCOUNTS.customer.email },
    update: { name: DEMO_ACCOUNTS.customer.name, userId: customerUser.id, phone: "+15550100199" },
    create: { name: DEMO_ACCOUNTS.customer.name, email: DEMO_ACCOUNTS.customer.email, userId: customerUser.id, phone: "+15550100199" },
    select: { id: true },
  });

  // Fresh start for the demo-customer scenarios on re-run.
  const priorDemoTickets = await prisma.ticket.findMany({ where: { customerId: customer.id }, select: { id: true } });
  const priorIds = priorDemoTickets.map((t) => t.id);
  if (priorIds.length) {
    await prisma.feedback.deleteMany({ where: { ticketId: { in: priorIds } } });
    await prisma.ticketHistory.deleteMany({ where: { ticketId: { in: priorIds } } });
    await prisma.ticketNote.deleteMany({ where: { ticketId: { in: priorIds } } });
    await prisma.ticketMessage.deleteMany({ where: { ticketId: { in: priorIds } } });
    await prisma.notification.deleteMany({ where: { ticketId: { in: priorIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: priorIds } } });
  }

  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const catId = (name: string) => categories.find((c) => c.name === name)?.id ?? null;
  const slaRules = await prisma.slaRule.findMany();
  const slaFor = (p: TicketPriority) => slaRules.find((r) => r.priority === p) ?? null;

  // 5. The six scenarios.
  let created = 0;
  for (const s of SCENARIOS) {
    const openedAt = daysAgo(s.openedDaysAgo);
    const sla = slaFor(s.priority);
    const resolvedish = s.status === TicketStatus.RESOLVED || s.status === TicketStatus.CLOSED;
    const lastTurnAt = addMinutes(openedAt, s.turns.at(-1)?.at ?? 0);
    const firstStaffTurn = s.turns.find((t) => t.from === "agent");

    const ticket = await prisma.ticket.create({
      data: {
        subject: s.subject,
        description: s.description,
        status: s.status,
        priority: s.priority,
        channel: s.channel,
        customerId: customer.id,
        assignedAgentId: agent.id,
        teamId: team.id,
        departmentId: team.departmentId,
        branchId,
        categoryId: catId(s.category),
        createdAt: openedAt,
        firstResponseDueAt: sla ? addMinutes(openedAt, sla.firstResponseMinutes) : null,
        firstRespondedAt: firstStaffTurn ? addMinutes(openedAt, firstStaffTurn.at) : null,
        resolutionDueAt: sla ? addMinutes(openedAt, sla.resolutionMinutes) : null,
        resolvedAt: resolvedish ? lastTurnAt : null,
        closedAt: s.status === TicketStatus.CLOSED ? lastTurnAt : null,
      },
      select: { id: true },
    });
    await prisma.ticketHistory.create({
      data: { ticketId: ticket.id, actorUserId: null, action: "TICKET_CREATED", newValue: TicketStatus.OPEN, createdAt: openedAt },
    });

    for (const turn of s.turns) {
      const at = addMinutes(openedAt, turn.at);
      if (turn.from === "note") {
        await prisma.ticketNote.create({
          data: { ticketId: ticket.id, authorUserId: agent.id, body: turn.body, createdAt: at },
        });
      } else {
        await prisma.ticketMessage.create({
          data: {
            ticketId: ticket.id,
            authorUserId: turn.from === "customer" ? customerUser.id : agent.id,
            body: turn.body,
            createdAt: at,
          },
        });
      }
    }

    if (s.status === TicketStatus.ESCALATED) {
      await prisma.ticketHistory.create({
        data: { ticketId: ticket.id, actorUserId: agent.id, action: "STATUS_CHANGED", oldValue: TicketStatus.IN_PROGRESS, newValue: TicketStatus.ESCALATED, createdAt: lastTurnAt },
      });
    }
    if (resolvedish) {
      await prisma.ticketHistory.create({
        data: { ticketId: ticket.id, actorUserId: agent.id, action: "STATUS_CHANGED", oldValue: TicketStatus.IN_PROGRESS, newValue: s.status, createdAt: lastTurnAt },
      });
    }
    if (s.csat && resolvedish) {
      await prisma.feedback.create({
        data: { ticketId: ticket.id, customerId: customer.id, rating: s.csat.rating, comment: s.csat.comment ?? null, createdAt: addMinutes(lastTurnAt, 30) },
      });
    }
    created += 1;
  }

  // 6. A couple of open tasks for the demo agent so the Tasks page is populated
  //    for that login.
  const demoTickets = await prisma.ticket.findMany({ where: { customerId: customer.id }, select: { id: true, subject: true }, orderBy: { createdAt: "desc" }, take: 2 });
  for (const t of demoTickets) {
    await prisma.task.create({
      data: {
        title: `Follow up: ${t.subject}`,
        description: "Check provider logs and reply to the customer with an update.",
        status: "OPEN",
        dueAt: addMinutes(new Date(), 60 * 24),
        ticketId: t.id,
        creatorId: manager.id,
        assigneeId: agent.id,
      },
    });
  }

  // 7. Verify the four demo logins hash-match.
  for (const u of [admin, manager, agent, customerUser]) {
    const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { passwordHash: true } });
    const ok = await bcrypt.compare(DEMO_PASSWORD, row.passwordHash);
    console.log(`  ${ok ? "✓" : "✗"} ${u.email.padEnd(20)} (${u.role}) password "${DEMO_PASSWORD}" verifies: ${ok}`);
    if (!ok) throw new Error(`demo seed: password verification failed for ${u.email}`);
  }

  console.log(`\n  ✓ Demo scenarios created: ${created}`);
  console.log(`  ✓ Demo manager leads team ${team.id}; demo agent is a member.`);
  console.log("\n=== DEMO SEED COMPLETE ===");
  console.log("Accounts (password for all: Demo123!):");
  console.log("  admin@demo.local     ADMIN");
  console.log("  manager@demo.local   MANAGER");
  console.log("  agent@demo.local     AGENT");
  console.log("  customer@demo.local  CUSTOMER\n");
}

const invokedDirectly =
  process.argv[1]?.endsWith("seed-demo.ts") || process.argv[1]?.endsWith("seed-demo.js");
if (invokedDirectly) {
  seedDemo()
    .catch((err) => {
      console.error("demo seed failed:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
