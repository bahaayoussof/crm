import { env } from "../../config/env.js";
import type { EmailProvider } from "./email.types.js";
import { logEmailProvider } from "./providers/log-provider.js";
import { createResendProvider } from "./providers/resend-provider.js";

let cached: EmailProvider | null = null;

/**
 * Resolves the active email provider from configuration. Resend when both
 * RESEND_API_KEY and EMAIL_FROM are set, otherwise the log transport. Cached so
 * the SDK client is constructed once.
 */
export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    cached = createResendProvider(env.RESEND_API_KEY, env.EMAIL_FROM);
  } else {
    cached = logEmailProvider;
  }
  return cached;
}

/** Test seam: force re-resolution after mutating env in a test. */
export function resetEmailProvider(): void {
  cached = null;
}
