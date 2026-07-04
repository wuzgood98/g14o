/** biome-ignore-all lint/suspicious/noExplicitAny: Express handler wrappers use dynamic args */
/** biome-ignore-all lint/style/noExportedImports: Exporting types */

import {
  type CreateRateLimitOptions,
  createRateLimit as createCoreRateLimit,
  getDefaultIdentifier,
  type RateLimitCheckResult,
  type RateLimiterAdapter,
  type RateLimitOptions,
  type RateLimitRequest,
  type RateLimitTier,
} from "@g14o/ratelimit";
import type {
  RequestHandler as ExpressRequestHandler,
  Request,
  Response,
} from "express";
import { adaptExpressRequest } from "./adapt-request";
import {
  applyRateLimitHeaders,
  sendRateLimitExceeded,
} from "./apply-rate-limit-response";

/**
 * Express `RequestHandler` re-exported as a package-owned type alias.
 *
 * Owning the alias keeps the inferred type of returned handlers nameable via
 * `@g14o/ratelimit-express`, so consumers don't hit TS2742 (`ParamsDictionary` /
 * `ParsedQs` not portable) and need no explicit annotation.
 */
export type RequestHandler = ExpressRequestHandler;

export type { CreateRateLimitOptions };

/** Per-call rate limit options with Express-native `Request` callbacks. */
export interface ExpressRateLimitOptions {
  /**
   * Function to get the identifier for the request. Defaults to the IP address of the request.
   * @example
   * ```ts
   * { identifierFn: (req) => req.get("x-api-key") ?? "anonymous" }
   * ```
   */
  identifierFn?: (req: Request) => string | Promise<string>;
  /**
   * Redis key prefix override for this call. Defaults to the tier prefix.
   * @example
   * ```ts
   * { prefix: "@ratelimit:chat" }
   * ```
   */
  prefix?: string;
  /** Skip rate limit for this request. */
  skipRateLimit?: (req: Request) => boolean | Promise<boolean>;
  /**
   * Rate limit tier to use. Defaults to `"moderate"`.
   * @example
   * ```ts
   * { tier: "strict" }
   * ```
   */
  tier?: RateLimitTier;
}

/**
 * Rate limit client returned by {@link createRateLimit}.
 *
 * Provides Express middleware and route handler wrappers over `@g14o/ratelimit`.
 */
