/**
 * CONV-009 — conservative outbound delivery backfill.
 *
 * Creates a MessageDelivery(status = SENT) row only for a TicketMessage whose
 * staff authorship, provider channel, and existing externalId provenance are
 * all conclusive (i.e. unambiguously an outbound message that was sent, not
 * an inbound one). Every other outbound-looking row is left with no
 * MessageDelivery row — historical delivery status stays unknown; no PENDING
 * or FAILED rows are fabricated either.
 *
 * "Conclusive outbound" = TicketMessage.externalId is set AND the author is
 * NOT one of the channel inbound system users (see backfill-inbound-key.ts)
 * AND the ticket channel is EMAIL/SMS/WHATSAPP.
 *
 * Usage: npx tsx scripts/backfill-message-delivery.ts [--dry-run]
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const INBOUND_SYSTEM_EMAILS = new Set([
  "email-inbound@system.invalid",
  "sms-inbound@system.invalid",
  "whatsapp-inbound@system.invalid",
]);

async function main() {
  console.log(`MessageDelivery backfill${DRY_RUN ? " (dry run)" : ""}...`);

  const rows = await prisma.ticketMessage.findMany({
    where: {
      externalId: { not: null },
      ticket: { channel: { in: ["EMAIL", "SMS", "WHATSAPP"] } },
      delivery: null,
    },
    select: {
      id: true,
      externalId: true,
      createdAt: true,
      author: { select: { email: true } },
      ticket: { select: { channel: true } },
    },
  });

  const conclusive = rows.filter((r) => !INBOUND_SYSTEM_EMAILS.has(r.author.email));
  const skippedInbound = rows.length - conclusive.length;

  console.log(`Candidate outbound-looking rows: ${rows.length}`);
  console.log(`Conclusive (will create MessageDelivery SENT): ${conclusive.length}`);
  console.log(`Skipped (inbound-authored, ambiguous): ${skippedInbound}`);

  let created = 0;
  if (!DRY_RUN) {
    for (const row of conclusive) {
      await prisma.messageDelivery.create({
        data: {
          messageId: row.id,
          channel: row.ticket.channel,
          status: "SENT",
          providerMessageId: row.externalId,
          attemptCount: 1,
          firstAttemptedAt: row.createdAt,
          lastAttemptedAt: row.createdAt,
          sentAt: row.createdAt,
        },
      });
      created += 1;
    }
  }
  console.log(`MessageDelivery rows created: ${DRY_RUN ? "(dry run, 0 actually written)" : created}`);
  console.log(
    "Historical delivery status for every other existing outbound-looking message remains unknown (no row created) — documented limitation, not a defect.",
  );
}

main()
  .catch((e) => {
    console.error("backfill-message-delivery failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
