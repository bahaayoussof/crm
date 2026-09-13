import { Channel } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { replyHtmlToPlainText } from "../../shared/rich-text/reply-html.js";
import { emitTicketUpdated } from "../realtime/realtime.publisher.js";
import { deliverOutboundEmailReply } from "./email/email.service.js";
import { deliverOutboundSmsReply } from "./sms/sms.service.js";
import { deliverOutboundReply } from "./whatsapp/whatsapp.service.js";

/**
 * CONV-038 — bounded external-cron-triggered outbound delivery retry sweep.
 *
 * Reuses the exact same `deliverOutbound*` wrappers as the initial post-commit
 * attempt (CONV-037) — same claim/attempt/record logic, same message/delivery
 * identity. Never creates another `TicketMessage`, notification, `AuditLog`,
 * first-response stamp, or `ticket.message.created` event. A genuine delivery-
 * state change emits one `ticket.updated`; an unchanged/no-op claim emits
 * nothing.
 */
const RETRY_BATCH_SIZE = 25;

export async function runOutboundDeliveryRetrySweep() {
  const now = new Date();
  const due = await prisma.messageDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: now } },
    orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
    take: RETRY_BATCH_SIZE,
    select: {
      id: true,
      messageId: true,
      channel: true,
      status: true,
      message: {
        select: {
          id: true,
          body: true,
          ticket: {
            select: {
              id: true,
              subject: true,
              teamId: true,
              assignedAgentId: true,
              emailThreadToken: true,
              customer: { select: { id: true, email: true, phone: true } },
            },
          },
        },
      },
    },
  });

  let attempted = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of due) {
    const ticket = row.message.ticket;
    const before = row.status;
    try {
      if (row.channel === Channel.EMAIL) {
        const references = await prisma.ticketMessage.findMany({
          where: { ticketId: ticket.id, externalMessageId: { not: null } },
          orderBy: { createdAt: "asc" },
          take: 100,
          select: { externalMessageId: true },
        });
        const refIds = references.flatMap((r) => (r.externalMessageId ? [r.externalMessageId] : []));
        await deliverOutboundEmailReply({
          ticketId: ticket.id,
          messageId: row.messageId,
          recipient: ticket.customer?.email ?? null,
          subject: ticket.subject,
          body: row.message.body,
          threadToken: ticket.emailThreadToken ?? "",
          inReplyTo: refIds.at(-1) ?? null,
          references: refIds,
        });
      } else if (row.channel === Channel.SMS) {
        await deliverOutboundSmsReply({ ticketId: ticket.id, messageId: row.messageId, to: ticket.customer?.phone ?? null, text: replyHtmlToPlainText(row.message.body) });
      } else if (row.channel === Channel.WHATSAPP) {
        await deliverOutboundReply({ ticketId: ticket.id, messageId: row.messageId, to: ticket.customer?.phone ?? null, text: replyHtmlToPlainText(row.message.body) });
      } else {
        continue;
      }
      attempted += 1;
    } catch {
      // The deliverOutbound* wrappers are non-throwing by contract; this guards
      // against an unexpected throw so one bad row never aborts the sweep.
      continue;
    }

    const after = await prisma.messageDelivery.findUnique({ where: { id: row.id }, select: { status: true } });
    if (!after) continue;
    if (after.status === before) {
      // Claim lost to an overlapping invocation, or no state change — no-op.
      skipped += 1;
      continue;
    }
    if (after.status === "SENT") sent += 1;
    else if (after.status === "FAILED") failed += 1;
    // CONV-053: a genuine delivery-state change emits exactly one post-commit-
    // style ticket.updated — never a new ticket.message.created event.
    emitTicketUpdated({ ticketId: ticket.id, assignedAgentId: ticket.assignedAgentId, customerId: ticket.customer?.id ?? null, teamId: ticket.teamId });
  }

  return { candidates: due.length, attempted, sent, failed, skipped };
}
