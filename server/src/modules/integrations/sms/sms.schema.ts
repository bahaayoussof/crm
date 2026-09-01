import { z } from "zod";
import { requiredPhoneSchema } from "../../../shared/validation/phone.schema.js";

export const smsWebhookSchema = z.object({
  smsId: z.string().trim().min(1).max(256),
  message: z.string().trim().min(1).max(20_000),
  deviceId: z.string().trim().min(1).max(256),
  webhookSubscriptionId: z.string().trim().min(1).max(256).optional(),
  webhookEvent: z.literal("MESSAGE_RECEIVED"),
  idempotencyKey: z.string().trim().min(1).max(256).optional(),
  sender: requiredPhoneSchema,
  receivedAt: z.coerce.date(),
}).passthrough();

