import { Prisma, TicketStatus } from "@prisma/client";
import { customerReplyNotificationRecipientIds } from "../../shared/team/team-scope.js";
import { createNotifications } from "../notifications/notification.service.js";
import type { ConversationContentFormat, ConversationContentSource } from "../../shared/rich-text/conversation-content.js";

/**
 * CONV-016 — shared inbound idempotency + persistence helper.
 *
 * Applies the namespaced inbound idempotency key, declared content metadata,
 * `WAITING_CUSTOMER -> IN_PROGRESS` ticket transition, customer-reply
 * notification rows, and the full realtime audience payload — atomically,
 * inside the caller's own transaction. Mirrors the existing Email/SMS/WhatsApp
 * inbound transaction shape (this is not a new architecture).
 *
 * Duplicate classification (CC-GAP-03 fix, generalized): a `P2002` is treated
 * as `DUPLICATE` only when the violated constraint targets
 * `TicketMessage.inboundKey`. Any other unique violation (e.g. a placeholder-
 * email collision) is re-thrown for the caller's own error handling — it must
 * never be silently swallowed as a duplicate provider delivery.
 */
export type PersistInboundMessageParams = {
  ticket: { id: string; status: TicketStatus; assignedAgentId: string | null; teamId: string | null; subject: string; customerId: string };
  authorUserId: string;
  body: string;
  inboundKey: string;
  contentFormat: ConversationContentFormat;
  contentSource: ConversationContentSource;
  createdAt: Date;
  externalId?: string | null;
  externalMessageId?: string | null;
  messageId?: string;
};

export type PersistInboundMessageResult =
  | {
      status: "CREATED";
      messageId: string;
      assignedAgentId: string | null;
      customerId: string;
      teamId: string | null;
    }
  | { status: "DUPLICATE" };

/** True only when the P2002 violation targets the inbound idempotency constraint. */
export function isInboundKeyConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  const targets = Array.isArray(target) ? target : typeof target === "string" ? [target] : [];
  return targets.some((t) => String(t).toLowerCase().includes("inboundkey"));
}

export async function persistInboundMessage(
  tx: Prisma.TransactionClient,
  params: PersistInboundMessageParams,
): Promise<PersistInboundMessageResult> {
  let messageId: string;
  try {
    const created = await tx.ticketMessage.create({
      data: {
        id: params.messageId,
        ticketId: params.ticket.id,
        authorUserId: params.authorUserId,
        body: params.body,
        createdAt: params.createdAt,
        inboundKey: params.inboundKey,
        externalId: params.externalId ?? undefined,
        externalMessageId: params.externalMessageId ?? undefined,
        contentFormat: params.contentFormat,
        contentSource: params.contentSource,
      },
      select: { id: true },
    });
    messageId = created.id;
  } catch (error) {
    if (isInboundKeyConflict(error)) return { status: "DUPLICATE" };
    throw error;
  }

  if (params.ticket.status === TicketStatus.WAITING_CUSTOMER) {
    await tx.ticket.update({ where: { id: params.ticket.id }, data: { status: TicketStatus.IN_PROGRESS } });
    await tx.ticketHistory.create({
      data: { ticketId: params.ticket.id, actorUserId: null, action: "STATUS_CHANGED", oldValue: TicketStatus.WAITING_CUSTOMER, newValue: TicketStatus.IN_PROGRESS },
    });
  }

  const recipients = await customerReplyNotificationRecipientIds(tx, {
    ticketId: params.ticket.id,
    teamId: params.ticket.teamId,
    assignedAgentId: params.ticket.assignedAgentId,
  });
  await createNotifications(tx, recipients, "CUSTOMER_REPLY", "Customer replied", `Customer replied to ticket #${params.ticket.id}: ${params.ticket.subject}`, params.ticket.id);

  return {
    status: "CREATED",
    messageId,
    assignedAgentId: params.ticket.assignedAgentId,
    customerId: params.ticket.customerId,
    teamId: params.ticket.teamId,
  };
}
