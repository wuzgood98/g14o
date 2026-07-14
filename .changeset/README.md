# Changesets

We use [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs for published packages.

## Contributors

When your PR changes user-facing behavior in a published package, run:

```bash
pnpm changeset
```

Describe the change and choose patch, minor, or major. Commit the generated `.changeset/*.md` file with your PR.

Published packages (separate fixed groups in [`.changeset/config.json`](config.json)):

- `@g14o/env-core`
- `@g14o/cache`
- `@g14o/ratelimit`
- `@g14o/ratelimit-nextjs`
- `@g14o/ratelimit-express`
- `@g14o/ratelimit-hono`
- `@g14o/paystack`
- `@g14o/paystack-better-auth`

## Maintainers

```bash
pnpm version-packages        # bump versioned packages, update CHANGELOGs, refresh pnpm-lock.yaml
pnpm release:publish:env     # publish @g14o/env-core to npm
pnpm release:publish:cache   # publish @g14o/cache to npm
pnpm release:publish:ratelimit # publish @g14o/ratelimit to npm
pnpm release:publish:ratelimit-nextjs # publish @g14o/ratelimit-nextjs to npm
pnpm release:publish:ratelimit-express # publish @g14o/ratelimit-express to npm
pnpm release:publish:ratelimit-hono # publish @g14o/ratelimit-hono to npm
pnpm release:publish:paystack # publish @g14o/paystack to npm
pnpm release:publish:paystack-better-auth # publish @g14o/paystack-better-auth to npm
```

See [CONTRIBUTING.md](../CONTRIBUTING.md) for git tags, GitHub releases, and the full release flow.
