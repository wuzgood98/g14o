# @g14o/ratelimit

## 0.4.0

### Minor Changes

- 5d595e5: Add boolean `skipRateLimit` on `createRateLimit`. Allow per-call `skipRateLimit` to be a boolean or callback.

### Patch Changes

- 5d595e5: Document built-in tier default limits, windows, prefixes, and runtime inspection via `tokenConfigSnapshot`.

## 0.3.1

### Patch Changes

- Restore Web `Request`/`Response` as default generics for `createRateLimit`, `RateLimitClient`, and `RateLimitOptions`. `RateLimitRequest`/`RateLimitResponse` remain the constraint bound for framework adapters (e.g. Express).

## 0.3.0

### Minor Changes

- Add `RateLimitRequest` and `RateLimitResponse` minimal interfaces for framework adapters (Express, custom runtimes).
- Export shared response helpers: `buildRateLimitHeaders`, `computeRetryAfterSeconds`, `buildRateLimitExceededBody`, `RETRY_AFTER_DELAY_MS`.
- Widen `RateLimitClient`, `RateLimitOptions`, and `createRateLimit` generics from Web `Request`/`Response` to the new minimal types (Web `Request`/`Response` remain valid).

## 0.2.0

### Minor Changes

- Add optional `prefix` to `RateLimitOptions` for per-endpoint Redis key namespaces. Use it on `withRateLimit`, `checkRateLimit`, or `withUserRateLimit` to scope rate limits independently while keeping the same tier defaults.

## 0.1.1

### Patch Changes

- Add generic `Req`/`Res` type parameters to `RateLimitClient`, `RateLimitOptions`, and `createRateLimit` (defaults: `Request`/`Response`).

  The `@g14o/ratelimit-nextjs` wrapper simplification and Vitest resolve alias are part of the unreleased `0.1.0` initial release (no separate version bump).

## 0.1.0

### Minor Changes

- Initial release of `@g14o/ratelimit` — framework-agnostic rate limiting using Web `Request`/`Response`, Upstash Redis backends, and configurable tiers.
