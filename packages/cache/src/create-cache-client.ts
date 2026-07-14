/** biome-ignore-all lint/suspicious/noExplicitAny: generic cache wrapper requires dynamic args */

import { isInMemoryEnv, resolveEnvName } from "./env";
import {
  CACHE_TTL,
  type CacheDuration,
  type CacheFailuresOption,
  type CacheOptions,
  defaultKeyGenerator,
} from "./internals";
import {
  createFallbackMemoryStore,
  type ResolveStoreOptions,
  resolveStore,
} from "./store/factory";
import type { CacheStore } from "./store/interface";
import { InMemoryCache } from "./store/memory";
import type { InMemoryEnvOptions, Logger, Result } from "./types";
import { noopLogger } from "./types";

/** TTL overrides for one environment bucket (values in **seconds**). */
export interface CacheEnvironmentTtlOverride {
  /** Default: 600 (dev) / 3600 (prod). Stable reads; default for `withCache` when `ttl` omitted. */
  long?: number;
  /** Default: 300 (dev) / 1800 (prod). Typical list/detail responses. */
  medium?: number;
  /** Default: 60 (dev) / 300 (prod). Ephemeral or highly dynamic data. */
  short?: number;
}

/**
 * Per-environment TTL overrides merged onto {@link CACHE_TTL}.
 * `development` applies when env is `development` or `test`; `production` when env is `production`.
 */
export interface CacheTtlOverride {
  development?: CacheEnvironmentTtlOverride;
  production?: CacheEnvironmentTtlOverride;
}

/** Options for {@link createCache}. */
export type CreateCacheOptions = InMemoryEnvOptions &
  ResolveStoreOptions & {
    /** Application logger. Defaults to a silent no-op logger. */
    logger?: Logger;
    /**
     * Override default TTL seconds per duration name (`short` | `medium` | `long`).
     * Accepts either a flat map (applied to the active environment) or a nested
     * `{ development?, production? }` map. Used by `getTTL()` and `withCache(..., { ttl })`.
     */
    ttl?: CacheTtlOverride | CacheEnvironmentTtlOverride;
    /**
     * Default key generator for all `withCache` wrappers.
     * Per-call `keyGenerator` in {@link CacheOptions} overrides this.
     */
    keyGenerator?: (
      prefix: string,
      functionName: string,
      args: unknown[]
    ) => string;
    /** Default for `withCache` when `cacheFailures` is omitted. Default `false`. */
    cacheFailures?: CacheFailuresOption;
    /** Default stale-while-revalidate window in seconds for `withCache`. */
    staleWhileRevalidate?: number;
  };

/**
 * Cache client returned by {@link createCache}.
 *
 * Destructure the methods you need in `lib/cache.ts` and re-export them for app use.
 */
export interface CacheClient {
  /**
   * Clears all cached entries.
   *
   * Works with the in-memory dev store or stores that implement `clear()`.
   * Returns an error in production when the active store does not support clearing.
   */
  clearAllCache: () => Result<void, Error>;
  /**
   * Returns the lazily initialized {@link CacheStore} backing this client.
   */
  getCache: () => CacheStore;
  /**
   * Returns cache statistics when the active store supports synchronous stats.
   *
   * Available for the in-memory store; returns `null` for Redis/Upstash backends.
   */
  getCacheStats: () => { keys: string[]; size: number } | null;
  /**
   * Resolves a TTL duration name to seconds for the active environment.
   *
   * Respects `createCache({ ttl })` overrides and built-in {@link CACHE_TTL} defaults.
   *
   * @param duration - Duration bucket: `"short"`, `"medium"`, or `"long"`.
   */
  getTTL: (duration: CacheDuration) => number;
  /**
   * Returns the underlying {@link InMemoryCache} when the active store is in-memory.
   *
   * Returns `null` for Redis or Upstash backends.
   */
  inMemoryCache: () => InMemoryCache | null;
  /**
   * Deletes cache keys matching a glob pattern under an optional prefix.
   *
   * @param pattern - Glob pattern matched against keys (e.g. `"*"` for all under prefix).
   * @param options.prefix - Key namespace prepended to the pattern. Default `"cache"`.
   * @returns Number of keys deleted, or an error result on failure.
   */
  invalidateCache: (
    pattern: string,
    options?: { prefix?: string }
  ) => Promise<Result<number, Error>>;
  /**
   * Deletes a single cache key by exact match.
   *
   * @param key - Full cache key to remove.
   * @returns Whether a key was deleted, or an error result on failure.
   */
  invalidateCacheKey: (key: string) => Promise<Result<boolean, Error>>;
  /**
   * Tears down the active store instance and resets lazy initialization.
   *
   * Useful in tests to isolate cache state between cases.
   */
  reset: () => void;
  /**
   * Wraps an async function with read-through caching.
   *
   * Caches successful return values and `Result` successes by default.
   * Supports opt-in negative caching, stale-while-revalidate, and per-call TTL/key options
   * via {@link CacheOptions}.
   *
   * @param fn - Async function to wrap.
   * @param options - Per-call cache configuration.
   * @returns Wrapped function with the same signature as `fn`.
   *
   * @example
   * ```ts
   * export const getUsersCached = withCache(getUsers, {
   *   prefix: "users",
   *   ttl: "medium",
   * });
   * ```
   */
  withCache: <T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options?: CacheOptions
  ) => T;
}