export interface ExpressRateLimitClient {
  /**
   * Checks the rate limit for an Express request without wrapping a handler.
   *
   * @param req - Express request.
   * @param options - Tier, prefix, identifier, or skip callback.
   * @returns Discriminated {@link RateLimitCheckResult}.
   */
  checkRateLimit: (
    req: Request,
    options?: ExpressRateLimitOptions
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
   * Express middleware that rate-limits before `next()`.
   *
   * Sends `429` with standard headers when blocked; calls `next()` when allowed.
   *
   * @param options - Tier, prefix, identifier, or skip callback.
   * @returns Express `RequestHandler`.
   */
  middleware: (options?: ExpressRateLimitOptions) => RequestHandler;
  /**
   * Clears in-memory limiter state and the adapter cache.
   *
   * Useful in tests; does not reset Upstash Redis counters.
   */
  reset: () => void;
  /**
   * Express middleware with per-user rate limiting.
   *
   * Uses `getUserId(req)` as the identifier; falls back to IP when null.
   *
   * @param getUserId - Resolves the authenticated user ID from the request.
   * @param options - Tier, prefix, or skip callback.
   * @returns Express `RequestHandler`.
   */
  userMiddleware: (
    getUserId: (req: Request) => Promise<string | null>,
    options?: Omit<ExpressRateLimitOptions, "identifierFn">
  ) => RequestHandler;
  /**
   * Wraps an Express route handler with rate limiting.
   *
   * Sends `429` when blocked; invokes the handler when allowed.
   *
   * @param handler - Express route handler.
   * @param options - Tier, prefix, identifier, or skip callback.
   * @returns Wrapped `RequestHandler`.
   */
  withRateLimit: (
    handler: RequestHandler,
    options?: ExpressRateLimitOptions
  ) => RequestHandler;
  /**
   * Wraps an Express route handler with per-user rate limiting.
   *
   * @param handler - Express route handler.
   * @param getUserId - Resolves the authenticated user ID from the request.
   * @param options - Tier, prefix, or skip callback.
   * @returns Wrapped `RequestHandler`.
   */
  withUserRateLimit: (
    handler: RequestHandler,
    getUserId: (req: Request) => Promise<string | null>,
    options?: Omit<ExpressRateLimitOptions, "identifierFn">
  ) => RequestHandler;
}

function toCoreOptions(
  req: Request,
  options: ExpressRateLimitOptions = {}
): RateLimitOptions<RateLimitRequest> {
  const { identifierFn, skipRateLimit, tier, prefix } = options;
  return {
    tier,
    prefix,
    identifierFn: identifierFn ? async () => identifierFn(req) : undefined,
    skipRateLimit: skipRateLimit ? async () => skipRateLimit(req) : undefined,
  };
}

/**
 * Creates a rate limit client with middleware and handler wrappers for Express.
 *
 * Delegates to {@link @g14o/ratelimit | @g14o/ratelimit} at runtime.
 *
 * @param options - Redis credentials or client, logger, environment, and optional `tiers` overrides.
 * @returns {@link ExpressRateLimitClient} instance.
 *
 * @example
 * ```ts
 * export const { middleware, withRateLimit } = createRateLimit({
 *   redis: {
 *     url: process.env.UPSTASH_REDIS_REST_URL!,
 *     token: process.env.UPSTASH_REDIS_REST_TOKEN!,
 *   },
 * });
 *
 * app.post("/api/chat", middleware({ tier: "moderate" }), handler);
 *
 * app.post(
 *   "/api/chat",
 *   withRateLimit((req, res) => res.json({ ok: true }), { tier: "moderate" })
 * );
 * ```
 */
export function createRateLimit(
  options: CreateRateLimitOptions = {}
): ExpressRateLimitClient {
  const core = createCoreRateLimit<RateLimitRequest, never>(options);

  const checkRateLimit = async (
    req: Request,
    rateLimitOptions: ExpressRateLimitOptions = {}
  ): Promise<RateLimitCheckResult> =>
    core.checkRateLimit(
      adaptExpressRequest(req),
      toCoreOptions(req, rateLimitOptions)
    );

  const runRateLimit = async (
    req: Request,
    res: Response,
    rateLimitOptions: ExpressRateLimitOptions
  ): Promise<boolean> => {
    const result = await checkRateLimit(req, rateLimitOptions);
    if (!result.ok) {
      sendRateLimitExceeded(res, result);
      return false;
    }
    applyRateLimitHeaders(res, result);
    return true;
  };

  const middleware =
    (rateLimitOptions: ExpressRateLimitOptions = {}): RequestHandler =>
    async (req, res, next) => {
      try {
        const allowed = await runRateLimit(req, res, rateLimitOptions);
        if (allowed) {
          next();
        }
      } catch (error) {
        next(error);
      }
    };

  const userMiddleware = (
    getUserId: (req: Request) => Promise<string | null>,
    rateLimitOptions: Omit<ExpressRateLimitOptions, "identifierFn"> = {}
  ): RequestHandler =>
    middleware({
      ...rateLimitOptions,
      identifierFn: async (req) => {
        const userId = await getUserId(req);
        return userId || getDefaultIdentifier(adaptExpressRequest(req));
      },
    });

  const withRateLimit =
    (
      handler: RequestHandler,
      rateLimitOptions: ExpressRateLimitOptions = {}
    ): RequestHandler =>
    async (req, res, next) => {
      try {
        const allowed = await runRateLimit(req, res, rateLimitOptions);
        if (!allowed) {
          return;
        }
        await handler(req, res, next);
      } catch (error) {
        next(error);
      }
    };

  const withUserRateLimit = (
    handler: RequestHandler,
    getUserId: (req: Request) => Promise<string | null>,
    rateLimitOptions: Omit<ExpressRateLimitOptions, "identifierFn"> = {}
  ): RequestHandler =>
    withRateLimit(handler, {
      ...rateLimitOptions,
      identifierFn: async (req) => {
        const userId = await getUserId(req);
        return userId || getDefaultIdentifier(adaptExpressRequest(req));
      },
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
