/** biome-ignore-all lint/suspicious/noExplicitAny: generic cache wrapper requires dynamic args */

import type { Redis } from "@upstash/redis";
import {
  type InMemoryEnvOptions,
  isInMemoryEnv,
  type Logger,
  noopLogger,
  type RedisConfig,
  resolveEnvName,
  resolveRedisClient,
} from "./config";
import {
  CACHE_TTL,
  type CacheAdapter,
  type CacheDuration,
  type CacheOptions,
  defaultKeyGenerator,
  InMemoryCache,
  RedisCache,
} from "./internals";
import type { Result } from "./types";

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
export interface CreateCacheOptions extends InMemoryEnvOptions {
  /** Application logger. Defaults to a silent no-op logger. */
  logger?: Logger;
  /** Upstash credentials or a pre-built Redis client (e.g. `Redis.fromEnv()`). */
  redis?: RedisConfig;
  /**
   * Override default TTL seconds per env and duration name (`short` | `medium` | `long`).
   * Used by `getTTL()` and `withCache(..., { ttl })`.
   */
  ttl?: CacheTtlOverride;
}

/** Cache client returned by {@link createCache}. */
export interface CacheClient {
  /** Clear all cache.
   * @returns The result of the clear all cache.
   */
  clearAllCache: () => Result<void, Error>;
  /** Get the cache adapter.
   * @returns The cache adapter.
   */
  getCache: () => CacheAdapter;
  /** Get the cache stats.
   * @returns The cache stats.
   */
  getCacheStats: () => { keys: string[]; size: number } | null;
  /** Get the TTL for a given duration.
   * @param duration - The duration to get the TTL for.
   * @returns The TTL for the given duration.
   */
  getTTL: (duration: CacheDuration) => number;
  /** Get the in-memory cache when the client is running in-memory.
   * @returns The in-memory cache, or `null` when using Redis.
   */
  inMemoryCache: () => InMemoryCache | null;
  /** Invalidate the cache for a given pattern.
   * @param pattern - The pattern to invalidate the cache for.
   * @param options - The options to invalidate the cache for.
   * @returns The result of the invalidation.
   */
  invalidateCache: (
    pattern: string,
    options?: { prefix?: string }
  ) => Promise<Result<number, Error>>;
  /** Invalidate the cache for a given key.
   * @param key - The key to invalidate the cache for.
   * @returns The result of the invalidation.
   */
  invalidateCacheKey: (key: string) => Promise<Result<boolean, Error>>;
  /** Reset the cache. */
  reset: () => void;
  /** With cache.
   * @param fn - The function to wrap with cache.
   * @param options - The options to wrap the function with.
   * @returns The wrapped function.
   */
  withCache: <T extends (...args: any[]) => Promise<Result<any, any>>>(
    fn: T,
    options?: CacheOptions
  ) => T;
}

interface CacheRuntime {
  envName: string;
  inMemoryDuringBuild: boolean;
  logger: Logger;
  resolveRedis: () => Redis | null;
  ttl?: CacheTtlOverride;
}

function createCacheRuntime(options: CreateCacheOptions = {}): CacheRuntime {
  const envName = resolveEnvName(options.env);
  const logger = options.logger ?? noopLogger;
  const inMemoryDuringBuild = options.inMemoryDuringBuild ?? true;
  let redis: Redis | null | undefined;

  return {
    envName,
    inMemoryDuringBuild,
    logger,
    ttl: options.ttl,
    resolveRedis: () => {
      if (redis === undefined) {
        redis = options.redis ? resolveRedisClient(options.redis) : null;
      }
      return redis;
    },
  };
}

function createAdapterForRuntime(runtime: CacheRuntime): CacheAdapter {
  if (
    isInMemoryEnv(runtime.envName, {
      inMemoryDuringBuild: runtime.inMemoryDuringBuild,
    })
  ) {
    runtime.logger.info("Using in-memory cache (build/development mode)");
    return new InMemoryCache();
  }

  const client = runtime.resolveRedis();
  if (!client) {
    throw new Error(
      "Redis is required for production cache. Pass createCache({ redis: { url, token } }) or redis: Redis.fromEnv()."
    );
  }

  runtime.logger.info("Using Redis cache (production mode)");
  return new RedisCache(client);
}

function resolveTtlForRuntime(
  runtime: CacheRuntime,
  duration: CacheDuration
): number {
  const environment =
    runtime.envName === "production" ? "production" : "development";
  const override = runtime.ttl?.[environment]?.[duration];
  return override ?? CACHE_TTL[environment][duration];
}

