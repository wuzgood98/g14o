/** biome-ignore-all lint/suspicious/noExplicitAny: route handler wrappers use dynamic args */
/** biome-ignore-all lint/style/noExportedImports: it's a type */

import type {
  CreateRateLimitOptions,
  RateLimitCheckResult,
  RateLimiterAdapter,
  RateLimitOptions,
  RateLimitTier,
} from "@g14o/ratelimit";
import { createRateLimit as createCoreRateLimit } from "@g14o/ratelimit";
import type { NextRequest, NextResponse } from "next/server";

type CoreHandler = (req: Request, ...args: any[]) => Promise<Response>;

type CoreGetUserId = (req: Request) => Promise<string | null>;

export type { CreateRateLimitOptions };

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

/**
 * Creates a rate limit client with bound methods for Next.js `NextRequest` / `NextResponse` handlers.
 *
 * Delegates to {@link @g14o/ratelimit | @g14o/ratelimit} at runtime.
 */
export function createRateLimit(
  options: CreateRateLimitOptions = {}
): RateLimitClient {
  const core = createCoreRateLimit(options);

  return {
    checkRateLimit: (req, opts) => core.checkRateLimit(req, opts),
    getRateLimiter: core.getRateLimiter,
    reset: core.reset,
    withRateLimit: ((handler, opts) =>
      core.withRateLimit(
        handler as unknown as CoreHandler,
        opts
      )) as RateLimitClient["withRateLimit"],
    withUserRateLimit: ((handler, getUserId, opts) =>
      core.withUserRateLimit(
        handler as unknown as CoreHandler,
        getUserId as unknown as CoreGetUserId,
        opts
      )) as RateLimitClient["withUserRateLimit"],
  };
}
