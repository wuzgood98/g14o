import { createRateLimit } from "@g14o/ratelimit-express";
import { memoryStore } from "@g14o/ratelimit-express/memory";

export const { middleware, withRateLimit, userMiddleware, checkRateLimit } =
  createRateLimit({
    env: process.env.NODE_ENV === "production" ? "production" : "development",
    store: memoryStore(),
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
