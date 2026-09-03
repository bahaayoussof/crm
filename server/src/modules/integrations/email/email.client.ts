import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import { isDemoMode } from "../../../config/demo.js";
import type { ReceivedEmail } from "./email.types.js";

/**
 * Explicit upper bound on a single outbound Resend request. Matches the SMS
 * provider's `AbortSignal.timeout(20_000)` so both provider-backed reply
 * channels wait the same, bounded amount before giving up. Outbound email
 * delivery already runs AFTER the local `TicketMessage` commit (ADR-052), so a
 * hung Resend request cannot roll back the CRM reply — but it can still keep the
 * HTTP reply request waiting, which this bound prevents. Deterministic constant,
 * not env-configured (mirrors SMS).
 */
export const EMAIL_DELIVERY_TIMEOUT_MS = 20_000;

export class ResendEmailError extends Error {
  constructor(public readonly operation: string, message: string) {
    super(message);
    this.name = "ResendEmailError";
  }
}

function client(apiKey: string) {
  return new Resend(apiKey);
}

export function verifyResendWebhook(params: {
  apiKey: string;
  webhookSecret: string;
  payload: string;
  headers: { id: string; timestamp: string; signature: string };
}) {
  return client(params.apiKey).webhooks.verify({
    payload: params.payload,
    headers: params.headers,
    webhookSecret: params.webhookSecret,
  });
}

export async function retrieveReceivedEmail(apiKey: string, emailId: string): Promise<ReceivedEmail> {
  const result = await client(apiKey).emails.receiving.get(emailId, { html_format: "cid" });
  if (result.error || !result.data) {
    throw new ResendEmailError("retrieve_received", result.error?.message ?? "Resend returned no received email");
  }
  return {
    id: result.data.id,
    from: result.data.from,
    to: result.data.to,
    subject: result.data.subject,
    text: result.data.text,
    html: result.data.html,
    messageId: result.data.message_id,
    headers: result.data.headers ?? {},
    createdAt: result.data.created_at,
    attachments: result.data.attachments.map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      size: attachment.size,
      contentType: attachment.content_type,
    })),
  };
}

export async function downloadReceivedAttachment(apiKey: string, emailId: string, attachmentId: string, maxBytes: number) {
  const result = await client(apiKey).emails.receiving.attachments.get({ id: attachmentId, emailId });
  if (result.error || !result.data) {
    throw new ResendEmailError("retrieve_attachment", result.error?.message ?? "Resend returned no attachment");
  }
  const response = await fetch(result.data.download_url);
  if (!response.ok) throw new ResendEmailError("download_attachment", `Attachment download returned HTTP ${response.status}`);
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new ResendEmailError("download_attachment", "Attachment exceeds the CRM size limit");
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) throw new ResendEmailError("download_attachment", "Attachment exceeds the CRM size limit");
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

/**
 * The installed Resend SDK (6.25.0) does NOT declare `signal` on its request
 * options type (`CreateEmailRequestOptions extends PostOptions, IdempotentRequest`
 * — only `query`, `headers`, `idempotencyKey`). Its runtime `Resend#post`, however,
 * spreads the options object straight into the underlying `fetch(url, options)`
 * call, so an `AbortSignal` passed here reaches `fetch` and performs a REAL
 * request cancellation (the socket is torn down) — not a `Promise.race` that
 * leaves the request running in the background. This cast is the documented
 * bridge over that typing gap.
 */
type ResendSendOptions = NonNullable<Parameters<Resend["emails"]["send"]>[1]> & { signal: AbortSignal };

export async function sendTicketEmail(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo: string | null;
  inReplyTo: string | null;
  references: string[];
  idempotencyKey: string;
  /** Overridable only for deterministic timeout tests; production uses the constant. */
  signal?: AbortSignal;
}) {
  // Public demo: never hand the message to Resend and never require an API key.
  // The outbound ticket reply is already committed; a synthetic id keeps the
  // "message id stored on the row" step working just like a real send.
  if (isDemoMode()) {
    return { emailId: `demo-email-${randomUUID()}` };
  }

  const headers: Record<string, string> = {};
  if (params.inReplyTo) headers["In-Reply-To"] = params.inReplyTo;
  if (params.references.length) headers.References = params.references.join(" ");
  const signal = params.signal ?? AbortSignal.timeout(EMAIL_DELIVERY_TIMEOUT_MS);
  let result: Awaited<ReturnType<ReturnType<typeof client>["emails"]["send"]>>;
  try {
    result = await client(params.apiKey).emails.send(
      {
        from: params.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(params.replyTo ? { replyTo: params.replyTo } : {}),
        ...(Object.keys(headers).length ? { headers } : {}),
      },
      { idempotencyKey: params.idempotencyKey, signal } as ResendSendOptions,
    );
  } catch (error) {
    if (signal.aborted) throw new ResendEmailError("timeout", "Resend did not respond within the outbound email timeout");
    throw error;
  }
  if (result.error || !result.data?.id) {
    // The SDK swallows an aborted fetch into `result.error` (statusCode null)
    // rather than throwing — classify that as a timeout, not a provider rejection.
    if (signal.aborted) throw new ResendEmailError("timeout", "Resend did not respond within the outbound email timeout");
    throw new ResendEmailError("send", result.error?.message ?? "Resend returned no email id");
  }
  return { emailId: result.data.id };
}

export const emailClient = { verifyResendWebhook, retrieveReceivedEmail, downloadReceivedAttachment, sendTicketEmail };
