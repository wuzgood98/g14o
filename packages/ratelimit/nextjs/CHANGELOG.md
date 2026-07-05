# @g14o/ratelimit-nextjs

## 0.2.0

### Minor Changes

- 5d595e5: Add boolean `skipRateLimit` on `createRateLimit`. Allow per-call `skipRateLimit` to be a boolean or callback.

### Patch Changes

- 5d595e5: Document built-in tier default limits, windows, prefixes, and runtime inspection via `tokenConfigSnapshot`.
- Updated dependencies [5d595e5]
  - @g14o/ratelimit@0.4.0

## 0.1.2

### Patch Changes

- Document exported `RateLimitClient`, `RateLimitOptions`, and `createRateLimit` with JSDoc. Align README and docs site API reference with Next.js-native types.

## 0.1.1

### Patch Changes

- Add optional `prefix` to `RateLimitOptions` for per-endpoint Redis key namespaces in `withRateLimit`, `checkRateLimit`, and `withUserRateLimit`.
- Updated dependencies
  - `@g14o/ratelimit`@0.2.0
- Re-export optional `prefix` on `RateLimitOptions` from `@g14o/ratelimit` for per-endpoint Redis key namespaces in `withRateLimit`, `checkRateLimit`, and `withUserRateLimit`.

## 0.1.0

### Minor Changes

- Initial release of `@g14o/ratelimit-nextjs` — Next.js `NextRequest` / `NextResponse` types over `@g14o/ratelimit`.
