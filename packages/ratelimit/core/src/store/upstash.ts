import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import type { RedisConfig, RedisCredentials } from "../upstash-config";
import { resolveRedisClient } from "../upstash-config";
import type {
  RateLimitResultData,
  RateLimitStore,
  RateLimitStoreConfig,
  RateLimitStoreLimiter,
} from "./interface";

class UpstashRateLimiter implements RateLimitStoreLimiter {
  private readonly ratelimit: Ratelimit;

  constructor(config: RateLimitStoreConfig, redis: Redis) {
    this.ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.limit, config.window),
      analytics: true,
      prefix: config.prefix,
    });
  }

  async limit(identifier: string): Promise<RateLimitResultData> {
    const { success, limit, remaining, reset } =
      await this.ratelimit.limit(identifier);
    return { success, limit, remaining, reset };
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
 * Creates an Upstash Redis rate limit store.
 *
 * @param options - Upstash REST credentials (`{ url, token }`) or `{ redis }` with credentials or a pre-built client.
 * @returns A {@link RateLimitStore} backed by Upstash Redis.
 *
 * @example
 * ```ts
 * upstashStore({ url, token });
 * upstashStore({ redis: { url, token } });
 * upstashStore({ redis: Redis.fromEnv() });
 * ```
 */
export function upstashStore(options: UpstashStoreOptions): RateLimitStore {
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

  return {
    createLimiter(config: RateLimitStoreConfig): RateLimitStoreLimiter {
      return new UpstashRateLimiter(config, resolveRedis());
    },
  };
}
