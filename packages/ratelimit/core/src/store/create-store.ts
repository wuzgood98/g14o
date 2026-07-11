import { parseDurationToMs } from "../parse-duration";
import type {
  RateLimitStore,
  RateLimitStoreConfig,
  RateLimitStoreLimiter,
} from "./interface";

/**
 * Atomic counter primitives for {@link createStore}.
 *
 * Implement `increment` against your backend (Redis INCR+PEXPIRE, Postgres upsert, etc.).
 */
export interface StorePrimitives {
  /**
   * Atomically increment the counter for `key`, refreshing a TTL of `windowMs`.
   *
   * @param key - Storage key (already includes prefix and identifier).
   * @param windowMs - Window length in milliseconds.
   * @returns New count within the window and the window reset time (ms epoch).
   */
  increment(
    key: string,
    windowMs: number
  ): Promise<{ count: number; reset: number }>;
  /** Optional: clear stored counters (used by {@link RateLimitClient.reset}). */
  reset?(): void | Promise<void>;
}

/**
 * Identity helper for implementing {@link RateLimitStore} with full type inference.
 *
 * @param store - A store implementation.
 * @returns The same store instance.
 *
 * @example
 * ```ts
 * const myStore = defineStore({
 *   createLimiter(config) {
 *     return {
 *       async limit(identifier) {
 *         return { success: true, limit: config.limit, remaining: 9, reset: Date.now() };
 *       },
 *     };
 *   },
 * });
 * ```
 */
export function defineStore(store: RateLimitStore): RateLimitStore {
  return store;
}

/**
 * Creates a {@link RateLimitStore} from atomic counter primitives.
 *
 * Uses a **fixed-window** counter algorithm. For sliding-window semantics,
 * implement {@link RateLimitStore} directly via {@link defineStore}.
 *
 * @param primitives - Backend-specific increment (and optional reset) operations.
 * @returns A store compatible with {@link createRateLimit}.
 *
 * @example
 * ```ts
 * const store = createStore({
 *   async increment(key, windowMs) {
 *     const count = await redis.incr(key);
 *     if (count === 1) await redis.pexpire(key, windowMs);
 *     const ttl = await redis.pttl(key);
 *     return { count, reset: Date.now() + Math.max(ttl, 0) };
 *   },
 * });
 * ```
 */
export function createStore(primitives: StorePrimitives): RateLimitStore {
  return {
    createLimiter(config: RateLimitStoreConfig): RateLimitStoreLimiter {
      const windowMs = parseDurationToMs(config.window);
      return {
        async limit(identifier) {
          const key = `${config.prefix}:${identifier}`;
          const { count, reset } = await primitives.increment(key, windowMs);
          return {
            success: count <= config.limit,
            limit: config.limit,
            remaining: Math.max(0, config.limit - count),
            reset,
          };
        },
        reset: primitives.reset
          ? () => {
              // biome-ignore lint/complexity/noVoid: fire-and-forget async reset
              void primitives.reset?.();
            }
          : undefined,
      };
    },
  };
}
