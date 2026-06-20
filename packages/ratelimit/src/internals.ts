import { type Duration, parseDurationToMs } from "./parse-duration";

type TokenTier = "strict" | "moderate" | "lenient" | "auth" | "write";

/** Resolved rate-limit settings for one tier (limit, window, Redis prefix). */
export interface TokenConfig {
  limit: number;
  prefix: string;
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

export type RateLimitTier = TokenTier;

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

/** Frozen defaults for public export; internal code must use `tokenConfig`. */
export const tokenConfigSnapshot: ReadonlyTokenConfigMap =
  getTokenConfigReadonly();

type TokenConfigOverride = Partial<
  Pick<TokenConfig, "limit" | "prefix" | "window">
>;

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

export interface RateLimitResultData {
  limit: number;
  remaining: number;
  reset: number;
  success: boolean;
}

export interface RateLimiterAdapter {
  limit(identifier: string): Promise<RateLimitResultData>;
}

export interface RateLimitOptions {
  identifierFn?: (req: Request) => string | Promise<string>;
  skipRateLimit?: (req: Request) => boolean | Promise<boolean>;
  tier?: RateLimitTier;
}

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

    return Promise.resolve({
      success: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - valid.length,
      reset: now + this.windowMs,
    });
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.hits.clear();
  }
}

export function getDefaultIdentifier(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfConnectingIp = req.headers.get("cf-connecting-ip");

  const ip =
    forwarded?.split(",")[0] || realIp || cfConnectingIp || "anonymous";
  return ip.trim();
}
