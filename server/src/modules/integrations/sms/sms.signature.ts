import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySmsSignature(raw: Buffer, signature: string | undefined, secret: string) {
  if (!signature || !/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(raw).digest("hex"));
  const actual = Buffer.from(signature.toLowerCase());
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

