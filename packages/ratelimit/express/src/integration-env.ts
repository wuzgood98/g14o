import { Redis } from "@upstash/redis";

export function hasUpstashCredentials(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

export function getTestRedisCredentials(): {
  token: string;
  url: string;
} {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!(url && token)) {
    throw new Error("Missing Upstash credentials for integration tests");
  }
  return { url, token };
}

export function createTestRedis(): Redis {
  return Redis.fromEnv();
}
