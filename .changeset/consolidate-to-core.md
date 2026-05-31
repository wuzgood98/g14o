---
"@g14o/core": minor
"@g14o/utils": minor
"@g14o/cache": minor
"@g14o/ratelimit": minor
---

Consolidate utils, cache, and rate limiting into `@g14o/core` with subpath exports (`/cache`, `/ratelimit`, `/types`, `/config`). The former `@g14o/utils`, `@g14o/cache`, and `@g14o/ratelimit` packages remain as deprecated re-export shims for backward compatibility.
