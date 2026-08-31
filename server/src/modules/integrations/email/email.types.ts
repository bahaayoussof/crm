export type EmailDeliveryResult = {
  channel: "EMAIL";
  status: "SENT";
  externalId: string;
};

export interface InboundEmailEvent {
  type: "email.received";
  createdAt: string;
  emailId: string;
  messageId: string;
  from: string;
  to: string[];
  subject: string;
}

export interface ReceivedEmail {
  id: string;
  from: string;
  to: string[];
  subject: string;
  text: string | null;
  html: string | null;
  messageId: string;
  headers: Record<string, string>;
  createdAt: string;
  attachments: Array<{
    id: string;
    filename: string | null;
    size: number;
    contentType: string;
  }>;
}
