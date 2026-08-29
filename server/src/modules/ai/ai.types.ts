// feature/ai-assistant (ADR-034) — internal agent-assistance layer.
//
// Provider-agnostic types. Nothing in this file (or anything that imports only
// this file) knows which vendor is behind `AiProvider`.

export type AiAction = "SUMMARY" | "SUGGEST_REPLY" | "CLASSIFY" | "KB_SUGGESTIONS";

export interface AiPublicMessage {
  authorType: "CUSTOMER" | "AGENT";
  body: string;
  createdAt: string;
}

export interface AiInternalNote {
  body: string;
  createdAt: string;
}

/**
 * The only ticket-derived data an AI action ever receives. Built server-side from
 * authorized data after the same visibility check as internal Ticket Details.
 * Deliberately excludes customer email/phone, ids other than the ticket
 * reference, SLA internals, watchers, assignee, and history.
 */
export interface AiTicketContext {
  ticket: {
    reference: string;
    subject: string;
    description: string;
    status: string;
    category: { id: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
  };
  /** Display name only, for reply personalization. Never email or phone. */
  customerDisplayName: string | null;
  publicMessages: AiPublicMessage[];
  internalNotes: AiInternalNote[];
  /** True when message/character limits dropped part of the conversation. */
  truncated: boolean;
}

export interface StructuredRequest {
  system: string;
  prompt: string;
  /** Plain JSON Schema for the required output shape. Provider-independent. */
  schema: Record<string, unknown>;
  /** Short schema identifier, used by providers that name their schemas. */
  schemaName: string;
}

/**
 * The seam between AI business logic and any concrete vendor. Implementations own
 * every vendor-specific HTTP detail (endpoint, auth header, request/response
 * shape, `response_format`, error mapping, timeout/abort). Callers only ever see
 * a parsed `unknown` (still to be Zod-validated) or a normalized `AiProviderError`.
 */
export interface AiProvider {
  readonly name: string;
  readonly model: string;
  generateStructured(request: StructuredRequest): Promise<unknown>;
}
