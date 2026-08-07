---
"@g14o/events": patch
---

Fix client bundle emitting raw JSX in `dist/client/index.mjs`, which caused `ChunkLoadError` / `SyntaxError: Unexpected token '<'` in Next.js apps that do not list `@g14o/events` in `transpilePackages`. Point tsdown at `tsconfig.build.json` so Rolldown transforms JSX with `react-jsx` instead of inheriting `jsx: "preserve"` from the Next.js shared tsconfig.
