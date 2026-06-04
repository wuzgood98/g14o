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

- Product logic lives in [`packages/core/src`](packages/core/src).
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

## Continuous integration

GitHub Actions runs on every push and pull request to `main` (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)):

- `pnpm check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm test:dist`
- `pnpm demo:cache:build`

When repository secrets `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured, an optional integration job also runs `pnpm --filter @g14o/core test:integration`. Fork PRs do not receive upstream secrets.

## Code standards

- Run `pnpm fix` before opening a PR.
- Pre-commit runs `lint-staged` → `ultracite fix` via [`.husky/pre-commit`](.husky/pre-commit).
- Follow the conventions in [`AGENTS.md`](AGENTS.md) (TypeScript, React, Ultracite/Biome rules).

## Changesets

User-facing changes to `@g14o/core` require a changeset. Only **`@g14o/core`** is versioned and published (see [`.changeset/config.json`](.changeset/config.json)).

1. Run `pnpm changeset` and describe your change (patch, minor, or major).
2. Commit the generated `.changeset/*.md` file with your PR.

Maintainers run `pnpm version-packages` and `pnpm release:publish` during release — contributors do not need to bump versions manually.

## Pull requests

- Keep PRs focused; include tests for behavior changes in `packages/core`.
- Note if your change affects Next.js build vs runtime cache or rate-limit behavior.
- Do not commit `.only` or `.skip` in tests.

## Publishing (maintainers)

```bash
pnpm build
pnpm version-packages   # after merging changesets: bumps @g14o/core, syncs shim workspace:^ ranges, updates lockfile
pnpm release:publish
git tag v<version>
git push origin main --follow-tags
gh release create v<version> --title "v<version>" --notes-file packages/core/CHANGELOG.md
```

Commit `packages/{cache,ratelimit,utils}/package.json` and `pnpm-lock.yaml` when the release changes shim `@g14o/core` specifiers.
