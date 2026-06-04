# Changesets

We use [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs for published packages.

## Contributors

When your PR changes user-facing behavior in `@g14o/core`, run:

```bash
pnpm changeset
```

Describe the change and choose patch, minor, or major. Commit the generated `.changeset/*.md` file with your PR.

Only **`@g14o/core`** is versioned and published. Shim packages (`@g14o/utils`, `@g14o/cache`, `@g14o/ratelimit`) are listed in `ignore` in [`.changeset/config.json`](config.json).

## Maintainers

```bash
pnpm version-packages   # bump @g14o/core, update CHANGELOG, sync shim workspace:^ ranges, refresh pnpm-lock.yaml
pnpm release:publish:core    # publish core to npm
pnpm release:publish:env    # publish env-core to npm
```

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full release flow.
