import { createCache } from "@g14o/cache";
import { memoryStore } from "@g14o/cache/memory";
import { upstashStore } from "@g14o/cache/upstash";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

function getStore() {
  if (url && token) {
    return upstashStore({ url, token });
  }
  return memoryStore();
}

export const { withCache, getCache, inMemoryCache } = createCache({
  store: getStore(),
  verbose: true,
  staleWhileRevalidate: 300,
  ttl: {
    short: 300,
    medium: 1800,
    long: 3600,
  },
  cacheFailures: true,
});
