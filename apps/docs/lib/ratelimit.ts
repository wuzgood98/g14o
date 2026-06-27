import { createRateLimit } from "@g14o/ratelimit";

export const { withRateLimit } = createRateLimit({
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL ?? "",
    token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
  },
});
