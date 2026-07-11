import { Redis } from "@upstash/redis";

/** Upstash Redis REST credentials. */
export interface RedisCredentials {
  token: string;
  url: string;
}

/** Credentials or a pre-built Upstash Redis client (e.g. `Redis.fromEnv()`). */
export type RedisConfig = Redis | RedisCredentials;

function isRedisClient(value: RedisConfig): value is Redis {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Redis).get === "function" &&
    typeof (value as Redis).set === "function"
  );
}

function isRedisCredentials(value: RedisConfig): value is RedisCredentials {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    "token" in value &&
    typeof (value as RedisCredentials).url === "string" &&
    typeof (value as RedisCredentials).token === "string"
  );
}

/**
 * Creates an Upstash Redis client from REST credentials.
 *
 * @param credentials - Upstash REST URL and token.
 * @returns Configured {@link Redis} client.
 */
export function createRedisClient(credentials: RedisCredentials): Redis {
  return new Redis({ url: credentials.url, token: credentials.token });
}

/**
 * Normalizes {@link RedisConfig} to a {@link Redis} client.
 *
 * @param config - Credentials or an existing Redis client.
 * @returns Resolved client, or `null` when `config` is omitted.
 */
export function resolveRedisClient(config?: RedisConfig): Redis | null {
  if (config === undefined) {
    return null;
  }

  if (isRedisClient(config)) {
    return config;
  }

  if (isRedisCredentials(config)) {
    return createRedisClient(config);
  }

  throw new Error(
    "Invalid redis config: provide { url, token } or a Redis client instance."
  );
}
