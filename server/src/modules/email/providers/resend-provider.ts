import { Resend } from "resend";
import type { EmailMessage, EmailProvider } from "../email.types.js";

/** Thin adapter over the Resend HTTP SDK. Constructed only when both
 *  RESEND_API_KEY and EMAIL_FROM are present (see email.config.ts). */
export function createResendProvider(apiKey: string, from: string): EmailProvider {
  const client = new Resend(apiKey);
  return {
    name: "resend",
    async send(message: EmailMessage): Promise<void> {
      const result = await client.emails.send({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      if (result.error) {
        throw new Error(`Resend send failed: ${result.error.message}`);
      }
    },
  };
}
