import { z } from "zod";
import type { InboundTextMessage } from "./whatsapp.types.js";

/**
 * Lenient validation of the Meta WhatsApp Cloud API webhook payload.
 *
 * Meta sends many event shapes (messages, statuses, account updates). We accept
 * anything structurally plausible and let the extractor pull out only inbound
 * text messages; every other event is safely ignored by the caller.
 */

const profileSchema = z.object({ name: z.string() }).partial().passthrough();

const contactSchema = z
  .object({ wa_id: z.string(), profile: profileSchema })
  .partial()
  .passthrough();

const messageSchema = z
  .object({
    id: z.string(),
    from: z.string(),
    timestamp: z.string(),
    type: z.string(),
    text: z.object({ body: z.string() }).partial().passthrough(),
  })
  .partial()
  .passthrough();

const changeValueSchema = z
  .object({
    messaging_product: z.string(),
    contacts: z.array(contactSchema),
    messages: z.array(messageSchema),
    statuses: z.array(z.unknown()),
  })
  .partial()
  .passthrough();

const changeSchema = z
  .object({ field: z.string(), value: changeValueSchema })
  .partial()
  .passthrough();

const entrySchema = z
  .object({ id: z.string(), changes: z.array(changeSchema) })
  .partial()
  .passthrough();

export const whatsappWebhookSchema = z
  .object({ object: z.string(), entry: z.array(entrySchema) })
  .partial()
  .passthrough();

export type WhatsappWebhookPayload = z.infer<typeof whatsappWebhookSchema>;

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
        result.push({
          externalId: message.id,
          from: message.from,
          profileName: nameByWaId.get(message.from) ?? null,
          text: body,
          timestamp: Number.parseInt(message.timestamp ?? "", 10) || Math.floor(Date.now() / 1000),
        });
      }
    }
  }
  return result;
}
