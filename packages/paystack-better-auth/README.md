# @g14o/paystack-better-auth

Paystack billing plugin for [Better Auth](https://better-auth.com). Supports customers, hosted checkout, subscriptions, authorization charges, and webhook synchronization.

Requires [`@g14o/paystack`](https://github.com/wuzgood98/g14o/tree/main/packages/paystack) for the Paystack API client.

## Installation

```bash
pnpm add @g14o/paystack @g14o/paystack-better-auth better-auth zod
```

## Server setup

Create a `Paystack` client with your API keys, then pass it to the plugin as `paystackClient`.

```ts
// lib/auth.ts
import { betterAuth } from "better-auth";
import { Paystack } from "@g14o/paystack";
import { paystack } from "@g14o/paystack-better-auth";

const paystackClient = new Paystack({
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
});

export const auth = betterAuth({
  // ...your auth config
  plugins: [
    paystack({
      paystackClient,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: [
          {
            name: "basic",
            interval: "monthly",
            amount: "500",
            currency: "GHS",
          },
          {
            name: "pro",
            planCode: "PLN_pro_monthly",
            annualDiscountedPlanCode: "PLN_pro_annual",
          },
        ],
        onSubscriptionComplete: async ({ subscription, plan }) => {
          console.log(`Welcome ${subscription.referenceId} to ${plan?.name}`);
        },
      },
      onEvent: async (event) => {
        console.log("Paystack event", event.event);
      },
    }),
  ],
});
```

## Client setup

```ts
// lib/auth-client.ts
import { createAuthClient } from "better-auth/client";
import { paystackClientPlugin } from "@g14o/paystack-better-auth/client";

export const authClient = createAuthClient({
  plugins: [paystackClientPlugin()],
});
```

## Checkout (one-time payments)

```ts
const { data, error } = await authClient.subscription.createCheckoutSession({
  amount: 1500,
  currency: "GHS",
  callbackUrl: "https://app.example.com/payment/callback",
  metadata: { orderId: "order_123" },
});
```

## Subscriptions

When a plan entry includes `planCode`, the plugin fetches billing details from Paystack instead of creating a plan. Pass `annual: true` on upgrade to use `annualDiscountedPlanCode`.

```ts
const { data, error } = await authClient.subscription.upgrade({
  plan: "pro",
  annual: true,
  subscriptionCode: "SUB_existing",
  successUrl: "https://app.example.com/dashboard",
  cancelUrl: "https://app.example.com/pricing",
});

await authClient.subscription.cancel();
await authClient.subscription.resume();
await authClient.subscription.getSubscription();
await authClient.subscription.list();
```

### Server-side subscription API

| Server | Client equivalent |
|--------|-------------------|
| `auth.api.upgradeSubscription` | `authClient.subscription.upgrade` |
| `auth.api.cancelSubscription` | `authClient.subscription.cancel` |
| `auth.api.resumeSubscription` | `authClient.subscription.resume` |
| `auth.api.getSubscription` | `authClient.subscription.getSubscription` |
| `auth.api.listSubscriptions` | `authClient.subscription.list` |

## Webhooks

Configure your Paystack dashboard webhook URL to:

```
https://your-domain.com/api/auth/paystack/webhook
```

The plugin verifies `x-paystack-signature` via `paystackClient.webhook.verifyPaystackWebhookSignature`. Events are deduplicated and persisted in `paystackWebhookEvent`.

## Database schema

Run Better Auth CLI to generate migrations:

```bash
npx auth@latest generate
```

Tables added:

- `user` field: `paystackCustomerCode` and `paystackCustomerId`
- `subscription` (includes `emailToken` for cancel/resume)
- `webhookEvent` (included by default; omit when `disableWebhookPersistence: true`)

## License

MIT
