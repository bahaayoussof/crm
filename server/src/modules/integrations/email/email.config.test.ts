import { afterEach, describe, expect, it } from "vitest";
import { env } from "../../../config/env.js";
import { requireInboundEmailConfig, requireOutboundEmailConfig } from "./email.config.js";

const original = {
  apiKey: env.RESEND_API_KEY,
  webhookSecret: env.RESEND_WEBHOOK_SECRET,
  inboundAddress: env.EMAIL_INBOUND_ADDRESS,
  from: env.EMAIL_FROM,
  fromName: env.EMAIL_FROM_NAME,
};

afterEach(() => {
  env.RESEND_API_KEY = original.apiKey;
  env.RESEND_WEBHOOK_SECRET = original.webhookSecret;
  env.EMAIL_INBOUND_ADDRESS = original.inboundAddress;
  env.EMAIL_FROM = original.from;
  env.EMAIL_FROM_NAME = original.fromName;
});

describe("email configuration", () => {
  it("rejects outbound use clearly without affecting application startup", () => {
    env.RESEND_API_KEY = undefined;
    env.EMAIL_FROM = undefined;

    expect(requireOutboundEmailConfig).toThrowError(expect.objectContaining({
      statusCode: 503,
      code: "EMAIL_NOT_CONFIGURED",
    }));
  });

  it("accepts a development sender and formats the optional display name", () => {
    env.RESEND_API_KEY = "re_test";
    env.EMAIL_FROM = "onboarding@resend.dev";
    env.EMAIL_FROM_NAME = "CRM Support";

    expect(requireOutboundEmailConfig()).toMatchObject({
      from: "CRM Support <onboarding@resend.dev>",
    });
  });

  it("requires the complete inbound webhook configuration only when used", () => {
    env.RESEND_API_KEY = "re_test";
    env.RESEND_WEBHOOK_SECRET = undefined;
    env.EMAIL_INBOUND_ADDRESS = "support@crm-test.resend.app";

    expect(requireInboundEmailConfig).toThrowError(expect.objectContaining({
      statusCode: 503,
      code: "EMAIL_WEBHOOK_NOT_CONFIGURED",
    }));
  });
});
