import type { CacheStore } from "./interface";

const CACHE_CLEANUP_INTERVAL = 60_000;

export class InMemoryCache implements CacheStore {
  private readonly cache: Map<
    string,
    { value: unknown; expiresAt: number | null }
  > = new Map();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      CACHE_CLEANUP_INTERVAL
    );
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set(key: string, value: unknown, ttl?: number): void {
    const expiresAt = ttl ? Date.now() + ttl * 1000 : null;
    this.cache.set(key, { value, expiresAt });
  }

  delete(...keys: string[]): number {
    let deleted = 0;
    for (const key of keys) {
      if (this.cache.delete(key)) {
        deleted += 1;
      }
    }
    return deleted;
  }

  keys(pattern: string): string[] {
    const regexPattern = pattern.replace(/\*/g, ".*").replace(/\?/g, ".");
    const regex = new RegExp(`^${regexPattern}$`);

    return Array.from(this.cache.keys()).filter((key) => regex.test(key));
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

/**
 * Creates an in-memory cache store.
 *
 * Suitable for development, tests, and single-instance deployments.
 * Entries are per-process and not shared across replicas.
 *
 * @returns A {@link CacheStore} backed by in-process state.
 */
export function memoryStore(): CacheStore {
  return new InMemoryCache();
}
