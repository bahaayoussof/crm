export interface SmsSendInput { to: string; text: string }
export interface SmsSendResult { externalId?: string }
export interface SmsProvider { sendMessage(input: SmsSendInput): Promise<SmsSendResult> }
export interface InboundSms { externalId: string; from: string; text: string; receivedAt: Date }

