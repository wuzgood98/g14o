/** Supported environment names for cache and rate-limit factories. */
export type Environment = "development" | "test" | "production";

/**
 * Options for {@link isInMemoryEnv} and factory clients (`createCache`, `createRateLimit`).
 */
export interface InMemoryEnvOptions {
  /**
   * Environment name override. When omitted, falls back to `process.env.NODE_ENV`
   * or `"development"`.
   *
   * Values `"development"` and `"test"` use in-memory cache and rate limiting.
   */
  env?: Environment;
  /**
   * When `true` (default), use in-memory cache/rate-limit backends during static
   * build phases (`phase-production-build`, `phase-export` via `NEXT_PHASE`).
   *
   * @default true
   */
  inMemoryDuringBuild?: boolean;
}
