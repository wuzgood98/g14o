import { createEnv } from "@g14o/env-core";
import { minLength, pipe, string, url } from "valibot";
import { CLIENT_PREFIX, runtimeEnvStrict } from "./shared";

export const envValibot = createEnv({
  clientPrefix: CLIENT_PREFIX,
  server: {
    DATABASE_URL: pipe(string(), url()),
    OPEN_AI_API_KEY: pipe(string(), minLength(8)),
  },
  client: {
    NEXT_PUBLIC_API_URL: pipe(string(), url()),
    NEXT_PUBLIC_APP_NAME: pipe(string(), minLength(1)),
  },
  runtimeEnvStrict: runtimeEnvStrict(),
  emptyStringAsUndefined: true,
});
