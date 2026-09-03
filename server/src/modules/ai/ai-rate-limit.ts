import { isDemoMode } from "../../config/demo.js";
import { rateLimit } from "../../middleware/rate-limit.js";

/**
 * AI-specific rate limit. Production/development: 20 actions per user per 10
 * minutes. Public demo (`DEMO_MODE=true`): a much tighter 6 actions per user per
 * 30 minutes so a shared, publicly reachable OpenRouter key cannot be drained —
 * the feature stays genuinely usable but not abusable. When no AI provider is
 * configured the endpoints already return a graceful `AI_NOT_CONFIGURED`.
 *
 * Keyed by authenticated user id (the route runs after `requireAuth`). The
 * frontend also disables a pending action, but this limiter is the authoritative
 * control.
 */
const limits = isDemoMode()
  ? { windowMs: 30 * 60_000, max: 6 }
  : { windowMs: 10 * 60_000, max: 20 };

export const aiRateLimit = rateLimit({
  windowMs: limits.windowMs,
  max: limits.max,
  key: (request) => request.auth?.userId ?? null,
  message: "You have made too many AI requests. Please wait a few minutes and try again.",
});
