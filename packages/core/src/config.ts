import { Redis } from "@upstash/redis";

/**
 * Logger interface used by `@g14o/cache` and `@g14o/ratelimit` for operational messages.
 */
export interface Logger {
  /**
   * Log errors (invalidation failures, rate-limit internal errors).
   *
   * @param args - Values passed through to your logger implementation.
   */
  error: (...args: unknown[]) => void;
  /**
   * Log informational messages (cache hits/misses, rate-limit passes, adapter selection).
   *
   * @param args - Values passed through to your logger implementation.
   */
  info: (...args: unknown[]) => void;
  /**
   * Log non-fatal issues (cache read/write failures that fall back to uncached execution).
   *
   * @param args - Values passed through to your logger implementation.
   */
  warn: (...args: unknown[]) => void;
}

/** Upstash Redis REST credentials. */
export interface RedisCredentials {
  token: string;
  url: string;
}

/** Credentials or a pre-built Upstash Redis client (e.g. `Redis.fromEnv()`). */
export type RedisConfig = Redis | RedisCredentials;

type Environment = "development" | "test" | "production";

/**
 * Options for {@link configureUtils}.
 *
 * @deprecated Use `createCache()` from `@g14o/cache` or `createRateLimit()` from `@g14o/ratelimit`.
 */
export interface ConfigureUtilsOptions {
  /**
   * Environment name override. When omitted, falls back to `process.env.NODE_ENV`
   * or `"development"`.
   *
   * Values `"development"` and `"test"` enable in-memory cache and rate limiting.
   */
  env?: Environment;
  /**
   * Application logger implementing {@link Logger}. Replaces the default silent logger.
   */
  logger?: Logger;
  /**
   * Upstash credentials or a pre-built Redis client.
   *
   * @deprecated Pass `redis` to `createCache()` / `createRateLimit()` instead.
   */
  redis?: RedisConfig;
}

const noop = (): void => {
  /* silent default logger */
};

export const noopLogger: Logger = {
  info: noop,
  warn: noop,
  error: noop,
};

let redisClient: Redis | null = null;
let logger: Logger = noopLogger;
let envName: Environment | undefined;

function isRedisClient(value: RedisConfig): value is Redis {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Redis).get === "function" &&
    typeof (value as Redis).set === "function"
  );
}

function isRedisCredentials(value: RedisConfig): value is RedisCredentials {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    "token" in value &&
    typeof (value as RedisCredentials).url === "string" &&
    typeof (value as RedisCredentials).token === "string"
  );
}

/**
 * Creates an Upstash Redis client from REST credentials.
 *
 * @param credentials - Upstash REST URL and token.
 * @returns Configured {@link Redis} client.
 */
export function createRedisClient(credentials: RedisCredentials): Redis {
  return new Redis({ url: credentials.url, token: credentials.token });
}

/**
 * Normalizes {@link RedisConfig} to a {@link Redis} client.
 *
 * @param config - Credentials or an existing Redis client.
 * @returns Resolved client, or `null` when `config` is omitted.
 */
export function resolveRedisClient(config?: RedisConfig): Redis | null {
  if (config === undefined) {
    return null;
  }

  if (isRedisClient(config)) {
    return config;
  }

  if (isRedisCredentials(config)) {
    return createRedisClient(config);
  }

  throw new Error(
    "Invalid redis config: provide { url, token } or a Redis client instance."
  );
}

/**
 * Returns the effective environment name.
 *
 * @param env - Optional override; falls back to `process.env.NODE_ENV` or `"development"`.
 */
export function resolveEnvName(env?: string): string {
  return env ?? process.env.NODE_ENV ?? "development";
}

/**
 * Whether the given environment uses in-memory cache/rate-limit backends.
 *
 * @param envName - Environment name (e.g. `"development"`, `"test"`, `"production"`).
 */
export function isInMemoryEnv(envName: string): boolean {
  return envName === "development" || envName === "test";
}

/**
 * Configure shared runtime dependencies for deprecated global cache/rate-limit APIs.
 *
 * @deprecated Use `createCache()` from `@g14o/cache` or `createRateLimit()` from `@g14o/ratelimit`.
 *
 * @param options - Redis client or credentials, logger, and/or environment override.
 */
export function configureUtils(options: ConfigureUtilsOptions = {}): void {
  if (options.redis !== undefined) {
    redisClient = resolveRedisClient(options.redis);
  }
  if (options.logger !== undefined) {
    logger = options.logger;
  }
  if (options.env !== undefined) {
    envName = options.env;
  }
}

/**
 * Returns the logger instance set by {@link configureUtils}, or a silent no-op logger.
 *
 * @deprecated Configure logger via `createCache()` / `createRateLimit()` instead.
 */
export function getLogger(): Logger {
  return logger;
}

/**
 * Returns the Upstash Redis client set by {@link configureUtils}.
 *
 * @deprecated Pass `redis` to `createCache()` / `createRateLimit()` instead.
 */
export function getRedis(): Redis | null {
  return redisClient;
}

/**
 * Returns the effective environment name used by deprecated global APIs.
 *
 * @deprecated Pass `env` to `createCache()` / `createRateLimit()` instead.
 */
export function getEnvName(): Environment {
  return (envName ?? process.env.NODE_ENV ?? "development") as Environment;
}

/**
 * Whether deprecated global APIs use in-memory backends.
 *
 * @deprecated Use {@link isInMemoryEnv} with your factory `env` option instead.
 */
export function isInMemoryBackend(): boolean {
  return isInMemoryEnv(getEnvName());
}
