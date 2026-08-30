import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../config/env.js";
import { resetEmailProvider } from "./email.config.js";
import { sendPasswordResetEmail } from "./password-reset.email.js";

describe("email log transport", () => {
  const originalKey = env.RESEND_API_KEY;
  const originalFrom = env.EMAIL_FROM;

  beforeEach(() => {
    // Force the log transport regardless of the developer's local .env.
    (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = undefined;
    (env as { EMAIL_FROM?: string }).EMAIL_FROM = undefined;
    resetEmailProvider();
  });

  afterEach(() => {
    (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = originalKey;
    (env as { EMAIL_FROM?: string }).EMAIL_FROM = originalFrom;
    resetEmailProvider();
    vi.restoreAllMocks();
  });

  it("routes the password reset email to the console and never throws", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(
      sendPasswordResetEmail({
        email: "user@example.com",
        name: "Test User",
        resetUrl: "http://localhost:5173/reset-password?token=abc123",
      }),
    ).resolves.toBeUndefined();
    expect(info).toHaveBeenCalledOnce();
    expect(info.mock.calls[0]![0]).toContain("http://localhost:5173/reset-password?token=abc123");
  });
});
