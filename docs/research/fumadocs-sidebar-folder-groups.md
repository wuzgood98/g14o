# Fumadocs sidebar folder groups

How to nest several doc packages under one collapsible sidebar item without changing URLs. Used for the Ratelimit family docs.

## Nested dropdown vs layout tabs

Fumadocs has no virtual sidebar-group type. Nested dropdowns come from real folders in the content tree.

| Want | Mechanism | Source |
| --- | --- | --- |
| One parent in the same sidebar that expands to reveal children | Regular folder node → `SidebarFolder` (collapsible accordion) | [Docs layout – sidebar items](https://www.fumadocs.dev/docs/ui/layouts/docs#sidebar-items), [page-tree Folder](https://www.fumadocs.dev/docs/headless/page-tree#folder) |
| A select that swaps the entire sidebar | `root: true` folders → Layout Tabs | [Layout Tabs](https://www.fumadocs.dev/docs/ui/layouts/docs#layout-tabs), [Root Folder](https://www.fumadocs.dev/docs/page-conventions#root-folder) |

Do not set `root: true` on the parent or the children. Root folders isolate navigation: only items in the opened root are visible.

There is no `collapsed` field. Official folder flags are `defaultOpen` and `collapsible` (default `true`). Source: [Meta](https://www.fumadocs.dev/docs/page-conventions#meta), types in [`packages/core/src/page-tree/definitions.ts`](https://github.com/fuma-nama/fumadocs/blob/main/packages/core/src/page-tree/definitions.ts).

## `meta.json` pages

When `pages` is set, only listed items appear. Item types ([Pages](https://www.fumadocs.dev/docs/page-conventions#pages)):

| Type | Syntax | What it does |
| --- | --- | --- |
| Path | `ratelimit` or `./path/to/page` | Include a page or folder as a child |
| Separator | `---Label---` | Section label |
| Link | `[Text](url)` | External/internal link |
| Rest | `...` | Remaining items, alpha-sorted |
| Reversed Rest | `z...a` | Rest, reversed |
| Extract | `...folder` | Flatten that folder’s children into this folder (removes the wrapper) |
| Except | `!item` | Exclude from `...` / `z...a` |

Do not use extract (`...ratelimit`) if the folder should remain a nested group. Extract pulls children up and hides the wrapper ([builder extract logic](https://github.com/fuma-nama/fumadocs/blob/main/packages/core/src/source/page-tree/builder.ts)).

Duplicate URLs are forbidden in the page tree ([page conventions](https://www.fumadocs.dev/docs/page-conventions)).

There is no nested `{ "group": ..., "pages": [...] }` object in `meta.json`. That was proposed and rejected; the maintainer’s answer is filesystem folders ([issue #1998](https://github.com/fuma-nama/fumadocs/issues/1998)).

## Folder groups keep slugs

Wrapping a folder name in parentheses omits it from slugs but still creates a page-tree Folder (sidebar group). Display name uses the inner text via `group.exec(folderName)?.[1]` in [builder.ts](https://github.com/fuma-nama/fumadocs/blob/main/packages/core/src/source/page-tree/builder.ts).

Default slug generator drops `(group)` segments ([`getSlugs` in slugs.ts](https://github.com/fuma-nama/fumadocs/blob/main/packages/core/src/source/plugins/slugs.ts)):

```ts
const GroupRegex = /^\(.+\)$/;
if (seg.length > 0 && !GroupRegex.test(seg)) slugs.push(encodeURI(seg));
```

| Path | Slugs |
| --- | --- |
| `./dir/page.mdx` | `['dir', 'page']` |
| `./dir/index.mdx` | `['dir']` |
| `./(group-name)/page.mdx` | `['page']` |

So `packages/(ratelimit)/ratelimit-nextjs/index.mdx` stays `/packages/ratelimit-nextjs`. A non-parenthesized parent would insert an extra slug segment.

Fumadocs has no redirect API. Routing is the framework’s job ([Overview](https://www.fumadocs.dev/docs/page-conventions#overview)). Folder groups avoid the need for Next.js `redirects`.

## Folder index / clickable parent

If the parent has an `index` page, the folder is a link. Default index is `index.mdx`; override with `pagesIndex` ([Folder Index](https://www.fumadocs.dev/docs/page-conventions#folder-index)).

No index → trigger-only accordion (`SidebarFolderTrigger`), not a link. An index inside `(ratelimit)` would slug to `/packages` and clash with the Packages folder.

## This repo

```
packages/
  meta.json                 # lists "(ratelimit)" — not "...(ratelimit)"
  (ratelimit)/
    meta.json               # title: Ratelimit, defaultOpen: false
    ratelimit/
    ratelimit-nextjs/
    ratelimit-express/
    ratelimit-hono/
```

## Primary sources

- https://www.fumadocs.dev/docs/page-conventions — meta.json, pages, folder groups, root, index, slugs
- https://www.fumadocs.dev/docs/headless/page-conventions — same (core copy)
- https://www.fumadocs.dev/docs/headless/page-tree — Folder / Page / Separator / Root types
- https://www.fumadocs.dev/docs/ui/layouts/docs — sidebar rendering, Layout Tabs
- https://www.fumadocs.dev/docs/headless/source-api — `slugs`, `url`, `getPageTree`
- https://github.com/fuma-nama/fumadocs/blob/main/packages/core/src/source/plugins/slugs.ts — `(group)` stripped from URLs
- https://github.com/fuma-nama/fumadocs/blob/main/packages/core/src/source/page-tree/builder.ts — folder groups still appear in the tree
- https://github.com/fuma-nama/fumadocs/issues/1998 — maintainer: use `(foo)` folder groups, not virtual nested `meta.json`
