import { type Duration, parseDurationToMs } from "./parse-duration";

type TokenTier = "strict" | "moderate" | "lenient" | "auth" | "write";

/** Resolved rate-limit settings for one tier (limit, window, Redis prefix). */
export interface TokenConfig {
  /** Max requests allowed within `window`. */
  limit: number;
  /** Redis key prefix for this tier. */
  prefix: string;
  /** Sliding window length (Upstash-style, e.g. `"60 s"`, `"15 m"`). */
  window: Duration;
}

/**
 * Built-in tier defaults (internal singleton). Override per tier via `createRateLimit({ tiers })`.
 * Consumers should use {@link tokenConfigSnapshot} or {@link getTokenConfigReadonly}.
 */
export const tokenConfig: Record<TokenTier, TokenConfig> = {
  strict: {
    limit: 5,
    window: "60 s",
    prefix: "@ratelimit:strict",
  },
  moderate: {
    limit: 10,
    window: "60 s",
    prefix: "@ratelimit:moderate",
  },
  lenient: {
    limit: 20,
    window: "60 s",
    prefix: "@ratelimit:lenient",
  },
  auth: {
    limit: 5,
    window: "15 m",
    prefix: "@ratelimit:auth",
  },
  write: {
    limit: 30,
    window: "1 h",
    prefix: "@ratelimit:write",
  },
};

/** Built-in rate limit tier names. */
export type RateLimitTier = TokenTier;

/** Read-only map of frozen {@link TokenConfig} entries per tier. */
export type ReadonlyTokenConfigMap = Readonly<
  Record<RateLimitTier, Readonly<TokenConfig>>
>;

/** Returns a deep-frozen snapshot of built-in tier defaults (safe for consumers). */
export function getTokenConfigReadonly(): ReadonlyTokenConfigMap {
  return Object.freeze(
    Object.fromEntries(
      (Object.keys(tokenConfig) as RateLimitTier[]).map((tier) => [
        tier,
        Object.freeze({ ...tokenConfig[tier] }),
      ])
    ) as Record<RateLimitTier, TokenConfig>
  );
}

/** Frozen built-in tier defaults for public inspection. Internal code must use `tokenConfig`. */
export const tokenConfigSnapshot: ReadonlyTokenConfigMap =
  getTokenConfigReadonly();

type TokenConfigOverride = Partial<
  Pick<TokenConfig, "limit" | "prefix" | "window">
>;

/** Validates a Redis key prefix. */
export function validatePrefix(prefix: string): void {
  if (typeof prefix !== "string" || prefix.trim() === "") {
    throw new Error(
      "Invalid rate limit prefix: prefix must be a non-empty string"
    );
  }
}

/** Validates a resolved {@link TokenConfig} for one tier. */
export function validateTokenConfig(
  config: TokenConfig,
  tier: RateLimitTier
): void {
  if (!Number.isFinite(config.limit) || config.limit <= 0) {
    throw new Error(
      `Invalid rate limit for tier "${tier}": limit must be a positive number, got ${config.limit}`
    );
  }
  if (typeof config.prefix !== "string" || config.prefix.trim() === "") {
    throw new Error(
      `Invalid rate limit for tier "${tier}": prefix must be a non-empty string`
    );
  }
  const windowMs = parseDurationToMs(config.window);
  if (windowMs <= 0) {
    throw new Error(
      `Invalid rate limit for tier "${tier}": window must be a positive duration, got ${config.window}`
    );
  }
}

/** Merges tier defaults with an optional override and validates the result. */
export function resolveTierConfig(
  tier: RateLimitTier,
  override?: TokenConfigOverride
): TokenConfig {
  const config: TokenConfig = override
    ? { ...tokenConfig[tier], ...override }
    : tokenConfig[tier];
  validateTokenConfig(config, tier);
  return config;
}

/** Result of a single `limit(identifier)` call on a {@link RateLimiterAdapter}. */
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
 * Low-level rate limiter backend (in-memory or Upstash).
 *
 * Use via {@link RateLimitClient.getRateLimiter} for custom flows.
 */
export interface RateLimiterAdapter {
  /**
   * Consumes one request against `identifier`.
   *
   * @param identifier - Client IP, user ID, API key, or other stable key.
   * @returns Limit state after this call.
   */
  limit(identifier: string): Promise<RateLimitResultData>;
}

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
   * Redis key prefix override for this call (Upstash only). Defaults to the tier prefix.
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

const RATE_LIMIT_CLEANUP_INTERVAL = 60_000;

export class InMemoryRateLimiter implements RateLimiterAdapter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly hits = new Map<string, number[]>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(config: TokenConfig) {
    this.maxRequests = config.limit;
    this.windowMs = parseDurationToMs(config.window);
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      RATE_LIMIT_CLEANUP_INTERVAL
    );
  }

  private cleanup() {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    for (const [key, timestamps] of this.hits.entries()) {
      const valid = timestamps.filter((t) => t > cutoff);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }

  limit(identifier: string): Promise<RateLimitResultData> {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const existing = this.hits.get(identifier) ?? [];
    const valid = existing.filter((t) => t > cutoff);

    if (valid.length >= this.maxRequests) {
      const oldest = valid[0] ?? now;
      const reset = oldest + this.windowMs;
      return Promise.resolve({
        success: false,
        limit: this.maxRequests,
        remaining: 0,
        reset,
      });
    }

    valid.push(now);
    this.hits.set(identifier, valid);

    let oldest = valid[0] ?? now;
    for (const timestamp of valid) {
      if (timestamp < oldest) {
        oldest = timestamp;
      }
    }

    return Promise.resolve({
      success: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - valid.length,
      reset: oldest + this.windowMs,
    });
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.hits.clear();
  }
}

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
