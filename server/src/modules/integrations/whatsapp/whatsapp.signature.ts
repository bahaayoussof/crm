import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison of two UTF-8 strings. Returns false on any length
 * mismatch without leaking timing information.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Verify Meta's `X-Hub-Signature-256` header against the raw request body.
 *
 * Meta signs the exact bytes it POSTed with HMAC-SHA256 keyed by the App Secret
 * and sends `sha256=<hex>`. We must hash the untouched raw buffer — not a
 * re-serialized JSON object.
 */
export function verifySignature(rawBody: Buffer, header: string | undefined, appSecret: string): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const provided = header.slice("sha256=".length).trim();
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return safeEqual(provided, expected);
}
