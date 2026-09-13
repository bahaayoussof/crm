/**
 * CONV-007 — conservative content provenance backfill.
 *
 * Populates TicketMessage/TicketNote.contentFormat/contentSource for every
 * existing row without fabricating history. Never infers SANITIZED_HTML from
 * body markup shape — only from known write-path provenance (author identity).
 *
 * Usage: npx tsx scripts/backfill-conversation-content.ts [--dry-run]
 */
import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 500;

const CHANNEL_SYSTEM_EMAILS: Record<string, "EMAIL" | "SMS" | "WHATSAPP"> = {
  "email-inbound@system.invalid": "EMAIL",
  "sms-inbound@system.invalid": "SMS",
  "whatsapp-inbound@system.invalid": "WHATSAPP",
};

async function backfillMessages() {
  let processed = 0;
  const counts = { plainProvider: 0, staffRich: 0, portalRich: 0, liveChatRich: 0, uncertainPlain: 0 };

  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.ticketMessage.findMany({
      where: { contentFormat: null },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        author: { select: { email: true, role: true } },
        ticket: { select: { channel: true } },
      },
      orderBy: { id: "asc" },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1]!.id;

    for (const row of rows) {
      const systemChannel = CHANNEL_SYSTEM_EMAILS[row.author.email];
      let data: { contentFormat: "PLAIN_TEXT" | "SANITIZED_HTML"; contentSource: "STAFF" | "PORTAL" | "EMAIL" | "SMS" | "WHATSAPP" | "LIVE_CHAT" | "SYSTEM" };

      if (systemChannel) {
        data = { contentFormat: "PLAIN_TEXT", contentSource: systemChannel };
        counts.plainProvider += 1;
      } else if (row.author.role === Role.ADMIN || row.author.role === Role.MANAGER || row.author.role === Role.AGENT) {
        data = { contentFormat: "SANITIZED_HTML", contentSource: "STAFF" };
        counts.staffRich += 1;
      } else if (row.author.role === Role.CUSTOMER) {
        if (row.ticket.channel === "LIVE_CHAT") {
          data = { contentFormat: "SANITIZED_HTML", contentSource: "LIVE_CHAT" };
          counts.liveChatRich += 1;
        } else {
          data = { contentFormat: "SANITIZED_HTML", contentSource: "PORTAL" };
          counts.portalRich += 1;
        }
      } else {
        // Uncertain/ambiguous: never interpret as rich HTML.
        data = { contentFormat: "PLAIN_TEXT", contentSource: "SYSTEM" };
        counts.uncertainPlain += 1;
      }

      if (!DRY_RUN) {
        await prisma.ticketMessage.update({ where: { id: row.id }, data });
      }
      processed += 1;
    }
  }

  return { processed, counts };
}

async function backfillNotes() {
  // Notes are staff-only and always cross the sanitized rich-text boundary.
  const where = { contentFormat: null };
  const count = await prisma.ticketNote.count({ where });
  if (!DRY_RUN) {
    await prisma.ticketNote.updateMany({ where, data: { contentFormat: "SANITIZED_HTML", contentSource: "STAFF" } });
  }
  return count;
}

async function main() {
  console.log(`Conversation content backfill${DRY_RUN ? " (dry run)" : ""}...`);
  const messages = await backfillMessages();
  const notes = await backfillNotes();
  console.log("TicketMessage:", messages);
  console.log("TicketNote updated:", notes);

  const remainingMessages = await prisma.ticketMessage.count({ where: { contentFormat: null } });
  const remainingNotes = await prisma.ticketNote.count({ where: { contentFormat: null } });
  console.log("Remaining null contentFormat -> message:", remainingMessages, "note:", remainingNotes);
}

main()
  .catch((e) => {
    console.error("backfill-conversation-content failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
