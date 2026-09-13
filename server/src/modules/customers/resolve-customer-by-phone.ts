import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { normalizePhoneNumber } from "../../shared/utils/phone.js";

/**
 * CONV-015 — shared canonical phone resolver (OD-CC-6, CC-GAP-21).
 *
 * Normalizes the input phone canonically (reusing the existing SMS/WhatsApp
 * normalization — see CONV-029) and queries across the normalized, digits-only,
 * and raw legacy representations, exactly as today. Zero matches lets the
 * caller proceed to its existing creation flow; exactly one match resolves
 * automatically; two or more matches stop automatic resolution entirely — no
 * customer/ticket/message write happens, and only a correlation id, channel,
 * and match count are safe to log (never phone/email/candidate ids).
 */
export type PhoneResolutionResult<T> =
  | { kind: "none" }
  | { kind: "one"; customer: T }
  | { kind: "ambiguous"; candidateCount: number; correlationId: string };

export async function resolveCustomerByPhone<T extends { id: string }>(
  tx: Prisma.TransactionClient,
  rawPhone: string,
  select: Prisma.CustomerSelect,
): Promise<PhoneResolutionResult<T>> {
  const phone = normalizePhoneNumber(rawPhone);
  if (!phone) return { kind: "none" };
  const digits = phone.replace(/\D/g, "");
  const matches = (await tx.customer.findMany({
    where: { OR: [{ phone }, { phone: digits }, { phone: rawPhone }] },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select,
  })) as unknown as T[];

  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) return { kind: "one", customer: matches[0]! };
  return { kind: "ambiguous", candidateCount: matches.length, correlationId: randomUUID() };
}
