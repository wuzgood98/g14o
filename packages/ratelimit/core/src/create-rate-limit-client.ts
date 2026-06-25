/** biome-ignore-all lint/suspicious/noExplicitAny: route handler wrappers use dynamic args */

import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import {
  type InMemoryEnvOptions,
  isInMemoryEnv,
  type Logger,
  noopLogger,
  type RedisConfig,
  resolveEnvName,
  resolveRedisClient,
} from "./config";
import {
  getDefaultIdentifier,
  InMemoryRateLimiter,
  type RateLimitCheckResult,
  type RateLimiterAdapter,
  type RateLimitOptions,
  type RateLimitTier,
  resolveTierConfig,
  type TokenConfig,
  tokenConfig,
} from "./internals";
import type { Duration } from "./parse-duration";

function sanitizeLogValue(value: string): string {
  return value.replace(/[\r\n]/g, "");
}

/** Fields you can override for a single rate-limit tier. Unset fields use factory defaults. */
export interface RateLimitTierConfig {
  /** Max requests allowed within `window`. */
  limit?: number;
  /** Redis key prefix for this tier (Upstash only). Default `@ratelimit:<tier>`. */
  prefix?: string;
  /** Sliding window length (Upstash-style, e.g. `"60 s"`, `"15 m"`). */
  window?: Duration;
}

/**
 * Per-tier overrides. Omitted tiers keep built-in defaults from {@link tokenConfig}.
 */
export interface RateLimitTiersOverride {
  /** Default: 5 req / 15 m. Login, signup, password reset. */
  auth?: RateLimitTierConfig;
  /** Default: 20 req / 60 s. Higher-traffic read endpoints. */
  lenient?: RateLimitTierConfig;
  /** Default: 10 req / 60 s. General API default when `tier` is omitted. */
  moderate?: RateLimitTierConfig;
  /** Default: 5 req / 60 s. Tightest tier — abuse-prone or expensive routes. */
  strict?: RateLimitTierConfig;
  /** Default: 30 req / 1 h. Mutations and write-heavy actions. */
  write?: RateLimitTierConfig;
}

/** Options for {@link createRateLimit}. */
export interface CreateRateLimitOptions extends InMemoryEnvOptions {
  logger?: Logger;
  redis?: RedisConfig;
  /**
   * Override built-in tier limits/windows/prefixes. Each tier key is optional;
   * each field inside a tier is optional and merged onto factory defaults.
   *
   * @example
   * ```ts
   * createRateLimit({ tiers: { strict: { limit: 3 } } });
   * ```
   */
  tiers?: RateLimitTiersOverride;
}

/** Rate limit client returned by {@link createRateLimit}. */
export interface RateLimitClient<
  Req extends Request = Request,
  Res extends Response = Response,
> {
  /** Check the rate limit for a given request.
   * @param req - The request to check the rate limit for.
   * @param options - The options to check the rate limit for.
   * @returns The result of the rate limit check.
   */
  checkRateLimit: (
    req: Req,
    options?: RateLimitOptions<Req>
  ) => Promise<RateLimitCheckResult>;
  /** Get the rate limiter for a given tier.
   * @param tier - The tier to get the rate limiter for.
   * @returns The rate limiter for the given tier.
   */
  getRateLimiter: (tier: RateLimitTier) => RateLimiterAdapter;
  /** Reset the rate limit. */
  reset: () => void;
  /** With rate limit.
   * @param handler - The handler to wrap with rate limit.
   * @param options - The options to wrap the handler with.
   * @returns The wrapped handler.
   */
  withRateLimit: <T extends (req: Req, ...args: any[]) => Promise<Res>>(
    handler: T,
    options?: RateLimitOptions<Req>
  ) => T;
  /** With user rate limit.
   * @param handler - The handler to wrap with user rate limit.
   * @param getUserId - The function to get the user ID from the request.
   * @param options - The options to wrap the handler with.
   * @returns The wrapped handler.
   */
  withUserRateLimit: <T extends (req: Req, ...args: any[]) => Promise<Res>>(
    handler: T,
    getUserId: (req: Req) => Promise<string | null>,
    options?: Omit<RateLimitOptions<Req>, "identifierFn">
  ) => T;
}

class UpstashRateLimiter implements RateLimiterAdapter {
  private readonly ratelimit: Ratelimit;

  constructor(config: TokenConfig, redis: Redis) {
    this.ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        config.limit,
        config.window as `${number} s`
      ),
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
  inMemoryDuringBuild: boolean;
  logger: Logger;
  resolveRedis: () => Redis | null;
  tiers?: RateLimitTiersOverride;
}