interface ResolvedCacheFailures {
  enabled: boolean;
  failureTtl: CacheDuration;
}

interface CacheRuntime {
  cacheFailures: ResolvedCacheFailures;
  configuredStore: CacheStore | undefined;
  envName: string;
  inMemoryDuringBuild: boolean;
  keyGenerator?: CreateCacheOptions["keyGenerator"];
  logger: Logger;
  staleWhileRevalidate?: number;
  ttl?: CacheTtlOverride | CacheEnvironmentTtlOverride;
}

interface SwrEnvelope<T> {
  __swr: 1;
  freshUntil: number;
  value: T;
}

const STORE_REQUIRED_ERROR =
  "A cache store is required for production. Pass createCache({ store: upstashStore({ url, token }) }) or store: redisStore(client).";

const DEFAULT_FAILURE_TTL: CacheDuration = "short";

function resolveCacheFailures(
  option: CacheFailuresOption | undefined,
  fallback: ResolvedCacheFailures
): ResolvedCacheFailures {
  if (option === undefined) {
    return fallback;
  }
  if (typeof option === "boolean") {
    return { enabled: option, failureTtl: DEFAULT_FAILURE_TTL };
  }
  if (!option.enabled) {
    return { enabled: false, failureTtl: DEFAULT_FAILURE_TTL };
  }
  return {
    enabled: true,
    failureTtl: option.ttl ?? DEFAULT_FAILURE_TTL,
  };
}

function isResultShape(value: unknown): value is Result<unknown, Error> {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    typeof (value as Result<unknown, Error>).ok === "boolean"
  );
}

function isSwrEnvelope<T>(value: unknown): value is SwrEnvelope<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as SwrEnvelope<T>).__swr === 1 &&
    "value" in value &&
    "freshUntil" in value
  );
}

function isNestedTtlOverride(
  ttl: CacheTtlOverride | CacheEnvironmentTtlOverride | undefined
): ttl is CacheTtlOverride {
  return !!ttl && ("development" in ttl || "production" in ttl);
}

function shouldCacheValue(value: unknown, cacheFailures: boolean): boolean {
  if (value === undefined) {
    return false;
  }
  if (isResultShape(value)) {
    if (value.ok) {
      return true;
    }
    return cacheFailures;
  }
  return true;
}

function createCacheRuntime(options: CreateCacheOptions = {}): CacheRuntime {
  return {
    envName: resolveEnvName(options.env),
    logger: options.logger ?? noopLogger,
    inMemoryDuringBuild: options.inMemoryDuringBuild ?? true,
    configuredStore: resolveStore(options),
    ttl: options.ttl,
    keyGenerator: options.keyGenerator,
    cacheFailures: resolveCacheFailures(options.cacheFailures, {
      enabled: false,
      failureTtl: DEFAULT_FAILURE_TTL,
    }),
    staleWhileRevalidate: options.staleWhileRevalidate,
  };
}

function createStoreForRuntime(runtime: CacheRuntime): CacheStore {
  if (runtime.configuredStore) {
    runtime.logger.info("Using configured cache store");
    return runtime.configuredStore;
  }

  if (
    isInMemoryEnv(runtime.envName, {
      inMemoryDuringBuild: runtime.inMemoryDuringBuild,
    })
  ) {
    runtime.logger.info("Using in-memory cache (build/development mode)");
    return createFallbackMemoryStore();
  }

  throw new Error(STORE_REQUIRED_ERROR);
}

