import { Redis } from "@upstash/redis";
import type { Environment, InMemoryEnvOptions, Logger } from "./types";
import { noopLogger } from "./types";

export type { Environment, InMemoryEnvOptions, Logger } from "./types";
/** biome-ignore lint/performance/noBarrelFile: re-export shared types for @g14o/ratelimit/config consumers */
export { noopLogger } from "./types";

/** Upstash Redis REST credentials. */
export interface RedisCredentials {
  token: string;
  url: string;
}

/** Credentials or a pre-built Upstash Redis client (e.g. `Redis.fromEnv()`). */
export type RedisConfig = Redis | RedisCredentials;

/**
 * Options for {@link configureUtils}.
 *
 * @deprecated Use `createRateLimit()` from `@g14o/ratelimit` instead.
 */
export interface ConfigureUtilsOptions extends InMemoryEnvOptions {
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

let redisClient: Redis | null = null;
let logger: Logger = noopLogger;
let envName: Environment | undefined;
let configuredInMemoryDuringBuild = true;

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
export function resolveEnvName(env?: Environment): string {
  return env ?? process.env.NODE_ENV ?? "development";
}

/** Static build/export phases where Redis REST calls break prerender (e.g. Next.js sets `NEXT_PHASE`). */
const STATIC_BUILD_PHASES = new Set(["phase-production-build", "phase-export"]);

/**
 * Whether the process is in a static build or export phase.
 *
 * Detects `NEXT_PHASE` values `phase-production-build` and `phase-export` (set by Next.js
 * during `next build` / static export). Has no effect on adapter selection unless
 * {@link InMemoryEnvOptions.inMemoryDuringBuild} is enabled (default `true`) via
 * `createCache()`, `createRateLimit()`, or {@link configureUtils}.
 *
 * During these phases, Upstash Redis uses `fetch` with `cache: "no-store"`, which
 * frameworks may reject while prerendering static routes that call Redis-backed helpers.
 */
export function isBuildLikePhase(): boolean {
  const phase = process.env.NEXT_PHASE;
  return phase !== undefined && STATIC_BUILD_PHASES.has(phase);
}

/**
 * Whether the given environment uses in-memory cache/rate-limit backends.
 *
 * `"development"` and `"test"` always use in-memory adapters.
 *
 * In `"production"`, {@link InMemoryEnvOptions.inMemoryDuringBuild} defaults to
 * `true`: during {@link isBuildLikePhase}, the in-memory adapter is used so
 * static builds do not call Upstash. At runtime (no build phase),
 * production uses Redis when configured. Entries written to in-memory during build
 * are not copied to Upstash; Redis is populated on later runtime requests when
 * server code runs again.
 *
 * Set `inMemoryDuringBuild: false` to use Redis during production builds as well.
 * Expect `DYNAMIC_SERVER_USAGE` warnings, failed cache reads/writes during prerender
 * (with fallback to your underlying functions), and prerendered routes may become
 * dynamic (`ƒ`) in the build table. Use only for debugging or intentional build-time
 * Redis access.
 *
 * @param envName - Environment name (e.g. `"development"`, `"test"`, `"production"`).
 * @param options - Build-phase behavior; omitted fields use defaults (`inMemoryDuringBuild: true`).
 */
export function isInMemoryEnv(
  envName: string,
  options: InMemoryEnvOptions = {}
): boolean {
  const inMemoryDuringBuild = options.inMemoryDuringBuild ?? true;
  if (inMemoryDuringBuild && isBuildLikePhase()) {
    return true;
  }
  return envName === "development" || envName === "test";
}

/**
 * Configure shared runtime dependencies for deprecated global cache/rate-limit APIs.
 *
 * @deprecated Use `createRateLimit()` from `@g14o/ratelimit` instead.
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
  if (options.inMemoryDuringBuild !== undefined) {
    configuredInMemoryDuringBuild = options.inMemoryDuringBuild;
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
  return isInMemoryEnv(getEnvName(), {
    inMemoryDuringBuild: configuredInMemoryDuringBuild,
  });
}
