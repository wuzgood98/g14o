import { createEnv } from "@g14o/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "NEXT_PUBLIC_",
  server: {
    PAYSTACK_SECRET_KEY: z.string().startsWith("sk_test_"),
    PAYSTACK_PUBLIC_KEY: z.string().startsWith("pk_test_").optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    DATABASE_URL: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
  },
  runtimeEnvStrict: {
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
    PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    DATABASE_URL: process.env.DATABASE_URL,
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
