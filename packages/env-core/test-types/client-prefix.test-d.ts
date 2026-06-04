import { createEnv } from "@g14o/env-core";
import { url } from "zod";

// @ts-expect-error -- client keys must use NEXT_PUBLIC_ prefix
createEnv({
  clientPrefix: "NEXT_PUBLIC_",
  client: {
    API_URL: url(),
  },
  runtimeEnv: {},
});

createEnv({
  clientPrefix: "NEXT_PUBLIC_",
  client: {
    NEXT_PUBLIC_API_URL: url(),
  },
  runtimeEnv: {},
});
