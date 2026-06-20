/**
 * Cache middleware for `@g14o/cache`.
 *
 * Prefer {@link createCache} for app-owned instances (`lib/cache.ts`).
 * Top-level exports are deprecated and rely on {@link configureUtils} from `@g14o/cache/config`.
 *
 * @packageDocumentation
 */
/** biome-ignore-all lint/suspicious/noExplicitAny: we need to use any to avoid type errors */
import { createHash } from "node:crypto";
import { getEnvName, getLogger, getRedis, isInMemoryBackend } from "./config";
import { isArray, isObject } from "./helpers";
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

export type { Redis } from "@upstash/redis";
export type {
  CacheClient,
  CacheEnvironmentTtlOverride,
  CacheTtlOverride,
  CreateCacheOptions,
} from "./create-cache-client";
/** biome-ignore lint/performance/noBarrelFile: public package entry re-export */
export { createCache } from "./create-cache-client";
export {
  CACHE_TTL,
  type CacheDuration,
  type CacheOptions,
  InMemoryCache,
  RedisCache,
} from "./internals";

let cacheAdapter: CacheAdapter | null = null;

function createLegacyCacheAdapter(): CacheAdapter {
  const logger = getLogger();

  if (isInMemoryBackend()) {
    logger.info("Using in-memory cache (build/development mode)");
    return new InMemoryCache();
  }

  const redis = getRedis();
  if (!redis) {
    throw new Error(
      "Redis client is required for production cache. Call configureUtils({ redis }) or use createCache({ redis: { url, token } })."
    );
  }

  logger.info("Using Redis cache (production mode)");
  return new RedisCache(redis);
}

/**
 * Returns the lazily initialized cache adapter singleton (deprecated global API).
 *
 * @deprecated Use `createCache()` and `cache.getCache()` instead.
 */
export function getCache(): CacheAdapter {
  if (!cacheAdapter) {
    cacheAdapter = createLegacyCacheAdapter();
  }
  return cacheAdapter;
}

/**
 * Resets the deprecated global cache singleton.
 *
 * @deprecated Use `createCache().reset()` on your cache client instance instead.
 */
export function resetCacheAdapter(): void {
  if (cacheAdapter instanceof InMemoryCache) {
    cacheAdapter.destroy();
  }
  cacheAdapter = null;
}

/**
 * Returns the underlying in-memory cache when running in development/test (deprecated).
 *
 * @deprecated Use `createCache().inMemoryCache()` instead.
 */
export const inMemoryCache = (): InMemoryCache | null => {
  const adapter = getCache();
  return adapter instanceof InMemoryCache ? adapter : null;
};

/**
 * Resolves a {@link CacheDuration} to seconds for the current environment (deprecated).
 *
 * @deprecated Use `createCache().getTTL()` instead.
 */
export function getTTL(duration: CacheDuration): number {
  const environment =
    getEnvName() === "production" ? "production" : "development";
  return CACHE_TTL[environment][duration];
}

/**
 * Wraps an async function that returns {@link Result} and caches successful results (deprecated).
 *
 * @deprecated Use `createCache().withCache()` instead.
 */
export function withCache<
  T extends (...args: any[]) => Promise<Result<any, any>>,
>(fn: T, options: CacheOptions = {}): T {
  const { ttl = "long", keyGenerator, prefix = "cache" } = options;
  const ttlValue = getTTL(ttl);
  const logger = getLogger();

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const cache = getCache();
    const cacheKey = keyGenerator
      ? `${prefix}:${keyGenerator(...args)}`
      : defaultKeyGenerator(prefix, fn.name || "anonymous", args);

    try {
      const cached = await cache.get(cacheKey);

      if (cached !== null) {
        logger.info(`Cache hit: ${cacheKey}`);
        return cached as ReturnType<T>;
      }

      logger.info(`Cache miss: ${cacheKey}`);
    } catch (error) {
      logger.warn(
        error,
        `Cache read error for ${cacheKey}, falling back to function`
      );
    }

    const result = await fn(...args);

    if (result.ok) {
      try {
        if (ttlValue > 0) {
          await cache.set(cacheKey, result, ttlValue);
        } else {
          await cache.set(cacheKey, result);
        }
        logger.info(`Cached result: ${cacheKey}`);
      } catch (error) {
        logger.warn(
          error,
          `Cache write error for ${cacheKey}, continuing without caching`
        );
      }
    }

    return result as ReturnType<T>;
  }) as unknown as T;
}

/**
 * Deletes all cache keys matching a glob-style pattern (deprecated).
 *
 * @deprecated Use `createCache().invalidateCache()` instead.
 */
export async function invalidateCache(
  pattern: string,
  options: { prefix?: string } = {}
): Promise<Result<number, Error>> {
  const { prefix = "cache" } = options;
  const fullPattern = `${prefix}:${pattern}`;
  const logger = getLogger();

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
    logger.error(error, `Cache invalidation error for pattern ${fullPattern}`);
    return {
      ok: false,
      error:
        error instanceof Error ? error : new Error("Cache invalidation failed"),
      status: 500,
    };
  }
}

