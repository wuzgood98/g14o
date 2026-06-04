import { createEnv } from "@g14o/env-core";
import { z } from "zod";
import { CLIENT_PREFIX, runtimeEnvStrict } from "./shared";

export const envZod = createEnv({
  clientPrefix: CLIENT_PREFIX,
  server: {
    DATABASE_URL: z.url(),
    OPEN_AI_API_KEY: z.string().min(8),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.url(),
    NEXT_PUBLIC_APP_NAME: z.string().min(1),
  },
  runtimeEnvStrict: runtimeEnvStrict(),
  emptyStringAsUndefined: true,
});
