---
"@g14o/ratelimit-hono": patch
---

Fix empty response bodies from `middleware` and `userMiddleware`. Apply rate-limit headers with `c.header()` before `next()` only; re-applying after `next()` could drop the handler JSON body.
