# @g14o/paystack

> Documentation: [docs.g14o.dev/packages/paystack](https://docs.g14o.dev/packages/paystack)

Typed Paystack REST SDK with Zod-validated responses, retries, and webhook verification.

## Installation

```bash
pnpm add @g14o/paystack zod
```

## Usage

```ts
import { Paystack } from "@g14o/paystack";

const paystack = new Paystack({
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
  publicKey: process.env.PAYSTACK_PUBLIC_KEY, // optional
});
```

## Transactions

```ts
// Start hosted checkout
const checkout = await paystack.transactions.initialize({
  email: "user@example.com",
  amount: 1500,
  currency: "GHS",
  callback_url: "https://app.example.com/callback",
});

// Verify payment server-side before fulfilling
const tx = await paystack.transactions.verify(checkout.reference);

// Charge a saved authorization code
await paystack.transactions.chargeAuthorization({
  email: "user@example.com",
  amount: 1500,
  authorization_code: "AUTH_xxx",
});
```

## Customers

```ts
const customer = await paystack.customers.create({
  email: "user@example.com",
  first_name: "Ada",
  last_name: "Lovelace",
});

await paystack.customers.fetch(customer.customer_code);
await paystack.customers.list({ perPage: 25, page: 1 });
await paystack.customers.update(customer.customer_code, { phone: "+233200000000" });
```

## Plans

```ts
const plan = await paystack.plans.create({
  name: "Pro Monthly",
  amount: 5000,
  interval: "monthly",
  currency: "GHS",
});

await paystack.plans.fetch(plan.plan_code);
await paystack.plans.list({ perPage: 10, page: 1 });
```

## Subscriptions

Store `email_token` from create/fetch — required for disable/enable.

```ts
const sub = await paystack.subscriptions.create({
  customer: customer.customer_code,
  plan: plan.plan_code,
});

await paystack.subscriptions.disable({
  code: sub.subscription_code,
  token: sub.email_token!,
});

await paystack.subscriptions.enable({
  code: sub.subscription_code,
  token: sub.email_token!,
});
```

## Webhooks

```ts
import { Paystack, isPaystackEvent, processWebhookDelivery } from "@g14o/paystack";

// Simple: verify + parse
const event = await paystack.webhook.processWebhookRequest(request);

// Production: verify + parse + handler + deduplication
const result = await paystack.webhook.processWebhookDelivery(request, {
  handler: async (event) => {
    if (isPaystackEvent(event, "charge.success")) {
      // fulfill order
    }
  },
  store: myWebhookStore,
});
```

Supported events (27): `charge.success`, `bank.transfer.rejected`, disputes, customer identification, dedicated accounts, invoices, payment requests, refunds, subscriptions, transfers. See [webhooks docs](https://docs.g14o.dev/packages/paystack/webhooks).

## Errors

- `PaystackError` — API, validation, network, rate limit, timeout (`PAYSTACK_*` codes)
- `WebhookVerificationError` — missing/invalid signature (`WEBHOOK_*` codes)

## Features

- Typed API client for customers, transactions, plans, and subscriptions
- Zod-validated responses and webhook payloads
- Retries with exponential backoff
- Timeout and rate-limit handling
- Webhook signature verification and optional deduplication

## Better Auth integration

For Better Auth billing (checkout, subscriptions, webhooks, DB sync), install [`@g14o/paystack-better-auth`](https://github.com/wuzgood98/g14o/tree/main/packages/paystack-better-auth).

```bash
pnpm add @g14o/paystack @g14o/paystack-better-auth better-auth zod
```

## License

MIT
