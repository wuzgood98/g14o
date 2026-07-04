# @g14o/ratelimit-nextjs

## 0.1.1

### Patch Changes

- Add optional `prefix` to `RateLimitOptions` for per-endpoint Redis key namespaces in `withRateLimit`, `checkRateLimit`, and `withUserRateLimit`.
- Updated dependencies
  - `@g14o/ratelimit`@0.2.0
- Re-export optional `prefix` on `RateLimitOptions` from `@g14o/ratelimit` for per-endpoint Redis key namespaces in `withRateLimit`, `checkRateLimit`, and `withUserRateLimit`.
## 0.1.0

### Minor Changes

- Initial release of `@g14o/ratelimit-nextjs` — Next.js `NextRequest` / `NextResponse` types over `@g14o/ratelimit`.
