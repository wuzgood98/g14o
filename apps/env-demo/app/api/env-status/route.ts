import { envArktype } from "@/lib/env/arktype";
import { maskSecret, snapshotFromEnv } from "@/lib/env/shared";
import { envValibot } from "@/lib/env/valibot";
import { envZod } from "@/lib/env/zod";

export function GET() {
  const zod = snapshotFromEnv("zod", envZod);
  const valibot = snapshotFromEnv("valibot", envValibot);
  const arktype = snapshotFromEnv("arktype", envArktype);

  const consistent =
    zod.databaseUrl === valibot.databaseUrl &&
    zod.databaseUrl === arktype.databaseUrl &&
    zod.nextPublicApiUrl === valibot.nextPublicApiUrl &&
    zod.nextPublicApiUrl === arktype.nextPublicApiUrl &&
    zod.nextPublicAppName === valibot.nextPublicAppName &&
    zod.nextPublicAppName === arktype.nextPublicAppName;

  return Response.json({
    validators: ["zod", "valibot", "arktype"],
    consistent,
    snapshots: { zod, valibot, arktype },
    server: {
      DATABASE_URL: envZod.DATABASE_URL,
      OPEN_AI_API_KEY: maskSecret(envZod.OPEN_AI_API_KEY),
    },
    client: {
      NEXT_PUBLIC_API_URL: envZod.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_APP_NAME: envZod.NEXT_PUBLIC_APP_NAME,
    },
  });
}
