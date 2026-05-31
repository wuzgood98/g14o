/** biome-ignore-all lint/suspicious/noExplicitAny: route handler wrappers use dynamic args */

import {
  isInMemoryEnv,
  type Logger,
  noopLogger,
  type RedisConfig,
  resolveEnvName,
  resolveRedisClient,
} from "@g14o/utils/config";
import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getDefaultIdentifier,
  InMemoryRateLimiter,
  type RateLimitCheckResult,
  type RateLimiterAdapter,
  type RateLimitOptions,
  type RateLimitTier,
  type TokenConfig,
  tokenConfig,
} from "./internals";

/** Options for {@link createRateLimit}. */
export interface CreateRateLimitOptions {
  env?: string;
  logger?: Logger;
  redis?: RedisConfig;
}

/** Rate limit client returned by {@link createRateLimit}. */
export interface RateLimitClient {
  checkRateLimit: (
    req: NextRequest,
    options?: RateLimitOptions
  ) => Promise<RateLimitCheckResult>;
  getRateLimiter: (tier: RateLimitTier) => RateLimiterAdapter;
  reset: () => void;
  withRateLimit: <
    T extends (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
  >(
    handler: T,
    options?: RateLimitOptions
  ) => T;
  withUserRateLimit: <
    T extends (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
  >(
    handler: T,
    getUserId: (req: NextRequest) => Promise<string | null>,
    options?: Omit<RateLimitOptions, "identifierFn">
  ) => T;
}

class UpstashRateLimiter implements RateLimiterAdapter {
  private readonly ratelimit: Ratelimit;

  constructor(config: TokenConfig, redis: Redis) {
    this.ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.limit, config.window),
      analytics: true,
      prefix: config.prefix,
    });
  }

  async limit(identifier: string): Promise<{
    limit: number;
    remaining: number;
    reset: number;
    success: boolean;
  }> {
    const { success, limit, remaining, reset } =
      await this.ratelimit.limit(identifier);
    return { success, limit, remaining, reset };
  }
}

interface RateLimitRuntime {
  envName: string;
  logger: Logger;
  resolveRedis: () => Redis | null;
}

function createRateLimitRuntime(
  options: CreateRateLimitOptions = {}
): RateLimitRuntime {
  const envName = resolveEnvName(options.env);
  const logger = options.logger ?? noopLogger;
  let redis: Redis | null | undefined;

  return {
    envName,
    logger,
    resolveRedis: () => {
      if (redis === undefined) {
        redis = options.redis ? resolveRedisClient(options.redis) : null;
      }
      return redis;
    },
  };
}

const RETRY_AFTER_DELAY = 1000;

/**
 * Creates a rate limit client with bound methods for Next.js route handlers.
 *
 * @param options - Redis credentials or client, logger, and environment.
 */
export function createRateLimit(
  options: CreateRateLimitOptions = {}
): RateLimitClient {
  const runtime = createRateLimitRuntime(options);
  const rateLimiterCache = new Map<RateLimitTier, RateLimiterAdapter>();

  const reset = (): void => {
    for (const limiter of rateLimiterCache.values()) {
      if (limiter instanceof InMemoryRateLimiter) {
        limiter.destroy();
      }
    }
    rateLimiterCache.clear();
  };

  const getRateLimiter = (tier: RateLimitTier): RateLimiterAdapter => {
    const cached = rateLimiterCache.get(tier);
    if (cached) {
      return cached;
    }

    const { logger } = runtime;
    const config = tokenConfig[tier];
    let limiter: RateLimiterAdapter;

    if (isInMemoryEnv(runtime.envName)) {
      logger.info(`Using in-memory rate limiter (tier: ${tier})`);
      limiter = new InMemoryRateLimiter(config);
    } else {
      const redis = runtime.resolveRedis();
      if (!redis) {
        throw new Error(
          "Redis is required for production rate limiting. Pass createRateLimit({ redis: { url, token } }) or redis: Redis.fromEnv()."
        );
      }
      logger.info(`Using Upstash rate limiter (tier: ${tier})`);
      limiter = new UpstashRateLimiter(config, redis);
    }

    rateLimiterCache.set(tier, limiter);
    return limiter;
  };

  const checkRateLimit = async (
    req: NextRequest,
    rateLimitOptions: RateLimitOptions = {}
  ): Promise<RateLimitCheckResult> => {
    const { tier = "moderate", identifierFn, skipRateLimit } = rateLimitOptions;
    const { logger } = runtime;

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

      const {
        success,
        limit,
        remaining,
        reset: resetAt,
      } = await ratelimit.limit(identifier);

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
          reset: resetAt,
        };
      }

      logger.info(
        `Rate limit check passed for ${identifier}: ${remaining}/${limit} remaining: ${req.url}`
      );
      return {
        ok: true,
        remaining,
        limit,
        reset: resetAt,
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
  };

  const withRateLimit = <
    T extends (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
  >(
    handler: T,
    rateLimitOptions: RateLimitOptions = {}
  ): T =>
    (async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
      const rateLimitResult = await checkRateLimit(req, rateLimitOptions);

      const headers = {
        "X-RateLimit-Limit": rateLimitResult.limit.toString(),
        "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
        "X-RateLimit-Reset": rateLimitResult.reset.toString(),
      };

      if (!rateLimitResult.ok) {
        return NextResponse.json(
          {
            error: "Too many requests",
            retryAfter: Math.ceil(
              (rateLimitResult.reset - Date.now()) / RETRY_AFTER_DELAY
            ),
          },
          {
            status: 429,
            headers: {
              ...headers,
              "Retry-After": Math.ceil(
                (rateLimitResult.reset - Date.now()) / RETRY_AFTER_DELAY
              ).toString(),
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

  const withUserRateLimit = <
    T extends (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
  >(
    handler: T,
    getUserId: (req: NextRequest) => Promise<string | null>,
    rateLimitOptions: Omit<RateLimitOptions, "identifierFn"> = {}
  ): T =>
    withRateLimit(handler, {
      ...rateLimitOptions,
      identifierFn: async (req) => {
        const userId = await getUserId(req);
        return userId || getDefaultIdentifier(req);
      },
    });

  return {
    withRateLimit,
    withUserRateLimit,
    checkRateLimit,
    getRateLimiter,
    reset,
  };
}
