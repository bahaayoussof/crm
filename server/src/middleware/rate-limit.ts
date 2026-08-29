import type { Request, RequestHandler } from "express";
import { AppError } from "../shared/errors/app-error.js";

export interface RateLimitOptions {
  /** Rolling window length in milliseconds. */
  windowMs: number;
  /** Maximum allowed requests per key per window. */
  max: number;
  /** Derives the bucket key from the request. Return `null` to skip limiting. */
  key: (request: Request) => string | null;
  /** Structured error code. Defaults to `RATE_LIMITED`. */
  code?: string;
  /** User-facing message. */
  message?: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Adequate for this project's single-instance deployment model. It is NOT shared
 * across processes — a horizontally scaled deployment would need a shared store
 * (Redis or similar). Documented as a known limitation.
 */
export function rateLimit(options: RateLimitOptions): RequestHandler & { reset: () => void } {
  const buckets = new Map<string, Bucket>();
  const code = options.code ?? "RATE_LIMITED";
  const message = options.message ?? "Too many requests. Please try again later.";

  const handler: RequestHandler = (request, response, next) => {
    const key = options.key(request);
    if (key === null) {
      next();
      return;
    }

    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (existing.count >= options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      response.setHeader("Retry-After", String(retryAfterSeconds));
      next(new AppError(429, code, message, { retryAfterSeconds }));
      return;
    }

    existing.count += 1;
    next();
  };

  return Object.assign(handler, { reset: () => buckets.clear() });
}
