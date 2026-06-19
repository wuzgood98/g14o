import { env, maskSecret } from "@/lib/env";

export function GET() {
  return Response.json({
    app: "paystack-demo",
    paystackSecretKey: maskSecret(env.PAYSTACK_SECRET_KEY),
    paystackPublicKey: env.PAYSTACK_PUBLIC_KEY
      ? maskSecret(env.PAYSTACK_PUBLIC_KEY)
      : null,
    betterAuthUrl: env.BETTER_AUTH_URL,
    appUrl: env.NEXT_PUBLIC_APP_URL,
    sqliteDatabasePath: env.SQLITE_DATABASE_PATH,
    envValidated: true,
  });
}
