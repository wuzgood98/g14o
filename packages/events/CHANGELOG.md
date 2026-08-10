# @g14o/events

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

## 0.1.2

### Patch Changes

- 5966c1e: Fix client bundle emitting raw JSX in `dist/client/index.mjs`, which caused `ChunkLoadError` / `SyntaxError: Unexpected token '<'` in Next.js apps that do not list `@g14o/events` in `transpilePackages`. Point tsdown at `tsconfig.build.json` so Rolldown transforms JSX with `react-jsx` instead of inheriting `jsx: "preserve"` from the Next.js shared tsconfig.

## 0.1.1

### Patch Changes

- f5f173b: Fix published declaration emit so schema inference no longer collapses to `any` for npm consumers (`stripInternal` was dropping helpers still referenced by public types). Also omit `dev-source` from published exports.

## 0.1.0

### Minor Changes

- Initial release: schema-first and type-only event bus, middleware pipeline, execution strategies, wildcards, namespaces, and React bindings.
