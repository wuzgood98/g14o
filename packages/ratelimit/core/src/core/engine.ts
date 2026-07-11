/** biome-ignore-all lint/suspicious/noExplicitAny: route handler wrappers use dynamic args */

import { isInMemoryEnv, resolveEnvName } from "../env";
import type { Duration } from "../parse-duration";
import type { ResolveStoreOptions } from "../store/factory";
import { createFallbackMemoryStore, resolveStore } from "../store/factory";
import type {
  RateLimiterAdapter,
  RateLimitStore,
  RateLimitStoreLimiter,
} from "../store/interface";
import { type InMemoryEnvOptions, type Logger, noopLogger } from "../types";
import {
  applyRateLimitHeadersToResponse,
  buildRateLimitExceededBody,
  buildRateLimitHeaders,
  computeRetryAfterSeconds,
} from "./headers";
import { type RateLimitHooks, runHook } from "./hooks";
import {
  getDefaultIdentifier,
  type RateLimitCheckResult,
  type RateLimitOptions,
  type RateLimitRequest,
  type RateLimitResponse,
  resolveUserIdentifier,
  shouldSkipRateLimit,
} from "./request";
import {
  type RateLimitTier,
  resolveTierConfig,
  type TokenConfig,
  tokenConfig,
  validatePrefix,
} from "./tiers";

function sanitizeLogValue(value: string): string {
  return value.replace(/[\r\n]/g, "");
}

