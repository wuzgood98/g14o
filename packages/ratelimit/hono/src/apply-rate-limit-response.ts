import {
  buildRateLimitExceededBody,
  buildRateLimitHeaders,
  computeRetryAfterSeconds,
  type RateLimitCheckResult,
} from "@g14o/ratelimit";
import type { Context, Env } from "hono";

/**
 * Attaches `X-RateLimit-*` headers to a Web `Response`.
 *
 * @param response - Handler response.
 * @param result - Limit, remaining, and reset from a check result.
 * @returns The same response with rate-limit headers set.
 */
export function applyRateLimitHeadersToResponse(
  response: Response,
  result: Pick<RateLimitCheckResult, "limit" | "remaining" | "reset">
): Response {
  const headers = buildRateLimitHeaders(result);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Attaches `X-RateLimit-*` headers to the Hono context response (`c.res`).
 *
 * @param c - Hono context.
 * @param result - Limit, remaining, and reset from a check result.
 */
export function applyRateLimitHeadersToContext<E extends Env>(
  c: Context<E>,
  result: Pick<RateLimitCheckResult, "limit" | "remaining" | "reset">
): void {
  const headers = buildRateLimitHeaders(result);
  for (const [key, value] of Object.entries(headers)) {
    c.res.headers.set(key, value);
  }
}

/**
 * Builds a `429` Web `Response` with standard rate-limit headers and body.
 *
 * @param result - Failed check result (`ok: false`).
 * @returns Rate-limit exceeded response.
 */
export function rateLimitExceededResponse(
  result: Extract<RateLimitCheckResult, { ok: false }>
): Response {
  const headers = buildRateLimitHeaders(result);
  const retryAfterSeconds = computeRetryAfterSeconds(result.reset);

  return Response.json(buildRateLimitExceededBody(retryAfterSeconds), {
    status: 429,
    headers: {
      ...headers,
      "Retry-After": retryAfterSeconds.toString(),
    },
  });
}
