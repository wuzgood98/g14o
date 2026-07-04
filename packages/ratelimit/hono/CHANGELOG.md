# @g14o/ratelimit-hono

## 0.1.0

### Minor Changes

- Initial release of `@g14o/ratelimit-hono` — Hono middleware and route handler wrappers over `@g14o/ratelimit`.
- Exposes `middleware`, `userMiddleware`, `withRateLimit`, `withUserRateLimit`, and `checkRateLimit` for Hono `Context` / Web `Response`.
- Includes Web `Response` helpers for 429 responses and rate-limit headers.