function createRateLimitRuntime(
  options: CreateRateLimitOptions = {}
): RateLimitRuntime {
  const envName = resolveEnvName(options.env);
  const logger = options.logger ?? noopLogger;
  const inMemoryDuringBuild = options.inMemoryDuringBuild ?? true;
  let redis: Redis | null | undefined;

  return {
    envName,
    inMemoryDuringBuild,
    logger,
    tiers: options.tiers,
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
 * Creates a rate limit client with bound methods for `Request`/`Response` handlers.
 *
 * @param options - Redis credentials or client, logger, environment, and optional `tiers` overrides.
 */
export function createRateLimit<
  Req extends Request = Request,
  Res extends Response = Response,
>(options: CreateRateLimitOptions = {}): RateLimitClient<Req, Res> {
  const runtime = createRateLimitRuntime(options);

  if (runtime.tiers) {
    for (const tier of Object.keys(tokenConfig) as RateLimitTier[]) {
      const override = runtime.tiers[tier];
      if (override !== undefined) {
        resolveTierConfig(tier, override);
      }
    }
  }

  const rateLimiterCache = new Map<RateLimitTier, RateLimiterAdapter>();

  /** Reset the rate limit. */
  const reset = (): void => {
    for (const limiter of rateLimiterCache.values()) {
      if (limiter instanceof InMemoryRateLimiter) {
        limiter.destroy();
      }
    }
    rateLimiterCache.clear();
  };

  /** Get the rate limiter for a given tier.
   * @param tier - The tier to get the rate limiter for.
   * @returns The rate limiter for the given tier.
   */
  const getRateLimiter = (tier: RateLimitTier): RateLimiterAdapter => {
    const cached = rateLimiterCache.get(tier);
    if (cached) {
      return cached;
    }

    const { logger } = runtime;
    const override = runtime.tiers?.[tier];
    const config = override
      ? resolveTierConfig(tier, override)
      : tokenConfig[tier];
    let limiter: RateLimiterAdapter;

    if (
      isInMemoryEnv(runtime.envName, {
        inMemoryDuringBuild: runtime.inMemoryDuringBuild,
      })
    ) {
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

  /** Check the rate limit for a given request.
   * @param req - The request to check the rate limit for.
   * @param options - The options to check the rate limit for.
   * @returns The result of the rate limit check.
   */
  const checkRateLimit = async (
    req: Req,
    rateLimitOptions: RateLimitOptions<Req> = {}
  ): Promise<RateLimitCheckResult> => {
    const { tier = "moderate", identifierFn, skipRateLimit } = rateLimitOptions;
    const { logger } = runtime;
    const logUrl = sanitizeLogValue(req.url);

    try {
      if (skipRateLimit && (await skipRateLimit(req))) {
        logger.info(`Rate limit skipped for request: ${logUrl}`);
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
      const logIdentifier = sanitizeLogValue(identifier);

      const ratelimit = getRateLimiter(tier);

      const {
        success,
        limit,
        remaining,
        reset: resetAt,
      } = await ratelimit.limit(identifier);

      if (!success) {
        logger.warn(
          `Rate limit exceeded for ${logIdentifier} (tier: ${tier}): ${logUrl}`
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
        `Rate limit check passed for ${logIdentifier}: ${remaining}/${limit} remaining: ${logUrl}`
      );
      return {
        ok: true,
        remaining,
        limit,
        reset: resetAt,
      };
    } catch (error) {
      logger.error(error, `Rate limit check error: ${logUrl}`);
      return {
        ok: true,
        remaining: 0,
        limit: 0,
        reset: Date.now(),
      };
    }
  };

  /** With rate limit.
   * @param handler - The handler to wrap with rate limit.
   * @param options - The options to wrap the handler with.
   * @returns The wrapped handler.
   */
  const withRateLimit = <T extends (req: Req, ...args: any[]) => Promise<Res>>(
    handler: T,
    rateLimitOptions: RateLimitOptions<Req> = {}
  ): T =>
    (async (req: Req, ...args: any[]): Promise<Res> => {
      const rateLimitResult = await checkRateLimit(req, rateLimitOptions);

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
        return Response.json(
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
        ) as Res;
      }

      const response = await handler(req, ...args);

      for (const [key, value] of Object.entries(headers)) {
        response.headers.set(key, value);
      }

      return response;
    }) as T;

  /** With user rate limit.
   * @param handler - The handler to wrap with user rate limit.
   * @param getUserId - The function to get the user ID from the request.
   * @param options - The options to wrap the handler with.
   * @returns The wrapped handler.
   *
   * @example
   * ```ts
   * import { withUserRateLimit } from "@/lib/ratelimit";
   *
   * export const POST = withUserRateLimit(
   *   (req) => Response.json({ message: "Hello, world!" }),
   *   async (req) => req.headers.get("x-user-id"),
   *   { tier: "moderate" }
   * );
   * ```
   */
  const withUserRateLimit = <
    T extends (req: Req, ...args: any[]) => Promise<Res>,
  >(
    handler: T,
    getUserId: (req: Req) => Promise<string | null>,
    rateLimitOptions: Omit<RateLimitOptions<Req>, "identifierFn"> = {}
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
