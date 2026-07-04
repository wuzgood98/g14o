/** Milliseconds divisor used by {@link computeRetryAfterSeconds}. */
export const RETRY_AFTER_DELAY_MS = 1000;

/** Input shape for {@link buildRateLimitHeaders}. */
export interface RateLimitHeaderInput {
  /** Configured max requests in the window. */
  limit: number;
  /** Requests remaining in the current window. */
  remaining: number;
  /** Unix timestamp (ms) when the window resets. */
  reset: number;
}

/**
 * Builds standard `X-RateLimit-*` headers from a check result.
 *
 * @param result - Limit, remaining, and reset values.
 * @returns Header map with `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`.
 */
export function buildRateLimitHeaders(
  result: RateLimitHeaderInput
): Record<string, string> {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  };
}

/**
 * Computes `Retry-After` seconds from a reset timestamp.
 *
 * @param reset - Unix timestamp (ms) when the rate-limit window resets.
 * @returns Non-negative seconds until reset.
 */
export function computeRetryAfterSeconds(reset: number): number {
  return Math.max(0, Math.ceil((reset - Date.now()) / RETRY_AFTER_DELAY_MS));
}

/**
 * Standard 429 JSON body shared across framework adapters.
 *
 * @param retryAfterSeconds - Value for the `retryAfter` field and `Retry-After` header.
 * @returns `{ error: "Too many requests", retryAfter }`.
 */
export function buildRateLimitExceededBody(retryAfterSeconds: number): {
  error: string;
  retryAfter: number;
} {
  return {
    error: "Too many requests",
    retryAfter: retryAfterSeconds,
  };
}
