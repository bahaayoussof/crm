/**
 * Dev-only seed: 2 WhatsApp test tickets for local end-to-end UI testing.
 *
 * Safe to re-run — it upserts the two fake customers by a stable `.invalid`
 * email and fully rebuilds ONLY those customers' WhatsApp seed tickets
 * (matched by customer + channel + subject). No other records are touched and
 * nothing is ever deleted or reset globally.
 *
 * Run from the `server/` directory:
 *   npx tsx scripts/seed-whatsapp-test-data.ts
 *
 * Conventions reused from src/modules/integrations/whatsapp/whatsapp.service.ts:
 *   - inbound customer messages are authored by the shared, login-less system
 *     user `whatsapp-inbound@system.invalid` (role CUSTOMER, isActive false);
 *   - customers created from WhatsApp use a non-routable `.invalid` email as a
 *     schema-compatibility key (see ADR-030), phone stored E.164-ish;
 *   - SLA due timestamps are derived from the active SlaRule for the priority;
 *   - a `TICKET_CREATED` TicketHistory row is written for every new ticket.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { Channel, PrismaClient, Role, TicketPriority, TicketStatus } from "@prisma/client";

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production") {
  throw new Error("seed-whatsapp-test-data is a development helper and must not run with NODE_ENV=production");
}

const SYSTEM_USER_EMAIL = "whatsapp-inbound@system.invalid";
const SYSTEM_USER_NAME = "WhatsApp Customer";

const MINUTE = 60_000;

function minutesAgo(base: Date, minutes: number): Date {
  return new Date(base.getTime() - minutes * MINUTE);
}
function minutesAfter(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE);
}

type SeedMessage = { author: "customer" | "agent"; body: string; offsetMin: number };

type SeedTicket = {
  key: string;
  customer: { name: string; phone: string; email: string };
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdMinutesAgo: number;
  assignAgent: boolean;
  messages: SeedMessage[];
};

const SEED: SeedTicket[] = [
  {
    key: "wa-test-1",
    customer: {
      name: "WhatsApp Test Customer 1",
      phone: "+201000000001",
      email: "wa-201000000001@no-email.invalid",
    },
    subject: "Order delivery issue",
    status: TicketStatus.IN_PROGRESS,
    priority: TicketPriority.MEDIUM,
    createdMinutesAgo: 180,
    assignAgent: true,
    messages: [
      { author: "customer", body: "Hello, my order has not arrived yet.", offsetMin: 0 },
      { author: "agent", body: "Hi, I’m checking the delivery status for you now.", offsetMin: 10 },
      { author: "customer", body: "Thank you. Please let me know when you have an update.", offsetMin: 15 },
    ],
  },
  {
    key: "wa-test-2",
    customer: {
      name: "WhatsApp Test Customer 2",
      phone: "+201000000002",
      email: "wa-201000000002@no-email.invalid",
    },
    subject: "Unable to access account",
    status: TicketStatus.OPEN,
    priority: TicketPriority.HIGH,
    createdMinutesAgo: 40,
    assignAgent: false,
    messages: [
      { author: "customer", body: "Hi, I cannot log into my account.", offsetMin: 0 },
      { author: "customer", body: "I already tried resetting my password.", offsetMin: 5 },
    ],
  },
];

async function ensureSystemUser(): Promise<string> {
  const existing = await prisma.user.findFirst({ where: { email: SYSTEM_USER_EMAIL }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.user.create({
    data: {
      name: SYSTEM_USER_NAME,
      email: SYSTEM_USER_EMAIL,
      passwordHash: await bcrypt.hash(randomUUID(), 10),
      role: Role.CUSTOMER,
      isActive: false,
    },
    select: { id: true },
  });
  return created.id;
}

async function resolveAgent(): Promise<{ id: string; name: string }> {
  const agent =
    (await prisma.user.findFirst({ where: { role: Role.AGENT, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } })) ??
    (await prisma.user.findFirst({ where: { role: { in: [Role.ADMIN, Role.MANAGER] }, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }));
  if (!agent) throw new Error("No active AGENT/ADMIN/MANAGER user found to author the agent reply");
  return agent;
}

async function upsertCustomer(input: { name: string; phone: string; email: string }): Promise<string> {
  const customer = await prisma.customer.upsert({
    where: { email: input.email },
    update: { name: input.name, phone: input.phone },
    create: { name: input.name, email: input.email, phone: input.phone },
    select: { id: true },
  });
  return customer.id;
}

/** Remove any prior instance of this exact seed ticket (children first — FKs are Restrict). */
async function clearPreviousSeedTicket(customerId: string, subject: string): Promise<number> {
  const tickets = await prisma.ticket.findMany({
    where: { customerId, channel: Channel.WHATSAPP, subject },
    select: { id: true },
  });
  for (const { id } of tickets) {
    await prisma.notification.deleteMany({ where: { ticketId: id } });
    await prisma.ticketHistory.deleteMany({ where: { ticketId: id } });
    await prisma.ticketNote.deleteMany({ where: { ticketId: id } });
    await prisma.ticketMessage.deleteMany({ where: { ticketId: id } });
    await prisma.ticket.delete({ where: { id } });
  }
  return tickets.length;
}

