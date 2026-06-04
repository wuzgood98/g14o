import { createEnv } from "@g14o/env-core";
import { type } from "arktype";
import { CLIENT_PREFIX, runtimeEnvStrict } from "./shared";

export const envArktype = createEnv({
  clientPrefix: CLIENT_PREFIX,
  server: {
    DATABASE_URL: type("string.url"),
    OPEN_AI_API_KEY: type("string>=8"),
  },
  client: {
    NEXT_PUBLIC_API_URL: type("string.url"),
    NEXT_PUBLIC_APP_NAME: type("string>0"),
  },
  runtimeEnvStrict: runtimeEnvStrict(),
  emptyStringAsUndefined: true,
});
