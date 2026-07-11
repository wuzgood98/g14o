import type { RateLimitTier } from "./tiers";

/**
 * Minimal request shape for rate limiting.
 *
 * Satisfied by Web `Request`, `NextRequest`, and Express (via an adapter).
 */
export interface RateLimitRequest {
  /** Header lookup; used for IP extraction and custom identifiers. */
  headers: { get(name: string): string | null };
  /** Full request URL; used for logging. */
  url: string;
}

/**
 * Minimal response shape for {@link RateLimitClient.withRateLimit} header attachment.
 */
export interface RateLimitResponse {
  /** Mutable response headers. */
  headers: { set(name: string, value: string): void };
}

/** Per-call skip option — boolean or request-aware callback. */
export type SkipRateLimitOption<Req extends RateLimitRequest = Request> =
  | boolean
  | ((req: Req) => boolean | Promise<boolean>);

/**
 * Resolves a per-call {@link SkipRateLimitOption} for a request.
 *
 * @returns `false` when `skip` is `undefined` or `false`.
 */
export function resolveSkipRateLimitOption<Req extends RateLimitRequest>(
  skip: SkipRateLimitOption<Req> | undefined,
  req: Req
): boolean | Promise<boolean> {
  if (skip === undefined || skip === false) {
    return false;
  }
  if (typeof skip === "boolean") {
    return skip;
  }
  return skip(req);
}

/**
 * Combines global and per-call skip flags (OR semantics).
 *
 * Global skip is boolean-only (no request at client creation).
 */
export async function shouldSkipRateLimit<Req extends RateLimitRequest>(
  globalSkip: boolean | undefined,
  perCallSkip: SkipRateLimitOption<Req> | undefined,
  req: Req
): Promise<boolean> {
  if (globalSkip === true) {
    return true;
  }
  const perCallResult = resolveSkipRateLimitOption(perCallSkip, req);
  return await perCallResult;
}

/** Per-call options for {@link RateLimitClient.checkRateLimit} and wrapper methods. */
export interface RateLimitOptions<Req extends RateLimitRequest = Request> {
  /**
   * Function to get the identifier for the request. Defaults to the IP address of the request.
   * @example
   * ```ts
   * { identifierFn: (req) => req.headers.get("x-api-key") ?? "anonymous" }
   * ```
   */
  identifierFn?: (req: Req) => string | Promise<string>;
  /**
   * Key prefix override for this call. Defaults to the tier prefix.
   * @example
   * ```ts
   * { prefix: "@ratelimit:docs-chat" }
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
   * { skipRateLimit: (req) => req.headers.get("x-internal") === "1" }
   * ```
   */
  skipRateLimit?: SkipRateLimitOption<Req>;
  /**
   * Rate limit tier to use. Defaults to "moderate".
   * @example
   * ```ts
   * { tier: "strict" }
   * ```
   */
  tier?: RateLimitTier;
}

/**
 * Result of {@link RateLimitClient.checkRateLimit}.
 *
 * When `ok` is `false`, `status` is always `429`.
 */
export type RateLimitCheckResult =
  | { ok: true; remaining: number; limit: number; reset: number }
  | {
      ok: false;
      error: Error;
      status: 429;
      remaining: number;
      limit: number;
      reset: number;
    };

/**
 * Resolves a rate-limit identifier from request headers.
 *
 * Precedence: `x-forwarded-for` (first IP) → `x-real-ip` → `cf-connecting-ip` → `"anonymous"`.
 *
 * @param req - Request with `headers.get()`.
 * @returns Trimmed identifier string.
 */
export function getDefaultIdentifier<Req extends RateLimitRequest>(
  req: Req
): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfConnectingIp = req.headers.get("cf-connecting-ip");

  const ip =
    forwarded?.split(",")[0] || realIp || cfConnectingIp || "anonymous";
  return ip.trim();
}

/**
 * Resolves a per-user rate-limit identifier with IP fallback.
 *
 * Uses `getUserId` when non-nullish; otherwise falls back to {@link getDefaultIdentifier}.
 *
 * @param userId - Authenticated user ID, or null/undefined when unauthenticated.
 * @param req - Request with `headers.get()` for IP fallback.
 * @returns Rate-limit identifier string.
 */
export function resolveUserIdentifier<Req extends RateLimitRequest>(
  userId: string | null | undefined,
  req: Req
): string {
  return userId ?? getDefaultIdentifier(req);
}
