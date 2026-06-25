# @g14o/env-core

## 0.2.0

### Minor Changes

- Add `onValidationError` to `createEnv` for custom validation error handling. Export `OnValidationErrorHandler`. Issues passed to the handler include the env var name as the first path segment. Align `onInvalidAccess` with the same hook contract: call the custom handler, then throw the default error if it returns.

## 0.1.2

### Patch Changes

- Fix package exports and tsdown build output to match other g14o packages. Adds `default` export condition, `main`/`module`/`types`, and `typesVersions` so CJS/require-based loaders (e.g. drizzle-kit config) can resolve the package. Drop `.js` extensions from relative source imports.

## 0.1.1

### Patch Changes

- Add JSDoc to exported type definitions for clearer IDE hovers and generated `.d.ts` docs. Align README and `createEnv` JSDoc examples.

## 0.1.0

### Minor Changes

- Initial release of `@g14o/env-core`: typesafe environment validation with Standard Schema (Zod, Valibot, ArkType), server/client separation, optional client prefix, and `runtimeEnvStrict`.
