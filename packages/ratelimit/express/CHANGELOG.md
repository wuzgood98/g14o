# @g14o/ratelimit-express

## 0.2.0

### Minor Changes

- 5d595e5: Add boolean `skipRateLimit` on `createRateLimit`. Allow per-call `skipRateLimit` to be a boolean or callback.

### Patch Changes

- 5d595e5: Document built-in tier default limits, windows, prefixes, and runtime inspection via `tokenConfigSnapshot`.
- Updated dependencies [5d595e5]
  - @g14o/ratelimit@0.4.0

## 0.1.0

### Minor Changes

- Initial release of `@g14o/ratelimit-express` — Express middleware and route handler wrappers over `@g14o/ratelimit`.
- Exposes `middleware`, `userMiddleware`, `withRateLimit`, `withUserRateLimit`, and `checkRateLimit` for Express `Request`/`Response`.
- Includes `adaptExpressRequest` for custom integrations.