/**
 * Deletes a single cache entry by exact key (deprecated).
 *
 * @deprecated Use `createCache().invalidateCacheKey()` instead.
 */
export async function invalidateCacheKey(
  key: string
): Promise<Result<boolean, Error>> {
  const logger = getLogger();

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
        error instanceof Error ? error : new Error("Cache invalidation failed"),
      status: 500,
    };
  }
}

/**
 * Clears every entry in the in-memory cache (deprecated).
 *
 * @deprecated Use `createCache().clearAllCache()` instead.
 */
export function clearAllCache(): Result<void, Error> {
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
}

/**
 * Returns in-memory cache statistics for debugging (deprecated).
 *
 * @deprecated Use `createCache().getCacheStats()` instead.
 */
export function getCacheStats(): { size: number; keys: string[] } | null {
  const memory = inMemoryCache();
  if (memory) {
    return memory.getStats();
  }
  return null;
}

const HASH_LENGTH = 16;

function serializeFilterValue(value: unknown, separator = ":"): string {
  if (isArray(value)) {
    return value.map((item) => serializeFilterValue(item, separator)).join(",");
  }

  if (isObject(value)) {
    return Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${key}${separator}${serializeFilterValue(value[key], separator)}`
      )
      .join(separator);
  }

  return String(value);
}

/** Loose record of filter/pagination parameters used when building cache keys. */
export type NormalizedParams = Record<string, unknown>;

/**
 * Options for deterministic cache key generation helpers.
 */
export interface CacheKeyOptions {
  /** When `true`, always includes `page` (default 1) and `limit` (default 10). Default `true`. */
  includePagination?: boolean;
  /** Max key length before replacing the param segment with an MD5 hash. Default `150`. */
  maxLength?: number;
  /** Separator between key segments. Default `":"`. */
  separator?: string;
}

/**
 * Builds a deterministic cache key from a prefix and parameter object.
 */
export function createCacheKey(
  prefix: string,
  params: NormalizedParams = {},
  options: CacheKeyOptions = {}
): string {
  const {
    maxLength = 150,
    includePagination = true,
    separator = ":",
  } = options;

  const normalized: NormalizedParams = {};

  if (includePagination) {
    normalized.page = params.page || 1;
    normalized.limit = params.limit || 10;
  }

  for (const [key, value] of Object.entries(params)) {
    if (["page", "limit", "offset"].includes(key)) {
      continue;
    }

    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (isArray(value) && value.length === 0) ||
      (isObject(value) && Object.keys(value).length === 0)
    ) {
      continue;
    }

    normalized[key] = value;
  }

  const sortedKeys = Object.keys(normalized).sort();

  const keyParts = sortedKeys.map((key) => {
    const value = normalized[key];

    if (isArray(value) || isObject(value)) {
      return `${key}${separator}${serializeFilterValue(value, separator)}`;
    }

    return `${key}${separator}${String(value)}`;
  });

  const keyString = keyParts.join(separator);
  const fullKey = `${prefix}${separator}${keyString}`;

  if (fullKey.length > maxLength) {
    const hash = createHash("md5")
      .update(keyString)
      .digest("hex")
      .slice(0, HASH_LENGTH);

    return `${prefix}${separator}${hash}`;
  }

  return fullKey;
}

export function createCacheKeyGenerator(
  prefix: string,
  options: CacheKeyOptions = {}
): (params?: NormalizedParams) => string {
  return (params?: NormalizedParams) =>
    createCacheKey(prefix, params || {}, options);
}

export function createCacheKeyFromArgs(
  prefix: string,
  args: (string | number | boolean | undefined | null)[] = []
): string {
  const validArgs = args.filter(
    (arg) =>
      arg !== undefined &&
      arg !== null &&
      arg !== "" &&
      !(isArray(arg) && arg.length === 0)
  );

  const stringArgs = validArgs.map((arg) => {
    if (typeof arg === "object") {
      return JSON.stringify(arg);
    }
    return String(arg);
  });

  return `${prefix}:${stringArgs.join(":")}`;
}

export function createEntityCacheKey(
  entityType: string,
  id: string | number
): string {
  return `${entityType}:${id}`;
}

export function createListCacheKey(
  entityType: string,
  filters: NormalizedParams = {},
  options?: CacheKeyOptions
): string {
  return createCacheKey(entityType, filters, {
    includePagination: true,
    ...options,
  });
}

export function createCachePattern(
  prefix: string,
  filters: NormalizedParams = {}
): string {
  const filterParts = Object.entries(filters)
    .filter(
      ([_, value]) => value !== undefined && value !== null && value !== ""
    )
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}:${serializeFilterValue(value)}`);

  if (filterParts.length === 0) {
    return `${prefix}:*`;
  }

  return `${prefix}:*${filterParts.join("*")}*`;
}
