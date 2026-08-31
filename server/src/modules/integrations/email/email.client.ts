import { Resend } from "resend";
import type { ReceivedEmail } from "./email.types.js";

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
}) {
  const headers: Record<string, string> = {};
  if (params.inReplyTo) headers["In-Reply-To"] = params.inReplyTo;
  if (params.references.length) headers.References = params.references.join(" ");
  const result = await client(params.apiKey).emails.send(
    {
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
      ...(Object.keys(headers).length ? { headers } : {}),
    },
    { idempotencyKey: params.idempotencyKey },
  );
  if (result.error || !result.data?.id) {
    throw new ResendEmailError("send", result.error?.message ?? "Resend returned no email id");
  }
  return { emailId: result.data.id };
}

export const emailClient = { verifyResendWebhook, retrieveReceivedEmail, downloadReceivedAttachment, sendTicketEmail };
