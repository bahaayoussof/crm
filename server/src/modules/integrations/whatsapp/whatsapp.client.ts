import { getSendConfig } from "./whatsapp.config.js";

/**
 * Thin HTTP client for the Meta WhatsApp Cloud API (Graph API).
 *
 * Owns URL construction, auth header, payload mapping and error normalization.
 * Business logic lives in whatsapp.service.ts. Never logs the access token.
 */

export class WhatsappNotConfiguredError extends Error {
  constructor() {
    super("WhatsApp send credentials are not configured");
    this.name = "WhatsappNotConfiguredError";
  }
}

export class WhatsappApiError extends Error {
  constructor(
    /** true when Meta returned a 4xx/5xx (message rejected); false when the request never completed. */
    public readonly rejected: boolean,
    message: string,
  ) {
    super(message);
    this.name = "WhatsappApiError";
  }
}

export interface SendTextMessageInput {
  /** Recipient phone. Accepts "+" and separators; normalized to digits here. */
  to: string;
  text: string;
}

export interface SendTextMessageResult {
  /** Meta message id (wamid...). */
  messageId: string;
}

const GRAPH_HOST = "https://graph.facebook.com";

export async function sendTextMessage(input: SendTextMessageInput): Promise<SendTextMessageResult> {
  const config = getSendConfig();
  if (!config) throw new WhatsappNotConfiguredError();

  const url = `${GRAPH_HOST}/${config.apiVersion}/${config.phoneNumberId}/messages`;
  const to = input.to.replace(/[^\d]/g, "");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: input.text },
      }),
    });
  } catch (cause) {
    throw new WhatsappApiError(false, `WhatsApp API request failed: ${(cause as Error).message}`);
  }

  const payload = (await response.json().catch(() => null)) as
    | { messages?: Array<{ id?: string }>; error?: { message?: string; code?: number } }
    | null;

  if (!response.ok) {
    // Surface only Meta's own error text/code — never headers or the token.
    const detail = payload?.error?.message ?? `HTTP ${response.status}`;
    throw new WhatsappApiError(true, `WhatsApp API rejected the message: ${detail}`);
  }

  const messageId = payload?.messages?.[0]?.id;
  if (!messageId) throw new WhatsappApiError(true, "WhatsApp API response did not contain a message id");
  return { messageId };
}

export const whatsappClient = { sendTextMessage };
