import type { RateLimitStore } from "@g14o/ratelimit-hono";
import { createRateLimit } from "@g14o/ratelimit-hono";
import { memoryStore } from "@g14o/ratelimit-hono/memory";
import { upstashStore } from "@g14o/ratelimit-hono/upstash";
import type { AppEnv } from "../types";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? "";
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

function getStore(): RateLimitStore {
  if (redisUrl && redisToken) {
    return upstashStore({
      url: redisUrl,
      token: redisToken,
    });
  }
  return memoryStore();
}

export const { middleware, withRateLimit, userMiddleware, checkRateLimit } =
  createRateLimit<AppEnv>({
    store: getStore(),
    hooks: {
      onFailure: (result) => {
        console.error(result, "Rate limit failure");
      },
      onSuccess: (result) => {
        console.log(result, "Rate limit success");
      },
      onLimitExceeded: (result) => {
        console.error(result, "Rate limit exceeded");
      },
      onReset: (result) => {
        console.log(result, "Rate limit reset");
      },
    },
  });
