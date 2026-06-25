import { type CacheClient, createCache } from "@g14o/cache";
import { logger } from "@/lib/logger";

// inMemoryDuringNextBuild defaults to true (in-memory during next build, Redis at runtime).
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const cacheClient: CacheClient = createCache({
  redis:
    url && token
      ? {
          url,
          token,
        }
      : undefined,
  logger,
});

export const withCache: CacheClient["withCache"] = cacheClient.withCache;
export const getCache: CacheClient["getCache"] = cacheClient.getCache;
export const inMemoryCache: CacheClient["inMemoryCache"] =
  cacheClient.inMemoryCache;
