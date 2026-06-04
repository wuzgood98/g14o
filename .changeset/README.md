# Changesets

We use [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs for published packages.

## Contributors

When your PR changes user-facing behavior in `@g14o/core` or `@g14o/env-core`, run:

```bash
pnpm changeset
```

Describe the change and choose patch, minor, or major. Commit the generated `.changeset/*.md` file with your PR.

**`@g14o/core`** and **`@g14o/env-core`** are versioned and published (separate fixed groups in [`.changeset/config.json`](config.json)). Shim packages (`@g14o/utils`, `@g14o/cache`, `@g14o/ratelimit`) are listed in `ignore`.

## Maintainers

```bash
pnpm version-packages        # bump versioned packages, update CHANGELOGs, sync shim ranges, refresh pnpm-lock.yaml
pnpm release:publish:core    # publish @g14o/core to npm
pnpm release:publish:env     # publish @g14o/env-core to npm
```

See [CONTRIBUTING.md](../CONTRIBUTING.md) for git tags, GitHub releases, and the full release flow.
