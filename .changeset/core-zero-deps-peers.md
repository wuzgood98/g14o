---
"@g14o/core": major
---

### Breaking changes

- **Root export is utils-only:** `configureUtils`, `createRedisClient`, `resolveRedisClient`, and other config helpers are no longer exported from `@g14o/core`. Import them from `@g14o/core/config`.
- **No bundled Upstash:** `@upstash/redis` and `@upstash/ratelimit` moved from `dependencies` to optional `peerDependencies`. Install peers when using `@g14o/core/config`, `/cache`, or `/ratelimit`.
- **`Logger` and `InMemoryEnvOptions`** live on `@g14o/core/types` (also re-exported from `@g14o/core/config`).

### Other

- Local `Duration` / `Unit` types for rate-limit windows (no type import from `@upstash/ratelimit`).
- `parseDurationToMs` supports `ms` and compact forms (e.g. `"60s"`, `"500ms"`).
