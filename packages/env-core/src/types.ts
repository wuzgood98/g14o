import type { OnInvalidAccessHandler } from "./client-guard";
import type { StandardSchemaV1 } from "./standard-schema";

/**
 * Record mapping environment variable names to
 * [Standard Schema v1](https://standardschema.dev) validators (Zod, Valibot, ArkType, and others).
 *
 * Used for both `server` and `client` shapes in {@link CreateEnvOptions}.
 */
export type SchemaShape = Record<string, StandardSchemaV1>;

/**
 * Raw value that may appear in a runtime environment source before schema validation.
 *
 * Values from `process.env` and bundler-inlined mappings are always strings at runtime;
 * schemas coerce them to the declared output types.
 */
export type RuntimeEnvValue = string | number | boolean | undefined | null;

/**
 * Loose record passed as `runtimeEnv`.
 *
 * Extra keys are allowed; only keys declared in `server` and `client` shapes are picked
 * and validated.
 */
export type RuntimeEnvInput = Record<string, RuntimeEnvValue>;

/**
 * Flattens intersection types into a single object type for readable IDE hovers.
 *
 * @typeParam T - Object type to simplify.
 */
export type Simplify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Extracts the output type from a single Standard Schema validator.
 *
 * @typeParam TSchema - A Standard Schema v1 validator.
 */
export type InferSchemaOutput<TSchema extends StandardSchemaV1> =
  TSchema extends StandardSchemaV1<unknown, infer TOutput> ? TOutput : never;

/**
 * Maps a {@link SchemaShape} to an object of inferred output types.
 *
 * @typeParam TShape - Server or client schema shape.
 *
 * @example
 * ```ts
 * import type { InferShapeOutput, SchemaShape } from "@g14o/env-core";
 * import * as z from "zod";
 *
 * const shape = {
 *   DATABASE_URL: z.url(),
 *   PORT: z.coerce.number(),
 * } satisfies SchemaShape;
 *
 * type Env = InferShapeOutput<typeof shape>;
 * // { DATABASE_URL: string; PORT: number }
 * ```
 */
export type InferShapeOutput<TShape extends SchemaShape> = Simplify<{
  [K in keyof TShape]: InferSchemaOutput<TShape[K]>;
}>;

/** @internal Resolves whether a client key matches the required prefix. */
type ClientKeyWithPrefix<
  TPrefix extends string,
  TKey extends PropertyKey,
> = TKey extends `${TPrefix}${string}` ? TKey : never;

/**
 * Subset of a client shape containing only keys that start with `clientPrefix`.
 *
 * @typeParam TPrefix - Required prefix (e.g. `"NEXT_PUBLIC_"`).
 * @typeParam TClient - Client schema shape before prefix filtering.
 */
export type PrefixedClientShape<
  TPrefix extends string,
  TClient extends SchemaShape,
> = Simplify<{
  [K in keyof TClient as ClientKeyWithPrefix<TPrefix, K>]: TClient[K];
}>;

/**
 * Client keys that do not start with the required `clientPrefix`.
 *
 * When this type is not `never`, {@link AssertValidClientPrefix} produces a compile-time error.
 *
 * @typeParam TPrefix - Required prefix (e.g. `"NEXT_PUBLIC_"`).
 * @typeParam TClient - Client schema shape to check.
 */
export type InvalidClientKeys<
  TPrefix extends string,
  TClient extends SchemaShape,
> = Exclude<keyof TClient, `${TPrefix}${string}`>;

/**
 * Compile-time check that every `client` key uses `clientPrefix`.
 *
 * Intersected into {@link CreateEnvOptions} on `createEnv` calls. When invalid keys exist,
 * TypeScript reports an error on the call site (not a runtime throw).
 *
 * @typeParam TPrefix - Required prefix when `clientPrefix` is set.
 * @typeParam TClient - Client schema shape to validate.
 */
export type AssertValidClientPrefix<
  TPrefix extends string | undefined,
  TClient extends SchemaShape | undefined,
> = TPrefix extends string
  ? TClient extends SchemaShape
    ? InvalidClientKeys<TPrefix, TClient> extends never
      ? unknown
      : `Client environment variable(s) must start with "${TPrefix}": ${InvalidClientKeys<TPrefix, TClient> & string}`
    : unknown
  : unknown;

/**
 * @internal Effective client shape after applying an optional `clientPrefix`.
 */
export type ResolveClientShape<
  TPrefix extends string | undefined,
  TClient extends SchemaShape | undefined,
> = TClient extends SchemaShape
  ? TPrefix extends string
    ? PrefixedClientShape<TPrefix, TClient>
    : TClient
  : Record<string, never>;

