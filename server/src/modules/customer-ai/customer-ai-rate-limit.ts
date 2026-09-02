import { rateLimit } from "../../middleware/rate-limit.js";
export const customerAiRateLimit = rateLimit({
  windowMs: 10 * 60_000,
  max: 20,
  key: (request) => request.auth?.userId ?? null,
  code: "CUSTOMER_AI_RATE_LIMITED",
  message: "You have made too many support requests. Please wait and try again.",
});
