import { getEmailProvider } from "./email.config.js";
import type { EmailMessage } from "./email.types.js";

/**
 * Sends a transactional email through the configured provider.
 *
 * Delivery failures are logged and swallowed — a mail outage must never turn a
 * security flow (e.g. "forgot password") into a 500 or leak provider internals
 * to the caller.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const provider = getEmailProvider();
  try {
    await provider.send(message);
  } catch (error) {
    console.error(`email delivery failed via "${provider.name}" for subject "${message.subject}"`, error);
  }
}
