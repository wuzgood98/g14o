---
"@g14o/events": minor
"@g14o/paystack": minor
"@g14o/paystack-better-auth": patch
"@g14o/logger": minor
"@g14o/cache": minor
"@g14o/ratelimit": minor
---

Deepen package architecture across six grill candidates.

**@g14o/events**
- Replace `EventStream.append` + `publish` with single `write` — custom stream adapters must implement `write`
- Collapse SSE handler + transport into an internal SSE session module behind `handler()`
- Add optional injectable `logger` via `@g14o/logger/verbose`

**@g14o/paystack**
- Request-first Webhook Delivery as the primary webhook interface
- Shared Paystack resource schemas and centralized `callPaystack` deep API call

**@g14o/paystack-better-auth**
- Handle `WebhookDeliveryError` from the updated Paystack client

**@g14o/logger**
- Add `@g14o/logger/verbose` with `resolveVerboseLogger` (boolean + optional injectable logger)

**@g14o/cache** / **@g14o/ratelimit**
- Migrate to shared verbose diagnostics; restore optional injectable `logger` on factory options
