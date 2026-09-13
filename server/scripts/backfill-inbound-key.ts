/**
 * CONV-008 — inbound idempotency key backfill.
 *
 * Populates TicketMessage.inboundKey only where provider origin/identity is
 * unambiguous (message authored by the channel's inactive inbound system
 * user). Detects duplicate candidate keys before writing and writes neither
 * side of a collision — conflicts are reported for manual review instead of
 * silently resolved. Staff/Portal/Live Chat rows keep inboundKey = null.
 *
 * Usage: npx tsx scripts/backfill-inbound-key.ts [--dry-run]
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const SYSTEM_EMAIL_BY_CHANNEL: Record<string, string> = {
  EMAIL: "email-inbound@system.invalid",
  SMS: "sms-inbound@system.invalid",
  WHATSAPP: "whatsapp-inbound@system.invalid",
};

function deriveKey(channel: "EMAIL" | "SMS" | "WHATSAPP", externalId: string): string | null {
  if (channel === "EMAIL") {
    const match = /^resend:(.+)$/.exec(externalId);
    if (!match) return null;
    return `email:${match[1]}`;
  }
  if (channel === "SMS") return `sms:${externalId}`;
  return `whatsapp:${externalId}`;
}

async function main() {
  console.log(`Inbound key backfill${DRY_RUN ? " (dry run)" : ""}...`);

  const candidates = new Map<string, string[]>(); // key -> [messageId,...]

  for (const channel of ["EMAIL", "SMS", "WHATSAPP"] as const) {
    const systemEmail = SYSTEM_EMAIL_BY_CHANNEL[channel];
    const rows = await prisma.ticketMessage.findMany({
      where: {
        inboundKey: null,
        externalId: { not: null },
        author: { email: systemEmail },
      },
      select: { id: true, externalId: true },
    });

    for (const row of rows) {
      const key = deriveKey(channel, row.externalId!);
      if (!key) continue;
      const list = candidates.get(key) ?? [];
      list.push(row.id);
      candidates.set(key, list);
    }
  }

  const conflicts: { key: string; messageIds: string[] }[] = [];
  const toWrite: { id: string; key: string }[] = [];

  for (const [key, ids] of candidates) {
    if (ids.length > 1) {
      conflicts.push({ key, messageIds: ids });
      continue;
    }
    toWrite.push({ id: ids[0], key });
  }

  console.log(`Candidates: ${toWrite.length + conflicts.reduce((n, c) => n + c.messageIds.length, 0)}`);
  console.log(`Writable (unambiguous): ${toWrite.length}`);
  console.log(`Conflicts (NOT written, needs manual review): ${conflicts.length}`);
  if (conflicts.length > 0) {
    console.log(JSON.stringify(conflicts, null, 2));
  }

  if (!DRY_RUN) {
    for (const item of toWrite) {
      await prisma.ticketMessage.update({ where: { id: item.id }, data: { inboundKey: item.key } });
    }
  }

  const dupCheck = await prisma.$queryRawUnsafe<{ inboundKey: string; count: bigint }[]>(
    `SELECT "inboundKey", count(*) FROM "TicketMessage" WHERE "inboundKey" IS NOT NULL GROUP BY 1 HAVING count(*) > 1`,
  );
  console.log("Post-write duplicate inboundKey groups (must be 0):", dupCheck.length);
}

main()
  .catch((e) => {
    console.error("backfill-inbound-key failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
