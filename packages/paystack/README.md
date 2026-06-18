# @g14o/paystack

Paystack billing plugin for [Better Auth](https://better-auth.com). Supports customers, hosted checkout, subscriptions, authorization charges, and webhook synchronization.

## Installation

```bash
pnpm add @g14o/paystack better-auth zod
```

## Server setup

Create a `Paystack` client with your API keys, then pass it to the plugin as `paystackClient`. The client handles API authentication, webhook signature verification, and can be shared or customized (e.g. custom `fetch` for tests or proxies).

```ts
// lib/auth.ts
import { betterAuth } from "better-auth";
import { paystack, Paystack } from "@g14o/paystack";

const paystackClient = new Paystack({
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
  publicKey: process.env.PAYSTACK_PUBLIC_KEY,
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
            // Paystack plan codes from your dashboard — billing details are fetched from Paystack
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
import { paystackClientPlugin } from "@g14o/paystack/client";

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

// { authorizationUrl, reference }
```

Anonymous checkout is supported by passing `email` when no session exists.

## Subscriptions

When a plan entry includes `planCode`, the plugin fetches billing details from Paystack instead of creating a plan. Pass `annual: true` on upgrade to use `annualDiscountedPlanCode`.

Upgrade or start a subscription checkout. When switching plans, pass an optional `subscriptionCode` to target a specific subscription; the old plan stays active until the new checkout completes payment, then the prior Paystack subscription is disabled automatically.

```ts
const { data, error } = await authClient.subscription.upgrade({
  plan: "pro",
  annual: true,
  subscriptionCode: "SUB_existing", // optional — defaults to current subscription
  successUrl: "https://app.example.com/dashboard",
  cancelUrl: "https://app.example.com/pricing",
});

// { authorizationUrl, reference, plan, upgraded }
```

If checkout is abandoned during an upgrade, the existing subscription remains active.

```ts
await authClient.subscription.cancel();
await authClient.subscription.resume();
await authClient.subscription.getSubscription();
await authClient.subscription.list();
```

### Server-side subscription API

When calling from your backend (e.g. server actions, API routes), use `auth.api` instead of the client plugin. Requires `subscription.enabled: true` and an authenticated session.

| Server | Client equivalent |
|--------|-------------------|
| `auth.api.upgradeSubscription` | `authClient.subscription.upgrade` |
| `auth.api.cancelSubscription` | `authClient.subscription.cancel` |
| `auth.api.resumeSubscription` | `authClient.subscription.resume` |
| `auth.api.getSubscription` | `authClient.subscription.getSubscription` |
| `auth.api.listSubscriptions` | `authClient.subscription.list` |

```ts
// Upgrade / start subscription checkout
await auth.api.upgradeSubscription({
  body: {
    plan: "pro",
    annual: true,
    successUrl: "https://app.example.com/dashboard",
    cancelUrl: "https://app.example.com/pricing",
    subscriptionCode: "SUB_existing", // optional
    disableRedirect: true, // optional — return JSON instead of redirect
  },
});

await auth.api.cancelSubscription({ body: { subscriptionCode: "SUB_xxx" } });
await auth.api.resumeSubscription({ body: { subscriptionCode: "SUB_xxx" } });
await auth.api.getSubscription({ query: { subscriptionCode: "SUB_xxx" } });
await auth.api.listSubscriptions();
```

## Server-side billing helpers

Use Better Auth API endpoints exposed by the plugin. Subscription methods are documented above under [Server-side subscription API](#server-side-subscription-api).

```ts
await auth.api.createPaystackCustomer({ body: { userId } });
await auth.api.getPaystackCustomer({ query: { userId } });
await auth.api.syncPaystackCustomer({ body: { userId } });
await auth.api.chargeAuthorization({ body: { amount: 500, currency: "GHS" } });
```

## Webhooks

Configure your Paystack dashboard webhook URL to:

```
https://your-domain.com/api/auth/paystack/webhook
```

The plugin verifies `x-paystack-signature` using HMAC-SHA512 with the secret key from your `Paystack` client (`paystackClient.secretKey` — the value passed to `new Paystack({ secretKey })`). Events are deduplicated and persisted in `paystackWebhookEvent`.

Handled events:

- `charge.success`
- `invoice.create` / `invoice.update` / `invoice.payment_failed`
- `subscription.create` / `subscription.disable` / `subscription.not_renew`
- `subscription.expiring_cards`

## Normalized subscription statuses

| Paystack source | Normalized |
|-----------------|------------|
| `active`, `non-renewing` | `active` (`non-renewing` sets `cancelAtPeriodEnd`) |
| `attention` | `past_due` |
| `cancelled`, `completed` | `cancelled` |
| `pending`, `incomplete` | `incomplete` |

## Database schema

Run Better Auth CLI to generate migrations:

```bash
npx auth@latest generate
```

Tables added:

- `user` field: `paystackCustomerCode` and `paystackCustomerId`
- `subscription` (includes `emailToken` for cancel/resume)
- `webhookEvent` (included by default; omit when `disableWebhookPersistence: true`)

## Paystack API client

The package exports a standalone typed client used by the plugin and available for direct API calls:

```ts
// lib/paystack.ts
import { Paystack } from "@g14o/paystack";

const paystack = new Paystack({
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
  publicKey: process.env.PAYSTACK_PUBLIC_KEY, // optional — for Paystack Popup integrations
});

await paystack.transactions.initialize({ email, amount: 1000 });
```

Features: typed responses (Zod), retries with exponential backoff, timeout support, rate-limit handling, structured errors.

## License

MIT
