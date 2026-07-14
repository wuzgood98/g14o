# @g14o/paystack-better-auth

## 0.4.0

### Minor Changes

- c5f775b: Remove unused public exports and orphaned internals.

  **@g14o/cache:** Drop `createCacheKeyGenerator`, `createCacheKeyFromArgs`, and public value re-exports of `CACHE_TTL` / `RedisCache` (`InMemoryCache` remains type-only for `CacheClient.inMemoryCache()`). Add `@g14o/cache/types` for `Result`, `Logger`, and related types. Strip unused pagination types.

  **@g14o/ratelimit:** Stop re-exporting `shouldSkipRateLimit` and `redisStore` from the package root (`redisStore` remains on `@g14o/ratelimit/redis`). Strip unused pagination/`Result` types from internal types.

  **@g14o/paystack-better-auth:** Remove deprecated `PaystackWebhookEventType` and unused webhook/status helper exports.

## 0.3.1

### Patch Changes

- Ship non-minified dist output for npm supply-chain visibility (Socket Security).
- Updated dependencies
  - @g14o/paystack@0.1.2

## 0.3.0

### Minor Changes

- Add one-time checkout webhook handling for `charge.success` via `checkout.onCheckoutComplete`.
- Add optional `payment` table for one-time checkout persistence (`disablePaymentPersistence: true` to omit).

## 0.2.0

### Minor Changes

- Align the client plugin with Better Auth 1.6.20 server inference and fix type mismatches.

  ### Breaking changes

  - Rename client plugin export: `paystackClientPlugin` → `paystackClient` (from `@g14o/paystack-better-auth/client`).
  - Move client API namespace: `authClient.subscription.*` → `authClient.paystack.*`.
  - Rename client method: `getSubscription` → `get` (`authClient.paystack.subscription.get`).
  - Change checkout route path: `POST /paystack/checkout/create-session` → `POST /paystack/create-checkout-session`.
  - Remove manual client `getActions` implementation and `PaystackClientPluginOptions` (including global `disableRedirect`); types are now inferred via `$InferServerPlugin` + `pathMethods`.
  - Remove main-package exports: `PAYSTACK_ERROR_CODES`, `RawError`, `PaystackErrorCodes`, and hand-written client input/result types (`CheckoutSessionInput`, `Exactly`, `RedirectResult`, etc.).
  - Require `currency` on charge-authorization requests (was optional).
  - Tighten plan `currency` to the `Currency` union (`GHS` | `NGN` | `ZAR` | `KES` | `USD` | `XOF`).
  - Raise `better-auth` peer dependency to `^1.6.20`.

  ### Fixes and improvements

  - Fix inverted `disableRedirect` behavior on checkout and subscription upgrade (redirect is now the default; JSON is returned when `disableRedirect: true`).
  - Resolve sessions asynchronously via `getSessionFromCtx` in protected routes.
  - Make GET subscription/list query schemas optional.
  - Refactor internal customer/subscription helpers to accept `GenericEndpointContext` instead of raw adapter instances.

## 0.1.0

### Minor Changes

- Initial release of `@g14o/paystack-better-auth` — a Paystack billing plugin for Better Auth.

  Includes server plugin (`paystack()`), client plugin (`paystackClientPlugin`), customer sync, hosted checkout, subscription lifecycle (subscribe/cancel/resume/upgrade), authorization charges, webhook verification and deduplication, and typed `authClient.subscription.*` helpers.
