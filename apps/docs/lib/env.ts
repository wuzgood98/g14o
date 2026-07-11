import { createEnv } from "@g14o/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    OPENROUTER_API_KEY: z.string().min(1),
    OPENROUTER_MODEL: z.string().min(1),
    UPSTASH_REDIS_REST_URL: z.string().min(1),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
    ENABLE_AI_CHAT: z.string().transform((val) => val === "true"),
    REDIS_URL: z.url().regex(/^redis(s)?:\/\/.+$/, {
      message: "Must be a valid redis:// or rediss:// URL",
    }),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
  },
  runtimeEnvStrict: {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    ENABLE_AI_CHAT: process.env.ENABLE_AI_CHAT,
    REDIS_URL: process.env.REDIS_URL,
  },
  emptyStringAsUndefined: true,
});
