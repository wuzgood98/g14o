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
 * @returns A new response with rate-limit headers set.
 */
export function applyRateLimitHeadersToResponse(
  response: Response,
  result: Pick<RateLimitCheckResult, "limit" | "remaining" | "reset">
): Response {
  const rateLimitHeaders = buildRateLimitHeaders(result);
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(rateLimitHeaders)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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
  c.res = applyRateLimitHeadersToResponse(c.res, result);
}

/**
 * Attaches `X-RateLimit-*` headers via Hono's `c.header()` without replacing `c.res`.
 *
 * Call **before** `next()` in middleware so handlers can read `c.res.headers` during
 * execution. Hono merges these prepared headers into the
 * handler response. Do not call after `next()` from middleware — a second pass can
 * drop the handler JSON body under `@hono/node-server`.
 *
 * @param c - Hono context.
 * @param result - Limit, remaining, and reset from a check result.
 */
export function applyRateLimitHeadersViaContext<E extends Env>(
  c: Context<E>,
  result: Pick<RateLimitCheckResult, "limit" | "remaining" | "reset">
): void {
  for (const [key, value] of Object.entries(buildRateLimitHeaders(result))) {
    c.header(key, value);
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
