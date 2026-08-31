import { z } from "zod";

const receivedDataSchema = z.object({
  email_id: z.string().min(1).max(200),
  message_id: z.string().min(1).max(998),
  from: z.string().min(3).max(320),
  to: z.array(z.string().min(3).max(320)).min(1).max(50),
  subject: z.string().max(998).default(""),
}).passthrough();

export const resendWebhookEventSchema = z.object({
  type: z.string().min(1).max(100),
  created_at: z.string().max(100).optional(),
  data: z.unknown(),
}).passthrough();

export function extractReceivedEvent(value: unknown) {
  const envelope = resendWebhookEventSchema.parse(value);
  if (envelope.type !== "email.received") return null;
  const data = receivedDataSchema.parse(envelope.data);
  return {
    type: "email.received" as const,
    createdAt: envelope.created_at ?? new Date().toISOString(),
    emailId: data.email_id,
    messageId: data.message_id,
    from: data.from,
    to: data.to,
    subject: data.subject,
  };
}
