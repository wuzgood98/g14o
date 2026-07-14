import type { CreateStoreOptions } from "./create-store";
import { createStore } from "./create-store";
import type { CacheStore } from "./interface";

const INVALID_CLIENT_ERROR =
  "Invalid Redis client: provide a node-redis client (from `redis`) or an ioredis client (from `ioredis`).";

/** node-redis v4/v5 client shape (subset used by this adapter). */
export interface NodeRedisLike {
  del(...keys: string[]): Promise<number>;
  get(key: string): Promise<string | null>;
  keys(pattern: string): Promise<string[]>;
  set(key: string, value: string, options?: { EX?: number }): Promise<unknown>;
}

/** ioredis client shape (subset used by this adapter). */
export interface IoRedisLike {
  defineCommand?(
    name: string,
    definition: { lua: string; numberOfKeys?: number }
  ): void;
  del(...keys: string[]): Promise<number>;
  get(key: string): Promise<string | null>;
  keys(pattern: string): Promise<string[]>;
  set(
    key: string,
    value: string,
    expiryMode?: "EX",
    time?: number
  ): Promise<unknown>;
  status: string;
}

type RedisClientKind = "node-redis" | "ioredis";

function isIoRedisLike(client: unknown): client is IoRedisLike {
  if (typeof client !== "object" || client === null) {
    return false;
  }
  const candidate = client as Record<string, unknown>;
  return (
    typeof candidate.defineCommand === "function" &&
    typeof candidate.status === "string"
  );
}

function isNodeRedisLike(client: unknown): client is NodeRedisLike {
  if (typeof client !== "object" || client === null) {
    return false;
  }
  const candidate = client as Record<string, unknown>;
  return (
    typeof candidate.get === "function" &&
    typeof candidate.set === "function" &&
    typeof candidate.del === "function" &&
    typeof candidate.keys === "function" &&
    !isIoRedisLike(client)
  );
}

function detectClientKind(client: unknown): RedisClientKind {
  if (isIoRedisLike(client)) {
    return "ioredis";
  }
  if (isNodeRedisLike(client)) {
    return "node-redis";
  }
  throw new Error(INVALID_CLIENT_ERROR);
}

/** Options for {@link redisStore}. */
export type RedisStoreOptions = CreateStoreOptions;

/**
 * Creates a Redis cache store backed by node-redis or ioredis.
 *
 * Accepts either a **node-redis** client (`redis` package) or an **ioredis**
 * client. Install one peer dependency and pass a connected client instance.
 *
 * @param client - Connected node-redis or ioredis client.
 * @param options - Optional prefix and custom serialize/deserialize.
 * @returns A {@link CacheStore} backed by Redis.
 *
 * @example
 * ```ts
 * import { createClient } from "redis";
 * import { redisStore } from "@g14o/cache/redis";
 *
 * const redis = createClient({ url: process.env.REDIS_URL });
 * await redis.connect();
 *
 * createCache({ store: redisStore(redis) });
 * ```
 */
export function redisStore(
  client: NodeRedisLike | IoRedisLike,
  options?: RedisStoreOptions
): CacheStore {
  const kind = detectClientKind(client);

  if (kind === "ioredis") {
    const ioClient = client as IoRedisLike;
    return createStore(
      {
        async read(key) {
          return await ioClient.get(key);
        },
        async write(key, value, ttlSeconds) {
          if (ttlSeconds && ttlSeconds > 0) {
            await ioClient.set(key, value, "EX", ttlSeconds);
          } else {
            await ioClient.set(key, value);
          }
        },
        async remove(...keys) {
          if (keys.length === 0) {
            return 0;
          }
          return await ioClient.del(...keys);
        },
        async list(pattern) {
          return await ioClient.keys(pattern);
        },
      },
      options
    );
  }

  const nodeClient = client as NodeRedisLike;
  return createStore(
    {
      async read(key) {
        return await nodeClient.get(key);
      },
      async write(key, value, ttlSeconds) {
        if (ttlSeconds && ttlSeconds > 0) {
          await nodeClient.set(key, value, { EX: ttlSeconds });
        } else {
          await nodeClient.set(key, value);
        }
      },
      async remove(...keys) {
        if (keys.length === 0) {
          return 0;
        }
        return await nodeClient.del(...keys);
      },
      async list(pattern) {
        return await nodeClient.keys(pattern);
      },
    },
    options
  );
}
