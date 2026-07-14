import type { CacheStore } from "./interface";

/**
 * Raw string KV primitives for {@link createStore}.
 *
 * Implement against your backend (Redis, Postgres, etc.).
 */
export interface StorePrimitives {
  /** Optional: clear all stored entries. */
  clear?(): void | Promise<void>;
  /** Optional: tear down resources. */
  destroy?(): void | Promise<void>;
  /** Optional: return key stats. */
  getStats?():
    | { keys: string[]; size: number }
    | Promise<{ keys: string[]; size: number }>;
  /** Lists keys matching a glob pattern. */
  list(pattern: string): string[] | Promise<string[]>;
  /** Reads a raw string value, or `null` when missing. */
  read(key: string): string | null | Promise<string | null>;
  /** Removes one or more keys; returns count deleted. */
  remove(...keys: string[]): number | Promise<number>;
  /** Writes a raw string value with optional TTL in seconds. */
  write(key: string, value: string, ttlSeconds?: number): void | Promise<void>;
}

/** Options for {@link createStore}. */
export interface CreateStoreOptions {
  /** Deserialize values after reading. Defaults to `JSON.parse`. */
  deserialize?: <T>(raw: string) => T;
  /** Key prefix applied transparently on all operations. */
  prefix?: string;
  /** Serialize values before writing. Defaults to `JSON.stringify`. */
  serialize?: (value: unknown) => string;
}

const defaultSerialize = (value: unknown): string => JSON.stringify(value);
const defaultDeserialize = <T>(raw: string): T => JSON.parse(raw) as T;

async function resolve<T>(value: T | Promise<T>): Promise<T> {
  return await value;
}

/**
 * Identity helper for implementing {@link CacheStore} with full type inference.
 *
 * @param store - A store implementation.
 * @returns The same store instance.
 */
export function defineStore(store: CacheStore): CacheStore {
  return store;
}

/**
 * Creates a {@link CacheStore} from raw string KV primitives.
 *
 * Handles JSON serialization, optional key prefixing, and maps primitives to
 * the {@link CacheStore} interface.
 *
 * @param primitives - Backend-specific read/write/remove/list operations.
 * @param options - Optional prefix and custom serialize/deserialize.
 * @returns A store compatible with {@link createCache}.
 */
export function createStore(
  primitives: StorePrimitives,
  options: CreateStoreOptions = {}
): CacheStore {
  const prefix = options.prefix ?? "";
  const serialize = options.serialize ?? defaultSerialize;
  const deserialize = options.deserialize ?? defaultDeserialize;

  const prefixKey = (key: string): string =>
    prefix.length > 0 ? `${prefix}:${key}` : key;

  const stripPrefix = (key: string): string => {
    if (prefix.length === 0) {
      return key;
    }
    const prefixWithSep = `${prefix}:`;
    return key.startsWith(prefixWithSep)
      ? key.slice(prefixWithSep.length)
      : key;
  };

  const prefixPattern = (pattern: string): string =>
    prefix.length > 0 ? `${prefix}:${pattern}` : pattern;

  return {
    async get<T>(key: string): Promise<T | null> {
      const raw = await resolve(primitives.read(prefixKey(key)));
      if (raw === null) {
        return null;
      }
      return deserialize<T>(raw);
    },

    async set(key: string, value: unknown, ttl?: number): Promise<void> {
      const raw = serialize(value);
      await resolve(primitives.write(prefixKey(key), raw, ttl));
    },

    async delete(...keys: string[]): Promise<number> {
      if (keys.length === 0) {
        return 0;
      }
      return await resolve(primitives.remove(...keys.map(prefixKey)));
    },

    async keys(pattern: string): Promise<string[]> {
      const prefixed = await resolve(primitives.list(prefixPattern(pattern)));
      return prefixed.map(stripPrefix);
    },

    clear: primitives.clear
      ? async () => {
          await resolve(primitives.clear?.());
        }
      : undefined,

    getStats: primitives.getStats
      ? async () => {
          const stats = await resolve(primitives.getStats?.());
          if (!stats) {
            return { keys: [], size: 0 };
          }
          return {
            size: stats.size,
            keys: stats.keys.map(stripPrefix),
          };
        }
      : undefined,

    destroy: primitives.destroy
      ? async () => {
          await resolve(primitives.destroy?.());
        }
      : undefined,
  };
}
