import { rateLimit } from "../../middleware/rate-limit.js";

/**
 * AI-specific rate limit: 20 actions per user per 10 minutes. The frontend also
 * disables a pending action, but this limiter is the authoritative control.
 * Keyed by authenticated user id (the route runs after `requireAuth`).
 */
export const aiRateLimit = rateLimit({
  windowMs: 10 * 60_000,
  max: 20,
  key: (request) => request.auth?.userId ?? null,
  message: "You have made too many AI requests. Please wait a few minutes and try again.",
});
