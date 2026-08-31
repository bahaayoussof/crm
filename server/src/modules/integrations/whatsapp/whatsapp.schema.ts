import { z } from "zod";
import type { InboundTextMessage } from "./whatsapp.types.js";
import { requiredPhoneSchema } from "../../../shared/validation/phone.schema.js";

/**
 * Lenient validation of the Meta WhatsApp Cloud API webhook payload.
 *
 * Meta sends many event shapes (messages, statuses, account updates). We accept
 * anything structurally plausible and let the extractor pull out only inbound
 * text messages; every other event is safely ignored by the caller.
 */

const profileSchema = z.object({ name: z.string().trim().min(1).max(100) }).partial().passthrough();

const contactSchema = z
  .object({ wa_id: z.string().regex(/^\d{7,15}$/), profile: profileSchema })
  .partial()
  .passthrough();

const messageSchema = z
  .object({
    id: z.string().trim().min(1).max(256),
    from: z.string().regex(/^\d{7,15}$/),
    timestamp: z.string().regex(/^\d{1,12}$/),
    type: z.string().trim().min(1).max(50),
    text: z.object({ body: z.string().trim().min(1).max(20_000) }).partial().passthrough(),
  })
  .partial()
  .passthrough();

const changeValueSchema = z
  .object({
    messaging_product: z.string().trim().min(1).max(50),
    contacts: z.array(contactSchema),
    messages: z.array(messageSchema),
    statuses: z.array(z.unknown()),
  })
  .partial()
  .passthrough();

const changeSchema = z
  .object({ field: z.string().trim().min(1).max(100), value: changeValueSchema })
  .partial()
  .passthrough();

const entrySchema = z
  .object({ id: z.string().trim().min(1).max(128), changes: z.array(changeSchema).max(100) })
  .partial()
  .passthrough();

export const whatsappWebhookSchema = z
  .object({ object: z.string().trim().min(1).max(100), entry: z.array(entrySchema).max(100) })
  .partial()
  .passthrough();

export type WhatsappWebhookPayload = z.infer<typeof whatsappWebhookSchema>;

export const whatsappVerificationQuerySchema = z
  .object({
    "hub.mode": z.string().trim().max(50).optional(),
    "hub.verify_token": z.string().max(512).optional(),
    "hub.challenge": z.string().trim().max(2_048).optional(),
  })
  .passthrough();

/**
 * Pull every inbound text message out of a validated webhook payload.
 * Non-text messages, delivery statuses and unrelated fields yield nothing.
 */
export function extractInboundTextMessages(payload: WhatsappWebhookPayload): InboundTextMessage[] {
  const result: InboundTextMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field && change.field !== "messages") continue;
      const value = change.value;
      if (!value) continue;
      const nameByWaId = new Map<string, string>();
      for (const contact of value.contacts ?? []) {
        if (contact.wa_id && contact.profile?.name) nameByWaId.set(contact.wa_id, contact.profile.name);
      }
      for (const message of value.messages ?? []) {
        if (message.type !== "text") continue;
        const body = message.text?.body?.trim();
        if (!message.id || !message.from || !body) continue;
        const phone = requiredPhoneSchema.safeParse(`+${message.from}`);
        if (!phone.success) continue;
        result.push({
          externalId: message.id,
          from: phone.data,
          profileName: nameByWaId.get(message.from) ?? null,
          text: body,
          timestamp: Number.parseInt(message.timestamp ?? "", 10) || Math.floor(Date.now() / 1000),
        });
      }
    }
  }
  return result;
}
