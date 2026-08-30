import { env } from "../../../config/env.js";
import type { EmailMessage, EmailProvider } from "../email.types.js";

/**
 * Fallback transport used whenever a real provider is not configured.
 *
 * In development it prints the full message (including any links) to the server
 * console so flows like password reset stay testable with no mail account. In
 * production it logs only that an email was suppressed — never the body.
 */
export const logEmailProvider: EmailProvider = {
  name: "log",
  async send(message: EmailMessage): Promise<void> {
    if (env.NODE_ENV === "production") {
      console.warn(`email suppressed (no provider configured): "${message.subject}" -> ${message.to}`);
      return;
    }
    console.info(
      [
        "──────── EMAIL (log transport) ────────",
        `To:      ${message.to}`,
        `Subject: ${message.subject}`,
        "",
        message.text,
        "──────────────────────────────────────",
      ].join("\n"),
    );
  },
};