/** @internal Extracts keys from an optional schema shape, or `never` when undefined. */
type ShapeKeys<TShape extends SchemaShape | undefined> =
  TShape extends SchemaShape ? keyof TShape : never;

/**
 * Explicit per-key runtime mapping required by `runtimeEnvStrict`.
 *
 * Must include every key from `server` and `client` shapes. Used by bundlers that only
 * inline env vars you reference explicitly.
 *
 * @typeParam TServer - Server schema shape.
 * @typeParam TClient - Client schema shape.
 */
export type StrictRuntimeEnv<
  TServer extends SchemaShape | undefined,
  TClient extends SchemaShape | undefined,
> = Simplify<{
  [K in ShapeKeys<TServer> | ShapeKeys<TClient>]: RuntimeEnvValue;
}>;

/** @internal Union requiring exactly one of two option groups (XOR). */
type MutuallyExclusive<
  A extends Record<string, unknown>,
  B extends Record<string, unknown>,
> = (A & { [K in keyof B]?: never }) | (B & { [K in keyof A]?: never });

/** @internal Enforces that `runtimeEnv` and `runtimeEnvStrict` cannot both be set. */
type RuntimeEnvSource<
  TServer extends SchemaShape | undefined,
  TClient extends SchemaShape | undefined,
> = MutuallyExclusive<
  {
    /** Loose record to read values from (e.g. `process.env`). Extra keys are allowed. */
    runtimeEnv: RuntimeEnvInput;
  },
  {
    /** Explicit per-key mapping; mutually exclusive with `runtimeEnv`. */
    runtimeEnvStrict: StrictRuntimeEnv<TServer, TClient>;
  }
>;

/**
 * Merges `server` and `client` schema shapes for output type inference.
 *
 * @typeParam TServer - Server schema shape.
 * @typeParam TClient - Client schema shape.
 */
export type MergeEnvShapes<
  TServer extends SchemaShape | undefined,
  TClient extends SchemaShape | undefined,
> = (TServer extends SchemaShape ? TServer : Record<string, never>) &
  (TClient extends SchemaShape ? TClient : Record<string, never>);

/**
 * Options passed to `createEnv`. Server and client shapes are validated separately;
 * runtime values come from exactly one of `runtimeEnv` or `runtimeEnvStrict`.
 *
 * @typeParam TServer - Server-only schema shape.
 * @typeParam TClient - Client-safe schema shape.
 * @typeParam TPrefix - Required prefix for all `client` keys when `clientPrefix` is set.
 */
export type CreateEnvOptions<
  TServer extends SchemaShape | undefined = undefined,
  TClient extends SchemaShape | undefined = undefined,
  TPrefix extends string | undefined = undefined,
> = {
  /** Server-only variables; validated only when `isServer` is true. */
  server?: TServer;
  /** Variables safe on the client; always validated unless `skipValidation`. */
  client?: TClient;
  /** Prefix every `client` key must use (enforced at compile time and runtime). */
  clientPrefix?: TPrefix;
  /** Treat `""` as `undefined` before validation. Default `false`. */
  emptyStringAsUndefined?: boolean;
  /** Override server detection. Default: no `window` on `globalThis`. */
  isServer?: boolean;
  /** Called before throwing when a non-client key is read on the client. */
  onInvalidAccess?: OnInvalidAccessHandler;
  /** @internal Skip schema validation and return picked runtime values only. */
  skipValidation?: boolean;
} & RuntimeEnvSource<TServer, TClient>;

/**
 * Readonly, inferred environment object returned by `createEnv`.
 *
 * Output types are derived from {@link MergeEnvShapes} via {@link InferShapeOutput}.
 *
 * @typeParam TServer - Server schema shape.
 * @typeParam TClient - Client schema shape.
 */
export type CreateEnvOutput<
  TServer extends SchemaShape | undefined,
  TClient extends SchemaShape | undefined,
> = Readonly<InferShapeOutput<MergeEnvShapes<TServer, TClient>>>;

/**
 * @internal Normalized options after defaults and runtime source resolution inside `createEnv`.
 */
export interface ResolvedCreateEnvOptions<
  TServer extends SchemaShape,
  TClient extends SchemaShape,
> {
  client: TClient;
  clientPrefix: string | undefined;
  emptyStringAsUndefined: boolean;
  isServer: boolean;
  onInvalidAccess: OnInvalidAccessHandler | undefined;
  runtime: RuntimeEnvInput;
  server: TServer;
  skipValidation: boolean;
}
