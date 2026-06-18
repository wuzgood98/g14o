import { paystack } from "@g14o/paystack";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { sqlite } from "@/lib/db";
import { env } from "@/lib/env";
import { paystack as paystackClient } from "@/lib/paystack";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: sqlite,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    nextCookies(),
    paystack({
      paystackClient,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: [
          {
            name: "basic",
            planCode: "PLN_ar435j9cv84d9mt",
            annualDiscountedPlanCode: "PLN_ipxrkw1oau1wi4w",
          },
          {
            name: "pro",
            planCode: "PLN_vw1835wms0jioev",
          },
        ],
        onSubscriptionComplete: ({ subscription, plan }) => {
          console.log(
            `[paystack-demo] Subscription complete: ${subscription.referenceId} → ${plan?.name ?? "unknown"}`
          );
        },
      },
      onCustomerCreate: ({ customer, user }) => {
        console.log("[onCustomerCreate]", { customer, user });
      },
      onEvent: ({ event, data }) => {
        console.log(`[paystack-demo] Paystack webhook event: ${event}`);
        console.log(
          `[paystack-demo] Paystack webhook data: ${JSON.stringify(data)}`
        );
      },
    }),
  ],
});
