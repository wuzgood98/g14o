/** biome-ignore-all lint/suspicious/noExplicitAny: cache key generation uses dynamic args */
import type { Redis } from "@upstash/redis";

export interface CacheAdapter {
  delete(...keys: string[]): number | Promise<number>;
  get<T>(key: string): T | null | Promise<T | null>;
  keys(pattern: string): string[] | Promise<string[]>;
  set(key: string, value: unknown, ttl?: number): void | Promise<void>;
}

const CACHE_CLEANUP_INTERVAL = 60_000;

export class InMemoryCache implements CacheAdapter {
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

export class RedisCache implements CacheAdapter {
  private readonly client: Redis;

  constructor(client: Redis) {
    this.client = client;
  }

  async get<T>(key: string): Promise<T | null> {
    return await this.client.get<T>(key);
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    if (ttl && ttl > 0) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async delete(...keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }
    return await this.client.del(...keys);
  }

  async keys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern);
  }
}

/**
 * Built-in TTL defaults in seconds per environment. Override via `createCache({ ttl })`.
 */
export const CACHE_TTL = {
  development: {
    short: 60,
    medium: 300,
    long: 600,
  },
  production: {
    short: 300,
    medium: 1800,
    long: 3600,
  },
} as const;

export type CacheDuration = keyof (typeof CACHE_TTL)[keyof typeof CACHE_TTL];

export function defaultKeyGenerator(
  prefix: string,
  functionName: string,
  args: any[]
): string {
  const argsKey = args.length > 0 ? `:${JSON.stringify(args)}` : "";
  return `${prefix}:${functionName}${argsKey}`;
}

export interface CacheOptions {
  keyGenerator?: (...args: any[]) => string;
  prefix?: string;
  ttl?: CacheDuration;
}
