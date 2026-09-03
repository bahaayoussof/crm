import { randomUUID } from "node:crypto";
import { isDemoMode } from "../../../config/demo.js";
import type { SmsProvider } from "./sms.types.js";

let override: SmsProvider | null = null;

/**
 * Public-demo transport: accepts every send and returns a synthetic batch id
 * without touching TextBee. The caller (`deliverOutboundSmsReply`) still commits
 * the `TicketMessage`, history, notifications and realtime events — only the
 * network call to the gateway is skipped, and no TEXTBEE_* credentials are
 * required. Never selected outside `DEMO_MODE=true`.
 */
export const demoSmsProvider: SmsProvider = {
  async sendMessage() {
    return { externalId: `demo-sms-${randomUUID()}` };
  },
};

export async function getSmsProvider(): Promise<SmsProvider> {
  if (override) return override;
  if (isDemoMode()) return demoSmsProvider;
  const { textBeeProvider } = await import("./textbee.provider.js");
  return textBeeProvider;
}

export function setSmsProviderForTests(provider: SmsProvider | null) { override = provider; }
