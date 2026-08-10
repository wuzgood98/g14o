# @g14o/logger

## 0.2.0

### Minor Changes

- 7c74d51: Deepen package architecture across six packages.

  **@g14o/events**

  - Replace `EventStream.append` + `publish` with single `write` — custom stream adapters must implement `write`
  - Collapse SSE handler + transport into an internal SSE session module behind `handler()`
  - Add optional verbose diagnostics via `verbose: boolean | VerboseLogger` (no runtime dependency on `@g14o/logger`)

  **@g14o/paystack**

  - Request-first Webhook Delivery as the primary webhook interface
  - Shared Paystack resource schemas and centralized `callPaystack` deep API call

  **@g14o/paystack-better-auth**

  - Handle `WebhookDeliveryError` from the updated Paystack client

  **@g14o/logger**

  - Add `@g14o/logger/verbose` with `resolveVerboseLogger` (`boolean | VerboseLogger`)

  **@g14o/cache** / **@g14o/ratelimit**

  - Add optional verbose diagnostics via `verbose: boolean | VerboseLogger` (no runtime dependency on `@g14o/logger`)

## 0.1.1

### Patch Changes

- c9d0d9f: Clarify public logger documentation: leaner API surface docs, clearer README intro, and simpler timestamp defaults wording.

## 0.1.0

### Minor Changes

- Initial release of `@g14o/logger` — a zero-dependency isomorphic structured logger with console and JSON transports, pretty/JSON formatting, metadata redaction, and child loggers.
