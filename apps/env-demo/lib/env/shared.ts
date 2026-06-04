export const CLIENT_PREFIX = "NEXT_PUBLIC_" as const;

export const ENV_KEYS = {
  DATABASE_URL: "DATABASE_URL",
  OPEN_AI_API_KEY: "OPEN_AI_API_KEY",
  NEXT_PUBLIC_API_URL: "NEXT_PUBLIC_API_URL",
  NEXT_PUBLIC_APP_NAME: "NEXT_PUBLIC_APP_NAME",
} as const;

export function runtimeEnvStrict() {
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  };
}

export function maskSecret(value: string, visible = 2): string {
  if (value.length <= visible * 2) {
    return "•".repeat(value.length);
  }
  return `${value.slice(0, visible)}${"•".repeat(value.length - visible * 2)}${value.slice(-visible)}`;
}

export interface ValidatorSnapshot {
  databaseUrl: string;
  nextPublicApiUrl: string;
  nextPublicAppName: string;
  openAiApiKeyMasked: string;
  validator: "zod" | "valibot" | "arktype";
}

export function snapshotFromEnv(
  validator: ValidatorSnapshot["validator"],
  env: {
    DATABASE_URL: string;
    OPEN_AI_API_KEY: string;
    NEXT_PUBLIC_API_URL: string;
    NEXT_PUBLIC_APP_NAME: string;
  }
): ValidatorSnapshot {
  return {
    validator,
    databaseUrl: env.DATABASE_URL,
    openAiApiKeyMasked: maskSecret(env.OPEN_AI_API_KEY),
    nextPublicApiUrl: env.NEXT_PUBLIC_API_URL,
    nextPublicAppName: env.NEXT_PUBLIC_APP_NAME,
  };
}
