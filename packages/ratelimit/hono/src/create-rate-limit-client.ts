/** biome-ignore-all lint/suspicious/noExplicitAny: Hono handler wrappers use dynamic args */
/** biome-ignore-all lint/style/noExportedImports: Exporting types */

import type {
  CreateRateLimitOptions,
  RateLimitCheckResult,
  RateLimiterAdapter,
  RateLimitFailureContext,
  RateLimitHookContext,
  RateLimitHooks,
  RateLimitOptions,
  RateLimitRequest,
  RateLimitResetContext,
  RateLimitStoreErrorContext,
  RateLimitTier,
} from "@g14o/ratelimit";
import {
  createRateLimit as createCoreRateLimit,
  resolveUserIdentifier,
} from "@g14o/ratelimit";
import type { Context, Env, MiddlewareHandler } from "hono";
import {
  applyRateLimitHeadersToResponse,
  applyRateLimitHeadersViaContext,
  rateLimitExceededResponse,
} from "./apply-rate-limit-response";

export type {
  CreateRateLimitOptions,
  RateLimitFailureContext,
  RateLimitHookContext,
  RateLimitHooks,
  RateLimitResetContext,
  RateLimitStoreErrorContext,
};

/** Per-call rate limit options with Hono-native `Context` callbacks. */
export interface HonoRateLimitOptions<E extends Env = Env> {
  /**
   * Function to get the identifier for the request. Defaults to the IP address of the request.
   * @example
   * ```ts
   * { identifierFn: (c) => c.req.header("x-api-key") ?? "anonymous" }
   * ```
   */
  identifierFn?: (c: Context<E>) => string | Promise<string>;
  /**
   * Redis key prefix override for this call. Defaults to the tier prefix.
   * @example
   * ```ts
   * { prefix: "@ratelimit:chat" }
   * ```
   */
  prefix?: string;
  /**
   * Skip rate limit for this request.
   * @example
   * ```ts
   * { skipRateLimit: true }
   * ```
   * @example
   * ```ts
   * { skipRateLimit: (c) => c.req.header("x-internal") === "1" }
   * ```
   */
  skipRateLimit?: boolean | ((c: Context<E>) => boolean | Promise<boolean>);
  /**
   * Rate limit tier to use. Defaults to `"moderate"`.
   * @example
   * ```ts
   * { tier: "strict" }
   * ```
   */
  tier?: RateLimitTier;
}

/** Hono route handler that returns a Web `Response`. */
export type HonoHandler<
  E extends Env = Env,
  R extends Response | Promise<Response> = Response | Promise<Response>,
> = (c: Context<E>) => R;

/**
 * Rate limit client returned by {@link createRateLimit}.
 *
 * Provides Hono middleware and route handler wrappers over `@g14o/ratelimit`.
 *
 * Pass your app's `Env` to {@link createRateLimit} so `Context` in handlers
 * includes typed `Bindings` and `Variables`.
 */
export interface HonoRateLimitClient<E extends Env = Env> {
  /**
   * Checks the rate limit for a Hono request without wrapping a handler.
   *
   * @param c - Hono context.
   * @param options - Tier, prefix, identifier, or skip callback.
   * @returns Discriminated {@link RateLimitCheckResult}.
   */
  checkRateLimit: (
    c: Context<E>,
    options?: HonoRateLimitOptions<E>
  ) => Promise<RateLimitCheckResult>;
  /**
   * Returns a cached rate limiter adapter for a tier.
   *
   * @param tier - Built-in tier name.
   * @param prefixOverride - Optional Redis key prefix override.
   * @returns {@link RateLimiterAdapter} for direct `limit(identifier)` calls.
   */
  getRateLimiter: (
    tier: RateLimitTier,
    prefixOverride?: string
  ) => RateLimiterAdapter;
  /**
   * Hono middleware that rate-limits before `next()`.
   *
   * Returns `429` with standard headers when blocked; calls `next()` when allowed.
   *
   * @param options - Tier, prefix, identifier, or skip callback.
   * @returns Hono `MiddlewareHandler`.
   */
  middleware: (options?: HonoRateLimitOptions<E>) => MiddlewareHandler<E>;
  /**
   * Clears in-memory limiter state and the adapter cache.
   *
   * Useful in tests; does not reset Upstash Redis counters.
   */
  reset: () => void;
  /**
   * Hono middleware with per-user rate limiting.
   *
   * Uses `getUserId(c)` as the identifier; falls back to IP when null.
   *
   * @param getUserId - Resolves the authenticated user ID from the context.
   * @param options - Tier, prefix, or skip callback.
   * @returns Hono `MiddlewareHandler`.
   */
  userMiddleware: (
    getUserId: (c: Context<E>) => Promise<string | null>,
    options?: Omit<HonoRateLimitOptions<E>, "identifierFn">
  ) => MiddlewareHandler<E>;
  /**
   * Wraps a Hono route handler with rate limiting.
   *
   * Returns `429` when blocked; invokes the handler when allowed.
   *
   * @param handler - Hono route handler.
   * @param options - Tier, prefix, identifier, or skip callback.
   * @returns Hono `MiddlewareHandler` assignable to typed `app.*` routes.
   */
  withRateLimit: (
    handler: HonoHandler<E>,
    options?: HonoRateLimitOptions<E>
  ) => MiddlewareHandler<E>;
  /**
   * Wraps a Hono route handler with per-user rate limiting.
   *
   * @param handler - Hono route handler.
   * @param getUserId - Resolves the authenticated user ID from the context.
   * @param options - Tier, prefix, or skip callback.
   * @returns Hono `MiddlewareHandler` assignable to typed `app.*` routes.
   */
  withUserRateLimit: (
    handler: HonoHandler<E>,
    getUserId: (c: Context<E>) => Promise<string | null>,
    options?: Omit<HonoRateLimitOptions<E>, "identifierFn">
  ) => MiddlewareHandler<E>;
}

