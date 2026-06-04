import { createEnv } from "@g14o/env-core";
import { url } from "zod";

// @ts-expect-error -- runtimeEnv and runtimeEnvStrict are mutually exclusive
createEnv({
  server: { DATABASE_URL: url() },
  runtimeEnv: process.env,
  runtimeEnvStrict: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
});
