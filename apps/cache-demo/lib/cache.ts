import { createCache } from "@g14o/cache";
import { upstashStore } from "@g14o/cache/upstash";
import { logger } from "@/lib/logger";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!(url && token)) {
  throw new Error(
    "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set"
  );
}

export const { withCache, getCache, inMemoryCache } = createCache({
  store: upstashStore({ url, token }),
  logger,
  staleWhileRevalidate: 300,
  ttl: {
    short: 300,
    medium: 1800,
    long: 3600,
  },
  cacheFailures: true,
});