function toCoreOptions<E extends Env>(
  c: Context<E>,
  options: HonoRateLimitOptions<E> = {}
): RateLimitOptions<RateLimitRequest> {
  const { identifierFn, skipRateLimit, tier, prefix } = options;

  let mappedSkipRateLimit: RateLimitOptions<RateLimitRequest>["skipRateLimit"];
  if (skipRateLimit === undefined) {
    mappedSkipRateLimit = undefined;
  } else if (typeof skipRateLimit === "function") {
    mappedSkipRateLimit = async () => skipRateLimit(c);
  } else {
    mappedSkipRateLimit = skipRateLimit;
  }

  return {
    tier,
    prefix,
    identifierFn: identifierFn ? async () => identifierFn(c) : undefined,
    skipRateLimit: mappedSkipRateLimit,
  };
}

function createUserIdentifierFn<E extends Env>(
  getUserId: (c: Context<E>) => Promise<string | null>
): (c: Context<E>) => Promise<string> {
  return async (c) => resolveUserIdentifier(await getUserId(c), c.req.raw);
}

/**
 * Creates a rate limit client with middleware and handler wrappers for Hono.
 *
 * Delegates to {@link @g14o/ratelimit | @g14o/ratelimit} at runtime.
 *
 * @param options - Redis credentials or client, environment, verbose logging, and optional `tiers` overrides.
 * @returns {@link HonoRateLimitClient} instance.
 *
 * @example
 * ```ts
 * type AppEnv = { Bindings: Bindings; Variables: Variables };
 *
 * export const { middleware, withRateLimit } = createRateLimit<AppEnv>({
 *   redis: {
 *     url: process.env.UPSTASH_REDIS_REST_URL!,
 *     token: process.env.UPSTASH_REDIS_REST_TOKEN!,
 *   },
 * });
 *
 * app.post("/api/chat", withRateLimit((c) => c.json({ ok: true }), { tier: "moderate" }));
 * ```
 */
export function createRateLimit<E extends Env = Env>(
  options: CreateRateLimitOptions<RateLimitRequest> = {}
): HonoRateLimitClient<E> {
  const core = createCoreRateLimit<RateLimitRequest, never>(options);

  const checkRateLimit = async (
    c: Context<E>,
    rateLimitOptions: HonoRateLimitOptions<E> = {}
  ): Promise<RateLimitCheckResult> =>
    core.checkRateLimit(c.req.raw, toCoreOptions(c, rateLimitOptions));

  const runRateLimit = async (
    c: Context<E>,
    rateLimitOptions: HonoRateLimitOptions<E>
  ): Promise<
    | { allowed: true; result: Extract<RateLimitCheckResult, { ok: true }> }
    | { allowed: false; response: Response }
  > => {
    const result = await checkRateLimit(c, rateLimitOptions);
    if (!result.ok) {
      return { allowed: false, response: rateLimitExceededResponse(result) };
    }
    return { allowed: true, result };
  };

  const middleware = (
    rateLimitOptions: HonoRateLimitOptions<E> = {}
  ): MiddlewareHandler<E> =>
    (async (c, next) => {
      const outcome = await runRateLimit(c, rateLimitOptions);
      if (!outcome.allowed) {
        return outcome.response;
      }
      // Headers before next() only — re-applying after next() can clear the handler body.
      applyRateLimitHeadersViaContext(c, outcome.result);
      await next();
    }) as MiddlewareHandler<E>;

  const userMiddleware = (
    getUserId: (c: Context<E>) => Promise<string | null>,
    rateLimitOptions: Omit<HonoRateLimitOptions<E>, "identifierFn"> = {}
  ): MiddlewareHandler<E> =>
    middleware({
      ...rateLimitOptions,
      identifierFn: createUserIdentifierFn(getUserId),
    });

  const withRateLimit = (
    handler: HonoHandler<E>,
    rateLimitOptions: HonoRateLimitOptions<E> = {}
  ): MiddlewareHandler<E> =>
    (async (c) => {
      const outcome = await runRateLimit(c, rateLimitOptions);
      if (!outcome.allowed) {
        return outcome.response;
      }
      const response = await handler(c);
      return applyRateLimitHeadersToResponse(response, outcome.result);
    }) as MiddlewareHandler<E>;

  const withUserRateLimit = (
    handler: HonoHandler<E>,
    getUserId: (c: Context<E>) => Promise<string | null>,
    rateLimitOptions: Omit<HonoRateLimitOptions<E>, "identifierFn"> = {}
  ): MiddlewareHandler<E> =>
    withRateLimit(handler, {
      ...rateLimitOptions,
      identifierFn: createUserIdentifierFn(getUserId),
    });

  return {
    checkRateLimit,
    middleware,
    userMiddleware,
    withRateLimit,
    withUserRateLimit,
    getRateLimiter: core.getRateLimiter,
    reset: core.reset,
  };
}
