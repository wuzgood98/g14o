import { createRateLimit } from "@g14o/ratelimit";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const { withRateLimit } = createRateLimit({
  redis: {
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  },
  logger,
});
