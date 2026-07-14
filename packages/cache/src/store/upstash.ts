import type { Redis } from "@upstash/redis";
import type { RedisConfig, RedisCredentials } from "../upstash-config";
import { resolveRedisClient } from "../upstash-config";
import type { CacheStore } from "./interface";

class UpstashCache implements CacheStore {
  private redis: Redis | undefined;
  private readonly resolveRedis: () => Redis;

  constructor(resolveRedis: () => Redis) {
    this.resolveRedis = resolveRedis;
  }

  private client(): Redis {
    if (this.redis === undefined) {
      this.redis = this.resolveRedis();
    }
    return this.redis;
  }

  async get<T>(key: string): Promise<T | null> {
    return await this.client().get<T>(key);
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    if (ttl && ttl > 0) {
      await this.client().setex(key, ttl, value);
    } else {
      await this.client().set(key, value);
    }
  }

  async delete(...keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }
    return await this.client().del(...keys);
  }

  async keys(pattern: string): Promise<string[]> {
    return await this.client().keys(pattern);
  }
}

/** Flat Upstash credentials or a wrapped Redis client/config. */
export type UpstashStoreOptions = RedisCredentials | { redis: RedisConfig };

function resolveUpstashStoreRedis(options: UpstashStoreOptions): RedisConfig {
  if ("redis" in options) {
    return options.redis;
  }
  return options;
}

/**
 * Creates an Upstash Redis cache store.
 *
 * @param options - Upstash REST credentials (`{ url, token }`) or `{ redis }` with credentials or a pre-built client.
 * @returns A {@link CacheStore} backed by Upstash Redis.
 *
 * @example
 * ```ts
 * upstashStore({ url, token });
 * upstashStore({ redis: { url, token } });
 * upstashStore({ redis: Redis.fromEnv() });
 * ```
 */
export function upstashStore(options: UpstashStoreOptions): CacheStore {
  const redisConfig = resolveUpstashStoreRedis(options);
  let redis: Redis | undefined;

  const resolveRedis = (): Redis => {
    if (redis === undefined) {
      const client = resolveRedisClient(redisConfig);
      if (!client) {
        throw new Error(
          "Invalid redis config: provide { url, token } or a Redis client instance."
        );
      }
      redis = client;
    }
    return redis;
  };

  return new UpstashCache(resolveRedis);
}

export type { Redis } from "@upstash/redis";
