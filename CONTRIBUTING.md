# Contributing

Thanks for helping improve g14o. This guide covers local setup, development workflow, and how to open pull requests.

## Getting started

**Prerequisites:** Node `>=22.18`, [pnpm](https://pnpm.io) (version pinned in root [`package.json`](package.json)). CI uses Node 24.

```bash
git clone https://github.com/wuzgood98/g14o.git
cd g14o
pnpm install
```

**Where to make changes:**

- Product logic lives in [`packages/core/src`](packages/core/src) and [`packages/env-core/src`](packages/env-core/src).
- [`packages/utils`](packages/utils), [`packages/cache`](packages/cache), and [`packages/ratelimit`](packages/ratelimit) are deprecated shims that re-export from core — do not duplicate logic there.

## Development workflow

From the repo root:

```bash
pnpm check          # ultracite lint + format
pnpm fix            # auto-fix
pnpm test           # turbo test (all packages)
pnpm build          # turbo build
pnpm typecheck
pnpm test:dist      # smoke published tarballs (scripts/smoke-dist.mjs)
```

`@g14o/core` lists `@upstash/redis`, `@upstash/ratelimit`, and `next` as **optional peers** (devDependencies in `packages/core` satisfy them for local work). `pnpm test:dist` installs those peers in a smoke consumer. Apps using cache/ratelimit must declare the peers in their own `package.json`.

Optional Upstash integration tests (skipped when credentials are missing):

```bash
# In packages/core — copy .env.example → .env.local when credentials are available
pnpm --filter @g14o/core test:integration
```

Cache demo verification:

```bash
pnpm demo:cache:build
```

See [apps/cache-demo/README.md](apps/cache-demo/README.md) for expected build and runtime behavior.

Environment validation demo:

```bash
cp apps/env-demo/.env.example apps/env-demo/.env.local
pnpm demo:env:build
```

See [apps/env-demo/README.md](apps/env-demo/README.md) for Zod, Valibot, and ArkType verification steps.

## Continuous integration

GitHub Actions runs on every push and pull request to `main` (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)):

- `pnpm check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build` (includes `env-demo`; workflow sets demo env vars — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml))
- `pnpm test:dist`
- `pnpm demo:cache:build`

When repository secrets `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured, an optional integration job also runs `pnpm --filter @g14o/core test:integration`. Fork PRs do not receive upstream secrets.

## Code standards

- Run `pnpm fix` before opening a PR.
- Pre-commit runs `lint-staged` → `ultracite fix` via [`.husky/pre-commit`](.husky/pre-commit).
- Follow the conventions in [`AGENTS.md`](AGENTS.md) (TypeScript, React, Ultracite/Biome rules).

## Changesets

User-facing changes to **`@g14o/core`** or **`@g14o/env-core`** require a changeset. Those packages are versioned and published (see [`.changeset/config.json`](.changeset/config.json)).

1. Run `pnpm changeset` and describe your change (patch, minor, or major).
2. Commit the generated `.changeset/*.md` file with your PR.

Maintainers run `pnpm version-packages` and `pnpm release:publish:core` or `pnpm release:publish:env` during release — contributors do not need to bump versions manually.

## Pull requests

- Keep PRs focused; include tests for behavior changes in `packages/core`.
- Note if your change affects Next.js build vs runtime cache or rate-limit behavior.
- Do not commit `.only` or `.skip` in tests.

## Publishing (maintainers)

```bash
pnpm build
pnpm version-packages   # bumps versioned packages; syncs shim workspace:^ ranges; updates lockfile

# @g14o/core (skip if not versioned this cycle)
pnpm release:publish:core
git tag '@g14o/core@<core-version>'    # from packages/core/package.json
git push origin main --follow-tags
gh release create '@g14o/core@<core-version>' \
  --title '@g14o/core v<core-version>' \
  --notes-file packages/core/CHANGELOG.md

# @g14o/env-core (skip if not versioned this cycle)
pnpm release:publish:env
git tag '@g14o/env-core@<env-version>'   # from packages/env-core/package.json
git push origin main --follow-tags
gh release create '@g14o/env-core@<env-version>' \
  --title '@g14o/env-core v<env-version>' \
  --notes-file packages/env-core/CHANGELOG.md
```

Read `<core-version>` and `<env-version>` from each package’s `package.json` after `pnpm version-packages`. Only run the core or env block when that package was bumped in the changeset release (do not re-tag unchanged versions).

Commit `packages/{cache,ratelimit,utils}/package.json` and `pnpm-lock.yaml` when the release changes shim `@g14o/core` specifiers.
