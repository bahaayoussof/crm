import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../../config/env.js";
import { getSmsProvider, demoSmsProvider } from "./sms/sms.provider.js";
import { sendTextMessage } from "./whatsapp/whatsapp.client.js";
import { sendTicketEmail } from "./email/email.client.js";

type MutableEnv = { DEMO_MODE?: boolean };
const setDemo = (value: boolean) => {
  (env as MutableEnv).DEMO_MODE = value;
};

afterEach(() => {
  setDemo(false);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("outbound provider simulation in demo mode", () => {
  it("SMS: getSmsProvider returns the simulated provider and never calls fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    setDemo(true);

    const provider = await getSmsProvider();
    expect(provider).toBe(demoSmsProvider);

    const result = await provider.sendMessage({ to: "+15550100199", text: "hello from the demo" });
    expect(result.externalId).toMatch(/^demo-sms-/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("SMS: outside demo mode the real TextBee provider is selected", async () => {
    setDemo(false);
    const provider = await getSmsProvider();
    expect(provider).not.toBe(demoSmsProvider);
  });

  it("WhatsApp: sendTextMessage returns a synthetic wamid with no token and no fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    setDemo(true);

    const result = await sendTextMessage({ to: "+15550100199", text: "demo reply" });
    expect(result.messageId).toMatch(/^demo-wamid-/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Email: sendTicketEmail returns a synthetic id with no Resend call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    setDemo(true);

    const result = await sendTicketEmail({
      apiKey: "unused-in-demo",
      from: "support@demo.local",
      to: "customer@demo.local",
      subject: "Re: your ticket",
      html: "<p>hi</p>",
      text: "hi",
      replyTo: null,
      inReplyTo: null,
      references: [],
      idempotencyKey: "demo-key",
    });
    expect(result.emailId).toMatch(/^demo-email-/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
