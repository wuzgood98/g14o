import { createEnv } from "@g14o/env-core";
import { z } from "zod";

const DEFAULT_SQLITE_DATABASE_PATH = "paystack-demo.sqlite";
const HTTP_URL_PATTERN = /^https?:\/\//i;

/** CI sets DATABASE_URL to an https URL for env-demo; paystack-demo needs a file path. */
function resolveSqliteDatabasePath(): string {
  const explicit = process.env.SQLITE_DATABASE_PATH;
  if (explicit) {
    return explicit;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && !HTTP_URL_PATTERN.test(databaseUrl)) {
    return databaseUrl;
  }

  return DEFAULT_SQLITE_DATABASE_PATH;
}

export const env = createEnv({
  clientPrefix: "NEXT_PUBLIC_",
  server: {
    PAYSTACK_SECRET_KEY: z.string().startsWith("sk_test_"),
    PAYSTACK_PUBLIC_KEY: z.string().startsWith("pk_test_").optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    SQLITE_DATABASE_PATH: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
  },
  runtimeEnvStrict: {
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
    PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    SQLITE_DATABASE_PATH: resolveSqliteDatabasePath(),
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  emptyStringAsUndefined: true,
});

export function maskSecret(value: string, visible = 4): string {
  if (value.length <= visible * 2) {
    return "•".repeat(value.length);
  }

  return `${value.slice(0, visible)}${"•".repeat(value.length - visible * 2)}${value.slice(-visible)}`;
}
