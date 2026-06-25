# @g14o/ratelimit

## 0.1.1

### Patch Changes

- Add generic `Req`/`Res` type parameters to `RateLimitClient`, `RateLimitOptions`, and `createRateLimit` (defaults: `Request`/`Response`).

  The `@g14o/ratelimit-nextjs` wrapper simplification and Vitest resolve alias are part of the unreleased `0.1.0` initial release (no separate version bump).

## 0.1.0

### Minor Changes

- Initial release of `@g14o/ratelimit` — framework-agnostic rate limiting using Web `Request`/`Response`, Upstash Redis backends, and configurable tiers.
