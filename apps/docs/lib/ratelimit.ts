import { createRateLimit } from "@g14o/ratelimit";
import { upstashStore } from "@g14o/ratelimit/upstash";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const { withRateLimit } = createRateLimit({
  store: upstashStore({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  }),
  hooks: {
    onFailure: (result) => {
      logger.error(result, "Rate limit failure");
    },
    onSuccess: (result) => {
      logger.info(result, "Rate limit success");
    },
    onLimitExceeded: (result) => {
      logger.error(result, "Rate limit exceeded");
    },
    onReset: (result) => {
      logger.debug(result, "Rate limit reset");
    },
  },
});
