import { sendEmail } from "./email.service.js";

/** Minimal HTML escaping for the few interpolated values below. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendPasswordResetEmail(params: {
  email: string;
  name: string;
  resetUrl: string;
}): Promise<void> {
  const { email, name, resetUrl } = params;
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl);

  const subject = "Reset your password";
  const text = [
    `Hi ${name},`,
    "",
    "We received a request to reset the password for your account.",
    "Open the link below to choose a new password. It expires in 30 minutes and can be used once.",
    "",
    resetUrl,
    "",
    "If you did not request this, you can safely ignore this email — your password will not change.",
  ].join("\n");

  const html = [
    `<p>Hi ${safeName},</p>`,
    "<p>We received a request to reset the password for your account.</p>",
    `<p><a href="${safeUrl}">Choose a new password</a></p>`,
    "<p>This link expires in 30 minutes and can be used once.</p>",
    "<p>If you did not request this, you can safely ignore this email — your password will not change.</p>",
  ].join("");

  await sendEmail({ to: email, subject, html, text });
}
