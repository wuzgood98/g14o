import { createRateLimit } from "@g14o/ratelimit";
import { env } from "@/lib/env";

export const { withRateLimit } = createRateLimit({
  redis: {
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  },
});
