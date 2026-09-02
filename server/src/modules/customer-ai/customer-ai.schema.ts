import { z } from "zod";

const historyItem = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2_000),
}).strict();

export const customerAiChatSchema = z.object({
  message: z.string().trim().min(1).max(2_000),
  history: z.array(historyItem).max(8).default([]),
  locale: z.enum(["en", "ar"]).default("en"),
}).strict();

export const customerAiHandoffSchema = z.object({
  message: z.string().trim().min(1).max(2_000),
  history: z.array(historyItem).max(8).default([]),
}).strict();

export type CustomerAiChatInput = z.infer<typeof customerAiChatSchema>;
export type CustomerAiHandoffInput = z.infer<typeof customerAiHandoffSchema>;

export const customerAiProviderResponseSchema = z.object({
  answer: z.string().trim().min(1).max(4_000),
  confidence: z.number().min(0).max(1),
  articleIds: z.array(z.string()).max(5),
}).strict();

export const CUSTOMER_AI_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "confidence", "articleIds"],
  properties: {
    answer: { type: "string", maxLength: 4000 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    articleIds: { type: "array", maxItems: 5, items: { type: "string" } },
  },
} as const;