function resolveTtlForRuntime(
  runtime: CacheRuntime,
  duration: CacheDuration
): number {
  const environment =
    runtime.envName === "production" ? "production" : "development";
  const { ttl } = runtime;
  const override = isNestedTtlOverride(ttl)
    ? ttl[environment]?.[duration]
    : ttl?.[duration];
  return override ?? CACHE_TTL[environment][duration];
}

async function readCachedValue<T>(
  cache: CacheStore,
  cacheKey: string,
  logger: Logger
): Promise<{ hit: T | null; stale: T | null }> {
  try {
    const cached = await cache.get<unknown>(cacheKey);
    if (cached === null || cached === undefined) {
      logger.info(`Cache miss: ${cacheKey}`);
      return { hit: null, stale: null };
    }

    if (isSwrEnvelope<T>(cached)) {
      const now = Date.now();
      if (now <= cached.freshUntil) {
        logger.info(`Cache hit: ${cacheKey}`);
        return { hit: cached.value, stale: null };
      }
      logger.info(`Cache stale hit: ${cacheKey}`);
      return { hit: null, stale: cached.value };
    }

    logger.info(`Cache hit: ${cacheKey}`);
    return { hit: cached as T, stale: null };
  } catch (error) {
    logger.warn(
      error,
      `Cache read error for ${cacheKey}, falling back to function`
    );
  }
  return { hit: null, stale: null };
}

async function writeCachedValue(
  cache: CacheStore,
  cacheKey: string,
  value: unknown,
  ttlValue: number,
  staleWhileRevalidate: number,
  logger: Logger
): Promise<void> {
  try {
    const storeValue =
      staleWhileRevalidate > 0
        ? ({
            __swr: 1 as const,
            value,
            freshUntil: Date.now() + ttlValue * 1000,
          } satisfies SwrEnvelope<unknown>)
        : value;

    const storeTtl =
      staleWhileRevalidate > 0 ? ttlValue + staleWhileRevalidate : ttlValue;

    if (storeTtl > 0) {
      await cache.set(cacheKey, storeValue, storeTtl);
    } else {
      await cache.set(cacheKey, storeValue);
    }
    logger.info(`Cached result: ${cacheKey}`);
  } catch (error) {
    logger.warn(
      error,
      `Cache write error for ${cacheKey}, continuing without caching`
    );
  }
}

/**
 * Creates a cache client with bound methods for caching and invalidation.
 *
 * @param options - Store, legacy redis credentials, logger, environment, and optional defaults.
 * @returns {@link CacheClient} instance.
 *
 * @example
 * ```ts
 * import { upstashStore } from "@g14o/cache/upstash";
 *
 * export const { withCache } = createCache({
 *   store: upstashStore({
 *     url: process.env.UPSTASH_REDIS_REST_URL!,
 *     token: process.env.UPSTASH_REDIS_REST_TOKEN!,
 *   }),
 *   logger,
 * });
 * ```
 */
