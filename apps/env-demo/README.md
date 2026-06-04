# env-demo

Next.js showcase for [`@g14o/env-core`](../../packages/env-core) with **Zod**, **Valibot**, and **ArkType** validating the same environment contract.

## Setup

From the monorepo root:

```bash
pnpm install
cp apps/env-demo/.env.example apps/env-demo/.env.local
```

## Run

```bash
pnpm demo:env
```

Open [http://localhost:3001](http://localhost:3001).

## What to verify

1. **Three validator cards** on the home page show the same `DATABASE_URL`, masked `OPEN_AI_API_KEY`, and `NEXT_PUBLIC_*` values — import-time validation succeeded for all three.
2. **Client panel** — `NEXT_PUBLIC_*` values render in the browser; **Try server key on client** throws with `Attempted to access server environment variable(s) on the client: DATABASE_URL`.
3. **API** — [http://localhost:3001/api/env-status](http://localhost:3001/api/env-status) returns JSON with cross-validator consistency checks.
4. **Invalid env** — change `DATABASE_URL` in `.env.local` to `not-a-url` and restart; the dev server should fail at startup with `InvalidEnvironmentVariablesError`.

## Build

```bash
pnpm demo:env:build
```

CI sets the same demo values via workflow `env:` when running `pnpm build`. Those variables must also be listed under `build.passThroughEnv` in [`turbo.json`](../../turbo.json) — Turbo 2 strict mode filters undeclared env vars before they reach `next build`.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm demo:env` | Dev server on port 3001 |
| `pnpm demo:env:build` | Production build |
