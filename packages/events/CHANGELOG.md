# @g14o/events

## 0.1.1

### Patch Changes

- f5f173b: Fix published declaration emit so schema inference no longer collapses to `any` for npm consumers (`stripInternal` was dropping helpers still referenced by public types). Also omit `dev-source` from published exports.

## 0.1.0

### Minor Changes

- Initial release: schema-first and type-only event bus, middleware pipeline, execution strategies, wildcards, namespaces, and React bindings.
