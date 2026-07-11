import { createRateLimit } from "@g14o/ratelimit-express";
import { redisStore } from "@g14o/ratelimit-express/redis";
import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is not set");
}
const redis = createClient({ url: redisUrl });
await redis.connect();

export const { middleware, withRateLimit, userMiddleware, checkRateLimit } =
  createRateLimit({
    store: redisStore(redis),
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
