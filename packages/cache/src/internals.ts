/** biome-ignore-all lint/suspicious/noExplicitAny: cache key generation uses dynamic args */

/**
 * Built-in TTL defaults in seconds per environment. Override via `createCache({ ttl })`.
 */
export const CACHE_TTL = {
  development: {
    short: 60,
    medium: 300,
    long: 600,
  },
  production: {
    short: 300,
    medium: 1800,
    long: 3600,
  },
} as const;

export type CacheDuration = keyof (typeof CACHE_TTL)[keyof typeof CACHE_TTL];

export type CacheFailuresConfig =
  | { enabled: true; ttl?: CacheDuration }
  | { enabled: false };

export type CacheFailuresOption = boolean | CacheFailuresConfig;

export function defaultKeyGenerator(
  prefix: string,
  functionName: string,
  args: any[]
): string {
  const argsKey = args.length > 0 ? `:${JSON.stringify(args)}` : "";
  return `${prefix}:${functionName}${argsKey}`;
}

/** Per-call options for {@link CacheClient.withCache}. */
export interface CacheOptions {
  /** Opt-in negative caching for failed `Result` values. Default from `createCache({ cacheFailures })` or `false`. */
  cacheFailures?: CacheFailuresOption;
  /**
   * Builds the cache key suffix from function arguments.
   *
   * The `prefix` is prepended automatically as `` `${prefix}:${suffix}` ``.
   * Overrides `createCache({ keyGenerator })` for this call.
   * Falls back to function name plus serialized args when omitted.
   *
   * @example
   * ```ts
   * { keyGenerator: (filters) => createListCacheKey("users", filters) }
   * ```
   */
  keyGenerator?: (...args: any[]) => string;
  /**
   * Key namespace prepended to every cache key.
   *
   * @default "cache"
   */
  prefix?: string;
  /** Stale-while-revalidate window in seconds. Overrides `createCache({ staleWhileRevalidate })`. */
  staleWhileRevalidate?: number;
  /**
   * TTL duration bucket for cached successes.
   *
   * Resolved to seconds via {@link CacheClient.getTTL} for the active environment.
   *
   * @default "long"
   */
  ttl?: CacheDuration;
}
