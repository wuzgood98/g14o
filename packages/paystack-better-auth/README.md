# @g14o/paystack-better-auth

> Documentation: [docs.g14o.dev/packages/paystack-better-auth](https://docs.g14o.dev/packages/paystack-better-auth)

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
import { paystackClient } from "@g14o/paystack-better-auth/client";

export const authClient = createAuthClient({
  plugins: [
    paystackClient({
      subscription: true // enable subscription
    })
  ],
});
```

## Checkout (one-time payments)

See the [checkout guide](https://docs.g14o.dev/packages/paystack-better-auth/checkout) for client and server (`auth.api.createCheckoutSession`) examples.

```ts
const { data, error } = await authClient.paystack.createCheckoutSession({
  amount: 1500,
  currency: "GHS",
  callbackUrl: "https://app.example.com/payment/callback",
  metadata: { orderId: "order_123" },
});
```

Fulfill one-time orders on the server via `checkout.onCheckoutComplete` when Paystack sends `charge.success` (no `transactions.verify` call needed):

```ts
paystack({
  paystackClient,
  checkout: {
    onCheckoutComplete: async ({ reference, amount, metadata, payment }) => {
      // mark order paid, grant access, send receipt, etc.
    },
  },
});
```

Set `disablePaymentPersistence: true` to skip the `payment` table while still using `onCheckoutComplete`.

## Subscriptions

When a plan entry includes `planCode`, the plugin fetches billing details from Paystack instead of creating a plan. Pass `annual: true` on upgrade to use `annualDiscountedPlanCode`.

See the [subscriptions guide](https://docs.g14o.dev/packages/paystack-better-auth/subscriptions) for client and server examples for each operation.

```ts
const { data, error } = await authClient.paystack.subscription.upgrade({
  plan: "pro",
  annual: true,
  subscriptionCode: "SUB_existing",
  callbackUrl: "https://app.example.com/payment/callback",
  cancelActionUrl: "https://app.example.com/pricing",
});

await authClient.paystack.subscription.cancel();
await authClient.paystack.subscription.resume();
await authClient.paystack.subscription.get();
await authClient.paystack.subscription.list();
```

### Server-side subscription API

| Server | Client equivalent |
|--------|-------------------|
| `auth.api.upgradeSubscription` | `authClient.paystack.subscription.upgrade` |
| `auth.api.cancelSubscription` | `authClient.paystack.subscription.cancel` |
| `auth.api.resumeSubscription` | `authClient.paystack.subscription.resume` |
| `auth.api.getSubscription` | `authClient.paystack.subscription.get` |
| `auth.api.listActiveSubscriptions` | `authClient.paystack.subscription.list` |

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

See the [full field reference](https://docs.g14o.dev/packages/paystack-better-auth/schema#schema) for each table and column.

Tables added:

- `user` field: `paystackCustomerCode` and `paystackCustomerId`
- `subscription` (includes `emailToken` for cancel/resume; when `subscription.enabled`)
- `payment` (one-time checkout records; omit when `disablePaymentPersistence: true`)
- `webhookEvent` (included by default; omit when `disableWebhookPersistence: true`)

### Numeric columns

Paystack IDs (e.g. `6293201508`) and `payment.amount` exceed PostgreSQL `INTEGER` and require `BIGINT`. The plugin sets `bigint: true` on these fields by default. If you already migrated with `INTEGER` columns, update your schema — see [Database schema](https://docs.g14o.dev/packages/paystack-better-auth/schema).

## License

MIT
