import { paystackClient } from "@g14o/paystack-better-auth/client";
import { createAuthClient } from "better-auth/client";
import { env } from "@/lib/env";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_APP_URL,
  plugins: [paystackClient()],
});
