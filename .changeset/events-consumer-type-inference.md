---
"@g14o/events": patch
---

Fix published declaration emit so schema inference no longer collapses to `any` for npm consumers (`stripInternal` was dropping helpers still referenced by public types). Also omit `dev-source` from published exports.
