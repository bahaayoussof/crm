import { TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { SubmitFeedbackInput } from "./feedback.schema.js";

const eligibleStatuses: TicketStatus[] = [TicketStatus.RESOLVED, TicketStatus.CLOSED];
export const isFeedbackEligible = (status: TicketStatus) => eligibleStatuses.includes(status);

async function customerIdFor(userId: string) {
  const customer = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (!customer) throw new AppError(403, "CUSTOMER_PROFILE_REQUIRED", "A linked customer profile is required");
  return customer.id;
}

const feedbackView = (feedback: { rating: number; comment: string | null; createdAt: Date }) => ({
  rating: feedback.rating,
  comment: feedback.comment,
  createdAt: feedback.createdAt,
});

export async function getFeedback(ticketId: string, userId: string) {
  const customerId = await customerIdFor(userId);
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, customerId }, select: { id: true } });
  if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
  const feedback = await prisma.feedback.findUnique({
    where: { ticketId },
    select: { rating: true, comment: true, createdAt: true },
  });
  if (!feedback) throw new AppError(404, "FEEDBACK_NOT_FOUND", "No feedback has been submitted for this ticket");
  return feedbackView(feedback);
}

export async function submitFeedback(ticketId: string, input: SubmitFeedbackInput, userId: string) {
  const customerId = await customerIdFor(userId);
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findFirst({ where: { id: ticketId, customerId }, select: { id: true, status: true } });
    if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
    if (!isFeedbackEligible(ticket.status)) {
      throw new AppError(409, "TICKET_NOT_ELIGIBLE_FOR_FEEDBACK", "Feedback is only accepted for resolved or closed tickets");
    }
    const existing = await tx.feedback.findUnique({ where: { ticketId }, select: { id: true } });
    if (existing) throw new AppError(409, "FEEDBACK_ALREADY_SUBMITTED", "Feedback has already been submitted for this ticket");
    const feedback = await tx.feedback.create({
      data: { ticketId, customerId, rating: input.rating, comment: input.comment ?? null },
      select: { rating: true, comment: true, createdAt: true },
    });
    await tx.ticketHistory.create({
      data: { ticketId, actorUserId: userId, action: "FEEDBACK_SUBMITTED", newValue: String(input.rating) },
    });
    return feedbackView(feedback);
  });
}
