/** biome-ignore-all lint/suspicious/noExplicitAny: generic cache wrapper requires dynamic args */

import {
  isInMemoryEnv,
  type Logger,
  noopLogger,
  type RedisConfig,
  resolveEnvName,
  resolveRedisClient,
} from "@g14o/utils/config";
import type { Result } from "@g14o/utils/types";
import type { Redis } from "@upstash/redis";
import {
  CACHE_TTL,
  type CacheAdapter,
  type CacheDuration,
  type CacheOptions,
  defaultKeyGenerator,
  InMemoryCache,
  RedisCache,
} from "./internals";

/** Options for {@link createCache}. */
export interface CreateCacheOptions {
  /** Override environment (`"development"` / `"test"` use in-memory backends). */
  env?: string;
  /** Application logger. Defaults to a silent no-op logger. */
  logger?: Logger;
  /** Upstash credentials or a pre-built Redis client (e.g. `Redis.fromEnv()`). */
  redis?: RedisConfig;
}

/** Cache client returned by {@link createCache}. */
export interface CacheClient {
  clearAllCache: () => Result<void, Error>;
  getCache: () => CacheAdapter;
  getCacheStats: () => { keys: string[]; size: number } | null;
  getTTL: (duration: CacheDuration) => number;
  inMemoryCache: () => InMemoryCache | null;
  invalidateCache: (
    pattern: string,
    options?: { prefix?: string }
  ) => Promise<Result<number, Error>>;
  invalidateCacheKey: (key: string) => Promise<Result<boolean, Error>>;
  reset: () => void;
  withCache: <T extends (...args: any[]) => Promise<Result<any, any>>>(
    fn: T,
    options?: CacheOptions
  ) => T;
}

interface CacheRuntime {
  envName: string;
  logger: Logger;
  resolveRedis: () => Redis | null;
}

function createCacheRuntime(options: CreateCacheOptions = {}): CacheRuntime {
  const envName = resolveEnvName(options.env);
  const logger = options.logger ?? noopLogger;
  let redis: Redis | null | undefined;

  return {
    envName,
    logger,
    resolveRedis: () => {
      if (redis === undefined) {
        redis = options.redis ? resolveRedisClient(options.redis) : null;
      }
      return redis;
    },
  };
}

function createAdapterForRuntime(runtime: CacheRuntime): CacheAdapter {
  if (isInMemoryEnv(runtime.envName)) {
    runtime.logger.info("Using in-memory cache (development mode)");
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
  return CACHE_TTL[environment][duration];
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
 * @param options - Redis credentials or client, logger, and environment.
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

  const getCache = (): CacheAdapter => {
    if (!cacheAdapter) {
      cacheAdapter = createAdapterForRuntime(runtime);
    }
    return cacheAdapter;
  };

  const reset = (): void => {
    if (cacheAdapter instanceof InMemoryCache) {
      cacheAdapter.destroy();
    }
    cacheAdapter = null;
  };

  const inMemoryCache = (): InMemoryCache | null => {
    const adapter = getCache();
    return adapter instanceof InMemoryCache ? adapter : null;
  };

  const getTTL = (duration: CacheDuration): number =>
    resolveTtlForRuntime(runtime, duration);

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
