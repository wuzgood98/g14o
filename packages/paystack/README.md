# @g14o/paystack

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

const checkout = await paystack.transactions.initialize({
  email: "user@example.com",
  amount: 1500,
  currency: "GHS",
});

const customer = await paystack.customers.create({
  email: "user@example.com",
  first_name: "Ada",
  last_name: "Lovelace",
});
```

## Webhook verification

Verify Paystack webhook signatures using the client instance (uses the configured `secretKey`):

```ts
paystack.webhook.verifyPaystackWebhookSignature(
  rawBody,
  request.headers.get("x-paystack-signature")
);
// throws WebhookVerificationError on missing/invalid signature
```

## Features

- Typed API client for customers, transactions, plans, and subscriptions
- Zod-validated responses
- Retries with exponential backoff
- Timeout and rate-limit handling
- Structured error types

## Better Auth integration

For Better Auth billing (checkout, subscriptions, webhooks, DB sync), install [`@g14o/paystack-better-auth`](https://github.com/wuzgood98/g14o/tree/main/packages/paystack-better-auth).

```bash
pnpm add @g14o/paystack @g14o/paystack-better-auth better-auth zod
```

## Testing

Live integration tests call the Paystack test API and require a test secret key:

```bash
cp .env.example .env
# set PAYSTACK_SECRET_KEY=sk_test_...
pnpm test
```

Set `PAYSTACK_SECRET_KEY` in CI secrets for the main test job. Mock unit tests in `client.test.ts` and webhook tests do not call the network.

## License

MIT