async function slaDue(priority: TicketPriority, from: Date): Promise<{ firstResponseDueAt: Date | null; resolutionDueAt: Date | null }> {
  const rule = await prisma.slaRule.findFirst({ where: { priority, isActive: true } });
  return {
    firstResponseDueAt: rule ? minutesAfter(from, rule.firstResponseMinutes) : null,
    resolutionDueAt: rule ? minutesAfter(from, rule.resolutionMinutes) : null,
  };
}

async function seedTicket(spec: SeedTicket, ctx: { systemUserId: string; agent: { id: string; name: string } }) {
  const now = new Date();
  const createdAt = minutesAgo(now, spec.createdMinutesAgo);
  const customerId = await upsertCustomer(spec.customer);
  const removed = await clearPreviousSeedTicket(customerId, spec.subject);

  const messageTimes = spec.messages.map((m) => minutesAfter(createdAt, m.offsetMin));
  const firstAgentIdx = spec.messages.findIndex((m) => m.author === "agent");
  const firstRespondedAt = firstAgentIdx >= 0 ? messageTimes[firstAgentIdx] : null;
  const { firstResponseDueAt, resolutionDueAt } = await slaDue(spec.priority, createdAt);

  const ticket = await prisma.ticket.create({
    data: {
      subject: spec.subject,
      description: spec.messages[0]!.body,
      status: spec.status,
      priority: spec.priority,
      channel: Channel.WHATSAPP,
      customerId,
      assignedAgentId: spec.assignAgent ? ctx.agent.id : null,
      createdAt,
      firstResponseDueAt,
      firstRespondedAt,
      resolutionDueAt,
    },
    select: { id: true },
  });

  await prisma.ticketMessage.createMany({
    data: spec.messages.map((m, i) => ({
      ticketId: ticket.id,
      authorUserId: m.author === "agent" ? ctx.agent.id : ctx.systemUserId,
      body: m.body,
      externalId: m.author === "customer" ? `seed-${spec.key}-wamid-${i + 1}` : null,
      createdAt: messageTimes[i]!,
    })),
  });

  const history: { action: string; oldValue: string | null; newValue: string | null; actorUserId: string | null; createdAt: Date }[] = [
    { action: "TICKET_CREATED", oldValue: null, newValue: TicketStatus.OPEN, actorUserId: null, createdAt },
  ];
  if (spec.assignAgent) {
    history.push({ action: "ASSIGNMENT_CHANGED", oldValue: null, newValue: ctx.agent.name, actorUserId: ctx.agent.id, createdAt: minutesAfter(createdAt, 1) });
  }
  // If the target status is not OPEN, record the transition in history
  if (spec.status !== TicketStatus.OPEN) {
    history.push({
      action: "STATUS_CHANGED",
      oldValue: TicketStatus.OPEN,
      newValue: spec.status,
      actorUserId: spec.assignAgent ? ctx.agent.id : null,
      createdAt: minutesAfter(createdAt, 2),
    });
  }
  await prisma.ticketHistory.createMany({ data: history.map((h) => ({ ...h, ticketId: ticket.id })) });

  const count = await prisma.ticketMessage.count({ where: { ticketId: ticket.id } });
  return { ticketId: ticket.id, customerId, removed, messageCount: count };
}

async function main() {
  console.log(`DB: ${(process.env.DATABASE_URL ?? "").replace(/:\/\/[^@]*@/, "://***@") || "(default)"}`);
  const systemUserId = await ensureSystemUser();
  const agent = await resolveAgent();
  console.log(`System WhatsApp user: ${systemUserId}`);
  console.log(`Agent for replies/assignment: ${agent.name} (${agent.id})\n`);

  for (const spec of SEED) {
    const result = await seedTicket(spec, { systemUserId, agent });
    console.log(`${spec.customer.name}`);
    console.log(`  phone:       ${spec.customer.phone}`);
    console.log(`  customer ID: ${result.customerId}`);
    console.log(`  ticket ID:   ${result.ticketId}`);
    console.log(`  subject:     ${spec.subject}`);
    console.log(`  status:      ${spec.status}`);
    console.log(`  priority:    ${spec.priority}`);
    console.log(`  channel:     ${Channel.WHATSAPP}`);
    console.log(`  messages:    ${result.messageCount}`);
    console.log(`  (rebuilt: removed ${result.removed} prior seed ticket(s))\n`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
