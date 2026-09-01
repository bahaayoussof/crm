import type { SmsProvider } from "./sms.types.js";

let override: SmsProvider | null = null;

export async function getSmsProvider(): Promise<SmsProvider> {
  if (override) return override;
  const { textBeeProvider } = await import("./textbee.provider.js");
  return textBeeProvider;
}

export function setSmsProviderForTests(provider: SmsProvider | null) { override = provider; }