async function readCachedValue<T>(
  cache: CacheAdapter,
  cacheKey: string,
  logger: Logger
): Promise<T | null> {
  try {
    const cached = await cache.get<T>(cacheKey);
    if (cached !== null) {
      logger.info(`Cache hit: ${cacheKey}`);
      return cached;
    }
    logger.info(`Cache miss: ${cacheKey}`);
  } catch (error) {
    logger.warn(
      error,
      `Cache read error for ${cacheKey}, falling back to function`
    );
  }
  return null;
}

async function writeCachedValue(
  cache: CacheAdapter,
  cacheKey: string,
  value: unknown,
  ttlValue: number,
  logger: Logger
): Promise<void> {
  try {
    if (ttlValue > 0) {
      await cache.set(cacheKey, value, ttlValue);
    } else {
      await cache.set(cacheKey, value);
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
 * @param options - Redis credentials or client, logger, environment, and optional `ttl` overrides.
 * @returns {@link CacheClient} instance.
 *
 * @example
 * ```ts
 * export const { withCache } = createCache({
 *   redis: { url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! },
 *   logger,
 * });
 * ```
 */
export function createCache(options: CreateCacheOptions = {}): CacheClient {
  const runtime = createCacheRuntime(options);
  let cacheAdapter: CacheAdapter | null = null;

  /** Get the cache adapter.
   * @returns The cache adapter.
   */
  const getCache = (): CacheAdapter => {
    if (!cacheAdapter) {
      cacheAdapter = createAdapterForRuntime(runtime);
    }
    return cacheAdapter;
  };

  /** Reset the cache. */
  const reset = (): void => {
    if (cacheAdapter instanceof InMemoryCache) {
      cacheAdapter.destroy();
    }
    cacheAdapter = null;
  };

  /** Get the in-memory cache.
   * @returns The in-memory cache.
   */
  const inMemoryCache = (): InMemoryCache | null =>
    cacheAdapter instanceof InMemoryCache ? cacheAdapter : null;

  /** Get the TTL for a given duration.
   * @param duration - The duration to get the TTL for.
   * @returns The TTL for the given duration.
   */
  const getTTL = (duration: CacheDuration): number =>
    resolveTtlForRuntime(runtime, duration);

  /** With cache.
   * @param fn - The function to wrap with cache.
   * @param options - The options to wrap the function with.
   * @returns The wrapped function.
   *
   * @example
   * ```ts
   * import { withCache } from "@/lib/cache";
   * import { getUserById } from "@/lib/user";
   *
   * const getUserCache = withCache(getUserById, { prefix: "user", ttl: "short" });
   *
   * const result = await getUserCache(123);
   * console.log(result); // { ok: true, data: { id: 123, name: "John Doe", email: "john.doe@example.com" } } when cache is hit
   * console.log(result); // { ok: false, error: Error("User not found"), status: 404 } when cache is missed
   * ```
   */
  const withCache = <T extends (...args: any[]) => Promise<Result<any, any>>>(
    fn: T,
    cacheOptions: CacheOptions = {}
  ): T => {
    const { ttl = "long", keyGenerator, prefix = "cache" } = cacheOptions;
    const ttlValue = getTTL(ttl);
    const { logger } = runtime;

    return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      const cache = getCache();
      const cacheKey = keyGenerator
        ? `${prefix}:${keyGenerator(...args)}`
        : defaultKeyGenerator(prefix, fn.name || "anonymous", args);

      const cached = await readCachedValue<ReturnType<T>>(
        cache,
        cacheKey,
        logger
      );
      if (cached !== null) {
        return cached;
      }

      const result = await fn(...args);

      if (result.ok) {
        await writeCachedValue(cache, cacheKey, result, ttlValue, logger);
      }

      return result as ReturnType<T>;
    }) as unknown as T;
  };

  /** Invalidate the cache for a given pattern.
   * @param pattern - The pattern to invalidate the cache for.
   * @param options - The options to invalidate the cache for.
   * @returns The result of the invalidation.
   */
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

  /** Invalidate the cache for a given key.
   * @param key - The key to invalidate the cache for.
   * @returns The result of the invalidation.
   */
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

  /** Clear all cache.
   * @returns The result of the clear all cache.
   */
  const clearAllCache = (): Result<void, Error> => {
    const memory = inMemoryCache();
    if (memory) {
      memory.clear();
      return { ok: true, data: undefined };
    }
    return {
      ok: false,
      error: new Error("Clear all cache only available in development mode"),
      status: 400,
    };
  };

  /** Get the cache stats.
   * @returns The cache stats.
   */
  const getCacheStats = () => {
    const memory = inMemoryCache();
    if (memory) {
      return memory.getStats();
    }
    return null;
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
