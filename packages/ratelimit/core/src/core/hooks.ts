import type { Logger } from "../types";
import type { RateLimitRequest } from "./request";
import type { RateLimitTier } from "./tiers";

/** Context passed to success and limit-exceeded hooks. */
export interface RateLimitHookContext<Req extends RateLimitRequest = Request> {
  /** Resolved rate-limit identifier (IP, user ID, etc.). */
  identifier: string;
  /** Configured max requests in the window. */
  limit: number;
  /** Requests remaining after this call. */
  remaining: number;
  /** Request being rate limited. */
  req: Req;
  /** Unix timestamp (ms) when the window resets. */
  reset: number;
  /** Tier used for this check. */
  tier: RateLimitTier;
}

/** Context passed to store-error hooks. */
export interface RateLimitStoreErrorContext<
  Req extends RateLimitRequest = Request,
> {
  /** Error thrown during the rate limit check. */
  error: Error;
  /** Resolved identifier, if available before the error. */
  identifier?: string;
  /** Request being rate limited. */
  req: Req;
  /** Tier used for this check. */
  tier: RateLimitTier;
}

/** Context passed to the umbrella failure hook. */
export type RateLimitFailureContext<Req extends RateLimitRequest = Request> =
  | (RateLimitHookContext<Req> & { reason: "limit_exceeded" })
  | (RateLimitStoreErrorContext<Req> & { reason: "store_error" });

/** Context passed to the reset hook. */
export interface RateLimitResetContext {
  /** Cache keys cleared by {@link RateLimitClient.reset}. */
  clearedKeys: string[];
}

/** Optional lifecycle hooks for {@link createRateLimit}. */
export interface RateLimitHooks<Req extends RateLimitRequest = Request> {
  /**
   * Umbrella failure hook. Also fires on blocked or errored outcomes.
   * Use `reason` to distinguish limit exceeded from store errors.
   */
  onFailure?: (ctx: RateLimitFailureContext<Req>) => void | Promise<void>;
  /** Fires when a request is blocked with 429. */
  onLimitExceeded?: (ctx: RateLimitHookContext<Req>) => void | Promise<void>;
  /** Fires when {@link RateLimitClient.reset} is called. */
  onReset?: (ctx: RateLimitResetContext) => void | Promise<void>;
  /** Fires when the store or internal check throws (fail-open path). */
  onStoreError?: (ctx: RateLimitStoreErrorContext<Req>) => void | Promise<void>;
  /** Fires when a request is allowed. */
  onSuccess?: (ctx: RateLimitHookContext<Req>) => void | Promise<void>;
}

/**
 * Runs a lifecycle hook, awaiting async handlers and swallowing errors.
 *
 * Hook errors are logged but never affect rate limiting or fail-open behavior.
 */
export async function runHook<Ctx>(
  hook: ((ctx: Ctx) => void | Promise<void>) | undefined,
  ctx: Ctx,
  logger: Logger
): Promise<void> {
  if (!hook) {
    return;
  }
  try {
    await hook(ctx);
  } catch (error) {
    logger.error(error, "Rate limit hook threw");
  }
}
