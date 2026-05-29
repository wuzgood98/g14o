# shadcn/ui monorepo template

This is a Next.js monorepo template with shadcn/ui.

## Code quality

Linting and formatting run at the repo root via [Ultracite](https://docs.ultracite.ai) (Biome):

```bash
pnpm check   # lint + format check (alias: pnpm lint)
pnpm fix     # auto-fix (alias: pnpm format)
```

Diagnose setup issues with `pnpm dlx ultracite doctor`. Pre-commit hooks run `ultracite fix` on staged files via Husky and lint-staged.

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/button";
```
