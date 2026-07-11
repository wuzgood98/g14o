import type { Duration } from "../parse-duration";

/** Resolved rate-limit settings passed to a store limiter. */
export interface RateLimitStoreConfig {
  /** Max requests allowed within `window`. */
  limit: number;
  /** Key namespace prefix for this limiter. */
  prefix: string;
  /** Sliding window length (e.g. `"60 s"`, `"15 m"`). */
  window: Duration;
}

/** Result of a single `limit(identifier)` call on a store limiter. */
export interface RateLimitResultData {
  /** Configured max requests in the window. */
  limit: number;
  /** Requests remaining in the current window. */
  remaining: number;
  /** Unix timestamp (ms) when the window resets. */
  reset: number;
  /** Whether the request is allowed. */
  success: boolean;
}

/**
 * A tier-scoped limiter produced by a {@link RateLimitStore}.
 *
 * Use via {@link RateLimitClient.getRateLimiter} for custom flows.
 */
export interface RateLimitStoreLimiter {
  /**
   * Consumes one request against `identifier`.
   *
   * @param identifier - Client IP, user ID, API key, or other stable key.
   * @returns Limit state after this call.
   */
  limit(identifier: string): Promise<RateLimitResultData>;
  /** Clears in-process state when supported (memory store). */
  reset?(): void;
}

/** @deprecated Use {@link RateLimitStoreLimiter}. */
export type RateLimiterAdapter = RateLimitStoreLimiter;

/**
 * Storage backend for rate limiting.
 *
 * Implementations own persistence, TTL, and atomic updates.
 */
export interface RateLimitStore {
  /**
   * Creates a limiter for the given tier configuration.
   *
   * @param config - Limit, window, and key prefix for this limiter.
   * @returns A limiter instance scoped to the configuration.
   */
  createLimiter(config: RateLimitStoreConfig): RateLimitStoreLimiter;
}
