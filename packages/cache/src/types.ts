/**
 * Discriminated union for success/failure results returned by server functions,
 * especially those wrapped with `withCache` from `@g14o/cache`.
 *
 * @typeParam T - Type of the success payload in `data`.
 * @typeParam E - Error type when `ok` is `false`. Defaults to `Error`.
 *
 * @example
 * ```ts
 * const result: Result<User[], Error> = await getUsers();
 * if (result.ok) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error, result.status);
 * }
 * ```
 */
export type Result<T, E extends Error = Error> =
  | { ok: true; data: T }
  | { ok: false; error: E; status: number };

/**
 * Logger interface used by `@g14o/cache`.
 */
export interface Logger {
  error: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

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
   * When `true` (default), use in-memory cache and rate-limit backends during static
   * build phases (`phase-production-build`, `phase-export` via `NEXT_PHASE`).
   *
   * @default true
   */
  inMemoryDuringBuild?: boolean;
}

const noop = (): void => {
  /* silent default logger */
};

/** Silent logger used when no custom logger is configured. */
export const noopLogger: Logger = {
  info: noop,
  warn: noop,
  error: noop,
};
