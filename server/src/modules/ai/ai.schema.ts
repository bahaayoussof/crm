import { z } from "zod";

export const AI_ACTIONS = ["SUMMARY", "SUGGEST_REPLY", "CLASSIFY", "KB_SUGGESTIONS"] as const;

/** Supported summary/reasoning output languages (strict — never a free-form hint). */
export const AI_LOCALES = ["en", "ar"] as const;
export type AiLocale = (typeof AI_LOCALES)[number];

/** Request body for `POST /api/tickets/:id/ai`. The client sends nothing else. */
export const aiActionSchema = z
  .object({
    action: z.enum(AI_ACTIONS),
    /**
     * Optional output language for SUMMARY (internal). A closed enum, not a
     * prompt string — the client cannot inject arbitrary instructions.
     */
    locale: z.enum(AI_LOCALES).optional(),
  })
  .strict();
export type AiActionInput = z.infer<typeof aiActionSchema>;

// ---------------------------------------------------------------------------
// Output schemas — server-side Zod validation of provider output. Unknown keys
// are stripped (not rejected) so the client only ever receives known fields even
// if a model returns extras. These are the authoritative guarantee; a provider
// `response_format` request is never trusted on its own.
// ---------------------------------------------------------------------------

export const aiSummarySchema = z.object({
  issue: z.string().trim().min(1).max(1000),
  timeline: z.array(z.string().trim().min(1).max(500)).max(8),
  currentState: z.string().trim().min(1).max(1000),
  recommendedNextAction: z.string().trim().min(1).max(1000),
});
export type AiSummary = z.infer<typeof aiSummarySchema>;

export const aiSuggestedReplySchema = z.object({
  reply: z.string().trim().min(1).max(5000),
});
export type AiSuggestedReply = z.infer<typeof aiSuggestedReplySchema>;

export const aiClassificationSchema = z.object({
  categoryId: z.string().trim().min(1),
  categoryName: z.string().trim().min(1).max(200),
  confidence: z.number().min(0).max(1),
  reason: z.string().trim().max(1000),
});
export type AiClassification = z.infer<typeof aiClassificationSchema>;

export const aiKbSuggestionsSchema = z.object({
  articles: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        relevance: z.number().min(0).max(1),
        reason: z.string().trim().max(1000),
      }),
    )
    .max(5),
});
export type AiKbSuggestions = z.infer<typeof aiKbSuggestionsSchema>;

// ---------------------------------------------------------------------------
// JSON Schema mirrors, passed to the provider for structured-output mode. Plain
// JSON Schema is provider-independent; each adapter wraps it into its own
// `response_format` shape.
// ---------------------------------------------------------------------------

export const AI_JSON_SCHEMAS = {
  SUMMARY: {
    type: "object",
    additionalProperties: false,
    required: ["issue", "timeline", "currentState", "recommendedNextAction"],
    properties: {
      issue: { type: "string" },
      timeline: { type: "array", items: { type: "string" }, maxItems: 8 },
      currentState: { type: "string" },
      recommendedNextAction: { type: "string" },
    },
  },
  SUGGEST_REPLY: {
    type: "object",
    additionalProperties: false,
    required: ["reply"],
    properties: { reply: { type: "string" } },
  },
  CLASSIFY: {
    type: "object",
    additionalProperties: false,
    required: ["categoryId", "categoryName", "confidence", "reason"],
    properties: {
      categoryId: { type: "string" },
      categoryName: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      reason: { type: "string" },
    },
  },
  KB_SUGGESTIONS: {
    type: "object",
    additionalProperties: false,
    required: ["articles"],
    properties: {
      articles: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "relevance", "reason"],
          properties: {
            id: { type: "string" },
            relevance: { type: "number", minimum: 0, maximum: 1 },
            reason: { type: "string" },
          },
        },
      },
    },
  },
} as const satisfies Record<string, Record<string, unknown>>;
