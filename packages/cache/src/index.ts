/**
 * Cache middleware for `@g14o/cache`.
 *
 * Use {@link createCache} for app-owned instances (`lib/cache.ts`).
 *
 * @packageDocumentation
 */
import { createHash } from "node:crypto";
import { isArray, isObject } from "./helpers";

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
    normalized.page = params.page ?? 1;
    normalized.limit = params.limit ?? 10;
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
