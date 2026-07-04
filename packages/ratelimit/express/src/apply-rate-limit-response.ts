import {
  buildRateLimitExceededBody,
  buildRateLimitHeaders,
  computeRetryAfterSeconds,
  type RateLimitCheckResult,
} from "@g14o/ratelimit";
import type { Response } from "express";

/**
 * Attaches `X-RateLimit-*` headers to an Express response.
 *
 * @param res - Express response.
 * @param result - Limit, remaining, and reset from a check result.
 */
export function applyRateLimitHeaders(
  res: Response,
  result: Pick<RateLimitCheckResult, "limit" | "remaining" | "reset">
): void {
  const headers = buildRateLimitHeaders(result);
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}

/**
 * Sends a `429` response with standard rate-limit headers and body.
 *
 * @param res - Express response.
 * @param result - Failed check result (`ok: false`).
 */
export function sendRateLimitExceeded(
  res: Response,
  result: Extract<RateLimitCheckResult, { ok: false }>
): void {
  const headers = buildRateLimitHeaders(result);
  const retryAfterSeconds = computeRetryAfterSeconds(result.reset);

  res
    .status(429)
    .set({
      ...headers,
      "Retry-After": retryAfterSeconds.toString(),
    })
    .json(buildRateLimitExceededBody(retryAfterSeconds));
}
