# @g14o/ratelimit-express

## 0.3.2

### Patch Changes

- Updated dependencies [c5f775b]
  - @g14o/ratelimit@0.6.0

## 0.3.1

### Patch Changes

- Ship non-minified dist output for npm supply-chain visibility (Socket Security).
- Updated dependencies
  - @g14o/ratelimit@0.5.1

## 0.3.0

### Minor Changes

- Add modular store architecture with `memoryStore`, `upstashStore`, and `redisStore` (node-redis / ioredis). Introduce `createStore` / `defineStore` for custom backends, optional async lifecycle hooks on `createRateLimit`, and compile-time/runtime mutual exclusivity between `store` and legacy `redis`. Re-export store helpers and `/memory`, `/upstash`, `/redis` subpaths from framework adapters. Legacy `redis: { url, token }` remains supported.

### Patch Changes

- Updated dependencies
  - @g14o/ratelimit@0.5.0

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
