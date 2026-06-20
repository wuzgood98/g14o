import { Redis } from "@upstash/redis";
import type { Environment, InMemoryEnvOptions } from "./types";

export type { Environment, InMemoryEnvOptions, Logger } from "./types";
/** biome-ignore lint/performance/noBarrelFile: re-export shared types for @g14o/core/config consumers */
export { noopLogger } from "./types";

/** Upstash Redis REST credentials. */
export interface RedisCredentials {
  token: string;
  url: string;
}

/** Credentials or a pre-built Upstash Redis client (e.g. `Redis.fromEnv()`). */
export type RedisConfig = Redis | RedisCredentials;

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

/** Next.js build/export phases where Redis REST calls break static prerender. */
const NEXT_BUILD_LIKE_PHASES = new Set([
  "phase-production-build",
  "phase-export",
]);

/**
 * Whether the process is in a Next.js build or static export phase.
 *
 * Detects `NEXT_PHASE` values `phase-production-build` and `phase-export`.
 * Has no effect on adapter selection unless {@link InMemoryEnvOptions.inMemoryDuringNextBuild}
 * is enabled (default `true`) via `createCache()` or `createRateLimit()`.
 *
 * During these phases, Upstash Redis uses `fetch` with `cache: "no-store"`, which
 * Next rejects while prerendering static routes that call Redis-backed `withCache`.
 */
export function isNextBuildLikePhase(): boolean {
  const phase = process.env.NEXT_PHASE;
  return phase !== undefined && NEXT_BUILD_LIKE_PHASES.has(phase);
}

/**
 * Whether the given environment uses in-memory cache/rate-limit backends.
 *
 * `"development"` and `"test"` always use in-memory adapters.
 *
 * In `"production"`, {@link InMemoryEnvOptions.inMemoryDuringNextBuild} defaults to
 * `true`: during {@link isNextBuildLikePhase}, the in-memory adapter is used so
 * `next build` / `next export` do not call Upstash. At runtime (no build phase),
 * production uses Redis when configured. Entries written to in-memory during build
 * are not copied to Upstash; Redis is populated on later runtime requests when
 * server code runs again.
 *
 * Set `inMemoryDuringNextBuild: false` to use Redis during production builds as well.
 * Expect `DYNAMIC_SERVER_USAGE` warnings, failed cache reads/writes during prerender
 * (with fallback to your underlying functions), and prerendered routes may become
 * dynamic (`ƒ`) in the build table. Use only for debugging or intentional build-time
 * Redis access.
 *
 * @param envName - Environment name (e.g. `"development"`, `"test"`, `"production"`).
 * @param options - Build-phase behavior; omitted fields use defaults (`inMemoryDuringNextBuild: true`).
 */
export function isInMemoryEnv(
  envName: string,
  options: InMemoryEnvOptions = {}
): boolean {
  const inMemoryDuringNextBuild = options.inMemoryDuringNextBuild ?? true;
  if (inMemoryDuringNextBuild && isNextBuildLikePhase()) {
    return true;
  }
  return envName === "development" || envName === "test";
}
