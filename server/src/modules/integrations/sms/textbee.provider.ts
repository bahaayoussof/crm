import { AppError } from "../../../shared/errors/app-error.js";
import { requireSmsConfig } from "./sms.config.js";
import type { SmsProvider } from "./sms.types.js";

export const textBeeProvider: SmsProvider = {
  async sendMessage({ to, text }) {
    const config = requireSmsConfig();
    let response: Response;
    try {
      response = await fetch(`${config.baseUrl}/api/v1/gateway/send-sms`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": config.apiKey },
        body: JSON.stringify({ recipients: [to], message: text, deviceId: config.deviceId }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new AppError(502, "SMS_DELIVERY_FAILED", "TextBee could not be reached");
    }
    const payload = await response.json().catch(() => null) as { data?: { success?: boolean; smsBatchId?: string; failureCount?: number } } | null;
    if (!response.ok || payload?.data?.success === false || (payload?.data?.failureCount ?? 0) > 0) {
      console.error(`sms: TextBee rejected outbound send status=${response.status}`);
      throw new AppError(502, "SMS_DELIVERY_FAILED", "TextBee rejected the SMS message");
    }
    return { externalId: payload?.data?.smsBatchId };
  },
};

