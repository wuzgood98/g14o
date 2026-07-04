import { createRateLimit } from "@g14o/ratelimit-hono";
import type { AppEnv } from "../types";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export const { middleware, withRateLimit, userMiddleware, checkRateLimit } =
  createRateLimit<AppEnv>({
    env: process.env.NODE_ENV === "production" ? "production" : "development",
    redis:
      redisUrl && redisToken ? { url: redisUrl, token: redisToken } : undefined,
    logger: console,
  });
