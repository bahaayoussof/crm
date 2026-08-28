import { env } from "../../../config/env.js";

/**
 * Configuration accessors for the WhatsApp integration.
 *
 * Every credential is optional (see config/env.ts). Each concern checks only the
 * variables it needs so that, for example, webhook verification can be set up
 * before an outbound access token exists.
 */

export interface WhatsappSendConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
}

/** Credentials required to send an outbound message via the Graph API. */
export function getSendConfig(): WhatsappSendConfig | null {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return null;
  return {
    accessToken: env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    apiVersion: env.WHATSAPP_API_VERSION,
  };
}

/** Secret required to verify inbound webhook signatures. */
export function getAppSecret(): string | null {
  return env.WHATSAPP_APP_SECRET ?? null;
}

/** Token required to answer the Meta webhook verification handshake (GET). */
export function getVerifyToken(): string | null {
  return env.WHATSAPP_VERIFY_TOKEN ?? null;
}
