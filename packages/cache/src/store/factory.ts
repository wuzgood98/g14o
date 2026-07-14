import type { RedisConfig } from "../upstash-config";
import type { CacheStore } from "./interface";
import { memoryStore } from "./memory";

interface WithStore {
  redis?: never;
  /** Explicit store implementation (preferred). */
  store: CacheStore;
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
  "createCache: pass either `store` or `redis`, not both. Use `store: upstashStore({ url, token })` instead of the legacy `redis` option.";

function createLegacyUpstashStore(redis: RedisConfig): CacheStore {
  let storePromise: Promise<CacheStore> | undefined;
  const getStore = () =>
    (storePromise ??= import("./upstash").then(({ upstashStore }) =>
      upstashStore({ redis })
    ));

  return {
    async get<T>(key: string): Promise<T | null> {
      const store = await getStore();
      return (await store.get<T>(key)) as T | null;
    },
    async set(key: string, value: unknown, ttl?: number): Promise<void> {
      const store = await getStore();
      await store.set(key, value, ttl);
    },
    async delete(...keys: string[]): Promise<number> {
      const store = await getStore();
      return await store.delete(...keys);
    },
    async keys(pattern: string): Promise<string[]> {
      const store = await getStore();
      return await store.keys(pattern);
    },
  };
}

/**
 * Resolves the configured store.
 *
 * Valid states:
 * - `store` only — use the explicit store
 * - `redis` only — legacy Upstash credentials (wrapped as Upstash store)
 * - neither — `undefined` (engine applies env-based memory fallback or throws in production)
 *
 * @param options - Store or legacy redis configuration (mutually exclusive).
 * @returns Resolved store, or `undefined` when no backend is configured.
 * @throws When both `store` and `redis` are provided.
 */
export function resolveStore(
  options: ResolveStoreOptions
): CacheStore | undefined {
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
 * @returns A new {@link CacheStore} backed by in-process state.
 */
export function createFallbackMemoryStore(): CacheStore {
  return memoryStore();
}
