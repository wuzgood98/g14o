import { type Duration, parseDurationToMs } from "../parse-duration";

type TokenTier = "strict" | "moderate" | "lenient" | "auth" | "write";

/** Resolved rate-limit settings for one tier (limit, window, key prefix). */
export interface TokenConfig {
  /** Max requests allowed within `window`. */
  limit: number;
  /** Key prefix for this tier. */
  prefix: string;
  /** Sliding window length (e.g. `"60 s"`, `"15 m"`). */
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

/** Validates a key prefix. */
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
