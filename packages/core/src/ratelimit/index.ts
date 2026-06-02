/**
 * Rate limiting for `@g14o/core/ratelimit`.
 *
 * Prefer {@link createRateLimit} for app-owned instances (`lib/rate-limit.ts`).
 * Top-level exports are deprecated and rely on {@link configureUtils} from `@g14o/core/config`.
 *
 * @packageDocumentation
 */
/** biome-ignore-all lint/suspicious/noExplicitAny: we need to use any to avoid type errors */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getLogger, getRedis, isInMemoryBackend } from "../config";
import {
  getDefaultIdentifier,
  InMemoryRateLimiter,
  LegacyUpstashRateLimiter,
  type RateLimitCheckResult,
  type RateLimiterAdapter,
  type RateLimitOptions,
  type RateLimitTier,
  tokenConfig,
} from "./internals";

export type {
  CreateRateLimitOptions,
  RateLimitClient,
} from "./create-rate-limit-client";
/** biome-ignore lint/performance/noBarrelFile: public package entry re-export */
export { createRateLimit } from "./create-rate-limit-client";
export {
  getDefaultIdentifier,
  type RateLimitCheckResult,
  type RateLimiterAdapter,
  type RateLimitOptions,
  type RateLimitResultData,
  type RateLimitTier,
} from "./internals";
export type { Duration, Unit } from "./parse-duration";
export { parseDurationToMs } from "./parse-duration";

/** @deprecated Use {@link RateLimitCheckResult} instead. */
export type RateLimitResult = RateLimitCheckResult;

const rateLimiterCache = new Map<RateLimitTier, RateLimiterAdapter>();

/**
 * Returns a memoized rate limiter for the given tier (deprecated global API).
 *
 * @deprecated Use `createRateLimit().getRateLimiter()` instead.
 */
export function getRateLimiter(tier: RateLimitTier): RateLimiterAdapter {
  const cached = rateLimiterCache.get(tier);
  if (cached) {
    return cached;
  }

  const logger = getLogger();
  const config = tokenConfig[tier];
  let limiter: RateLimiterAdapter;

  if (isInMemoryBackend()) {
    logger.info(`Using in-memory rate limiter (tier: ${tier})`);
    limiter = new InMemoryRateLimiter(config);
  } else {
    const redis = getRedis();
    if (!redis) {
      throw new Error(
        "Redis client is required for production rate limiting. Call configureUtils({ redis }) or use createRateLimit({ redis: { url, token } })."
      );
    }
    logger.info(`Using Upstash rate limiter (tier: ${tier})`);
    limiter = new LegacyUpstashRateLimiter(config, redis);
  }

  rateLimiterCache.set(tier, limiter);
  return limiter;
}

/**
 * Clears memoized limiters (deprecated).
 *
 * @deprecated Use `createRateLimit().reset()` instead.
 */
export function resetRateLimiters(): void {
  for (const limiter of rateLimiterCache.values()) {
    if (limiter instanceof InMemoryRateLimiter) {
      limiter.destroy();
    }
  }
  rateLimiterCache.clear();
}

/**
 * Checks rate limit for a request (deprecated).
 *
 * @deprecated Use `createRateLimit().checkRateLimit()` instead.
 */
export async function checkRateLimit(
  req: NextRequest,
  options: RateLimitOptions = {}
): Promise<RateLimitCheckResult> {
  const { tier = "moderate", identifierFn, skipRateLimit } = options;
  const logger = getLogger();

  try {
    if (skipRateLimit && (await skipRateLimit(req))) {
      logger.info(`Rate limit skipped for request: ${req.url}`);
      return {
        ok: true,
        remaining: 999_999,
        limit: 999_999,
        reset: Date.now(),
      };
    }

    const identifier = identifierFn
      ? await identifierFn(req)
      : getDefaultIdentifier(req);

    const ratelimit = getRateLimiter(tier);

    const { success, limit, remaining, reset } =
      await ratelimit.limit(identifier);

    if (!success) {
      logger.warn(
        `Rate limit exceeded for ${identifier} (tier: ${tier}): ${req.url}`
      );
      return {
        ok: false,
        error: new Error("Rate limit exceeded"),
        status: 429,
        remaining,
        limit,
        reset,
      };
    }

    logger.info(
      `Rate limit check passed for ${identifier}: ${remaining}/${limit} remaining: ${req.url}`
    );
    return {
      ok: true,
      remaining,
      limit,
      reset,
    };
  } catch (error) {
    logger.error(error, `Rate limit check error: ${req.url}`);
    return {
      ok: true,
      remaining: 0,
      limit: 0,
      reset: Date.now(),
    };
  }
}

const RETRY_AFTER_DELAY = 1000;

/**
 * Higher-order function that rate-limits a Next.js route handler (deprecated).
 *
 * @deprecated Use `createRateLimit().withRateLimit()` instead.
 */
export function withRateLimit<
  T extends (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
>(handler: T, options: RateLimitOptions = {}): T {
  return (async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const rateLimitResult = await checkRateLimit(req, options);

    const headers = {
      "X-RateLimit-Limit": rateLimitResult.limit.toString(),
      "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
      "X-RateLimit-Reset": rateLimitResult.reset.toString(),
    };

    if (!rateLimitResult.ok) {
      const retryAfterSeconds = Math.max(
        0,
        Math.ceil((rateLimitResult.reset - Date.now()) / RETRY_AFTER_DELAY)
      );
      return NextResponse.json(
        {
          error: "Too many requests",
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            ...headers,
            "Retry-After": retryAfterSeconds.toString(),
          },
        }
      );
    }

    const response = await handler(req, ...args);

    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;
  }) as T;
}

/**
 * Rate-limits by authenticated user id (deprecated).
 *
 * @deprecated Use `createRateLimit().withUserRateLimit()` instead.
 */
export function withUserRateLimit<
  T extends (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
>(
  handler: T,
  getUserId: (req: NextRequest) => Promise<string | null>,
  options: Omit<RateLimitOptions, "identifierFn"> = {}
): T {
  return withRateLimit(handler, {
    ...options,
    identifierFn: async (req) => {
      const userId = await getUserId(req);
      return userId || getDefaultIdentifier(req);
    },
  });
}
