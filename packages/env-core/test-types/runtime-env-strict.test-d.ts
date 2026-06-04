import { createEnv } from "@g14o/env-core";
import { url } from "zod";

createEnv({
  server: { DATABASE_URL: url() },
  clientPrefix: "NEXT_PUBLIC_",
  client: { NEXT_PUBLIC_API_URL: url() },
  // @ts-expect-error -- strict runtime must include all schema keys
  runtimeEnvStrict: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
});

createEnv({
  server: { DATABASE_URL: url() },
  clientPrefix: "NEXT_PUBLIC_",
  client: { NEXT_PUBLIC_API_URL: url() },
  runtimeEnvStrict: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
});
