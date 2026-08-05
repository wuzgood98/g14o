# Events: source JSDoc for docs, strip comments on publish

`@g14o/events` keeps short property JSDoc on option/config types in source so the docs site's `OptionsTable` (via `fumadocs-typescript`) can show descriptions. Published `.d.mts` is stripped after emit (`removeComments` on the dts tsconfig plus `scripts/strip-dts-comments.mjs`, because `rolldown-plugin-dts` preserves JSDoc) so npm pack size does not grow — npm consumers get lean declarations without property hover prose; the docs site and monorepo source remain the reference for option meaning.

Method surfaces (`EventBus`, `ChannelEmitter`, `EventStream`) are not documented via OptionsTable; narrative pages (Server, Listeners, Streams, etc.) carry that detail instead of empty type-index tables.

If we need npm IDE hovers again, revisit a dual emit path or a docs-only description map rather than shipping verbose JSDoc in the tarball.
