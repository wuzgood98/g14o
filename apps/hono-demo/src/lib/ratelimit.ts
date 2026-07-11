import { createRateLimit } from "@g14o/ratelimit-hono";
import { upstashStore } from "@g14o/ratelimit-hono/upstash";
import type { AppEnv } from "../types";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? "";
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

export const { middleware, withRateLimit, userMiddleware, checkRateLimit } =
  createRateLimit<AppEnv>({
    env: process.env.NODE_ENV === "production" ? "production" : "development",
    store: upstashStore({
      url: redisUrl,
      token: redisToken,
    }),
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
