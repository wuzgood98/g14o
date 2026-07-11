import type { RedisConfig } from "../upstash-config";
import type {
  RateLimitStore,
  RateLimitStoreConfig,
  RateLimitStoreLimiter,
} from "./interface";
import { memoryStore } from "./memory";

interface WithStore {
  redis?: never;
  /** Explicit store implementation (preferred). */
  store: RateLimitStore;
}

interface WithRedis {
  /**
   * Legacy Upstash credentials or client.
   *
   * Mutually exclusive with `store`. Use `store: upstashStore({ url, token })`
   * for new projects.
   */
  redis: RedisConfig;
  store?: never;
}

interface WithNeither {
  redis?: undefined;
  store?: undefined;
}

/** Store or legacy redis configuration. `store` and `redis` are mutually exclusive. */
export type ResolveStoreOptions = WithStore | WithRedis | WithNeither;

const MUTUAL_EXCLUSION_ERROR =
  "createRateLimit: pass either `store` or `redis`, not both. Use `store: upstashStore({ url, token })` instead of the legacy `redis` option.";

function createLegacyUpstashStore(redis: RedisConfig): RateLimitStore {
  let storePromise: Promise<RateLimitStore> | undefined;
  const getStore = () =>
    (storePromise ??= import("./upstash").then(({ upstashStore }) =>
      upstashStore({ redis })
    ));

  return {
    createLimiter(config: RateLimitStoreConfig): RateLimitStoreLimiter {
      let limiterPromise: Promise<RateLimitStoreLimiter> | undefined;
      const getLimiter = () =>
        (limiterPromise ??= getStore().then((store) =>
          store.createLimiter(config)
        ));

      return {
        limit: async (identifier) => (await getLimiter()).limit(identifier),
      };
    },
  };
}

/**
 * Resolves the configured store.
 *
 * Valid states:
 * - `store` only — use the explicit store
 * - `redis` only — legacy Upstash credentials (wrapped as Upstash store)
 * - neither — `undefined` (engine applies env-based memory fallback or fails open in production)
 *
 * @param options - Store or legacy redis configuration (mutually exclusive).
 * @returns Resolved store, or `undefined` when no backend is configured.
 * @throws When both `store` and `redis` are provided.
 */
export function resolveStore(
  options: ResolveStoreOptions
): RateLimitStore | undefined {
  if (options.store && options.redis) {
    throw new Error(MUTUAL_EXCLUSION_ERROR);
  }
  if (options.store) {
    return options.store;
  }
  if (options.redis) {
    return createLegacyUpstashStore(options.redis);
  }
  return;
}

/**
 * Returns the default in-memory store for dev/test/build environments.
 *
 * @returns A new {@link RateLimitStore} backed by in-process state.
 */
export function createFallbackMemoryStore(): RateLimitStore {
  return memoryStore();
}