/** Fields you can override for a single rate-limit tier. Unset fields use factory defaults. */
export interface RateLimitTierConfig {
  /** Max requests allowed within `window`. */
  limit?: number;
  /** Key prefix for this tier. Default `@ratelimit:<tier>`. */
  prefix?: string;
  /** Sliding window length (e.g. `"60 s"`, `"15 m"`). */
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
export type CreateRateLimitOptions<Req extends RateLimitRequest = Request> =
  InMemoryEnvOptions & {
    /**
     * Optional lifecycle hooks for observability and side effects.
     *
     * Hooks are awaited; hook errors are logged and swallowed so they never
     * affect rate limiting or fail-open behavior.
     */
    hooks?: RateLimitHooks<Req>;
    /**
     * Application logger. Defaults to a silent no-op logger.
     */
    logger?: Logger;
    /**
     * When `true`, skip rate limiting for every request from this client.
     * Evaluated at client creation — no request is available. Use per-call
     * `skipRateLimit` for request-aware skip logic.
     *
     * @example
     * ```ts
     * createRateLimit({ skipRateLimit: process.env.CI === "true" })
     * ```
     */
    skipRateLimit?: boolean;
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
  } & ResolveStoreOptions;

/**
 * Rate limit client returned by {@link createRateLimit}.
 *
 * @typeParam Req - Request type passed to handlers and `checkRateLimit`. Defaults to Web `Request`.
 * @typeParam Res - Response type returned by wrapped handlers. Defaults to Web `Response`.
 */
export interface RateLimitClient<
  Req extends RateLimitRequest = Request,
  Res extends RateLimitResponse = Response,
> {
  /**
   * Checks the rate limit for a request without wrapping a handler.
   *
   * Fails open on internal errors (returns `ok: true` with zeroed counters).
   *
   * @param req - Request to rate limit.
   * @param options - Tier, prefix, identifier, or skip callback.
   * @returns Discriminated {@link RateLimitCheckResult}; `ok: false` includes `status: 429`.
   */
  checkRateLimit: (
    req: Req,
    options?: RateLimitOptions<Req>
  ) => Promise<RateLimitCheckResult>;
  /**
   * Returns a cached rate limiter adapter for a tier.
   *
   * @param tier - Built-in tier name.
   * @param prefixOverride - Optional key prefix override for this limiter instance.
   * @returns {@link RateLimiterAdapter} for direct `limit(identifier)` calls.
   */
  getRateLimiter: (
    tier: RateLimitTier,
    prefixOverride?: string
  ) => RateLimiterAdapter;
  /**
   * Clears in-memory limiter state and the adapter cache.
   *
   * Useful in tests; does not reset Upstash Redis counters.
   */
  reset: () => void;
  /**
   * Wraps an async handler with rate limiting.
   *
   * Returns `429` JSON with `Retry-After` and `X-RateLimit-*` headers when blocked.
   * On success, attaches `X-RateLimit-*` headers to the handler response.
   *
   * @param handler - Route handler to wrap.
   * @param options - Tier, prefix, identifier, or skip callback.
   * @returns Wrapped handler with the same signature.
   */
  withRateLimit: <T extends (req: Req, ...args: any[]) => Promise<Res>>(
    handler: T,
    options?: RateLimitOptions<Req>
  ) => T;
  /**
   * Wraps a handler with per-user rate limiting.
   *
   * Uses `getUserId(req)` as the identifier; falls back to IP via {@link getDefaultIdentifier} when null.
   *
   * @param handler - Route handler to wrap.
   * @param getUserId - Resolves the authenticated user ID from the request.
   * @param options - Tier, prefix, or skip callback (`identifierFn` is managed internally).
   * @returns Wrapped handler with the same signature.
   *
   * @example
   * ```ts
   * import { withUserRateLimit } from "@/lib/ratelimit";
   * import { getSession } from "@/lib/auth";
   *
   * export const POST = withUserRateLimit(
   *   (req) => Response.json({ message: "Hello, world!" }),
   *   async (req) => {
   *     const session = await getSession(req);
   *     return session?.user.id ?? null;
   *   },
   *   { tier: "moderate" }
   * );
   * ```
   */
  withUserRateLimit: <T extends (req: Req, ...args: any[]) => Promise<Res>>(
    handler: T,
    getUserId: (req: Req) => Promise<string | null>,
    options?: Omit<RateLimitOptions<Req>, "identifierFn">
  ) => T;
}

interface RateLimitRuntime {
  configuredStore: RateLimitStore | undefined;
  envName: string;
  inMemoryDuringBuild: boolean;
  logger: Logger;
  skipRateLimit?: boolean;
  tiers?: RateLimitTiersOverride;
}

function createRateLimitRuntime<Req extends RateLimitRequest = Request>(
  options: CreateRateLimitOptions<Req> = {}
): RateLimitRuntime {
  return {
    envName: resolveEnvName(options.env),
    logger: options.logger ?? noopLogger,
    inMemoryDuringBuild: options.inMemoryDuringBuild ?? true,
    skipRateLimit: options.skipRateLimit,
    tiers: options.tiers,
    configuredStore: resolveStore(options),
  };
}

/**
 * Creates a rate limit client with bound methods for `Request`/`Response` handlers.
 *
 * @param options - Store or Redis credentials, logger, environment, and optional `tiers` overrides.
 * @returns {@link RateLimitClient} instance.
 *
 * @example
 * ```ts
 * export const { withRateLimit, checkRateLimit } = createRateLimit({
 *   redis: {
 *     url: process.env.UPSTASH_REDIS_REST_URL!,
 *     token: process.env.UPSTASH_REDIS_REST_TOKEN!,
 *   },
 *   logger,
 * });
 *
 * export const POST = withRateLimit(
 *   async (req) => Response.json({ ok: true }),
 *   { tier: "moderate" }
 * );
 * ```
 */
export function createRateLimit<
  Req extends RateLimitRequest = Request,
  Res extends RateLimitResponse = Response,
>(options: CreateRateLimitOptions<Req> = {}): RateLimitClient<Req, Res> {
  const runtime = createRateLimitRuntime(options);
  const hooks = options.hooks;

  if (runtime.tiers) {
    for (const tier of Object.keys(tokenConfig) as RateLimitTier[]) {
      const override = runtime.tiers[tier];
      if (override !== undefined) {
        resolveTierConfig(tier, override);
      }
    }
  }

  const rateLimiterCache = new Map<string, RateLimitStoreLimiter>();
  let fallbackMemoryStore: RateLimitStore | undefined;

  const getFallbackMemoryStore = (): RateLimitStore => {
    if (!fallbackMemoryStore) {
      fallbackMemoryStore = createFallbackMemoryStore();
    }
    return fallbackMemoryStore;
  };

  /** Reset the rate limit. */
  const reset = (): void => {
    const clearedKeys = [...rateLimiterCache.keys()];
    for (const limiter of rateLimiterCache.values()) {
      limiter.reset?.();
    }
    rateLimiterCache.clear();
    runHook(hooks?.onReset, { clearedKeys }, runtime.logger).catch(
      () => undefined
    );
  };

  const resolveLimiterConfig = (
    tier: RateLimitTier,
    prefixOverride?: string
  ): TokenConfig => {
    const override = runtime.tiers?.[tier];
    const config = override
      ? resolveTierConfig(tier, override)
      : tokenConfig[tier];
    if (prefixOverride !== undefined) {
      validatePrefix(prefixOverride);
    }
    const effectivePrefix = prefixOverride ?? config.prefix;
    return { ...config, prefix: effectivePrefix };
  };

  const getRateLimiter = (
    tier: RateLimitTier,
    prefixOverride?: string
  ): RateLimiterAdapter => {
    const config = resolveLimiterConfig(tier, prefixOverride);
    const cacheKey = `${tier}:${config.prefix}`;
    const cached = rateLimiterCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { logger } = runtime;
    let limiter: RateLimitStoreLimiter;

    if (runtime.configuredStore) {
      logger.info(`Using configured rate limit store (tier: ${tier})`);
      limiter = runtime.configuredStore.createLimiter(config);
    } else if (
      isInMemoryEnv(runtime.envName, {
        inMemoryDuringBuild: runtime.inMemoryDuringBuild,
      })
    ) {
      logger.info(`Using in-memory rate limiter (tier: ${tier})`);
      limiter = getFallbackMemoryStore().createLimiter(config);
    } else {
      throw new Error(
        "Redis is required for production rate limiting. Pass createRateLimit({ redis: { url, token } }) or redis: Redis.fromEnv()."
      );
    }

    rateLimiterCache.set(cacheKey, limiter);
    return limiter;
  };

  const checkRateLimit = async (
    req: Req,
    rateLimitOptions: RateLimitOptions<Req> = {}
  ): Promise<RateLimitCheckResult> => {
    const {
      tier = "moderate",
      identifierFn,
      skipRateLimit,
      prefix,
    } = rateLimitOptions;

    if (prefix !== undefined) {
      validatePrefix(prefix);
    }

    const { logger } = runtime;
    const logUrl = sanitizeLogValue(req.url);
    let identifier: string | undefined;

    try {
      if (
        await shouldSkipRateLimit(runtime.skipRateLimit, skipRateLimit, req)
      ) {
        logger.info(`Rate limit skipped for request: ${logUrl}`);
        return {
          ok: true,
          remaining: 999_999,
          limit: 999_999,
          reset: Date.now(),
        };
      }

      identifier = identifierFn
        ? await identifierFn(req)
        : getDefaultIdentifier(req);
      const logIdentifier = sanitizeLogValue(identifier);

      const ratelimit = getRateLimiter(tier, prefix);

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
        const hookContext = {
          req,
          tier,
          identifier,
          limit,
          remaining,
          reset: resetAt,
        };
        await runHook(hooks?.onLimitExceeded, hookContext, logger);
        await runHook(
          hooks?.onFailure,
          { ...hookContext, reason: "limit_exceeded" },
          logger
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
      await runHook(
        hooks?.onSuccess,
        {
          req,
          tier,
          identifier,
          limit,
          remaining,
          reset: resetAt,
        },
        logger
      );
      return {
        ok: true,
        remaining,
        limit,
        reset: resetAt,
      };
    } catch (error) {
      logger.error(error, `Rate limit check error: ${logUrl}`);
      const err = error instanceof Error ? error : new Error(String(error));
      await runHook(
        hooks?.onStoreError,
        { req, tier, identifier, error: err },
        logger
      );
      await runHook(
        hooks?.onFailure,
        { req, tier, identifier, error: err, reason: "store_error" },
        logger
      );
      return {
        ok: true,
        remaining: 0,
        limit: 0,
        reset: Date.now(),
      };
    }
  };

  const withRateLimit = <T extends (req: Req, ...args: any[]) => Promise<Res>>(
    handler: T,
    rateLimitOptions: RateLimitOptions<Req> = {}
  ): T =>
    (async (req: Req, ...args: any[]): Promise<Res> => {
      const rateLimitResult = await checkRateLimit(req, rateLimitOptions);

      const headers = buildRateLimitHeaders(rateLimitResult);

      if (!rateLimitResult.ok) {
        const retryAfterSeconds = computeRetryAfterSeconds(
          rateLimitResult.reset
        );
        return Response.json(buildRateLimitExceededBody(retryAfterSeconds), {
          status: 429,
          headers: {
            ...headers,
            "Retry-After": retryAfterSeconds.toString(),
          },
        }) as unknown as Res;
      }

      const response = await handler(req, ...args);

      return applyRateLimitHeadersToResponse(
        response as unknown as Response,
        rateLimitResult
      ) as unknown as Res;
    }) as T;

  const withUserRateLimit = <
    T extends (req: Req, ...args: any[]) => Promise<Res>,
  >(
    handler: T,
    getUserId: (req: Req) => Promise<string | null>,
    rateLimitOptions: Omit<RateLimitOptions<Req>, "identifierFn"> = {}
  ): T =>
    withRateLimit(handler, {
      ...rateLimitOptions,
      identifierFn: async (req) =>
        resolveUserIdentifier(await getUserId(req), req),
    });

  return {
    withRateLimit,
    withUserRateLimit,
    checkRateLimit,
    getRateLimiter,
    reset,
  };
}
