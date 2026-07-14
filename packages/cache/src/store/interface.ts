/** Storage backend for caching. Implementations own persistence and TTL. */
export interface CacheStore {
  /** Clears all entries when supported (memory store). */
  clear?(): void | Promise<void>;
  delete(...keys: string[]): number | Promise<number>;
  /** Tears down resources when supported (memory store). */
  destroy?(): void | Promise<void>;
  get<T>(key: string): T | null | Promise<T | null>;
  /** Returns key stats when supported (memory store). */
  getStats?():
    | { keys: string[]; size: number }
    | Promise<{ keys: string[]; size: number }>;
  keys(pattern: string): string[] | Promise<string[]>;
  set(key: string, value: unknown, ttl?: number): void | Promise<void>;
}

/** @deprecated Use {@link CacheStore}. */
export type CacheAdapter = CacheStore;