export function createCache(options: CreateCacheOptions = {}): CacheClient {
  const runtime = createCacheRuntime(options);
  let cacheStore: CacheStore | null = null;

  const getCache = (): CacheStore => {
    if (!cacheStore) {
      cacheStore = createStoreForRuntime(runtime);
    }
    return cacheStore;
  };

  const reset = (): void => {
    if (cacheStore instanceof InMemoryCache) {
      cacheStore.destroy();
    } else if (cacheStore?.destroy) {
      // biome-ignore lint/complexity/noVoid: fire-and-forget async destroy
      void Promise.resolve(cacheStore.destroy()).catch(() => {
        /* ignore teardown errors */
      });
    }
    cacheStore = null;
  };

  const inMemoryCache = (): InMemoryCache | null =>
    cacheStore instanceof InMemoryCache ? cacheStore : null;

  const getTTL = (duration: CacheDuration): number =>
    resolveTtlForRuntime(runtime, duration);

  const withCache = <T extends (...args: any[]) => Promise<any>>(
    fn: T,
    cacheOptions: CacheOptions = {}
  ): T => {
    const {
      ttl = "long",
      keyGenerator: callKeyGenerator,
      prefix = "cache",
      cacheFailures: cacheFailuresOption,
      staleWhileRevalidate = runtime.staleWhileRevalidate ?? 0,
    } = cacheOptions;

    const { enabled: cacheFailures, failureTtl } = resolveCacheFailures(
      cacheFailuresOption,
      runtime.cacheFailures
    );

    const ttlValue = getTTL(ttl);
    const { logger } = runtime;

    const resolveCacheKey = (...args: Parameters<T>): string => {
      if (callKeyGenerator) {
        return `${prefix}:${callKeyGenerator(...args)}`;
      }
      if (runtime.keyGenerator) {
        return runtime.keyGenerator(prefix, fn.name || "anonymous", args);
      }
      return defaultKeyGenerator(prefix, fn.name || "anonymous", args);
    };

    const refreshInBackground = (
      cacheKey: string,
      args: Parameters<T>,
      swrSeconds: number
    ): void => {
      // biome-ignore lint/complexity/noVoid: fire-and-forget background refresh
      void (async () => {
        try {
          const result = await fn(...args);
          if (!shouldCacheValue(result, cacheFailures)) {
            return;
          }
          const effectiveTtl =
            isResultShape(result) && !result.ok ? getTTL(failureTtl) : ttlValue;
          await writeCachedValue(
            getCache(),
            cacheKey,
            result,
            effectiveTtl,
            swrSeconds,
            logger
          );
        } catch (error) {
          logger.warn(error, `Background cache refresh failed for ${cacheKey}`);
        }
      })();
    };

    return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
      const cache = getCache();
      const cacheKey = resolveCacheKey(...args);

      const { hit, stale } = await readCachedValue<Awaited<ReturnType<T>>>(
        cache,
        cacheKey,
        logger
      );

      if (hit !== null) {
        return hit;
      }

      if (stale !== null) {
        refreshInBackground(cacheKey, args, staleWhileRevalidate);
        return stale;
      }

      const result = await fn(...args);

      if (shouldCacheValue(result, cacheFailures)) {
        const effectiveTtl =
          isResultShape(result) && !result.ok ? getTTL(failureTtl) : ttlValue;
        await writeCachedValue(
          cache,
          cacheKey,
          result,
          effectiveTtl,
          staleWhileRevalidate,
          logger
        );
      }

      return result;
    }) as unknown as T;
  };

  const invalidateCache = async (
    pattern: string,
    invalidateOptions: { prefix?: string } = {}
  ): Promise<Result<number, Error>> => {
    const { prefix = "cache" } = invalidateOptions;
    const fullPattern = `${prefix}:${pattern}`;
    const { logger } = runtime;

    try {
      const cache = getCache();
      const keys = await cache.keys(fullPattern);

      if (keys.length > 0) {
        await cache.delete(...keys);
        logger.info(
          `Invalidated ${keys.length} cache keys matching: ${fullPattern}`
        );
        return { ok: true, data: keys.length };
      }

      return { ok: true, data: 0 };
    } catch (error) {
      logger.error(
        error,
        `Cache invalidation error for pattern ${fullPattern}`
      );
      return {
        ok: false,
        error:
          error instanceof Error
            ? error
            : new Error("Cache invalidation failed"),
        status: 500,
      };
    }
  };

  const invalidateCacheKey = async (
    key: string
  ): Promise<Result<boolean, Error>> => {
    const { logger } = runtime;

    try {
      const cache = getCache();
      const deleted = await cache.delete(key);
      logger.info(`Invalidated cache key: ${key}`);
      return { ok: true, data: deleted > 0 };
    } catch (error) {
      logger.error(error, `Cache invalidation error for key ${key}`);
      return {
        ok: false,
        error:
          error instanceof Error
            ? error
            : new Error("Cache invalidation failed"),
        status: 500,
      };
    }
  };

  const clearAllCache = (): Result<void, Error> => {
    const memory = inMemoryCache();
    if (memory) {
      memory.clear();
      return { ok: true, data: undefined };
    }
    if (cacheStore?.clear) {
      // biome-ignore lint/complexity/noVoid: fire-and-forget async clear
      void Promise.resolve(cacheStore.clear()).catch(() => {
        /* ignore clear errors */
      });
      return { ok: true, data: undefined };
    }
    return {
      ok: false,
      error: new Error("Clear all cache only available in development mode"),
      status: 400,
    };
  };

  const getCacheStats = () => {
    const memory = inMemoryCache();
    if (memory) {
      return memory.getStats();
    }
    const stats = cacheStore?.getStats?.();
    if (!stats || stats instanceof Promise) {
      return null;
    }
    return stats;
  };

  return {
    withCache,
    invalidateCache,
    invalidateCacheKey,
    getCache,
    getTTL,
    clearAllCache,
    getCacheStats,
    inMemoryCache,
    reset,
  };
}
